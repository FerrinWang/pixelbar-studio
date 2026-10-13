import {iconSizes,getIconRows,defaultIconRows,parseIconFile,iconFile} from './core/bilibili-icons.js';
import {PixelContext} from './core/render.js';
import {drawTV} from './plugins/bilibili-fans.js';

export function openIconEditor({overrides={},size='medium',onApply}){
 if(document.querySelector('.icon-editor'))return;
 const keys=Object.keys(iconSizes),working=Object.fromEntries(keys.map(key=>[key,getIconRows(key,overrides)])),initial=JSON.stringify(working),history=[];
 let selected=keys.includes(size)?size:'medium',tool='draw',stroke=false,strokeSaved=false;
 const dialog=document.createElement('dialog');dialog.className='icon-editor';dialog.setAttribute('aria-labelledby','icon-editor-title');
 const make=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
 const button=(text,fn)=>{const b=make('button',text);b.type='button';b.onclick=fn;return b;};
 const header=make('header'),title=make('h2','编辑小电视图标');title.id='icon-editor-title';header.append(title,button('取消',()=>dialog.close()));
 const help=make('p','三档独立编辑 · 拖动绘制，选择擦除删除像素。仅修改当前组件；点击应用后还需保存场景。','muted');
 const tabs=make('div',null,'icon-size-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','编辑图标尺寸');const tabButtons={};
 for(const key of keys){const spec=iconSizes[key];tabButtons[key]=button(`${spec.label} · ${spec.width}×${spec.height}`,()=>{selected=key;stroke=false;redraw(true);});tabs.append(tabButtons[key]);}
 const toolbar=make('div',null,'icon-editor-toolbar'),draw=button('画笔',()=>{tool='draw';redraw();}),erase=button('擦除',()=>{tool='erase';redraw();}),undo=button('撤销',()=>{if(history.length){Object.assign(working,history.pop());stroke=false;redraw(true);}});
 const saveUndo=()=>{history.push(structuredClone(working));if(history.length>80)history.shift();};
 const replace=(rows)=>{if(JSON.stringify(rows)===JSON.stringify(working[selected]))return;saveUndo();working[selected]=rows;redraw(true);};
 toolbar.append(draw,erase,undo,button('清空本档',()=>replace(Array(iconSizes[selected].height).fill('0'.repeat(iconSizes[selected].width)))),button('恢复本档默认',()=>replace(defaultIconRows(selected))));
 const body=make('div',null,'icon-editor-body'),drawing=make('section'),caption=make('p',null,'icon-grid-caption'),grid=make('div',null,'icon-pixel-grid');grid.setAttribute('aria-label','图标像素网格');
 drawing.append(caption,grid);
 const previews=make('section',null,'icon-previews');previews.append(make('h3','三档预览'),make('p','数字为固定排版示例，不是实时粉丝数。','muted'));const previewCanvases={};
 for(const key of keys){const block=make('div',null,'icon-preview-item'),label=make('span',iconSizes[key].label),canvas=make('canvas');canvas.setAttribute('aria-label',iconSizes[key].label+'图标预览');previewCanvases[key]=canvas;block.append(label,canvas);previews.append(block);}
 body.append(drawing,previews);
 const feedback=make('p','', 'icon-editor-feedback');feedback.setAttribute('role','status');
 const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
 file.onchange=async()=>{const f=file.files[0];if(!f)return;try{if(f.size>16384)throw Error('图标文件不得超过16KB');const imported=parseIconFile(JSON.parse(await f.text()));saveUndo();Object.assign(working,imported);redraw(true);feedback.textContent='三档图标已导入，应用后保存到场景。';}catch(error){feedback.textContent='导入失败：'+error.message;}finally{file.value='';}};
 const footer=make('footer'),io=make('div',null,'actions');
 io.append(button('导入图标 JSON',()=>file.click()),button('导出图标 JSON',()=>{const blob=new Blob([JSON.stringify(iconFile(working),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pixelbar-bilibili-icons.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback.textContent='已导出三档图标。';}));
 const apply=button('应用到当前组件',()=>{if(JSON.stringify(working)!==initial)onApply(structuredClone(working));dialog.close();});apply.className='primary';footer.append(io,apply);
 dialog.append(header,help,tabs,toolbar,body,feedback,file,footer);
 function paint(index,value){const {width}=iconSizes[selected],y=Math.floor(index/width),x=index%width,row=working[selected][y];if(!row||row[x]===String(value))return;if(!strokeSaved){saveUndo();strokeSaved=true;}working[selected][y]=row.slice(0,x)+value+row.slice(x+1);redraw();}
 function indexAt(event){const r=grid.getBoundingClientRect(),spec=iconSizes[selected],x=Math.floor((event.clientX-r.left)/r.width*spec.width),y=Math.floor((event.clientY-r.top)/r.height*spec.height);return x>=0&&y>=0&&x<spec.width&&y<spec.height?y*spec.width+x:-1;}
 grid.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();stroke=true;strokeSaved=false;grid.setPointerCapture(event.pointerId);const index=indexAt(event);if(index>=0)paint(index,tool==='draw'?1:0);};
 grid.onpointermove=event=>{if(!stroke)return;const index=indexAt(event);if(index>=0)paint(index,tool==='draw'?1:0);};
 grid.onpointerup=grid.onpointercancel=()=>{stroke=false;strokeSaved=false;};
 function redraw(rebuild=false){
  const spec=iconSizes[selected];caption.textContent=`${spec.label} · 原生 ${spec.width} × ${spec.height} 像素`;
  for(const key of keys)tabButtons[key].setAttribute('aria-pressed',String(selected===key));draw.setAttribute('aria-pressed',String(tool==='draw'));erase.setAttribute('aria-pressed',String(tool==='erase'));undo.disabled=!history.length;
  grid.style.setProperty('--icon-columns',spec.width);
  if(rebuild||grid.children.length!==spec.width*spec.height){grid.replaceChildren();for(let y=0;y<spec.height;y++)for(let x=0;x<spec.width;x++){const cell=make('button');cell.type='button';cell.setAttribute('aria-label',`像素 ${x+1},${y+1}`);cell.onclick=event=>{if(event.detail===0){strokeSaved=false;paint(y*spec.width+x,working[selected][y][x]==='1'?0:1);strokeSaved=false;}};grid.append(cell);}}
  for(let i=0;i<grid.children.length;i++){const on=working[selected][Math.floor(i/spec.width)][i%spec.width]==='1';grid.children[i].classList.toggle('on',on);grid.children[i].setAttribute('aria-pressed',String(on));}
  for(const key of keys){const s=iconSizes[key],scale={small:1,medium:2,large:3}[key],canvas=previewCanvases[key],w=s.width+3+31*scale,h=Math.max(s.height,5*scale),ctx=new PixelContext(w,h);drawTV(ctx,0,Math.floor((h-s.height)/2),key,working);ctx.text('13038226',s.width+3,Math.floor((h-5*scale)/2),scale);canvas.width=w;canvas.height=h;canvas.style.width=w*2+'px';const c=canvas.getContext('2d'),img=c.createImageData(w,h);for(let i=0;i<ctx.pixels.length;i++){const on=ctx.pixels[i];img.data.set(on?[102,233,224,255]:[9,19,21,255],i*4);}c.putImageData(img,0,0);}
 }
 dialog.addEventListener('keydown',event=>{event.stopPropagation();if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo.click();}});
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);redraw(true);dialog.showModal();
 return dialog;
}
