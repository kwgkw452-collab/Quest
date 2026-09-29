(function () {
  "use strict";

  var poses = [
    { id: "01", key: "normal", englishName: "Normal", japaneseName: "通常", purpose: "全Character共通の通常姿勢" },
    { id: "02", key: "smile", englishName: "Smile", japaneseName: "笑顔", purpose: "笑顔・喜び" },
    { id: "03", key: "surprised", englishName: "Surprised", japaneseName: "驚き", purpose: "驚いた反応" },
    { id: "04", key: "sad", englishName: "Sad", japaneseName: "悲しみ", purpose: "悲しい反応" },
    { id: "05", key: "smug", englishName: "Smug face", japaneseName: "ドヤ顔", purpose: "自信のある表情" },
    { id: "06", key: "crying", englishName: "Bawling", japaneseName: "号泣", purpose: "激しく泣く反応" },
    { id: "07", key: "applause", englishName: "Clapping hands", japaneseName: "拍手", purpose: "拍手・称賛" },
    { id: "08", key: "inactive", englishName: "Sleeping / Inactive", japaneseName: "睡眠・非活動", purpose: "睡眠または非活動状態" },
    { id: "09", key: "sideWalk", englishName: "Walking sideways", japaneseName: "横歩き", purpose: "移動シーンの横向き歩行" },
    { id: "10", key: "intimidate", englishName: "Threatening", japaneseName: "威嚇", purpose: "威嚇する特殊姿勢" },
    { id: "11", key: "apron", englishName: "Apron / Cooking", japaneseName: "エプロン・料理人", purpose: "料理人モード" }
  ];

  function clone(pose) {
    return pose ? Object.assign({}, pose) : null;
  }

  function get(reference) {
    var value = String(reference === undefined || reference === null ? "" : reference);
    if (/^\d+$/.test(value)) value = value.padStart(2, "0");
    for (var i = 0; i < poses.length; i += 1) {
      if (poses[i].id === value || poses[i].key === value) return clone(poses[i]);
    }
    return null;
  }

  function keyMap() {
    var result = {};
    poses.forEach(function (pose) { result[pose.key] = pose.id; });
    return result;
  }

  window.PoseDatabase = {
    get: get,
    all: function () { return poses.map(clone); },
    keyMap: keyMap
  };
})();
