(function(root){
'use strict';
const factories={"judge.cjs":function(module,exports,require){
'use strict';
// Declarative, deterministic local judge. Its acceptance corpus still requires independent approval.
function normalize(x){return String(x??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9'\s]/g,' ').replace(/\s+/g,' ').trim();}
function normalizeContractions(x){
 return String(x??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'")
  .replace(/\b(can't|cant)\b/g,'cannot').replace(/\b(don't|dont)\b/g,'do not')
  .replace(/\b(doesn't|doesnt)\b/g,'does not').replace(/\b(didn't|didnt)\b/g,'did not')
  .replace(/\b(won't|wont)\b/g,'will not').replace(/\b(we've|weve)\b/g,'we have')
  .replace(/\b(i've|ive)\b/g,'i have').replace(/\b(where's|wheres)\b/g,'where is')
  .replace(/\b(it's|its)\b/g,'it is').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function judge(rule,utterance){
  if(!rule||typeof rule!=='object')throw new Error('INVALID_RULE');
  const u=normalize(utterance);
  if(!u)return {decision:'UNKNOWN',reason:'EMPTY'};
  const normList=(a)=>Array.isArray(a)?a.map(normalize):[];
  if(normList(rule.excludeExact).includes(u))return {decision:'REJECT',reason:'EXCLUDED_EXACT'};
  if(normList(rule.exclude).some(x=>x&&u.includes(x)))return {decision:'REJECT',reason:'EXCLUDED'};
  if(normList(rule.accept).includes(u))return {decision:'ACCEPT',reason:'EXACT_VARIANT'};
  if(Array.isArray(rule.fullPatterns)&&rule.fullPatterns.length){
   const normalized=rule.patternNormalization==='contractions'?normalizeContractions(utterance):normalize(utterance);
   const checked=rule.stripPlease===true?normalized.replace(/\bplease\b/g,' ').replace(/\s+/g,' ').trim():normalized;
   for(const pattern of rule.fullPatterns){
    if(typeof pattern!=='string'||pattern.length>1800||!pattern.startsWith('(?:')||!pattern.endsWith(')'))throw Error('INVALID_FULL_PATTERN');
    if(new RegExp('^'+pattern+String.fromCharCode(36)).test(checked))return {decision:'ACCEPT',reason:'FULL_UTTERANCE_PATTERN'};
   }
  }
  if(Array.isArray(rule.requireAll)&&rule.requireAll.length&&rule.requireAll.every(x=>u.split(' ').includes(normalize(x))))return {decision:'ACCEPT',reason:'ALL_TERMS'};
  const tokens=u.split(' ');
  const requiredAny=Array.isArray(rule.requireAnyWords)&&rule.requireAnyWords.length;
  const requiredPhrases=Array.isArray(rule.requirePhrases)&&rule.requirePhrases.length;
  const hasOrdered=Array.isArray(rule.orderedGroups)&&rule.orderedGroups.length;
  const anyWordsOk=!requiredAny||rule.requireAnyWords.every(group=>Array.isArray(group)&&group.length&&group.some(t=>tokens.includes(normalize(t))));
  const phrasesOk=!requiredPhrases||rule.requirePhrases.every(phrase=>{const pieces=normalize(phrase).split(' ');return tokens.some((_,i)=>pieces.every((v,j)=>tokens[i+j]===v));});
  if(anyWordsOk&&phrasesOk&&hasOrdered){
    const words=tokens;let cursor=0,complete=true;
    for(const group of rule.orderedGroups){
      if(!Array.isArray(group)||!group.length||group.some(x=>typeof x!=='string'))throw Error('INVALID_ORDERED_GROUP');
      let next=-1;
      for(const alternative of group){
        const phrase=normalize(alternative).split(' ');
        for(let i=cursor;i<=words.length-phrase.length;i++){
          if(phrase.every((v,j)=>words[i+j]===v)){next=i+phrase.length;break;}
        }
        if(next>=0)break;
      }
      if(next<0){complete=false;break;}
      cursor=next;
    }
    if(complete)return {decision:'ACCEPT',reason:'TYPED_TERMS'};
  }
  if(anyWordsOk&&phrasesOk&&(requiredAny||requiredPhrases)&&!hasOrdered)return {decision:'ACCEPT',reason:'TYPED_TERMS'};
  return {decision:'REJECT',reason:'NO_MATCH'};
}
module.exports={normalize,normalizeContractions,judge};


},
"communication.cjs":function(module,exports,require){
'use strict';
const {judge:localJudge}=require('./judge.cjs');
function createCommunication(q,{recognize,judge=localJudge,cancelSpeech}={}){
 let stage=0,state='READY',attempt=0,active=0,feedback=null;
 const view=()=>({state,goalJa:q.goalJa,supportStage:stage,supportText:stage?q.hints[stage-1]:null,recognizedText:feedback?.recognizedText??null,feedbackJa:feedback?.feedbackJa??null,layoutMode:stage||feedback?.recognizedText?'threeRow':'twoRow',actions:state==='READY'?['talk','support','return']:[]});
 function support(){if(state!=='READY')throw Error('NOT_READY');stage=Math.min(stage+1,3);return view();}
 function cancel(){active=++attempt;state='CANCELLED';cancelSpeech?.();return view();}
 async function speak(){if(state!=='READY')throw Error('NOT_READY');if(typeof recognize!=='function')throw Error('NO_RECOGNIZER');
  state='LISTENING';feedback=null;const token=++attempt;active=token;let r;
  try{r=await recognize({attemptId:token});}catch(e){r={status:'error',reason:String(e)};}
  if(active!==token||state==='CANCELLED')return {type:'stale',view:view()};
  if(r?.status!=='final'||!r.text){state='READY';feedback={feedbackJa:r?.status==='permission-denied'?'マイクの許可を確認してください。':r?.status==='unsupported'?'このブラウザは音声認識に対応していません。':r?.status==='timeout'?'聞き取り時間を超えたピコ。もう一度話してみよう。':'うまく聞き取れなかったピコ。'};return {type:'no-speech',view:view()};}
  let answer;try{answer=await judge(q.rule||{accept:q.accept||[]},r.text);}catch(e){state='READY';throw e;}
  if(active!==token||state==='CANCELLED')return {type:'stale',view:view()};
  const decision=typeof answer==='string'?answer:answer?.decision;
  if(decision==='ACCEPT'){state='ACCEPTED';return {type:'accepted',view:view(),recognizedText:r.text};}
  state='READY';feedback={recognizedText:r.text,feedbackJa:`${r.text} と聞こえたよ。もう一度話してみよう。`};return {type:decision==='UNKNOWN'?'unknown':'rejected',view:view()};
 }
 return {view,support,cancel,speak};
}
module.exports={createCommunication};


},
"schema.cjs":function(module,exports,require){
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
const RULE_FIELDS=new Set(['accept','exclude','excludeExact','fullPatterns','patternNormalization','stripPlease','requireAll','orderedGroups','requireAnyWords','requirePhrases']);
function ruleErrors(rule,id,add){
 if(!rule||typeof rule!=='object'||Array.isArray(rule)){add('RULE_TYPE:'+id);return;}
 for(const k of Object.keys(rule))if(!RULE_FIELDS.has(k))add('UNSUPPORTED_RULE_OPERATOR:'+id+':'+k);
 const strList=(v)=>Array.isArray(v)&&v.every(x=>typeof x==='string'&&x.trim());
 if('fullPatterns' in rule&&(!Array.isArray(rule.fullPatterns)||!rule.fullPatterns.length||!rule.fullPatterns.every(x=>typeof x==='string'&&x.length<=1800&&x.startsWith('(?:')&&x.endsWith(')'))))add('INVALID_FULL_PATTERNS:'+id);
 if('patternNormalization' in rule&&!['basic','contractions'].includes(rule.patternNormalization))add('INVALID_NORMALIZE_PROFILE:'+id);
 if('stripPlease' in rule&&typeof rule.stripPlease!=='boolean')add('INVALID_STRIP_POLITE:'+id);
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


},
"speech-browser.cjs":function(module,exports,require){
'use strict';
// No dependency on AudioManager; only browser SpeechRecognition. No implicit text fallback.
function createBrowserSpeech({env=(typeof window==='undefined'?{}:window),language='en-US',timeoutMs=12000}={}){
 let seq=0,live=null;
 function cancel(){if(!live)return;const x=live;live=null;x.finish({status:'cancelled'});try{x.instance.abort();}catch{}}
 function recognize({attemptId,lang=language}={}){
  const Cls=env.SpeechRecognition||env.webkitSpeechRecognition;
  if(!Cls)return Promise.resolve({status:'unsupported'});
  cancel();
  const id=++seq;
  return new Promise(resolve=>{
   const instance=new Cls();let ended=false,choice=null,timer=null;
   const finish=value=>{if(ended)return;ended=true;if(timer!==null)clearTimeout(timer);if(live?.id===id)live=null;instance.onresult=null;instance.onerror=null;instance.onend=null;resolve({...value,attemptId});};
   live={id,instance,finish};instance.lang=lang;instance.interimResults=false;instance.continuous=false;instance.maxAlternatives=3;
   instance.onresult=event=>{const a=event.results?.[event.resultIndex??0];const texts=[];for(let k=0;k<(a?.length||0);k++){const s=a[k]?.transcript;if(typeof s==='string'&&s.trim())texts.push(s.trim());}if(texts.length)choice={status:'final',text:texts[0],alternatives:texts};};
   instance.onerror=event=>{const code=event?.error;choice={status:code==='not-allowed'||code==='service-not-allowed'?'permission-denied':code==='no-speech'?'no-speech':'error',reason:code||'unknown'};};
   instance.onend=()=>finish(choice||{status:'no-speech'});
   try{instance.start();if(!ended&&Number.isFinite(timeoutMs)&&timeoutMs>0)timer=setTimeout(()=>{finish({status:'timeout'});try{instance.abort();}catch{}},timeoutMs);}catch(e){finish({status:'error',reason:String(e?.message||e)});}
  });
 }
 return {recognize,cancel,isSupported:()=>Boolean(env.SpeechRecognition||env.webkitSpeechRecognition)};
}
module.exports={createBrowserSpeech};


},
"vocabulary-battle.cjs":function(module,exports,require){
'use strict';
const {normalize}=require('./judge.cjs');
function createVocabularyBattle(data,{recognize,cancelSpeech}={}){
 if(!Array.isArray(data?.words)||data.words.length===0)throw Error('INVALID_BATTLE');
 let pos=0,active=0,status='READY',last=null;
 const view=()=>({status,index:pos,total:data.words.length,prompt:data.words[pos]?.prompt||null,feedback:last});
 async function speak(){if(status!=='READY')throw Error('NOT_READY');if(typeof recognize!=='function')throw Error('NO_RECOGNIZER');status='LISTENING';const token=++active;let r;try{r=await recognize({attemptId:token});}catch{r={status:'error'};}
  if(token!==active||status==='CANCELLED')return {type:'stale',view:view()};status='READY';
  if(r?.status!=='final'){last='うまく聞き取れなかったピコ。';return {type:'no-speech',view:view()};}
  const a=data.words[pos].answers||[];
  if(a.some(x=>normalize(x)===normalize(r.text))){pos++;last=null;if(pos===data.words.length)status='COMPLETE';return {type:status==='COMPLETE'?'complete':'accepted',view:view()};}
  last=r.text+' と聞こえたよ。';return {type:'rejected',view:view()};
 }
 function cancel(){active++;status='CANCELLED';cancelSpeech?.();return view();}
 return {view,speak,cancel};
}
module.exports={createVocabularyBattle};


},
"save.cjs":function(module,exports,require){
'use strict';
const clean=o=>JSON.parse(JSON.stringify(o));
function createSaveStore({storage,key='quest.v2.prototype.save'}={}){
 let cache=null;
 function read(){if(cache)return clean(cache);if(!storage)return null;const s=storage.getItem(key);if(!s)return null;const v=JSON.parse(s);if(v?.schemaVersion!==1)throw Error('UNSUPPORTED_SAVE_VERSION');cache=v;return clean(v);}
 function write(value){const snap=clean({schemaVersion:1,...value});if(storage)storage.setItem(key,JSON.stringify(snap));cache=snap;return clean(snap);}
 function clear(){if(storage)storage.removeItem(key);cache=null;}
 return {read,write,clear};
}
module.exports={createSaveStore};


},
"runner.cjs":function(module,exports,require){
'use strict';
const {validate}=require('./schema.cjs');
const {createCommunication}=require('./communication.cjs');
const {createVocabularyBattle}=require('./vocabulary-battle.cjs');
function createRunner(pack,{recognize,judge,cancelSpeech,storage,onEvent,initialSnapshot}={}){
 const errors=validate(pack);if(errors.length)throw Error('INVALID_PACKAGE:'+errors.join(','));
 let scene=pack.entry,index=0,status='READY',communication=null,battle=null,feature=null,serial=0,advancing=false;
 let flags={};let events=[];
 if(initialSnapshot){if(initialSnapshot.storyId!==pack.id||initialSnapshot.schemaVersion!==1)throw Error('SAVE_MISMATCH');if(!pack.scenes[initialSnapshot.scene]||!Number.isInteger(initialSnapshot.index)||initialSnapshot.index<0||initialSnapshot.index>=pack.scenes[initialSnapshot.scene].steps.length)throw Error('INVALID_SAVE_CURSOR');if(initialSnapshot.status!=='READY')throw Error('UNSAFE_RESUME_STATE');if(!initialSnapshot.flags||typeof initialSnapshot.flags!=='object'||Array.isArray(initialSnapshot.flags)||Object.entries(initialSnapshot.flags).some(([k,v])=>!Object.prototype.hasOwnProperty.call(pack.saveKeys||{},k)||typeof v!==pack.saveKeys[k]))throw Error('INVALID_SAVE_FLAGS');scene=initialSnapshot.scene;index=initialSnapshot.index;flags={...initialSnapshot.flags};}
 const emit=e=>{events.push(e);onEvent?.(e);return e;};
 const snapshot=()=>({schemaVersion:1,storyId:pack.id,scene,index,status,flags:{...flags}});
 const state=()=>({...snapshot(),question:communication?.view()||null,battle:battle?.view()||null,feature,events:[...events]});
 async function advance(){
  if(advancing)throw Error('ADVANCE_ALREADY_RUNNING');
  if(status!=='READY')throw Error('NOT_READY');
  advancing=true;try {for(let n=0;n<500;n++){
   const s=pack.scenes[scene]?.steps[index];if(!s)throw Error('RUN_OFF_SCENE');
   switch(s.type){
    case 'scene':case 'clear':case 'hideDialogue':index++;emit({type:s.type,asset:s.asset||null});break;
    case 'line':index++;return emit({type:'line',speaker:s.speaker||null,text:s.text,supportText:s.supportText||null,voice:s.voice||null});
    case 'goto':scene=s.to;index=0;emit({type:'goto',scene});break;
    case 'setFlag':{const changed={...flags,[s.key]:s.value};const next={schemaVersion:1,storyId:pack.id,scene,index:index+1,status:'READY',flags:changed};if(storage)await storage.write(next);flags=changed;index++;emit({type:'flag',key:s.key,value:s.value});break;}
    case 'challenge':communication=createCommunication(pack.challenges[s.id],{recognize,judge,cancelSpeech});status='QUESTION';return emit({type:'challenge',id:s.id,view:communication.view()});
    case 'battle':battle=createVocabularyBattle(pack.battles[s.id],{recognize,cancelSpeech});status='BATTLE';return emit({type:'battle',id:s.id,view:battle.view()});
    case 'document':feature={type:'document',id:s.id,content:pack.documents[s.id]};status='DOCUMENT';return emit({...feature});
    case 'end':status='ENDED';return emit({type:'end',result:s.result||'completed',flags:{...flags}});
    default:throw Error('UNSUPPORTED_STEP:'+s.type);
   }
  }throw Error('RUNAWAY_STORY');} finally {advancing=false;}
 }
 const support=()=>{if(status!=='QUESTION')throw Error('NOT_QUESTION');return emit({type:'hint',view:communication.support()});};
 async function talk(){if(status!=='QUESTION'&&status!=='BATTLE')throw Error('NOT_SPEECH_STEP');const previous=serial;const target=status==='QUESTION'?communication:battle;const result=await target.speak();if(serial!==previous||!['QUESTION','BATTLE'].includes(status))return emit({type:'stale'});
  if(result.type==='accepted'&&status==='QUESTION'){status='READY';communication=null;index++;return emit(result);}
  if(result.type==='complete'){status='READY';battle=null;index++;return emit(result);}
  return emit(result);
 }
 function documentDone(){if(status!=='DOCUMENT')throw Error('NOT_DOCUMENT');status='READY';feature=null;index++;return emit({type:'document-complete'});}
 function back(){if(advancing)return emit({type:'ignored',reason:'save-in-progress'});serial++;communication?.cancel();battle?.cancel();communication=null;battle=null;feature=null;status='RETURNED';return emit({type:'return'});}
 return {advance,talk,support,documentDone,returnToAdventure:back,state,snapshot};
}
module.exports={createRunner};


}};
const cache={};
function require(name){name=name.replace(/^\.\//,'');if(!factories[name])throw Error('Unknown module '+name);if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;factories[name](module,module.exports,require);return module.exports;}
root.QuestV2={...require('runner.cjs'),...require('speech-browser.cjs'),...require('judge.cjs'),...require('save.cjs'),...require('schema.cjs')};
})(typeof window!=='undefined'?window:globalThis);
