'use strict';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const STEPS=new Set(['scene','clear','line','challenge','document','battle','setFlag','goto','end','hideDialogue']);
const ROOT=new Set(['schemaVersion','id','title','entry','sceneOrder','scenes','challenges','saveKeys','assets','cast','documents','battles','rules','pools']);
const BANNED=new Set(['js','javascript','html','css','callback','onEnter','onExit','eval','expression','script']);

const STEP_FIELDS={
 scene:['type','asset','frame'],clear:['type'],line:['type','text','speaker','voice','supportText'],
 challenge:['type','id'],document:['type','id'],battle:['type','id'],
 setFlag:['type','key','value'],goto:['type','to'],end:['type','result'],hideDialogue:['type']
};
const RULE_FIELDS=new Set(['accept','exclude','excludeExact','fullPatterns','patternNormalization','stripPlease','wordAliases','requireAll','orderedGroups','requireAnyWords','requirePhrases']);
function ruleErrors(rule,id,add){
 if(!rule||typeof rule!=='object'||Array.isArray(rule)){add('RULE_TYPE:'+id);return;}
 for(const k of Object.keys(rule))if(!RULE_FIELDS.has(k))add('UNSUPPORTED_RULE_OPERATOR:'+id+':'+k);
 const strList=(v)=>Array.isArray(v)&&v.every(x=>typeof x==='string'&&x.trim());
 if('fullPatterns' in rule&&(!Array.isArray(rule.fullPatterns)||!rule.fullPatterns.length||!rule.fullPatterns.every(x=>typeof x==='string'&&x.length<=1800&&x.startsWith('(?:')&&x.endsWith(')'))))add('INVALID_FULL_PATTERNS:'+id);
 if('patternNormalization' in rule&&!['basic','contractions'].includes(rule.patternNormalization))add('INVALID_NORMALIZE_PROFILE:'+id);
 if('stripPlease' in rule&&typeof rule.stripPlease!=='boolean')add('INVALID_STRIP_POLITE:'+id);
 if('wordAliases' in rule&&(!rule.wordAliases||typeof rule.wordAliases!=='object'||Array.isArray(rule.wordAliases)||Object.entries(rule.wordAliases).some(([a,b])=>!/^[a-z]+$/.test(a)||typeof b!=='string'||!/^[a-z]+$/.test(b))))add('INVALID_WORD_ALIASES:'+id);
 for(const key of ['accept','exclude','excludeExact','requireAll','requirePhrases'])if(key in rule&&!strList(rule[key]))add('RULE_STRING_LIST:'+id+':'+key);
 for(const key of ['orderedGroups','requireAnyWords'])if(key in rule&&(!Array.isArray(rule[key])||!rule[key].length||!rule[key].every(group=>strList(group)&&group.length)))add('RULE_GROUP_LIST:'+id+':'+key);
}

function validate(p){const errors=[];const add=x=>errors.push(x);if(!p||typeof p!=='object'||Array.isArray(p))return ['INVALID_PACKAGE'];
 for(const k of Object.keys(p))if(!ROOT.has(k))add('UNKNOWN_FIELD:'+k);
 if(p.schemaVersion!==1)add('SCHEMA_VERSION');if(typeof p.id!=='string'||!/^S\d{3}$/.test(p.id))add('STORY_ID');
 if(typeof p.title!=='string'||!p.title.trim())add('TITLE');if(!p.scenes||typeof p.scenes!=='object'||Array.isArray(p.scenes))return [...errors,'SCENES'];
 if(!own(p.scenes,p.entry))add('ENTRY');if(!Array.isArray(p.sceneOrder)||p.sceneOrder.length!==Object.keys(p.scenes).length||new Set(p.sceneOrder).size!==p.sceneOrder.length||Object.keys(p.scenes).some(k=>!p.sceneOrder.includes(k)))add('SCENE_ORDER');
 for(const [id,c] of Object.entries(p.challenges||{})){if(typeof c?.goalJa!=='string'||typeof c.modelEn!=='string'||!Array.isArray(c.hints)||c.hints.length!==3||c.hints.some(x=>typeof x!=='string'))add('CHALLENGE:'+id);if(!Array.isArray(c?.rule?.accept||c?.accept)||!(c.rule?.accept||c.accept).length)add('ACCEPT_RULE:'+id);}
 for(const [id,c] of Object.entries(p.challenges||{}))if(c?.rule)ruleErrors(c.rule,id,add);
 for(const [id,scene] of Object.entries(p.scenes)){if(!Array.isArray(scene?.steps)||!scene.steps.length){add('STEPS:'+id);continue;}for(const [i,s] of scene.steps.entries()){const ref=id+':'+i;if(!STEPS.has(s?.type))add('STEP:'+ref);if(STEP_FIELDS[s?.type])for(const k of Object.keys(s))if(!STEP_FIELDS[s.type].includes(k))add('UNSUPPORTED_STEP_FIELD:'+ref+':'+k);if(s?.type==='line'&&typeof s.text!=='string')add('LINE:'+ref);if(s?.type==='goto'&&!own(p.scenes,s.to))add('GOTO:'+ref);if(s?.type==='challenge'&&!own(p.challenges||{},s.id))add('CHALLENGE_REF:'+ref);if(s?.type==='setFlag'&&(!own(p.saveKeys||{},s.key)||typeof s.value!==p.saveKeys[s.key]))add('SAVE_KEY:'+ref);if(s?.type==='battle'&&!own(p.battles||{},s.id))add('BATTLE_REF:'+ref);if(s?.type==='document'&&!own(p.documents||{},s.id))add('DOCUMENT_REF:'+ref);}}
 const visit=(o,path)=>{if(!o||typeof o!=='object')return;for(const [k,v]of Object.entries(o)){if(BANNED.has(k)||typeof v==='function')add('EXECUTABLE:'+path+'.'+k);if(v&&typeof v==='object')visit(v,path+'.'+k);}};visit(p,'$');return [...new Set(errors)];}
module.exports={validate};

