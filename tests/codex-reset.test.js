import test from 'node:test';import assert from 'node:assert/strict';
import {manifest,measure,render,resetLines,resetLayout} from '../web/plugins/codex-reset.js';
import {registerPlugin,renderFrame,normalizeScene,measureElement} from '../web/core/render.js';
test('independent reset plugin selects each window and each display field without usage bars',()=>{
 registerPlugin(manifest,render,measure);const now=Date.now(),data={now,quota:{primary:{resetsAt:(now+300000)/1000},secondary:{resetsAt:(now+86400000)/1000}}},e={id:'r',type:manifest.id,x:0,y:0,width:100,height:12,props:{window:'both',autoFit:true}};
 assert.match(resetLines(e,data)[0],/^5H IN 00:05$/);assert.match(resetLines(e,data)[1],/^WK IN 1D00:00$/);
 assert.equal(resetLines({...e,props:{showCountdown:false,showDate:false,showTime:false}},data).length,0);
 assert.deepEqual(resetLines({...e,props:{window:'secondary',showWindow:false}},{}),['--']);
 assert.deepEqual(resetLines({...e,props:{window:'primary',showWindow:false}},{...data,quota:{...data.quota,status:'stale'}}),['--']);
 const scene=normalizeScene({schemaVersion:1,elements:[e]});assert.ok(renderFrame(scene,data).some(Boolean));assert.equal(scene.elements[0].type,'codex-reset');
 assert.ok(measure({...e,props:{window:'both',showCountdown:true,showDate:true,showTime:true}},data).width<=256);
});
test('fixed single-row reset layout trades bar length for text while preserving width',()=>{
 const now=1700000000000,data={now,quota:{primary:{resetsAt:(now+9000000)/1000,windowDurationMins:300},secondary:{resetsAt:(now+3*86400000)/1000,windowDurationMins:10080}}},e={id:'r',type:manifest.id,x:0,y:0,width:256,height:5,props:{totalWidth:256,showBar:true,showCountdown:true}};
 const short=resetLayout(e,data);assert.equal(short.width,256);assert.equal(short.height,5);assert.equal(short.items[0].remaining,.5);
 const long=resetLayout({...e,props:{...e.props,showDate:true,showTime:true}},data);assert.equal(long.width,short.width);assert.ok(long.items[0].barWidth<short.items[0].barWidth);assert.equal(long.items[0].barX+long.items[0].barWidth,256);
 const both=resetLayout({...e,props:{...e.props,window:'both'}},data);assert.equal(both.items.length,2);assert.equal(both.height,5);assert.equal(both.items[1].barX+both.items[1].barWidth,256);
 assert.equal(resetLayout({...e,props:{...e.props,showBar:false}},data).width,256);
 assert.equal(measureElement({...e,props:{...e.props,frameEnabled:true}},data).width,256,'border is included in the fixed width');
 assert.equal(resetLayout(e,{now,quota:{primary:{resetsAt:data.quota.primary.resetsAt}}}).items[0].remaining,null);
 assert.ok(resetLayout({...e,props:{...e.props,totalWidth:16,showDate:true,showTime:true}},data).warning);
 assert.ok(measure({...e,props:{...e.props,totalWidth:16,showDate:true,showTime:true}},data).warning);
 assert.equal(resetLayout({...e,props:{window:'both'}},data).legacy,true,'old saved components do not silently change layout');
});
