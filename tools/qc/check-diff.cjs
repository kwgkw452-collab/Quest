#!/usr/bin/env node
"use strict";
// Local bootstrap only. CI authority must live in an independent trusted workflow.
// Never load expected hashes or allowlists from the candidate working tree.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os');
const root=fs.realpathSync(process.argv[2]||path.resolve(__dirname,'../..'));
const production='70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f';
const configPath=process.env.ENGINE_GUARD_QA_CONFIG;
function report(status,reason,extra={}){console.log(JSON.stringify({status,reason,...extra},null,2));process.exitCode=status==='HOLD'?2:1;}
if(!configPath){
 let changedFiles=[];
 try{changedFiles=cp.execFileSync('git',['-C',root,'diff','--name-only',production,'--'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);}catch(_){}
 report('HOLD','Independent QA commit/repository and approvals are not configured',{
  provisionalProduction:production,provisionalOnly:true,changedFiles,
  note:'Production is a diagnostic comparison, NOT a QA-approved trust root. Candidate ledgers do not authorize changes.'});
}else{
 let temp;
 try{
  if(!path.isAbsolute(configPath))throw Error('QA config must be an absolute path outside the candidate');
  const configReal=fs.realpathSync(configPath);
  if(configReal===root||configReal.startsWith(root+path.sep))throw Error('Candidate-local trust config is forbidden');
  const config=JSON.parse(fs.readFileSync(configReal,'utf8'));
  if(config.qaReviewed!==true||config.userApproved!==true)throw Error('Independent QA confirmation and user approval are required');
  if(!/^[a-f0-9]{40}$/.test(config.commit))throw Error('QA commit must be a full immutable SHA');
  if(!path.isAbsolute(config.repository))throw Error('QA repository must be an external absolute path');
  const repo=fs.realpathSync(config.repository);
  if(repo===root||repo.startsWith(root+path.sep))throw Error('Candidate-local QA repository is forbidden');
  const common=p=>fs.realpathSync(path.resolve(p,cp.execFileSync('git',['-C',p,'rev-parse','--git-common-dir'],{encoding:'utf8'}).trim()));
  if(common(repo)===common(root))throw Error('Use a separately QA-managed clone, not the candidate Git object store');
  const read=p=>cp.execFileSync('git',['-C',repo,'show',config.commit+':'+p],{maxBuffer:32*1024*1024});
  // Fixed schema paths, both read at the independently approved commit. No candidate code is executed.
  const verifier=read('tools/qc/verify-protected-policy.cjs'),policy=read('specs/qa/engine-guard-policy.json');
  temp=fs.mkdtempSync(path.join(os.tmpdir(),'engine-guard-qa-'));
  fs.writeFileSync(path.join(temp,'verify.cjs'),verifier);fs.writeFileSync(path.join(temp,'policy.json'),policy);
  const run=cp.spawnSync(process.execPath,[path.join(temp,'verify.cjs'),root,path.join(temp,'policy.json')],{encoding:'utf8',maxBuffer:32*1024*1024});
  if(run.error)throw run.error;
  let result;try{result=JSON.parse(run.stdout);}catch(_){throw Error('Pinned QA verifier did not return a report');}
  if(!['PASS','FAIL','HOLD'].includes(result.status))throw Error('Invalid pinned QA verifier status');
  console.log(JSON.stringify({...result,qaCommit:config.commit,qaRepository:repo},null,2));
  process.exitCode=run.status===0&&result.status==='PASS'?0:result.status==='HOLD'?2:1;
 }catch(e){report('FAIL',e.message);}finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
}
