"use strict";
// Run with Playwright installed, or QUEST_PLAYWRIGHT_MODULE pointing to it.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.QUEST_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.QUEST_SOURCE_ROOT||path.resolve(__dirname,'..'),out=process.env.QUEST_EVIDENCE_DIR||path.join(root,'artifacts/communication-multiline');
fs.mkdirSync(out,{recursive:true});
const records=[],failures=[];let browser;
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let p=path.join(root,name);try{
 if(!p.startsWith(root+path.sep))throw Error('path');
 res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':'text/html');
 res.end(name==='/browser-fixture.html'?fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script src="js\/main.js"><\/script>/,''):fs.readFileSync(p));
}catch(e){res.writeHead(404);res.end();}});
function check(value,label){if(!value)failures.push(label);}
function hotelBounds(m,label){
 // Conservative bounds of Pico in the unchanged 1846x852 source image,
 // checked against the source and the rendered head/feet screenshots.
 const scale=Math.max(m.background.width/1846,m.background.height/852);
 const pos=m.background.backgroundPosition.split(' ')[1];
 const offset=pos.endsWith('%')?(m.background.height-852*scale)*parseFloat(pos)/100:parseFloat(pos);
 const head=m.background.y+419*scale+offset,feet=m.background.y+713*scale+offset;
 check(head>=m.background.y,label+' Pico head cropped');
 check(feet<=m.box.y,label+' Pico feet hidden by panel');
 records.push({label:label+'-pico-bounds',head,feet,panelTop:m.box.y,clearance:m.box.y-feet,sourceImage:'images/005/reference-v1/Scene3.png'});
}
async function open(story){
 const page=await browser.newPage({viewport:{width:1560,height:720},deviceScaleFactor:1});
 await page.addInitScript(()=>{window.__plan={text:'Yes, we do.'};window.SpeechRecognition=class{
  start(){setTimeout(()=>{this.onstart?.({});setTimeout(()=>{if(__plan.error){this.onerror?.({error:__plan.error});this.stop();return;}const a=[{transcript:__plan.text,confidence:.99}];a.isFinal=true;this.onresult?.({resultIndex:0,results:[a]});setTimeout(()=>this.stop(),50);},100);},30);}
  stop(){if(this.ended)return;this.ended=true;setTimeout(()=>this.onend?.({}),0);}abort(){this.stop();}
 };});
 await page.goto(`http://127.0.0.1:${server.address().port}/browser-fixture.html`);
 await page.evaluate(async story=>{
  const by=id=>document.getElementById(id);by('opening-layer').hidden=true;
  DialogManager.init({dialogueBox:by('dialogue-box'),speaker:by('speaker'),message:by('message'),recognizedText:by('recognized-text'),controls:by('controls')});
  await StoryEvents.emit('story:enter',{story:StoryRegistry.get(story)});
  window.__story=StoryRegistry.get(story);window.__state={storyId:story};window.__done=false;window.__recoveries=[];
  const real=CommunicativeQuestionPresenter.recovery;
  CommunicativeQuestionPresenter.recovery=function(...args){__recoveries.push({result:args[0],options:args[1]});return real.apply(this,args);};
  const flat=[];function walk(ss){ss.forEach(s=>s.type==='sequence'?walk(s.steps):flat.push(s));}walk(__story.steps);
  const i=flat.findIndex(s=>s.type==='question');window.__step=flat[i];window.__next=flat.slice(i+1).find(s=>s.type==='dialogue');
  by('background').style.backgroundImage=`url("${story==='S005'?'images/005/reference-v1/Scene3.png':'images/006/S006-Scene-04.png'}")`;
  if(story==='S007')by('background').style.backgroundImage='none';
  window.__start=()=>{__done=false;StoryEngine.runStep(__step,__state,0,__story).then(()=>__done=true);};
  window.__metrics=()=>{
   const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,scrollTop:e.scrollTop,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,lineHeight:parseFloat(s.lineHeight)||0,hidden:e.hidden,backgroundPosition:s.backgroundPosition,backgroundSize:s.backgroundSize};};
   return {box:rect(by('dialogue-box')),goal:rect(document.querySelector('.dialogue-primary-goal')),info:rect(document.querySelector('.dialogue-information')),message:rect(by('message')),controls:rect(by('controls')),buttons:[...by('controls').querySelectorAll('button')].map(rect),background:rect(by('background')),classes:by('dialogue-box').className,done:__done};
  };
 },story);
 return page;
}
async function sample(page,label,information=false){
 await page.evaluate(async()=>{
  const url=getComputedStyle(document.getElementById('background')).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
  if(url){const image=new Image();image.src=url;await image.decode();}
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 });
 const m=await page.evaluate(()=>__metrics());records.push({label,...m});
 check(m.goal.y>=m.box.y+3-.1,label+' Goal top clipped');
 check(m.goal.bottom<=m.box.bottom-3+.1,label+' Goal bottom clipped');
 check(m.buttons.every(b=>b.y>=m.box.y+3-.1&&b.bottom<=m.box.bottom-3+.1),label+' button clipped');
 check(m.box.scrollTop===0,label+' outer scroll residue');
 if(information){check(m.info.height>=Math.min(m.message.lineHeight,m.message.height)-.1,label+' information less than one line');check(m.info.y>=m.box.y+3-.1&&m.info.bottom<=m.controls.y+.1,label+' information overlap');}
 await page.screenshot({path:path.join(out,label+'.png')});return m;
}
async function continueRecovery(page){await page.getByRole('button',{name:'冒険を続ける',exact:true}).click();await page.getByRole('button',{name:'次へ',exact:true}).click();await page.waitForFunction(()=>__done);}
async function run(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:process.env.QUEST_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 for(const story of ['S005','S006','S007']){
  const page=await open(story);await page.evaluate(()=>__start());
  const normal=await sample(page,story+'-normal');check(Math.abs(normal.box.height-100.2)<.1,story+' normal height');
  if(story==='S005')hotelBounds(normal,story+'-normal');
  await page.getByRole('button',{name:'話す',exact:true}).click();await page.waitForFunction(()=>__recoveries.at(-1)?.result.status==='reject');
  for(const ms of [0,1000,3000,5000]){if(ms)await page.waitForTimeout(ms===1000?1000:2000);const m=await sample(page,story+'-reject-'+ms,true);check(m.message.text.includes('Yes, we do. と聞こえたよ。'),story+' transcript missing');check(!m.done,story+' advanced before choice');check(Math.abs(m.box.height-140)<.1,story+' recovery height');if(story==='S005'&&ms===5000)hotelBounds(m,story+'-reject');}
  await page.getByRole('button',{name:'ピコのサポート',exact:true}).click();const support=await sample(page,story+'-support',true);if(story==='S005')hotelBounds(support,story+'-support');
  await page.getByRole('button',{name:'もう一度話す',exact:true}).click();await page.getByRole('button',{name:'話す',exact:true}).click();await page.waitForFunction(()=>__recoveries.at(-1)?.result.attemptCount===2);const retry=await sample(page,story+'-rereject',true);check(retry.message.text.includes('Yes, we do. と聞こえたよ。'),story+' support overrides latest transcript');await continueRecovery(page);
  await page.evaluate(()=>{__plan={text:QuestionDatabase.get(__step.questionId).communicative.expectedUtterance};__start();});const reset=await sample(page,story+'-reset');check(!reset.message.text.includes('Yes, we do.'),story+' stale transcript');const n=await page.evaluate(()=>__recoveries.length);
  await page.getByRole('button',{name:'話す',exact:true}).click();await page.waitForFunction(()=>__done);check(await page.evaluate(()=>__recoveries.length)===n,story+' ACCEPT added recovery');
  await page.evaluate(()=>{window.__dialogueDone=false;StoryEngine.runStep(__next,__state,0,__story).then(()=>__dialogueDone=true);});
  await page.getByRole('button',{name:'つぎへ',exact:true}).waitFor();const nextDialogue=await page.evaluate(()=>__metrics());check(!nextDialogue.box.text.includes('Yes, we do.'),story+' stale next dialogue');check(nextDialogue.message.text===await page.evaluate(()=>__next.text),story+' ACCEPT next line changed');
  await page.getByRole('button',{name:'つぎへ',exact:true}).click();
  for(const mode of ['unknown','failure']){
   await page.evaluate(mode=>{__plan=mode==='failure'?{error:'no-speech'}:{text:'Yes, we do.'};if(mode==='unknown'){window.__judge=CommunicativeJudge.judge;CommunicativeJudge.judge=async()=>({verdict:'UNKNOWN',source:'test'});}__start();},mode);
   await page.getByRole('button',{name:'話す',exact:true}).click();await page.waitForFunction(mode=>__recoveries.at(-1)?.result.status===(mode==='unknown'?'unknown':'speech-failure'),mode);
   const m=await sample(page,story+'-'+mode,true);check(m.message.text.includes(mode==='unknown'?'Yes, we do. と聞こえたよ。':'うまく聞き取れなかったピコ。'),story+' '+mode+' message');await continueRecovery(page);if(mode==='unknown')await page.evaluate(()=>CommunicativeJudge.judge=__judge);
  }
  console.log(story+' recovery/retention/ACCEPT: checked');await page.close();
 }
 const page=await open('S005');
 await page.evaluate(()=>{
  window.__token=CommunicativeQuestionPresenter.begin();
  // Fixture only: exercise wrapping without editing any production Goal.
  window.__longGoal='二行の目標を最後まで表示してから、相手に伝わる英語で話してください。'.repeat(3);
  CommunicativeQuestionPresenter.speech(()=>new Promise(()=>{}),__token,{},__longGoal,false);
 });
 const multiNormal=await sample(page,'multiline-normal');check(Math.abs(multiNormal.goal.height/multiNormal.goal.lineHeight-2)<.1,'fixture must have exactly two Goal lines');check(Math.abs(multiNormal.box.height-100.2)<.1,'two-line normal height');
 await page.evaluate(()=>{document.getElementById('dialogue-box').scrollTop=100;CommunicativeQuestionPresenter.recovery({status:'reject',answer:'Yes, we do.'},{retry:true,support:true},__token);});
 for(const ms of [0,1000,3000,5000]){if(ms)await page.waitForTimeout(ms===1000?1000:2000);const m=await sample(page,'multiline-reject-'+ms,true);check(Math.abs(m.box.height-140)<.1,'two-line reject height');}
 await page.evaluate(()=>{const info=document.querySelector('.dialogue-information');info.scrollTop=100;document.getElementById('dialogue-box').scrollTop=100;CommunicativeQuestionPresenter.recovery({status:'reject',answer:'Yes, we do.'},{retry:true,support:true,supportText:'相手に伝えたいことを考え、主語と動詞を使って話してみよう。'},__token);});
 const multiSupport=await sample(page,'multiline-support',true);check(multiSupport.info.scrollTop===0,'support information scroll residue');check(Math.abs(multiSupport.box.height-140)<.1,'two-line support height');
 await page.evaluate(()=>{
  DialogManager.showCommunication('ピコ',__longGoal+'\n\n'+'スクロール位置の検証です。'.repeat(100),__longGoal,{support:true});
  document.querySelector('.dialogue-information').scrollTop=100;
 });
 check(await page.evaluate(()=>document.querySelector('.dialogue-information').scrollTop)>0,'scroll fixture must actually scroll');
 await page.evaluate(()=>{CommunicativeQuestionPresenter.recovery({status:'reject',answer:'Yes, we do.'},{retry:true,support:true},__token);});
 const resetScroll=await sample(page,'multiline-scroll-reset',true);check(resetScroll.info.scrollTop===0,'new feedback information scroll residue');
 console.log('multiline/scroll-reset: checked');await page.close();
 const graphic=await open('S006');
 for(const scene of ['04','07','08','10','11','12']){
  for(const mode of ['normal','feedback','support']){
   await graphic.evaluate(({scene,mode})=>{document.getElementById('background').style.backgroundImage=`url("images/006/S006-Scene-${scene}.png")`;DialogManager.showCommunication('ピコ',mode==='normal'?'目標':'目標\n\n'+(mode==='feedback'?'Yes, we do. と聞こえたよ。':'ピコの解説です。'),'目標',{feedback:mode==='feedback',support:mode==='support'});}, {scene,mode});
   const m=await sample(graphic,'S006-Scene'+scene+'-'+mode,mode!=='normal');
   const offset=mode==='normal'?0:(['04','12'].includes(scene)?-12:-32);
   check(m.background.backgroundPosition===`50% ${offset===0?'0%':offset+'px'}`,'S006 '+scene+' '+mode+' background offset changed');
   check(Math.abs(m.background.height-(720-(mode==='normal'?100.2:140)))<.1,'S006 '+scene+' '+mode+' background height changed');
  }
 }
 console.log('S006 six backgrounds: checked');await graphic.close();
}
run().catch(e=>{failures.push(e.stack);}).finally(async()=>{const browserVersion=browser?.version();server.closeAllConnections();server.close();if(browser)await browser.close();fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({sourceHead:process.env.QUEST_SOURCE_SHA||'local',browserVersion,viewport:{width:1560,height:720},nativeRecognition:'simulated',records,failures},null,2));console.log(JSON.stringify({samples:records.length,failures},null,2));if(failures.length)process.exitCode=1;});
