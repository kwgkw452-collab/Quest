'use strict';
// Declarative, deterministic local judge. Its acceptance corpus still requires independent approval.
function normalize(x){return String(x??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9'\s]/g,' ').replace(/\s+/g,' ').trim();}
function judge(rule,utterance){
  if(!rule||typeof rule!=='object')throw new Error('INVALID_RULE');
  const u=normalize(utterance);
  if(!u)return {decision:'UNKNOWN',reason:'EMPTY'};
  const normList=(a)=>Array.isArray(a)?a.map(normalize):[];
  if(normList(rule.exclude).some(x=>x&&u.includes(x)))return {decision:'REJECT',reason:'EXCLUDED'};
  if(normList(rule.accept).includes(u))return {decision:'ACCEPT',reason:'EXACT_VARIANT'};
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
module.exports={normalize,judge};

