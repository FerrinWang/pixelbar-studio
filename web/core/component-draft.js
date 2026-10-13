export function newComponentDraft(manifest,schema,x=0,y=0){
  const props={};for(const p of schema)if(p.default!==undefined)props[p.name||p.key]=structuredClone(p.default);
  props.autoFit=true;
  return {id:crypto.randomUUID(),type:manifest.id,x,y,width:manifest.width||manifest.defaultWidth||48,height:manifest.height||manifest.defaultHeight||16,props};
}
export function overlaps(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
export function freePlacement(element,elements){
  for(let y=0;y<=32-element.height;y++)for(let x=0;x<=256-element.width;x++){
    const placed={...element,x,y};if(!elements.some(other=>overlaps(placed,other)))return {x,y};
  }
  return null;
}
