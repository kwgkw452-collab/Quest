(function () {
  "use strict";

  // Ver.1/alpha8 compatibility facade. New code should use SpeechEngine.
  window.SpeechHelper = {
    normalizeSpeech: SpeechEngine.normalize,
    includesAny: SpeechEngine.includesAny,
    listen: SpeechEngine.listen,
    supported: SpeechEngine.supported
  };
})();
