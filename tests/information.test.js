import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollector} from '../providers/bilibili.js';
import {receiveNotification} from '../server/notifications.js';
import {loadServerFonts} from '../server/fonts.js';
import {wrapBitmapText,rasterizeText} from '../web/core/bitmap-fonts.js';
import {PixelContext} from '../web/core/render.js';
import {render as renderFans,followerText,drawTV} from '../web/plugins/bilibili-fans.js';
import {render as renderNotification} from '../web/plugins/notification.js';
await loadServerFonts();
test('Bilibili public collector caches for 60s and preserves last count on failure',async()=>{
 let calls=0,fail=false;const collect=createCollector(async url=>{calls++;assert.equal(url,'https://api.bilibili.com/x/relation/stat?vmid=163637592');if(fail)throw Error('offline');return {ok:true,json:async()=>({code:0,data:{follower:13038226}})};});
 assert.deepEqual((await collect({scene:{elements:[]},now:0})).accounts,{});assert.equal(calls,0);
 const scene={elements:[{type:'bilibili-fans',props:{uid:'163637592'}}]};
 let result=await collect({scene,now:1000});assert.equal(result.accounts['163637592'].follower,13038226);assert.equal(calls,1);
 await collect({scene,now:2000});assert.equal(calls,1);
 fail=true;result=await collect({scene,now:61000});assert.equal(calls,2);assert.equal(result.accounts['163637592'].status,'stale');assert.equal(result.accounts['163637592'].follower,13038226);
});
test('Seven and eight digit follower counts render completely; huge counts scale down',()=>{
 for(const value of [1000000,13038226,Number.MAX_SAFE_INTEGER]){
  const e={x:0,y:0,width:88,height:20,props:{uid:'163637592',scale:2,label:'BILI FANS'}},actual=new PixelContext(),expected=new PixelContext();actual.clip=e;
  renderFans(actual,e,{providers:{bilibili:{value:{accounts:{'163637592':{follower:value,status:'live'}}}}}});
  drawTV(expected,0,4);const scale=String(value).length<=9?2:1;expected.text(String(value),15,Math.floor((20-5*scale)/2),scale);assert.deepEqual(actual.pack(),expected.pack());assert.equal(followerText(value),String(value));
 }
 assert.equal(followerText(undefined),'--');assert.equal(followerText(0),'0');
});
test('Unsaved UID previews are collected; explicit failed retry respects a five second backoff',async()=>{
 let calls=0,fail=true;const collect=createCollector(async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>({code:0,data:{follower:13038227}})};});
 const scene={elements:[]},args={scene,previewUIDs:['163637592'],retryFailed:true};
 await collect({...args,now:1000});fail=false;await collect({...args,now:2000});assert.equal(calls,1);
 const result=await collect({...args,now:6000});assert.equal(calls,2);assert.equal(result.accounts['163637592'].follower,13038227);assert.deepEqual(scene,{elements:[]});
 await collect({...args,now:7000});assert.equal(calls,2);
});
test('Follower titles are hidden by default and can use editable Chinese text',()=>{
 const e={x:0,y:0,width:88,height:24,props:{uid:'1',label:'哔哩哔哩 fans',scale:2}},data={providers:{bilibili:{value:{accounts:{'1':{follower:13038227,status:'live'}}}}}},hidden=new PixelContext(),shown=new PixelContext();
 renderFans(hidden,e,data);renderFans(shown,{...e,props:{...e.props,showLabel:true}},data);assert.notDeepEqual(hidden.pack(),shown.pack());assert.ok(shown.pack().some(Boolean));
 const changed=new PixelContext();renderFans(changed,{...e,props:{...e.props,label:'自定义',showLabel:true}},data);assert.notDeepEqual(shown.pack(),changed.pack());
});
test('Notifications validate channel, TTL and size; expired channels are pruned',()=>{
 const received=receiveNotification(null,{text:'中文通知',ttlSeconds:5},1000);assert.equal(received.message.expiresAt,6000);
 assert.throws(()=>receiveNotification(null,{text:'x',channel:'../secret'}));assert.throws(()=>receiveNotification(null,{text:'x'.repeat(257)}));assert.throws(()=>receiveNotification(null,{text:'x',ttlSeconds:0}));
 const next=receiveNotification({channels:received.channels},{text:'new',channel:'build'},7000);assert.equal(next.channels.general,undefined);
});
test('Dynamic Chinese notification wraps and expires without scrolling',()=>{
 const wrapped=wrapBitmapText('中文通知内容很多，超过画布可显示长度以后应当省略','fusion10',40,2);assert.equal(wrapped.split('\n').length,2);assert.match(wrapped,/…$/);assert.equal(rasterizeText(wrapped,'fusion10',40,21).clipped,false);
 const e={x:0,y:0,width:128,height:32,props:{channel:'general',fontId:'fusion10',idleText:'等待消息'}},active=new PixelContext(),expired=new PixelContext(),idle=new PixelContext();
 renderNotification(active,e,{now:1000,providers:{notifications:{value:{channels:{general:{title:'通知',text:'你好，屏幕',expiresAt:6000}}}}}});
 renderNotification(expired,e,{now:7000,providers:{notifications:{value:{channels:{general:{title:'通知',text:'你好，屏幕',expiresAt:6000}}}}}});
 renderNotification(idle,e,{now:7000});assert.ok(active.pack().some(Boolean));assert.notDeepEqual(active.pack(),idle.pack());assert.deepEqual(expired.pack(),idle.pack());
});
