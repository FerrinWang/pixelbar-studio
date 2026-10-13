import {resetText} from '../core/quota-reset.js';
export const manifest={id:'codex-reset',name:'Codex 重置倒计时',description:'独立组件 · 单排固定宽度 · 可选重置进度条',width:256,height:5,schema:[
 {name:'window',label:'配额窗口',type:'select',default:'primary',options:[{value:'primary',label:'5H'},{value:'secondary',label:'WK'},{value:'both',label:'5H + WK'}]},
 {name:'showWindow',label:'显示5H / WK标签',type:'boolean',default:true},
 {name:'showCountdown',label:'显示倒计时',type:'boolean',default:true},
 {name:'showDate',label:'显示重置日期',type:'boolean',default:false},
 {name:'showTime',label:'显示重置时间',type:'boolean',default:false},
 {name:'showBar',label:'显示重置剩余时间进度条',type:'boolean',default:true},
 {name:'totalWidth',label:'固定总宽度（像素）',type:'number',default:256,min:16,max:256},
 {name:'scale',label:'字号倍数',type:'number',default:1,min:1,max:4}
]};
export function resetLines(element,data={}){
 const p=element.props||{},keys=p.window==='both'?['primary','secondary']:[p.window==='secondary'?'secondary':'primary'];
 return keys.flatMap(key=>{
  const fields={};for(const [kind,name] of [['Countdown','showCountdown'],['Date','showDate'],['Time','showTime']])fields[key+kind]=p[name]??(kind==='Countdown');
  const text=resetText(data.quota?.status==='stale'?null:data.quota?.[key],fields,key,data.now??Date.now());
  return text?[`${p.showWindow===false?'':(key==='primary'?'5H ':'WK ')}${text}`]:[];
 });
}
export function resetLayout(element,data={}){
 const p=element.props||{},scale=Math.max(1,Math.min(4,Math.floor(Number(p.scale)||1))),fixed=Object.hasOwn(p,'totalWidth')||Object.hasOwn(p,'showBar'),lines=resetLines(element,data);
 if(!fixed)return {legacy:true,scale,lines,width:Math.max(1,...lines.map(line=>line.length*4-1))*scale,height:Math.max(1,lines.length*7-2)*scale};
 const width=Math.max(16,Math.min(256,Math.floor(Number(p.totalWidth)||256)))-(p.frameEnabled?4:0),keys=p.window==='both'?['primary','secondary']:[p.window==='secondary'?'secondary':'primary'],bar=p.showBar===true;
 const items=keys.map((key,i)=>{const text=lines[i]??(bar&&p.showWindow!==false?(key==='primary'?'5H':'WK'):''),window=data.quota?.status==='stale'?null:data.quota?.[key];const value=window?.resetsAt,date=value==null?null:new Date(typeof value==='number'&&value<1e12?value*1000:value),duration=Number(window?.windowDurationMins);const remaining=date&&Number.isFinite(date.getTime())&&duration>0&&Number.isFinite(duration)?Math.max(0,Math.min(1,(date.getTime()-(data.now??Date.now()))/(duration*60000))):null;return {key,text,textWidth:text?Math.max(0,text.length*4-1)*scale:0,remaining};});
 const between=6*scale,gap=3*scale,used=items.reduce((n,item)=>n+item.textWidth+(bar&&item.textWidth?gap:0),0)+between*(items.length-1),free=width-used;
 let x=0;for(const [i,item] of items.entries()){item.x=x;item.barWidth=bar?Math.max(0,Math.floor(free/items.length)+(i===items.length-1?Math.max(0,free)%items.length:0)):0;item.barX=x+item.textWidth+(bar&&item.textWidth?gap:0);x=item.barX+item.barWidth+between;}
 const warning=used>width?'所选文字超过固定总宽，请隐藏字段、窗口标签或减少字号。':bar&&items.some(item=>item.barWidth<5)?'文字占用过多，进度条过短；可隐藏部分文字字段。':null;
 return {legacy:false,scale,items,width,height:5*scale,warning};
}
export function measure(element,data){const layout=resetLayout(element,data);return {width:layout.width,height:layout.height,...(layout.warning?{warning:layout.warning}:{})};}
export function render(ctx,element,data){const layout=resetLayout(element,data);if(layout.legacy){layout.lines.forEach((line,i)=>ctx.text(line,element.x,element.y+i*7*layout.scale,layout.scale));return;}
 for(const item of layout.items){ctx.text(item.text,element.x+item.x,element.y,layout.scale);if(item.barWidth>0){const x=element.x+item.barX,h=layout.height;ctx.strokeRect(x,element.y,item.barWidth,h);if(item.remaining!==null)ctx.fillRect(x+1,element.y+1,Math.round(Math.max(0,item.barWidth-2)*item.remaining),Math.max(0,h-2));else if(item.barWidth>=3)ctx.text('?',x+Math.floor((item.barWidth-3)/2),element.y);}}
}
