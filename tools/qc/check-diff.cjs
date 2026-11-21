#!/usr/bin/env node
"use strict";
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const git=(...a)=>cp.execFileSync('git',a,{cwd:root});
const baseline=JSON.parse(fs.readFileSync(path.join(root,'specs/locked-content-baseline.json')));
const scope=JSON.parse(fs.readFileSync(path.join(root,'specs/current/engine-guard-v1.json')));
const failures=[];
// Check working-tree bytes as well as committed changes: unstaged edits cannot evade the gate.
for(const f of baseline.files){
 const p=path.join(root,f.path);
 if(!fs.existsSync(p)){failures.push('Deleted locked file: '+f.path);continue;}
 const b=fs.readFileSync(p),blob=crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
 if(blob!==f.git_blob) failures.push('Changed locked file: '+f.path);
}
const paths=new Set(git('diff','--name-only',baseline.commit).toString().trim().split('\n').filter(Boolean));
for(const p of git('ls-files','--others','--exclude-standard').toString().trim().split('\n').filter(Boolean)) paths.add(p);
for(const p of paths) if(!scope.allowedChangedFiles.includes(p)) failures.push('Outside declared change scope: '+p);
const cssPath='css/dialogue-information.css';
const positionRules=s=>s.match(/[^{}]*\{[^{}]*background-position\s*:[^{}]*\}/g)||[];
const original=git('show',baseline.commit+':'+cssPath).toString();
const current=fs.readFileSync(path.join(root,cssPath),'utf8');
if(JSON.stringify(positionRules(original))!==JSON.stringify(positionRules(current))) failures.push('Background framing rules changed');
const originalS006=original.slice(original.indexOf('/* S006 uses three rows'));
if(!current.includes(originalS006)) failures.push('S006 background size/variable/state conditions changed');
const backgroundVariables=s=>s.match(/[^{}]*\{[^{}]*--s006-dialogue-height\s*:[^{}]*\}/g)||[];
if(JSON.stringify(backgroundVariables(original))!==JSON.stringify(backgroundVariables(current))) failures.push('S006 background state variable changed');
for(const page of ['index.html','dev.html']){
 const s=fs.readFileSync(path.join(root,page),'utf8');
 const loads=[...s.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1]).filter(src=>/s006[^?]*(?:communication|communicative)/.test(src));
 const [script,query]=String(loads[0]||'').split('?');
 if(loads.length!==1||script!=='data/s006-communication.js'||new URLSearchParams(query).get('v')!==scope.s006ScriptVersion) failures.push(page+': S006 must load exactly the declared V2 once');
}
const final=fs.readFileSync(path.join(root,scope.finalReview.path));
if(crypto.createHash('sha256').update(final).digest('hex')!==scope.finalReview.sha256) failures.push('Final Review original changed');
console.log(JSON.stringify({status:failures.length?'FAIL':'PASS',baseline:baseline.commit,lockedFiles:baseline.files.length,changedFiles:paths.size,failures},null,2));
process.exitCode=failures.length?1:0;
