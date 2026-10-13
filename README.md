# PixelBar Studio

独立、开放、local-first 的 PixelBar 像素屏编辑器。网页拖入元素，本地伴侣负责真实数据与 USB 推送。**这是一个新项目，不是 RF OLED 的移植或复刻。**

## 功能

- 独立“Codex 重置倒计时”组件，5H/WK任选，倒计时、日期、时间分别开关；不替代原额度组件字段。“设备与灯光”页支持后台条件提醒：重置前指定分钟数/重置时，规则默认关闭，静音推送，网页关闭仍运行。中文15字/大写英文32字提示限制已接入，混排按比例估算。见 [倒计时与提醒](docs/REMINDERS.md)。

- “设备与灯光”页提供当前画布与灯带示意预览，以及本地照片取色校准。发送RGB与外观估计分离，不改变硬件RGB；屏幕/机身样本独立，可停用、导入/导出。灯效仅示意，照片校准不是仪器测色。见 [颜色校准](docs/COLOR-CALIBRATION.md)。

- 新组件先进入独立配置预览窗，点击/拖入不立即修改画布；默认开启框自动适配内容。确认后才添加；取消不改变设计。自动寻找空位，找不到时提示重叠并要求明确确认叠放。图片可先导入预览再添加，B站图标也可在添加前编辑。
- Codex 组件提供 5H / WK 各自的重置倒计时、日期、时间六个独立开关，默认关闭；倒计时精确到分钟（`IN 2D03:04`），日期/时间采用本机时区。真实数据缺失显示 `--`，不替换成假的零。全部字段紧凑排版可占满32像素，另加边框时应减少字段或隐藏标题。

- 画布编辑 / 动画制作 / 设备灯光三个工作区；256×32 单色画布，实时预览、组件搜索、拖放、快捷对齐、图层排序、撤销/重做。
- 文字、矩形、时钟、真实 Codex 配额、进度条、图片阈值转换、趋势线、外部数据元素。
- JSON 场景导入/导出、本地保存、PNG 导出。离线中英文点阵字体切换（Fusion 10 / 12、Ark 12、紧凑英文 3×5），换行、整数放大、尺寸适应与缺字/裁切提示。字体来源和 OFL 许可见 [docs/FONTS.md](docs/FONTS.md)。
- 每 **15 秒**读取 Codex 配额。开启自动推送后，浏览器关闭仍会更新已保存场景；伴侣退出则停止。画面未变化时不重复传输。
- 屏幕整体 RGB 与机身 RGB 分别控制；亮度、灯光开关、六种灯效，支持自定义色的模式可改 RGB，呼吸/潮汐可调速率，应用后读回设备核验。
- 同一套 DOM-free 渲染器用于浏览器与后台；可信本地元素插件 / 数据 Provider 接口。
- 基础信息组件：填写 UID 显示完整 B站粉丝数（60秒缓存），其他 App 通过本机接口发送中文文字通知（频道、换行、有效期）。见 [docs/INFORMATION.md](docs/INFORMATION.md)。

## 直接使用 macOS App

打开 `dist/PixelBar Studio.app`，菜单栏会出现 `▦ PB` 并打开本地网页。先正常退出 TempoHub，避免它独占设备。App 不会强行结束其他程序，也不修改 TempoHub 文件。

编辑 → **保存场景** → **推送到设备**。确认显示后开启 **自动推送**。自动推送读取已保存版本；未保存的修改只在网页预览中。屏幕不滚动，显示固定点阵帧。

设备设置里的屏幕颜色和机身灯光互相独立；自动更新额度会保留设备的屏幕颜色，不改变机身灯效。

本地状态位于 `~/Library/Application Support/PixelBar Studio/`，不在源码中。App 为本机构建、临时签名，**未公证**；不要把这份构建当作已经完成公开发行验证的安装包。

## 从源码运行

要求 Node.js ≥20.11、macOS + Xcode Command Line Tools（Swift），以及已经安装并登录 ChatGPT/Codex 的本地 Codex CLI。网页预览 / 测试可跨平台，当前硬件适配器只实现 macOS。

```sh
npm run build:engine
npm start
```

打开 <http://127.0.0.1:4173/>。无 npm 依赖，不需要安装前端构建工具。

```sh
npm test
PIXELBAR_NODE_LICENSE=/absolute/path/to/matching-node-LICENSE npm run build:app
```

