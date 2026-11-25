'use strict';
const fs=require('node:fs');
const path=require('node:path');

function inspectSharedSource(path, source) {
  const findings = [];
  const isCode = /\.(js|mjs|cjs|css|ts)$/.test(path);
  if (!isCode) return findings;
  const lines = source.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    const line = lines[i];
    if (/\b(?:s|st|m)\d{3}\b/i.test(line)) findings.push({file:path,line:i+1,rule:"STORY_ID_IN_SHARED_CODE"});
    if (/(?:images|audio|stories)\/0?\d{3}\//i.test(line)) findings.push({file:path,line:i+1,rule:"STORY_ASSET_PATH_IN_SHARED_CODE"});
  }
  return findings;
}

function validateStoryPackage(story, allowedSteps) {
  const problems=[];
  if (!story || typeof story!=="object" || Array.isArray(story)) return ["INVALID_OBJECT"];
  const allowedTop=new Set(["schemaVersion","id","title","entry","sceneOrder","scenes","assets","cast","challenges","pools","rules","documents","battles","saveKeys"]);
  for(const key of Object.keys(story)) if(!allowedTop.has(key)) problems.push("UNKNOWN_FIELD:"+key);
  if(story.schemaVersion!==1) problems.push("SCHEMA_VERSION");
  if(!/^S\d{3}$/.test(story.id||"")) problems.push("STORY_ID");
  if(!story.scenes || typeof story.scenes!=="object" || Array.isArray(story.scenes)) problems.push("SCENES_REQUIRED");
  if(!story.entry || !story.scenes?.[story.entry]) problems.push("ENTRY_NOT_FOUND");
  if(!Array.isArray(story.sceneOrder) || new Set(story.sceneOrder).size!==story.sceneOrder.length) problems.push("SCENE_ORDER_INVALID");
  for(const sceneId of story.sceneOrder||[]) {
    const s=story.scenes?.[sceneId];
    if(!s) {problems.push("SCENE_NOT_FOUND:"+sceneId);continue;}
    if(!Array.isArray(s.steps)) {problems.push("STEPS_REQUIRED:"+sceneId);continue;}
    for(const [index,step] of s.steps.entries()){
      if(!step || typeof step!=="object" || Array.isArray(step)){problems.push("INVALID_STEP:"+sceneId+":"+index);continue;}
      if(!allowedSteps.includes(step.type)) problems.push("UNKNOWN_STEP:"+String(step.type));
      for(const field of ["js","javascript","html","css","callback","onEnter","onExit","eval","expression"]) if(Object.prototype.hasOwnProperty.call(step,field)) problems.push("EXECUTABLE_FIELD:"+field);
      if(step.type==="goto" && !story.scenes?.[step.to]) problems.push("BROKEN_GOTO:"+sceneId+":"+index);
      if(step.type==="setFlag" && (!story.saveKeys || !Object.prototype.hasOwnProperty.call(story.saveKeys,step.key))) problems.push("UNDECLARED_SAVE_KEY:"+sceneId+":"+index);
    }
  }
  function hasExecutablePayload(node){
    if(!node || typeof node!=="object") return false;
    for(const [key,value] of Object.entries(node)){
      if(["javascript","js","html","css","callback","onEnter","onExit","eval","expression"].includes(key)) return true;
      if(typeof value==="function") return true;
      if(typeof value==="object" && hasExecutablePayload(value)) return true;
    }
    return false;
  }
  if(hasExecutablePayload(story)) problems.push("EXECUTABLE_PAYLOAD");
  return [...new Set(problems)];
}

const allowedSteps=["scene","clear","line","challenge","document","battle","setFlag","goto","end","hideDialogue"];
function walk(root){if(!fs.existsSync(root)) throw new Error('Missing directory: '+root);let out=[];for(const entry of fs.readdirSync(root,{withFileTypes:true})){const name=path.join(root,entry.name);if(entry.isDirectory()) out.push(...walk(name));else if(entry.isFile())out.push(name)}return out;}
function scan(root,storiesDir){let findings=[];for(const p of walk(root)){if(/\.(js|mjs|cjs|css|ts)$/.test(p))findings.push(...inspectSharedSource(p,fs.readFileSync(p,'utf8')));}if(storiesDir&&fs.existsSync(storiesDir))for(const p of walk(storiesDir)){if(!p.endsWith('/story.json'))continue;try {for(const problem of validateStoryPackage(JSON.parse(fs.readFileSync(p,'utf8')),allowedSteps))findings.push({file:p,rule:problem});}catch(e){findings.push({file:p,rule:'INVALID_JSON',detail:e.message});}}return findings;}
module.exports={inspectSharedSource,validateStoryPackage,scan,allowedSteps};
if(require.main===module){const args=process.argv.slice(2);if(args.length<1||args.length>2){console.error('Usage: node check-isolation.cjs <new-engine-directory> [story-packages-directory]');process.exit(2);}try{const findings=scan(args[0],args[1]);console.log(JSON.stringify({ok:findings.length===0,findings},null,2));process.exitCode=findings.length?1:0;}catch(e){console.error(e.message);process.exitCode=2;}}
