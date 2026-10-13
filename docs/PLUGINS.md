# 元素插件与数据来源 v1

## 元素插件

开发源码时在 `web/plugins/` 增加一个 `.js` ES module。App 使用者则在菜单栏打开扩展目录，放入 `plugins/my-value.mjs`。重启服务后自动发现；左侧出现插件，可直接拖入画布。

```js
export const manifest = {
  id: 'my-value', name: '我的数据', description: '读取自定义数据来源',
  width: 64, height: 12,
  schema: [{name:'label',label:'标题',type:'text',default:'VALUE'}]
};
export function render(ctx, element, data) {
  const {x,y,width,height,props} = element;
  const source = data.providers?.['my-source'];
  const value = source?.status === 'live' ? source.value.count : '--';
  ctx.text(props.label, x, y);
  ctx.text(String(value), x, y + 7);
}
```

`id` 应唯一，使用小写字母、数字和短横线，勿覆盖内置元素。属性 schema 支持 `text`、`number`、`boolean`（参见内置 manifest），元素始终带 `id/type/x/y/width/height/props`。用户尺寸在画布范围内规范化。渲染按图层顺序执行，并裁剪至元素区域。

`PixelContext` 是确定性的单色点阵上下文，不是浏览器 Canvas：

- `pixel(x,y,on=1)`、`fillRect(x,y,w,h,on=1)`、`clearRect(...)`、`strokeRect(...)`。
- `text(value,x,y,scale=1,on=1)`：3×5 内置点阵，4像素字距，不支持中文字体。
- `line(x0,y0,x1,y1,on=1)`、`fillStyle`（建议只用0/1）。

坐标是画布绝对坐标。`data` 包含 `now`（毫秒）、`quota`（窗口或null）、`providers`。不要依赖 DOM、网络、浏览器专用 API；网络采集放 Provider 中，才能在网页关闭后运行。保持 render 同步、轻量，不修改 scene。当前受信任模块无沙箱或CPU隔离，插件抛错会中止当前帧并在服务显示错误。

参考 `web/plugins/example.js` 与 `data-value.js`。暂不支持外部插件相对文件依赖自动映射；单文件插件可通过绝对 `/core/...` 导入共享模块。用户JSON只能配置元素，不能上传或执行脚本。

## 数据 Provider

源码 `providers/*.js` / App扩展 `extensions/providers/*.mjs`：

```js
export const id = 'my-source';
export const enabled = true;
export async function collect({now,signal}) {
  const response = await fetch('http://127.0.0.1:8080/status', {signal});
  if (!response.ok) throw new Error('Local source unavailable');
  const result = await response.json();
  return {count: result.count};
}
```

采集间隔15s，单次超时5s、JSON ≤16KB。模块需要遵守 AbortSignal。失败保留旧值并标记 `stale`；不生成虚假值。`data.providers[id]` = `{value,updatedAt,status}`。

采集上下文还提供只读场景副本 `scene`，可根据组件属性选择采集账号，参考 `providers/bilibili.js`（内部额外做60秒缓存）。动态中文可使用 `web/core/dynamic-text.js` 的 `drawDynamicText`，网页和后台均加载同一字库；通知插件是现成示例。

Provider在本机 Node 进程中运行，权限等同伴侣用户。不要返回token、cookies、文件路径或其他隐私；返回值会通过本地API提供给网页。暂不支持在线插件商店或不可信第三方代码隔离。

## 素材框与内容测量

通用属性 `props.frameEnabled` 控制屏幕像素边框，`props.autoFit` 控制自动适配，均默认关闭。编辑器辅助范围框不会导出。边框启用时插件收到的元素坐标与尺寸已内缩2px，无需自行重复留白。

插件可额外导出 `measure(element, data)`，返回原生内容 `{width,height}`（不含通用边框）。网页与后台都调用同一函数；它应是无网络、无状态修改的纯函数。参考 B站插件的三档图标。没有 measure 的第三方插件仍可使用框适配按钮，采用当前绘图宽度下的像素范围估测；布局型图形保留绘图区域。

## 外部应用推送接口

无需 Provider 模块也可通过 `PUT /api/data` 推送 `{id:'my-source',value:{count:42}}`。数据元素选 `providerId=my-source`、`field=count` 即可显示。外部推送只在内存保存，建议外部应用定时发送。具体会话保护与接口见 API 文档。
# 添加前配置预览

工具箱点击/拖入使用统一独立预览窗，从插件schema默认值创建临时元素，默认 `props.autoFit=true`；旧场景没有该字段时不自动迁移。schema中的文本/多行/数值/布尔/选项均可配置，使用共享renderer与measure绘制本组件，不加入现有场景；只有确认添加才生成一个可撤销的新图层。取消不调用场景保存、设备上传或数据Provider网络采集。

没有空位时显示碰撞提示，按钮明确标注“确认添加（存在重叠）”。预览坐标固定原点便于查看样式，最终放置坐标通过 X/Y 指定；自动适配开启时框宽/高只读，关闭后可手调。用户仍需保存场景才能供后台自动推送使用。
