(function () {
  "use strict";

  var layer = null;

  function init(characterLayer) {
    layer = characterLayer;
  }

  function requireInit() {
    if (!layer) throw new Error("MonsterManager.init has not been called.");
  }

  function getElement(id) {
    requireInit();
    var monsterId = window.MonsterDatabase ? MonsterDatabase.normalizeId(id) : String(id);
    return layer.querySelector('[data-monster-id="' + monsterId + '"]');
  }

  function show(id, state, options) {
    requireInit();
    options = options || {};
    var definition = AssetResolver.getMonster(id);
    var monster = document.createElement("img");
    monster.src = AssetResolver.monster(id, state || "normal");
    monster.alt = definition.name || "";
    monster.dataset.monsterId = definition.monsterId;
    monster.dataset.monsterState = state || "normal";
    monster.className = "story-character monster-character " + (options.className || "pos-center-low size-medium");

    if (options.replace !== false) clear();
    layer.appendChild(monster);
    return monster;
  }

  function changeState(id, state) {
    var monster = getElement(id);
    if (!monster) throw new Error("Monster not found on screen: " + id);
    monster.src = AssetResolver.monster(id, state);
    monster.dataset.monsterState = state;
    return monster;
  }

  function showLayers(id, revealed, options) {
    requireInit();
    options = options || {};
    var definition = AssetResolver.getMonster(id);
    var paths = definition.image.layers || {};
    var container = document.createElement("div");
    container.dataset.monsterId = definition.monsterId;
    container.dataset.monsterLayers = revealed.join(" ");
    container.className = "story-character monster-character monster-layer-stack " +
      (options.className || "pos-center-low size-medium");
    var splitLayers = definition.presentation && definition.presentation.splitLayers || [];
    revealed.forEach(function (part) {
      if (!paths[part]) return;
      var sides = splitLayers.indexOf(part) === -1 ? [null] : ["left", "right"];
      sides.forEach(function (side) {
      var image = document.createElement("img");
      image.src = paths[part];
      image.alt = "";
      image.dataset.faceLayer = part;
      if (side) image.dataset.faceSide = side;
      image.onerror = function () { image.remove(); };
      container.appendChild(image);
      });
    });
    clear();
    layer.appendChild(container);
    return container;
  }

  function clear() {
    requireInit();
    Array.prototype.slice.call(layer.querySelectorAll("[data-monster-id]")).forEach(function (element) {
      element.remove();
    });
  }

  function getData(id) {
    return AssetResolver.getMonster(id);
  }

  window.MonsterManager = {
    init: init,
    show: show,
    showLayers: showLayers,
    get: getElement,
    getData: getData,
    changeState: changeState,
    clear: clear
  };
})();
