// Empirical single-line budget: 15 wide characters or 32 ASCII characters.
// Mixed text uses a conservative proportional estimate, not firmware font metrics.
export function noticeMetrics(text){
 const characters=[...String(text)],ascii=characters.filter(c=>c.codePointAt(0)<=127).length,wide=characters.length-ascii;
 return {ascii,wide,characters:characters.length,units:ascii*15+wide*32,maxUnits:480,bytes:new TextEncoder().encode(String(text)).length};
}
export function noticeError(text){
 if(typeof text!=='string'||!text.trim()||/[\p{Cc}]/u.test(text))return '请填写单行文字，不支持控制字符';
 const m=noticeMetrics(text);
 if(m.bytes>255)return '文字超过设备协议的255字节上限，不会自动截断';
 if(m.units>480)return '提示过长：中文最多15字，大写英文最多32字；混排按比例估算，不会自动截断';
 return '';
}
