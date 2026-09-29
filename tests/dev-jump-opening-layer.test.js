const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const devHtml = read("dev.html");
const indexHtml = read("index.html");
const devUi = read("dev/dev-jump-ui.js");
const css = read("css/style.css");

assert(devHtml.includes('<section id="opening-layer" class="opening-layer hidden"></section>'),
  "Dev opening layer must be hidden before a Jump starts");
assert(css.includes(".opening-layer.hidden") && /\.opening-layer\.hidden\s*\{\s*display:\s*none;/.test(css),
  "The existing hidden class must keep the opening layer from covering Story visuals");

assert(devUi.includes('panel.id = "dev-jump-panel"'));
assert(devUi.includes('document.getElementById("scene").appendChild(panel)'));
assert(devUi.includes("panel.hidden = true"), "Jump selection must dismiss the Dev panel");
assert(devUi.includes("DevJumpManager.start(checkpoint.id, traceOperationId)"),
  "Jump selection must start its checkpoint with the operation-local trace id");

assert(devUi.includes('window.location.replace("index.html")'),
  "Normal Start must retain the production index.html route");
assert(indexHtml.includes('<section id="opening-layer" class="opening-layer"></section>'),
  "Production Opening must retain its original visible initial state");
assert(!indexHtml.includes("dev/dev-"), "Production index must not load Dev scripts");

assert(devHtml.includes('<script src="dev/dev-jump-ui.js"></script>'));
assert(!devHtml.includes('<script src="js/main.js"></script>'));

console.log("dev-jump-opening-layer.test.js: PASS");
