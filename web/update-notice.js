export async function setupUpdateNotice({api,message}){
  const panel=document.createElement('details');panel.className='update-notice-panel';
  const summary=document.createElement('summary');summary.textContent='更新前提示文字';
  const form=document.createElement('form');form.className='update-notice-form';
  const label=document.createElement('label');label.htmlFor='update-notice-text';label.textContent='静音提示内容';
  const input=document.createElement('input');input.id='update-notice-text';input.type='text';input.value='屏幕更新中';input.autocomplete='off';
  const metrics=document.createElement('small');metrics.id='update-notice-metrics';input.setAttribute('aria-describedby',metrics.id);
  const save=document.createElement('button');save.type='submit';save.textContent='保存提示';
  const reset=document.createElement('button');reset.type='button';reset.textContent='填入默认文字';
  const hint=document.createElement('p');hint.className='muted';hint.textContent='保存后用于手动和自动更新；不会改动画布。不限字符数，不自动截断；设备协议最多255字节，实际容量以设备返回为准。长文本或方块可能滚动、切换乱码，请手动测试。';
  let saved=input.value,dirty=false;
  const update=()=>{dirty=input.value!==saved;metrics.textContent=`${[...input.value].length} 个字符 · ${new TextEncoder().encode(input.value).length} UTF-8 字节${dirty?' · 未保存':''}`;};
  input.oninput=update;reset.onclick=()=>{input.value='屏幕更新中';update();input.focus();};
  form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{const result=await api('/api/update-notice',{text:input.value},'PUT');saved=result.text;input.value=saved;update();message('更新前提示已保存，下次手动或自动推送生效');}catch(e){message(e.message,true);}finally{save.disabled=false;}};
  form.append(label,input,save,reset,metrics);panel.append(summary,form,hint);
  document.querySelector('.device-panel').append(panel);
  update();
  try{const result=await api('/api/update-notice');if(!dirty){saved=result.text;input.value=saved;update();}}catch(e){message('更新提示读取失败：'+e.message,true);}
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
}
