import {fitElement,renderFrame,normalizeScene} from './core/render.js';
import {prepareText} from './text-raster.js';
import {newComponentDraft,freePlacement,overlaps} from './core/component-draft.js';
import {openIconEditor} from './icon-editor.js';
export function openComponentPreview({manifest,schema,elements,getData,onAdd,x=0,y=0,drop=false}){
  if(document.querySelector('.component-preview'))return;
  let draft=newComponentDraft(manifest,schema,x,y),placed=false,image=null;
  const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='component-preview';
  dialog.setAttribute('aria-label','配置组件：'+(manifest.name||manifest.id));
  const heading=document.createElement('h2');heading.textContent='配置组件 · '+(manifest.name||manifest.id);
  const hint=document.createElement('p');hint.className='muted';hint.textContent='独立预览，不修改原画布；确认添加后才成为新图层。';
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=32;canvas.className='component-preview-canvas';canvas.setAttribute('aria-label','当前组件的独立像素预览');
  const dimensions=document.createElement('p');dimensions.className='component-preview-metrics';
  const options=document.createElement('div');options.className='component-preview-options';
  const warning=document.createElement('p');warning.className='component-preview-warning';warning.setAttribute('role','status');
  const actions=document.createElement('footer'),cancel=document.createElement('button'),add=document.createElement('button');cancel.textContent='取消';add.textContent='添加到画布';add.className='orange';
  let coordinates=[];
  function paint(){
    try{
      const data=getData(),scene={schemaVersion:1,elements:[draft]};prepareText(scene);
      const size=draft.props.autoFit?fitElement(draft,data):null;prepareText(scene);
      draft=normalizeScene(scene).elements[0];
      if(!placed){const position=drop?{x,y}:freePlacement(draft,elements);if(position)Object.assign(draft,position);placed=true;}
      draft.x=Math.min(draft.x,256-draft.width);draft.y=Math.min(draft.y,32-draft.height);
      const bytes=renderFrame({schemaVersion:1,elements:[{...draft,x:0,y:0}]},data),ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,32);
      for(let yy=0;yy<32;yy++)for(let xx=0;xx<256;xx++){const on=(bytes[(yy>>3)*256+xx]>>(yy&7))&1,i=(yy*256+xx)*4;pixels.data.set(on?[140,223,102,255]:[9,19,21,255],i);}ctx.putImageData(pixels,0,0);
      const collision=elements.some(other=>overlaps(draft,other));
      warning.textContent=[size?.clipped?'内容超过屏幕，部分会被裁切；请减少字段或字号。':'',size?.warning||'',collision?'放置位置与已有素材重叠；可调整 X / Y，或明确确认叠放。':'',draft.type==='image'&&!image?'请先导入图片。':''].filter(Boolean).join(' ');
      add.textContent=collision?'确认添加（存在重叠）':'添加到画布';add.disabled=draft.type==='image'&&!image;
      dimensions.textContent=`内容框 ${draft.width} × ${draft.height} · 放置位置 ${draft.x}, ${draft.y} · 预览仅显示本组件`;
      for(const [input,key] of coordinates){if(document.activeElement!==input)input.value=draft[key];input.disabled=(key==='width'||key==='height')&&draft.props.autoFit===true;}
    }catch(error){warning.textContent=error.message;add.disabled=true;}
  }
  function control(property,geometry=false){
    const name=property.name||property.key,label=document.createElement('label'),title=document.createElement('span');title.textContent=property.label||property.title||name;label.append(title);
    const type=property.type,input=document.createElement(type==='select'||type==='segmented'?'select':type==='textarea'?'textarea':'input');
    if(type==='select'||type==='segmented')for(const option of property.options||[]){const opt=document.createElement('option');opt.value=typeof option==='object'?option.value:option;opt.textContent=typeof option==='object'?option.label:option;input.append(opt);}
    else if(type!=='textarea')input.type=type==='boolean'?'checkbox':type==='number'?'number':'text';
    input.setAttribute('aria-label',title.textContent);
    const value=geometry?draft[name]:draft.props[name]??property.default;
    if(type==='boolean')input.checked=!!value;else input.value=value??'';
    if(type==='number'){input.min=property.min??0;input.max=property.max??256;input.step=1;}
    input.addEventListener(type==='boolean'||type==='select'||type==='segmented'?'change':'input',event=>{
      if(event.isComposing)return;
      const value=type==='boolean'?input.checked:type==='number'?Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value))):input.value;
      if(geometry){draft[name]=value;placed=true;}else draft.props[name]=value;
      if(image&&name==='threshold')convertImage();paint();
    });
    input.addEventListener('compositionend',()=>{draft.props[name]=input.value;paint();});
    label.append(input);options.append(label);if(geometry)coordinates.push([input,name]);
  }
  control({name:'autoFit',label:'框自动适配内容',type:'boolean',default:true});
  control({name:'frameEnabled',label:'屏幕显示像素边框',type:'boolean',default:false});
  for(const property of schema)control(property);
  if(draft.type==='bilibili-fans'){const edit=document.createElement('button');edit.textContent='编辑小／中／大号图标';edit.onclick=()=>openIconEditor({overrides:draft.props.iconOverrides,size:draft.props.sizePreset||'medium',onApply:icons=>{draft.props.iconOverrides=icons;paint();}});options.append(edit);}
  for(const [name,label,max] of [['x','放置 X',255],['y','放置 Y',31],['width','框宽度',256],['height','框高度',32]])control({name,label,type:'number',min:name==='x'||name==='y'?0:1,max},true);
  function convertImage(){const temp=document.createElement('canvas');temp.width=draft.width;temp.height=draft.height;const ctx=temp.getContext('2d');ctx.drawImage(image,0,0,temp.width,temp.height);const raw=ctx.getImageData(0,0,temp.width,temp.height).data;Object.assign(draft.props,{sourceWidth:temp.width,sourceHeight:temp.height,pixels:Array.from({length:temp.width*temp.height},(_,i)=>raw[i*4+3]>127&&(.2126*raw[i*4]+.7152*raw[i*4+1]+.0722*raw[i*4+2])>=Number(draft.props.threshold??128)?1:0)});}
  if(draft.type==='image'){const file=document.createElement('input');file.type='file';file.accept='image/*';file.setAttribute('aria-label','选择预览图片');file.onchange=async()=>{try{if(!file.files[0])return;const next=await createImageBitmap(file.files[0]);image?.close();image=next;convertImage();paint();}catch(error){warning.textContent='图片读取失败：'+error.message;}};options.append(file);}
  cancel.onclick=()=>dialog.close();add.onclick=()=>{onAdd(structuredClone(draft));dialog.close();};
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  const timer=setInterval(paint,1000);
  dialog.addEventListener('close',()=>{clearInterval(timer);image?.close();dialog.remove();previous?.focus();},{once:true});
  actions.append(cancel,add);dialog.append(heading,hint,canvas,dimensions,options,warning,actions);document.body.append(dialog);dialog.showModal();paint();
}
