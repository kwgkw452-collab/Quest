(function () {
  "use strict";

  var listeners = Object.create(null);

  function on(eventName, handler) {
    if (!eventName || typeof handler !== "function") {
      throw new Error("StoryEvents.on needs an event name and function.");
    }
    if (!listeners[eventName]) listeners[eventName] = [];
    listeners[eventName].push(handler);
    return function () { off(eventName, handler); };
  }

  function off(eventName, handler) {
    var list = listeners[eventName];
    if (!list) return;
    listeners[eventName] = list.filter(function (item) { return item !== handler; });
  }

  async function emit(eventName, detail) {
    var list = (listeners[eventName] || []).slice();
    for (var i = 0; i < list.length; i += 1) {
      await list[i](detail || {});
    }
  }

  on("step:complete", function (detail) {
    if (!detail.story || detail.story.id !== "S002" || !detail.step ||
        detail.step.type !== "question" ||
        ["phrase.yes_can_hear_you", "phrase.come_with_me"].indexOf(detail.step.questionId) === -1) return;
    var answer = detail.state && detail.state[detail.step.saveAs];
    if (!answer || answer.status !== "success") return;
    if (window.AudioManager && typeof AudioManager.playBgm === "function") {
      AudioManager.playBgm("futureCityPixel", { loop: true, volume: 0.12, fadeInMs: 600 });
    }
  });

  window.StoryEvents = {
    on: on,
    off: off,
    emit: emit
  };
})();
