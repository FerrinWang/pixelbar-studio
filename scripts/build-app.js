import {mkdir,copyFile,cp,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const app=join(root,'dist','PixelBar Studio.app'),contents=join(app,'Contents'),resources=join(contents,'Resources');
const target=(process.arch==='arm64'?'arm64':'x86_64')+'-apple-macosx13.0';
await mkdir(join(contents,'MacOS'),{recursive:true});await mkdir(join(resources,'runtime'),{recursive:true});
function run(cmd,args){const result=spawnSync(cmd,args,{cwd:root,stdio:'inherit'});if(result.status!==0)throw new Error(cmd+' failed');}
run('swiftc',['-target',target,'-module-cache-path',join(root,'.build-cache'),'-O',join(root,'companion/Engine.swift'),'-o',join(resources,'pixelbar-engine'),'-framework','IOKit','-framework','Foundation']);
run('swiftc',['-target',target,'-module-cache-path',join(root,'.build-cache'),'-O',join(root,'companion/Launcher.swift'),'-o',join(contents,'MacOS','PixelBarStudio'),'-framework','Cocoa']);
await copyFile(process.execPath,join(resources,'runtime/node'));
for(const folder of ['web','server','providers'])await cp(join(root,folder),join(resources,'studio',folder),{recursive:true});
await copyFile(join(root,'package.json'),join(resources,'studio/package.json'));
await copyFile(join(root,'LICENSE'),join(resources,'LICENSE'));
await copyFile(join(root,'NOTICE'),join(resources,'NOTICE'));
await mkdir(join(resources,'integration'),{recursive:true});
await copyFile(join(root,'scripts/notify.mjs'),join(resources,'integration/notify.mjs'));
await copyFile(join(root,'docs/INFORMATION.md'),join(resources,'integration/README.md'));
// Node embeds its complete runtime and third-party license text.
const licensePath=process.env.PIXELBAR_NODE_LICENSE;
if(!licensePath)throw new Error('Set PIXELBAR_NODE_LICENSE to the official LICENSE file for '+process.version+' before distributing the bundled Node runtime.');
await copyFile(licensePath,join(resources,'runtime/NODE-LICENSE.txt'));
await writeFile(join(resources,'runtime/VERSION'),process.version+'\n');
await writeFile(join(contents,'Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>PixelBarStudio</string><key>CFBundleIdentifier</key><string>org.pixelbar.studio</string><key>CFBundleName</key><string>PixelBar Studio</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>0.1.0</string><key>LSUIElement</key><true/><key>LSMinimumSystemVersion</key><string>13.0</string><key>NSHighResolutionCapable</key><true/></dict></plist>`);
for(const file of [join(resources,'runtime/node'),join(resources,'pixelbar-engine'),join(contents,'MacOS','PixelBarStudio')])run('codesign',['--force','--sign','-',file]);
run('codesign',['--force','--sign','-',app]);run('codesign',['--verify','--deep','--strict',app]);
console.log('Built '+app+' (local ad-hoc signature; not notarized).');
