import {noticeError,noticeMetrics} from './core/notice-policy.js';
export async function setupReminders({api,message}){
 const panel=document.createElement('section');panel.className='reminder-panel';
 const title=document.createElement('h2');title.textContent='Codex 条件提醒';
 const hint=document.createElement('p');hint.className='muted';hint.textContent='默认关闭。启用后即使网页关闭也由伴侣后台检测，每15秒检查一次；静音新闻提醒后显示已保存画布。自动推送开关不影响已启用提醒。';
 const list=document.createElement('div');list.className='reminder-rules';const actions=document.createElement('div');actions.className='actions';
 const add=document.createElement('button');add.type='button';add.textContent='增加提醒规则';const save=document.createElement('button');save.type='button';save.textContent='保存提醒设置';save.disabled=true;const state=document.createElement('p');state.className='muted';state.setAttribute('role','status');
 actions.append(add,save);panel.append(title,hint,list,actions,state);document.querySelector('.settings-panel').append(panel);
 let config={version:1,rules:[]},saved=null,dirty=false,loaded=false;
 function update(){dirty=saved!==JSON.stringify(config);save.disabled=!loaded;state.textContent=dirty?'提醒设置未保存；已有规则仍按保存版本运行':'已保存 · 新规则默认关闭，不会自动发送测试通知';add.disabled=config.rules.length>=20;}
 function field(card,label,type,value,change,options=[]){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='select'?'select':'input');if(type==='select')for(const [v,text] of options){const o=document.createElement('option');o.value=v;o.textContent=text;input.append(o);}else input.type=type;if(type==='checkbox')input.checked=value;else input.value=value;input.oninput=()=>{change(type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value);update();};wrap.append(input);card.append(wrap);return input;}
 function render(){list.replaceChildren();for(const rule of config.rules){const card=document.createElement('div');card.className='reminder-rule';card.dataset.ruleId=rule.id;
  field(card,'启用提醒','checkbox',rule.enabled,v=>rule.enabled=v);
  field(card,'配额窗口','select',rule.window,v=>rule.window=v,[['primary','5H'],['secondary','WK']]);
  const trigger=field(card,'提醒条件','select',rule.trigger,v=>{rule.trigger=v;minutes.disabled=v==='reset';},[['before','重置前'],['reset','重置时']]);
  const minutes=field(card,'提前分钟数','number',rule.minutes,v=>rule.minutes=v);minutes.min=1;minutes.max=10080;minutes.disabled=trigger.value==='reset';
  const text=field(card,'推送文字','text',rule.text,v=>{rule.text=v;validateText();});const metrics=document.createElement('small');metrics.className='muted';card.append(metrics);
  function validateText(){const error=noticeError(rule.text),m=noticeMetrics(rule.text);text.setCustomValidity(error);metrics.textContent=error||`中文15 / 大写英文32字预算 · 当前 ${Math.ceil(m.units/480*100)}%`;metrics.classList.toggle('error',!!error);}validateText();
  const buttons=document.createElement('div');buttons.className='actions';const test=document.createElement('button');test.type='button';test.textContent='测试推送';test.onclick=async()=>{if(dirty){message('请先保存提醒设置，再测试推送',true);return;}if(!confirm('发送这条静音提醒，并将设备画面恢复为已保存画布？'))return;test.disabled=true;try{await api('/api/reminders/test',{id:rule.id});message('测试提醒已推送，已保存画布已同步；请确认实屏');}catch(e){message(e.message,true);}finally{test.disabled=false;}};
  const remove=document.createElement('button');remove.type='button';remove.textContent='删除规则';remove.onclick=()=>{config.rules=config.rules.filter(r=>r.id!==rule.id);render();update();};buttons.append(test,remove);card.append(buttons);list.append(card);
 }if(!config.rules.length)list.textContent='尚无规则，可添加5H或WK提醒。';}
 add.onclick=()=>{config.rules.push({id:crypto.randomUUID(),enabled:false,window:'primary',trigger:'before',minutes:5,text:'5H即将重置'});render();update();};
 save.onclick=async()=>{for(const input of panel.querySelectorAll('input'))if(!input.reportValidity())return;const snapshot=structuredClone(config);save.disabled=true;try{await api('/api/reminders',snapshot,'PUT');saved=JSON.stringify(snapshot);update();message(dirty?'保存版本已生效；刚才的新修改仍需保存':'提醒设置已保存，伴侣后台生效');}catch(e){message(e.message,true);}finally{save.disabled=!loaded;}};
 try{const result=await api('/api/reminders');config={version:result.version,rules:result.rules};saved=JSON.stringify(config);loaded=true;render();update();if(result.status?.error)state.textContent='最近提醒失败：'+result.status.error;}catch(e){state.textContent='提醒配置读取失败：'+e.message;add.disabled=true;}
 window.addEventListener('beforeunload',e=>{if(loaded&&dirty){e.preventDefault();e.returnValue='';}});
}
