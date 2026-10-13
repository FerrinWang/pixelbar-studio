export function resetText(window,props,key,now=Date.now()){
  const choices=['Countdown','Date','Time'].filter(kind=>props[key+kind]===true);
  if(!choices.length)return '';
  const value=window?.resetsAt;
  const date=value==null?null:new Date(typeof value==='number'&&value<1e12?value*1000:value);
  const valid=date&&!Number.isNaN(date.getTime());
  const pad=v=>String(v).padStart(2,'0');
  return choices.map(kind=>{
    if(!valid)return '--';
    if(kind==='Date')return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
    if(kind==='Time')return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const minutes=Math.max(0,Math.ceil((date.getTime()-now)/60000)),days=Math.floor(minutes/1440);
    return `IN ${days?days+'D':''}${pad(Math.floor(minutes%1440/60))}:${pad(minutes%60)}`;
  }).join(' ');
}
export function quotaLayout(props={},quota=null,now=Date.now()){
  const compact=['primary','secondary'].some(key=>['Countdown','Date','Time'].some(kind=>props[key+kind]===true));
  let y=props.showLabel===false?0:compact?7:8;
  const rows=['primary','secondary'].map((key,i)=>{
    const reset=resetText(quota?.[key],props,key,now),row={key,label:i?'WK':'5H',y,reset};
    y+=compact?13:9;return row;
  });
  const height=Math.max(...rows.map(row=>row.y+(row.reset?12:6)));
  return {rows,height:compact?height:props.showLabel===false?15:23,width:Math.max(64,...rows.map(row=>row.reset.length*4-1))};
}
