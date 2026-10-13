import {validateUpdateNotice} from './update-notice.js';
export const DEFAULT_REMINDERS={version:1,rules:[
 {id:'five-before',enabled:false,window:'primary',trigger:'before',minutes:5,text:'5H即将重置'},
 {id:'five-reset',enabled:false,window:'primary',trigger:'reset',minutes:5,text:'5H配额已重置'},
 {id:'week-before',enabled:false,window:'secondary',trigger:'before',minutes:5,text:'WK即将重置'},
 {id:'week-reset',enabled:false,window:'secondary',trigger:'reset',minutes:5,text:'WK配额已重置'}
]};
export function validateReminders(value){
 if(value?.version!==1||!Array.isArray(value.rules)||value.rules.length>20)throw new Error('提醒规则需要v1格式，最多20条');
 const ids=new Set();return {version:1,rules:value.rules.map(r=>{
  if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(r.id)||ids.has(r.id)||typeof r.enabled!=='boolean'||!['primary','secondary'].includes(r.window)||!['before','reset'].includes(r.trigger)||!Number.isInteger(r.minutes)||r.minutes<1||r.minutes>10080)throw new Error('提醒配置无效：提前分钟数1–10080，ID须唯一');
  ids.add(r.id);return {id:r.id,enabled:r.enabled,window:r.window,trigger:r.trigger,minutes:r.minutes,text:validateUpdateNotice(r.text)};
 })};
}
export const emptyReminderRuntime=()=>({version:1,windows:{},sent:[],pending:[]});
export function normalizeReminderRuntime(value){
 if(value?.version!==1)return emptyReminderRuntime();const runtime=emptyReminderRuntime();
 for(const key of ['primary','secondary']){const resetAt=value.windows?.[key]?.resetAt;if(Number.isFinite(resetAt)&&resetAt>0)runtime.windows[key]={resetAt};}
 runtime.sent=Array.isArray(value.sent)?value.sent.filter(s=>typeof s?.key==='string'&&s.key.length<100&&Number.isFinite(s.at)).slice(-200):[];
 runtime.pending=Array.isArray(value.pending)?value.pending.filter(e=>typeof e?.id==='string'&&Number.isFinite(e.cycle)&&Number.isFinite(e.expiresAt)).slice(-40):[];
 return runtime;
}
const resetMillis=value=>{if(value==null)return null;const result=typeof value==='number'&&value<1e12?value*1000:new Date(value).getTime();return Number.isFinite(result)&&result>0?result:null;};
export function planReminders(config,previous,quota,now=Date.now()){
 const runtime=normalizeReminderRuntime(previous);
 if(quota?.status!=='live')return {runtime,events:[]};
 const sent=new Set(runtime.sent.map(s=>s.key)),candidates=[...runtime.pending];
 for(const rule of config.rules.filter(r=>r.enabled)){
  const current=resetMillis(quota[rule.window]?.resetsAt),old=runtime.windows[rule.window]?.resetAt;
  if(current==null)continue;
  if(rule.trigger==='before'&&current>now&&current-now<=rule.minutes*60000)candidates.push({id:rule.id,cycle:current,expiresAt:current});
  if(rule.trigger==='reset'&&old&&now>=old&&now-old<=15*60000)candidates.push({id:rule.id,cycle:old,expiresAt:old+15*60000});
 }
 const unique=new Map();for(const event of candidates){const rule=config.rules.find(r=>r.id===event.id&&r.enabled);const key=event.id+':'+event.cycle;if(rule&&quota[rule.window]&&event.expiresAt>=now&&!sent.has(key))unique.set(key,{...event,key,text:rule.text});}
 runtime.pending=[...unique.values()].map(({id,cycle,expiresAt})=>({id,cycle,expiresAt}));
 for(const key of ['primary','secondary']){const current=resetMillis(quota[key]?.resetsAt);if(current&&current>now)runtime.windows[key]={resetAt:current};}
 return {runtime,events:[...unique.values()]};
}
