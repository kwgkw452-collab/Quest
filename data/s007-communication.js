(function () {
  "use strict";
  // S007 only. Register once after the shared Question/Judge/Lottery definitions are loaded.
  var data = [
  {
    "id": "s007.communication.1",
    "category": "word",
    "prompt": "メグに「こんにちは」と英語で挨拶を返す。",
    "answers": [
      "Hello!",
      "hello",
      "hi",
      "good afternoon",
      "good evening",
      "hello meg",
      "hi meg",
      "nice to meet you",
      "hello nice to meet you"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "挨拶を返しましょう。短い一言で大丈夫です。",
      "「こんにちは」はHelloです。Hiでも伝わります。",
      "例：Hello!（こんにちは！）"
    ],
    "communicative": {
      "conceptId": "s007.forest.1",
      "difficulty": "starter",
      "promptType": "statement",
      "expectedUtterance": "Hello!",
      "poolId": "s007.communication.1.v1"
    }
  },
  {
    "id": "s007.communication.2",
    "category": "word",
    "prompt": "メグに「何を探しているの？」と尋ねる。",
    "answers": [
      "What are you looking for?",
      "what are you looking for",
      "what you looking for",
      "what bird are you looking for",
      "what do you want to find",
      "looking for what",
      "what are you searching for"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "何を探しているかを尋ねます。「何？」から始めます。",
      "「何」はWhat。「探している」はlooking forです。",
      "例：What are you looking for?（何を探しているの？）"
    ],
    "communicative": {
      "conceptId": "s007.forest.2",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "What are you looking for?",
      "poolId": "s007.communication.2.v1"
    }
  },
  {
    "id": "s007.communication.3",
    "category": "word",
    "prompt": "メグに「鳥の声が聞こえる？」と尋ねる。",
    "answers": [
      "Can you hear the bird?",
      "can you hear the bird",
      "can you hear it",
      "can you hear the birds",
      "do you hear that",
      "do you hear the bird",
      "hear the bird",
      "can you hear a bird"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "声が聞こえるか、相手に尋ねます。",
      "「聞こえる」はhear。「できますか」はCan youです。",
      "例：Can you hear the bird?（鳥の声が聞こえる？）"
    ],
    "communicative": {
      "conceptId": "s007.forest.3",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Can you hear the bird?",
      "poolId": "s007.communication.3.v1"
    }
  },
  {
    "id": "s007.communication.4",
    "category": "word",
    "prompt": "メグに「見て、ひな鳥だ！」と知らせる。",
    "answers": [
      "Look! A baby bird!",
      "look a baby bird",
      "a baby bird",
      "there is a baby bird",
      "i can see a little bird",
      "a baby happiness bird",
      "look a little bird",
      "there is a small bird"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "小さな鳥を見つけたと知らせます。",
      "「見て」はLook。「ひな鳥」はa baby birdです。",
      "例：Look! A baby bird!（見て、ひな鳥だ！）"
    ],
    "communicative": {
      "conceptId": "s007.forest.4",
      "difficulty": "starter",
      "promptType": "statement",
      "expectedUtterance": "Look! A baby bird!",
      "poolId": "s007.communication.4.v1"
    }
  },
  {
    "id": "s007.communication.5",
    "category": "word",
    "prompt": "バーニーに「その鳥に近づかないで」と伝える。",
    "answers": [
      "Don't go near it.",
      "do not go near it",
      "do not go near the bird",
      "stay away from the bird",
      "keep your distance",
      "do not get close",
      "not too close",
      "please stay here",
      "stay back",
      "do not touch the bird"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "近づかないように伝えます。禁止の言葉を使います。",
      "「〜しないで」はDon’t。「近づく」はgo nearです。",
      "例：Don't go near it.（その鳥に近づかないで。）"
    ],
    "communicative": {
      "conceptId": "s007.forest.5",
      "difficulty": "starter",
      "promptType": "request",
      "expectedUtterance": "Don't go near it.",
      "poolId": "s007.communication.5.v1"
    }
  },
  {
    "id": "s007.communication.6",
    "category": "word",
    "prompt": "心配そうなメグに「心配しないで」と声をかける。",
    "answers": [
      "Don't worry.",
      "do not worry",
      "no worries",
      "it is ok",
      "it will be ok",
      "everything is all right",
      "you do not need to worry",
      "no need to worry",
      "its okay"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "心配している相手を安心させます。",
      "「心配する」はworry。「しないで」はDon’tです。",
      "例：Don't worry.（心配しないで。）"
    ],
    "communicative": {
      "conceptId": "s007.forest.6",
      "difficulty": "starter",
      "promptType": "statement",
      "expectedUtterance": "Don't worry.",
      "poolId": "s007.communication.6.v1"
    }
  },
  {
    "id": "s007.communication.7",
    "category": "word",
    "prompt": "写真を急ごうとするメグに「急がなくていいよ」と伝える。",
    "answers": [
      "Take your time.",
      "take your time",
      "no hurry",
      "no rush",
      "do not hurry",
      "we have time",
      "you can wait",
      "take time",
      "you do not have to hurry"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "相手を急がせず、ゆっくりでよいと伝えます。",
      "「あなたの時間を使って」という決まった表現です。Take your...と続けます。",
      "例：Take your time.（急がなくていいよ。）"
    ],
    "communicative": {
      "conceptId": "s007.forest.7",
      "difficulty": "starter",
      "promptType": "statement",
      "expectedUtterance": "Take your time.",
      "poolId": "s007.communication.7.v1"
    }
  },
  {
    "id": "s007.communication.8",
    "category": "word",
    "prompt": "仲間に「ここで待とう」と提案する。",
    "answers": [
      "Let's wait.",
      "let us wait",
      "let us wait here",
      "we can wait",
      "shall we wait",
      "we should stay here",
      "wait here please",
      "please wait here",
      "we should wait"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "母鳥を追わず、その場で待つ提案をします。",
      "「〜しよう」はLet’s。「待つ」はwaitです。",
      "例：Let's wait.（待とう。）"
    ],
    "communicative": {
      "conceptId": "s007.forest.8",
      "difficulty": "starter",
      "promptType": "request",
      "expectedUtterance": "Let's wait.",
      "poolId": "s007.communication.8.v1"
    }
  },
  {
    "id": "s007.communication.9",
    "category": "word",
    "prompt": "バーニーに「静かにしてね」と伝える。",
    "answers": [
      "Be quiet, please.",
      "be quiet please",
      "please be quiet",
      "quiet please",
      "keep quiet",
      "do not make a noise",
      "please lower your voice",
      "shh",
      "speak quietly",
      "be quiet"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "大きな声を出さないように頼みます。",
      "「静かな」はquiet。「〜でいて」はBeです。",
      "例：Be quiet, please.（静かにしてね。）"
    ],
    "communicative": {
      "conceptId": "s007.forest.9",
      "difficulty": "starter",
      "promptType": "request",
      "expectedUtterance": "Be quiet, please.",
      "poolId": "s007.communication.9.v1"
    }
  },
  {
    "id": "s007.communication.10",
    "category": "word",
    "prompt": "メグに「すてきな写真だね」と伝える。",
    "answers": [
      "Great picture!",
      "great picture",
      "a great picture",
      "nice photo",
      "beautiful picture",
      "that is a lovely photo",
      "i like your photo",
      "it is beautiful",
      "great photo",
      "nice picture",
      "beautiful photo",
      "what a beautiful picture"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "撮れた写真をほめます。",
      "「すてきな」はgreatやnice。「写真」はpictureやphotoです。",
      "例：Great picture!（すてきな写真だね！）"
    ],
    "communicative": {
      "conceptId": "s007.forest.10",
      "difficulty": "starter",
      "promptType": "statement",
      "expectedUtterance": "Great picture!",
      "poolId": "s007.communication.10.v1"
    }
  }
];
  function norm(value) {
    return String(value || "").toLowerCase().replace(/[’‘]/g, "'")
      .replace(/\b(don't|dont)\b/g, "do not")
      .replace(/\b(let's|lets)\b/g, "let us")
      .replace(/\b(it's|its)\b/g, "it is")
      .replace(/\b(you're|youre)\b/g, "you are")
      .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }
  var variants = [
  [
    "hello",
    "hi",
    "good afternoon",
    "good evening",
    "hello meg",
    "hi meg",
    "nice to meet you",
    "hello nice to meet you"
  ],
  [
    "what are you looking for",
    "what you looking for",
    "what bird are you looking for",
    "what do you want to find",
    "looking for what",
    "what are you searching for"
  ],
  [
    "can you hear the bird",
    "can you hear it",
    "can you hear the birds",
    "do you hear that",
    "do you hear the bird",
    "hear the bird",
    "can you hear a bird"
  ],
  [
    "look a baby bird",
    "a baby bird",
    "there is a baby bird",
    "i can see a little bird",
    "a baby happiness bird",
    "look a little bird",
    "there is a small bird"
  ],
  [
    "do not go near it",
    "do not go near the bird",
    "stay away from the bird",
    "keep your distance",
    "do not get close",
    "not too close",
    "please stay here",
    "stay back",
    "do not touch the bird"
  ],
  [
    "do not worry",
    "no worries",
    "it is ok",
    "it will be ok",
    "everything is all right",
    "you do not need to worry",
    "no need to worry",
    "its okay"
  ],
  [
    "take your time",
    "no hurry",
    "no rush",
    "do not hurry",
    "we have time",
    "you can wait",
    "take time",
    "you do not have to hurry"
  ],
  [
    "let us wait",
    "let us wait here",
    "we can wait",
    "shall we wait",
    "we should stay here",
    "wait here please",
    "please wait here",
    "we should wait"
  ],
  [
    "be quiet please",
    "please be quiet",
    "quiet please",
    "keep quiet",
    "do not make a noise",
    "please lower your voice",
    "shh",
    "speak quietly",
    "be quiet"
  ],
  [
    "great picture",
    "a great picture",
    "nice photo",
    "beautiful picture",
    "that is a lovely photo",
    "i like your photo",
    "it is beautiful",
    "great photo",
    "nice picture",
    "beautiful photo",
    "what a beautiful picture"
  ]
];
  var rules = data.map(function (d, index) {
    var allowed = variants[index].map(norm);
    return { conceptId: d.communicative.conceptId, variants: d.answers.slice(),
      difficulty: "starter", promptType: d.communicative.promptType,
      accept: function (value) { var t = norm(value); return !!t && allowed.indexOf(t) !== -1; },
      reject: function (value) { var t = norm(value); return !!t && allowed.indexOf(t) === -1; }
    };
  });
  var pools = data.map(function (d) {
    return { poolId: d.communicative.poolId, items: [{ itemId: d.id, conceptId: d.communicative.conceptId,
      displayValue: d.prompt, prompts: [{ promptType: d.communicative.promptType,
        difficulty: "starter", expectedUtterance: d.communicative.expectedUtterance,
        acceptedVariants: d.answers.slice() }] }] };
  });
  data.forEach(function (d) { QuestionDatabase.register(d); });
  Array.prototype.push.apply(CommunicativeJudgeRuleData, rules);
  Array.prototype.push.apply(LotteryPoolData, pools);
  LotteryEngine.init(LotteryPoolData);
  window.S007DraftCommunicationMetadata = { status: "DRAFT_NOT_APPROVED", source: "S007-Story-Package-V1-Draft" };
})();
