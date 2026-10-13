# 本地 HTTP API v1

默认 `http://127.0.0.1:4173`，只监听loopback。先 GET `/` 获取HttpOnly/SameSite=Strict会话cookie，后续请求携带cookie。浏览器自动处理。非浏览器集成可使用：

```sh
curl -c /tmp/pixelbar-cookie http://127.0.0.1:4173/ -o /dev/null
curl -b /tmp/pixelbar-cookie -H 'Content-Type: application/json' \
  -X PUT http://127.0.0.1:4173/api/data \
  -d '{"id":"my-source","value":{"count":42}}'
```

cookie仅本机集成使用，勿发布。服务重启会失效。拒绝外部Host、非同源Origin、cross-site Fetch Metadata。未提供CORS。

| 方法 / 路径 | 请求 / 响应 |
| --- | --- |
| GET `/api/status` | quota、providers、device、autoPush、lastPush、lastRefresh、error、intervalMs |
| GET `/api/scene` | 已保存场景JSON |
| PUT `/api/scene` | 完整v1场景，持久保存 |
| GET `/api/plugins` | 本地插件manifest列表与module URL |
| POST `/api/refresh` | `{}`；立即采集Codex / 设备状态 / 信息来源。可传 `{ "bilibiliUIDs": ["163637592"] }` 读取未保存 UID，最多三个；仅临时预览两分钟，不保存场景、不触发推送 |
| POST `/api/auto` | `{enabled:boolean}`；持久保存，启用后立即执行一轮 |
| POST `/api/frame` | `{pixels:base64}`；立即推送1024字节，非保存操作 |
| GET `/api/device-settings` | 读回屏幕颜色、机身灯光、支持能力 |
| PUT `/api/device-settings` | 可选screen `{color:'#RRGGBB'}`、lighting `{color,brightness:10..100,enabled,effect,speed?:1..10}` |
| PUT `/api/data` | `{id,value}`，外部数据JSON ≤16KB |
| POST `/api/notifications` | `{channel?:'general',title?:string,text,ttlSeconds?:60}`；仅接收，不表示硬件上传完成 |

场景 `{schemaVersion:1,width:256,height:32,elements:[{id,type,x,y,width,height,props}]}`；最多128个元素，请求总长度≤2MB。

灯效 `solid/breathing/tide/rainbow/shadow/dynamic/current`；只有solid/breathing自定义RGB，其他模式保留原参数。速率只对breathing/tide生效。外部Provider超过三个采集周期未更新会标记stale。

时间 `updatedAt/lastPush/lastRefresh` 为 Unix **毫秒**；额度窗口 `resetsAt` 是上游 Unix **秒**。`quota.status` 标识live/stale，null表示尚无数据，缺失窗口仍为null。

设备设置应用为两个独立硬件操作，并非跨屏幕/灯光事务；若第二项失败，第一项可能已经生效，UI错误会提示重新读取。不要假设4xx意味着硬件完全未改变。

失败HTTP4xx JSON `{error:string}`。当前API用于本机可信集成，不提供远程账户或共享服务。

通知频道最多8个，正文1–256字符，标题≤64字符，有效期5–86400秒。收到后根据全局自动推送设置决定是否更新已保存画布；手动模式不触发硬件上传。只存内存，重启清空。集成脚本与组件使用方法见 INFORMATION.md。
# 更新前提示文字

`GET /api/update-notice` 返回 `{text,maxBytes:255,maxChinese:15,maxEnglish:32,warning}`；`PUT /api/update-notice` 接收 `{text:"屏幕更新中"}`，成功返回 `{ok:true,text}`。使用相同会话与来源检查，保存不立即发送、不改场景/自动推送；推送中拒绝修改。中文/非ASCII最多15字、ASCII最多32字，混排按比例估算（ASCII×15＋非ASCII×32≤480），大写上限已实测，其他ASCII沿用预算。空白、控制字符与超过255 UTF-8字节拒绝；不截断，保留空格。引擎额外检查E7实际容量（本机240字节）。旧超长保存值可读出但不能再推送，需手动缩短保存。

更新提示存储在独立 `update-notice.json`，旧版状态默认提示为「屏幕更新中」。正式引擎 `push` / `animation` 支持可选尾部参数 `--notice <text>`，通过独立进程参数传递，不执行shell、不接触账户凭据。长文本多包发送与居中/滚动行为仍需实屏测试。

条件提醒API `GET/PUT /api/reminders`、`POST /api/reminders/test` 及持久化/去重约定见 [REMINDERS.md](REMINDERS.md)。测试推送会真实操作设备并同步已保存画布，不等同于仅接收文字通知的接口。

