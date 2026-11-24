'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectSharedSource,validateStoryPackage,allowedSteps}=require('./check-isolation.cjs');
const sample={
  "schemaVersion": 1,
  "id": "S008",
  "title": "Sample",
  "entry": "scene1",
  "sceneOrder": [
    "scene1"
  ],
  "scenes": {
    "scene1": {
      "steps": [
        {
          "type": "line",
          "text": "Hello"
        },
        {
          "type": "end"
        }
      ]
    }
  },
  "saveKeys": {}
};
function check(name,assertFn){test(name,assertFn)}
check('shared engine: no local story references',()=>assert.equal(inspectSharedSource('engine-v2/flow.js','function start(question) { return question.goalJa; }').length,0));
check('reject story-specific question branch',()=>assert.ok(inspectSharedSource('engine-v2/flow.js','if (/^s006.communication/.test(id)) return 1;').some(x=>x.rule==='STORY_ID_IN_SHARED_CODE')));
check('reject story-specific asset CSS',()=>assert.ok(inspectSharedSource('engine-v2/view.css','#background[style*="images/006/S006-Scene-01.png"] {}').some(x=>x.rule==='STORY_ASSET_PATH_IN_SHARED_CODE')));
check('valid sample story',()=>assert.deepEqual(validateStoryPackage(sample,allowedSteps),[]));
check('reject executable callback',()=>assert.ok(validateStoryPackage({...sample,scenes:{scene1:{steps:[{type:'line',callback:'x'}]}}},allowedSteps).includes('EXECUTABLE_PAYLOAD')));
check('reject unregistered step',()=>assert.ok(validateStoryPackage({...sample,scenes:{scene1:{steps:[{type:'sceneSpecificMagic'}]}}},allowedSteps).includes('UNKNOWN_STEP:sceneSpecificMagic')));
check('reject broken jump',()=>assert.ok(validateStoryPackage({...sample,scenes:{scene1:{steps:[{type:'goto',to:'missing'}]}}},allowedSteps).includes('BROKEN_GOTO:scene1:0')));
check('reject undeclared save key',()=>assert.ok(validateStoryPackage({...sample,scenes:{scene1:{steps:[{type:'setFlag',key:'x',value:true}]}}},allowedSteps).includes('UNDECLARED_SAVE_KEY:scene1:0')));
check('reject unknown top-level field',()=>assert.ok(validateStoryPackage({...sample,specialS008:true},allowedSteps).includes('UNKNOWN_FIELD:specialS008')));
check('reject invalid entry',()=>assert.ok(validateStoryPackage({...sample,entry:'missing'},allowedSteps).includes('ENTRY_NOT_FOUND')));
check('reject duplicated scene order',()=>assert.ok(validateStoryPackage({...sample,sceneOrder:['scene1','scene1']},allowedSteps).includes('SCENE_ORDER_INVALID')));
check('do not flag story IDs inside data files',()=>assert.deepEqual(inspectSharedSource('stories/S008/story.json',JSON.stringify(sample)),[]));
