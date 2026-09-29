(function () {
  "use strict";

  // CSSクラスと標準再生時間を一つの名前で管理する。
  window.EffectDatabase = {
    flash: { className: "screen-flash", duration: 550 },
    shake: { className: "shake", duration: 600 },
    "number-monster-hit": { className: "number-monster-hit", duration: 600 },
    fadeOut: { className: "fade-out", duration: 900 }
  };
})();
