// Original local defaults. Overrides are scene-owned, fixed-size binary pixels.
export const iconSizes=Object.freeze({small:{width:7,height:7,label:'小号'},medium:{width:12,height:11,label:'中号'},large:{width:18,height:16,label:'大号'}});
const defaults={
 small:['0100010','0010100','1111111','1000001','1010101','1000001','1111111'],
 medium:['001000001000','000100010000','011111111110','110000000011','100100001001','100100001001','100000000001','100001100001','110000000011','011111111110','001000001000'],
 large:['000100000000100000','000010000001000000','000001000010000000','011111111111111110','110000000000000011','100000000000000001','100011000001100001','100011000001100001','100000000000000001','100000100010000001','100000011100000001','100000000000000001','110000000000000011','011111111111111110','000100000000001000','001100000000001100']
};
export function validIconRows(rows,size){const spec=iconSizes[size];return !!spec&&Array.isArray(rows)&&rows.length===spec.height&&rows.every(row=>typeof row==='string'&&row.length===spec.width&&/^[01]+$/.test(row));}
export function getIconRows(size='medium',overrides={}){const key=Object.hasOwn(iconSizes,size)?size:'medium';return [...(Object.hasOwn(overrides||{},key)&&validIconRows(overrides[key],key)?overrides[key]:defaults[key])];}
export function defaultIconRows(size){return getIconRows(size);}
export function parseIconFile(value){if(!value||value.schemaVersion!==1||value.type!=='pixelbar-bilibili-icons'||!value.icons||typeof value.icons!=='object')throw Error('需要 PixelBar 小电视图标 JSON 文件');const result={};for(const size of Object.keys(iconSizes)){if(!Object.hasOwn(value.icons,size)||!validIconRows(value.icons[size],size))throw Error(iconSizes[size].label+'图标尺寸或点阵无效');result[size]=[...value.icons[size]];}return result;}
export function iconFile(icons){return {schemaVersion:1,type:'pixelbar-bilibili-icons',icons:parseIconFile({schemaVersion:1,type:'pixelbar-bilibili-icons',icons})};}
