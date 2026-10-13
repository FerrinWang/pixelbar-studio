import {drawDynamicText} from '../core/dynamic-text.js';
import {bitmapFonts,wrapBitmapText,rasterizeText} from '../core/bitmap-fonts.js';
export const manifest={id:'notification',name:'文字通知',description:'其他 App 本机推送 · 中文自动换行',width:128,height:32,schema:[
 {name:'channel',label:'通知频道',type:'text',default:'general'},
 {name:'showTitle',label:'显示消息标题',type:'boolean',default:true},
 {name:'idleText',label:'无消息时显示',type:'text',default:'等待消息'},
 {name:'fontId',label:'通知字体',type:'select',default:'fusion10',options:[{value:'fusion10',label:'Fusion 10'},{value:'fusion12',label:'Fusion 12'},{value:'ark12',label:'Ark 12'}]}
]};
export function render(ctx,e,data){
 const message=data.providers?.notifications?.value?.channels?.[e.props.channel||'general'];
 const active=message&&message.expiresAt>(data.now??Date.now()),font=e.props.fontId||'fusion10';
 if(!active){drawDynamicText(ctx,String(e.props.idleText??'等待消息'),e.x,e.y,e.width,e.height,font);return;}
 let offset=0;
 if(e.props.showTitle!==false&&message.title){const height=bitmapFonts.find(f=>f.id===font)?.height||10;drawDynamicText(ctx,message.title,e.x,e.y,e.width,Math.min(height,e.height),font);offset=height+1;}
 drawDynamicText(ctx,message.text,e.x,e.y+offset,e.width,e.height-offset,font);
}
export function measure(e,data){
 const p=e.props,font=p.fontId||'fusion10',fontHeight=bitmapFonts.find(f=>f.id===font)?.height||10,message=data.providers?.notifications?.value?.channels?.[p.channel||'general'],active=message&&message.expiresAt>(data.now??Date.now()),body=active?message.text:String(p.idleText??'等待消息');
 const width=Math.max(fontHeight,e.width),wrapped=wrapBitmapText(body,font,width,256),m=rasterizeText(wrapped,font,256,32),title=active&&p.showTitle!==false&&message.title;
 return {width:Math.min(width,Math.max(m.width,title?Math.min(width,rasterizeText(message.title,font,256,32).width):0)),height:m.height+(title?fontHeight+1:0)};
}
export default {manifest,render,measure};
