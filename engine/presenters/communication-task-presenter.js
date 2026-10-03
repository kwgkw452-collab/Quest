(function () {
  "use strict";
  function controls() { return document.getElementById("controls"); }
  function dialogueBox() { return document.getElementById("dialogue-box"); }

  function revealControl(control) {
    var box = dialogueBox();
    if (!box || !control || typeof box.getBoundingClientRect !== "function" ||
        typeof control.getBoundingClientRect !== "function") return;
    var boxRect = box.getBoundingClientRect();
    var controlRect = control.getBoundingClientRect();
    if (controlRect.bottom > boxRect.bottom) {
      box.scrollTop += controlRect.bottom - boxRect.bottom;
    } else if (controlRect.top < boxRect.top) {
      box.scrollTop -= boxRect.top - controlRect.top;
    }
  }

  function clearControls() {
    var container = controls();
    if (container) container.innerHTML = "";
  }

  function createControl(label, action) {
    return DialogManager.button(label, action);
  }

  function appendControl(control) {
    var container = controls();
    if (!container) return null;
    container.appendChild(control);
    revealControl(control);
    return control;
  }

  function showListening() {
    if (typeof DialogManager.showSpeechStatus === "function") {
      DialogManager.showSpeechStatus("ピコ", "", "🎤 聞き取り中…");
    } else {
      DialogManager.show("ピコ", "聞き取り中…");
    }
  }

  function show(result) {
    if (!result) return;
    var judge = result.judgeResult || {};
    var text = "Task: " + result.taskId + "\nStatus: " + result.status + "\nTranscript: " + (result.transcript || "-") +
      "\nJudge: " + (judge.verdict || judge.technicalStatus || "-") + "\nSupport: " + (result.support || "-");
    DialogManager.show("ピコ", text);
  }
  window.CommunicationTaskPresenter = {
    show: show,
    showListening: showListening,
    clearControls: clearControls,
    createControl: createControl,
    appendControl: appendControl,
    revealControl: revealControl
  };
})();
