"use strict";
// Static declared geometry only. Does NOT measure a browser pixel.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
assert.match(read('js/fixed-game-stage.js'),/width: 1560, height: 720/);
assert.match(read('css/fixed-game-stage.css'),/width: 1560px; height: 720px/);
const css=read('css/dialogue-information.css');
assert.match(css,/--compact-two-row-height:\s*100\.2px/);
assert.match(css,/--compact-three-row-height:\s*140px/);
for(const block of css.match(/[^{}]*\.control-button[^{}]*\{[^{}]*\}/g)||[]){
 const heights=[...block.matchAll(/(?:min-|max-)?height:\s*(\d+)px/g)].map(m=>+m[1]);
 assert(heights.every(h=>h===43),'Communication button overrides must preserve 43px');
}
assert(css.includes('.communication-dialogue:is(.communication-has-explanation, .communication-feedback)'));
console.log('PASS declared 1560x720 / 100.2px / 140px / 43px controls; rendered geometry NOT verified');

assert(css.includes('#scene:has(#background[style*="images/006/S006-Scene-"]) > #dialogue-box.dialogue-wide-ui.communication-dialogue.communication-feedback'), "Feedback panel selector must override S006 Dialogue height without changing background state");

const cp=require('node:child_process');
for (const page of ['index.html','dev.html']) {
 const original=cp.execFileSync('git',['show','70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f:'+page],{cwd:root,encoding:'utf8'});
 const clean=s=>s.replace(/(data\/s006-communication\.js)\?[^"\s]+/g,'$1?<V2>')
  .replace(/(css\/dialogue-information\.css|engine\/controllers\/communicative-question-flow-controller\.js)\?[^"\s]+/g,'$1?<Guard>');
 assert.equal(clean(read(page)),clean(original),'Only S006, Flow and Dialogue CSS references may differ; Audio/Speech/Core are unchanged');
}
