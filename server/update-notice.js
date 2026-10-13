export const DEFAULT_UPDATE_NOTICE='屏幕更新中';
export function validateUpdateNotice(value){
  if(typeof value!=='string')throw new Error('更新提示必须是文字');
  const text=value;
  if(!text.trim()||/[\p{Cc}]/u.test(text))throw new Error('请填写单行文字，不支持控制字符');
  if(Buffer.byteLength(text,'utf8')>255)throw new Error('文字超过设备协议的255字节上限，不会自动截断');
  return text;
}
