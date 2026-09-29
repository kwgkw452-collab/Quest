(function () {
  "use strict";

  var questions = Object.create(null);

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function copyCommunicative(definition) {
    if (!definition) return undefined;
    var value = { conceptId: definition.conceptId };
    ["difficulty", "promptType", "expectedUtterance", "poolId"].forEach(function (field) {
      if (definition[field] !== undefined) value[field] = definition[field];
    });
    return value;
  }

  function copySpeechPolicy(definition) {
    if (!definition) return undefined;
    return { interimFallback: definition.interimFallback };
  }

  function copy(definition) {
    var value = {
      id: definition.id,
      category: definition.category,
      prompt: definition.prompt,
      answers: definition.answers.slice(),
      success: definition.success,
      failure: definition.failure,
      hint: definition.hint
    };
    if (definition.picoSupport) value.picoSupport = definition.picoSupport.slice();
    if (definition.communicative) value.communicative = copyCommunicative(definition.communicative);
    if (definition.speechPolicy) value.speechPolicy = copySpeechPolicy(definition.speechPolicy);
    return value;
  }

  function register(definition) {
    if (!definition || !definition.id) throw new Error("Question definition needs an id.");
    if (!definition.category) throw new Error("Question needs a category: " + definition.id);
    if (!definition.prompt) throw new Error("Question needs a prompt: " + definition.id);
    if (!Array.isArray(definition.answers) || definition.answers.length === 0) {
      throw new Error("Question needs answers: " + definition.id);
    }
    if (definition.picoSupport !== undefined && (!Array.isArray(definition.picoSupport) ||
        definition.picoSupport.length !== 3 || definition.picoSupport.some(function (text) {
          return typeof text !== "string" || !text.trim();
        }))) throw new Error("Question picoSupport needs three non-empty strings: " + definition.id);
    if (definition.communicative !== undefined) {
      if (!isPlainObject(definition.communicative)) {
        throw new Error("Question communicative setting must be an object: " + definition.id);
      }
      if (typeof definition.communicative.conceptId !== "string" || !definition.communicative.conceptId.trim()) {
        throw new Error("Communicative Question needs conceptId: " + definition.id);
      }
      ["difficulty", "promptType", "expectedUtterance", "poolId"].forEach(function (field) {
        var value = definition.communicative[field];
        if (value !== undefined && (typeof value !== "string" || !value.trim())) {
          throw new Error("Communicative Question " + field + " must be a non-empty string: " + definition.id);
        }
      });
    }
    if (definition.speechPolicy !== undefined) {
      if (!isPlainObject(definition.speechPolicy)) {
        throw new Error("Question speechPolicy must be an object: " + definition.id);
      }
      if (definition.speechPolicy.interimFallback !== "primary-normalized-exact") {
        throw new Error("Question speechPolicy interimFallback is not supported: " + definition.id);
      }
    }
    if (questions[definition.id]) throw new Error("Question is already registered: " + definition.id);

    questions[definition.id] = copy({
      id: String(definition.id),
      category: String(definition.category),
      prompt: String(definition.prompt),
      answers: definition.answers.map(String),
      success: definition.success === undefined ? "" : String(definition.success),
      failure: definition.failure === undefined ? "" : String(definition.failure),
      hint: definition.hint === undefined ? null : definition.hint,
      picoSupport: definition.picoSupport ? definition.picoSupport.slice() : undefined,
      communicative: definition.communicative ? copyCommunicative(definition.communicative) : undefined,
      speechPolicy: definition.speechPolicy ? copySpeechPolicy(definition.speechPolicy) : undefined
    });
    return get(definition.id);
  }

  function get(id) {
    return questions[String(id)] ? copy(questions[String(id)]) : null;
  }

  function all() {
    return Object.keys(questions).map(get);
  }

  window.QuestionDatabase = {
    register: register,
    get: get,
    all: all
  };

  register({
    id: "word.hello",
    category: "word",
    prompt: "Hello（ハロー）と言ってください！",
    answers: ["hello", "hello!", "ハロー", "はろー", "はろう"],
    success: "その調子！",
    failure: "もう一度、一緒にやってみよう！",
    hint: "ハロー",
    speechPolicy: { interimFallback: "primary-normalized-exact" }
  });

  register({
    id: "word.japan",
    category: "word",
    prompt: "'Japan' と言ってください！",
    answers: ["japan", "ジャパン", "じゃぱん", "日本", "にほん", "ニホン"],
    success: "伝わったよ！",
    failure: "もう一度、ゆっくり言ってみよう！",
    hint: "ジャパン"
  });

  register({
    id: "word.yes",
    category: "word",
    prompt: "'Yes' と言ってください！",
    answers: ["yes", "yes!", "イエス", "いえす", "はい"],
    success: "気持ちが伝わったよ！",
    failure: "もう一度、声に出してみよう！",
    hint: "イエス"
  });

  register({
    id: "word.fruit",
    category: "word",
    prompt: "Say a fruit word!",
    answers: WordDictionaryDatabase.answers("fruit.v1"),
    success: "Great!",
    failure: "ポンコツでごめんね。ピコの辞書にはないみたい。別のフルーツの言葉を言ってみて！",
    hint: "apple"
  });

  register({
    id: "word.single-digit-number",
    category: "word",
    prompt: "知っている1桁の数字を英語で言ってみよう。",
    answers: WordDictionaryDatabase.answers("number.single-digit.v1"),
    success: "Great!",
    failure: "大丈夫ピコ。知っている1桁の数字を、英語でゆっくり言ってみよう！",
    hint: "one"
  });

  register({
    id: "word.season",
    category: "word",
    prompt: "知っている季節の英語を1つ言ってみよう！",
    answers: WordDictionaryDatabase.answers("season.v1"),
    success: "正解！",
    failure: "大丈夫ピコ。春・夏・秋・冬を英語で考えてみよう！",
    hint: "spring"
  });

  register({
    id: "phrase.its_ok",
    category: "word",
    prompt: "「It's OK.（大丈夫！）」と言ってみよう。",
    answers: ["it's ok", "its ok", "it is ok"],
    success: "She can hear you!",
    failure: "大丈夫ピコ。It's OK. とゆっくり言ってみよう！",
    hint: "It's OK."
  });

  register({
    id: "phrase.yes_can_hear_you",
    category: "word",
    prompt: "「はい」または「はい、聞こえます」と英語で言ってみよう。",
    answers: [
      "yes", "yes!", "yes i can hear you", "yes we can hear you",
      "i can hear you", "we can hear you", "イエス", "いえす", "はい"
    ],
    success: "She can hear your answer!",
    failure: "大丈夫ピコ。ゆっくり言ってみよう！",
    hint: "Yes."
  });

  register({
    id: "phrase.come_with_me",
    category: "word",
    prompt: "「Come with me.（俺たちと一緒に行こう）」と言ってみよう。",
    answers: ["come with me"],
    success: "Let's go together!",
    failure: "大丈夫ピコ。Come with me. とゆっくり言ってみよう！",
    hint: "Come with me."
  });

  register({
    id: "phrase.are_you_ok",
    category: "word",
    prompt: "“Are you OK?”（大丈夫ですか？）と尋ねてみよう。",
    answers: ["are you ok", "are you okay"],
    success: "Your question reached Bernie!",
    failure: "大丈夫ピコ。Are you OK? とゆっくり言ってみよう！",
    hint: "Are you OK?",
    communicative: {
      conceptId: "social.wellbeing.ask",
      difficulty: "starter",
      promptType: "question",
      expectedUtterance: "Are you OK?"
    }
  });

  register({
    id: "cooking.meat",
    category: "word",
    prompt: "最初は肉を入れてみよう！\n肉、牛肉、豚肉、鶏肉など、知っている英語を言ってみよう！",
    answers: WordDictionaryDatabase.answers("cooking.meat.v1"),
    success: "The meat is in!",
    failure: "知っている肉の英語を言ってみよう！",
    hint: "beef"
  });

  register({
    id: "cooking.vegetable",
    category: "word",
    prompt: "次は野菜を入れよう！\n知っている野菜を英語で言ってみよう！",
    answers: WordDictionaryDatabase.answers("cooking.vegetable.v1"),
    success: "The vegetable is in!",
    failure: "知っている野菜の英語を言ってみよう！",
    hint: "onion"
  });

  register({
    id: "cooking.fruit",
    category: "word",
    prompt: "最後はフルーツ！\n知っているフルーツを英語で言ってみよう！",
    answers: WordDictionaryDatabase.answers("fruit.v1"),
    success: "The fruit is in!",
    failure: "知っているフルーツの英語を言ってみよう！",
    hint: "peach"
  });

  register({
    id: "phrase.yes_its_good",
    category: "word",
    prompt: "“Yes! It's good!”（はい！おいしいです！）と言ってみよう。",
    answers: ["yes its good", "yes it is good", "yes it's good", "its good", "it is good"],
    success: "Bernie heard you!",
    failure: "Yes! It's good! とゆっくり言ってみよう！",
    hint: "Yes! It's good!"
  });

  register({
    id: "phrase.come_with_us",
    category: "word",
    prompt: "『一緒に行こう』を英語で言ってみよう。",
    answers: ["come with me", "come with us", "let's go", "shall we go", "come on"],
    success: "Let's travel together!",
    failure: "大丈夫ピコ。知っている表現で『一緒に行こう』と言ってみよう！",
    hint: "Come with me. / Let's go!"
  });

  register({
    id: "word.map_or_key",
    category: "word",
    prompt: "Which do you want?",
    answers: ["map", "key"],
    success: "",
    failure: "",
    hint: "Map / Key"
  });

  register({
    id: "word.map_only",
    category: "word",
    prompt: "Map.",
    answers: ["map"],
    success: "",
    failure: "",
    hint: "Map"
  });

  register({
    id: "word.orange_or_banana",
    category: "word",
    prompt: "どっちが好き？ 英語で言ってみよう！",
    answers: ["orange", "banana", "no thank you"],
    success: "",
    failure: "",
    hint: "Orange / Banana / No, thank you."
  });

  register({
    id: "phrase.stay_here",
    category: "word",
    prompt: "『ここにいるの？』を英語で言ってください。",
    answers: ["stay here", "staying here"],
    success: "",
    failure: "",
    hint: "Stay here?"
  });

  register({
    id: "phrase.good_luck",
    category: "word",
    prompt: "サキに『がんばって！』と英語で言ってみよう。",
    answers: ["good luck"],
    success: "Your support reached Saki!",
    failure: "大丈夫ピコ。Good luck! とゆっくり言ってみよう！",
    hint: "Good luck!"
  });

  register({
    id: "phrase.farewell_saki",
    category: "word",
    prompt: "『さよなら』を英語で言ってみよう。",
    answers: [
      "see you", "see you again", "see you later", "bye",
      "bye bye", "goodbye", "good luck", "take care",
      "god bless you", "farewell"
    ],
    success: "Your words reached Saki!",
    failure: "大丈夫ピコ。See you! や Bye! と言ってみよう！",
    hint: "See you! / Bye!"
  });
})();
