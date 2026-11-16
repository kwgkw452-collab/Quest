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
      "Hi!",
      "Hello, Meg!",
      "Hi Meg!",
      "Good morning!",
      "Morning!",
      "Good afternoon!",
      "Good evening!",
      "Nice to meet you!",
      "Nice to meet you, Meg!"
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
    "prompt": "メグに「あなたは鳥の写真を撮りますか？」と尋ねよう。",
    "answers": [
      "Do you take pictures of birds?",
      "Do you take pictures of a bird?",
      "Do you take picture of bird?",
      "Do you take picture of birds?",
      "Do you take a picture of a bird?",
      "Do you take a picture?",
      "Do you take pictures?",
      "Do you take photos of birds?",
      "Do you take photos?",
      "Do you take a photo?",
      "Did you take pictures of birds?",
      "Did you take a picture of a bird?",
      "Did you take a picture?",
      "Did you take pictures?",
      "Did you take photos?",
      "You take pictures of birds?",
      "You take pictures?",
      "You take photos?",
      "Do you take bird pictures?",
      "Do you like taking pictures of birds?",
      "Do you like to take pictures?",
      "Did you take picture of bird?",
      "Do you take pictures of bird?",
      "Did you take pictures of bird?",
      "Do you take photos of a bird?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "鳥の写真を撮るか、メグに質問しよう。",
      "「あなたは〜しますか？」はDo you ...?。「写真を撮る」はtake picturesです。",
      "例：Do you take pictures of birds?（あなたは鳥の写真を撮りますか？）"
    ],
    "communicative": {
      "conceptId": "s007.forest.2",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Do you take pictures of birds?",
      "poolId": "s007.communication.2.v1"
    }
  },
  {
    "id": "s007.communication.3",
    "category": "word",
    "prompt": "みんなに「ゆっくり歩こう」と提案しよう。",
    "answers": [
      "Let's walk slowly.",
      "Let's go slowly.",
      "Let's walk slow.",
      "Let's go slow.",
      "Let us walk slowly.",
      "Let us go slowly.",
      "We can walk slowly.",
      "We should walk slowly.",
      "Walk slowly.",
      "Slowly, please.",
      "Let's walk.",
      "Please walk slowly.",
      "Let's move slowly."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "みんなに歩く速さをゆっくりにしようと提案しよう。",
      "「〜しよう」はLet's。「歩く」はwalk。「ゆっくり」はslowlyです。",
      "例：Let's walk slowly.（ゆっくり歩こう。）"
    ],
    "communicative": {
      "conceptId": "s007.forest.3",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Let's walk slowly.",
      "poolId": "s007.communication.3.v1"
    }
  },
  {
    "id": "s007.communication.4",
    "category": "word",
    "prompt": "メグに「あのひな鳥を見て！」と言おう。",
    "answers": [
      "Look at the baby bird!",
      "Look at that baby bird!",
      "Look at the bird!",
      "Look at that bird!",
      "Look at a bird!",
      "Look at bird!",
      "Look at the birds!",
      "Look at birds!",
      "Look at the baby birds!",
      "Look at a baby bird!",
      "Please look at the bird!",
      "Look at that beautiful bird!",
      "Look! A baby bird!",
      "A baby bird!",
      "There is a baby bird!"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "メグに、ひな鳥を見るよう伝えよう。",
      "「〜を見て」はLook at ...。「鳥」はbirdです。",
      "例：Look at the baby bird!（あのひな鳥を見て！）"
    ],
    "communicative": {
      "conceptId": "s007.forest.4",
      "difficulty": "starter",
      "promptType": "statement",
      "expectedUtterance": "Look at the baby bird!",
      "poolId": "s007.communication.4.v1"
    }
  },
  {
    "id": "s007.communication.5",
    "category": "word",
    "prompt": "ひな鳥に近づこうとするバーニーに「動かないで！」と言おう。",
    "answers": [
      "Don't move!",
      "Do not move!",
      "Please don't move.",
      "Don't go!",
      "Please don't go.",
      "Don't go there!",
      "Stop!",
      "Stop there!",
      "Stay here!",
      "Please stay here!",
      "Wait!",
      "Wait here!",
      "Do not go near it.",
      "Don't go near the bird!",
      "Don't touch the bird!"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "バーニーがひな鳥に近づこうとしているよ。まず止めよう。",
      "「〜しないで」はDon't。「動く」はmoveです。",
      "例：Don't move!（動かないで！）"
    ],
    "communicative": {
      "conceptId": "s007.forest.5",
      "difficulty": "starter",
      "promptType": "request",
      "expectedUtterance": "Don't move!",
      "poolId": "s007.communication.5.v1"
    }
  },
  {
    "id": "s007.communication.6",
    "category": "word",
    "prompt": "心配そうなメグに「心配しないで」と声をかける。",
    "answers": [
      "Don't worry.",
      "Do not worry.",
      "Don't worry, Meg.",
      "Don't be nervous.",
      "Do not be nervous.",
      "Not nervous.",
      "No worries.",
      "It's OK.",
      "It's all right.",
      "It is OK.",
      "You're OK.",
      "Everything is OK.",
      "No problem.",
      "No need to worry.",
      "It will be OK.",
      "You will be OK."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "心配しているメグを安心させよう。",
      "「心配しないで」はDon't worry.。「大丈夫」はIt's OK.でも伝わります。",
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
    "prompt": "写真を撮ろうとするメグに「ここで待ってください」と頼もう。",
    "answers": [
      "Please wait here.",
      "Wait here.",
      "Please stay here.",
      "Stay here, please.",
      "Can you wait here?",
      "Could you wait here?",
      "Please wait.",
      "Wait here please.",
      "Stay here.",
      "Wait a little here."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "メグに、この場所で待ってもらおう。",
      "「待つ」はwait。「ここで」はhere。「〜してください」はPleaseを使います。",
      "例：Please wait here.（ここで待ってください。）"
    ],
    "communicative": {
      "conceptId": "s007.forest.7",
      "difficulty": "starter",
      "promptType": "statement",
      "expectedUtterance": "Please wait here.",
      "poolId": "s007.communication.7.v1"
    }
  },
  {
    "id": "s007.communication.8",
    "category": "word",
    "prompt": "見に行こうとするコングに「ちょっと待って」と言おう。",
    "answers": [
      "Just a moment.",
      "Wait a minute.",
      "Just a second.",
      "One moment.",
      "Hold on.",
      "Wait!",
      "Wait a moment.",
      "One second.",
      "Just a minute.",
      "A moment, please.",
      "Please wait a moment."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "コングが見に行こうとしているよ。少し待ってもらおう。",
      "「ちょっと待って」は決まった表現Just a moment.です。Wait a minute.でも大丈夫。",
      "例：Just a moment.（ちょっと待って。）"
    ],
    "communicative": {
      "conceptId": "s007.forest.8",
      "difficulty": "starter",
      "promptType": "request",
      "expectedUtterance": "Just a moment.",
      "poolId": "s007.communication.8.v1"
    }
  },
  {
    "id": "s007.communication.9",
    "category": "word",
    "prompt": "大声を出したバーニーに「静かにしてください」と言おう。",
    "answers": [
      "Be quiet, please.",
      "Please be quiet.",
      "Be quiet!",
      "Quiet, please.",
      "Shh!",
      "Shhh!",
      "Keep quiet.",
      "Quiet!",
      "Please lower your voice.",
      "Don't make a noise."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "バーニーの大きな声を小さくしてもらおう。",
      "「静かに」はBe quiet.。「お願いします」はpleaseです。",
      "例：Be quiet, please.（静かにしてください。）"
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
    "prompt": "メグが撮った写真を見て「すてきな写真だね！」とほめよう。",
    "answers": [
      "Nice picture!",
      "Great picture!",
      "Beautiful picture!",
      "Good picture!",
      "Nice photo!",
      "Great photo!",
      "Beautiful photo!",
      "Wonderful picture!",
      "What a wonderful picture!",
      "What a nice picture!",
      "What a beautiful picture!",
      "What a great picture!",
      "What a beautiful photo!",
      "How nice it is!",
      "How beautiful!",
      "It's wonderful!",
      "I like your picture!",
      "I like your photo!",
      "What a nice photo!",
      "How wonderful!",
      "Such a nice picture!"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "メグの撮った写真をほめよう。",
      "「すてきな写真」はnice pictureやgreat picture。What a ...! でも気持ちが伝わります。",
      "例：Nice picture!（すてきな写真だね！）"
    ],
    "communicative": {
      "conceptId": "s007.forest.10",
      "difficulty": "starter",
      "promptType": "statement",
      "expectedUtterance": "Nice picture!",
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
  var variants = data.map(function (d) { return d.answers.slice(); });
  var rules = data.map(function (d, index) {
    var allowed = variants[index].map(norm);
    return { conceptId: d.communicative.conceptId, variants: d.answers.slice(),
      difficulty: "starter", promptType: d.communicative.promptType,
      accept: function (value) {
        var t = norm(value);
        if (!t || /\b(?:do not|dont|never)\b/.test(t) && (index === 1 || index === 3)) return false;
        if (allowed.indexOf(t) !== -1) return true;
        if (index === 1) return /\byou\b/.test(t) && /\b(?:take|takes|took)\b.*\b(?:picture|pictures|photo|photos)\b/.test(t);
        if (index === 3) return /\blook at\b/.test(t) && /\bbirds?\b/.test(t);
        return false;
      },
      reject: function (value) { var t = norm(value); return !!t && !this.accept(value); }
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
