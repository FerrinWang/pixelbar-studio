import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateColor,validateCalibration,deltaE76} from '../web/core/color-calibration.js';
test('appearance calibration leaves input and other target unchanged; reproduces exact samples',()=>{
 const profile=validateCalibration({version:1,enabled:true,samples:[{target:'screen',input:'#FF0000',observed:'#DA3018'}]});
 const before=JSON.stringify(profile);assert.equal(estimateColor('#FF0000','screen',profile),'#DA3018');assert.equal(estimateColor('#FF0000','lighting',profile),'#FF0000');assert.equal(JSON.stringify(profile),before);
 assert.equal(estimateColor('#FF0000','screen',{...profile,enabled:false}),'#FF0000');assert.match(estimateColor('#EE1111','screen',profile),/^#[0-9A-F]{6}$/);
});
test('calibration validates bounded samples, and photo RGB difference is not device accuracy',()=>{
 assert.throws(()=>validateCalibration({version:1,enabled:true,samples:[{target:'screen',input:'#FFF',observed:'#FFFFFF'}]}));
 assert.throws(()=>validateCalibration({version:1,enabled:true,samples:Array(101).fill({})}));
 assert.equal(deltaE76('#FFFFFF','#FFFFFF'),0);assert.ok(deltaE76('#FFFFFF','#000000')>99);
});
