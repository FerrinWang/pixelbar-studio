import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareText} from '../web/text-raster.js';
import {renderFrame,normalizeScene} from '../web/core/render.js';
import {readFile} from 'node:fs/promises';
import {bitmapFonts,registerBitmapFont,rasterizeText} from '../web/core/bitmap-fonts.js';
for(const f of bitmapFonts)registerBitmapFont(JSON.parse(await readFile(new URL('../web/fonts/'+f.id+'.json',import.meta.url),'utf8')));
test('All bundled fonts render Chinese and mixed case Latin at native height',()=>{
 for(const f of bitmapFonts){const r=rasterizeText('中文用量 Abc 123',f.id,256,32);assert.ok(r.pixels.some(Boolean));assert.deepEqual(r.missing,[]);assert.equal(r.clipped,false);assert.equal(r.height,f.height);}
});
test('Multiline integer scaling and clipping are explicit',()=>{
 const r=rasterizeText('中文\nEnglish','fusion12',96,25);assert.equal(r.height,25);assert.equal(r.clipped,false);
 const scaled=rasterizeText('中','fusion12',24,24,2,0);assert.equal(scaled.height,24);assert.equal(scaled.width,24);assert.equal(scaled.clipped,false);
 for(let y=0;y<24;y+=2)for(let x=0;x<24;x+=2){assert.equal(scaled.pixels[y*24+x],scaled.pixels[y*24+x+1]);assert.equal(scaled.pixels[y*24+x],scaled.pixels[(y+1)*24+x]);}
 assert.equal(rasterizeText('中文','fusion12',12,12).clipped,true);
 assert.deepEqual(rasterizeText('🦄','fusion12',24,12).missing,['🦄']);
});
test('Exact saved bitmap renders identically headlessly for both text types',()=>{
 for(const type of ['text','unicode-text']){
  const scene={schemaVersion:1,elements:[{id:'cn',type,x:1,y:2,width:80,height:16,props:{text:'中文 Abc',fontId:'fusion12'}}]};
  prepareText(scene);const original=scene.elements[0].props.pixels;prepareText(scene);assert.equal(scene.elements[0].props.pixels,original);
  const frame=renderFrame(scene);assert.ok(frame.some(Boolean));assert.deepEqual(renderFrame(normalizeScene(JSON.parse(JSON.stringify(scene)))),frame);
  scene.elements[0].props.text='用量';prepareText(scene);assert.notDeepEqual(scene.elements[0].props.pixels,original);
 }
});
test('Unchanged legacy material is preserved; explicit font selection migrates',()=>{
 const scene={elements:[{id:'old',type:'unicode-text',x:0,y:0,width:16,height:16,props:{text:'中文',pixels:Array(256).fill(1)}}]};
 const p=scene.elements[0].props.pixels;prepareText(scene);assert.equal(scene.elements[0].props.pixels,p);
 scene.elements[0].props.text='用量';prepareText(scene);assert.equal(scene.elements[0].props.fontId,'fusion12');
 scene.elements[0].props.fontId='fusion10';prepareText(scene);assert.notDeepEqual(scene.elements[0].props.pixels,p);
});
