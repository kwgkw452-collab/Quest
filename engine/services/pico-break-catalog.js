(function () {
  "use strict";

  var items = [];
  var byId = Object.create(null);

  function storyNumber(storyId) {
    var match = String(storyId || "").match(/(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function validate(source) {
    var errors = [];
    var ids = Object.create(null);
    if (!Array.isArray(source)) return ["PicoBreakData must be an array."];

    source.forEach(function (item, index) {
      var label = "PicoBreakData[" + index + "]";
      if (!item || typeof item !== "object") {
        errors.push(label + " must be an object.");
        return;
      }
      ["id", "category", "title", "text"].forEach(function (field) {
        if (!item[field] || typeof item[field] !== "string") errors.push(label + " needs string '" + field + "'.");
      });
      if (item.id && ids[item.id]) errors.push("Duplicate Pico Break id: " + item.id);
      if (item.id) ids[item.id] = true;
      if (item.weight !== undefined && (!isFinite(Number(item.weight)) || Number(item.weight) <= 0)) {
        errors.push(label + " weight must be greater than zero.");
      }
      if (item.minStory !== undefined && !isFinite(Number(item.minStory))) errors.push(label + " minStory must be numeric.");
      if (item.maxStory !== undefined && !isFinite(Number(item.maxStory))) errors.push(label + " maxStory must be numeric.");
      if (isFinite(Number(item.minStory)) && isFinite(Number(item.maxStory)) && Number(item.maxStory) < Number(item.minStory)) {
        errors.push(label + " maxStory must not be less than minStory.");
      }
      if (item.excludeStories !== undefined && !Array.isArray(item.excludeStories)) errors.push(label + " excludeStories must be an array.");
    });
    return errors;
  }

  function init(source) {
    var errors = validate(source);
    if (errors.length) throw new Error(errors.join("\n"));
    items = source.slice();
    byId = Object.create(null);
    items.forEach(function (item) { byId[item.id] = item; });
    return items.length;
  }

  function matches(item, context, state, recentIds) {
    var n = storyNumber(context.storyId);
    var excluded = item.excludeStories || [];
    if (item.minStory && n < item.minStory) return false;
    if (item.maxStory && n > item.maxStory) return false;
    if (excluded.indexOf(n) !== -1) return false;
    if (context.category && item.category !== context.category) return false;
    if (Array.isArray(context.allowedCategories) && context.allowedCategories.indexOf(item.category) === -1) return false;
    if (item.once && state.shownIds && state.shownIds[item.id]) return false;
    if (!context.allowRecent && recentIds.indexOf(item.id) !== -1) return false;
    return true;
  }

  function weightedPick(candidates, random) {
    if (!candidates.length) return null;
    var total = candidates.reduce(function (sum, item) {
      return sum + Number(item.weight || 1);
    }, 0);
    var roll = random() * total;
    for (var i = 0; i < candidates.length; i += 1) {
      roll -= Number(candidates[i].weight || 1);
      if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  function select(context, state, recentIds, random) {
    context = context || {};
    recentIds = recentIds || [];
    var candidates = items.filter(function (item) {
      return matches(item, context || {}, state || {}, recentIds || []);
    });

    // 長期運用でrepeatable候補数が履歴上限を下回っても枯渇させない。
    // once・話数・category条件は維持し、recent条件だけを段階的に緩める。
    if (!candidates.length && !context.allowRecent && recentIds.length) {
      var relaxedContext = Object.assign({}, context, { allowRecent: true });
      candidates = items.filter(function (item) {
        return matches(item, relaxedContext, state || {}, recentIds);
      });
      var lastId = recentIds[recentIds.length - 1];
      var notImmediateRepeat = candidates.filter(function (item) { return item.id !== lastId; });
      if (notImmediateRepeat.length) candidates = notImmediateRepeat;
    }
    return weightedPick(candidates, random || Math.random);
  }

  window.PicoBreakCatalog = {
    init: init,
    validate: validate,
    select: select,
    matches: matches,
    get: function (id) { return byId[id] || null; },
    size: function () { return items.length; },
    storyNumber: storyNumber
  };
})();
