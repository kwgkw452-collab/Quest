(function () {
  "use strict";

  window.GameConfig = {
    version: "2.0.1-stable",
    initialStoryId: "S001",
    openingEnabled: true,
    defaultLanguage: "en-US",
    dialogueNextLabel: "つぎへ",
    speechButtonLabel: "🎤 話す",
    recognizedPrefix: "聞き取り中：",
    speechSuccessDelayMs: 500,
    autoSaveStepInterval: 0,
    picoBreakRandomChance: 0.12,
    picoBreakEveryStories: 4,
    picoBreakApiWaitThresholdMs: 1200,
    picoBreakCooldownMs: 60000,
    picoBreakRecentLimit: 3,
    picoBreakNormalCategories: ["rumor", "foreshadow", "tip", "english"]
  };
})();
