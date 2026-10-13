import test from 'node:test';import assert from 'node:assert/strict';
import {manifest,measure,render,resetLines} from '../web/plugins/codex-reset.js';
import {registerPlugin,renderFrame,normalizeScene} from '../web/core/render.js';
test('independent reset plugin selects each window and each display field without usage bars',()=>{
 registerPlugin(manifest,render,measure);const now=Date.now(),data={now,quota:{primary:{resetsAt:(now+300000)/1000},secondary:{resetsAt:(now+86400000)/1000}}},e={id:'r',type:manifest.id,x:0,y:0,width:100,height:12,props:{window:'both',autoFit:true}};
 assert.match(resetLines(e,data)[0],/^5H IN 00:05$/);assert.match(resetLines(e,data)[1],/^WK IN 1D00:00$/);
 assert.equal(resetLines({...e,props:{showCountdown:false,showDate:false,showTime:false}},data).length,0);
 assert.deepEqual(resetLines({...e,props:{window:'secondary',showWindow:false}},{}),['--']);
 assert.deepEqual(resetLines({...e,props:{window:'primary',showWindow:false}},{...data,quota:{...data.quota,status:'stale'}}),['--']);
 const scene=normalizeScene({schemaVersion:1,elements:[e]});assert.ok(renderFrame(scene,data).some(Boolean));assert.equal(scene.elements[0].type,'codex-reset');
 assert.ok(measure({...e,props:{window:'both',showCountdown:true,showDate:true,showTime:true}},data).width<=256);
});
