import {readFile} from 'node:fs/promises';
import {bitmapFonts,registerBitmapFont} from '../web/core/bitmap-fonts.js';
let ready;
export function loadServerFonts(){return ready??=Promise.all(bitmapFonts.map(async font=>registerBitmapFont(JSON.parse(await readFile(new URL('../web/fonts/'+font.id+'.json',import.meta.url),'utf8')))));}
