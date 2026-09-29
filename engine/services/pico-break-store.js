(function () {
  "use strict";

  var STATE_KEY = "picoBreakState";
  var ENABLED_KEY = "picoBreakEnabled";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultState() {
    return {
      shownIds: {},
      recentIds: [],
      lastStoryNumber: 0,
      lastShownAt: 0
    };
  }

  function normalize(value) {
    var state = Object.assign(defaultState(), value || {});
    if (!state.shownIds || typeof state.shownIds !== "object") state.shownIds = {};
    if (!Array.isArray(state.recentIds)) state.recentIds = [];
    state.lastStoryNumber = Number(state.lastStoryNumber || 0);
    state.lastShownAt = Number(state.lastShownAt || 0);
    return state;
  }

  function legacyState() {
    if (!window.SaveManager || !SaveManager.getData) return null;
    var data = SaveManager.getData();
    return data.storyState && data.storyState.__picoBreak
      ? data.storyState.__picoBreak
      : null;
  }

  function read() {
    var stored = null;
    if (window.SaveManager && SaveManager.getFlag) {
      stored = SaveManager.getFlag(STATE_KEY, null);
    }
    return clone(normalize(stored || legacyState()));
  }

  function write(state) {
    var normalized = normalize(state);
    if (window.SaveManager && SaveManager.setFlag) {
      SaveManager.setFlag(STATE_KEY, clone(normalized));
    }
    return clone(normalized);
  }

  function isEnabled() {
    if (window.SaveManager && SaveManager.getFlag) {
      return SaveManager.getFlag(ENABLED_KEY, true) !== false;
    }
    return true;
  }

  function setEnabled(enabled) {
    var value = enabled !== false;
    if (window.SaveManager && SaveManager.setFlag) SaveManager.setFlag(ENABLED_KEY, value);
    return value;
  }

  window.PicoBreakStore = {
    read: read,
    write: write,
    isEnabled: isEnabled,
    setEnabled: setEnabled
  };
})();
