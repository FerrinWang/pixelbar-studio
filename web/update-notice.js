export async function setupUpdateNotice({api,message}){
  const panel=document.createElement('details');panel.className='update-notice-panel';
  const summary=document.createElement('summary');summary.textContent='更新前提示文字';
  const form=document.createElement('form');form.className='update-notice-form';
  const label=document.createElement('label');label.htmlFor='update-notice-text';label.textContent='静音提示内容';
  const input=document.createElement('input');input.id='update-notice-text';input.type='text';input.value='屏幕更新中';input.autocomplete='off';
  const metrics=document.createElement('small');metrics.id='update-notice-metrics';input.setAttribute('aria-describedby',metrics.id);
  const save=document.createElement('button');save.type='submit';save.textContent='保存提示';
  const reset=document.createElement('button');reset.type='button';reset.textContent='填入默认文字';
  const hint=document.createElement('p');hint.className='muted';hint.textContent='保存后用于手动和自动更新，不改画布。中文最多15字、大写英文最多32字；混排按比例估算，小写/数字按英文预算。非ASCII符号按中文预算。上限来自本机实测，不保证所有混排都不滚动。不截断；仍检查协议字节容量。';
  let saved=input.value,dirty=false;
  const update=()=>{dirty=input.value!==saved;const m=noticeMetrics(input.value),error=noticeError(input.value);input.setCustomValidity(error);metrics.textContent=`中文/宽字符 ${m.wide} · 英文/ASCII ${m.ascii} · 长度预算 ${Math.ceil(m.units/480*100)}% · ${m.bytes} 字节${error?' · '+error:''}${dirty?' · 未保存':''}`;metrics.classList.toggle('error',!!error);};
  input.oninput=update;reset.onclick=()=>{input.value='屏幕更新中';update();input.focus();};
  form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{const result=await api('/api/update-notice',{text:input.value},'PUT');saved=result.text;input.value=saved;update();message('更新前提示已保存，下次手动或自动推送生效');}catch(e){message(e.message,true);}finally{save.disabled=false;}};
  form.append(label,input,save,reset,metrics);panel.append(summary,form,hint);
  document.querySelector('.device-panel').append(panel);
  update();
  try{const result=await api('/api/update-notice');if(!dirty){saved=result.text;input.value=saved;update();if(result.warning)message('旧提示需缩短后再保存：'+result.warning,true);}}catch(e){message('更新提示读取失败：'+e.message,true);}
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
}
import {noticeError,noticeMetrics} from './core/notice-policy.js';
