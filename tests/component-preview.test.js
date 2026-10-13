import test from 'node:test';
import assert from 'node:assert/strict';
import {newComponentDraft,freePlacement,overlaps} from '../web/core/component-draft.js';
import {builtins,fitElement,renderFrame,defaultScene} from '../web/core/render.js';
import {quotaLayout,resetText} from '../web/core/quota-reset.js';
test('six quota reset choices are independent and preserve unknown and expired semantics',()=>{
  const now=Date.now(),window={resetsAt:Math.floor(now/1000)+3661};
  assert.equal(resetText(window,{},'primary',now),'');
  assert.equal(resetText(window,{primaryCountdown:true},'secondary',now),'');
  assert.equal(resetText(null,{primaryCountdown:true,primaryDate:true,primaryTime:true},'primary',now),'-- -- --');
  assert.match(resetText(window,{primaryCountdown:true},'primary',now),/^IN 01:02$/);
  assert.equal(resetText({resetsAt:1},{primaryCountdown:true},'primary',now),'IN 00:00');
  assert.match(resetText(window,{primaryDate:true},'primary',now),/^\d{4}-\d{2}-\d{2}$/);
  assert.match(resetText(window,{primaryTime:true},'primary',now),/^\d{2}:\d{2}$/);
  assert.equal(resetText({resetsAt:window.resetsAt*1000},{primaryTime:true},'primary',now),resetText(window,{primaryTime:true},'primary',now));
});
test('quota reset rows fit native screen without a frame and grow automatic content bounds',()=>{
  const props={showLabel:true,autoFit:true};for(const key of ['primary','secondary'])for(const kind of ['Countdown','Date','Time'])props[key+kind]=true;
  const quota={primary:{usedPercent:5,resetsAt:Date.now()+3600000},secondary:{usedPercent:55,resetsAt:Date.now()+604800000}};
  const layout=quotaLayout(props,quota);assert.equal(layout.height,32);assert.ok(layout.width<=256);
  const e={id:'q',type:'codex-quota',x:0,y:0,width:64,height:15,props};fitElement(e,{quota});assert.equal(e.height,32);assert.ok(e.width>64);
  assert.equal(renderFrame({schemaVersion:1,elements:[e]},{quota}).length,1024);
  assert.equal(quotaLayout({showLabel:false}).height,15);assert.equal(quotaLayout({}).height,23);
});
test('new drafts default to autofit without mutating manifests or existing designs',()=>{
  const manifest=builtins.find(p=>p.id==='clock'),original=JSON.stringify(defaultScene),m=JSON.stringify(manifest);
  const draft=newComponentDraft(manifest,manifest.schema);assert.equal(draft.props.autoFit,true);assert.equal(draft.props.blinkColon,false);
  assert.equal(JSON.stringify(manifest),m);assert.equal(JSON.stringify(defaultScene),original);
  assert.equal(defaultScene.elements.find(e=>e.type==='clock').props.autoFit,undefined);
});
test('free placement excludes existing boxes and reports full canvas explicitly',()=>{
  const e={x:0,y:0,width:10,height:10};const elements=[{x:0,y:0,width:100,height:32}];
  assert.deepEqual(freePlacement(e,elements),{x:100,y:0});assert.equal(overlaps({...e,x:100},elements[0]),false);
  assert.equal(freePlacement(e,[{x:0,y:0,width:256,height:32}]),null);
});
