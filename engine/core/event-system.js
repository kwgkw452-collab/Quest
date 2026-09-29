(function () {
  "use strict";

  var namedEvents = Object.create(null);

  function cloneObject(source) {
    var target = {};
    Object.keys(source || {}).forEach(function (key) { target[key] = source[key]; });
    return target;
  }

  function resolve(value, state) {
    return window.StoryEngine ? StoryEngine.valueOf(value, state) : value;
  }

  function readPath(source, path) {
    if (!path) return source;
    return String(path).split(".").reduce(function (value, key) {
      return value === undefined || value === null ? undefined : value[key];
    }, source);
  }

  function actualValue(condition, state) {
    if (!condition || typeof condition !== "object") return condition;
    if (condition.value !== undefined) return resolve(condition.value, state);
    if (condition.state !== undefined) return readPath(state, condition.state);
    if (condition.flag !== undefined) return SaveManager.getFlag(condition.flag);
    if (condition.item !== undefined) return SaveManager.getItemCount(condition.item);
    return undefined;
  }

  function evaluate(condition, state) {
    if (typeof condition === "function") return Boolean(condition(state, SaveManager.getData()));
    if (typeof condition === "boolean") return condition;
    if (!condition || typeof condition !== "object") return Boolean(condition);

    if (Array.isArray(condition.all)) {
      return condition.all.every(function (item) { return evaluate(item, state); });
    }
    if (Array.isArray(condition.any)) {
      return condition.any.some(function (item) { return evaluate(item, state); });
    }
    if (condition.not !== undefined) return !evaluate(condition.not, state);

    var actual = actualValue(condition, state);
    if (condition.equals !== undefined) return actual === resolve(condition.equals, state);
    if (condition.notEquals !== undefined) return actual !== resolve(condition.notEquals, state);
    if (condition.greaterThan !== undefined) return Number(actual) > Number(resolve(condition.greaterThan, state));
    if (condition.greaterThanOrEqual !== undefined) return Number(actual) >= Number(resolve(condition.greaterThanOrEqual, state));
    if (condition.lessThan !== undefined) return Number(actual) < Number(resolve(condition.lessThan, state));
    if (condition.lessThanOrEqual !== undefined) return Number(actual) <= Number(resolve(condition.lessThanOrEqual, state));
    if (condition.includes !== undefined) {
      if (Array.isArray(actual)) return actual.indexOf(resolve(condition.includes, state)) !== -1;
      return String(actual || "").indexOf(String(resolve(condition.includes, state))) !== -1;
    }
    return Boolean(actual);
  }

  function register(name, handler) {
    if (!name || typeof handler !== "function") {
      throw new Error("EventSystem.register needs an event name and function.");
    }
    namedEvents[name] = handler;
  }

  function has(name) {
    return Boolean(namedEvents[name]);
  }

  async function call(name, payload, context) {
    var handler = namedEvents[name];
    if (!handler) throw new Error("EventSystem event is not registered: " + name);
    var eventContext = {
      name: name,
      payload: payload || {},
      story: context.story,
      state: context.state,
      step: context.step,
      index: context.index
    };
    if (window.StoryEvents) await StoryEvents.emit("event:enter", eventContext);
    var result = await handler(eventContext);
    if (window.StoryEvents) await StoryEvents.emit("event:complete", eventContext);
    return result;
  }

  async function runSteps(steps, context) {
    if (!window.StoryEngine) throw new Error("StoryEngine is not loaded.");
    return StoryEngine.runSteps(steps || [], context.state, context.story, context.index);
  }

  function installStoryCommands() {
    if (!window.StoryEngine || installStoryCommands.done) return;
    installStoryCommands.done = true;

    StoryEngine.register("sequence", async function (step, state, index, story) {
      await runSteps(step.steps || [], { state: state, story: story, step: step, index: index });
    });

    StoryEngine.register("parallel", async function (step, state, index, story) {
      await Promise.all((step.steps || []).map(function (nestedStep, nestedIndex) {
        return StoryEngine.runStep(nestedStep, state, nestedIndex, story);
      }));
    });

    StoryEngine.register("branch", async function (step, state, index, story) {
      var selected = evaluate(step.condition, state) ? step.thenSteps : step.elseSteps;
      await runSteps(selected || [], { state: state, story: story, step: step, index: index });
    });

    StoryEngine.register("repeat", async function (step, state, index, story) {
      var times = Math.max(0, Number(resolve(step.times, state)) || 0);
      for (var i = 0; i < times; i += 1) {
        state.repeatIndex = i;
        await runSteps(step.steps || [], { state: state, story: story, step: step, index: index });
      }
      delete state.repeatIndex;
    });

    StoryEngine.register("event", async function (step, state, index, story) {
      var result = await call(step.name, cloneObject(step.payload), {
        state: state,
        story: story,
        step: step,
        index: index
      });
      if (step.saveAs) state[step.saveAs] = result;
    });

    StoryEngine.register("checkpoint", async function (step, state, index, story) {
      state.checkpointId = step.id || (story.id + ":" + index);
      SaveManager.setProgress(story.id, index, state);
      SaveManager.save();
      if (window.StoryEvents) {
        await StoryEvents.emit("checkpoint", {
          id: state.checkpointId,
          story: story,
          state: state,
          step: step,
          index: index
        });
      }
    });
  }

  window.EventSystem = {
    register: register,
    has: has,
    call: call,
    evaluate: evaluate,
    runSteps: runSteps,
    install: installStoryCommands
  };

  installStoryCommands();
})();
