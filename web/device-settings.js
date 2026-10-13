import {setupDevicePreview} from './device-preview.js';
export async function setupDeviceSettings({api,message,onScreenColor,getFrame}) {
 const panel=document.createElement('section');panel.className='settings-panel';
 const title=document.createElement('div');title.className='eyebrow';title.textContent='DEVICE SETTINGS / 设备设置';panel.append(title);
 const rows=document.createElement('div');rows.className='settings-rows';panel.append(rows);
 const hint=document.createElement('small');hint.className='muted';hint.textContent='正在读取设备能力…';panel.append(hint);
 document.querySelector('.device-panel').after(panel);
 const controls={};
 function control(row,id,label,type,value){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='select'?'select':'input');input.id=id;if(type==='select'){for(const [value,text] of [['solid','纯色'],['breathing','呼吸'],['tide','潮汐'],['rainbow','彩色波纹'],['shadow','光影'],['dynamic','动态光影']]){const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);}}else input.type=type;if(type==='checkbox')input.checked=value;else input.value=value;if(type==='range'){input.min=10;input.max=100;input.step=10;input.title='亮度 10–100%';}wrap.append(input);row.append(wrap);controls[id]=input;return input;}
 const screen=document.createElement('div');screen.className='settings-row';const screenTitle=document.createElement('strong');screenTitle.textContent='屏幕';screen.append(screenTitle);rows.append(screen);
 control(screen,'screen-color','显示颜色','color','#66afff');
 const lighting=document.createElement('div');lighting.className='settings-row';const lightingTitle=document.createElement('strong');lightingTitle.textContent='机身 RGB 灯光';lighting.append(lightingTitle);rows.append(lighting);
 control(lighting,'lighting-color','颜色','color','#66afff');control(lighting,'lighting-brightness','亮度','range',100);control(lighting,'lighting-enabled','开启','checkbox',true);control(lighting,'lighting-effect','效果','select','solid');
 const speed=control(lighting,'lighting-speed','速率','number',8);speed.min=1;speed.max=10;
 const state=document.createElement('span');state.className='muted';lighting.append(state);
 const save=document.createElement('button');save.textContent='应用设备设置';save.disabled=true;panel.append(save);
 const appearance=setupDevicePreview({panel,controls,getFrame,message,api});
 let settings={screen:{supported:false},lighting:{supported:false}};
 function capabilities(){const effect=controls['lighting-effect'].value;controls['lighting-color'].disabled=settings.lighting?.supported!==true||!['solid','breathing'].includes(effect);controls['lighting-speed'].disabled=settings.lighting?.supported!==true||!['breathing','tide'].includes(effect);}
 controls['lighting-effect'].onchange=capabilities;
 function apply(data){appearance.useDeviceSettings(data);settings=data;const s=data.screen||{},l=data.lighting||{};controls['screen-color'].disabled=s.supported===false;controls['screen-color'].value=/^#[\da-f]{6}$/i.test(s.color)?s.color:'#66afff';onScreenColor(controls['screen-color'].value);for(const id of ['lighting-color','lighting-brightness','lighting-enabled','lighting-effect'])controls[id].disabled=l.supported!==true;controls['lighting-color'].value=/^#[\da-f]{6}$/i.test(l.color)?l.color:'#66afff';controls['lighting-brightness'].value=Math.max(10,Math.min(100,Number(l.brightness)||10));controls['lighting-enabled'].checked=l.enabled!==false;controls['lighting-effect'].value=l.effect||'solid';controls['lighting-speed'].value=l.speed||8;capabilities();state.textContent=l.supported===true?'已读回设备参数':'暂不支持 · 灯光协议未确认';hint.textContent='应用后读回确认；屏幕与机身灯光分别控制，后台推送保留设备颜色。';save.disabled=s.supported===false&&l.supported!==true;}
 save.onclick=async()=>{save.disabled=true;try{const updates={};if(settings.screen?.supported!==false)updates.screen={color:controls['screen-color'].value};if(settings.lighting?.supported===true){updates.lighting={color:controls['lighting-color'].value,brightness:Number(controls['lighting-brightness'].value),enabled:controls['lighting-enabled'].checked,effect:controls['lighting-effect'].value};if(!controls['lighting-speed'].disabled)updates.lighting.speed=Number(controls['lighting-speed'].value);}await api('/api/device-settings',updates,'PUT');apply(await api('/api/device-settings'));message('设备设置已应用并读回确认');}catch(e){message(e.message,true);}finally{save.disabled=settings.screen?.supported===false&&settings.lighting?.supported!==true;}};
 Object.values(controls).forEach(input=>input.disabled=true);
 try{apply(await api('/api/device-settings'));}catch(e){hint.textContent='设备设置服务不可用';state.textContent='能力未确认';message(e.message,true);}
}
