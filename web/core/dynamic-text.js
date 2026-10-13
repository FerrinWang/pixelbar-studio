import {bitmapFonts,rasterizeText,wrapBitmapText} from './bitmap-fonts.js';
const cache=new Map();
export function drawDynamicText(ctx,text,x,y,width,height,fontId='fusion10'){
 if(height<1||width<1)return;
 const font=bitmapFonts.find(f=>f.id===fontId)||bitmapFonts[1];
 const wrapped=wrapBitmapText(String(text).slice(0,256),font.id,width,Math.max(1,Math.floor((height+1)/(font.height+1))));
 const key=JSON.stringify([wrapped,font.id,width,height]);let pixels=cache.get(key);
 if(!pixels){pixels=rasterizeText(wrapped,font.id,width,height).pixels;cache.set(key,pixels);if(cache.size>64)cache.delete(cache.keys().next().value);}
 for(let j=0;j<height;j++)for(let i=0;i<width;i++)if(pixels[j*width+i])ctx.pixel(x+i,y+j);
}
