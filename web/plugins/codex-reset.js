import {resetText} from '../core/quota-reset.js';
export const manifest={id:'codex-reset',name:'Codex 重置倒计时',description:'独立组件 · 5H / WK 倒计时、日期、时间',width:100,height:12,schema:[
 {name:'window',label:'配额窗口',type:'select',default:'primary',options:[{value:'primary',label:'5H'},{value:'secondary',label:'WK'},{value:'both',label:'5H + WK'}]},
 {name:'showWindow',label:'显示5H / WK标签',type:'boolean',default:true},
 {name:'showCountdown',label:'显示倒计时',type:'boolean',default:true},
 {name:'showDate',label:'显示重置日期',type:'boolean',default:false},
 {name:'showTime',label:'显示重置时间',type:'boolean',default:false},
 {name:'scale',label:'字号倍数',type:'number',default:1}
]};
export function resetLines(element,data={}){
 const p=element.props||{},keys=p.window==='both'?['primary','secondary']:[p.window==='secondary'?'secondary':'primary'];
 return keys.flatMap(key=>{
  const fields={};for(const [kind,name] of [['Countdown','showCountdown'],['Date','showDate'],['Time','showTime']])fields[key+kind]=p[name]??(kind==='Countdown');
  const text=resetText(data.quota?.status==='stale'?null:data.quota?.[key],fields,key,data.now??Date.now());
  return text?[`${p.showWindow===false?'':(key==='primary'?'5H ':'WK ')}${text}`]:[];
 });
}
export function measure(element,data){const lines=resetLines(element,data),scale=Math.max(1,Math.min(4,Math.floor(Number(element.props?.scale)||1)));return {width:Math.max(1,...lines.map(line=>line.length*4-1))*scale,height:Math.max(1,lines.length*7-2)*scale};}
export function render(ctx,element,data){const scale=Math.max(1,Math.min(4,Math.floor(Number(element.props?.scale)||1)));resetLines(element,data).forEach((line,i)=>ctx.text(line,element.x,element.y+i*7*scale,scale));}
