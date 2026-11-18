"use strict";
// Deterministic browser check: only the speech-input boundary is simulated.
// No CSS, Story, Judge, Audio implementation or shared controller is patched.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { createRequire } = require("node:module");
const runtimeRequire = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ?
  createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "_s006.js")) : require;
const { chromium } = runtimeRequire("playwright");
const root = path.resolve(__dirname, "..");
const rows = JSON.parse(fs.readFileSync(path.join(__dirname, "s006-communication-v2-cases.json"), "utf8"));
const output = process.env.S006_V2_BROWSER_OUTPUT || "/tmp/s006-v2-browser";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".mp3": "audio/mpeg", ".json": "application/json" };
const results = { browser: null, speech: "injected transcript / no-speech boundary; real Judge/Flow/Story/UI", questions: [], errors: [] };
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if(err) { res.writeHead(404).end(); return; }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    res.end(data);
  });
});
let browser;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.S006_CHROMIUM_EXECUTABLE || undefined,
    args: ["--no-sandbox"]
  });
  results.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 1560, height: 900 } });
  page.on("pageerror", e => results.errors.push(e.message));
  await page.goto("http://127.0.0.1:" + server.address().port + "/dev.html?jump=S006");
  await page.waitForFunction(() => !!window.SpeechStartController && !!window.QuestionDatabase);
  await page.evaluate(() => {
    window.__s006V2Inputs = [];
    SpeechStartController.startListening = async function () {
      const item = window.__s006V2Inputs.shift();
      if (!item) throw new Error("no-speech");
      if (item.error) throw new Error(item.error);
      return item.text;
    };
  });
  const snapshot = () => page.evaluate(() => {
    function size(sel) {
      const e = document.querySelector(sel); if(!e) return null;
      const r=e.getBoundingClientRect(), s=getComputedStyle(e);
      return { text: e.textContent, width:r.width, height:r.height, cssHeight:s.height,
        display:s.display, hidden:e.hidden, scrollHeight:e.scrollHeight, clientHeight:e.clientHeight };
    }
    const bg=document.querySelector("#background");
    return {
      dialogue: size("#dialogue-box"), information:size(".dialogue-information"),
      message:size("#message"), goal:size(".dialogue-primary-goal"),
      background:getComputedStyle(bg).backgroundImage,
      backgroundPosition:getComputedStyle(bg).backgroundPosition,
      backgroundSize:getComputedStyle(bg).backgroundSize,
      status:window.CommunicativeQuestionFlowController.getResult()?.status
    };
  });
  async function reachGate(goal) {
    for (let i=0;i<80;i++) {
      if (await page.getByRole("button",{name:"話す",exact:true}).count()) {
        await page.waitForFunction(g=>document.querySelector(".dialogue-primary-goal")?.textContent===g,goal);
        return;
      }
      const next=page.getByRole("button",{name:"次へ",exact:true});
      if(await next.count()) await next.click();
      else await page.waitForTimeout(60);
    }
    throw new Error("Could not reach: "+goal);
  }
  async function input(item) {
    await page.evaluate(value=>window.__s006V2Inputs.push(value),item);
    await page.getByRole("button",{name:"話す",exact:true}).click();
    await page.getByRole("button",{name:"もう一度話す",exact:true}).waitFor();
  }
  for(const row of rows) {
    await reachGate(row.goal);
    const record={q:row.q,normal:await snapshot(),hints:[],feedback:[]};
    await input({text:row.reject[0]});
    assert.equal((await snapshot()).status,"reject");
    record.feedback.push({seconds:0,...await snapshot()});
    if(row.q===7) {
      for(const delta of [1000,2000,2000]) {
        await page.waitForTimeout(delta);
        record.feedback.push({seconds:record.feedback.length===1?1:record.feedback.length===2?3:5,...await snapshot()});
      }
    } else {
      await page.waitForTimeout(5000);
      record.feedback.push({seconds:5,...await snapshot()});
    }
    await page.screenshot({path:path.join(output,"q"+row.q+"-reject-5s.png")});
    for(let stage=0;stage<4;stage++) {
      await page.getByRole("button",{name:"ピコのサポート",exact:true}).click();
      const expected=row.hints[Math.min(stage,2)];
      await page.waitForFunction(t=>document.querySelector("#message")?.textContent===t,expected);
      record.hints.push(await snapshot());
    }
    await page.getByRole("button",{name:"もう一度話す",exact:true}).click();
    await input({text:row.unknown[0]});
    record.unknown=await snapshot();assert.equal(record.unknown.status,"unknown");
    await page.getByRole("button",{name:"もう一度話す",exact:true}).click();
    await input({error:"no-speech"});
    record.speechFailure=await snapshot();assert.equal(record.speechFailure.status,"speech-failure");
    await page.getByRole("button",{name:"もう一度話す",exact:true}).click();
    await page.evaluate(text=>window.__s006V2Inputs.push({text}),row.model);
    await page.getByRole("button",{name:"話す",exact:true}).click();
    await page.waitForFunction(()=>window.CommunicativeQuestionFlowController.getResult()?.status==="success");
    record.accept=await snapshot();
    record.visibleFeedback=record.feedback.every(x=>x.message.height>0 && x.information.height>0 &&
      x.message.text.includes("と聞こえたよ"));
    results.questions.push(record);
    console.log("Q"+row.q+": data/4 hint clicks/retry/UNKNOWN/no-speech/ACCEPT PASS; visible REJECT="+record.visibleFeedback);
  }
  assert.equal(results.questions.length,10);
  assert.deepEqual(results.errors,[]);
  console.log("S006 V2 browser: 10 real Story Communication paths completed. Visibility recorded separately.");
})().catch(e=>{
  results.failure=e.stack;console.error(e);process.exitCode=1;
}).finally(async()=>{
  fs.writeFileSync(path.join(output,"results.json"),JSON.stringify(results,null,2));
  if(browser)await browser.close();
  server.close();
});

