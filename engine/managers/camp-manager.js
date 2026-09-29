(function () {
  "use strict";

  var runId = 0;
  var result = null;

  function usesNightAtmosphere(camp) {
    return camp.steps.some(function (step) {
      return step.type === "background" && step.src === "camp";
    });
  }

  function stopNightAtmosphere() {
    if (window.AudioManager && typeof AudioManager.stopBgm === "function") {
      AudioManager.stopBgm();
    }
  }

  function snapshot(value) {
    if (!value) return null;
    return {
      campId: value.campId,
      status: value.status,
      completedSteps: value.completedSteps,
      error: value.error
    };
  }

  function hasTrait(character, trait) {
    return Array.isArray(character.traits) && character.traits.indexOf(trait) !== -1;
  }

  function shuffle(values) {
    var result = values.slice();
    for (var i = result.length - 1; i > 0; i -= 1) {
      var index = Math.floor(Math.random() * (i + 1));
      var temporary = result[i];
      result[i] = result[index];
      result[index] = temporary;
    }
    return result;
  }

  function selectCompanions(step) {
    var ids = window.SaveManager && SaveManager.getCompanionIds ? SaveManager.getCompanionIds() : [];
    var seen = Object.create(null);
    var candidates = ids.map(function (id) { return CharacterDatabase.get(id); }).filter(function (character) {
      if (!character || !Number.isInteger(character.id)) return false;
      if (seen[character.id]) return false;
      seen[character.id] = true;
      if (character.gender === "female" && !hasTrait(character, "rests-outdoors")) return false;
      return !hasTrait(character, "rests-indoors");
    });
    var maximum = Math.max(0, Number(step.max || 3));
    var minimum = Math.min(maximum, Math.max(0, Number(step.min || 2)));
    var count = Math.min(candidates.length, maximum);
    if (candidates.length > minimum && maximum > minimum) {
      count = Math.min(candidates.length, minimum + Math.floor(Math.random() * (maximum - minimum + 1)));
    }
    return shuffle(candidates).slice(0, count);
  }

  function campSlots(count) {
    if (count <= 1) return ["camp-slot-center"];
    if (count === 2) return ["camp-slot-left", "camp-slot-right"];
    return ["camp-slot-left", "camp-slot-center", "camp-slot-right"];
  }

  function campPose(character, step) {
    if (hasTrait(character, "does-not-sleep")) return character.defaultPose || "normal";
    return step.pose || "inactive";
  }

  function showCompanions(step) {
    var selected = selectCompanions(step);
    var slots = campSlots(selected.length);
    CharacterManager.show(selected.map(function (character, index) {
      return {
        id: "camp-character-" + character.id,
        character: character.key,
        pose: campPose(character, step),
        className: "camp-character " + slots[index] + " size-medium"
      };
    }));
    selected.forEach(function (character, index) {
      if (!hasTrait(character, "does-not-sleep")) {
        CharacterManager.addFloatingText(step.sleepText || "Zzz...", "zzz camp-zzz " + slots[index]);
      }
    });
  }

  async function runStep(step) {
    if (!step || !step.type) return;
    if (step.type === "clear") {
      CharacterManager.clear();
      DialogManager.hide();
      if (step.filter !== undefined) EffectManager.setFilter(step.filter);
      return;
    }
    if (step.type === "background") {
      EffectManager.setBackground(step.src);
      return;
    }
    if (step.type === "filter") {
      EffectManager.setFilter(step.visible);
      return;
    }
    if (step.type === "companions") {
      showCompanions(step);
      return;
    }
    if (step.type === "dialogue") {
      var text = typeof step.text === "function" ? step.text() : step.text;
      DialogManager.show(step.speaker || "", text || "");
      await DialogManager.next(step.button || GameConfig.dialogueNextLabel);
      return;
    }
    if (step.type === "effect") {
      await EffectManager.play(step.key, step.ms);
      return;
    }
    if (step.type === "audio") {
      AudioManager.playSe(step.key);
      return;
    }
    throw new Error("Unknown camp step: " + step.type);
  }

  async function start(campId) {
    var camp = CampDatabase.get(campId);
    if (!camp) throw new Error("Camp not found: " + campId);

    cancel();
    var currentRun = runId;
    var currentResult = {
      campId: camp.id,
      status: camp.enabled ? "running" : "disabled",
      completedSteps: 0,
      error: null
    };
    result = currentResult;
    if (!camp.enabled) return snapshot(currentResult);

    var atmosphereStarted = false;
    if (usesNightAtmosphere(camp) && window.AudioManager && typeof AudioManager.playBgm === "function") {
      AudioManager.playBgm("campNightAtmosphere", { loop: true, volume: 0.52, fadeInMs: 700 });
      atmosphereStarted = true;
    }

    try {
      for (var i = 0; i < camp.steps.length; i += 1) {
        if (atmosphereStarted && i === camp.steps.length - 1 && camp.steps[i].type === "clear") {
          DialogManager.hide();
          await EffectManager.wait(1000);
          if (currentRun !== runId) return snapshot(currentResult);
        }
        await runStep(camp.steps[i]);
        if (currentRun !== runId) return snapshot(currentResult);
        currentResult.completedSteps += 1;
      }
      DialogManager.hide();
      if (atmosphereStarted) stopNightAtmosphere();
      currentResult.status = "completed";
      return snapshot(currentResult);
    } catch (error) {
      if (currentRun !== runId) return snapshot(currentResult);
      if (atmosphereStarted) stopNightAtmosphere();
      currentResult.status = "failure";
      currentResult.error = error && error.message ? error.message : String(error);
      return snapshot(currentResult);
    }
  }

  function cancel() {
    runId += 1;
    stopNightAtmosphere();
    if (result && result.status === "running") result.status = "cancelled";
    return snapshot(result);
  }

  function getResult() { return snapshot(result); }

  function reset() {
    cancel();
    result = null;
  }

  window.CampManager = {
    start: start,
    cancel: cancel,
    getResult: getResult,
    reset: reset
  };
})();
