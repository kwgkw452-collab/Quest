(function () {
  "use strict";

  function copyObject(source) {
    var target = {};
    Object.keys(source || {}).forEach(function (key) { target[key] = source[key]; });
    return target;
  }

  function commandFromText(text) {
    var source = String(text || "").trim();
    if (source === "PICO_BREAK") return { type: "picoBreak" };
    if (source === "PICO_BREAK_WAIT") return { type: "picoBreakWait" };
    if (source === "PICO_BREAK_OFF") return { type: "picoBreakOff" };
    if (source === "PICO_BREAK_ON") return { type: "picoBreakOn" };

    var force = source.match(/^PICO_BREAK_FORCE\s+([^\s]+)$/);
    if (force) return { type: "picoBreakForce", id: force[1] };
    var battle = source.match(/^MONSTER_BATTLE\s+(M\d{3})$/i);
    if (battle) return { type: "monsterBattle", monsterId: battle[1].toLowerCase() };
    var camp = source.match(/^CAMP\s+([^\s]+)$/i);
    if (camp) return { type: "camp", campId: camp[1].toUpperCase() };
    var morning = source.match(/^MORNING\s+([^\s]+)$/i);
    if (morning) return { type: "morning", morningId: morning[1].toUpperCase() };
    var question = source.match(/^QUESTION\s+([^\s]+)$/i);
    if (question) return { type: "question", questionId: question[1] };
    var addCompanion = source.match(/^ADD_COMPANION\s+(\d+)$/i);
    if (addCompanion) return { type: "addCompanion", characterId: Number(addCompanion[1]) };
    var removeCompanion = source.match(/^REMOVE_COMPANION\s+(\d+)$/i);
    if (removeCompanion) return { type: "removeCompanion", characterId: Number(removeCompanion[1]) };
    return null;
  }

  function normalizeNested(step) {
    ["steps", "thenSteps", "elseSteps"].forEach(function (field) {
      if (Array.isArray(step[field])) step[field] = step[field].map(normalizeStep);
    });
    return step;
  }

  function normalizeStep(step) {
    if (typeof step === "string") return commandFromText(step) || step;
    if (!step || typeof step !== "object") return step;
    if (step.type) return normalizeNested(copyObject(step));

    var keys = Object.keys(step);
    if (keys.length !== 1) return copyObject(step);

    var key = keys[0];
    var value = step[key];

    if (key === "clear" && value === true) return { type: "clear" };
    if (key === "hideDialogue" && value === true) return { type: "hideDialogue" };
    if (key === "background") return { type: "background", src: value };
    if (key === "wait") return { type: "wait", ms: value };
    if (key === "filter") return { type: "filter", visible: Boolean(value) };

    if (value && typeof value === "object" && !Array.isArray(value)) {
      var normalized = copyObject(value);
      normalized.type = key;
      return normalizeNested(normalized);
    }

    return copyObject(step);
  }

  function compile(story) {
    if (!story || typeof story !== "object") return story;

    var compiled = copyObject(story);
    var sourceSteps = Array.isArray(story.steps) ? story.steps : [];
    compiled.steps = sourceSteps.map(normalizeStep);
    compiled.__compiled = true;
    return compiled;
  }

  window.StoryCompiler = {
    compile: compile,
    normalizeStep: normalizeStep,
    commandFromText: commandFromText
  };
})();
