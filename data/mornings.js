(function () {
  "use strict";

  var mornings = Object.create(null);

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  function register(definition) {
    if (!definition || !definition.id) throw new Error("Morning definition needs an id.");
    var id = String(definition.id).toUpperCase();
    if (mornings[id]) throw new Error("Morning is already registered: " + id);
    mornings[id] = clone(Object.assign({ enabled: true }, definition, { id: id }));
    return clone(mornings[id]);
  }

  function get(id) {
    return clone(mornings[String(id || "").toUpperCase()]);
  }

  window.MorningDatabase = {
    register: register,
    get: get,
    has: function (id) { return get(id) !== null; },
    all: function () { return Object.keys(mornings).sort().map(get); }
  };

  register({
    id: "MORNING_001",
    sceneId: "scene_morning_routine",
    defaultBackground: "forestMorning",
    startEffect: { key: "morning-fade-in", ms: 3000 },
    backgrounds: {
      forest: "forestMorning",
      inn: "innMorning"
    },
    character: {
      id: "pico",
      character: "pico",
      pose: "smile",
      className: "pos-center-low size-medium"
    },
    prompt: {
      speaker: "ピコ",
      english: "Good morning, {playerName}! How are you feeling today?",
      japanese: "おはよう！今日の気分を英語で教えてね！",
      timeoutMs: 8000,
      voice: ""
    },
    // 判定順も仕様の一部。unhappy→happy、pretty good→good等の誤判定を防ぐ。
    categoryOrder: ["sick", "hungry", "negative", "neutral", "positive"],
    categories: {
      positive: {
        keywords: [
          "happy", "fine", "good", "great", "well", "okay", "ok", "all right", "alright",
          "better", "best", "nice", "awesome", "wonderful", "fantastic", "excellent", "amazing",
          "perfect", "brilliant", "refreshed", "energetic", "motivated", "confident", "ready",
          "positive", "lucky", "grateful", "thankful", "excited"
        ],
        reactions: [
          { id: "positive_a", english: "Awesome! I'm so happy to hear that!", japanese: "最高ピコ！マスターがハッピーだと、ボクもめちゃくちゃ嬉しくなるピコ！", voice: "" },
          { id: "positive_b", english: "Great! Let's make today a wonderful day!", japanese: "いいね！今日もワクワクするような素晴らしい一日にしようピコ！", voice: "" },
          { id: "positive_c", english: "Perfect! You look so energetic today!", japanese: "バッチリピコ！今日のマスターはエネルギーに満ちあふれてるピコね！", voice: "" }
        ]
      },
      neutral: {
        keywords: ["so so", "okay", "ok", "all right", "alright", "normal", "average", "not bad", "pretty good", "fine"],
        reactions: [
          { id: "neutral_a", english: "Not bad! A calm day is a good day.", japanese: "悪くないピコ！穏やかで平和な日こそ、最高の一日ピコよ。", voice: "" },
          { id: "neutral_b", english: "So-so? That's okay, let's take it easy.", japanese: "ふつうくらいかな？大丈夫、マイペースでぼちぼちいこうピコ！", voice: "" },
          { id: "neutral_c", english: "I see. Let's start slowly today!", japanese: "なるほどピコ。焦らずに、今日ものんびりゆっくりスタートしよ！", voice: "" }
        ]
      },
      negative: {
        keywords: [
          "tired", "sleepy", "exhausted", "worn out", "weak", "drained", "sad", "unhappy", "lonely",
          "miserable", "depressed", "upset", "angry", "mad", "annoyed", "frustrated", "nervous",
          "worried", "anxious", "scared", "afraid", "disappointed", "stressed", "bored"
        ],
        reactions: [
          { id: "negative_a", english: "Tired? Please don't push yourself too hard.", japanese: "ちょっとお疲れピコ？無理は絶対に禁物、今日はマイペースでいこうね！", voice: "" },
          { id: "negative_b", english: "Are you sleepy? I will always support you.", japanese: "まだねむねむピコ？大丈夫、ボクはいつでもマスターの味方だからね！", voice: "" },
          { id: "negative_c", english: "It's okay. We are a great team!", japanese: "大丈夫ピコ。しんどい日もあるけれど、僕たちは最高のチームピコよ！", voice: "" }
        ]
      },
      sick: {
        keywords: ["sick", "ill", "fever", "headache", "cold", "dizzy"],
        reactions: [
          { id: "sick_a", english: "Oh no! Please take a good rest today.", japanese: "大変ピコ！今日は絶対に無理をしないで、あたたかくして休んでね！", voice: "" },
          { id: "sick_b", english: "Are you okay? Your health is the most important thing.", japanese: "大丈夫ピコ？冒険も大事だけど、マスターの体が一番大事ピコよ。", voice: "" },
          { id: "sick_c", english: "Oh, dear... Take care of yourself.", japanese: "あらら……クエストのことはピコに任せて、早く元気になってね！", voice: "" }
        ]
      },
      hungry: {
        keywords: ["hungry", "starving", "famished", "thirsty"],
        reactions: [
          { id: "hungry_a", english: "Hungry? Me, too! Let's find some food!", japanese: "お腹ペコペコピコ？ボクも！美味しい朝ごはんを食べにいこう！", voice: "" },
          { id: "hungry_b", english: "Starving? Let's find something delicious to eat!", japanese: "ハラペコピコ！？何かおいしいものを探しにいこうピコ！", voice: "" },
          { id: "hungry_c", english: "Thirsty? Have a glass of water first!", japanese: "のどがカラカラピコ？まずは冷たいお水を一杯飲んでシャキッとしよう！", voice: "" }
        ]
      },
      unknown: {
        keywords: [],
        reactions: [
          { id: "unknown_a", english: "Wow, that sounds interesting! Tell me more later!", japanese: "わお、面白そうな言葉ピコ！今度ボクにゆっくり意味を教えてね！", voice: "" },
          { id: "unknown_b", english: "I see! My dictionary is growing every day.", japanese: "なるほどピコ！マスターのおかげで、ピコの頭脳がまた一つ賢くなったピコ！", voice: "" }
        ]
      },
      silent: {
        keywords: [],
        reactions: [
          { id: "silent_a", english: "Still sleepy? Let's take it easy today!", japanese: "まだ眠たいピコね？焦らなくて大丈夫、今日もマイペースでゆっくりいこう！", voice: "" }
        ]
      }
    }
  });

  // m004 uses the approved morning routine with its own progression identity.
  var m004Morning = get("MORNING_001");
  m004Morning.id = "MORNING_M004";
  register(m004Morning);
})();
