(function () {
  "use strict";

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~。、「」！？・…（）［］【】〈〉《》]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function includesAny(text, accepted) {
    var source = normalize(text);
    return (accepted || []).some(function (candidate) {
      var target = normalize(candidate);
      return target !== "" && source.indexOf(target) !== -1;
    });
  }

  window.SpeechNormalizer = {
    normalize: normalize,
    includesAny: includesAny
  };
})();
