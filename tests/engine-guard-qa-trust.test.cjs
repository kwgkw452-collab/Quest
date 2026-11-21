"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'qa11-trust-fixtures-'));
const candidate=path.join(temp,'candidate'),qa=path.join(temp,'qa'),configPath=path.join(temp,'approved-for-synthetic-test.json');
const git=(dir,...args)=>cp.execFileSync('git',['-C',dir,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function init(dir){fs.mkdirSync(dir);git(dir,'init','-q');git(dir,'config','user.name','Synthetic QA fixture');git(dir,'config','user.email','fixture@example.invalid');}
function write(dir,p,s){const t=path.join(dir,p);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,s);}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const node=process.execPath,bootstrap=path.join(root,'tools/qc/check-diff.cjs');
let tests=0;
function run(expected,fragment,config=configPath){
 const env={...process.env};delete env.ENGINE_GUARD_QA_CONFIG;if(config)env.ENGINE_GUARD_QA_CONFIG=config;
 const r=cp.spawnSync(node,[bootstrap,candidate],{encoding:'utf8',env});
 assert.equal(r.status,expected,r.stdout+r.stderr);const report=JSON.parse(r.stdout);
 if(fragment)assert(r.stdout.includes(fragment),r.stdout);tests++;return report;
}
try{
 init(candidate);init(qa);
 // This is a synthetic policy fixture, NOT an adopted QA baseline for PR #11.
 const css='/* S006 uses three rows: synthetic fixture */\n.background { background-position: center; }\n.scene { --s006-dialogue-height: 100.2px; }\n';
 write(candidate,'css/dialogue-information.css',css);
 for(const p of ['index.html','dev.html'])write(candidate,p,'<script src="data/s006-communication.js?v=fixture-v2"></script>');
 write(candidate,'engine/core/core.js','// synthetic protected engine\n');
 write(candidate,'engine/stories/S006.js','// synthetic locked Story\n');
 write(candidate,'specs/approved/final.md','synthetic final review\n');
 write(candidate,'specs/approved/amendment.md','synthetic approved amendment\n');
 git(candidate,'add','.');git(candidate,'commit','-qm','Synthetic production baseline');
 const baseline=git(candidate,'rev-parse','HEAD');
 const locked=['engine/core/core.js','engine/stories/S006.js'].map(p=>({path:p,git_blob:git(candidate,'rev-parse',baseline+':'+p)}));
 const files=['specs/locked-content-baseline.json','specs/current/engine-guard-v1.json'];
 write(candidate,files[0],JSON.stringify({commit:baseline,files:locked}));
 write(candidate,files[1],JSON.stringify({allowedChangedFiles:files}));
 const policy={schemaVersion:1,approval:{qaReview:'SYNTHETIC TEST ONLY',userApproval:'SYNTHETIC TEST ONLY'},baseline:{commit:baseline,files:locked},
  scope:{userApprovedAmendments:[{path:'specs/approved/amendment.md',sha256:hash('synthetic approved amendment\n')}],allowedChangedFiles:files,s006ScriptVersion:'fixture-v2',finalReview:{path:'specs/approved/final.md',sha256:hash('synthetic final review\n')}},
  candidatePolicyFiles:files.map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(candidate,p)))}))};
 write(qa,'specs/qa/engine-guard-policy.json',JSON.stringify(policy));
 write(qa,'tools/qc/verify-protected-policy.cjs',fs.readFileSync(path.join(root,'tools/qc/verify-protected-policy.cjs')));
 git(qa,'add','.');git(qa,'commit','-qm','Synthetic externally pinned QA fixture');
 const pin=git(qa,'rev-parse','HEAD');
 const config={repository:qa,commit:pin,qaReviewed:true,userApproved:true};
 fs.writeFileSync(configPath,JSON.stringify(config));
 assert.equal(run(2,'HOLD',null).status,'HOLD');
 assert.equal(run(0,'PASS').qaCommit,pin);
 // Editing the QA clone's working tree cannot replace its pinned commit.
 write(qa,'specs/qa/engine-guard-policy.json','{}');
 write(qa,'tools/qc/verify-protected-policy.cjs','throw Error("uncommitted QA verifier must not execute");');
 run(0,'PASS');
 const clean=files.map(p=>fs.readFileSync(path.join(candidate,p)));
 const restore=()=>{write(candidate,'engine/core/core.js','// synthetic protected engine\n');write(candidate,'engine/stories/S006.js','// synthetic locked Story\n');files.forEach((p,i)=>write(candidate,p,clean[i]));fs.rmSync(path.join(candidate,'unapproved.txt'),{force:true});fs.rmSync(path.join(candidate,'tools'),{recursive:true,force:true});};
 // Exact bypass: protected file + refreshed hash/redirected baseline + enlarged allowlist.
 write(candidate,'engine/core/core.js','// unauthorized engine change\n');
 const tampered=JSON.parse(clean[0]);tampered.files[0].git_blob=git(candidate,'hash-object','engine/core/core.js');
 write(candidate,files[0],JSON.stringify(tampered));
 write(candidate,files[1],JSON.stringify({allowedChangedFiles:[...files,'engine/core/core.js']}));
 run(1,'Changed locked file: engine/core/core.js');
 restore();
 // The same attack after committing it must fail, not just unstaged mutations.
 write(candidate,'engine/stories/S006.js','// unauthorized Story change\n');
 write(candidate,files[0],JSON.stringify({commit:'f'.repeat(40),files:[]}));
 write(candidate,files[1],JSON.stringify({allowedChangedFiles:['engine/stories/S006.js',...files]}));
 git(candidate,'add','.');git(candidate,'commit','-qm','Synthetic malicious candidate commit');
 run(1,'Changed locked file: engine/stories/S006.js');
 restore();
 // Allowlist expansion alone cannot authorize an otherwise unprotected new file.
 write(candidate,'unapproved.txt','new file');write(candidate,files[1],JSON.stringify({allowedChangedFiles:[...files,'unapproved.txt']}));
 run(1,'Outside independently approved scope: unapproved.txt');
 restore();
 // Approved amendment digests also come from the external fixed snapshot.
 write(candidate,'specs/approved/amendment.md','unauthorized amendment');run(1,'Approved amendment changed');
 write(candidate,'specs/approved/amendment.md','synthetic approved amendment\n');
 // Even a scope-file-only change is not silently approved by candidate self-edit.
 write(candidate,files[1],JSON.stringify({allowedChangedFiles:[...files,'engine/core/core.js']}));
 run(1,'Unapproved candidate policy change');restore();
 // Candidate-provided PASS script is never executed by the independent supervisor.
 write(candidate,'tools/qc/verify-protected-policy.cjs','require("fs").writeFileSync("'+path.join(temp,'executed')+'","bad");console.log("PASS");');
 write(candidate,'engine/core/core.js','// unauthorized engine change\n');run(1,'Changed locked file');
 assert(!fs.existsSync(path.join(temp,'executed')));restore();
 // Supplying another config inside the candidate (or via symlink) is forbidden.
 write(candidate,'candidate-trust.json',JSON.stringify(config));run(1,'Candidate-local trust config',path.join(candidate,'candidate-trust.json'));
 fs.rmSync(path.join(candidate,'candidate-trust.json'));
 fs.writeFileSync(configPath,JSON.stringify({...config,qaReviewed:false}));run(1,'confirmation and user approval');
 fs.writeFileSync(configPath,JSON.stringify({...config,commit:'main'}));run(1,'full immutable SHA');
 fs.writeFileSync(configPath,JSON.stringify({...config,repository:candidate}));run(1,'Candidate-local QA repository');
 fs.writeFileSync(configPath,JSON.stringify(config));
 // Neither mutations to both ledgers nor an invented PASS flag can convert no trust into PASS.
 write(candidate,files[0],JSON.stringify({approved:true,files:[]}));write(candidate,files[1],JSON.stringify({approved:true,allowedChangedFiles:['*']}));
 run(2,'HOLD',null);
 console.log(`QA-11-02: ${tests} synthetic trust/negative checks PASS; no real QA policy adopted; official protection remains HOLD`);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
