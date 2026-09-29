(function () {
  "use strict";

  function showMonster(monster, state) {
    if (monster.battle && monster.battle.layerAnswers) {
      var context = MonsterBattleManager.getContext();
      return showLayers(monster, context ? context.acceptedAnswers : [], state === "complete");
    }
    var src = monster.image[state || "normal"];
    if (!src) return null;
    var presentation = monster.presentation || {};
    return MonsterManager.show(monster.monsterId, state || "normal", {
      replace: true,
      className: presentation.className || undefined
    });
  }

  function showLayers(monster, accepted, complete) {
    var selected = accepted || [];
    var layers = ["base"];
    ["eyes", "nose", "mouth", "ears"].forEach(function (part) {
      if (selected.indexOf(part) === -1) return;
      layers.push(complete && part === "mouth" ? "smile" : part);
    });
    return MonsterManager.showLayers(monster.monsterId, layers, {
      className: monster.presentation && monster.presentation.className
    });
  }

  window.MonsterBattlePresenter = {
    showMonster: showMonster,
    showLayers: showLayers
  };
})();
