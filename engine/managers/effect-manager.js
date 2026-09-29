(function () {
  "use strict";

  var scene = null;
  var background = null;
  var blueFilter = null;

  function init(elements) {
    scene = elements.scene;
    background = elements.background;
    blueFilter = elements.blueFilter;
  }

  function wait(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  function setBackground(path) {
    var resolved = window.AssetResolver ? AssetResolver.background(path) : path;
    background.style.backgroundImage = 'url("' + resolved + '")';
  }

  async function backgroundSequence(items, fadeMs, holdMs) {
    var list = items || [];
    for (var i = 0; i < list.length; i += 1) {
      background.classList.add("fade-out");
      await wait(fadeMs === undefined ? 900 : fadeMs);
      setBackground(list[i]);
      background.classList.remove("fade-out");
      await wait(holdMs === undefined ? 3000 : holdMs);
    }
  }

  async function play(keyOrClassName, ms) {
    var effect = window.AssetManager ? AssetManager.effect(keyOrClassName, ms) : {
      className: keyOrClassName,
      duration: ms
    };
    scene.classList.add(effect.className);
    await wait(effect.duration === undefined ? 600 : effect.duration);
    scene.classList.remove(effect.className);
  }

  function setFilter(visible) {
    blueFilter.hidden = !visible;
  }

  function setBattleDamage(level) {
    var damageLevel = Math.max(0, Math.min(3, Number(level) || 0));
    [1, 2, 3].forEach(function (value) {
      scene.classList.remove("battle-damage-" + value);
    });
    if (damageLevel > 0) scene.classList.add("battle-damage-" + damageLevel);
    return damageLevel;
  }

  async function playBattleDefeatTransition(showDefeated) {
    scene.classList.add("battle-explosion");
    await wait(750);
    scene.classList.add("battle-blackout");
    scene.classList.remove("battle-explosion");
    await wait(450);
    if (typeof showDefeated === "function") showDefeated();
    await wait(250);
    scene.classList.add("battle-fruit-reveal");
    scene.classList.remove("battle-blackout");
    await wait(1000);
    scene.classList.remove("battle-fruit-reveal");
  }

  async function playPseudoCampTransition() {
    scene.classList.add("pseudo-camp-transition");
    void scene.offsetWidth;
    scene.classList.add("pseudo-camp-dark");
    await wait(3000);
    scene.classList.remove("pseudo-camp-dark");
    await wait(3000);
    scene.classList.remove("pseudo-camp-transition");
  }

  async function playTravelTransition(destination) {
    scene.classList.add("pseudo-camp-transition");
    void scene.offsetWidth;
    scene.classList.add("pseudo-camp-dark");
    await wait(3000);
    setBackground(destination);
    scene.classList.remove("pseudo-camp-dark");
    await wait(3000);
    scene.classList.remove("pseudo-camp-transition");
  }

  window.EffectManager = {
    init: init,
    wait: wait,
    setBackground: setBackground,
    backgroundSequence: backgroundSequence,
    play: play,
    setFilter: setFilter,
    setBattleDamage: setBattleDamage,
    playBattleDefeatTransition: playBattleDefeatTransition,
    playPseudoCampTransition: playPseudoCampTransition,
    playTravelTransition: playTravelTransition
  };
})();
