import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
// macOS's system curl respects the user's normal HTTPS proxy environment.
// No shell, no cookies, no certificate bypass, and no arbitrary destinations.
export async function fetchPublicJSON(url,{signal}={}){
 const parsed=new URL(url);
 if(parsed.origin!=='https://api.bilibili.com'||parsed.pathname!=='/x/relation/stat'||parsed.username||parsed.password)throw new Error('不允许的数据地址');
 try{const {stdout}=await execute(process.platform==='darwin'?'/usr/bin/curl':'curl',['--fail','--silent','--show-error','--max-time','4','--connect-timeout','3','--proto','=https',url],{signal,timeout:4500,maxBuffer:65536,encoding:'utf8'});const data=JSON.parse(stdout);return {ok:true,json:async()=>data};}
 catch(error){throw new Error(signal?.aborted||error.killed||error.code===28?'B站统计请求超时，请稍后重试':'无法读取B站公开统计，请检查网络或稍后重试');}
}
