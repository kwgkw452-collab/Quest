"""Immutable fictional-package expectations for actual PR commit CI checks."""
import hashlib
from pathlib import Path
import shutil
import subprocess
import unittest
from package_check import validate

PREFIX = "tests/cooperation/fictional/"
# Fictional test criteria; never infer formal Story rules from these.
SPEC = {"schema":"quest-fictional-approved-v1", "fictional":True,
        "story_id":"FICTIONAL-V3-NOT-A-PRODUCTION-STORY", "scenes":[
    {"number":1,"script":PREFIX+"scene1.js","graphic":PREFIX+"assets/box.svg",
     "references":[PREFIX+"helpers.js"],"communication":{"goal":"Find the fictional box.","accept":["the fictional box"]}},
    {"number":2,"script":PREFIX+"scene2.js","graphic":PREFIX+"assets/box.svg",
     "communication":{"goal":"Return the fictional box.","accept":["your fictional box"]}}]}


class CommittedFixtureTests(unittest.TestCase):
    def test_current_commit_package_against_fixed_fictional_criteria(self):
        root = Path(__file__).resolve().parents[2]
        sha = subprocess.check_output(["git","-C",str(root),"rev-parse","HEAD"],text=True).strip()
        node = shutil.which("node") or "/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
        report = validate(root, sha, PREFIX+"package.json", SPEC, node)
        self.assertEqual(report["status"], "PASS", report)
