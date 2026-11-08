(function () {
  "use strict";
  var active = null;

  function stopVoice(session) {
    if (!session.voice) return;
    session.voice = null;
    if (window.DialogueVoiceAudioInternal) DialogueVoiceAudioInternal.stop();
  }

  function cancel(owner) {
    var session = active;
    if (!session || (owner && session.owner !== owner)) return;
    session.cancelled = true;
    if (session.advance) session.advance("cancelled");
    stopVoice(session);
    session.dispose();
  }

  function status() {
    return active ? { active: true, index: active.index, language: active.language,
      supportEnabled: active.supportEnabled } :
      { active: false, index: null, language: null, supportEnabled: false };
  }

  async function run(owner) {
    cancel();
    var session = { owner: owner, index: 0, language: "english", supportEnabled: false,
      cancelled: false, voice: null, advance: null, off: [], timers: [] };
    active = session;
    var layer = document.createElement("div");
    layer.id = "s006-ending-letter";
    layer.setAttribute("role", "region");
    layer.setAttribute("aria-label", "おじいちゃんへの手紙");
    var image = document.createElement("img");
    image.src = S006EndingData.card;
    image.alt = S006EndingData.lines.map(function (line) { return line.english; }).join("\n\n");
    layer.appendChild(image);
    document.getElementById("item-layer").appendChild(layer);
    var observer = null;
    var disposed = false;
    session.dispose = function () {
      if (disposed) return;
      disposed = true;
      session.off.forEach(function (off) { off(); });
      session.timers.forEach(clearTimeout);
      if (observer) observer.disconnect();
      layer.remove();
      if (active === session) {
        active = null;
        DialogManager.clearControls();
      }
      session.advance = null;
      session.language = null;
      session.supportEnabled = false;
    };
    session.off.push(StoryEvents.on("story:enter", function () { cancel(session.owner); }));
    function leave() { cancel(session.owner); }
    window.addEventListener("pagehide", leave);
    session.off.push(function () { window.removeEventListener("pagehide", leave); });
    if (window.MutationObserver) {
      observer = new MutationObserver(function () { if (!layer.isConnected) leave(); });
      observer.observe(document.getElementById("item-layer"), { childList: true });
    }

    function render() {
      if (active !== session || session.cancelled) return;
      var line = S006EndingData.lines[session.index];
      DialogManager.setContent("Little Monster", line[session.language]);
      DialogManager.clearControls();
      function language(value) {
        if (active !== session || session.cancelled) return;
        session.language = value;
        session.supportEnabled = true;
        render();
      }
      if (!session.supportEnabled) {
        DialogManager.addControl("ピコのサポート", function () { language("japanese"); });
      } else {
        [ ["英語を見る", "english"], ["日本語を見る", "japanese"] ].forEach(function (entry) {
          var button = DialogManager.addControl(entry[0], function () { language(entry[1]); });
          button.setAttribute("aria-pressed", String(session.language === entry[1]));
        });
      }
      DialogManager.addControl("次の文へ", function () {
        if (active === session && session.advance) session.advance("next");
      });
    }

    try {
      for (session.index = 0; session.index < S006EndingData.lines.length; session.index += 1) {
        if (session.cancelled) break;
        session.lineToken = {};
        var line = S006EndingData.lines[session.index];
        DialogManager.show("Little Monster", line[session.language], "s006-ending-dialogue");
        var advance = new Promise(function (resolve) { session.advance = resolve; });
        render();
        var timer;
        var completion;
        try {
          if (!window.DialogueVoiceAudioInternal) throw new Error("voice-unavailable");
          session.voice = DialogueVoiceAudioInternal.play(line.voiceKey, { volume: 1, characterGain: 1 });
          completion = Promise.resolve(session.voice.completion).catch(function () { return { status: "failed" }; });
        } catch (_) { completion = Promise.resolve({ status: "failed" }); }
        // A blocked/failed voice leaves an operable Next button. No auto-replay.
        function onCompletion(token) {
          return function (result) {
            if (active !== session || session.cancelled || session.lineToken !== token || !session.advance) return;
            if (result && result.status === "ended") session.advance("ended");
            else if (result && result.status === "stopped") cancel(session.owner);
          };
        }
        completion.then(onCompletion(session.lineToken));
        timer = setTimeout(function () {
          session.lineToken = null;
          stopVoice(session);
        }, 30000);
        session.timers.push(timer);
        var action = await advance;
        clearTimeout(timer);
        // Invalidate this sentence before stopping; stale completion must not
        // advance the following sentence or clear its selected language.
        session.lineToken = null;
        session.advance = null;
        stopVoice(session);
        if (action === "cancelled" || session.cancelled) break;
      }
      return { storyControl: session.cancelled ? "cancelled" : "continue" };
    } finally {
      stopVoice(session);
      session.dispose();
    }
  }

  window.S006Ending = { run: run, cancel: cancel, getStatus: status };
  StoryEngine.register("s006EndingLetter", function (_, state) { return run(state); });
})();
