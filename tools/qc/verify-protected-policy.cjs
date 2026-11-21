#!/usr/bin/env node
"use strict";
// Standalone PROPOSAL for installation at an independently reviewed QA commit.
// The trusted supervisor must execute THAT pinned copy, never the candidate copy.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
function verify(root,policy){
 const failures=[];
 const git=(...a)=>cp.execFileSync('git',['-C',root,...a],{maxBuffer:32*1024*1024});
 const validPath=p=>typeof p==='string'&&p.length>0&&!p.includes('\\')&&!p.includes('\0')&&!path.posix.isAbsolute(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');
 function regular(p){
  if(!validPath(p))throw Error('Unsafe policy path: '+p);
  let current=root;
  for(const [i,part] of p.split('/').entries()){
   current=path.join(current,part);const st=fs.lstatSync(current);
   if(st.isSymbolicLink()||(i===p.split('/').length-1?!st.isFile():!st.isDirectory()))throw Error('Not a regular candidate file: '+p);
  }
  return fs.readFileSync(current);
 }
 if(policy.schemaVersion!==1)throw Error('Unsupported QA policy schema');
 if(!policy.approval||!policy.approval.qaReview||!policy.approval.userApproval)throw Error('QA review and user approval records required');
 const baseline=policy.baseline,scope=policy.scope;
 if(!baseline||!/^[a-f0-9]{40}$/.test(baseline.commit)||!Array.isArray(baseline.files)||!baseline.files.length)throw Error('Missing pinned baseline/locks');
 if(!scope||!Array.isArray(scope.allowedChangedFiles)||!scope.allowedChangedFiles.length||!scope.allowedChangedFiles.every(validPath))throw Error('Invalid trusted allowlist');
 if(new Set(scope.allowedChangedFiles).size!==scope.allowedChangedFiles.length)throw Error('Duplicate trusted allowlist entry');
 const policyPaths=['specs/locked-content-baseline.json','specs/current/engine-guard-v1.json'];
 if(!Array.isArray(policy.candidatePolicyFiles)||policyPaths.some(p=>!policy.candidatePolicyFiles.some(f=>f.path===p)))throw Error('Candidate ledgers must be integrity-checked');
 const seen=new Set();
 for(const f of baseline.files){
  if(!validPath(f.path)||!/^([a-f0-9]{40})$/.test(f.git_blob)||seen.has(f.path))throw Error('Invalid/duplicate QA lock');seen.add(f.path);
  // Expected hashes are fetched from the QA policy; verify they name the pinned baseline blobs.
  const expected=git('rev-parse',baseline.commit+':'+f.path).toString().trim();
  if(expected!==f.git_blob)throw Error('QA lock disagrees with pinned baseline: '+f.path);
  try{const b=regular(f.path),blob=crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
   if(blob!==f.git_blob)failures.push('Changed locked file: '+f.path);
  }catch(e){failures.push('Missing/unsafe locked file: '+f.path);}
 }
 for(const f of policy.candidatePolicyFiles){
  if(!validPath(f.path)||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('Invalid expected ledger digest');
  try{if(crypto.createHash('sha256').update(regular(f.path)).digest('hex')!==f.sha256)failures.push('Unapproved candidate policy change: '+f.path);}
  catch(e){failures.push('Missing/unsafe candidate policy: '+f.path);}
 }
 const changed=new Set(git('diff','--no-renames','--name-only','-z',baseline.commit,'--').toString().split('\0').filter(Boolean));
 for(const p of git('ls-files','--others','--exclude-standard','-z').toString().split('\0').filter(Boolean))changed.add(p);
 const allowed=new Set(scope.allowedChangedFiles);
 for(const p of changed)if(!allowed.has(p))failures.push('Outside independently approved scope: '+p);
 // Original frame/state checks are retained, but baseline and version now come from QA.
 const cssPath='css/dialogue-information.css',original=git('show',baseline.commit+':'+cssPath).toString();
 const current=regular(cssPath).toString();
 const positions=s=>s.match(/[^{}]*\{[^{}]*background-position\s*:[^{}]*\}/g)||[];
 if(JSON.stringify(positions(original))!==JSON.stringify(positions(current)))failures.push('Background framing rules changed');
 const marker='/* S006 uses three rows',originalS006=original.slice(original.indexOf(marker));
 if(!original.includes(marker)||!current.includes(originalS006))failures.push('S006 background size/variable/state conditions changed');
 const variables=s=>s.match(/[^{}]*\{[^{}]*--s006-dialogue-height\s*:[^{}]*\}/g)||[];
 if(JSON.stringify(variables(original))!==JSON.stringify(variables(current)))failures.push('S006 background state variable changed');
 for(const page of ['index.html','dev.html']){
  const s=regular(page).toString(),loads=[...s.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1]).filter(src=>/s006[^?]*(?:communication|communicative)/.test(src));
  const [script,query]=String(loads[0]||'').split('?');
  if(loads.length!==1||script!=='data/s006-communication.js'||new URLSearchParams(query).get('v')!==scope.s006ScriptVersion)failures.push(page+': S006 must load exactly the declared V2 once');
 }
 if(!scope.finalReview||!/^[a-f0-9]{64}$/.test(scope.finalReview.sha256))throw Error('Missing approved Final Review hash');
 if(crypto.createHash('sha256').update(regular(scope.finalReview.path)).digest('hex')!==scope.finalReview.sha256)failures.push('Final Review original changed');
 for(const f of scope.userApprovedAmendments||[]){
  if(!validPath(f.path)||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('Invalid approved amendment digest');
  if(crypto.createHash('sha256').update(regular(f.path)).digest('hex')!==f.sha256)failures.push('Approved amendment changed: '+f.path);
 }
 return {status:failures.length?'FAIL':'PASS',baseline:baseline.commit,lockedFiles:seen.size,changedFiles:changed.size,failures};
}
if(require.main===module){
 try{const root=fs.realpathSync(process.argv[2]),policy=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
  const result=verify(root,policy);console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:1;
 }catch(e){console.log(JSON.stringify({status:'FAIL',failures:[e.message]},null,2));process.exitCode=1;}
}
module.exports={verify};
