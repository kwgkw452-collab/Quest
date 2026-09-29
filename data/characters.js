(function () {
  "use strict";

  var characters = {
      pico: {
        id: 1,
        key: "pico",
        name: "ピコ",
        gender: "other",
        type: "robot",
        traits: ["does-not-sleep"],
        folder: "images/characters/pico",
        filePrefix: "pico_",
        extension: ".png",
        defaultPose: "normal",
        availablePoses: ["01", "02", "03", "04", "05", "06", "07", "08", "09"]
      },
      kong: {
        id: 2,
        key: "kong",
        name: "コング",
        gender: "male",
        type: "human",
        traits: [],
        folder: "images/characters/kong",
        filePrefix: "kong_",
        extension: ".png",
        defaultPose: "normal",
        availablePoses: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]
      },
      saki: {
        id: 3,
        key: "saki",
        name: "サキ",
        gender: "female",
        type: "human",
        traits: [],
        folder: "images/characters/income",
        filePrefix: "income_",
        extension: ".png",
        defaultPose: "normal",
        availablePoses: ["01", "02", "04", "09"]
      },
      bernie: {
        id: 4,
        key: "bernie",
        name: "バーニー",
        gender: "unknown",
        type: "other",
        traits: [],
        folder: "images/characters/bernie",
        filePrefix: "bernie_",
        extension: ".png",
        defaultPose: "normal",
        availablePoses: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "11"]
      }
    };

  function get(reference) {
    if (reference === undefined || reference === null) return null;
    if (characters[reference]) return characters[reference];
    var numericId = Number(reference);
    var keys = Object.keys(characters);
    for (var i = 0; i < keys.length; i += 1) {
      if (characters[keys[i]].id === numericId) return characters[keys[i]];
    }
    return null;
  }

  window.CharacterDatabase = {
    // 既存lookupとの互換性を維持する。Pose番号と意味の正本はPoseDatabase。
    poses: PoseDatabase.keyMap(),
    characters: characters,
    get: get,
    all: function () { return Object.keys(characters).map(function (key) { return characters[key]; }); }
  };
})();
