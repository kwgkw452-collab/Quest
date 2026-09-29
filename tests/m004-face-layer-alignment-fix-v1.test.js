"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function pngSize(file) {
  const data = fs.readFileSync(path.join(root, file));
  assert.strictEqual(data.toString("ascii", 1, 4), "PNG");
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

const layers = ["base", "eyes", "nose", "mouth", "ears", "hair", "smile"];
for (const layer of layers) {
  assert.deepStrictEqual(pngSize(`images/monsters/m004/m004_${layer}.png`), [1254, 1254], layer);
}

const css = read("css/style.css");
assert(/\.monster-layer-stack img\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*contain;/s.test(css));
assert(/data-face-layer="eyes"\]\[data-face-side="left"\][^{]*\{[^}]*translate\(3%, -15%\)/s.test(css));
assert(/data-face-layer="eyes"\]\[data-face-side="right"\][^{]*\{[^}]*translate\(-3%, -15%\)/s.test(css));
assert(/data-face-layer="ears"\]\[data-face-side="left"\][^{]*\{[^}]*translateX\(-4%\) scale\(0\.93\)/s.test(css));
assert(/data-face-layer="ears"\]\[data-face-side="right"\][^{]*\{[^}]*translateX\(4%\) scale\(0\.93\)/s.test(css));
assert(/\.monster-face-parts img\[data-face-layer="mouth"\]\s*\{[^}]*transform:\s*translateY\(14%\) scale\(0\.62\);/s.test(css));
assert(/\.monster-face-parts img\[data-face-layer="smile"\]\s*\{[^}]*transform:\s*translate\(-1%, 14%\) scale\(0\.50\);/s.test(css));

const data = read("data/m004.js");
assert(data.includes('splitLayers: ["eyes", "ears"]'));
const manager = read("engine/managers/monster-manager.js");
assert(manager.includes('var sides = splitLayers.indexOf(part) === -1 ? [null] : ["left", "right"]'));

const presenter = read("engine/managers/monster-battle-presenter.js");
assert(presenter.includes('["eyes", "nose", "mouth", "ears"]'));
assert(presenter.includes('complete && part === "mouth" ? "smile" : part'));
assert(!presenter.includes("data-face-layer"), "alignment must remain CSS-only");

console.log("m004 Face Layer Alignment Fix V1: PASS");
