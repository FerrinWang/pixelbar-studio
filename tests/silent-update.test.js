import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStudio} from '../server/server.js';

test('failed silent engine transaction is retriable, never deduplicated as success',async t=>{
  let attempts=0,fail=true;
  const app=await createStudio({port:0,stateDir:await mkdtemp(join(tmpdir(),'pixelbar-silent-')),interval:60000,engineCall:async args=>{
    if(args[0]==='quota')return {primary:{usedPercent:10}};
    if(args[0]==='status')return {connected:true,busy:false};
    if(args[0]==='push'){
      attempts++;
      if(fail)throw new Error('消息提示音关闭未确认，已停止上传。');
      return {status:'pushed',silentUpdate:true,messageBeepRestored:true};
    }
    throw new Error('Unexpected command: '+args[0]);
  }});
  t.after(()=>app.close());
  const frame=new Uint8Array(1024);
  await assert.rejects(app.push(frame),/消息提示音/);
  assert.equal(app.status().device.busy,false);
  assert.equal(app.status().lastPush,null);
  assert.equal(app.status().autoPush,false);
  fail=false;
  const result=await app.push(frame);
  assert.equal(result.result.silentUpdate,true);
  assert.equal(result.result.messageBeepRestored,true);
  assert.equal(app.status().error,null);
  assert.equal((await app.push(frame)).unchanged,true);
  assert.equal(attempts,2,'Unchanged automatic frame must not trigger another news message');
});
