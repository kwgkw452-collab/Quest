(function () {
  "use strict";

  // Runtimeには再生に必要なCharacter別gainだけを保持する。
  var profiles = {
    c01: { characterId: 1, characterKey: "pico", gain: 1.0 },
    c02: { characterId: 2, characterKey: "kong", gain: 1.0 },
    c03: { characterId: 3, characterKey: "saki", gain: 1.0 },
    c04: { characterId: 4, characterKey: "bernie", gain: 1.0 },
    c05: { characterId: 5, characterKey: "season_tree", gain: 1.0 },
    c06: { characterId: 6, characterKey: "shop_owner", gain: 1.0 },
    c07: { characterId: 7, characterKey: "shop_clerk", gain: 1.0 },
    c08: { characterId: 8, characterKey: "traveler_a", gain: 1.0 },
    c09: { characterId: 9, characterKey: "traveler_b", gain: 1.0 },
    c10: { characterId: 10, characterKey: "traveler_c", gain: 1.0 },
    c11: { characterId: 11, characterKey: "local_woman", gain: 1.0 },
    c12: { characterId: 12, characterKey: "townsperson", gain: 1.0 },
    c13: { characterId: 13, characterKey: "fruit_monster", gain: 1.0 },
    c14: { characterId: 14, characterKey: "face_parts_monster", gain: 1.0 }
  };

  function clone(value) {
    return value ? {
      characterCode: value.characterCode,
      characterId: value.characterId,
      characterKey: value.characterKey,
      gain: value.gain
    } : null;
  }

  function parseVoiceKey(voiceKey) {
    var match = /^voice_(c\d{2})_([a-z][a-z0-9]*)_(\d{3})$/i.exec(String(voiceKey || ""));
    if (!match) return null;
    return {
      voiceKey: String(voiceKey),
      characterCode: match[1].toLowerCase(),
      storyOrEventId: match[2].toLowerCase(),
      sequence: match[3]
    };
  }

  function get(characterCode) {
    var code = String(characterCode || "").toLowerCase();
    var profile = profiles[code];
    if (!profile) return null;
    var configuredGain = window.AudioMixProfile && AudioMixProfile.voiceCharacters
      ? Number(AudioMixProfile.voiceCharacters[code])
      : NaN;
    return clone(Object.assign({ characterCode: code }, profile, {
      gain: Number.isFinite(configuredGain) ? configuredGain : profile.gain
    }));
  }

  function getForVoiceKey(voiceKey) {
    var parsed = parseVoiceKey(voiceKey);
    return parsed ? get(parsed.characterCode) : null;
  }

  function resolveGain(voiceKey, sceneGain) {
    var profile = getForVoiceKey(voiceKey);
    var groupGain = window.AudioMixProfile && AudioMixProfile.groups
      ? Number(AudioMixProfile.groups.VOICE)
      : 1;
    if (!Number.isFinite(groupGain)) groupGain = 1;
    var characterGain = profile ? Number(profile.gain) : 1;
    if (!Number.isFinite(characterGain)) characterGain = 1;
    var overrideGain = sceneGain === undefined ? 1 : Number(sceneGain);
    if (!Number.isFinite(overrideGain)) overrideGain = 1;
    return groupGain * characterGain * overrideGain;
  }

  function resolveGainComponents(voiceKey, sceneGain) {
    var profile = getForVoiceKey(voiceKey);
    var voiceGroupGain = window.AudioMixProfile && AudioMixProfile.groups
      ? Number(AudioMixProfile.groups.VOICE)
      : 1;
    if (!Number.isFinite(voiceGroupGain)) voiceGroupGain = 1;
    var characterGain = profile ? Number(profile.gain) : 1;
    if (!Number.isFinite(characterGain)) characterGain = 1;
    var resolvedSceneGain = sceneGain === undefined ? 1 : Number(sceneGain);
    if (!Number.isFinite(resolvedSceneGain)) resolvedSceneGain = 1;
    return {
      groupGain: voiceGroupGain,
      characterGain: characterGain,
      sceneGain: resolvedSceneGain,
      effectiveGain: voiceGroupGain * characterGain * resolvedSceneGain
    };
  }

  window.VoiceProfileDatabase = {
    get: get,
    getForVoiceKey: getForVoiceKey,
    parseVoiceKey: parseVoiceKey,
    resolveGain: resolveGain,
    resolveGainComponents: resolveGainComponents,
    all: function () { return Object.keys(profiles).sort().map(get); }
  };
})();
