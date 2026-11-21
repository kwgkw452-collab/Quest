#!/usr/bin/env node
"use strict";
const fs=require('node:fs'),cp=require('node:child_process'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),sha='e81b06496bf40c9248d1218c94e1546d1208c111';
const git=(...a)=>cp.execFileSync('git',a,{cwd:root,stdio:['ignore','pipe','pipe']});
try{git('cat-file','-e',sha);}catch{git('fetch','--no-tags','origin',sha);}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'edq-pr9-negative-'));
try{
 const files=git('ls-tree','-r','--name-only',sha,'data','engine').toString().trim().split('\n').filter(p=>p.endsWith('.js'));
 for(const p of files){const target=path.join(temp,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,git('show',sha+':'+p));}
 const run=cp.spawnSync(process.execPath,[path.join(__dirname,'check-communication-controls.cjs'),temp],{encoding:'utf8'});
 assert.equal(run.status,1,'PR9 must fail the same production control contract');
 const result=JSON.parse(run.stdout);
 assert.equal(result.pass,false);
 assert(result.snapshots.filter(s=>s.support).every(s=>s.buttons.length===5),'Actual PR9 support UI has five buttons');
 assert(result.snapshots.filter(s=>!s.support).every(s=>s.buttons.length===3),'Actual PR9 recovery UI has three buttons');
 console.log(JSON.stringify({status:'PASS',meaning:'Negative control correctly rejected; PR9 itself FAIL',sourceSHA:sha,detectorExitCode:run.status,snapshots:result.snapshots.length,supportButtons:result.snapshots.find(s=>s.support).buttons},null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
