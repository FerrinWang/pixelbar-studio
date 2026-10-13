import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),work=resolve(process.argv[2]||resolve(root,'../../work'));
const sources=[
 ['fusion12','fusion12-proxy.zip','fusion-pixel-12px-monospaced-zh_hans.bdf','d75f5262f108757edb0f47ee8e3d2dfdfbecfd94558faf5ffb0c06dc5866fb3b'],
 ['fusion10','fusion10-proxy.zip','fusion-pixel-10px-monospaced-zh_hans.bdf','4e0f328f55e07a971dee491cadb5472fa71587d29c33042f799fa209ebe53e2a'],
 ['ark12','ark12-proxy.zip','ark-pixel-12px-monospaced-zh_hans.bdf','0caf9f3e14ef06aaaba10b856fc614357d857b44c6d4d210c1ff24023e4b72fa']
];
const directory=join(root,'web/fonts');await mkdir(directory,{recursive:true});
function extract(archive,name){const r=spawnSync('unzip',['-p',archive,name],{maxBuffer:20e6});if(r.status!==0)throw new Error('Cannot extract '+name);return r.stdout;}
for(const [id,file,name,sha] of sources){
 const archive=join(work,file);if(createHash('sha256').update(await readFile(archive)).digest('hex')!==sha)throw new Error('Archive checksum mismatch: '+id);
 const bdf=extract(archive,name).toString('utf8');const height=Number(bdf.match(/^PIXEL_SIZE (\d+)/m)[1]),ascent=Number(bdf.match(/^FONT_ASCENT (\d+)/m)[1]);
 const glyphs={};for(const block of bdf.split('STARTCHAR ').slice(1)){const encoding=Number(block.match(/^ENCODING (-?\d+)/m)?.[1]);if(!Number.isInteger(encoding)||encoding<0)continue;const advance=Number(block.match(/^DWIDTH (\d+)/m)?.[1]);const box=block.match(/^BBX (\d+) (\d+) (-?\d+) (-?\d+)/m).slice(1).map(Number);const [width,h]=box;const bitmap=block.split('BITMAP\n')[1].split('ENDCHAR')[0].trim().split('\n').filter(Boolean);if(bitmap.length!==h)throw new Error('Malformed glyph');const shift=Math.ceil(width/8)*8-width;const rows=bitmap.map(row=>parseInt(row,16)>>>shift);glyphs[encoding]=[advance,...box,...rows];}
 const result={id,height,ascent,version:'2026.09.25',glyphs};await writeFile(join(directory,id+'.json'),JSON.stringify(result));
 const licenses=spawnSync('unzip',['-Z1',archive],{encoding:'utf8'}).stdout.split('\n').filter(n=>n==='OFL.txt'||n.startsWith('LICENSES/'));
 for(const entry of licenses){if(entry.endsWith('/'))continue;const destination=join(directory,'licenses',id,entry);await mkdir(resolve(destination,'..'),{recursive:true});await writeFile(destination,extract(archive,entry));}
 console.log(JSON.stringify({id,glyphs:Object.keys(glyphs).length,height,ascent,bytes:JSON.stringify(result).length,archiveSHA256:sha}));
}
