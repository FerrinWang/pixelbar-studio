import {rasterizeText} from './core/bitmap-fonts.js';
import {contentElement} from './core/render.js';
// Persist exact bitmap pixels, not anti-aliased system-font screenshots.
export function prepareText(scene) {
 for (const e of scene.elements) {
  if (e.type !== 'unicode-text' && e.type !== 'text') continue;
  const p=e.props, text=String(p.text??(e.type==='text'?'PIXELBAR':'中文文字')).slice(0,256);
  if(e.type==='text'&&(!p.fontId||p.fontId==='tiny'))continue;
  const size=Math.max(8,Math.min(32,Math.round(Number(p.fontSize)||12)));
  const threshold=Math.max(1,Math.min(255,Number(p.threshold)||96));
  const legacyKey=JSON.stringify([text,size,threshold,e.width,e.height]);
  if(e.type==='unicode-text'&&(!p.fontId||p.fontId==='legacy')&&Array.isArray(p.pixels)&&(!p.rasterKey||p.rasterKey===legacyKey)){p.rasterKey=legacyKey;continue;}
  const id=p.fontId&&p.fontId!=='legacy'?p.fontId:'fusion12',scale=p.pixelScale||1,gap=p.lineGap??1;
  const inner=contentElement(e),key=JSON.stringify(['bitmap-v1',text,id,scale,gap,inner.width,inner.height]);
  if(p.rasterKey===key && Array.isArray(p.pixels)) continue;
  const result=rasterizeText(text,id,inner.width,inner.height,scale,gap);
  p.fontId=id;
  p.pixels=result.pixels;p.sourceWidth=inner.width;p.sourceHeight=inner.height;p.rasterKey=key;
  p.textMetrics={width:result.width,height:result.height,clipped:result.clipped,missing:result.missing};
 }
 return scene;
}
