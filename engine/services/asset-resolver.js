(function () {
  "use strict";

  function twoDigits(value) {
    var text = String(value);
    return text.length >= 2 ? text : "0" + text;
  }

  function isDirectPath(value) {
    return typeof value === "string" && (value.indexOf("/") !== -1 || /\.[a-z0-9]+(?:[?#].*)?$/i.test(value));
  }

  function getCharacter(characterId) {
    var database = window.CharacterDatabase;
    var character = database && database.get
      ? database.get(characterId)
      : database && database.characters && database.characters[characterId];
    if (!character) throw new Error("Unknown character: " + characterId);
    return character;
  }

  function resolvePose(pose) {
    var database = window.CharacterDatabase;
    if (pose === undefined || pose === null || pose === "") return null;
    if (typeof pose === "number") return twoDigits(pose);

    var text = String(pose);
    if (/^\d+$/.test(text)) return twoDigits(text);
    if (database && database.poses && database.poses[text]) return database.poses[text];
    throw new Error("Unknown pose: " + text);
  }

  function character(characterId, pose) {
    var definition = getCharacter(characterId);
    if (typeof pose === "string" && definition.specialGraphics && definition.specialGraphics[pose]) {
      return definition.specialGraphics[pose];
    }
    var poseNumber = resolvePose(pose === undefined ? definition.defaultPose : pose);

    if (Array.isArray(definition.availablePoses) && definition.availablePoses.indexOf(poseNumber) === -1) {
      throw new Error(characterId + " does not have pose " + poseNumber + ".");
    }

    return definition.folder + "/" + definition.filePrefix + poseNumber + (definition.extension || ".png");
  }

  function fromDatabase(databaseName, key) {
    var database = window[databaseName];
    if (!database || database[key] === undefined) throw new Error("Unknown asset " + databaseName + ": " + key);
    return database[key];
  }

  function resolveSimple(databaseName, keyOrPath, label) {
    if (typeof keyOrPath !== "string" || !keyOrPath) throw new Error(label + " key or path is required.");
    if (isDirectPath(keyOrPath)) return keyOrPath;
    return fromDatabase(databaseName, keyOrPath);
  }

  function background(keyOrPath) { return resolveSimple("BackgroundDatabase", keyOrPath, "Background"); }
  function item(keyOrPath) { return resolveSimple("ItemDatabase", keyOrPath, "Item"); }
  function video(keyOrPath) { return resolveSimple("VideoDatabase", keyOrPath, "Video"); }

  function audio(type, keyOrPath) {
    if (["bgm", "se", "voice"].indexOf(type) === -1) throw new Error("Unknown audio type: " + type);
    if (typeof keyOrPath !== "string" || !keyOrPath) throw new Error("Audio key or path is required.");
    if (isDirectPath(keyOrPath)) return keyOrPath;
    var database = window.AudioDatabase;
    var group = database && database[type];
    if (!group || group[keyOrPath] === undefined) throw new Error("Unknown audio " + type + ": " + keyOrPath);
    var definition = group[keyOrPath];
    if (typeof definition === "string") return definition;
    if (definition && typeof definition === "object" && typeof definition.file === "string" && definition.file) {
      return definition.file;
    }
    throw new Error("Invalid audio asset " + type + ": " + keyOrPath);
  }

  function effect(keyOrClassName, duration) {
    if (typeof keyOrClassName !== "string" || !keyOrClassName) throw new Error("Effect key or className is required.");
    var database = window.EffectDatabase || {};
    var definition = database[keyOrClassName];
    if (!definition) return { key: null, className: keyOrClassName, duration: duration };
    if (typeof definition === "string") return { key: keyOrClassName, className: definition, duration: duration };
    return {
      key: keyOrClassName,
      className: definition.className || keyOrClassName,
      duration: duration === undefined ? definition.duration : duration
    };
  }

  function normalizeMonsterId(id) {
    var text = String(id).toLowerCase();
    if (/^\d+$/.test(text)) text = "m" + text.padStart(3, "0");
    if (!/^m\d{3}$/.test(text)) throw new Error("Monster id must use m000 format: " + text);
    return text;
  }

  function getMonster(id) {
    var normalizedId = normalizeMonsterId(id);
    var database = window.MonsterDatabase;
    var monster = database && database.get ? database.get(normalizedId) : null;
    if (!monster) throw new Error("Unknown monster: " + normalizedId);
    return monster;
  }

  function monster(id, state) {
    var definition = getMonster(id);
    var imageState = state || "normal";
    var image = definition.image && definition.image[imageState];
    // Optional stateが未登録ならnormalへ戻す。画像枚数をEngine仕様にしない。
    if (!image && imageState !== "normal") image = definition.image && definition.image.normal;
    if (!image) throw new Error("Monster " + definition.monsterId + " has no normal image.");
    if (isDirectPath(image)) return image;
    return image;
  }

  function characterSpec(spec) {
    if (!spec || typeof spec !== "object") throw new Error("Character specification is required.");
    var normalized = {};
    Object.keys(spec).forEach(function (key) { normalized[key] = spec[key]; });

    if (!normalized.src) {
      var id = normalized.character || normalized.id;
      normalized.id = normalized.id || id;
      normalized.src = character(id, normalized.pose);
    }
    return normalized;
  }

  window.AssetResolver = {
    character: character,
    characterSpec: characterSpec,
    background: background,
    item: item,
    video: video,
    audio: audio,
    effect: effect,
    resolvePose: resolvePose,
    getCharacter: getCharacter,
    monster: monster,
    getMonster: getMonster,
    normalizeMonsterId: normalizeMonsterId,
    isDirectPath: isDirectPath
  };

  // alpha8からの統一窓口。既存のAssetResolver名も互換性のため残す。
  window.AssetManager = window.AssetResolver;
})();
