// DOM-free pixel renderer shared by the browser and Node >=20.
import {rasterizeText} from './bitmap-fonts.js';
import {quotaLayout} from './quota-reset.js';
export const WIDTH = 256, HEIGHT = 32;
const fonts = {
 '0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001111',
 'A':'010101111101101','B':'110101110101110','C':'111100100100111','D':'110101101101110','E':'111100110100111','F':'111100110100100','G':'111100101101111','H':'101101111101101','I':'111010010010111','J':'001001001101111','K':'101101110101101','L':'100100100100111','M':'101111111101101','N':'101111111111101','O':'111101101101111','P':'111101111100100','Q':'111101101111001','R':'110101110101101','S':'111100111001111','T':'111010010010010','U':'101101101101111','V':'101101101101010','W':'101101111111101','X':'101101010101101','Y':'101101010010010','Z':'111001010100111','%':'101001010100101',':':'000010000010000','.':'000000000000010','-':'000000111000000','/':'001001010100100','?':'111001010000010','_':'000000000000111',' ':'000000000000000','+':'000010111010000'
};
export const number = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
export const clamp = (v, low, high) => Math.min(high, Math.max(low, number(v, low)));
export class PixelContext {
 constructor(width = WIDTH, height = HEIGHT) { this.width = width; this.height = height; this.pixels = new Uint8Array(width * height); this.fillStyle = 1; }
 pixel(x,y,on = this.fillStyle) { x=Math.floor(x); y=Math.floor(y); const c=this.clip;if(c&&(x<c.x||y<c.y||x>=c.x+c.width||y>=c.y+c.height))return;if(x>=0&&y>=0&&x<this.width&&y<this.height) this.pixels[y*this.width+x]=on && on !== '#000' && on !== 'black' ? 1 : 0; }
 fillRect(x,y,w,h,on = this.fillStyle) { const x0=Math.max(0,Math.floor(x)), y0=Math.max(0,Math.floor(y)); const x1=Math.min(this.width,Math.ceil(x+w)), y1=Math.min(this.height,Math.ceil(y+h)); for(let j=y0;j<y1;j++) for(let i=x0;i<x1;i++) this.pixel(i,j,on); }
 clearRect(x,y,w,h) { this.fillRect(x,y,w,h,0); }
 strokeRect(x,y,w,h,on = this.fillStyle) { this.fillRect(x,y,w,1,on); this.fillRect(x,y+h-1,w,1,on); this.fillRect(x,y,1,h,on); this.fillRect(x+w-1,y,1,h,on); }
 text(value,x,y,scale=1,on = this.fillStyle) { scale=Math.floor(clamp(scale,1,8));const startX=x; for(const char of String(value).slice(0,256).toUpperCase()) {if(char==='\r')continue;if(char==='\n'){x=startX;y+=6*scale;continue;} const bits=fonts[char]||fonts['?']; for(let j=0;j<5;j++)for(let i=0;i<3;i++)if(bits[j*3+i]==='1')this.fillRect(x+i*scale,y+j*scale,scale,scale,on); x+=4*scale; } }
 fillText(value,x,y) { this.text(value,x,y); }
 line(x0,y0,x1,y1,on=1) { x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy; for(let n=0;n<1024;n++){this.pixel(x0,y0,on);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx}if(e<=dx){err+=dx;y0+=sy}} }
 pack() { const out=new Uint8Array(1024); for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(this.pixels[y*this.width+x])out[(y>>3)*WIDTH+x]|=1<<(y&7); return out; }
}
const prop = (name,label,type='number',value=0) => ({name,label,type,default:value});
export const builtins = [
 {id:'unicode-text',name:'中文 / 通用文字',description:'中英文原生点阵 · 支持换行与字体切换',width:96,height:16,schema:[prop('text','文字','textarea','中文文字'),{...prop('fontId','像素字体','select','fusion12'),options:[{value:'fusion12',label:'Fusion Pixel · 12 px'},{value:'fusion10',label:'Fusion Pixel · 10 px'},{value:'ark12',label:'Ark Pixel · 12 px'}]},prop('pixelScale','整数放大倍数','number',1),prop('lineGap','行间距（像素）','number',1)]},
 {id:'text',name:'英文 / 数字文字',description:'紧凑 3 × 5 或开源中英文点阵字体',width:64,height:7,schema:[prop('text','文字','textarea','PIXELBAR'),{...prop('fontId','像素字体','select','tiny'),options:[{value:'tiny',label:'紧凑英文 · 3 × 5'},{value:'fusion12',label:'Fusion Pixel · 12 px'},{value:'fusion10',label:'Fusion Pixel · 10 px'},{value:'ark12',label:'Ark Pixel · 12 px'}]},prop('scale','紧凑字体倍数','number',1),prop('pixelScale','整数放大倍数','number',1),prop('lineGap','行间距（像素）','number',1)]},
 {id:'rectangle',name:'矩形',description:'线框或实心图形',width:40,height:16,schema:[prop('filled','实心','boolean',false)]},
 {id:'clock',name:'时钟',description:'时、分 · 可选冒号闪烁（亮灭各 0.5 秒）',width:40,height:10,schema:[prop('blinkColon','冒号闪烁（亮灭各 0.5 秒）','boolean',false),prop('scale','字号倍数','number',1)]},
 {id:'codex-quota',name:'Codex 配额',description:'真实用量 · 5H / WK 重置倒计时、日期、时间',width:112,height:26,schema:[prop('label','标题','text','CODEX'),prop('showLabel','显示标题','boolean',true),{...prop('displayMode','用量显示','segmented','used'),options:[{value:'used',label:'已用用量'},{value:'remaining',label:'剩余用量'}]},...['primary','secondary'].flatMap((key,i)=>[['Countdown','重置倒计时'],['Date','重置日期'],['Time','重置时间']].map(([kind,label])=>prop(key+kind,(i?'WK':'5H')+' '+label,'boolean',false)))]},
 {id:'progress',name:'进度条',description:'可配置的像素进度',width:64,height:8,schema:[prop('value','进度 %','number',65),prop('label','标签','text','PROGRESS')]},
 {id:'image',name:'阈值图像',description:'导入图片并转为单色像素',width:32,height:32,schema:[prop('threshold','阈值','number',128)]},
 {id:'sparkline',name:'趋势线',description:'逗号分隔的数值序列',width:64,height:16,schema:[prop('values','数据','text','10,18,12,32,25,40,36,52')]}
];
const registry=new Map();
export function registerPlugin(manifest, render, measure) { if(!manifest||typeof manifest.id!=='string'||typeof render!=='function')throw new Error('Invalid plugin'); registry.set(manifest.id,{manifest,render,measure}); }
export function contentElement(e){const inset=e.props?.frameEnabled?2:0;return {...e,x:e.x+inset,y:e.y+inset,width:Math.max(0,e.width-inset*2),height:Math.max(0,e.height-inset*2)};}
export function measureElement(e,data={}){
 const p=e.props||{},inner=contentElement(e),plugin=registry.get(e.type);let size;
 if(plugin?.measure)size=plugin.measure(inner,data);
 else if(e.type==='text'&&(!p.fontId||p.fontId==='tiny')){const lines=String(p.text??'PIXELBAR').split('\n'),scale=Math.floor(clamp(p.scale||1,1,8));size={width:Math.max(...lines.map(l=>Math.max(1,[...l].length*4-1)))*scale,height:(lines.length*6-1)*scale};}
 else if(['text','unicode-text'].includes(e.type)){
  if(e.type==='unicode-text'&&(!p.fontId||p.fontId==='legacy')&&Array.isArray(p.pixels))size={width:p.sourceWidth||inner.width,height:p.sourceHeight||inner.height};
  else size=rasterizeText(p.text??'中文文字',p.fontId||'fusion12',256,32,p.pixelScale||1,p.lineGap??1);
 }else if(e.type==='clock'){const scale=Math.floor(clamp(p.scale||1,1,8));size={width:19*scale,height:5*scale};}
 else if(e.type==='image')size={width:p.sourceWidth||inner.width,height:p.sourceHeight||inner.height};
 else if(e.type==='codex-quota'){const layout=quotaLayout(p,data.quota,data.now);size={width:Math.max(inner.width,layout.width),height:layout.height};}
 else if(['rectangle','sparkline','progress'].includes(e.type))size={width:inner.width,height:e.type==='progress'?Math.max(5,inner.height):inner.height};
 else if(plugin){const ctx=new PixelContext();const probe={...inner,x:0,y:0,height:32};ctx.clip={x:0,y:0,width:probe.width,height:32};plugin.render(ctx,probe,{...data,now:data.now??Date.now()});let right=0,bottom=0;for(let y=0;y<32;y++)for(let x=0;x<probe.width;x++)if(ctx.pixels[y*256+x]){right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}size={width:right||inner.width,height:bottom||inner.height};}
 else size={width:inner.width,height:inner.height};
 const padding=p.frameEnabled?4:0;return {width:Math.max(1,Math.ceil(size.width)+padding),height:Math.max(1,Math.ceil(size.height)+padding)};
}
export function fitElement(e,data={}){const size=measureElement(e,data);e.width=Math.min(WIDTH,size.width);e.height=Math.min(HEIGHT,size.height);e.x=Math.min(e.x,WIDTH-e.width);e.y=Math.min(e.y,HEIGHT-e.height);const p=e.props;if(e.type==='unicode-text'&&(!p.fontId||p.fontId==='legacy')&&Array.isArray(p.pixels))p.rasterKey=JSON.stringify([String(p.text??'中文文字').slice(0,256),Math.max(8,Math.min(32,Math.round(Number(p.fontSize)||12))),Math.max(1,Math.min(255,Number(p.threshold)||96)),e.width,e.height]);return {clipped:size.width>WIDTH||size.height>HEIGHT,...size};}
function bar(ctx,x,y,w,h,value){ctx.strokeRect(x,y,w,h);ctx.fillRect(x+2,y+2,Math.floor(Math.max(0,w-4)*clamp(value,0,100)/100),Math.max(0,h-4));}
for(const manifest of builtins)registerPlugin(manifest,(ctx,e,data)=>{ const p=e.props||{}, {x,y,width:w,height:h}=e;
 switch(e.type){
 case 'text':if(!p.fontId||p.fontId==='tiny'){ctx.text(p.text??'PIXELBAR',x,y,p.scale||1);break;}
 case 'unicode-text':{const fresh=p.autoFit&&p.fontId&&p.fontId!=='legacy'?rasterizeText(p.text??'中文文字',p.fontId,w,h,p.pixelScale||1,p.lineGap??1):null;const pixels=fresh?.pixels||(Array.isArray(p.pixels)?p.pixels:[]),iw=fresh?w:Math.floor(clamp(p.sourceWidth||w,1,256)),ih=fresh?h:Math.floor(clamp(p.sourceHeight||h,1,32));for(let j=0;j<Math.min(h,ih);j++)for(let i=0;i<Math.min(w,iw);i++)if(pixels[j*iw+i])ctx.pixel(x+i,y+j);break;}
 case 'rectangle':p.filled?ctx.fillRect(x,y,w,h):ctx.strokeRect(x,y,w,h);break;
 case 'clock':{const d=new Date(data.now),blink=p.blinkColon??p.seconds??false;const visible=!blink||(data.clockColonVisible??(Math.floor(data.now/500)%2===0));const time=[d.getHours(),d.getMinutes()].map(v=>String(v).padStart(2,'0')).join(visible?':':' ');ctx.text(time,x,y,p.scale||1);break;}
 case 'progress':if(p.label)ctx.text(p.label,x,y);bar(ctx,x,y+(p.label?7:0),w,Math.max(5,h-(p.label?7:0)),p.value);break;
 case 'codex-quota':{if(p.showLabel!==false)ctx.text(p.label||'CODEX',x,y);for(const {key,label,y:offset,reset} of quotaLayout(p,data.quota,data.now).rows){const yy=y+offset,used=data.quota?.[key]?.usedPercent;const v=used==null?null:p.displayMode==='remaining'?100-clamp(used,0,100):clamp(used,0,100);ctx.text(`${label} ${v==null?'--':Math.round(v)+'%'}`,x,yy);bar(ctx,x+32,yy,w-32,6,v??0);if(reset)ctx.text(reset,x,yy+7);}break;}
 case 'image':{const pixels=Array.isArray(p.pixels)?p.pixels:[];const iw=Math.floor(clamp(p.sourceWidth||w,1,256)),ih=Math.floor(clamp(p.sourceHeight||h,1,32));for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(pixels[Math.floor(j*ih/h)*iw+Math.floor(i*iw/w)])ctx.pixel(x+i,y+j);break;}
 case 'sparkline':{const values=String(p.values||'').slice(0,4096).split(',').slice(0,256).map(v=>number(v));if(values.length<2)break;const min=Math.min(...values),range=Math.max(1,Math.max(...values)-min);for(let i=1;i<values.length;i++)ctx.line(x+(i-1)*(w-1)/(values.length-1),y+h-1-(values[i-1]-min)/range*(h-1),x+i*(w-1)/(values.length-1),y+h-1-(values[i]-min)/range*(h-1));break;}
 }
});
function safeProps(value,depth=0){if(depth>5)return null;if(typeof value==='string')return value.slice(0,4096);if(typeof value==='number')return Number.isFinite(value)?value:0;if(typeof value==='boolean'||value===null)return value;if(Array.isArray(value))return value.slice(0,8192).map(v=>safeProps(v,depth+1));if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).slice(0,64)){if(['__proto__','constructor','prototype'].includes(key))continue;out[key.slice(0,100)]=safeProps(value[key],depth+1);}return out;}return null;}
export function normalizeScene(scene) { if(!scene||scene.schemaVersion!==1||!Array.isArray(scene.elements))throw new Error('场景格式无效，需要 schemaVersion: 1');return {schemaVersion:1,width:WIDTH,height:HEIGHT,elements:scene.elements.slice(0,128).map((value,i)=>{const e=value&&typeof value==='object'?value:{};const width=Math.floor(clamp(e.width,1,WIDTH)),height=Math.floor(clamp(e.height,1,HEIGHT));return {id:String(e.id||`element-${i}`).slice(0,100),type:String(e.type||'rectangle').slice(0,100),x:Math.floor(clamp(e.x,0,WIDTH-width)),y:Math.floor(clamp(e.y,0,HEIGHT-height)),width,height,props:e.props&&typeof e.props==='object'&&!Array.isArray(e.props)?safeProps(e.props):{} };})}; }
export function renderFrame(scene,data={}) { const {quota=null,now=Date.now()}=data;const ctx=new PixelContext();for(const e of normalizeScene(scene).elements){const plugin=registry.get(e.type);if(plugin){if(e.props.autoFit)fitElement(e,{...data,quota,now});const inner=contentElement(e);ctx.clip={x:inner.x,y:inner.y,width:inner.width,height:inner.height};ctx.fillStyle=1;try{plugin.render(ctx,inner,{...data,quota,now});if(e.props.frameEnabled){ctx.clip={x:e.x,y:e.y,width:e.width,height:e.height};ctx.strokeRect(e.x,e.y,e.width,e.height);}}finally{ctx.clip=null;}}}return ctx.pack(); }
// Freeze all data, including minutes, across the two precomputed blink phases.
export function renderPlayback(scene,data={}) {
 const snapshot={...data,now:data.now??Date.now()};
 const blinking=scene.elements.some(e=>e.type==='clock'&&(e.props?.blinkColon??e.props?.seconds??false));
 return blinking?{frames:[renderFrame(scene,{...snapshot,clockColonVisible:true}),renderFrame(scene,{...snapshot,clockColonVisible:false})],delay:500}:{frames:[renderFrame(scene,snapshot)],delay:null};
}
export const defaultScene = {schemaVersion:1,width:256,height:32,elements:[{id:'heading',type:'text',x:6,y:3,width:64,height:5,props:{text:'CODEX / LIVE'}},{id:'quota',type:'codex-quota',x:6,y:12,width:174,height:18,props:{showLabel:false}},{id:'divider',type:'rectangle',x:190,y:3,width:1,height:26,props:{filled:true}},{id:'clock',type:'clock',x:204,y:5,width:48,height:10,props:{scale:2}},{id:'mark',type:'text',x:204,y:23,width:48,height:5,props:{text:'PIXELBAR'}}]};
