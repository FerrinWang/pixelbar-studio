export const bitmapFonts=[{id:'fusion12',label:'Fusion 12 · 中文 / English',height:12},{id:'fusion10',label:'Fusion 10 · 紧凑中文 / English',height:10},{id:'ark12',label:'Ark 12 · 中文 / English',height:12}];
const fonts=new Map();
export function registerBitmapFont(font){if(!font||!bitmapFonts.some(f=>f.id===font.id)||!Number.isInteger(font.height)||!font.glyphs)throw new Error('无效字体数据');fonts.set(font.id,font);}
export async function loadBitmapFonts(fetcher=fetch){await Promise.all(bitmapFonts.map(async font=>{const r=await fetcher('/fonts/'+font.id+'.json');if(!r.ok)throw new Error('字体加载失败：'+font.label);registerBitmapFont(await r.json());}));}
export function wrapBitmapText(text,id,width,maxLines=3){
 const font=fonts.get(id);if(!font)throw new Error('像素字体尚未加载');
 const advance=char=>(font.glyphs[char.codePointAt(0)]||(id==='ark12'?fonts.get('fusion12')?.glyphs[char.codePointAt(0)]:null)||font.glyphs[65534]||[font.height])[0];
 const lines=[''];let x=0;
 for(const char of String(text).slice(0,256)){if(char==='\r')continue;if(char==='\n'){lines.push('');x=0;continue;}const w=advance(char);if(x&&x+w>width){lines.push('');x=0;}lines[lines.length-1]+=char;x+=w;}
 if(lines.length>maxLines){const ellipsis=font.glyphs[8230]?'…':'...';let last=[...lines[maxLines-1]],length=last.reduce((n,c)=>n+advance(c),0),extra=[...ellipsis].reduce((n,c)=>n+advance(c),0);while(last.length&&length+extra>width)length-=advance(last.pop());lines[maxLines-1]=last.join('')+ellipsis;lines.length=maxLines;}
 return lines.join('\n');
}
export function rasterizeText(text,id,width,height,scale=1,lineGap=1){
 const font=fonts.get(id);if(!font)throw new Error('像素字体尚未加载，请稍后重试');
 scale=Math.max(1,Math.min(3,Math.floor(Number(scale)||1)));lineGap=Math.max(0,Math.min(8,Math.floor(Number(lineGap)||0)));
 const pixels=new Uint8Array(width*height);let x=0,y=0,maxWidth=0,lines=1,clipped=false;const missing=[];
 for(const char of String(text).slice(0,256)){
  if(char==='\r')continue;if(char==='\n'){maxWidth=Math.max(maxWidth,x);x=0;y+=(font.height+lineGap)*scale;lines++;continue;}
  const code=char.codePointAt(0);let glyph=font.glyphs[code];
  if(!glyph&&id==='ark12')glyph=fonts.get('fusion12')?.glyphs[code];
  if(!glyph){missing.push(char);glyph=font.glyphs[65534]||font.glyphs[63];}
  if(!glyph){x+=font.height*scale;continue;}
  const [advance,w,h,offsetX,offsetY,...rows]=glyph,top=font.ascent-offsetY-h;
  for(let gy=0;gy<h;gy++)for(let gx=0;gx<w;gx++)if((rows[gy]>>>(w-1-gx))&1){for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++){const px=x+(offsetX+gx)*scale+sx,py=y+(top+gy)*scale+sy;if(px>=0&&py>=0&&px<width&&py<height)pixels[py*width+px]=1;else clipped=true;}}
  x+=advance*scale;
 }
 maxWidth=Math.max(maxWidth,x);const requiredHeight=lines*font.height*scale+(lines-1)*lineGap*scale;
 return {pixels:Array.from(pixels),width:maxWidth,height:requiredHeight,clipped:clipped||maxWidth>width||requiredHeight>height,missing:[...new Set(missing)],fontHeight:font.height,version:font.version};
}
