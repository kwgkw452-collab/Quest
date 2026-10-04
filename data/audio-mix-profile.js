(function () {
  "use strict";

  window.AudioMixProfile = {
    groups: { BGM: 1.0, AMBIENT: 1.0, SE: 1.0, MOTIF: 1.0, VOICE: 1.0 },
    voiceCharacters: {
      c01: 1.0,
      c02: 0.82,
      c03: 1.0,
      c04: 0.82,
      c05: 1.0,
      c06: 1.0,
      c07: 1.0,
      c08: 1.0,
      c09: 1.0,
      c10: 1.0,
      c11: 1.0,
      c12: 1.0,
      c13: 1.0,
      c14: 1.0
    },
    characterProcessing: {
      // Character-specific Web Audio correction is owned by the central mix policy.
      c02: { webAudioGain: 1.10 }
    },
    radioProcessing: {
      presenceGainDb: 4.0,
      outputGain: 0.72
    },
    assets: {
      // Bazaar crowd stays audible, but no longer masks the opening dialogue.
      bazaarCrowd: 0.33
    },
    ducking: {
      speechRecognition: { ratio: 0.25, duckMs: 300, restoreMs: 600 },
      dialogueVoice: { ratio: 0.18, duckMs: 160, restoreMs: 280 }
    },
    oneShots: {
      MOTIF: { duckable: true, dialogueRatio: 0.12 },
      SE: { duckable: false },
      VOICE: { duckable: false }
    },
    fades: { normalInMs: 700, normalOutMs: 500, crossfadeMs: 1200 }
  };
})();
