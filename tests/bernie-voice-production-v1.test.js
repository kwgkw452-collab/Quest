"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm"); const root=path.resolve(__dirname,"..");
const read=r=>fs.readFileSync(path.join(root,r),"utf8"), json=r=>JSON.parse(read(r)); const idx=json("production/voice/voice-production-index.json"); let all=[]; for(const f of idx.entryFiles) all=all.concat(json(f).entries);
const target=all.filter(e=>e.characterName==="Bernie"&&e.dialogueType==="fixed"); assert.strictEqual(all.length,116); assert.strictEqual(target.length,20); assert.strictEqual(new Set(target.map(e=>e.voiceKey)).size,20);
const c={window:{}};c.window=c;vm.createContext(c);vm.runInContext(read("data/audio.js"),c); const files={S004:"engine/stories/S004.js",st004:"engine/stories/story-saki-departure.js"};
for(const e of target){assert.strictEqual(c.AudioDatabase.voice[e.voiceKey],e.runtimeFile);assert.strictEqual(c.AudioDatabase.assets[e.voiceKey].file,e.runtimeFile);assert.strictEqual(c.AudioDatabase.assets[e.voiceKey].category,"VOICE");assert(fs.existsSync(path.join(root,e.runtimeFile)));const s=read(files[e.sourceId]);assert(s.includes(JSON.stringify(e.dialogueText)));assert.strictEqual((s.match(new RegExp(e.voiceKey,"g"))||[]).length,1);}
const keys=[];for(const f of fs.readdirSync(path.join(root,"engine/stories")).filter(f=>f.endsWith(".js")))for(const m of read("engine/stories/"+f).matchAll(/voiceKey:\s*"([^"]+)"/g))keys.push(m[1]);
const set=new Set(target.map(e=>e.voiceKey));assert.strictEqual(keys.filter(k=>set.has(k)).length,20);assert.strictEqual(keys.filter(k=>k.startsWith("voice_c04_")&&!set.has(k)).length,0);
console.log("Bernie Voice Production V1 tests: PASS");
