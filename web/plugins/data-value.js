export const manifest = {
 id:'data-value',name:'真实数据字段',description:'外部应用 / 本地 Provider 的真实数值',width:88,height:16,
 schema:[
  {name:'providerId',label:'Provider ID',type:'text',default:''},
  {name:'label',label:'显示标题',type:'text',default:'DATA'},
  {name:'field',label:'字段名',type:'text',default:'value'},
  {name:'unit',label:'单位',type:'text',default:''}
 ]
};
export function render(ctx,element,data){
 const {x,y,props:p={}}=element;
 const provider=data.providers?.[p.providerId];
 const value=provider?.value;
 const field=p.field||'value';
 const result=value&&typeof value==='object'&&Object.hasOwn(value,field)?value[field]:undefined;
 const printable=typeof result==='string'||typeof result==='number'||typeof result==='boolean';
 ctx.text(p.label||'DATA',x,y);
 ctx.text(printable?`${result}${p.unit||''}`:'--',x,y+8);
 if(provider?.status==='stale')ctx.text('STALE',x+Math.max(0,element.width-20),y);
}
export function measure(e,data){const p=e.props,provider=data.providers?.[p.providerId],value=provider?.value,result=value&&typeof value==='object'&&Object.hasOwn(value,p.field||'value')?value[p.field||'value']:undefined;const text=['string','number','boolean'].includes(typeof result)?`${result}${p.unit||''}`:'--';return {width:Math.max(String(p.label||'DATA').length,text.length)*4-1,height:13};}
export default {manifest,render,measure};
