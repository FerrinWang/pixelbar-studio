import test from 'node:test';
import assert from 'node:assert/strict';
import {renderFrame,registerPlugin,fitElement,measureElement,contentElement,PixelContext} from '../web/core/render.js';
import {loadServerFonts} from '../server/fonts.js';
import {prepareText} from '../web/text-raster.js';
import {manifest,render,measure} from '../web/plugins/bilibili-fans.js';
await loadServerFonts();registerPlugin(manifest,render,measure);
const data={providers:{bilibili:{value:{accounts:{'1':{follower:13038226,status:'live'}}}}},now:0};
test('Small, medium, large presets fit complete eight digit numbers with distinct icon detail',()=>{
 const dims=[];for(const sizePreset of ['small','medium','large']){
  const e={id:'b',type:'bilibili-fans',x:0,y:0,width:88,height:24,props:{uid:'1',sizePreset}},m=measure(e,data);fitElement(e,data);dims.push([e.width,e.height]);
  assert.equal(e.width,m.iconWidth+3+31*m.scale);assert.equal(e.height,m.iconHeight);const ctx=new PixelContext();ctx.clip=e;render(ctx,e,data);assert.ok(ctx.pack().some(Boolean));
 }
 assert.deepEqual(dims,[[41,7],[77,11],[114,16]]);
});
test('Every registered element can use content padding and a pixel frame',()=>{
 const e={id:'t',type:'text',x:0,y:0,width:40,height:10,props:{text:'ABC',scale:1,frameEnabled:true}};fitElement(e);assert.equal(e.width,15);assert.equal(e.height,9);assert.deepEqual(contentElement(e),{...e,x:2,y:2,width:11,height:5});
 const actual=renderFrame({schemaVersion:1,elements:[e]}),expected=new PixelContext();expected.text('ABC',2,2);expected.strokeRect(0,0,15,9);assert.deepEqual(actual,expected.pack());
});
test('Fit can expand clipped Chinese text; automatic headless output matches manual fit',()=>{
 const e={id:'t',type:'unicode-text',x:240,y:24,width:10,height:8,props:{text:'中文内容',fontId:'fusion10',frameEnabled:true}},scene={schemaVersion:1,elements:[e]};prepareText(scene);assert.equal(e.props.textMetrics.clipped,true);fitElement(e);prepareText(scene);assert.equal(e.width,44);assert.equal(e.height,14);assert.equal(e.x,212);assert.equal(e.y,18);assert.equal(e.props.textMetrics.clipped,false);
 const tiny={...e,width:10,height:8,props:{...e.props,autoFit:true}};assert.deepEqual(renderFrame({schemaVersion:1,elements:[tiny]}),renderFrame(scene));
});
test('Fit reserves borders and reports oversized content instead of silently claiming success',()=>{
 const e={id:'t',type:'text',x:200,y:25,width:10,height:7,props:{text:'X'.repeat(100),scale:3,frameEnabled:true}};const size=fitElement(e);assert.equal(size.clipped,true);assert.equal(e.width,256);assert.equal(e.x,0);assert.ok(e.y+e.height<=32);
 const clock={id:'c',type:'clock',x:0,y:0,width:48,height:12,props:{scale:2}};assert.deepEqual(measureElement(clock),{width:38,height:10});
});
test('Fitting legacy bitmap materials never redraws their saved pixels',()=>{
 const pixels=Array(256).fill(1),e={id:'old',type:'unicode-text',x:0,y:0,width:30,height:20,props:{text:'原稿',sourceWidth:16,sourceHeight:16,pixels}};prepareText({elements:[e]});fitElement(e);prepareText({elements:[e]});assert.equal(e.props.pixels,pixels);assert.equal(e.width,16);assert.equal(e.height,16);
});
test('Extremely small imported frames cannot draw content outside the material',()=>{
 const e={id:'tiny',type:'text',x:10,y:10,width:1,height:1,props:{text:'ABC',frameEnabled:true}},frame=renderFrame({schemaVersion:1,elements:[e]});let count=0;for(const byte of frame)for(let b=0;b<8;b++)count+=(byte>>b)&1;assert.equal(count,1);
});
test('Unknown follower counts reserve eight digits and large Chinese title plus border fits 32 rows',()=>{
 const e={id:'b',type:'bilibili-fans',x:0,y:0,width:88,height:24,props:{uid:'1',sizePreset:'large',label:'哔哩哔哩 fans',showLabel:true,frameEnabled:true}};
 assert.equal(fitElement(e,{}).clipped,false);assert.equal(e.width,118);assert.equal(e.height,32);assert.equal(measure(contentElement(e),data).titleFont,'fusion12');assert.ok(renderFrame({schemaVersion:1,elements:[e]},data).some(Boolean));
});
