import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {DEFAULT_REMINDERS,validateReminders,emptyReminderRuntime,planReminders} from '../server/reminders.js';
import {createStudio} from '../server/server.js';
test('reminders validate rules and default disabled, with bounded text and threshold',()=>{
 assert.ok(DEFAULT_REMINDERS.rules.every(r=>!r.enabled));assert.deepEqual(validateReminders(DEFAULT_REMINDERS),DEFAULT_REMINDERS);
 const config=structuredClone(DEFAULT_REMINDERS);config.rules[0].minutes=0;assert.throws(()=>validateReminders(config));config.rules[0].minutes=5;config.rules[0].text='中'.repeat(16);assert.throws(()=>validateReminders(config),/15/);
});
test('planner handles threshold, rollover, stale quota, durable dedup and retries',()=>{
 const now=1700000000000,cycle=now+300000,config=validateReminders({version:1,rules:DEFAULT_REMINDERS.rules.slice(0,2).map(r=>({...r,enabled:true}))}),quota={status:'live',primary:{resetsAt:cycle/1000}};
 let plan=planReminders(config,emptyReminderRuntime(),quota,now);assert.equal(plan.events.length,1);assert.equal(plan.events[0].id,'five-before');
 plan.runtime.sent.push({key:plan.events[0].key,at:now});assert.equal(planReminders(config,plan.runtime,quota,now+1000).events.length,0);
 const rollover={status:'live',primary:{resetsAt:(cycle+18000000)/1000}};plan=planReminders(config,plan.runtime,rollover,cycle+1000);assert.equal(plan.events.length,1);assert.equal(plan.events[0].id,'five-reset');
 const retry=planReminders(config,JSON.parse(JSON.stringify(plan.runtime)),rollover,cycle+2000);assert.equal(retry.events.length,1,'failed notification stays pending across rollover/restart');
 retry.runtime.sent.push({key:retry.events[0].key,at:cycle+2000});assert.equal(planReminders(config,retry.runtime,rollover,cycle+3000).events.length,0);
 assert.equal(planReminders(config,plan.runtime,{...rollover,status:'stale'},cycle+3000).events.length,0);
 assert.equal(planReminders(config,emptyReminderRuntime(),{status:'live',primary:{resetsAt:(now-5000)/1000}},now).events.length,0,'old reset on first launch is not replayed');
 assert.equal(planReminders(config,plan.runtime,rollover,cycle+16*60000).events.length,0,'expired missed reset is not replayed');
});
test('saved reminders run without browser or auto push, retry failure and survive restart',async()=>{
 const stateDir=await mkdtemp(join(tmpdir(),'pixelbar-reminders-'));let calls=[],fail=true;
 const engineCall=async args=>{if(args[0]==='quota')return {primary:{usedPercent:9,resetsAt:Math.floor((Date.now()+240000)/1000)}};if(args[0]==='status')return {connected:true,busy:false};if(args[0]==='push'){calls.push(args);if(fail)throw new Error('temporary failure');return {silentUpdate:true,messageBeepRestored:true};}return {};};
 // Stable cycle: real upstream resetsAt does not advance on every sample.
 const resetAt=Math.floor((Date.now()+240000)/1000),stableEngine=args=>args[0]==='quota'?Promise.resolve({primary:{usedPercent:9,resetsAt:resetAt}}):engineCall(args);
 let app=await createStudio({port:0,stateDir,engineCall:stableEngine,interval:60000});
 try{
  await app.tick();const base='http://127.0.0.1:'+app.port,root=await fetch(base),cookie=root.headers.get('set-cookie').split(';')[0],headers={cookie,'Content-Type':'application/json'};
  assert.equal((await fetch(base+'/api/reminders')).status,403);const config=structuredClone(DEFAULT_REMINDERS);config.rules[0].enabled=true;
  assert.equal((await fetch(base+'/api/reminders',{method:'PUT',headers,body:JSON.stringify(config)})).status,200);
  await app.tick();assert.equal(calls.length,1);assert.equal(app.status().autoPush,false);assert.match(app.status().reminders.error,/failure/);
  fail=false;await app.tick();assert.equal(calls.length,2);assert.deepEqual(calls.at(-1).slice(-2),['--notice','5H即将重置']);assert.equal(app.status().reminders.error,null);
  await app.tick();assert.equal(calls.length,2);assert.equal(JSON.parse(await readFile(join(stateDir,'reminders.json'))).rules[0].enabled,true);
  assert.equal((await fetch(base+'/api/reminders/test',{method:'POST',headers,body:JSON.stringify({id:'five-before'})})).status,200);assert.equal(calls.length,3,'manual test is an explicit real push even after same-cycle delivery');
  await app.close();app=await createStudio({port:0,stateDir,engineCall:stableEngine,interval:60000});await app.tick();assert.equal(calls.length,3,'sent cycle is not replayed after restart');
 }finally{await app.close();}
});
