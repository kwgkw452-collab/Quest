'use strict';
// Only the NEW shared runtime; legacy Production and Story data are explicitly out of scope.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {inspectSharedSource}=require('../common-engine-isolation/check-isolation.cjs');
const root=__dirname;
const runtime=['schema.cjs','judge.cjs','communication.cjs','runner.cjs','speech-browser.cjs','vocabulary-battle.cjs','save.cjs','legacy-save.cjs','play.js','play.css'];
const findings=[];
for(const filename of runtime){
 const full=path.join(root,filename);
 if(!fs.existsSync(full)){findings.push({file:filename,rule:'MISSING_RUNTIME_FILE'});continue;}
 findings.push(...inspectSharedSource(full,fs.readFileSync(full,'utf8')));
}
assert.deepEqual(findings,[],'Story-specific ID or asset path leaked into new common runtime');
console.log('COMMON_RUNTIME_ISOLATION_PASS:',runtime.length,'shared source files; no literal Story-specific branching/asset path found');
