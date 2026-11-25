'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=__dirname;
const names=['judge.cjs','communication.cjs','schema.cjs','speech-browser.cjs','vocabulary-battle.cjs','save.cjs','runner.cjs'];
const parts=names.map(name=>JSON.stringify(name)+':function(module,exports,require){\n'+fs.readFileSync(path.join(dir,name),'utf8')+'\n}');
const bundle=`(function(root){\n'use strict';\nconst factories={${parts.join(',\n')}};\nconst cache={};\nfunction require(name){name=name.replace(/^\\.\\//,'');if(!factories[name])throw Error('Unknown module '+name);if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;factories[name](module,module.exports,require);return module.exports;}\nroot.QuestV2={...require('runner.cjs'),...require('speech-browser.cjs'),...require('judge.cjs'),...require('save.cjs'),...require('schema.cjs')};\n})(typeof window!=='undefined'?window:globalThis);\n`;
fs.writeFileSync(path.join(dir,'quest-v2.browser.js'),bundle);
const context={};vm.runInNewContext(bundle,context,{timeout:1000});if(!context.QuestV2?.createRunner||!context.QuestV2?.createBrowserSpeech)throw Error('BUNDLE_EXPORT_MISSING');console.log('Bundle generated and checked:',Buffer.byteLength(bundle),'bytes');

