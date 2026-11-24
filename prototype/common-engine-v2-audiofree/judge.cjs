'use strict';
// Declarative, deterministic, local-only fixture judge. Not the approved S005-S007 corpus.
function normalize(x){return String(x??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9'\s]/g,' ').replace(/\s+/g,' ').trim();}
function judge(rule,utterance){
  if(!rule||typeof rule!=='object')throw new Error('INVALID_RULE');
  const u=normalize(utterance);
  if(!u)return {decision:'UNKNOWN',reason:'EMPTY'};
  const normList=(a)=>Array.isArray(a)?a.map(normalize):[];
  if(normList(rule.exclude).some(x=>x&&u.includes(x)))return {decision:'REJECT',reason:'EXCLUDED'};
  if(normList(rule.accept).includes(u))return {decision:'ACCEPT',reason:'EXACT_VARIANT'};
  if(Array.isArray(rule.requireAll)&&rule.requireAll.length&&rule.requireAll.every(x=>u.split(' ').includes(normalize(x))))return {decision:'ACCEPT',reason:'ALL_TERMS'};
  return {decision:'REJECT',reason:'NO_MATCH'};
}
module.exports={normalize,judge};

