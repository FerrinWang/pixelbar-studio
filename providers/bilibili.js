// Public counts only. No login, cookies, follower lists or private messages.
import {fetchPublicJSON} from './public-json.js';
export const id='bilibili';
export const enabled=true;
export const MIN_INTERVAL=60000;
export function createCollector(fetcher=fetchPublicJSON){
 const cache=new Map();
 let pending=Promise.resolve();
 const run=async({scene,previewUIDs=[],retryFailed=false,now=Date.now(),signal})=>{
  const uids=[...new Set([...previewUIDs,...(scene?.elements||[]).filter(e=>e.type==='bilibili-fans').map(e=>String(e.props?.uid||'').trim())].filter(uid=>/^[1-9]\d{0,19}$/.test(uid)))].slice(0,3);
  const accounts={};
  await Promise.all(uids.map(async uid=>{
   let entry=cache.get(uid);
   if(!entry||now-entry.attemptedAt>=MIN_INTERVAL||(retryFailed&&entry.status!=='live'&&now-entry.attemptedAt>=5000)){
    try{
     const response=await fetcher('https://api.bilibili.com/x/relation/stat?vmid='+encodeURIComponent(uid),{signal,headers:{Accept:'application/json'}});
     if(!response.ok)throw new Error('B站返回 HTTP '+response.status);
     const data=await response.json();if(data.code!==0)throw new Error('B站暂不可读：'+String(data.message||data.code).slice(0,100));
     if(!Number.isSafeInteger(data.data?.follower)||data.data.follower<0)throw new Error('粉丝统计格式无效');
     entry={uid,follower:data.data.follower,updatedAt:now,attemptedAt:now,status:'live'};
    }catch(error){entry={...entry,uid,attemptedAt:now,status:entry?.follower!==undefined?'stale':'error',error:String(error.message).slice(0,160)};}
    cache.set(uid,entry);
   }
   accounts[uid]=entry;
  }));
  for(const [uid,entry] of cache)if(!uids.includes(uid)&&now-entry.attemptedAt>3600000)cache.delete(uid);
  while(cache.size>16)cache.delete(cache.keys().next().value);
  return {accounts,refreshIntervalMs:MIN_INTERVAL};
 };
 return args=>{const task=pending.catch(()=>{}).then(()=>run(args));pending=task;return task;};
}
export const collect=createCollector();
