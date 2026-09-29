(function () {
  "use strict";

  var els = {};
  var active = false;
  var currentResolve = null;
  var activeContext = null;
  var recentIds = [];
  var lastShownAt = 0;
  var apiWaitTimer = null;
  var apiWaitVisible = false;
  var apiWaitSequence = 0;
  var hideTimer = null;

  function init() {
    if (!window.PicoBreakStore || !window.PicoBreakCatalog) {
      throw new Error("Pico Break services are not loaded.");
    }
    PicoBreakCatalog.init(Array.isArray(window.PicoBreakData) ? window.PicoBreakData : []);
    els.layer = document.getElementById("pico-break-layer");
    els.card = document.getElementById("pico-break-card");
    els.title = document.getElementById("pico-break-title");
    els.text = document.getElementById("pico-break-text");
    els.close = document.getElementById("pico-break-close");
    if (!els.layer || !els.card || !els.title || !els.text || !els.close) {
      throw new Error("Pico Break DOM is incomplete.");
    }
    els.close.addEventListener("click", close);
  }

  function isEnabled() {
    return PicoBreakStore.isEnabled();
  }

  function setEnabled(enabled) {
    var value = PicoBreakStore.setEnabled(enabled);
    if (!value) {
      endApiWait();
      if (active && activeContext && activeContext.apiWaitToken) close();
    }
    return value;
  }

  function select(context) {
    context = context || {};
    var state = PicoBreakStore.read();
    var persistentRecent = Array.isArray(state.recentIds) ? state.recentIds : [];
    return PicoBreakCatalog.select(context, state, persistentRecent.concat(recentIds), Math.random);
  }

  function record(item, context) {
    var state = PicoBreakStore.read();
    state.shownIds = state.shownIds || {};
    state.shownIds[item.id] = Number(state.shownIds[item.id] || 0) + 1;
    state.lastStoryNumber = PicoBreakCatalog.storyNumber(context.storyId);
    state.lastShownAt = Date.now();
    if (!recentIds.length && Array.isArray(state.recentIds)) {
      recentIds = state.recentIds.slice(-Number(GameConfig.picoBreakRecentLimit || 3));
    }
    recentIds.push(item.id);
    while (recentIds.length > Number(GameConfig.picoBreakRecentLimit || 3)) recentIds.shift();
    state.recentIds = recentIds.slice();
    PicoBreakStore.write(state);
    lastShownAt = Date.now();
  }

  function show(item, context) {
    context = context || {};
    if (!item || active || !isEnabled()) return Promise.resolve(false);
    clearTimeout(hideTimer);
    hideTimer = null;
    active = true;
    activeContext = context;
    els.title.textContent = item.title || "Pico Break";
    els.text.textContent = item.text || "";
    els.card.setAttribute("data-category", item.category || "general");
    els.layer.hidden = false;
    requestAnimationFrame(function () { els.layer.classList.add("show"); });
    record(item, context);
    return new Promise(function (resolve) { currentResolve = resolve; });
  }

  function close() {
    if (!active) return;
    active = false;
    activeContext = null;
    els.layer.classList.remove("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (!active) els.layer.hidden = true;
      hideTimer = null;
    }, 180);
    var resolve = currentResolve;
    currentResolve = null;
    if (resolve) resolve(true);
  }

  function showSelected(context) {
    var item = select(context || {});
    return item ? show(item, context) : Promise.resolve(false);
  }

  function shouldRandom(context) {
    if (!isEnabled()) return false;
    var chance = context.chance === undefined ? Number(GameConfig.picoBreakRandomChance || 0) : Number(context.chance);
    var cooldown = Number(GameConfig.picoBreakCooldownMs || 0);
    var state = PicoBreakStore.read();
    var mostRecent = Math.max(lastShownAt, Number(state.lastShownAt || 0));
    if (Date.now() - mostRecent < cooldown) return false;
    return Math.random() < Math.max(0, Math.min(1, chance));
  }

  function maybeRandom(context) {
    context = context || {};
    return shouldRandom(context) ? showSelected(context) : Promise.resolve(false);
  }

  function maybeInterval(context) {
    context = context || {};
    if (!isEnabled()) return Promise.resolve(false);
    var n = PicoBreakCatalog.storyNumber(context.storyId);
    var every = Math.max(1, Number(context.every || GameConfig.picoBreakEveryStories || 4));
    var state = PicoBreakStore.read();
    if (!n || n === state.lastStoryNumber || n % every !== 0) return Promise.resolve(false);
    return showSelected(context);
  }

  function forced(id, context) {
    if (!isEnabled()) return Promise.resolve(false);
    var item = PicoBreakCatalog.get(id);
    if (!item) return Promise.resolve(false);
    var forcedContext = Object.assign({ allowRecent: true }, context || {});
    var state = PicoBreakStore.read();
    var persistentRecent = Array.isArray(state.recentIds) ? state.recentIds : [];
    if (!PicoBreakCatalog.matches(item, forcedContext, state, persistentRecent.concat(recentIds))) {
      return Promise.resolve(false);
    }
    return show(item, forcedContext);
  }

  function beginApiWait(context) {
    context = context || {};
    if (!isEnabled()) return null;
    clearTimeout(apiWaitTimer);
    apiWaitVisible = false;
    var waitToken = ++apiWaitSequence;
    var threshold = Number(context.thresholdMs || GameConfig.picoBreakApiWaitThresholdMs || 1200);
    apiWaitTimer = setTimeout(function () {
      if (waitToken !== apiWaitSequence) return;
      apiWaitVisible = true;
      showSelected(Object.assign({}, context, {
        category: context.category || "wait",
        allowRecent: true,
        apiWaitToken: waitToken
      })).then(function (shown) {
        if (!shown) apiWaitVisible = false;
      });
    }, threshold);
    return waitToken;
  }

  function endApiWait(waitToken) {
    if (waitToken === null) return;
    if (waitToken !== undefined && waitToken !== apiWaitSequence) return;
    clearTimeout(apiWaitTimer);
    apiWaitTimer = null;
    if (apiWaitVisible && active && activeContext && activeContext.apiWaitToken === apiWaitSequence) close();
    apiWaitVisible = false;
  }

  async function during(promiseOrFactory, context) {
    var waitToken = beginApiWait(context);
    try {
      return await (typeof promiseOrFactory === "function" ? promiseOrFactory() : promiseOrFactory);
    } finally {
      endApiWait(waitToken);
    }
  }

  async function evaluate(context) {
    context = Object.assign({}, context || {});
    if (!context.category && !Array.isArray(context.allowedCategories)) {
      context.allowedCategories = Array.isArray(GameConfig.picoBreakNormalCategories)
        ? GameConfig.picoBreakNormalCategories.slice()
        : ["rumor", "foreshadow", "tip", "english"];
    }
    if (!isEnabled()) return false;

    var intervalShown = await maybeInterval(context);
    if (intervalShown) return true;
    return maybeRandom(context);
  }

  function isActive() { return active; }

  window.PicoBreakManager = {
    init: init,
    select: select,
    show: show,
    showSelected: showSelected,
    maybeRandom: maybeRandom,
    maybeInterval: maybeInterval,
    evaluate: evaluate,
    force: forced,
    // Experimental 0.2互換名。
    forced: forced,
    beginApiWait: beginApiWait,
    endApiWait: endApiWait,
    during: during,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    close: close,
    isActive: isActive
  };
})();
