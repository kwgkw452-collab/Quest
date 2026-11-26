'use strict';

// Production Save is read-only. Each supported package has a verified cursor map
// generated from the immutable top-level legacy command sequence.
const LEGACY_KEY='eigo-de-quest:save:v2';
function legacySnapshot(storage, pack, mapping) {
  const raw=storage?.getItem(LEGACY_KEY);
  if(!raw)return null;
  const old=JSON.parse(raw);
  if(old?.saveVersion!==1)throw Error('UNSUPPORTED_LEGACY_SAVE_VERSION');
  if(old.progress?.currentStoryId!==pack.id)return null;
  if(!mapping||mapping.storyId!==pack.id)throw Error('LEGACY_CURSOR_MAP_MISSING');
  const position=old.progress.currentStepIndex;
  if(!Number.isInteger(position)||position<0||position>=mapping.cursors.length)throw Error('INVALID_LEGACY_CURSOR');
  const cursor=mapping.cursors[position];
  if(!cursor||!pack.scenes[cursor.scene]?.steps[cursor.index])throw Error('INVALID_LEGACY_CURSOR_MAP');
  const flags={};
  for(const [key,type] of Object.entries(pack.saveKeys||{})){
    if(Object.prototype.hasOwnProperty.call(old.flags||{},key)){
      if(typeof old.flags[key]!==type)throw Error('INVALID_LEGACY_FLAG');
      flags[key]=old.flags[key];
    }
  }
  return {schemaVersion:1,storyId:pack.id,...cursor,status:'READY',flags};
}
module.exports={legacySnapshot,LEGACY_KEY};
