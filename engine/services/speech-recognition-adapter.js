(function () {
  "use strict";

  var RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  var activeRecognition = null;

  function s005Trace(options, eventName, detail) {
    var questionId = options && options.s005TraceQuestionId;
    if (typeof questionId !== "string" || questionId.indexOf("s005.communication.") !== 0) return;
    console.log("[S005 TRACE] " + eventName, Object.assign({ questionId: questionId }, detail || {}));
  }

  function stop() {
    if (!activeRecognition) return;
    try { activeRecognition.stop(); } catch (error) { /* already stopped */ }
  }

  function listen(options) {
    options = options || {};
    var legacyTraceContext = options.legacyTraceContext || null;

    function legacyTrace(eventName, detail) {
      if (!legacyTraceContext || !window.LegacySpeechTrace || typeof LegacySpeechTrace.record !== "function") return;
      LegacySpeechTrace.record(legacyTraceContext, eventName, detail);
    }

    return new Promise(function (resolve, reject) {
      if (!RecognitionClass) {
        legacyTrace("adapter-reject", { error: "speech-not-supported" });
        reject(new Error("speech-not-supported"));
        return;
      }

      var recognition = new RecognitionClass();
      var finalText = "";
      var settled = false;
      var timeoutId = null;
      var latestInterim = "";
      var latestAlternatives = [];
      var lastError = null;
      activeRecognition = recognition;

      function finish(kind, value) {
        if (settled) return;
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        if (activeRecognition === recognition) activeRecognition = null;
        if (kind === "resolve") {
          legacyTrace("adapter-resolve", { transcript: String(value || "") });
          resolve(value);
        } else {
          legacyTrace("adapter-reject", Object.assign({
            error: value && value.message ? value.message : String(value || "speech-error")
          }, legacyTraceContext && legacyTraceContext.questionId === "phrase.come_with_us" ? {
            latestInterim: latestInterim,
            latestFinal: finalText.trim()
          } : {}));
          reject(value);
        }
      }

      recognition.lang = options.lang || "ja-JP";
      recognition.interimResults = options.interimResults !== false;
      recognition.continuous = Boolean(options.continuous);
      recognition.maxAlternatives = options.maxAlternatives || 1;

      recognition.onstart = function () {
        legacyTrace("recognition-onstart");
        if (typeof options.onStart === "function") options.onStart();
      };

      recognition.onresult = function (event) {
        var interimText = "";
        var alternatives = [];
        for (var i = event.resultIndex; i < event.results.length; i += 1) {
          var transcript = event.results[i][0].transcript;
          var resultAlternatives = [];
          for (var k = 0; k < event.results[i].length; k += 1) {
            resultAlternatives.push({
              transcript: String(event.results[i][k].transcript || "").trim(),
              confidence: typeof event.results[i][k].confidence === "number" ? event.results[i][k].confidence : null
            });
          }
          legacyTrace("recognition-result", {
            resultIndex: event.resultIndex,
            index: i,
            isFinal: Boolean(event.results[i].isFinal),
            primaryTranscript: String(transcript || "").trim(),
            primaryConfidence: resultAlternatives.length ? resultAlternatives[0].confidence : null,
            alternatives: resultAlternatives
          });
          s005Trace(options, "recognition-result", {
            transcript: String(transcript || "").trim(),
            isFinal: Boolean(event.results[i].isFinal),
            confidence: resultAlternatives.length ? resultAlternatives[0].confidence : null
          });
          if (event.results[i].isFinal) finalText += transcript;
          else interimText += transcript;
          for (var j = 0; j < event.results[i].length; j += 1) {
            var alternative = String(event.results[i][j].transcript || "").trim();
            if (alternative && alternatives.indexOf(alternative) === -1) alternatives.push(alternative);
          }
          if (event.results[i].isFinal) {
            legacyTrace("legacy-final", { transcript: String(transcript || "").trim(), finalText: finalText.trim() });
          } else {
            legacyTrace("legacy-interim", { transcript: String(transcript || "").trim() });
          }
        }

        if (interimText.trim()) latestInterim = interimText.trim();
        latestAlternatives = alternatives.slice();
        var currentText = (finalText + " " + interimText).trim();
        if (legacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.recordInvite === "function") {
          LegacySpeechTrace.recordInvite(legacyTraceContext, "recognition-interim", { transcript: currentText });
        }
        if (typeof options.onInterim === "function") options.onInterim(currentText);
        if (typeof options.onAlternatives === "function") options.onAlternatives(alternatives);
      };

      recognition.onerror = function (event) {
        lastError = event.error || "speech-error";
        s005Trace(options, "recognition-error", { error: lastError });
        legacyTrace("recognition-error", {
          error: lastError,
          message: event.message || "",
          hadFinalText: Boolean(finalText.trim()),
          finalText: finalText.trim(),
          latestInterim: latestInterim,
          alternatives: latestAlternatives.slice()
        });
        finish("reject", new Error(event.error || "speech-error"));
      };

      recognition.onend = function () {
        var result = finalText.trim();
        s005Trace(options, "recognition-end", {
          finalText: result,
          latestInterim: latestInterim,
          alternatives: latestAlternatives.slice()
        });
        if (legacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.recordInvite === "function") {
          LegacySpeechTrace.recordInvite(legacyTraceContext, "recognition-final", { transcript: result });
        }
        legacyTrace("recognition-end", {
          finalText: result,
          latestInterim: latestInterim,
          candidateCount: latestAlternatives.length,
          lastError: lastError
        });
        if (result) finish("resolve", result);
        else finish("reject", new Error("no-speech"));
      };

      if (options.timeoutMs > 0) {
        timeoutId = window.setTimeout(function () {
          try { recognition.stop(); } catch (error) { /* ignore */ }
          finish("reject", new Error("speech-timeout"));
        }, options.timeoutMs);
      }

      try {
        legacyTrace("recognition-start-call");
        recognition.start();
      } catch (error) {
        finish("reject", error);
      }
    });
  }

  window.SpeechRecognitionAdapter = {
    listen: listen,
    stop: stop,
    supported: Boolean(RecognitionClass)
  };
})();
