(function () {
  "use strict";

  var els = {};

  function cache() {
    els.scene = document.getElementById("scene");
    els.background = document.getElementById("background");
    els.blueFilter = document.getElementById("blue-filter");
    els.itemLayer = document.getElementById("item-layer");
    els.mediaLayer = document.getElementById("media-layer");
    els.characterLayer = document.getElementById("character-layer");
    els.dialogueBox = document.getElementById("dialogue-box");
    els.speaker = document.getElementById("speaker");
    els.message = document.getElementById("message");
    els.recognizedText = document.getElementById("recognized-text");
    els.controls = document.getElementById("controls");

    DialogManager.init(els);
    CharacterManager.init(els.characterLayer);
    MonsterManager.init(els.characterLayer);
    EffectManager.init(els);
    VideoManager.init(els.mediaLayer);
    PicoBreakManager.init();
  }

  function clearVisuals() {
    els.itemLayer.innerHTML = "";
    CharacterManager.clear();
  }

  function showItem(path, className) {
    els.itemLayer.innerHTML = "";
    if (className && String(className).split(/\s+/).indexOf("event-fullscreen") !== -1) {
      els.background.style.backgroundImage = "none";
    }
    var img = document.createElement("img");
    img.src = window.AssetResolver ? AssetResolver.item(path) : path;
    img.alt = "";
    img.className = className || "item-image";
    els.itemLayer.appendChild(img);
    return img;
  }

  async function speechMission(config) {
    FiniteRescue.clear();
    var recognitionFailures = 0;
    var mismatchFailures = 0;
    var rescueRetryUsed = false;

    async function runAttempt() {
      var resolveControl;
      var control = new Promise(function (resolve) { resolveControl = resolve; });
      var halted = new Promise(function () {});

      async function rescue(error) {
        var action = await FiniteRescue.choose(!rescueRetryUsed);
        if (action === "retry" && !rescueRetryUsed) {
          rescueRetryUsed = true;
          resolveControl({ retry: true });
          return;
        }
        var adventureReturn = FiniteRescue.result(error);
        FiniteRescue.record(adventureReturn);
        resolveControl(adventureReturn);
      }

      var mission = SpeechEngine.mission(config, {
        showMission: function (value) {
          DialogManager.show(value.speaker || "", value.message || "");
        },
        clearControls: function () { els.controls.innerHTML = ""; },
        showRecognized: DialogManager.showRecognized,
        textInput: function () {
          rescue(new Error("speech-not-supported"));
          return halted;
        },
        addStartButton: function (startListening, value) {
          els.controls.appendChild(DialogManager.button(
            value.buttonLabel || GameConfig.speechButtonLabel,
            startListening
          ));
        },
        showRetry: function (error, startListening, value) {
          recognitionFailures += 1;
          if (FiniteRescue.isImmediateTechnicalFailure(error) || recognitionFailures > 3 || rescueRetryUsed) {
            rescue(error);
            return;
          }
          DialogManager.show("ピコ", value.failure || "声を聞かせてくれてありがとう！もう一度ゆっくり言ってみよう！");
          els.controls.appendChild(DialogManager.button("もう一度言う", startListening));
        },
        onSuccess: async function () {
          await EffectManager.wait(GameConfig.speechSuccessDelayMs);
          DialogManager.hideRecognized();
        },
        onMismatch: async function (answer, value) {
          if (value.retryOnMismatch === false) return;
          mismatchFailures += 1;
          if (mismatchFailures > 3 || rescueRetryUsed) {
            await rescue();
            return halted;
          }
          DialogManager.show("ピコ", value.failure || "声を出せたことが最高だよ！もう一度、一緒にやってみよう！");
          await DialogManager.next("もう一度言う");
        }
      });
      return Promise.race([mission, control]);
    }

    while (true) {
      var result = await runAttempt();
      if (result && result.retry) continue;
      return result;
    }
  }

  // Ver.1系との互換窓口。既存ストーリーを壊さない。
  window.GameCore = {
    cache: cache,
    els: els,
    wait: EffectManager.wait,
    button: DialogManager.button,
    setBackground: EffectManager.setBackground,
    clearVisuals: clearVisuals,
    showItem: showItem,
    showCharacters: CharacterManager.show,
    getCharacter: CharacterManager.get,
    addFloatingText: CharacterManager.addFloatingText,
    showMonster: MonsterManager.show,
    changeMonsterState: MonsterManager.changeState,
    clearMonsters: MonsterManager.clear,
    playVideo: VideoManager.play,
    stopVideo: VideoManager.clear,
    playBgm: AudioManager.playBgm,
    stopBgm: AudioManager.stopBgm,
    playSe: AudioManager.playSe,
    playVoice: AudioManager.playVoice,
    showDialogue: DialogManager.show,
    hideDialogue: DialogManager.hide,
    showRecognized: DialogManager.showRecognized,
    hideRecognized: DialogManager.hideRecognized,
    next: DialogManager.next,
    textInput: DialogManager.textInput,
    choice: DialogManager.choice,
    speechMission: speechMission,
    picoBreak: PicoBreakManager.showSelected,
    picoBreakEvaluate: PicoBreakManager.evaluate,
    picoBreakForce: PicoBreakManager.force,
    picoBreakWait: PicoBreakManager.during,
    // Experimental 0.2互換名。
    picoBreakForced: PicoBreakManager.forced,
    picoBreakDuring: PicoBreakManager.during
  };
})();
