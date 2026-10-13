export function setupWorkbench({change,selected,message}) {
 const workspace=document.querySelector('.workspace');
 const main=document.querySelector('main');main.dataset.workspace='editor';
 const link=document.createElement('link');link.rel='stylesheet';link.href='/workbench.css';document.head.append(link);
 const navigation=document.createElement('nav');navigation.className='workbench-tabs';navigation.setAttribute('aria-label','工作区');
 navigation.innerHTML='<button data-tab="editor" aria-pressed="true">画布编辑</button><button data-tab="animation" aria-pressed="false">动画制作</button><button data-tab="device" aria-pressed="false">设备与灯光</button>';
 workspace.prepend(navigation);
 const edit=document.createElement('div');edit.className='editor-area';
 const animation=document.createElement('div');animation.className='animation-area';animation.hidden=true;
 const device=document.createElement('div');device.className='device-area';device.hidden=true;
 const canvasNodes=['.workspace-top','.canvas-toolbar','#viewport','.layers-panel'];
 for(const selector of canvasNodes)edit.append(workspace.querySelector(selector));
 animation.append(workspace.querySelector('.animation-panel'));
 device.append(workspace.querySelector('.settings-panel'),workspace.querySelector('.quota-cards'));
 const status=workspace.querySelector('.device-panel');status.classList.add('connection-bar');
 workspace.append(edit,animation,device,status);
 for(const button of navigation.querySelectorAll('button'))button.onclick=()=>{
  const tab=button.dataset.tab;edit.hidden=tab!=='editor';animation.hidden=tab!=='animation';device.hidden=tab!=='device';
  main.dataset.workspace=tab;
  navigation.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 };
 const search=document.createElement('input');search.type='search';search.placeholder='搜索组件…';search.setAttribute('aria-label','搜索组件');search.className='plugin-search';
 document.querySelector('#plugins').before(search);
 search.oninput=()=>{for(const button of document.querySelectorAll('#plugins .plugin'))button.hidden=!button.textContent.toLowerCase().includes(search.value.toLowerCase());};
 const tools=document.createElement('div');tools.className='layout-tools';tools.setAttribute('role','group');tools.setAttribute('aria-label','对齐与尺寸');
 const actions=[['左对齐',e=>e.x=0],['水平居中',e=>e.x=Math.floor((256-e.width)/2)],['右对齐',e=>e.x=256-e.width],['顶部',e=>e.y=0],['垂直居中',e=>e.y=Math.floor((32-e.height)/2)],['底部',e=>e.y=32-e.height]];
 for(const [label,apply] of actions){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{if(!selected()){message('请先选中一个元素');return;}change(apply);};tools.append(button);}
 document.querySelector('.canvas-toolbar').after(tools);
 const help=document.createElement('div');help.className='editor-help';help.textContent='点击组件添加 · 拖动定位 · 方向键微调 · ⌘Z 撤销 · 保存后供后台使用，推送仅发送当前画面';edit.append(help);
 const inspector=document.querySelector('.inspector');const heading=inspector.querySelector('h2');heading.before(Object.assign(document.createElement('div'),{className:'inspector-kicker',textContent:'选中元素设置'}));
 document.querySelector('.brand small').textContent='本地设计 · 像素屏控制台';
}