构建 App 会捆绑当前 Node 可执行文件；必须提供与该 Node 版本匹配的官方完整许可证。构建产物架构取决于构建机器；Swift 引擎 / 启动器当前按本机架构构建。公开发行需另做 universal 构建、Developer ID 签名、公证与硬件回归测试。

环境变量：`PIXELBAR_PORT`（默认4173）、`PIXELBAR_ENGINE`、`PIXELBAR_STATE_DIR`。HTTP 服务仅绑定 127.0.0.1，不开放局域网。

## 开发与接入

设备操作栏可展开「更新前提示文字」：编辑后点「保存提示」，下次手动、自动及动画推送共用该静音文字。独立保存为状态目录的 `update-notice.json`，不改画布；「填入默认文字」只填写，需再保存。中文/宽字符最多15字，大写英文最多32字，混排按比例估算；小写与数字暂沿用ASCII预算。不自动截断，空格保留，显示长度预算与字节计数；协议最多255字节，本机实际容量240字节仍由引擎检查。旧超长文本保持文件不变，但需缩短保存后才能推送。混排/留白仍可能触发固件滚动，请实屏确认。

| 目录 | 职责 |
| --- | --- |
| `web/` | 网页编辑器与共享像素渲染器 |
| `web/plugins/` | 元素插件；自动发现、拖入画布 |
| `providers/` | 可信本地数据采集模块 |
| `server/` | 本地 API、状态保存、15s 调度、串行 USB 作业 |
| `companion/` | macOS HID 与 Codex 额度引擎、菜单栏启动器 |
| `tests/` | 帧打包、裁剪、验证、API 安全与无浏览器后台测试 |

App 用户的插件放在状态目录下 `extensions/plugins/*.mjs`；数据来源放在 `extensions/providers/*.mjs`。菜单栏可打开目录。安装/更新后重启伴侣；不必修改已签名 App 包。**只安装可信代码。**

详见 [插件开发](docs/PLUGINS.md)、[本地接口](docs/API.md)、[设备协议](docs/PROTOCOL.md)、[安全边界](SECURITY.md)。

## 兼容范围与准确性

更新画布和自动推送共用静默更新：暂时关闭消息提示音，先通过原生新闻通道显示更新提示文字，等待约1.5秒后上传，最后恢复原提示音设置。原版设备已实屏验证新闻覆盖上传提示与消息静音；1.5秒等待下的视觉效果待实屏确认，新闻总驻留时间由固件控制。黑方块默认留白因触发滚动及切换乱码已撤回，文字采用固件默认位置。设置查询/静音确认失败会停止上传而非盲写；强制退出或断开USB不能保证设置恢复。详见 [原生文字通道](docs/NATIVE-TEXT-CHANNEL.md)。

目前适配并在本机验证的设备为 USB `VID 0x2D99 / PID 0xA160`、vendor usage page `0xFF13` 的原版 PixelBar；不是对所有型号或 PixelBar AI 的兼容承诺。只支持恰好一台匹配设备。

上传使用设备场景 **3 / 模板4**；会覆盖这个槽位的屏幕图片。其他设计文件、TempoHub 缓存与其他槽位不修改，可通过 TempoHub 重新选择/上传原图。当前未实现从硬件读取原始帧备份，请在首次推送前确认该槽位可用于自定义。

这里的“用量”是 **Codex 配额窗口已用比例**，不是所有 GPT / ChatGPT 消息用量、token总数或 API 账单。数据读取使用官方只读 [`account/rateLimits/read`](https://learn.chatgpt.com/docs/app-server)，优先选择 `rateLimitsByLimitId.codex`。登录过期、网络失败或窗口缺失会显示未知 / 过期，不使用模拟额度冒充真实值。5小时/周标签对应本机当前窗口，其他账户窗口应按实际返回时长理解。

MIT；独立社区项目，不隶属 EDIFIER 或 OpenAI。开源准备已包括源码、文档、测试与许可证，但尚未创建或发布远程仓库。

## English

PixelBar Studio is an independent local-first 256×32 pixel editor with a macOS companion. Drag element plugins onto the canvas, save a scene, and enable background USB updates. The browser and scheduler share one renderer. Codex quota is read through the local official app-server every 15 seconds; no credentials are sent to the webpage or included in releases. Screen tint and chassis lighting are controlled independently. See the documents above for the plugin SDK, local API, protocol, supported hardware and security limitations.
