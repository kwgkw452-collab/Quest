(function () {
  "use strict";

  var camps = Object.create(null);

  function clone(value) {
    if (!value) return null;
    return {
      id: value.id,
      enabled: value.enabled,
      steps: value.steps.map(function (step) { return Object.assign({}, step); })
    };
  }

  function register(definition) {
    if (!definition || !definition.id) throw new Error("Camp definition needs an id.");
    var id = String(definition.id).toUpperCase();
    if (camps[id]) throw new Error("Camp is already registered: " + id);
    camps[id] = {
      id: id,
      enabled: definition.enabled !== false,
      steps: Array.isArray(definition.steps) ? definition.steps.map(function (step) {
        return Object.assign({}, step);
      }) : []
    };
    return clone(camps[id]);
  }

  function get(id) {
    return clone(camps[String(id || "").toUpperCase()]);
  }

  window.CampDatabase = {
    register: register,
    get: get,
    has: function (id) { return get(id) !== null; },
    all: function () { return Object.keys(camps).sort().map(get); }
  };

  register({
    id: "CAMP_001",
    steps: [
      { type: "clear", filter: false },
      { type: "background", src: "camp" },
      { type: "filter", visible: true },
      { type: "companions", min: 2, max: 3, pose: "inactive", sleepText: "Zzz..." },
      { type: "dialogue", speaker: "", text: "こうして、冒険の最初の一日が静かに終わった。", button: "休む" },
      { type: "clear", filter: false }
    ]
  });

  register({
    id: "CAMP_M001",
    steps: [
      { type: "clear", filter: false },
      { type: "background", src: "camp" },
      { type: "filter", visible: true },
      { type: "companions", min: 2, max: 3, pose: "inactive", sleepText: "Zzz..." },
      { type: "dialogue", speaker: "", text: "フルーツに囲まれながら、静かな夜が訪れた。", button: "休む" },
      { type: "clear", filter: false }
    ]
  });

  register({
    id: "CAMP_S002",
    steps: [
      { type: "clear", filter: false },
      { type: "background", src: "camp" },
      { type: "filter", visible: true },
      { type: "companions", min: 2, max: 3, pose: "inactive", sleepText: "Zzz..." },
      { type: "dialogue", speaker: "", text: "新しい仲間とともに、静かな夜が訪れた。", button: "休む" },
      { type: "clear", filter: false }
    ]
  });

  register({
    id: "CAMP_M002",
    steps: [
      { type: "clear", filter: false },
      { type: "background", src: "camp" },
      { type: "filter", visible: true },
      { type: "companions", min: 2, max: 3, pose: "inactive", sleepText: "Zzz..." },
      { type: "dialogue", speaker: "", text: "数字の怪物との戦いを終え、静かな夜が訪れた。", button: "休む" },
      { type: "clear", filter: false }
    ]
  });

  register({ id: "CAMP_M001_1", steps: [
    { type: "dialogue", speaker: "ピコ", text: function () { return MonsterBattleData.getHint(MonsterDatabase.get("m001"), 1); }, button: "再挑戦" }
  ] });
  register({ id: "CAMP_M001_2", steps: [
    { type: "dialogue", speaker: "ピコ", text: function () { return MonsterBattleData.getHint(MonsterDatabase.get("m001"), 2); }, button: "再挑戦" }
  ] });
  register({ id: "CAMP_M001_3", steps: [
    { type: "dialogue", speaker: "ピコ", text: function () { return MonsterBattleData.getHint(MonsterDatabase.get("m001"), 3); }, button: "再挑戦" }
  ] });
  register({ id: "CAMP_M002_1", steps: [
    { type: "dialogue", speaker: "ピコ", text: function () { return MonsterBattleData.getHint(MonsterDatabase.get("m002"), 1); }, button: "再挑戦" }
  ] });
  register({ id: "CAMP_M002_2", steps: [
    { type: "dialogue", speaker: "ピコ", text: function () { return MonsterBattleData.getHint(MonsterDatabase.get("m002"), 2); }, button: "再挑戦" }
  ] });
  register({ id: "CAMP_M002_3", steps: [
    { type: "dialogue", speaker: "ピコ", text: function () { return MonsterBattleData.getHint(MonsterDatabase.get("m002"), 3); }, button: "再挑戦" }
  ] });
  register({ id: "CAMP_M003_1", steps: [
    { type: "dialogue", speaker: "ピコ", text: function () { return MonsterBattleData.getHint(MonsterDatabase.get("m003"), 1); }, button: "再挑戦" }
  ] });
  register({ id: "CAMP_M003_2", steps: [
    { type: "dialogue", speaker: "ピコ", text: function () { return MonsterBattleData.getHint(MonsterDatabase.get("m003"), 2); }, button: "再挑戦" }
  ] });
  register({ id: "CAMP_M003_3", steps: [
    { type: "dialogue", speaker: "ピコ", text: function () { return MonsterBattleData.getHint(MonsterDatabase.get("m003"), 3); }, button: "再挑戦" }
  ] });
  register({
    id: "CAMP_M004",
    steps: [
      { type: "clear", filter: false },
      { type: "background", src: "camp" },
      { type: "filter", visible: true },
      { type: "companions", min: 2, max: 3, pose: "inactive", sleepText: "Zzz..." },
      { type: "dialogue", speaker: "", text: "顔を取り戻した仲間とともに、静かな夜が訪れた。", button: "休む" },
      { type: "clear", filter: false }
    ]
  });
  [1, 2, 3].forEach(function (level) {
    register({ id: "CAMP_M004_" + level, steps: [
      { type: "dialogue", speaker: "ピコ", text: function () {
        return MonsterBattleData.getHint(MonsterDatabase.get("m004"), level);
      }, button: "再挑戦" }
    ] });
  });
})();
