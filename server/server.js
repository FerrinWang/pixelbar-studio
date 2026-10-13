import http from 'node:http';
import {readFile,writeFile,mkdir,rename,readdir,realpath} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {homedir,tmpdir} from 'node:os';
import {dirname,join,resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {renderFrame,renderPlayback,registerPlugin,defaultScene} from '../web/core/render.js';
import {validateScene} from './scene.js';
import {loadServerFonts} from './fonts.js';
import {receiveNotification} from './notifications.js';
import {DEFAULT_UPDATE_NOTICE,validateUpdateNotice} from './update-notice.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const WEB=join(ROOT,'web');
export const INTERVAL=15000;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
export function normalizeQuota(q) {
  if (!q || q.status==='error' || q.error) throw new Error(q?.error||'Codex 暂无可读取配额');
  const window=v=>{if(v==null)return null;if(!Number.isFinite(v.usedPercent)||v.usedPercent<0||v.usedPercent>100)throw new Error('配额数据无效');return {usedPercent:v.usedPercent,windowDurationMins:v.windowDurationMins??null,resetsAt:v.resetsAt??null};};
  const primary=window(q.primary),secondary=window(q.secondary);
  if(!primary&&!secondary)throw new Error('此账户没有 Codex 配额窗口');
  return {primary,secondary,updatedAt:Date.now(),status:'live'};
}
export function runEngine(engine,args,timeout=12000,onProgress=()=>{}) {
  return new Promise((resolveResult,reject)=>{
    const child=spawn(engine,args,{stdio:['ignore','pipe','pipe'],env:process.env});let out='',err='',pending='',ended=false;
    const finish=(error,result)=>{if(ended)return;ended=true;clearTimeout(timer);error?reject(error):resolveResult(result);};
    const timer=setTimeout(()=>{child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),500).unref();finish(new Error('本地连接超时，请确认 Codex 登录及设备连接'));},timeout);
    child.stdout.on('data',b=>{out+=b;if(out.length>65536){child.kill();finish(new Error('本地引擎响应过大'));}});
    child.stderr.on('data',b=>{if(err.length<4096)err+=b;pending+=b.toString();if(pending.length>16384)pending='';let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i);pending=pending.slice(i+1);try{const p=JSON.parse(line);if(p.event==='transfer-progress'&&Number.isInteger(p.completedBytes)&&Number.isInteger(p.totalBytes)&&p.completedBytes>=0&&p.completedBytes<=p.totalBytes&&p.totalBytes<=300000&&['uploading','verifying','done'].includes(p.phase))onProgress({completedBytes:p.completedBytes,totalBytes:p.totalBytes,phase:p.phase,updatedAt:Date.now()});}catch{}}});
    child.on('error',()=>finish(new Error('本地引擎尚未编译：请运行 npm run build:engine')));
    child.on('close',code=>{let result;try{result=JSON.parse(out.trim());}catch{finish(new Error(code===0?'本地引擎返回无效数据':'设备或 Codex 连接失败'));return;}if(code!==0||result.error){finish(new Error(result.error?.message||result.error||'本地引擎执行失败'));return;}finish(null,result);});
  });
}
export async function createStudio({port=Number(process.env.PIXELBAR_PORT||4173),stateDir=process.env.PIXELBAR_STATE_DIR||join(homedir(),'Library','Application Support','PixelBar Studio'),engine=process.env.PIXELBAR_ENGINE||join(ROOT,'companion','pixelbar-engine'),engineCall,interval=INTERVAL}={}) {
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('端口无效');
  await mkdir(stateDir,{recursive:true,mode:0o700});
  await loadServerFonts();
  let scene=structuredClone(defaultScene),autoPush=false;
  try{const state=JSON.parse(await readFile(join(stateDir,'studio.json'),'utf8'));scene=validateScene(state.scene);autoPush=state.autoPush===true;}catch(e){if(e.code!=='ENOENT')console.warn('Saved scene could not be loaded; preserving original file.');}
  let updateNotice=DEFAULT_UPDATE_NOTICE;
  let noticeSaveChain=Promise.resolve();
  try{updateNotice=validateUpdateNotice(JSON.parse(await readFile(join(stateDir,'update-notice.json'),'utf8')).text);}catch(e){if(e.code!=='ENOENT')console.warn('Invalid update notice; original file preserved.');}
  const rawCall=engineCall||((args,timeout)=>runEngine(engine,args,timeout,event=>{state.transfer=event;}));
  let hidChain=Promise.resolve();
  const call=(args,timeout)=>{if(args[0]==='quota')return rawCall(args,timeout);const command=['push','animation'].includes(args[0])?[...args,'--notice',updateNotice]:args;const task=hidChain.catch(()=>{}).then(()=>rawCall(command,timeout));hidChain=task;return task;};
  const state={quota:null,providers:{},providerErrors:{},device:{connected:false,busy:false},autoPush,lastPush:null,lastRefresh:null,error:null,quotaError:null,intervalMs:interval,version:'0.1.0',renderWarnings:[]};
  let refreshTask=null,pushTask=null,lastDigest=null,timer=null,stopped=false;
  const plugins=[];
  const providers=[];
  const externalFiles=new Map();
  const extensions=join(stateDir,'extensions');
  await mkdir(join(extensions,'plugins'),{recursive:true});await mkdir(join(extensions,'providers'),{recursive:true});
  for(const file of (await readdir(join(ROOT,'providers'))).filter(f=>/^[a-zA-Z0-9_-]+\.js$/.test(f)).sort()) {
    try{const mod=await import(pathToFileURL(join(ROOT,'providers',file)));if(mod.enabled===true&&/^[a-z][a-z0-9-]*$/.test(mod.id)&&typeof mod.collect==='function')providers.push(mod);}catch{state.renderWarnings.push('数据来源无法加载：'+file);}
  }
  for(const file of (await readdir(join(WEB,'plugins'))).filter(f=>/^[a-zA-Z0-9_-]+\.js$/.test(f)).sort()) {
    try{const mod=await import(pathToFileURL(join(WEB,'plugins',file)));const manifest=mod.manifest||mod.default?.manifest;registerPlugin(manifest,mod.render||mod.default?.render,mod.measure||mod.default?.measure);plugins.push({...manifest,module:'/plugins/'+file});}catch{state.renderWarnings.push('插件无法加载：'+file);}
  }
  for(const kind of ['plugins','providers'])for(const file of (await readdir(join(extensions,kind))).filter(f=>/^[a-zA-Z0-9_-]+\.m?js$/.test(f)).sort()) {
    try{const location=join(extensions,kind,file);const mod=await import(pathToFileURL(location));if(kind==='plugins'){const manifest=mod.manifest||mod.default?.manifest;registerPlugin(manifest,mod.render||mod.default?.render,mod.measure||mod.default?.measure);const path='/plugins/user-'+file.replace(/\.mjs$/,'.js');externalFiles.set(path,location);plugins.push({...manifest,module:path});}else if(mod.enabled===true&&/^[a-z][a-z0-9-]*$/.test(mod.id)&&typeof mod.collect==='function')providers.push(mod);}catch{state.renderWarnings.push('扩展无法加载：'+kind+'/'+file);}
  }
  const persist=async()=>{const temporary=join(stateDir,'studio.json.tmp');await writeFile(temporary,JSON.stringify({scene,autoPush},null,2),{mode:0o600});await rename(temporary,join(stateDir,'studio.json'));};
  let saveChain=Promise.resolve();
  const save=()=>{saveChain=saveChain.catch(()=>{}).then(persist);return saveChain;};
  const refresh=()=>{
    if(refreshTask)return refreshTask;
    refreshTask=(async()=>{
      const [quota,device]=await Promise.allSettled([call(['quota'],12000),call(['status'],5000)]);
      if(quota.status==='fulfilled'){try{state.quota=normalizeQuota(quota.value);state.quotaError=null;}catch(e){state.quotaError=e.message;if(state.quota)state.quota.status='stale';}}
      else{state.quotaError=quota.reason.message;if(state.quota)state.quota.status='stale';}
      if(device.status==='fulfilled'){state.device={connected:!!device.value.connected,busy:!!device.value.busy||!!pushTask};if(!state.device.connected)lastDigest=null;}else state.device={connected:false,busy:!!pushTask};
      state.lastRefresh=Date.now();return status();
    })().finally(()=>{refreshTask=null;});return refreshTask;
  };
  const status=()=>({...state,providers:Object.fromEntries(Object.entries(state.providers).map(([id,source])=>[id,{...source,status:source.status==='stale'||Date.now()-source.updatedAt>interval*3?'stale':'live'}])),autoPush,quota:state.quota?{...state.quota,status:state.quota.status==='stale'||Date.now()-state.quota.updatedAt>interval*3?'stale':'live'}:null,error:state.error||state.quotaError});
  const push=async(frame,force=false,animationDelay=null)=>{
    if(pushTask)throw new Error('设备正在推送，请稍后再试');
    if(!(frame instanceof Uint8Array)||frame.length!==(animationDelay===null?1024:2048)||animationDelay!==null&&animationDelay!==500)throw new Error('需要静态 1024 字节或冒号闪烁两帧');
    const digest=createHash('sha256').update(String(animationDelay)).update(frame).digest('hex');if(!force&&digest===lastDigest)return {ok:true,unchanged:true};
    pushTask=(async()=>{state.device.busy=true;const file=join(stateDir,'frame.bin');try{await writeFile(file,frame,{mode:0o600});const result=await call(animationDelay===null?['push',file]:['animation',file,String(animationDelay)],animationDelay===null?20000:120000);lastDigest=digest;state.lastPush=Date.now();state.error=null;state.device.connected=true;return {ok:true,lastPush:state.lastPush,result};}catch(e){state.error=e.message;throw e;}finally{state.device.busy=false;}})().finally(()=>{pushTask=null;});return pushTask;
  };
  let tickTask=null;
  let previewUIDs=[],previewExpiresAt=0;
  const collectProviders=async(retryFailed=false)=>{await Promise.all(providers.map(async provider=>{let timeout;const controller=new AbortController();try{const result=await Promise.race([provider.collect({now:Date.now(),scene:structuredClone(scene),previewUIDs:Date.now()<previewExpiresAt?[...previewUIDs]:[],retryFailed,signal:controller.signal}),new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(new Error('数据来源超时'));},5000);})]);const encoded=JSON.stringify(result);if(encoded.length>16384)throw new Error('数据来源超过 16 KB');state.providers[provider.id]={value:JSON.parse(encoded),updatedAt:Date.now(),status:'live'};delete state.providerErrors[provider.id];}catch(e){state.providerErrors[provider.id]=e.message;if(state.providers[provider.id])state.providers[provider.id].status='stale';}finally{clearTimeout(timeout);}}));};
  const tick=()=>{if(stopped)return Promise.resolve();if(tickTask)return tickTask;tickTask=(async()=>{await Promise.all([refresh(),collectProviders()]);if(autoPush&&!stopped){try{const snapshot=status();const playback=renderPlayback(scene,{quota:snapshot.quota,providers:snapshot.providers,now:Date.now()});await push(Buffer.concat(playback.frames),false,playback.delay);}catch(e){state.error=e.message;}}})().finally(()=>{tickTask=null;});return tickTask;};
  const token=randomBytes(32).toString('hex');
  const deviceSettings=async()=>{
    const current=await call(['settings'],5000);const array=current.lighting?.arrays?.find(a=>a.array===32);const group=array?.groups?.find(g=>g.index===array.currentIndex);const power=array?.groups?.find(g=>g.index===7);
    const color=rgb=>Array.isArray(rgb)&&rgb.length===3?'#'+rgb.map(v=>Number(v).toString(16).padStart(2,'0')).join(''):'#66afff';
    const supported=!!array&&!!group&&array.groups.some(g=>g.index===3)&&!!power;
    const names={1:'breathing',2:'tide',3:'solid',4:'rainbow',5:'shadow',6:'dynamic'};
    const active=group?.index===7?array.groups.find(g=>g.index===3):group;
    return {screen:{supported:true,color:current.screen.color.toLowerCase()},lighting:{supported,color:color(active?.rgb),brightness:active?.brightness??100,enabled:power?.rgb?.[2]===1,effect:names[active?.index]||'current',speed:active?.speed===255?8:active?.speed??8,effects:Object.values(names),currentIndex:array?.currentIndex},updatedAt:Date.now()};
  };
  let actualPort=port;
  const allowedHosts=()=>new Set(['127.0.0.1:'+actualPort,'localhost:'+actualPort]);
  const json=(res,code,value)=>{res.writeHead(code,{'Content-Type':MIME['.json']});res.end(JSON.stringify(value));};
  const body=async(req)=>{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw new Error('请求不得超过 2 MB');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new Error('无效 JSON');}};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if(!allowedHosts().has(req.headers.host)){json(res,403,{error:'仅允许本机访问'});return;}
    const origin=req.headers.origin;if(origin&&!['http://127.0.0.1:'+actualPort,'http://localhost:'+actualPort].includes(origin)){json(res,403,{error:'拒绝跨站请求'});return;}
    if(req.headers['sec-fetch-site']==='cross-site'){json(res,403,{error:'拒绝跨站访问'});return;}
    const url=new URL(req.url,'http://127.0.0.1:'+actualPort);const path=url.pathname;
    if(path.startsWith('/api/')){
      const cookies=req.headers.cookie||'';if(!cookies.split(';').some(c=>c.trim()==='pixelbar_session='+token)){json(res,403,{error:'请先打开本地编辑器建立会话'});return;}
      try{
        if(req.method==='GET'&&path==='/api/status'){json(res,200,status());return;}
        if(req.method==='GET'&&path==='/api/update-notice'){json(res,200,{text:updateNotice,maxBytes:255});return;}
        if(req.method==='PUT'&&path==='/api/update-notice'){
          const text=validateUpdateNotice((await body(req)).text);
          if(pushTask)throw new Error('正在推送，请完成后再修改更新提示');
          noticeSaveChain=noticeSaveChain.catch(()=>{}).then(async()=>{
            await writeFile(join(stateDir,'update-notice.json.tmp'),JSON.stringify({text}),{mode:0o600});
            await rename(join(stateDir,'update-notice.json.tmp'),join(stateDir,'update-notice.json'));
            updateNotice=text;
          });
          await noticeSaveChain;json(res,200,{ok:true,text});return;
        }
        if(req.method==='GET'&&path==='/api/scene'){json(res,200,scene);return;}
        if(req.method==='GET'&&path==='/api/plugins'){json(res,200,plugins);return;}
        if(req.method==='GET'&&path==='/api/device-settings'){json(res,200,await deviceSettings());return;}
        if(req.method==='PUT'&&path==='/api/device-settings'){
          const data=await body(req),checkColor=color=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color);
          if(data.screen&&!checkColor(data.screen.color))throw new Error('屏幕颜色格式无效');
          if(data.lighting&&(!checkColor(data.lighting.color)||!Number.isInteger(data.lighting.brightness)||data.lighting.brightness<10||data.lighting.brightness>100||typeof data.lighting.enabled!=='boolean'||!['solid','breathing','tide','rainbow','shadow','dynamic','current'].includes(data.lighting.effect)||(data.lighting.speed!==undefined&&(!Number.isInteger(data.lighting.speed)||data.lighting.speed<1||data.lighting.speed>10))))throw new Error('灯光设置无效：亮度 10–100，速率 1–10');
          if(data.screen)await call(['screen',data.screen.color],5000);
          if(data.lighting){const l=data.lighting;await call(['lighting',l.color,String(l.brightness),String(l.enabled),l.effect,...(l.speed===undefined?[]:[String(l.speed)])],7000);}
          json(res,200,{ok:true,settings:await deviceSettings()});return;
        }
        if(req.method==='PUT'&&path==='/api/scene'){const next=validateScene(await body(req));scene=next;await save();json(res,200,{ok:true});return;}
        if(req.method==='POST'&&path==='/api/auto'){const data=await body(req);if(typeof data.enabled!=='boolean')throw new Error('enabled 必须为布尔值');autoPush=data.enabled;state.autoPush=autoPush;await save();json(res,200,{ok:true,enabled:autoPush});if(autoPush)void tick();return;}
        if(req.method==='POST'&&path==='/api/refresh'){const data=await body(req);if(data.bilibiliUIDs!==undefined){if(!Array.isArray(data.bilibiliUIDs)||data.bilibiliUIDs.length>3||data.bilibiliUIDs.some(uid=>typeof uid!=='string'||!/^[1-9]\d{0,19}$/.test(uid)))throw new Error('请填写有效的数字 UID，最多三个账号');previewUIDs=[...new Set(data.bilibiliUIDs)];previewExpiresAt=Date.now()+120000;}await Promise.all([refresh(),collectProviders(true)]);json(res,200,status());return;}
        if(req.method==='POST'&&path==='/api/notifications'){const data=await body(req),received=receiveNotification(state.providers.notifications?.value,data);state.providers.notifications={value:{channels:received.channels},updatedAt:Date.now(),status:'live'};json(res,200,{ok:true,channel:received.message.channel,expiresAt:received.message.expiresAt,screenPush:autoPush?'automatic':'manual'});if(autoPush)void tick();return;}
        if(req.method==='PUT'&&path==='/api/data'){const data=await body(req);if(typeof data.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(data.id)||JSON.stringify(data.value).length>16384)throw new Error('数据来源格式无效');if(!Object.hasOwn(state.providers,data.id)&&Object.keys(state.providers).length>=64)throw new Error('最多 64 个外部数据来源');state.providers[data.id]={value:data.value,updatedAt:Date.now(),status:'live'};json(res,200,{ok:true});return;}
        if(req.method==='POST'&&path==='/api/animation'){
          const data=await body(req);
          if(!Array.isArray(data.frames)||data.frames.length<2||data.frames.length>60||!Number.isInteger(data.delay)||data.delay<100||data.delay>60000)throw new Error('动画需要 2–60 帧，间隔字段 100–60000');
          const frames=data.frames.map(value=>{if(typeof value!=='string'||value.length!==1368||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw new Error('动画帧无效');const frame=Buffer.from(value,'base64');if(frame.length!==1024)throw new Error('动画帧必须为 1024 字节');return frame;});
          if(pushTask)throw new Error('设备正在推送，请稍后再试');
          const previousAuto=autoPush;autoPush=false;
          pushTask=(async()=>{state.device.busy=true;try{await save();if(tickTask)await tickTask;const file=join(stateDir,'animation.bin');await writeFile(file,Buffer.concat(frames),{mode:0o600});const result=await call(['animation',file,String(data.delay)],120000);lastDigest=null;state.lastPush=Date.now();state.error=null;return {ok:true,result,autoPush:false,lastPush:state.lastPush};}catch(e){autoPush=previousAuto;await save();state.error=e.message;throw e;}finally{state.device.busy=false;}})().finally(()=>{pushTask=null;});
          json(res,200,await pushTask);return;
        }
        if(req.method==='POST'&&path==='/api/frame'){const data=await body(req);if(typeof data.pixels!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.pixels)||data.pixels.length!==1368)throw new Error('无效像素帧');const frame=Buffer.from(data.pixels,'base64');json(res,200,await push(frame,true));return;}
        json(res,404,{error:'未知接口'});
      }catch(e){json(res,400,{error:e.message});}return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:'Method not allowed'});return;}
    try{
      if(externalFiles.has(path)){const content=await readFile(externalFiles.get(path));res.writeHead(200,{'Content-Type':MIME['.js']});res.end(req.method==='HEAD'?undefined:content);return;}
      const file=resolve(WEB,'.'+decodeURIComponent(path==='/'?'/index.html':path));const canonical=await realpath(file);
      if(!canonical.startsWith(WEB+sep))throw new Error('Forbidden');
      const content=await readFile(canonical);if(path==='/'||path==='/index.html')res.setHeader('Set-Cookie',`pixelbar_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
      res.writeHead(200,{'Content-Type':MIME[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:content);
    }catch{json(res,404,{error:'Not found'});}
  });
  server.requestTimeout=25000;server.headersTimeout=10000;
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});actualPort=server.address().port;
  timer=setInterval(()=>void tick().catch(e=>{state.error=e.message;}),interval);timer.unref();void tick();
  return {server,port:actualPort,status,refresh,push,tick,close:async()=>{stopped=true;clearInterval(timer);await new Promise(ok=>server.close(ok));await Promise.allSettled([refreshTask,pushTask,tickTask,saveChain,hidChain].filter(Boolean));}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const app=await createStudio();console.log(`PixelBar Studio ready: http://127.0.0.1:${app.port}`);
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
}
