(function () {
  "use strict";

  var monsters = Object.create(null);

  function normalizeId(id) {
    var text = String(id || "").toLowerCase();
    if (/^\d+$/.test(text)) text = "m" + text.padStart(3, "0");
    if (!/^m\d{3}$/.test(text)) throw new Error("Monster id must use m000 format: " + text);
    return text;
  }

  function clone(value) {
    if (!value) return null;
    return {
      monsterId: value.monsterId,
      questionId: value.questionId,
      name: value.name,
      image: Object.assign({}, value.image),
      effect: Object.assign({}, value.effect),
      audio: Object.assign({}, value.audio),
      encyclopedia: Object.assign({}, value.encyclopedia),
      presentation: Object.assign({}, value.presentation),
      hintNpcId: value.hintNpcId,
      campIds: Array.isArray(value.campIds) ? value.campIds.slice() : [],
      battle: Object.assign({}, value.battle, {
        graphicFlow: value.battle && value.battle.graphicFlow ? Object.assign({}, value.battle.graphicFlow) : null,
        answerVisuals: value.battle && value.battle.answerVisuals ? Object.assign({}, value.battle.answerVisuals) : null,
        supportMessages: Array.isArray(value.battle && value.battle.supportMessages) ? value.battle.supportMessages.slice() : [],
        pseudoCampMessages: Array.isArray(value.battle && value.battle.pseudoCampMessages) ? value.battle.pseudoCampMessages.slice() : [],
        progressMessages: Array.isArray(value.battle && value.battle.progressMessages) ? value.battle.progressMessages.slice() : [],
        completionDialogue: Array.isArray(value.battle && value.battle.completionDialogue) ? value.battle.completionDialogue.map(function (line) { return Object.assign({}, line); }) : []
      })
    };
  }

  function register(definition) {
    if (!definition) throw new Error("Monster definition is required.");
    var monsterId = normalizeId(definition.monsterId || definition.id);
    if (!definition.questionId) throw new Error("Monster needs a questionId: " + monsterId);
    if (monsters[monsterId]) throw new Error("Monster is already registered: " + monsterId);

    monsters[monsterId] = {
      monsterId: monsterId,
      questionId: String(definition.questionId),
      name: definition.name ? String(definition.name) : monsterId,
      image: Object.assign({ normal: null, defeated: null }, definition.image || {}),
      effect: Object.assign({ intro: null, success: null, retreat: null }, definition.effect || {}),
      audio: Object.assign({ warning: null, intro: null, success: null, retreat: null }, definition.audio || {}),
      encyclopedia: Object.assign({}, definition.encyclopedia || {}),
      presentation: Object.assign({ background: null, className: null }, definition.presentation || {}),
      hintNpcId: definition.hintNpcId ? String(definition.hintNpcId) : "pico",
      campIds: Array.isArray(definition.campIds) ? definition.campIds.slice() : [],
      battle: Object.assign({
        guide: null,
        graphicFlow: null,
        answerVisuals: null,
        requiredUniqueAnswers: 1,
        dictionaryId: null,
        duplicateMessage: "One more word!",
        supportMessages: [],
        pseudoCampMessages: [],
        progressMessages: [],
        completionDialogue: []
      }, definition.battle || {})
    };
    monsters[monsterId].battle.supportMessages = Array.isArray(monsters[monsterId].battle.supportMessages) ? monsters[monsterId].battle.supportMessages.slice() : [];
    monsters[monsterId].battle.pseudoCampMessages = Array.isArray(monsters[monsterId].battle.pseudoCampMessages) ? monsters[monsterId].battle.pseudoCampMessages.slice() : [];
    monsters[monsterId].battle.progressMessages = Array.isArray(monsters[monsterId].battle.progressMessages) ? monsters[monsterId].battle.progressMessages.slice() : [];
    monsters[monsterId].battle.completionDialogue = Array.isArray(monsters[monsterId].battle.completionDialogue) ? monsters[monsterId].battle.completionDialogue.map(function (line) { return Object.assign({}, line); }) : [];
    return clone(monsters[monsterId]);
  }

  function get(id) {
    var monsterId;
    try { monsterId = normalizeId(id); } catch (_) { return null; }
    return clone(monsters[monsterId]);
  }

  function has(id) { return get(id) !== null; }
  function all() { return Object.keys(monsters).sort().map(get); }

  window.MonsterDatabase = {
    register: register,
    get: get,
    has: has,
    all: all,
    normalizeId: normalizeId
  };

  register({
    monsterId: "m001",
    questionId: "word.fruit",
    name: "フルーツモンスター",
    image: {
      normal: "images/monsters/m001_normal.png?v=user-final-20260816",
      damage: "images/monsters/m001_damage.png?v=user-final-20260816",
      explosion: "images/monsters/m001_explosion.png?v=user-final-20260816",
      fruits: "images/monsters/m001_fruits.png?v=user-final-20260816",
      defeated: "images/monsters/m001_fruits.png?v=user-final-20260816"
    },
    effect: { intro: "shake", success: "flash", retreat: "fadeOut" },
    audio: { warning: "monsterWarningTensePiano" },
    encyclopedia: { entryId: "m001" },
    hintNpcId: "pico",
    campIds: ["CAMP_M001_1", "CAMP_M001_2", "CAMP_M001_3"],
    battle: {
      introHoldMs: 3000,
      graphicFlow: {
        normal: "normal",
        reaction: "damage",
        postReaction: "damage",
        purify: "explosion",
        complete: "fruits",
        reactionMs: 650,
        purifyMs: 1000
      },
      playPurifySe: false,
      defeatSe: "monsterDefeatExplosion",
      defeatSeVolume: 0.45,
      requiredUniqueAnswers: 3,
      dictionaryId: "fruit.v1",
      duplicateMessage: "One more fruit!",
      supportMessages: [
        "ポンコツでごめんね。ピコの辞書にはないみたい。別のフルーツの言葉を言ってみて！",
        "大丈夫ピコ！色や形を思い出して、知っている別のフルーツを英語で言ってみて！",
        "あと一歩ピコ！いったん休んで、フルーツの英語を調べてみよう！"
      ],
      pseudoCampMessages: [
        "ネットや辞書でフルーツの英語を1つ調べてみてね。見つけたら、もう一度挑戦しよう！",
        "画像検索で好きなフルーツを探して、英語の名前を確認してみてね！",
        "Apple, banana, orange以外にもたくさんあるよ。まだ使っていないフルーツを調べてみよう！"
      ]
    }
  });

  register({
    monsterId: "m002",
    questionId: "word.single-digit-number",
    name: "ナンバー・モンスター",
    image: {
      normal: "images/monsters/m002_normal.png?v=user-final-20260816",
      attack: "images/monsters/m002_attack.png?v=user-final-20260816",
      reaction: "images/monsters/m002_reaction.png?v=user-final-20260816",
      purify: "images/monsters/m002_purify.png?v=user-final-20260816",
      smile: "images/monsters/m002_smile.png?v=user-final-20260816",
      defeated: "images/monsters/m002_smile.png?v=user-final-20260816"
    },
    effect: { intro: "shake", success: "number-monster-hit", retreat: "fadeOut" },
    audio: { warning: "monsterWarningTensePiano" },
    encyclopedia: { entryId: "02", targetCategory: "1桁の数字" },
    hintNpcId: "pico",
    campIds: ["CAMP_M002_1", "CAMP_M002_2", "CAMP_M002_3"],
    battle: {
      introHoldMs: 3000,
      guide: "マスター！数字が大好きなお化けだ！\n知っている『1桁の数字』を英語で言ってあげよう！\n1つずつ、ゆっくりでいいからね！",
      graphicFlow: {
        normal: "normal",
        reaction: "reaction",
        purify: "purify",
        complete: "smile",
        reactionMs: 650,
        purifyMs: 1000
      },
      playPurifySe: true,
      requiredUniqueAnswers: 3,
      dictionaryId: "number.single-digit.v1",
      completionMessage: "数字をたくさん聞いて満足したナンバー・モンスターは、うれしそうに消えていった。",
      duplicateMessage: "同じ数字は使えないピコ！別の1桁の数字を言ってみよう！",
      supportMessages: [
        "ポンコツでごめんね。ピコの辞書にはないみたい。別の1桁の数字を言ってみて！",
        "大丈夫ピコ！one, two, threeのような、知っている数字をゆっくり言ってみよう！",
        "あと一歩ピコ！いったん休んで、1桁の数字の英語を調べてみよう！"
      ],
      pseudoCampMessages: [
        "1から9までの数字を1つ選んで、英語で何と言うか調べてみてね。",
        "数字を英語で数えてみよう。まだ使っていない数字を探してね！",
        "one, two, three以外にもあるよ。1桁の数字を英語で確認してみよう！"
      ]
    }
  });

  register({
    monsterId: "m003",
    questionId: "word.season",
    name: "シーズン・ツリー",
    image: {
      normal: "images/monsters/season_tree_03.png",
      reaction: "images/monsters/season_tree_hit.png",
      spring: "images/monsters/season_tree_spring.png",
      summer: "images/monsters/season_tree_summer.png",
      autumn: "images/monsters/season_tree_autumn.png",
      winter: "images/monsters/season_tree_winter.png",
      restored: "images/monsters/season_tree_02.png",
      defeated: "images/monsters/season_tree_02.png"
    },
    effect: { intro: "shake", success: "flash", retreat: "fadeOut" },
    audio: { warning: "monsterWarningReveal" },
    encyclopedia: { entryId: "03", englishName: "Season Tree", targetCategory: "季節の英語" },
    presentation: { background: "forestClearing", className: "monster-giant-tree" },
    hintNpcId: "pico",
    campIds: ["CAMP_M003_1", "CAMP_M003_2", "CAMP_M003_3"],
    battle: {
      postRecoveryBgm: "zephyrFields",
      postRecoveryBgmVolume: 0.20,
      postRecoveryBgmFadeInMs: 900,
      guide: "あの木を見て！\nあの木は季節が分からなくなって、混乱しているピコ。\n温暖化とかが影響しているのかもしれないね？\n正しい季節を教えてあげないと、枯れちゃうかも？\nマスター、季節の英語を4つ言って助けてあげよう！",
      graphicFlow: {
        normal: "normal",
        reaction: "reaction",
        postReaction: "reaction",
        complete: "restored",
        reactionMs: 650,
        purifyMs: 0
      },
      playPurifySe: true,
      answerVisuals: {
        spring: "spring",
        summer: "summer",
        autumn: "autumn",
        winter: "winter"
      },
      finalAnswerVisualMs: 2000,
      requiredUniqueAnswers: 4,
      dictionaryId: "season.v1",
      duplicateMessage: "その季節はもう教えたピコ！ 別の季節を言ってみよう！",
      progressMessages: [
        "正解！ あと3つ！",
        "正解！ あと2つ！",
        "正解！ あと1つ！",
        "やった！ 四季がそろったピコ！"
      ],
      supportMessages: [
        "大丈夫ピコ！春・夏・秋・冬を英語で考えてみよう！",
        "もう一度、知っている季節の英語をゆっくり言ってみよう！",
        "少し休んで、季節の英語を一緒に思い出そうピコ！"
      ],
      pseudoCampMessages: [
        "春・夏・秋・冬を英語で考えてみよう！",
        "『春』は s... から始まるよ！",
        "例えば、春は spring だよ！"
      ],
      completionDialogue: [
        { speaker: "Season Tree", text: "Thank you very much!", voiceKey: "voice_c05_m003_001", supportText: "どうもありがとう！" },
        { speaker: "Season Tree", text: "I feel better.", voiceKey: "voice_c05_m003_002", supportText: "元気になったよ。" },
        { speaker: "Season Tree", text: "Many animals and birds will come to me!", voiceKey: "voice_c05_m003_003", supportText: "たくさんの動物や鳥たちが、私のところへ来てくれるよ！" },
        { speaker: "ピコ", text: "よかったピコ！ 元気になったね！" },
        { speaker: "Season Tree", text: "But something is strange.", voiceKey: "voice_c05_m003_004", supportText: "でも、何かがおかしい。" },
        { speaker: "Season Tree", text: "Summer is too hot.", voiceKey: "voice_c05_m003_005", supportText: "夏が暑すぎる。" },
        { speaker: "Season Tree", text: "Winter is too short.", voiceKey: "voice_c05_m003_006", supportText: "冬が短すぎる。" },
        { speaker: "ピコ", text: "やっぱり何かおかしいピコ……。" },
        { speaker: "ピコ", text: "この木だけの問題じゃないのかもしれないね。" },
        { speaker: "Season Tree", text: "Animals need trees.", voiceKey: "voice_c05_m003_007", supportText: "動物たちには木が必要だ。" },
        { speaker: "Season Tree", text: "Birds need trees, too.", voiceKey: "voice_c05_m003_008", supportText: "鳥たちにも木が必要だ。" },
        { speaker: "Season Tree", text: "We live together.", voiceKey: "voice_c05_m003_009", supportText: "私たちは一緒に生きている。" },
        { speaker: "ピコ", text: "マスター、この世界で何が起きているのか、これから少しずつ調べていこう。" }
      ]
    }
  });
})();
