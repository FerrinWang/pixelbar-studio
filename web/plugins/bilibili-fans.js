import {drawDynamicText} from '../core/dynamic-text.js';
import {rasterizeText} from '../core/bitmap-fonts.js';
import {getIconRows,iconSizes} from '../core/bilibili-icons.js';
export const manifest={id:'bilibili-fans',name:'B站粉丝数',description:'小电视图标 · 完整粉丝数字',width:88,height:24,schema:[
 {name:'uid',label:'B站 UID',type:'text',default:''},
 {name:'showLabel',label:'显示标题文字',type:'boolean',default:false},
 {name:'label',label:'标题文字（可修改）',type:'text',default:'哔哩哔哩 fans'},
 {name:'sizePreset',label:'图标与数字尺寸',type:'segmented',default:'medium',options:[{value:'small',label:'小号'},{value:'medium',label:'中号'},{value:'large',label:'大号'}]}
]};
export function followerText(value){return Number.isSafeInteger(value)&&value>=0?String(value):'--';}
export function drawTV(ctx,x,y,size='medium',overrides={}){
 const rows=getIconRows(size,overrides);
 rows.forEach((row,dy)=>[...row].forEach((on,dx)=>{if(on==='1')ctx.pixel(x+dx,y+dy);}));
}
export function measure(e,data){
 const size=Object.hasOwn(iconSizes,e.props.sizePreset)?e.props.sizePreset:'medium',icon=getIconRows(size,e.props.iconOverrides),scale=e.props.sizePreset?{small:1,medium:2,large:3}[size]:Math.max(1,Math.min(3,Number(e.props.scale)||2));
 const entry=data.providers?.bilibili?.value?.accounts?.[String(e.props.uid||'').trim()],text=followerText(entry?.follower),label=String(e.props.label??'哔哩哔哩 fans').slice(0,64),titleFont=size==='large'?'fusion12':'fusion10',titleHeight=size==='large'?12:10,offset=e.props.showLabel&&label?(size==='large'?12:11):0;
 const digits=text==='--'?8:text.length;
 return {width:Math.max(icon[0].length+3+(digits*4-1)*scale,offset?rasterizeText(label,titleFont,256,titleHeight).width:0),height:Math.max(icon.length,5*scale)+offset,scale,iconWidth:icon[0].length,iconHeight:icon.length,size,text,label,offset,titleFont,titleHeight};
}
export function render(ctx,e,data){
 const uid=String(e.props.uid||'').trim(),entry=data.providers?.bilibili?.value?.accounts?.[uid];
 const {label,text,offset,scale:targetScale,iconWidth,iconHeight,size,titleFont,titleHeight}=measure(e,data);
 if(offset)drawDynamicText(ctx,label,e.x,e.y,e.width,titleHeight,titleFont);
 const availableHeight=Math.max(1,e.height-offset),scale=Math.max(1,Math.min(targetScale,Math.floor((e.width-iconWidth-3)/(text.length*4-1)),Math.floor(availableHeight/5)));
 const rowY=e.y+offset;
 drawTV(ctx,e.x,rowY+Math.max(0,Math.floor((availableHeight-iconHeight)/2)),size,e.props.iconOverrides);
 ctx.text(text,e.x+iconWidth+3,rowY+Math.max(0,Math.floor((availableHeight-5*scale)/2)),scale);
 if(entry?.status==='stale'||entry?.status==='error'||data.providers?.bilibili?.status==='stale')ctx.pixel(e.x+e.width-1,e.y);
}
export default {manifest,render,measure};
