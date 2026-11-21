#!/usr/bin/env node
"use strict";
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),inventory=JSON.parse(fs.readFileSync(path.join(root,'tests/engine-guard-suite.json')));
const dir=path.join(root,'artifacts/engine-guard');fs.mkdirSync(dir,{recursive:true});
const results=[];
for(const t of inventory.current){
 const start=Date.now(),r=cp.spawnSync(process.execPath,t.args,{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
 const stdout=r.stdout||'',stderr=r.stderr||'';
 fs.writeFileSync(path.join(dir,t.id+'.log'),stdout+stderr+(r.error?'\n'+r.error.message:''));
 const result={id:t.id,status:r.status===0&&!r.error?'PASS':'FAIL',exitCode:r.status,seconds:(Date.now()-start)/1000,command:['node',...t.args],log:t.id+'.log'};
 results.push(result);console.log(result.status+' '+t.id);
}
const failed=results.filter(x=>x.status==='FAIL'),report={executed:results.length,pass:results.length-failed.length,fail:failed.length,results,historical:inventory.historical,notRun:inventory.notRun};
fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(report,null,2)+'\n');
const xml=s=>String(s).replace(/[<>&"']/g,x=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[x]));
fs.writeFileSync(path.join(dir,'junit.xml'),`<?xml version="1.0"?><testsuite name="Engine Guard V1" tests="${results.length}" failures="${failed.length}">${results.map(r=>`<testcase name="${xml(r.id)}" time="${r.seconds}">${r.status==='FAIL'?`<failure message="exit ${r.exitCode}">${xml(fs.readFileSync(path.join(dir,r.log),'utf8'))}</failure>`:''}</testcase>`).join('')}</testsuite>`);
const summary=`## Engine Guard V1\n\nExecuted ${results.length}: PASS ${report.pass}, FAIL ${report.fail}\n\n| Check | Status |\n| --- | --- |\n${results.map(r=>`| ${r.id} | ${r.status} |`).join('\n')}\n\nHistorical tests: ${inventory.historical.length}; other tests not run: ${inventory.notRun.length}. Neither group is PASS. Browser, physical iPhone and real speech are not covered by this Node suite.\n`;
fs.writeFileSync(path.join(dir,'summary.md'),summary);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
console.log(`Executed ${report.executed}: PASS ${report.pass}, FAIL ${report.fail}`);
process.exitCode=failed.length?1:0;
