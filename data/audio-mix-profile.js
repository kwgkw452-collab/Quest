(function () {
  "use strict";

  window.AudioMixProfile = {
    groups: { BGM: 1.0, AMBIENT: 1.0, SE: 1.0, MOTIF: 1.0, VOICE: 1.0 },
    voiceCharacters: {
      c01: 1.0,
      c02: 1.0,
      c03: 1.0,
      c04: 1.0
    },
    assets: {},
    ducking: {
      speechRecognition: { ratio: 0.25, duckMs: 300, restoreMs: 600 }
    },
    fades: { normalInMs: 700, normalOutMs: 500, crossfadeMs: 1200 }
  };
})();
