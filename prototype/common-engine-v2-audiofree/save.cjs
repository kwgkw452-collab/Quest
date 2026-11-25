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

