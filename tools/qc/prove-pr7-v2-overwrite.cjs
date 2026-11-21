#!/usr/bin/env node
"use strict";
const fs=require('node:fs'),cp=require('node:child_process'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),sha='bfdb08666f3a9b12b4d9ff13483ab14d13c7638f';
const git=(...a)=>cp.execFileSync('git',a,{cwd:root,stdio:['ignore','pipe','pipe']});
try{git('cat-file','-e',sha);}catch{git('fetch','--no-tags','origin',sha);}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'edq-pr7-overwrite-'));
try{
 for(const d of ['data','engine'])fs.cpSync(path.join(root,d),path.join(temp,d),{recursive:true});
 fs.writeFileSync(path.join(temp,'data/s006-communication.js'),git('show',sha+':data/s006-communication.js'));
 const run=cp.spawnSync(process.execPath,[path.join(__dirname,'check-s006-against-final-review.cjs'),temp,path.join(root,'specs/approved/s006-communication-v2/Final-Review.md')],{encoding:'utf8'});
 assert.equal(run.status,1,'PR7 old S006 overwrite must fail Final Review contract');
 const result=JSON.parse(run.stdout);assert(result.failures>0);
 assert(result.findings.some(f=>f.kind==='version'),'V1 concepts/pools must be detected');
 console.log(JSON.stringify({status:'PASS',meaning:'Negative overwrite correctly rejected; old PR7 S006 is NOT adopted',sourceSHA:sha,detectorExitCode:run.status,mismatches:result.failures},null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
