(function () {
  "use strict";

  var layer = null;

  function init(characterLayer) {
    layer = characterLayer;
  }

  function requireInit() {
    if (!layer) throw new Error("CharacterManager.init has not been called.");
  }

  function clear() {
    requireInit();
    layer.innerHTML = "";
  }

  function show(characters) {
    requireInit();
    layer.innerHTML = "";
    (characters || []).forEach(function (source) {
      var character = window.AssetResolver ? AssetResolver.characterSpec(source) : source;
      var img = document.createElement("img");
      img.src = character.src;
      img.alt = character.alt || "";
      img.dataset.id = character.id || "";
      img.className = "story-character " + (character.className || "pos-center-low size-medium");
      layer.appendChild(img);
    });
  }

  function get(id) {
    requireInit();
    return layer.querySelector('[data-id="' + id + '"]');
  }

  function changeImage(id, sourceOrPose) {
    var character = get(id);
    if (!character) throw new Error("Character not found: " + id);

    var src = sourceOrPose;
    if (window.AssetResolver && (typeof sourceOrPose === "number" || (typeof sourceOrPose === "string" && sourceOrPose.indexOf("/") === -1))) {
      src = AssetResolver.character(id, sourceOrPose);
    }
    character.src = src;
    return character;
  }

  function addFloatingText(text, className) {
    requireInit();
    var div = document.createElement("div");
    div.className = className || "zzz";
    div.textContent = text;
    layer.appendChild(div);
    return div;
  }

  window.CharacterManager = {
    init: init,
    clear: clear,
    show: show,
    get: get,
    changeImage: changeImage,
    addFloatingText: addFloatingText
  };
})();
