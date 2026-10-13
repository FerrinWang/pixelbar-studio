export const hexRGB=hex=>{
 if(typeof hex!=='string'||!/^#[0-9a-f]{6}$/i.test(hex))throw new Error('颜色需要 #RRGGBB 格式');
 return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
};
export const rgbHex=rgb=>'#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('').toUpperCase();
const linear=v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;
const encoded=v=>v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055;
export function validateCalibration(value){
 if(value?.version!==1||typeof value.enabled!=='boolean'||!Array.isArray(value.samples)||value.samples.length>100)throw new Error('校准文件格式错误（v1，最多100个样本）');
 return {version:1,enabled:value.enabled,samples:value.samples.map(s=>{
  if(!['screen','lighting'].includes(s.target))throw new Error('请选择屏幕或机身灯光');
  hexRGB(s.input);hexRGB(s.observed);
  return {target:s.target,input:s.input.toUpperCase(),observed:s.observed.toUpperCase()};
 })};
}
// Forward appearance estimate only: never an inverse/device-RGB correction.
// Interpolate sampled residuals in linear RGB. Exact samples reproduce their observation.
export function estimateColor(input,target,profile){
 const original=hexRGB(input),samples=profile?.enabled?profile.samples.filter(s=>s.target===target):[];
 if(!samples.length)return rgbHex(original);
 const a=original.map(v=>linear(v/255));let total=0,delta=[0,0,0];
 for(const s of samples){const b=hexRGB(s.input).map(v=>linear(v/255)),c=hexRGB(s.observed).map(v=>linear(v/255));const distance=b.reduce((sum,v,i)=>sum+(v-a[i])**2,0);
  if(distance<1e-12)return s.observed.toUpperCase();
  const weight=1/(distance+0.0025);total+=weight;delta=delta.map((v,i)=>v+(c[i]-b[i])*weight);
 }
 return rgbHex(a.map((v,i)=>encoded(Math.max(0,Math.min(1,v+delta[i]/total)))*255));
}
export function labColor(hex){
 const [r,g,b]=hexRGB(hex).map(v=>linear(v/255));const f=v=>v>216/24389?Math.cbrt(v):(24389/27*v+16)/116;
 const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047),y=f(.2126729*r+.7151522*g+.072175*b),z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);
 return [116*y-16,500*(x-y),200*(y-z)];
}
export function deltaE76(a,b){const x=labColor(a),y=labColor(b);return Math.sqrt(x.reduce((sum,v,i)=>sum+(v-y[i])**2,0));}
