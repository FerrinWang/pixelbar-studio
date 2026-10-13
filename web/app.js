import {builtins,registerPlugin,renderFrame,renderPlayback,normalizeScene,defaultScene,clamp,fitElement} from './core/render.js';
import {setupDeviceSettings} from './device-settings.js';
import {prepareText} from './text-raster.js';
import {setupAnimation} from './animation.js';
import {loadBitmapFonts} from './core/bitmap-fonts.js';
import {setupWorkbench} from './workbench.js';
import {openIconEditor} from './icon-editor.js';
import {setupUpdateNotice} from './update-notice.js';
import {openComponentPreview} from './component-preview.js';
const compactStyle=document.createElement('link');compactStyle.rel='stylesheet';compactStyle.href='/compact.css';document.head.append(compactStyle);
const $=id=>document.getElementById(id), clone=v=>JSON.parse(JSON.stringify(v));
let scene=clone(defaultScene),selected='quota',status={},lastSuccess=0,history=[],future=[],dirty=false,loading=false,frame=new Uint8Array(1024),lastFrame='',drag=null,plugins=[...builtins];
const canvas=$('canvas'),ctx=canvas.getContext('2d');
let screenColor=[102,175,255];
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
async function api(path,body,method=body===undefined?'GET':'POST'){
 const request=()=>fetch(path,{method,credentials:'same-origin',signal:AbortSignal.timeout(path==='/api/animation'?135000:path==='/api/frame'||path==='/api/refresh'||path==='/api/device-settings'?25000:8000),headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 let r=await request();
 // Renew a rotated companion session without reloading an unsaved canvas.
 // A 403 is rejected before any mutation, so one retry is safe.
 if(r.status===403){await fetch('/',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)});r=await request();}
 const text=await r.text();let result;try{result=text?JSON.parse(text):null;}catch{throw new Error(`${path}: 服务返回无效数据`);}if(!r.ok)throw new Error(result?.error||`${path}: ${r.status}`);return result;
}
function checkpoint(){history.push(clone(scene));if(history.length>80)history.shift();future=[];dirty=true;}
function current(){return scene.elements.find(e=>e.id===selected);}
function fitCurrent(e=current()){if(!e)return;const result=fitElement(e,{quota:status.quota,providers:status.providers,now:Date.now()});prepareText(scene);return result;}
function safeChange(){scene=normalizeScene(scene);for(const e of scene.elements)if(e.props.autoFit)fitCurrent(e);prepareText(scene);dirty=true;render();layers();inspector();statusView();}
function elementOutlines(){let overlay=$('element-outlines');if(!overlay){overlay=document.createElement('div');overlay.id='element-outlines';overlay.setAttribute('aria-hidden','true');$('canvas-wrap').insertBefore(overlay,$('selection'));}const ids=new Set(scene.elements.map(e=>e.id));for(const child of [...overlay.children])if(!ids.has(child.dataset.elementId))child.remove();for(const e of scene.elements){let box=[...overlay.children].find(child=>child.dataset.elementId===e.id);if(!box){box=document.createElement('div');box.className='element-outline';box.dataset.elementId=e.id;overlay.append(box);}Object.assign(box.style,{left:e.x/256*100+'%',top:e.y/32*100+'%',width:e.width/256*100+'%',height:e.height/32*100+'%'});box.classList.toggle('selected',e.id===selected);}}
function encode(bytes){let text='';for(const b of bytes)text+=String.fromCharCode(b);return btoa(text);}
function render(){try{for(const e of scene.elements)if(e.props.autoFit){const before=[e.x,e.y,e.width,e.height].join();fitCurrent(e);if(before!==[e.x,e.y,e.width,e.height].join())dirty=true;}frame=renderFrame(scene,{quota:status.quota,providers:status.providers,now:Date.now()});const img=ctx.createImageData(256,32);for(let y=0;y<32;y++)for(let x=0;x<256;x++){const on=(frame[(y>>3)*256+x]>>(y&7))&1,i=(y*256+x)*4;img.data[i]=on?screenColor[0]:9;img.data[i+1]=on?screenColor[1]:19;img.data[i+2]=on?screenColor[2]:21;img.data[i+3]=255;}ctx.putImageData(img,0,0);if($('grid').checked&&$('canvas-wrap').clientWidth/256>=3){ctx.fillStyle='#0005';for(let x=0;x<256;x++)ctx.fillRect(x,0,.13,32);for(let y=0;y<32;y++)ctx.fillRect(0,y,256,.13);}elementOutlines();selection();}catch(e){message(`渲染失败：${e.message}`,true);}}
function selection(){const e=current(),box=$('selection');box.style.display=e?'block':'none';if(e)Object.assign(box.style,{left:e.x/256*100+'%',top:e.y/32*100+'%',width:e.width/256*100+'%',height:e.height/32*100+'%'});$('undo').disabled=!history.length;$('redo').disabled=!future.length;let note=$('draft-note');if(!note){note=document.createElement('p');note.id='draft-note';note.className='muted';$('push-state').after(note);}note.textContent=status.autoPush?(dirty?'有未保存修改 · 请先保存；后台每 15 秒推送已保存场景':'后台每 15 秒更新已保存场景 · 关闭页面后继续运行'):(dirty?'本地草稿 · 保存后可供后台自动推送':'手动推送当前画布，自动推送使用已保存场景');note.style.color=dirty?'var(--orange)':'';}
function layers(){$('layers').replaceChildren();$('layer-count').textContent=scene.elements.length;$('duplicate').disabled=$('delete').disabled=!current();for(const e of [...scene.elements].reverse()){const row=document.createElement('div');row.className='layer'+(e.id===selected?' active':'');const title=document.createElement('span');title.textContent=(plugins.find(p=>p.id===e.type)?.name||e.type);const size=document.createElement('small');size.textContent=`${e.width} × ${e.height}`;row.append(title,size);for(const [text,delta] of [['↑',1],['↓',-1]]){const button=document.createElement('button');button.textContent=text;button.title='调整图层顺序';button.onclick=event=>{event.stopPropagation();const index=scene.elements.indexOf(e),target=index+delta;if(target<0||target>=scene.elements.length)return;checkpoint();[scene.elements[index],scene.elements[target]]=[scene.elements[target],scene.elements[index]];safeChange();};row.append(button);}row.onclick=()=>{selected=e.id;inspector();layers();selection();};$('layers').append(row);}}
function field(parent,name,label,type,value,onChange,extra={}){
 if(type==='segmented'){
  const group=document.createElement('div');group.className='property';const title=document.createElement('span');title.textContent=label;
  const buttons=document.createElement('div');buttons.className='mode-buttons';buttons.setAttribute('role','group');buttons.setAttribute('aria-label',label);
  for(const option of extra.options||[]){const button=document.createElement('button');button.type='button';button.textContent=option.label;button.setAttribute('aria-pressed',String(value===option.value));button.onclick=()=>onChange(option.value);buttons.append(button);}
  group.append(title,buttons);parent.append(group);return;
 }
 const wrap=document.createElement('label');wrap.className='property';const text=document.createElement('span');text.textContent=label;
 const input=document.createElement(type==='select'?'select':type==='textarea'?'textarea':'input');
 if(type==='textarea')input.rows=3;else if(type!=='select')input.type=type==='boolean'?'checkbox':type==='number'?'number':'text';
 if(type==='select')for(const option of extra.options||[]){const opt=document.createElement('option');opt.value=typeof option==='object'?option.value:option;opt.textContent=typeof option==='object'?option.label:option;input.append(opt);}
 if(type==='boolean')input.checked=!!value;else input.value=value??'';
 if(type==='number'){input.step=1;if(extra.min!==undefined)input.min=extra.min;if(extra.max!==undefined)input.max=extra.max;}
 input.name=name;input.setAttribute('aria-label',label);
 if((type==='textarea'||type==='text')&&extra.preview){input.maxLength=256;let started=false;const preview=()=>{if(!started){checkpoint();started=true;}extra.preview(input.value);};input.oninput=event=>{if(!event.isComposing)preview();};input.oncompositionend=preview;input.onchange=()=>{started=false;render();statusView();};}
 else input.onchange=()=>onChange(type==='boolean'?input.checked:type==='number'?Number(input.value):input.value);
 wrap.append(text,input);parent.append(wrap);
}
function schemaOf(manifest){const schema=manifest?.schema||manifest?.properties||[];if(Array.isArray(schema))return schema;if(schema.properties)return Object.entries(schema.properties).map(([name,p])=>({name,...p,type:p.type==='string'?'text':p.type,...(p.enum?{type:'select',options:p.enum}:{})}));return Object.entries(schema).map(([name,p])=>({name,...p}));}
function inspector(){
 const root=$('properties');root.replaceChildren();const e=current(),manifest=plugins.find(p=>p.id===e?.type);$('selected-title').textContent=manifest?.name||'元素属性';
 if(!e){const hint=document.createElement('p');hint.className='muted';hint.textContent='选择画布上的元素，或拖入一个组件。';root.append(hint);return;}
 const geometry=document.createElement('div');geometry.className='geometry';
 const placement=document.createElement('details');placement.className='placement-controls';placement.open=!['text','unicode-text','bilibili-fans','notification'].includes(e.type);
 const placementTitle=document.createElement('summary');placementTitle.textContent=`位置与尺寸 · ${e.width} × ${e.height}`;placement.append(placementTitle,geometry);root.append(placement);
 const frameTools=document.createElement('div');frameTools.className='frame-tools';
 field(frameTools,'frameEnabled','屏幕显示像素边框','boolean',e.props.frameEnabled,v=>{checkpoint();e.props.frameEnabled=v;if(v)fitCurrent(e);safeChange();});
 field(frameTools,'autoFit','框自动适配内容','boolean',e.props.autoFit,v=>{checkpoint();e.props.autoFit=v;if(v)fitCurrent(e);safeChange();});
 const fitBox=document.createElement('button');fitBox.textContent='框适配内容';fitBox.onclick=()=>{checkpoint();const result=fitCurrent(e);safeChange();message(result?.clipped?'内容超过 256 × 32，请缩小字号或简化内容':'素材框已适配内容',!!result?.clipped);};frameTools.append(fitBox);root.append(frameTools);
 for(const [name,label,max] of [['x','X 坐标',255],['y','Y 坐标',31],['width','宽度',256],['height','高度',32]])field(geometry,name,label,'number',e[name],v=>{checkpoint();e[name]=v;safeChange();},{min:name==='x'||name==='y'?0:1,max});
 const isText=e.type==='text'||e.type==='unicode-text',legacy=e.type==='unicode-text'&&(!e.props.fontId||e.props.fontId==='legacy')&&Array.isArray(e.props.pixels),tiny=e.type==='text'&&(!e.props.fontId||e.props.fontId==='tiny');
 for(const property of schemaOf(manifest)){
  const p={...property},name=p.name||p.key;if(!name)continue;
  if(isText&&((name==='scale'&&!tiny)||(['pixelScale','lineGap'].includes(name)&&(tiny||legacy))))continue;
  if(name==='fontId'&&legacy)p.options=[{value:'legacy',label:'原有文字点阵（保留）'},...p.options];
  if(name==='pixelScale'){p.min=1;p.max=3;}if(name==='lineGap'){p.min=0;p.max=8;}
  if(e.type==='bilibili-fans'&&(name==='uid'||name==='label'))p.preview=v=>{e.props[name]=v;dirty=true;render();statusView();};
  if(name==='text'&&isText)p.preview=v=>{e.props.text=v;prepareText(scene);dirty=true;render();statusView();const hint=root.querySelector('.text-metrics'),m=e.props.textMetrics;if(hint&&m){hint.textContent=`文字需要 ${m.width} × ${m.height} 像素${m.clipped?' · 超出元素边界，请适应尺寸':''}${m.missing?.length?' · 缺字：'+m.missing.join(''):''}`;hint.classList.toggle('warning',m.clipped||!!m.missing?.length);}};
  field(root,name,p.label||p.title||name,p.type,name==='fontId'&&legacy?'legacy':e.props[name]??p.default,v=>{checkpoint();e.props[name]=p.type==='number'?clamp(v,p.min??-Infinity,p.max??Infinity):v;if(e.type==='bilibili-fans'&&name==='sizePreset'||e.type==='codex-quota'&&/^(primary|secondary)(Countdown|Date|Time)$/.test(name))fitCurrent(e);safeChange();},p);
 }
 if(e.type==='codex-quota'){const hint=document.createElement('p');hint.className='text-metrics';hint.textContent='5H / WK 的倒计时、日期、时间分别开关；日期与时间使用本机时区，倒计时精确到分钟。缺少真实重置时间时显示 --；开启全部字段再加边框可能超过屏幕高度。';root.append(hint);}
 if(isText&&!tiny){
  const metrics=e.props.textMetrics,hint=document.createElement('p');hint.className='text-metrics';
  hint.textContent=legacy?'原有文字点阵已保留。切换字体后使用新的原生点阵渲染。':metrics?`文字需要 ${metrics.width} × ${metrics.height} 像素${metrics.clipped?' · 超出元素边界，请适应尺寸':''}${metrics.missing?.length?' · 缺字：'+metrics.missing.join(''):''}`:'选择字体后按原生像素绘制。';
  hint.classList.toggle('warning',!!metrics?.clipped||!!metrics?.missing?.length);root.append(hint);
  if(!legacy){const fitButton=document.createElement('button');fitButton.textContent='适应文字尺寸';fitButton.onclick=()=>{checkpoint();fitCurrent(e);safeChange();};root.append(fitButton);}
 }
 if(e.type==='image'){const button=document.createElement('button');button.textContent='导入图片 · 转为单色';button.onclick=()=>$('image-file').click();root.append(button);}
 if(e.type==='bilibili-fans'){
  const editIcon=document.createElement('button');editIcon.textContent='编辑小／中／大号图标';editIcon.className='edit-icon-button';editIcon.onclick=()=>openIconEditor({overrides:e.props.iconOverrides,size:e.props.sizePreset||'medium',onApply:icons=>{const target=scene.elements.find(item=>item.id===e.id);if(!target)return;checkpoint();target.props.iconOverrides=icons;safeChange();message('图标已应用到当前组件；保存场景后供后台使用');}});root.append(editIcon);
  const hint=document.createElement('p');hint.className='text-metrics';hint.textContent='填写 UID 后可直接读取，无需先保存。保存后后台每 60 秒采集；最多三个账号。小电视＋完整数字，标题可隐藏或修改。';root.append(hint);
  const refresh=document.createElement('button');refresh.textContent='读取当前 UID 的粉丝数';refresh.onclick=async()=>{refresh.disabled=true;try{const uid=String(e.props.uid||'').trim();if(!/^[1-9]\d{0,19}$/.test(uid))throw new Error('请填写有效的数字 UID');await api('/api/refresh',{bilibiliUIDs:[uid]});await poll();const entry=status.providers?.bilibili?.value?.accounts?.[uid];message(entry?.follower!==undefined?`粉丝数：${entry.follower}${entry.status==='stale'?'（上次数据）':''}`:entry?.error||status.providerErrors?.bilibili||'暂未读到粉丝数，请稍后重试',!entry||entry.status!=='live');}catch(error){message(error.message,true);}finally{refresh.disabled=false;}};root.append(refresh);
 }
 if(e.type==='notification'){
  const hint=document.createElement('p');hint.className='text-metrics';hint.textContent='接入地址：POST /api/notifications。频道需与消息一致；启用自动推送才自动更新设备。长文字自动换行，超长内容用省略号。';root.append(hint);
  const test=document.createElement('button');test.textContent='发送预览通知';test.onclick=async()=>{test.disabled=true;try{await api('/api/notifications',{channel:e.props.channel||'general',title:'屏幕通知',text:'你好，消息已接入 PixelBar',ttlSeconds:60});await poll();message('通知已接收；手动模式请点推送，自动模式将更新已保存场景');}catch(error){message(error.message,true);}finally{test.disabled=false;}};root.append(test);
 }
}
function add(type,x=0,y=0,drop=false){const manifest=plugins.find(p=>p.id===type);if(!manifest)return;openComponentPreview({manifest,schema:schemaOf(manifest),elements:scene.elements,getData:()=>({quota:status.quota,providers:status.providers,now:Date.now()}),x,y,drop,onAdd:e=>{checkpoint();scene.elements.push(e);selected=e.id;safeChange();inspector();message('组件已添加到本地草稿；保存后供后台使用');}});}
function palette(){$('plugins').replaceChildren();$('plugin-count').textContent=plugins.length;plugins.forEach((p,i)=>{const button=document.createElement('button');button.className='plugin';button.draggable=true;const title=document.createElement('strong'),icon=document.createElement('span');icon.className='icon';icon.textContent=['T','□','◷','▥','▰','▧','⌁'][i%7];title.append(icon,document.createTextNode(p.name||p.id));const detail=document.createElement('small');detail.textContent=p.description||'本地像素插件';button.append(title,detail);button.ondragstart=event=>event.dataTransfer.setData('application/pixelbar-plugin',p.id);button.onclick=()=>add(p.id);$('plugins').append(button);});}
function point(event){const r=canvas.getBoundingClientRect();return {x:Math.floor((event.clientX-r.left)/r.width*256),y:Math.floor((event.clientY-r.top)/r.height*32)};}
canvas.ondragover=e=>e.preventDefault();canvas.ondrop=e=>{e.preventDefault();const pos=point(e);add(e.dataTransfer.getData('application/pixelbar-plugin'),pos.x,pos.y,true);};
canvas.onpointerdown=event=>{canvas.focus();const p=point(event);const e=[...scene.elements].reverse().find(e=>p.x>=e.x&&p.x<e.x+e.width&&p.y>=e.y&&p.y<e.y+e.height);selected=e?.id;inspector();layers();selection();if(e){drag={id:e.id,x:p.x,y:p.y,startX:e.x,startY:e.y,moved:false};canvas.setPointerCapture(event.pointerId);}};
canvas.onpointermove=event=>{if(!drag)return;const e=current(),p=point(event);if(!e)return;if(!drag.moved&&(p.x!==drag.x||p.y!==drag.y)){checkpoint();drag.moved=true;}e.x=clamp(drag.startX+p.x-drag.x,0,256-e.width);e.y=clamp(drag.startY+p.y-drag.y,0,32-e.height);render();};
canvas.onpointerup=canvas.onpointercancel=()=>{if(drag?.moved){safeChange();inspector();}drag=null;};
function remove(){if(!current())return;checkpoint();scene.elements=scene.elements.filter(e=>e.id!==selected);selected=scene.elements.at(-1)?.id;safeChange();inspector();}
function duplicate(){const e=current();if(!e)return;checkpoint();const copy=clone(e);copy.id=crypto.randomUUID();copy.x=Math.min(256-copy.width,copy.x+3);copy.y=Math.min(32-copy.height,copy.y+2);scene.elements.push(copy);selected=copy.id;safeChange();inspector();}
function undo(redo=false){const from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(clone(scene));scene=from.pop();dirty=true;render();layers();inspector();}
document.addEventListener('keydown',event=>{if(event.target.matches('input,textarea,select'))return;const mod=event.metaKey||event.ctrlKey;if(mod&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey);return;}if(mod&&event.key.toLowerCase()==='d'){event.preventDefault();duplicate();return;}if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();remove();return;}const e=current(),d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(e&&d){event.preventDefault();checkpoint();e.x+=d[0]*(event.shiftKey?8:1);e.y+=d[1]*(event.shiftKey?8:1);safeChange();inspector();}});
$('undo').onclick=()=>undo();$('redo').onclick=()=>undo(true);$('delete').onclick=remove;$('duplicate').onclick=duplicate;
function fit(){const value=$('zoom').value;$('canvas-wrap').style.width=value==='fit'?'100%':256*Number(value)+'px';render();}new ResizeObserver(fit).observe($('viewport'));$('zoom').onchange=fit;$('grid').onchange=render;
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>download(new Blob([JSON.stringify(scene,null,2)],{type:'application/json'}),'pixelbar-scene.json');
$('png').onclick=()=>{const out=document.createElement('canvas');out.width=256;out.height=32;const c=out.getContext('2d'),image=c.createImageData(256,32);for(let y=0;y<32;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,on=frame[(y>>3)*256+x]&(1<<(y&7));image.data[i]=image.data[i+1]=image.data[i+2]=on?255:0;image.data[i+3]=255;}c.putImageData(image,0,0);out.toBlob(blob=>download(blob,'pixelbar-frame.png'));};
$('import').onclick=()=>$('json-file').click();$('json-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>2e6)throw new Error('场景文件不得超过 2 MB');const next=normalizeScene(JSON.parse(await file.text()));checkpoint();scene=next;selected=scene.elements[0]?.id;safeChange();inspector();message('场景已导入；点击保存同步到本地服务');}catch(e){message(e.message,true);}event.target.value='';};
$('image-file').onchange=async event=>{const file=event.target.files[0],e=current();if(!file||e?.type!=='image')return;try{const bitmap=await createImageBitmap(file);const temp=document.createElement('canvas');temp.width=e.width;temp.height=e.height;const c=temp.getContext('2d');c.drawImage(bitmap,0,0,e.width,e.height);const raw=c.getImageData(0,0,e.width,e.height).data;bitmap.close();checkpoint();e.props.sourceWidth=e.width;e.props.sourceHeight=e.height;e.props.pixels=Array.from({length:e.width*e.height},(_,i)=>raw[i*4+3]>127&&(.2126*raw[i*4]+.7152*raw[i*4+1]+.0722*raw[i*4+2])>=Number(e.props.threshold??128)?1:0);safeChange();message('图片已转为单色像素；阈值改变后可重新导入');}catch(err){message('图片导入失败：'+err.message,true);}event.target.value='';};
async function sendFrame(force=false){const playback=renderPlayback(scene,{quota:status.quota,providers:status.providers,now:Date.now()}),frames=playback.frames.map(encode),key=frames.join(':');if(!force&&key===lastFrame)return;const result=playback.delay?await api('/api/animation',{frames,delay:playback.delay}):await api('/api/frame',{pixels:frames[0]});if(playback.delay){status.autoPush=false;$('auto').checked=false;}lastFrame=key;return result;}
function run(button,action){button.onclick=async()=>{button.disabled=true;try{await action();}catch(e){message(e.message,true);}finally{button.disabled=false;}};}
run($('save'),async()=>{await api('/api/scene',scene,'PUT');dirty=false;statusView();message('场景已保存到本地服务');});
run($('push'),async()=>{render();const result=await sendFrame(true);if(result?.lastPush)status.lastPush=result.lastPush;statusView();message(result?.result?.experimentalAnimation?'冒号闪烁两帧已上传；目标亮灭各 0.5 秒，设备节奏待确认，自动推送已关闭':'当前静态画面已推送到 PixelBar');});
run($('refresh'),async()=>{const bilibiliUIDs=[...new Set(scene.elements.filter(e=>e.type==='bilibili-fans').map(e=>String(e.props.uid||'').trim()).filter(Boolean))];await api('/api/refresh',{bilibiliUIDs});await poll();const failed=bilibiliUIDs.map(uid=>status.providers?.bilibili?.value?.accounts?.[uid]).find(entry=>!entry||entry.status!=='live');message(failed?.error||'数据已刷新',!!failed);});
$('auto').onchange=async()=>{const enabled=$('auto').checked;$('auto').disabled=true;try{await api('/api/auto',{enabled});status.autoPush=enabled;message(enabled?'后台自动推送已开启':'自动推送已关闭');}catch(e){$('auto').checked=!enabled;message(e.message,true);}finally{$('auto').disabled=false;}};
function statusView(){const updated=Number(status.quota?.updatedAt)||0;const stale=!lastSuccess||Date.now()-lastSuccess>10000||status.quota?.status==='stale'||!updated;$('freshness').textContent=stale?`数据过期${updated?' · '+new Date(updated).toLocaleTimeString('zh-CN'):' · 等待同步'}`:`已同步 · ${new Date(updated).toLocaleTimeString('zh-CN')}`;$('freshness').classList.toggle('error',stale);for(const key of ['primary','secondary']){const q=status.quota?.[key];$(key).textContent=q?.usedPercent==null?'—':`${Math.round(clamp(q.usedPercent,0,100))}%`;const reset=q?.resetsAt;const date=reset?new Date(typeof reset==='number'&&reset<1e12?reset*1000:reset):null;$(key+'-reset').textContent=(stale?'过期数据 · ':'')+(date&&!isNaN(date)?`${date.toLocaleString('zh-CN')} 重置`:'暂无重置时间');}$('device-state').textContent=status.device?.connected?(status.device.busy?'PixelBar 正在传输…':'设备已连接 · PixelBar 就绪'):'PixelBar 未连接';$('push-state').textContent=status.error|| (status.lastPush?`最近推送：${new Date(typeof status.lastPush==='number'&&status.lastPush<1e12?status.lastPush*1000:status.lastPush).toLocaleString('zh-CN')}`:'尚未推送');$('push-state').classList.toggle('error',!!status.error);if(!$('auto').disabled)$('auto').checked=!!status.autoPush;selection();}
async function poll(){if(loading)return;loading=true;try{status=await api('/api/status')||{};lastSuccess=Date.now();render();}catch(e){message('本地服务暂不可用：'+e.message,true);}finally{loading=false;statusView();}}
async function loadPlugins(){try{const manifests=await api('/api/plugins');if(!Array.isArray(manifests))return;for(const entry of manifests){try{const url=new URL(entry.module,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith('/plugins/')||!url.pathname.endsWith('.js')||url.search||url.hash)throw new Error('插件必须是本地 /plugins/*.js 模块');const mod=await import(url.href),render=mod.render||mod.default?.render;const manifest={...(mod.manifest||mod.default?.manifest||{}),...entry};registerPlugin(manifest,render,mod.measure||mod.default?.measure);plugins=plugins.filter(p=>p.id!==manifest.id);plugins.push(manifest);}catch(e){message(`插件 ${entry.name||entry.id}：${e.message}`,true);}}palette();inspector();render();}catch(e){message('插件列表暂不可用；内置组件已就绪',true);}}
document.querySelector('.canvas-toolbar>span').textContent='PixelBar 预览';
document.querySelector('.palette .note').textContent='原生像素 · 本地运行 · 256 × 32 / PixelBar。插件与后台共用渲染引擎。';
document.querySelector('.inspector .note').textContent='中英文均可切换像素字体；建议使用原生 10 / 12 px。超出边界时可点「适应文字尺寸」。设备实际上传仍可能显示提示。';
try{await loadBitmapFonts();}catch(e){message(e.message,true);}
palette();layers();inspector();render();
setupDeviceSettings({api,message,onScreenColor:color=>{screenColor=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));render();}});
setupAnimation({api,message,getFrame:()=>{render();return frame;},onUploaded:result=>{status.autoPush=false;status.lastPush=result.lastPush;statusView();}});
setupWorkbench({selected:current,message,change:apply=>{const e=current();if(e){checkpoint();apply(e);safeChange();}}});
void setupUpdateNotice({api,message});
await Promise.allSettled([loadPlugins(),(async()=>{try{const loaded=await api('/api/scene');if(loaded&&!dirty){scene=normalizeScene(loaded);prepareText(scene);selected=scene.elements[0]?.id;render();layers();inspector();}}catch(e){message('使用默认布局；保存后将同步到本地服务',true);}})()]);
layers();inspector();render();
function transferView(){let progress=$('transfer-progress');if(!progress){progress=document.createElement('progress');progress.id='transfer-progress';progress.max=100;progress.setAttribute('aria-label','设备上传进度');progress.style.width='100%';$('push-state').after(progress);}const p=status.transfer;progress.hidden=!(status.device?.busy&&p&&p.phase!=='done');if(!progress.hidden){const percent=Math.floor(p.completedBytes/p.totalBytes*100);progress.value=percent;$('push-state').textContent=p.phase==='verifying'?'文件已传完，正在确认设备模式…':`上传 ${percent}% · ${p.completedBytes} / ${p.totalBytes} 字节，请等待设备确认`;}}
await poll();setInterval(poll,3000);setInterval(()=>{render();statusView();transferView();},100);
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
