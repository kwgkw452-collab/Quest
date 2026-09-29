(function () {
  "use strict";

  var STORAGE_KEY = window.__EIGO_DEV_SAVE__
    ? "eigo-de-quest:dev-save:v1"
    : "eigo-de-quest:save:v2";
  var SAVE_VERSION = 1;
  var sessionStartedAt = Date.now();
  var cachedData = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function defaultData() {
    return {
      saveVersion: SAVE_VERSION,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      player: {
        name: "",
        playTimeMs: 0
      },
      progress: {
        currentStoryId: GameConfig.initialStoryId || "S001",
        currentStepIndex: 0,
        completedStories: []
      },
      flags: {},
      party: {
        companionIds: []
      },
      inventory: {},
      bestiary: {},
      storyState: {}
    };
  }

  function storageAvailable() {
    try {
      var key = "__edq_storage_test__";
      localStorage.setItem(key, "1");
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function normalize(data) {
    var base = defaultData();
    if (!data || typeof data !== "object") return base;

    base.saveVersion = SAVE_VERSION;
    base.createdAt = data.createdAt || base.createdAt;
    base.updatedAt = data.updatedAt || base.updatedAt;
    base.player = Object.assign(base.player, data.player || {});
    base.progress = Object.assign(base.progress, data.progress || {});
    base.flags = Object.assign({}, data.flags || {});
    base.party = Object.assign(base.party, data.party || {});
    if (!Array.isArray(base.party.companionIds)) base.party.companionIds = [];
    base.party.companionIds = base.party.companionIds.map(Number).filter(function (id, index, ids) {
      return Number.isInteger(id) && id > 0 && ids.indexOf(id) === index;
    });
    base.inventory = Object.assign({}, data.inventory || {});
    base.bestiary = Object.assign({}, data.bestiary || {});
    base.storyState = Object.assign({}, data.storyState || {});

    if (!Array.isArray(base.progress.completedStories)) {
      base.progress.completedStories = [];
    }
    return base;
  }

  function readStorage() {
    if (!storageAvailable()) return defaultData();
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    try {
      return normalize(JSON.parse(raw));
    } catch (error) {
      console.warn("Save data could not be read. A new save will be used.", error);
      return defaultData();
    }
  }

  function getData() {
    if (!cachedData) cachedData = readStorage();
    return cachedData;
  }

  function commit() {
    var data = getData();
    data.updatedAt = nowIso();
    if (storageAvailable()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    return clone(data);
  }

  function load() {
    cachedData = readStorage();
    sessionStartedAt = Date.now();
    return clone(cachedData);
  }

  function reset() {
    if (storageAvailable()) localStorage.removeItem(STORAGE_KEY);
    cachedData = defaultData();
    sessionStartedAt = Date.now();
    return clone(cachedData);
  }

  function flushPlayTime() {
    var elapsed = Math.max(0, Date.now() - sessionStartedAt);
    getData().player.playTimeMs += elapsed;
    sessionStartedAt = Date.now();
  }

  function save() {
    flushPlayTime();
    return commit();
  }

  function setPlayerName(name) {
    getData().player.name = String(name || "");
    return commit();
  }

  function setFlag(key, value) {
    if (!key) throw new Error("SaveManager.setFlag needs a key.");
    getData().flags[key] = value;
    return commit();
  }

  function getFlag(key, fallback) {
    var flags = getData().flags;
    return Object.prototype.hasOwnProperty.call(flags, key) ? flags[key] : fallback;
  }

  function normalizeCharacterId(characterId) {
    var id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) throw new Error("Character ID must be a positive integer.");
    return id;
  }

  function addCompanion(characterId) {
    var id = normalizeCharacterId(characterId);
    var ids = getData().party.companionIds;
    if (ids.indexOf(id) === -1) ids.push(id);
    commit();
    return ids.slice();
  }

  function removeCompanion(characterId) {
    var id = normalizeCharacterId(characterId);
    var ids = getData().party.companionIds;
    var index = ids.indexOf(id);
    if (index !== -1) ids.splice(index, 1);
    commit();
    return ids.slice();
  }

  function getCompanionIds() {
    return getData().party.companionIds.slice();
  }

  function addItem(itemId, quantity) {
    if (!itemId) throw new Error("SaveManager.addItem needs an item id.");
    var amount = quantity === undefined ? 1 : Number(quantity);
    if (!isFinite(amount)) amount = 0;
    var inventory = getData().inventory;
    inventory[itemId] = Math.max(0, Number(inventory[itemId] || 0) + amount);
    return commit();
  }

  function removeItem(itemId, quantity) {
    return addItem(itemId, -(quantity === undefined ? 1 : Number(quantity)));
  }

  function getItemCount(itemId) {
    return Number(getData().inventory[itemId] || 0);
  }

  function registerMonster(monsterId, patch) {
    if (!monsterId) throw new Error("SaveManager.registerMonster needs a monster id.");
    var id = window.MonsterDatabase && MonsterDatabase.normalizeId
      ? MonsterDatabase.normalizeId(monsterId)
      : String(monsterId).toLowerCase();
    var previous = getData().bestiary[id] || {};
    getData().bestiary[id] = Object.assign({
      discovered: true,
      defeated: false,
      encounterCount: 0,
      defeatCount: 0
    }, previous, patch || {});
    return commit();
  }

  function recordMonsterEncounter(monsterId) {
    var id = window.MonsterDatabase && MonsterDatabase.normalizeId
      ? MonsterDatabase.normalizeId(monsterId)
      : String(monsterId).toLowerCase();
    var entry = getData().bestiary[id] || {};
    return registerMonster(id, {
      discovered: true,
      encounterCount: Number(entry.encounterCount || 0) + 1
    });
  }

  function recordMonsterDefeat(monsterId) {
    var id = window.MonsterDatabase && MonsterDatabase.normalizeId
      ? MonsterDatabase.normalizeId(monsterId)
      : String(monsterId).toLowerCase();
    var entry = getData().bestiary[id] || {};
    return registerMonster(id, {
      discovered: true,
      defeated: true,
      defeatCount: Number(entry.defeatCount || 0) + 1
    });
  }

  function setProgress(storyId, stepIndex, storyState) {
    var data = getData();
    if (storyId) data.progress.currentStoryId = storyId;
    if (stepIndex !== undefined) data.progress.currentStepIndex = Number(stepIndex) || 0;
    if (storyId && storyState && typeof storyState === "object") {
      data.storyState[storyId] = clone(storyState);
    }
    return commit();
  }

  function completeStory(storyId, storyState) {
    if (!storyId) return commit();
    var data = getData();
    if (data.progress.completedStories.indexOf(storyId) === -1) {
      data.progress.completedStories.push(storyId);
    }
    data.progress.currentStoryId = storyId;
    if (storyState && typeof storyState === "object") {
      data.storyState[storyId] = clone(storyState);
    }
    return commit();
  }

  function getStoryState(storyId) {
    var state = getData().storyState[storyId];
    return state ? clone(state) : null;
  }

  function exportData() {
    flushPlayTime();
    return JSON.stringify(commit(), null, 2);
  }

  function importData(jsonText) {
    var parsed = JSON.parse(jsonText);
    cachedData = normalize(parsed);
    sessionStartedAt = Date.now();
    return commit();
  }

  function bindStoryEvents() {
    if (!window.StoryEvents || bindStoryEvents.bound) return;
    bindStoryEvents.bound = true;

    StoryEvents.on("story:enter", function (context) {
      setProgress(context.story.id, 0, context.state);
    });

    StoryEvents.on("step:complete", function (context) {
      var interval = Number(GameConfig.autoSaveStepInterval || 0);
      if (interval > 0 && ((context.index + 1) % interval === 0)) {
        setProgress(context.story.id, context.index + 1, context.state);
      }
    });

    StoryEvents.on("story:complete", function (context) {
      completeStory(context.story.id, context.state);
      save();
    });
  }

  window.SaveManager = {
    init: function () {
      getData();
      bindStoryEvents();
      return clone(getData());
    },
    isAvailable: storageAvailable,
    load: load,
    save: save,
    reset: reset,
    getData: function () { return clone(getData()); },
    setPlayerName: setPlayerName,
    setFlag: setFlag,
    getFlag: getFlag,
    addCompanion: addCompanion,
    removeCompanion: removeCompanion,
    getCompanionIds: getCompanionIds,
    addItem: addItem,
    removeItem: removeItem,
    getItemCount: getItemCount,
    registerMonster: registerMonster,
    recordMonsterEncounter: recordMonsterEncounter,
    recordMonsterDefeat: recordMonsterDefeat,
    setProgress: setProgress,
    completeStory: completeStory,
    getStoryState: getStoryState,
    exportData: exportData,
    importData: importData
  };

  window.addEventListener("beforeunload", function () {
    try { save(); } catch (error) { console.warn(error); }
  });
})();
