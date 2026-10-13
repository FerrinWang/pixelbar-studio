# 离线像素字体

字体选择位于文字元素右侧属性栏。Fusion 12、Fusion 10 和 Ark 12 同时支持中英文；原有紧凑英文 3×5 字体仍可选择。字体以原始 BDF 点阵渲染，不依赖系统字体、Canvas 字体基线或抗锯齿阈值。只使用 1–3 倍整数放大，显示所需尺寸、裁切和缺字提示；「适应文字尺寸」不会超出屏幕边界。

Ark 缺少的字优先使用同尺寸 Fusion 12 回退；双方都缺少的字符显示占位并提示缺字。不是所有 Unicode 字符都受支持。

旧场景中已经生成的文字点阵保持原样，主动选择新字体后迁移。文字修改提交后重新生成点阵，保存到场景中；后台和网页共用这些像素，不需要后台字体加载。动态数据中文字仍需插件生成点阵。

## 来源与许可

官方版本均为 `2026.09.25`，使用简体中文 monospaced BDF；Latin 字形亦包含在同一文件内。保留完整字库，不截取常用字。

- https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.09.25
- https://github.com/TakWolf/ark-pixel-font/releases/tag/2026.09.25

字体数据适用 SIL OFL 1.1，不适用应用 MIT 许可。原始版权及依赖许可在 `web/fonts/licenses/`，随源代码与 App 一起分发。

## 重建

下载以下官方发布文件到任意文件夹，并按本地文件名命名：

| 本地文件 | 官方发布文件 | SHA-256 |
| --- | --- | --- |
| fusion12-proxy.zip | fusion-pixel-font-12px-monospaced-bdf-v2026.09.25.zip | d75f5262f108757edb0f47ee8e3d2dfdfbecfd94558faf5ffb0c06dc5866fb3b |
| fusion10-proxy.zip | fusion-pixel-font-10px-monospaced-bdf-v2026.09.25.zip | 4e0f328f55e07a971dee491cadb5472fa71587d29c33042f799fa209ebe53e2a |
| ark12-proxy.zip | ark-pixel-font-12px-monospaced-bdf-v2026.09.25.zip | 0caf9f3e14ef06aaaba10b856fc614357d857b44c6d4d210c1ff24023e4b72fa |

运行 `node scripts/import-fonts.mjs /absolute/path/to/archives`；脚本先校验 SHA-256，再转换字形及复制上游许可。缺省路径为仓库上两级的 `work/`，仅用于本地开发。输出约 5.6 MB JSON，与设备传输大小无关：设备仍只接收 1024 字节单帧点阵。
