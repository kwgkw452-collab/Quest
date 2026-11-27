'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createLegacyDialogueBridge}=require('./legacy-dialogue-bridge.js');
test('plays only approved static voice IDs and stops previous line',()=>{
 const calls=[],internal={play:k=>{calls.push('play:'+k);return {completion:Promise.resolve({status:'ended'})};},stop:()=>calls.push('stop')};
 const voice=createLegacyDialogueBridge({voiceInternal:internal});
 voice.play('voice_c01_s001_001');voice.play('voice_c02_s005_002');
 assert.deepEqual(calls,['play:voice_c01_s001_001','stop','play:voice_c02_s005_002']);
 voice.stop();assert.equal(calls.at(-1),'stop');
});
test('rejects dynamic unsafe keys without playing voice',()=>{
 let count=0;const voice=createLegacyDialogueBridge({voiceInternal:{play:()=>{count++;},stop(){}}});
 assert.equal(voice.play('https://evil.invalid/hello'),null);
 assert.equal(voice.play('../unsafe'),null);assert.equal(count,0);
});
test('explicitly reports missing legacy dialogue API',()=>{
 assert.throws(()=>createLegacyDialogueBridge({voiceInternal:{}}),/DIALOGUE_CONTRACT_REQUIRED/);
});
