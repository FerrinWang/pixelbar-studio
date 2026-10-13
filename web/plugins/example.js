export const manifest = {id:'example',name:'像素徽章',description:'共享插件 SDK 示例',width:24,height:16,schema:[{name:'label',label:'文字',type:'text',default:'PB'}]};
export function render(ctx,element,data) { const {x,y,width,height,props}=element;ctx.strokeRect(x,y,width,height);ctx.text(props.label||'PB',x+3,y+5);ctx.pixel(x+width-3,y+2,Math.floor(Number(data.now)/1000)%2); }
export function measure(e){return {width:Math.max(9,String(e.props.label||'PB').length*4+5),height:12};}
export default {manifest,render,measure};
