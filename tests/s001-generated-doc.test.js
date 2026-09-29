"use strict";

const childProcess = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
childProcess.execFileSync(process.execPath, ["tools/generate-s001-md.js", "--check"], {
  cwd: root,
  stdio: "inherit"
});
