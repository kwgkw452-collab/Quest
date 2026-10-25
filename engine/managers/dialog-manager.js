(function () {
  "use strict";

  var els = null;
  var informationArea = null;
  var primaryArea = null;
  var primaryGoal = null;
  var communicationLayout = false;
  var goalContent = "";
  var supportContent = "";
  var speechTranscript = null;

  // Presentation only: the existing fixed Story profile owns activation.
  function wideStory() {
    return els && typeof els.dialogueBox.closest === "function" &&
      els.dialogueBox.closest('#game-stage[data-stage-profile="wide-story"]');
  }

  function updateInformationVisibility() {
    if (!informationArea) return;
    informationArea.hidden = !(communicationLayout && els.message.textContent) && els.recognizedText.hidden;
  }

  function informationLayout(active, communication) {
    if (active && !informationArea) {
      primaryArea = document.createElement("div");
      primaryArea.className = "dialogue-primary";
      primaryGoal = document.createElement("div");
      primaryGoal.className = "dialogue-primary-goal";
      informationArea = document.createElement("div");
      informationArea.className = "dialogue-information";
      informationArea.tabIndex = 0;
      informationArea.setAttribute("role", "region");
      informationArea.setAttribute("aria-label", "サポート情報");
      els.dialogueBox.insertBefore(primaryArea, els.controls);
      els.dialogueBox.insertBefore(informationArea, els.controls);
      els.dialogueBox.scrollTop = 0;
    } else if (!active && informationArea) {
      els.dialogueBox.insertBefore(els.speaker, primaryArea);
      els.dialogueBox.insertBefore(els.message, primaryArea);
      els.dialogueBox.insertBefore(els.recognizedText, primaryArea);
      primaryArea.remove();
      informationArea.remove();
      informationArea = null;
      primaryArea = null;
      primaryGoal = null;
      els.speaker.hidden = false;
    }
    communicationLayout = Boolean(active && communication);
    if (!active) return;
    els.dialogueBox.classList.add("dialogue-wide-ui");
    primaryArea.appendChild(els.speaker);
    primaryArea.appendChild(primaryGoal);
    (communicationLayout ? informationArea : primaryArea).appendChild(els.message);
    informationArea.appendChild(els.recognizedText);
    primaryGoal.hidden = !communicationLayout;
    els.speaker.hidden = communicationLayout;
  }

  function init(elements) {
    els = elements;
  }

  function requireInit() {
    if (!els) throw new Error("DialogManager.init has not been called.");
  }

  var UI_LABELS_JA = Object.freeze({
    "Next": "次へ",
    "Continue": "続ける",
    "Speak": "話す",
    "Retry": "もう一度言う",
    "Try again": "もう一度言う",
    "Battle": "バトル開始",
    "Camp": "キャンプ",
    "Finish": "終了する",
    "Pico's Support": "ピコのサポート",
    "Yes": "はい",
    "No": "いいえ"
  });

  var UI_MESSAGES_JA = Object.freeze({
    "Say a fruit word!": "フルーツの名前を英語で言ってね。",
    "Say a fruit word.": "フルーツの名前を英語で言ってね。",
    "Say a number!": "数字を英語で言ってね。",
    "Say a number.": "数字を英語で言ってね。",
    "Say a season!": "季節を英語で言ってね。",
    "Say a season.": "季節を英語で言ってね。",
    "One more word!": "別の言葉をもう一つ言ってね。",
    "One more fruit!": "別のフルーツをもう一つ言ってね。",
    "Listening...": "聞いているよ…",
    "Speak now.": "話してね。",
    "No speech detected.": "うまく聞き取れなかったよ。"
  });

  function uiLabel(label) {
    return UI_LABELS_JA[label] || label;
  }

  function uiMessage(message) {
    return UI_MESSAGES_JA[message] || message;
  }

  function button(label, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-button";
    btn.textContent = uiLabel(label);
    btn.addEventListener("click", onClick);
    return btn;
  }

  function show(speaker, message, modeClass) {
    requireInit();
    els.dialogueBox.hidden = false;
    els.dialogueBox.className = "dialogue-box" + (modeClass ? " " + modeClass : "");
    informationLayout(Boolean(wideStory()), /\bcommunication-dialogue\b/.test(modeClass || ""));
    if (!communicationLayout) resetCommunicationInformation();
    els.speaker.textContent = speaker || "";
    els.message.textContent = uiMessage(message) || "";
    els.controls.innerHTML = "";
    speechTranscript = null;
    hideRecognized();
    if (informationArea) informationArea.scrollTop = 0;
  }

  function showCommunication(speaker, message, goal) {
    var keepSupport = goal && goal === goalContent && message === goal;
    show(speaker, message, wideStory() ? "communication-dialogue" : undefined);
    if (!communicationLayout) return;
    goalContent = goal || message || "";
    var prefix = goal ? goal + "\n\n" : "";
    if (!keepSupport) supportContent = prefix && message.indexOf(prefix) === 0 ?
      message.slice(prefix.length) : (goal && message !== goal ? message : "");
    primaryGoal.textContent = goalContent;
    setCommunicationInformation(supportContent);
  }

  function resetCommunicationInformation() {
    goalContent = "";
    supportContent = "";
  }

  function setCommunicationInformation(message) {
    if (!communicationLayout) return;
    els.message.textContent = message || "";
    updateInformationVisibility();
  }

  function addCommunicationLanguageControls(english, japanese, isCurrent) {
    if (!communicationLayout || !english || !japanese) return;
    var englishButton;
    var japaneseButton;
    function select(language) {
      if (!communicationLayout || speechTranscript || (isCurrent && !isCurrent())) return;
      // The Japanese Goal already occupies the header; never duplicate it.
      setCommunicationInformation(language === "english" ? english : (japanese === goalContent ? "" : japanese));
      informationArea.scrollTop = 0;
      englishButton.setAttribute("aria-pressed", String(language === "english"));
      japaneseButton.setAttribute("aria-pressed", String(language === "japanese"));
    }
    englishButton = button("英語を見る", function () { select("english"); });
    japaneseButton = button("日本語を見る", function () { select("japanese"); });
    englishButton.setAttribute("aria-pressed", "false");
    japaneseButton.setAttribute("aria-pressed", "false");
    els.controls.appendChild(englishButton);
    els.controls.appendChild(japaneseButton);
  }

  function setContent(speaker, message) {
    requireInit();
    els.speaker.textContent = speaker || "";
    els.message.textContent = message || "";
  }

  function clearControls() {
    requireInit();
    els.controls.innerHTML = "";
    speechTranscript = null;
  }

  function addControl(label, onClick, options) {
    requireInit();
    var action = button(label, onClick);
    options = options || {};
    action.disabled = options.disabled === true;
    els.controls.appendChild(action);
    revealAction(action);
    return action;
  }

  function hide() {
    requireInit();
    els.dialogueBox.hidden = true;
  }

  function setSpeechLayout(active) {
    var classList = els.dialogueBox && els.dialogueBox.classList;
    if (!classList) return;
    if (active) classList.add("speech-listening");
    else classList.remove("speech-listening");
  }

  function showRecognized(text, prefix) {
    requireInit();
    if (communicationLayout && speechTranscript) {
      speechTranscript.textContent = "聞き取った内容：" + (text === "…" ? "" : (text || ""));
      return;
    }
    // The shared speech gate sends an ellipsis before any transcript exists.
    // Keep that placeholder in the fixed status row, not the information area.
    if (informationArea && text === "…" && prefix === "聞き取り中：") return;
    setSpeechLayout(true);
    els.recognizedText.hidden = false;
    var visiblePrefix = prefix === undefined ? (GameConfig.recognizedPrefix || "") : prefix;
    if (informationArea && visiblePrefix === "聞き取り中：") visiblePrefix = "認識結果：";
    els.recognizedText.textContent = /^You said:\s*$/i.test(visiblePrefix) ?
      (text || "…") + " と聞こえたよ。" : visiblePrefix + (text || "…");
    updateInformationVisibility();
  }

  function showSpeechStatus(speaker, goal, status) {
    if (communicationLayout) {
      clearControls();
      hideRecognized();
      primaryGoal.textContent = goal || goalContent;
      setCommunicationInformation(supportContent);
      setSpeechLayout(true);
      var indicator = document.createElement("div");
      indicator.className = "dialogue-listening-status";
      indicator.setAttribute("role", "status");
      var label = document.createElement("span");
      label.className = "dialogue-listening-label";
      label.textContent = status || "🎤 聞き取り中…";
      speechTranscript = document.createElement("span");
      speechTranscript.className = "dialogue-listening-transcript";
      speechTranscript.textContent = "聞き取った内容：";
      indicator.appendChild(label);
      indicator.appendChild(speechTranscript);
      els.controls.appendChild(indicator);
      return;
    }
    show(speaker || "", goal || "", "speech-listening");
    setSpeechLayout(true);
    els.recognizedText.hidden = false;
    els.recognizedText.textContent = status || "🎤 聞き取り中…";
  }

  function hideRecognized() {
    requireInit();
    setSpeechLayout(false);
    els.recognizedText.hidden = true;
    els.recognizedText.textContent = "";
    updateInformationVisibility();
  }

  function revealAction(action) {
    if (informationArea) return;
    var box = els.dialogueBox;
    if (!box || !action || typeof box.getBoundingClientRect !== "function" ||
        typeof action.getBoundingClientRect !== "function") return;

    var boxRect = box.getBoundingClientRect();
    var actionRect = action.getBoundingClientRect();
    if (actionRect.bottom > boxRect.bottom) {
      box.scrollTop += actionRect.bottom - boxRect.bottom;
    } else if (actionRect.top < boxRect.top) {
      box.scrollTop -= boxRect.top - actionRect.top;
    }
  }

  function next(label) {
    requireInit();
    return new Promise(function (resolve) {
      addControl(label || GameConfig.dialogueNextLabel, resolve);
    });
  }

  function textInput(promptText) {
    requireInit();
    return new Promise(function (resolve) {
      show("ピコ", promptText);
      var input = document.createElement("input");
      input.type = "text";
      input.className = "text-input";
      input.autocomplete = "off";
      var ok = button("決定", function () {
        var value = input.value.trim();
        if (value) resolve(value);
      });
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") ok.click();
      });
      els.controls.appendChild(input);
      els.controls.appendChild(ok);
      input.focus();
    });
  }

  function choice(options) {
    requireInit();
    return new Promise(function (resolve) {
      (options || []).forEach(function (option) {
        els.controls.appendChild(button(option.label, function () { resolve(option.value); }));
      });
    });
  }

  window.DialogManager = {
    init: init,
    button: button,
    show: show,
    showCommunication: showCommunication,
    addCommunicationLanguageControls: addCommunicationLanguageControls,
    resetCommunicationInformation: resetCommunicationInformation,
    setContent: setContent,
    clearControls: clearControls,
    addControl: addControl,
    hide: hide,
    showRecognized: showRecognized,
    showSpeechStatus: showSpeechStatus,
    hideRecognized: hideRecognized,
    next: next,
    textInput: textInput,
    choice: choice
  };

  var ADVENTURE_RETURN = "adventure_return";
  var pendingControlResult = null;
  var rescueMessage = "うまく聞き取れなかったピコ。\nもう一度やってもいいし、\nこのまま冒険に戻ってもいいピコ。";
  var finalRescueMessage = "うまく聞き取れなかったピコ。\n今回はこのまま冒険に戻るピコ。";
  window.FiniteRescue = Object.freeze({
    ADVENTURE_RETURN: ADVENTURE_RETURN,
    RESCUE_MESSAGE: rescueMessage,
    FINAL_RESCUE_MESSAGE: finalRescueMessage,
    errorCode: function (error) {
      return String(error && error.message ? error.message : error || "speech-error").toLowerCase();
    },
    isImmediateTechnicalFailure: function (error) {
      var code = this.errorCode(error);
      return ["not-allowed", "permission-denied", "permission denied", "speech-not-supported",
        "unsupported", "recognition-start-failure", "recognition start failure", "start-failure"].some(function (item) {
        return code === item || code.indexOf(item) !== -1;
      });
    },
    result: function (error) {
      return { status: ADVENTURE_RETURN, controlResult: ADVENTURE_RETURN,
        error: error ? this.errorCode(error) : null };
    },
    record: function (value) { pendingControlResult = value || null; },
    consume: function () {
      var value = pendingControlResult;
      pendingControlResult = null;
      return value;
    },
    clear: function () { pendingControlResult = null; },
    choose: async function (allowRetry) {
      hideRecognized();
      show("ピコ", allowRetry ? rescueMessage : finalRescueMessage);
      var options = allowRetry ? [{ label: "もう一度言う", value: "retry" }] : [];
      options.push({ label: "言わずに冒険に戻る", value: ADVENTURE_RETURN });
      return choice(options);
    }
  });
})();
