# 原版 PixelBar 适配器

适配范围：VID2D99 / PIDA160，PrimaryUsagePageFF13，output report64字节。匹配厂商控制接口，不操作音频或消费控制接口。设备被TempoHub独占时返回busy/permission错误，不强制结束它。

## HID报文

- 输出 `[2E,AA,type,cmd,lenHi,lenLo,payload...,checksum,padding]`，reportID2E，总64字节。
- 输入 `[2F,BB,EC/ED,cmd,lenHi,lenLo,payload...,checksum,padding]`。
- checksum：从AA/BB开始至payload末尾的所有字节之和mod256，不包括reportID。
- 本机验证：图片传输typeEC，屏幕及灯光查询/设置typeED。

## 像素帧

256×32单色，1024字节，索引 `(y>>3)*256+x`，位 `1<<(y&7)`。

设备文件是 **1064字节**：将raw1024切为8段，每段128字节，前缀 `[03,00,segmentIndex,FF,FF]`。五字节头不是像素；不要当成264列图像或单个八字节文件头。

上传cmd17：通知 `[0,0,sizeBE32]`；ready `[0,1,chunkSizeBE16]`（本机50）；chunk `[0,2,indexBE16,data]`；ack `[0,3,currentIndexBE16]` 确认的是当前块而非下一块。末段收到 `[0,5]`即确认完成；只有需要时才发送结束 `[0,4]`。

## 屏幕

EE空payload读回12字节。EF场景写九字节 `[1,R,G,B,group,mode,opt0,opt1,opt2]`；其中RGB不负责改色。屏幕改色必须独立使用EF `[3,R,G,B]`。上传后选 `[group=0,mode=1,opt0=3,opt1=4]`，保留颜色及相关设备参数，并用EE读回确认。此实现占用场景3/模板4，不修改TempoHub本地原始图片。

颜色是屏幕整体RGB色调；单色像素不具备逐像素RGB。这不是全彩矩阵屏。

## 机身灯光

6A查询；本机返回数组0x20，payload `[array,currentIndex,(index,R,G,B,brightness,speed)*]`。6B设置 `[array,index,R,G,B,brightness,speed]`。设备实际读回后确认，且硬件操作串行执行。

本机数组0x20：1呼吸（自定义RGB，速率1–10）；2潮汐（速率1–10）；3纯色（自定义RGB，速率FF）；4彩色波纹；5光影；6动态光影；7为总灯光开关，其RGB位置存的是 `[0,0,on]`，亮度/速度FF，**不是普通颜色**。2/4/5/6可选择并调亮度，但保留其预设字段，不把它们暴露为任意RGB。亮度本机范围10–100，界面步进10。关灯时currentIndex会返回7。

改色保持未请求修改的模式和速率；开关独立写入第7项。每次屏幕推送保留屏幕色调，不写机身灯光设置。协议来自本机互操作验证；不承诺所有固件或其他产品兼容。公开代码独立编写，不包含厂商软件提取物。
