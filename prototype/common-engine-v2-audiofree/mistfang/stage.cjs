'use strict';
// Mistfang is an isolated vocabulary-only battle; this module does not change the shared runner.
const WORDS=Object.freeze(['snow','snowy','mist','misty','storm','stormy','thunder','lightning','fine','frosty']);
const MILESTONES=Object.freeze([0,3,6,WORDS.length]);
function stageForCorrect(correct){
 if(!Number.isInteger(correct)||correct<0||correct>WORDS.length)throw Error('INVALID_MISTFANG_PROGRESS');
 if(correct===WORDS.length)return 3;
 if(correct>=6)return 2;
 if(correct>=3)return 1;
 return 0;
}
function pack(){
 return {
  schemaVersion:1,id:'S889',title:'Mistfang — Vocabulary Battle Candidate',
  entry:'battle',sceneOrder:['battle','ending'],saveKeys:{},
  challenges:{},
  battles:{mistfang:{words:WORDS.map((word,index)=>({prompt:'天気に関する英単語を言おう ('+(index+1)+' / '+WORDS.length+')',answers:[word]}))}},
  scenes:{battle:{steps:[{type:'battle',id:'mistfang'},{type:'goto',to:'ending'}]},ending:{steps:[{type:'line',speaker:'Pico',text:'The mist is gone! Mistfang is our friend.'},{type:'end'}]}}
 };
}
const GRAPHICS=Object.freeze([0,1,2,3].map(n=>'./assets/mistfang_stage_'+n+'.png'));
module.exports={WORDS,MILESTONES,GRAPHICS,stageForCorrect,pack};
