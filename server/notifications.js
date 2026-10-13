export function receiveNotification(previous,data,now=Date.now()){
 if(!data||typeof data!=='object'||typeof data.text!=='string'||!data.text.trim()||data.text.length>256)throw new Error('通知文字需要 1–256 个字符');
 const channel=data.channel??'general',title=data.title??'通知',ttl=data.ttlSeconds??60;
 if(typeof channel!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(channel))throw new Error('通知频道需要英文小写、数字或连字符');
 if(typeof title!=='string'||title.length>64||!Number.isInteger(ttl)||ttl<5||ttl>86400)throw new Error('标题最多64字符，通知有效期为5–86400秒');
 const channels={...(previous?.channels||{})};
 for(const key of Object.keys(channels))if(channels[key].expiresAt<=now)delete channels[key];
 if(!Object.hasOwn(channels,channel)&&Object.keys(channels).length>=8)throw new Error('最多保留8个通知频道');
 const message={channel,title,text:data.text,receivedAt:now,expiresAt:now+ttl*1000};channels[channel]=message;
 return {channels,message};
}
