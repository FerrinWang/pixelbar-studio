export const WIDTH = 256;
export const HEIGHT = 32;
export function validateScene(value) {
  if (!value || value.schemaVersion !== 1 || value.width !== WIDTH || value.height !== HEIGHT || !Array.isArray(value.elements) || value.elements.length > 128) throw new Error('画布格式不正确：需要 v1 / 256×32，最多 128 个元素');
  const ids = new Set();
  for (const e of value.elements) {
    if (!e || typeof e.id !== 'string' || e.id.length > 128 || ids.has(e.id) || typeof e.type !== 'string' || !/^[a-z][a-z0-9-]*$/.test(e.type)) throw new Error('元素标识或类型无效');
    ids.add(e.id);
    for (const k of ['x','y','width','height']) if (!Number.isInteger(e[k])) throw new Error('元素坐标必须是有效整数');
    if (e.width < 1 || e.width > WIDTH || e.height < 1 || e.height > HEIGHT || e.x < 0 || e.y < 0 || e.x + e.width > WIDTH || e.y + e.height > HEIGHT || !e.props || typeof e.props !== 'object' || Array.isArray(e.props)) throw new Error('元素尺寸或属性无效');
  }
  return JSON.parse(JSON.stringify(value));
}
export function defaultScene() {
  return {schemaVersion:1,width:WIDTH,height:HEIGHT,elements:[
    {id:'heading',type:'text',x:3,y:3,width:76,height:9,props:{text:'CODEX',scale:1}},
    {id:'five-hour',type:'codex-quota',x:84,y:2,width:169,height:13,props:{window:'primary',label:'5H',showBar:true}},
    {id:'weekly',type:'codex-quota',x:84,y:18,width:169,height:13,props:{window:'secondary',label:'WK',showBar:true}}
  ]};
}
