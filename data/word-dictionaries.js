(function () {
  "use strict";

  var dictionaries = Object.create(null);

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~。、「」！？・…（）［］【】〈〉《》]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clone(value) {
    if (!value) return null;
    return {
      id: value.id,
      entries: value.entries.map(function (entry) {
        return { canonical: entry.canonical, aliases: entry.aliases.slice() };
      })
    };
  }

  function register(definition) {
    if (!definition || !definition.id) throw new Error("Word dictionary needs an id.");
    if (!Array.isArray(definition.entries) || definition.entries.length === 0) {
      throw new Error("Word dictionary needs entries: " + definition.id);
    }
    var id = String(definition.id);
    if (dictionaries[id]) throw new Error("Word dictionary is already registered: " + id);
    var canonicals = [];
    dictionaries[id] = {
      id: id,
      entries: definition.entries.map(function (entry) {
        var canonical = normalize(entry.canonical);
        if (!canonical || canonicals.indexOf(canonical) !== -1) {
          throw new Error("Word dictionary has an invalid or duplicate canonical: " + entry.canonical);
        }
        canonicals.push(canonical);
        var aliases = [canonical].concat(entry.aliases || []).map(normalize).filter(Boolean);
        return {
          canonical: canonical,
          aliases: aliases.filter(function (alias, index) { return aliases.indexOf(alias) === index; })
        };
      })
    };
    return clone(dictionaries[id]);
  }

  function get(id) {
    return clone(dictionaries[String(id || "")]);
  }

  function answers(id) {
    var dictionary = get(id);
    if (!dictionary) return [];
    return dictionary.entries.reduce(function (all, entry) { return all.concat(entry.aliases); }, []);
  }

  function match(id, text) {
    var dictionary = get(id);
    if (!dictionary) return null;
    var source = normalize(text);
    var candidates = [];
    dictionary.entries.forEach(function (entry) {
      entry.aliases.forEach(function (alias) {
        candidates.push({ canonical: entry.canonical, alias: alias });
      });
    });
    // water melonより先にmelonを拾わないよう、全候補を長い順に判定する。
    candidates.sort(function (a, b) { return b.alias.length - a.alias.length; });
    for (var i = 0; i < candidates.length; i += 1) {
      var candidate = candidates[i];
      var pattern = new RegExp("(^|\\s)" + candidate.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s|$)");
      if (pattern.test(source)) return candidate.canonical;
    }
    return null;
  }

  window.WordDictionaryDatabase = {
    register: register,
    get: get,
    answers: answers,
    match: match,
    all: function () { return Object.keys(dictionaries).sort().map(get); }
  };

  register({
    id: "fruit.v1",
    entries: [
      { canonical: "apple", aliases: ["apples", "アップル", "あっぷる"] },
      { canonical: "banana", aliases: ["bananas", "バナナ", "ばなな"] },
      { canonical: "orange", aliases: ["oranges", "オレンジ", "おれんじ"] },
      { canonical: "grape", aliases: ["grapes", "グレープ", "ぐれーぷ"] },
      { canonical: "strawberry", aliases: ["strawberries", "ストロベリー", "すとろべりー"] },
      { canonical: "lemon", aliases: ["lemons", "レモン", "れもん"] },
      { canonical: "peach", aliases: ["peaches", "ピーチ", "ぴーち"] },
      { canonical: "melon", aliases: ["melons", "メロン", "めろん"] },
      { canonical: "watermelon", aliases: ["watermelons", "water melon", "ウォーターメロン", "うぉーたーめろん"] },
      { canonical: "pineapple", aliases: ["pineapples", "パイナップル", "ぱいなっぷる"] },
      { canonical: "cherry", aliases: ["cherries", "チェリー", "ちぇりー"] },
      { canonical: "kiwi", aliases: ["kiwis", "kiwi fruit", "kiwifruit", "キウイ", "きうい"] },
      { canonical: "mango", aliases: ["mangoes", "mangos", "マンゴー", "まんごー"] },
      { canonical: "pear", aliases: ["pears", "ペア", "ぺあ"] },
      { canonical: "plum", aliases: ["plums", "プラム", "ぷらむ"] },
      { canonical: "blueberry", aliases: ["blueberries", "ブルーベリー", "ぶるーべりー"] },
      { canonical: "raspberry", aliases: ["raspberries", "ラズベリー", "らずべりー"] },
      { canonical: "coconut", aliases: ["coconuts", "ココナッツ", "ここなっつ"] },
      { canonical: "papaya", aliases: ["papayas", "パパイヤ", "ぱぱいや"] },
      { canonical: "lime", aliases: ["limes", "ライム", "らいむ"] }
    ]
  });

  register({
    id: "cooking.meat.v1",
    entries: [
      { canonical: "meat", aliases: ["ミート", "みーと"] },
      { canonical: "beef", aliases: ["ビーフ", "びーふ"] },
      { canonical: "pork", aliases: ["ポーク", "ぽーく"] },
      { canonical: "chicken", aliases: ["チキン", "ちきん"] }
    ]
  });

  register({
    id: "cooking.vegetable.v1",
    entries: [
      { canonical: "onion", aliases: ["onions", "オニオン", "おにおん", "玉ねぎ", "たまねぎ"] },
      { canonical: "potato", aliases: ["potatoes", "ポテト", "ぽてと", "じゃがいも"] },
      { canonical: "tomato", aliases: ["tomatoes", "トマト", "とまと"] },
      { canonical: "corn", aliases: ["コーン", "こーん", "とうもろこし"] },
      { canonical: "cabbage", aliases: ["キャベツ", "きゃべつ"] },
      { canonical: "carrot", aliases: ["carrots", "キャロット", "きゃろっと", "にんじん"] },
      { canonical: "radish", aliases: ["radishes", "ラディッシュ", "らでぃっしゅ", "大根", "だいこん"] },
      { canonical: "celery", aliases: ["セロリ", "せろり"] },
      { canonical: "eggplant", aliases: ["eggplants", "エッグプラント", "えっぐぷらんと", "なす", "ナス"] },
      { canonical: "parsley", aliases: ["パセリ", "ぱせり"] },
      { canonical: "cucumber", aliases: ["cucumbers", "キューカンバー", "きゅーかんばー", "きゅうり", "キュウリ"] },
      { canonical: "lettuce", aliases: ["レタス", "れたす"] },
      { canonical: "broccoli", aliases: ["ブロッコリー", "ぶろっこりー"] },
      { canonical: "pumpkin", aliases: ["pumpkins", "パンプキン", "ぱんぷきん", "かぼちゃ", "カボチャ"] }
    ]
  });

  register({
    id: "number.single-digit.v1",
    entries: [
      { canonical: "one", aliases: ["1", "ワン", "わん"] },
      { canonical: "two", aliases: ["2", "ツー", "つー", "トゥー", "とぅー"] },
      { canonical: "three", aliases: ["3", "スリー", "すりー"] },
      { canonical: "four", aliases: ["4", "フォー", "ふぉー"] },
      { canonical: "five", aliases: ["5", "ファイブ", "ふぁいぶ"] },
      { canonical: "six", aliases: ["6", "シックス", "しっくす"] },
      { canonical: "seven", aliases: ["7", "セブン", "せぶん"] },
      { canonical: "eight", aliases: ["8", "エイト", "えいと"] },
      { canonical: "nine", aliases: ["9", "ナイン", "ないん"] }
    ]
  });

  register({
    id: "season.v1",
    entries: [
      { canonical: "spring", aliases: ["スプリング", "すぷりんぐ"] },
      { canonical: "summer", aliases: ["サマー", "さまー"] },
      { canonical: "autumn", aliases: [
        "fall", "fool", "4", "four", "pull", "phone", "forward", "full", "cold",
        "オータム", "おーたむ", "フォール", "ふぉーる"
      ] },
      { canonical: "winter", aliases: ["ウィンター", "うぃんたー", "ウインター", "ういんたー"] }
    ]
  });
})();
