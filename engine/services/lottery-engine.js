(function () {
  "use strict";

  var SCHEMA_VERSION = "1.0";
  var pools = Object.create(null);

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function validate(source) {
    var errors = [];
    var poolIds = Object.create(null);
    if (!Array.isArray(source)) return ["LotteryPoolData must be an array."];

    source.forEach(function (pool, poolIndex) {
      var poolLabel = "LotteryPoolData[" + poolIndex + "]";
      if (!isPlainObject(pool)) {
        errors.push(poolLabel + " must be an object.");
        return;
      }
      if (!pool.poolId || typeof pool.poolId !== "string") {
        errors.push(poolLabel + " needs string 'poolId'.");
      } else if (poolIds[pool.poolId]) {
        errors.push("Duplicate lottery poolId: " + pool.poolId);
      } else {
        poolIds[pool.poolId] = true;
      }
      if (!Array.isArray(pool.items)) {
        errors.push(poolLabel + " needs array 'items'.");
        return;
      }

      var itemIds = Object.create(null);
      pool.items.forEach(function (item, itemIndex) {
        var itemLabel = poolLabel + ".items[" + itemIndex + "]";
        if (!isPlainObject(item)) {
          errors.push(itemLabel + " must be an object.");
          return;
        }
        if (!item.itemId || typeof item.itemId !== "string") {
          errors.push(itemLabel + " needs string 'itemId'.");
        } else if (itemIds[item.itemId]) {
          errors.push("Duplicate lottery itemId in " + pool.poolId + ": " + item.itemId);
        } else {
          itemIds[item.itemId] = true;
        }
        if (!item.conceptId || typeof item.conceptId !== "string") {
          errors.push(itemLabel + " needs string 'conceptId'.");
        }
        if (!Object.prototype.hasOwnProperty.call(item, "displayValue")) {
          errors.push(itemLabel + " needs 'displayValue'.");
        }
        if (item.metadata !== undefined && !isPlainObject(item.metadata)) {
          errors.push(itemLabel + " metadata must be an object.");
        }
        if (!Array.isArray(item.prompts) || item.prompts.length === 0) {
          errors.push(itemLabel + " needs non-empty array 'prompts'.");
          return;
        }
        item.prompts.forEach(function (prompt, promptIndex) {
          var promptLabel = itemLabel + ".prompts[" + promptIndex + "]";
          if (!isPlainObject(prompt)) {
            errors.push(promptLabel + " must be an object.");
            return;
          }
          ["promptType", "difficulty", "expectedUtterance"].forEach(function (field) {
            if (!prompt[field] || typeof prompt[field] !== "string") {
              errors.push(promptLabel + " needs string '" + field + "'.");
            }
          });
          if (!Array.isArray(prompt.acceptedVariants) || prompt.acceptedVariants.some(function (variant) {
            return typeof variant !== "string" || !variant;
          })) {
            errors.push(promptLabel + " acceptedVariants must be an array of non-empty strings.");
          }
          if (prompt.metadata !== undefined && !isPlainObject(prompt.metadata)) {
            errors.push(promptLabel + " metadata must be an object.");
          }
        });
      });
    });
    return errors;
  }

  function init(source) {
    var errors = validate(source);
    if (errors.length) throw new Error(errors.join("\n"));
    pools = Object.create(null);
    source.forEach(function (pool) { pools[pool.poolId] = clone(pool); });
    return Object.keys(pools).length;
  }

  function getPool(poolId) {
    return pools[String(poolId || "")] ? clone(pools[String(poolId)]) : null;
  }

  function failure(poolId, reason) {
    return {
      schemaVersion: SCHEMA_VERSION,
      status: "unavailable",
      reason: reason,
      poolId: String(poolId || ""),
      itemId: null,
      conceptId: null,
      displayValue: null,
      promptType: null,
      difficulty: null,
      expectedUtterance: null,
      acceptedVariants: [],
      metadata: {}
    };
  }

  function candidatesFor(pool, options) {
    var candidates = [];
    pool.items.forEach(function (item) {
      item.prompts.forEach(function (prompt) {
        if (options.difficulty && prompt.difficulty !== options.difficulty) return;
        if (options.promptType && prompt.promptType !== options.promptType) return;
        candidates.push({ item: item, prompt: prompt });
      });
    });
    return candidates;
  }

  function selectedSnapshot(pool, candidate) {
    return clone({
      schemaVersion: SCHEMA_VERSION,
      status: "selected",
      reason: null,
      poolId: pool.poolId,
      itemId: candidate.item.itemId,
      conceptId: candidate.item.conceptId,
      displayValue: candidate.item.displayValue,
      promptType: candidate.prompt.promptType,
      difficulty: candidate.prompt.difficulty,
      expectedUtterance: candidate.prompt.expectedUtterance,
      acceptedVariants: candidate.prompt.acceptedVariants,
      metadata: Object.assign({}, pool.metadata || {}, candidate.item.metadata || {}, candidate.prompt.metadata || {})
    });
  }

  function draw(poolId, options) {
    options = options || {};
    var pool = pools[String(poolId || "")];
    if (!pool) return failure(poolId, "pool-not-found");
    if (!pool.items.length) return failure(poolId, "empty-pool");

    var candidates = candidatesFor(pool, options);
    if (!candidates.length) return failure(poolId, "no-matching-candidates");

    var distinctItemIds = candidates.reduce(function (ids, candidate) {
      if (ids.indexOf(candidate.item.itemId) === -1) ids.push(candidate.item.itemId);
      return ids;
    }, []);
    if (options.previousItemId && distinctItemIds.length > 1) {
      candidates = candidates.filter(function (candidate) {
        return candidate.item.itemId !== options.previousItemId;
      });
    }

    var randomFn = typeof options.randomFn === "function" ? options.randomFn : Math.random;
    var randomValue = Number(randomFn());
    if (!isFinite(randomValue)) randomValue = 0;
    randomValue = Math.max(0, Math.min(0.9999999999999999, randomValue));
    var index = Math.floor(randomValue * candidates.length);
    return selectedSnapshot(pool, candidates[index]);
  }

  function snapshot(result) {
    return result ? clone(result) : null;
  }

  window.LotteryEngine = {
    init: init,
    validate: validate,
    getPool: getPool,
    draw: draw,
    snapshot: snapshot,
    schemaVersion: SCHEMA_VERSION
  };
})();
