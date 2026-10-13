// Local integration example. The companion must already be running.
const args=process.argv.slice(2),options={channel:'general',title:'通知',ttlSeconds:60};let text;
for(let i=0;i<args.length;i++){
 if(args[i]==='--channel')options.channel=args[++i];
 else if(args[i]==='--title')options.title=args[++i];
 else if(args[i]==='--ttl')options.ttlSeconds=Number(args[++i]);
 else if(args[i].startsWith('--'))throw new Error('未知参数：'+args[i]);
 else if(text===undefined)text=args[i];else throw new Error('通知文字请用引号包裹');
}
if(!text)throw new Error('用法：node scripts/notify.mjs --channel general --title 标题 "通知文字"');
const base='http://127.0.0.1:'+Number(process.env.PIXELBAR_PORT||4173),first=await fetch(base+'/',{signal:AbortSignal.timeout(8000)});
const cookie=first.headers.get('set-cookie')?.split(';')[0];if(!first.ok||!cookie)throw new Error('无法建立本地伴侣会话');
const response=await fetch(base+'/api/notifications',{method:'POST',signal:AbortSignal.timeout(8000),headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({...options,text})});
const result=await response.json();if(!response.ok)throw new Error(result.error||'通知接入失败');console.log(JSON.stringify(result));
