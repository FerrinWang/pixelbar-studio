import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const architecture=process.arch==='arm64'?'arm64':'x86_64';
const result=spawnSync('swiftc',['-target',architecture+'-apple-macosx13.0','-module-cache-path',join(root,'.build-cache'),'-O',join(root,'companion/Engine.swift'),'-o',join(root,'companion/pixelbar-engine'),'-framework','IOKit','-framework','Foundation'],{cwd:root,stdio:'inherit'});
process.exit(result.status??1);
