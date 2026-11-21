#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),cp=require("node:child_process"),path=require("node:path");
const repo=path.resolve(process.argv[2]),candidate=process.argv[3],manifest=JSON.parse(fs.readFileSync(process.argv[4],"utf8"));
const raw=cp.execFileSync("git",["ls-tree","-r",candidate],{cwd:repo,encoding:"utf8"});
const tree=new Map(raw.trim().split("\n").map(line=>{const [meta,p]=line.split("\t");return [p,meta.split(" ")[2]];}));
const changed=manifest.files.filter(x=>tree.get(x.path)!==x.git_blob).map(x=>({...x,actual:tree.get(x.path)||null}));
console.log(JSON.stringify({baseline:manifest.commit,candidate,checked:manifest.files.length,changed,
  status:changed.length?"FAIL":"PASS",limits:"Git blob identity only; CSS framing and rendered crop require UI tests."},null,2));
process.exitCode=changed.length?1:0;

