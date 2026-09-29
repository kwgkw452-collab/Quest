(function () {
  "use strict";
  var concepts = {
    "item.apple": concept("item.apple", "apple", "apples", "リンゴ"),
    "item.orange": concept("item.orange", "orange", "oranges", "オレンジ"),
    "item.banana": concept("item.banana", "banana", "bananas", "バナナ")
  };
  function concept(conceptId, singular, plural, displayJapanese) {
    return { conceptId: conceptId, slotId: "item",
      forms: [{ text: singular, number: "singular" }, { text: plural, number: "plural" }], displayJapanese: displayJapanese };
  }
  function copy(value) {
    if (!value) return null;
    return { conceptId: value.conceptId, slotId: value.slotId,
      forms: value.forms.map(function (form) { return Object.assign({}, form); }), displayJapanese: value.displayJapanese };
  }
  window.CommunicationConceptCatalog = {
    get: function (conceptId) { return copy(concepts[conceptId]); },
    all: function () { return Object.keys(concepts).map(function (id) { return copy(concepts[id]); }); }
  };
})();
