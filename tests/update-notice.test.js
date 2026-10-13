import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStudio} from '../server/server.js';
import {validateUpdateNotice} from '../server/update-notice.js';
test('notice enforces 15 wide or 32 ASCII characters with proportional mixed budget',()=>{
  assert.equal(validateUpdateNotice('中'.repeat(15)),'中'.repeat(15));
  assert.equal(validateUpdateNotice('A'.repeat(32)).length,32);
  assert.throws(()=>validateUpdateNotice('中'.repeat(16)),/15/);
  assert.throws(()=>validateUpdateNotice('A'.repeat(33)),/32/);
  assert.equal(validateUpdateNotice('中'.repeat(7)+'A'.repeat(17)).length,24);
  assert.throws(()=>validateUpdateNotice('中'.repeat(8)+'A'.repeat(17)),/混排/);
  assert.equal(validateUpdateNotice('  更新中  '),'  更新中  ');
  assert.throws(()=>validateUpdateNotice('a'.repeat(255)),/32/);
  assert.throws(()=>validateUpdateNotice('中'.repeat(86)),/255/);
  assert.throws(()=>validateUpdateNotice(' \n '));
  assert.throws(()=>validateUpdateNotice(''));
});
test('notice persists independently and reaches manual, animation and automatic engine calls',async()=>{
  const stateDir=await mkdtemp(join(tmpdir(),'pixelbar-notice-')),calls=[];
  const engineCall=async args=>{if(args[0]==='quota')return {primary:{usedPercent:5}};if(args[0]==='status')return {connected:true,busy:false};calls.push(args);return {status:'pushed'};};
  let app=await createStudio({port:0,stateDir,engineCall,interval:60000});
  try{
    const base='http://127.0.0.1:'+app.port,r=await fetch(base),cookie=r.headers.get('set-cookie').split(';')[0],headers={cookie,'Content-Type':'application/json'};
    assert.equal((await fetch(base+'/api/update-notice')).status,403);
    assert.equal((await(await fetch(base+'/api/update-notice',{headers})).json()).text,'屏幕更新中');
    assert.equal((await fetch(base+'/api/update-notice',{method:'PUT',headers,body:JSON.stringify({text:'█'.repeat(12)+'请稍候'})})).status,200);
    const text='█'.repeat(12)+'请稍候',frame=new Uint8Array(1024);
    await app.push(frame,true);assert.deepEqual(calls.at(-1).slice(-2),['--notice',text]);
    await app.push(new Uint8Array(2048),true,500);assert.deepEqual(calls.at(-1).slice(-2),['--notice',text]);
    await fetch(base+'/api/auto',{method:'POST',headers,body:'{"enabled":true}'});await app.tick();assert.deepEqual(calls.at(-1).slice(-2),['--notice',text]);
    assert.equal((await fetch(base+'/api/update-notice',{method:'PUT',headers,body:'{"text":""}'})).status,400);
    assert.equal(JSON.parse(await readFile(join(stateDir,'update-notice.json'))).text,text);
    const sceneBefore=await readFile(join(stateDir,'studio.json'),'utf8');
    await app.close();app=await createStudio({port:0,stateDir,engineCall,interval:60000});
    const b='http://127.0.0.1:'+app.port,root=await fetch(b),h={cookie:root.headers.get('set-cookie').split(';')[0]};
    assert.equal((await(await fetch(b+'/api/update-notice',{headers:h})).json()).text,text);
    assert.equal(await readFile(join(stateDir,'studio.json'),'utf8'),sceneBefore);
  }finally{await app.close();}
});
