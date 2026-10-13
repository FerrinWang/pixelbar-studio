import test from 'node:test';
import assert from 'node:assert/strict';
import {getIconRows,defaultIconRows,validIconRows,parseIconFile,iconFile,iconSizes} from '../web/core/bilibili-icons.js';
import {renderFrame,registerPlugin,normalizeScene} from '../web/core/render.js';
import {validateScene} from '../server/scene.js';
import {manifest,render,measure} from '../web/plugins/bilibili-fans.js';
registerPlugin(manifest,render,measure);
test('Three fixed-size icon presets return independent copies, never mutable shared defaults',()=>{
 for(const size of Object.keys(iconSizes)){const rows=getIconRows(size);assert.equal(validIconRows(rows,size),true);rows[0]='0'.repeat(iconSizes[size].width);assert.deepEqual(getIconRows(size),defaultIconRows(size));}
});
test('Custom icons survive scene save and normalize and render identically headlessly',()=>{
 const overrides={medium:Array(11).fill('0'.repeat(12))},e={id:'b',type:'bilibili-fans',x:0,y:0,width:88,height:24,props:{uid:'1',sizePreset:'medium',iconOverrides:overrides}},scene={schemaVersion:1,width:256,height:32,elements:[e]},data={providers:{bilibili:{value:{accounts:{'1':{follower:13038226,status:'live'}}}}}};
 const custom=renderFrame(scene,data);assert.notDeepEqual(custom,renderFrame({...scene,elements:[{...e,props:{...e.props,iconOverrides:{}}}]},data));
 assert.deepEqual(custom,renderFrame(normalizeScene(validateScene(JSON.parse(JSON.stringify(scene)))),data));
 assert.deepEqual(getIconRows('small',overrides),defaultIconRows('small'));assert.deepEqual(getIconRows('large',overrides),defaultIconRows('large'));
});
test('Icon files round trip all presets and reject wrong dimensions or non-binary data',()=>{
 const icons=Object.fromEntries(Object.keys(iconSizes).map(size=>[size,getIconRows(size)]));assert.deepEqual(parseIconFile(JSON.parse(JSON.stringify(iconFile(icons)))),icons);
 assert.throws(()=>parseIconFile({schemaVersion:1,type:'pixelbar-bilibili-icons',icons:{...icons,large:['11']}}));assert.throws(()=>parseIconFile({schemaVersion:1,type:'pixelbar-bilibili-icons',icons:{...icons,small:Array(7).fill('<script')}}));
 assert.deepEqual(getIconRows('small',{small:['broken']}),defaultIconRows('small'));
 assert.deepEqual(getIconRows('__proto__',{small:['broken']}),defaultIconRows('medium'));
});
