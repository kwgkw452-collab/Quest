"""Isolated real Git tests. Candidate JS is syntax-checked, never executed."""
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from package_check import validate, PACKAGE_SCHEMA, SPEC_SCHEMA

PREFIX = "tests/cooperation/fictional/"
NODE = shutil.which("node") or "/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="quest-fictional-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git("init", "-q")
        self.git("config", "user.name", "Fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.package_path = PREFIX + "package.json"
        self.package = {"schema": PACKAGE_SCHEMA, "fictional": True, "story_id": "FICTIONAL-TEST",
                        "scenes": [{"number": 1, "script": PREFIX + "scene.js", "graphic": PREFIX + "box.svg",
                                    "references": [PREFIX + "helper.js"],
                                    "communication": {"goal": "Find fictional box", "accept": ["fictional box"]}}]}
        self.spec = {"schema": SPEC_SCHEMA, "fictional": True, "story_id": "FICTIONAL-TEST",
                     "scenes": copy.deepcopy(self.package["scenes"])}
        self.put(self.package_path, json.dumps(self.package))
        self.put(PREFIX + "scene.js", "export const scene = 1;\n")
        self.put(PREFIX + "helper.js", "export const helper = true;\n")
        self.put(PREFIX + "box.svg", '<svg xmlns="http://www.w3.org/2000/svg" width="1560" height="720"/>')
        self.commit()

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.root), *args], check=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.decode().strip()

    def put(self, path, text):
        p = self.root / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def commit(self):
        self.git("add", ".")
        self.git("commit", "-qm", "synthetic fixture")
        self.head = self.git("rev-parse", "HEAD")
        return self.head

    def check(self, **kwargs):
        return validate(self.root, self.head, self.package_path, self.spec, node_path=NODE, **kwargs)

    def codes(self):
        return {x["code"] for x in self.check()["failures"]}

    def test_unknown_checker_failure_holds_even_with_known_data_failure(self):
        del self.package["scenes"][0]["communication"]
        self.put(self.package_path, json.dumps(self.package))
        self.commit()
        result = validate(self.root, self.head, self.package_path, self.spec, node_path="/nonexistent/quest-node")
        self.assertEqual(result["status"], "HOLD")
        self.assertTrue(result["holds"])
        self.assertTrue(result["failures"])

    def test_normal_fixture_passes_exact_commit(self):
        r = self.check()
        self.assertEqual(r["status"], "PASS")
        self.assertEqual(r["head_sha"], self.head)
        self.assertEqual(r["production_merge"], "NOT_AUTHORIZED")
        self.assertEqual(r["independent_qa"], "NOT_ASSESSED")

    def test_javascript_syntax_error(self):
        self.put(PREFIX + "scene.js", "export const scene = ;\n")
        self.commit()
        self.assertIn("JS_SYNTAX", self.codes())

    def test_json_format_error(self):
        self.put(self.package_path, '{"scenes":')
        self.commit()
        self.assertIn("PACKAGE_JSON", self.codes())

    def test_missing_file_reference(self):
        self.package["scenes"][0]["references"] = [PREFIX + "missing.js"]
        self.put(self.package_path, json.dumps(self.package))
        self.commit()
        self.assertIn("FILE_REFERENCE", self.codes())

    def test_scene_number_inconsistent(self):
        self.package["scenes"][0]["number"] = 2
        self.put(self.package_path, json.dumps(self.package))
        self.commit()
        self.assertIn("SCENE_NUMBER", self.codes())

    def test_communication_missing(self):
        del self.package["scenes"][0]["communication"]
        self.put(self.package_path, json.dumps(self.package))
        self.commit()
        self.assertIn("COMMUNICATION_MISSING", self.codes())

    def test_accept_condition_mismatch(self):
        self.package["scenes"][0]["communication"]["accept"] = ["another box"]
        self.put(self.package_path, json.dumps(self.package))
        self.commit()
        self.assertIn("SPEC_MISMATCH", self.codes())

    def test_graphic_reference_miss(self):
        self.package["scenes"][0]["graphic"] = PREFIX + "wrong.svg"
        self.put(self.package_path, json.dumps(self.package))
        self.commit()
        self.assertIn("GRAPHIC_REFERENCE", self.codes())

    def test_multiple_files_fail_without_changing_expectations(self):
        self.put(PREFIX + "scene.js", "export const scene = ;")
        self.put(PREFIX + "helper.js", "export const helper = ;")
        self.commit()
        paths = {x["path"] for x in self.check()["failures"] if x["code"] == "JS_SYNTAX"}
        self.assertEqual(paths, {PREFIX + "scene.js", PREFIX + "helper.js"})

    def test_partial_repair_still_fails_then_full_repair_passes(self):
        self.put(PREFIX + "scene.js", "export const scene = ;")
        self.put(PREFIX + "helper.js", "export const helper = ;")
        self.commit()
        self.assertEqual(self.check()["status"], "FAIL")
        self.put(PREFIX + "scene.js", "export const scene = 1;")
        self.commit()
        self.assertEqual(self.check()["status"], "FAIL")
        self.put(PREFIX + "helper.js", "export const helper = true;")
        self.commit()
        self.assertEqual(self.check()["status"], "PASS")

    def test_dirty_worktree_does_not_change_target_tree(self):
        self.put(PREFIX + "scene.js", "export const scene = ;")
        self.assertEqual(self.check()["status"], "PASS")

    def test_missing_fixed_spec_holds(self):
        self.assertEqual(validate(self.root, self.head, self.package_path, None, NODE)["status"], "HOLD")

    def test_candidate_spec_cannot_override_fixed_expectations(self):
        forged = copy.deepcopy(self.spec)
        forged["scenes"][0]["communication"]["accept"] = ["forged"]
        self.put(PREFIX + "approved.json", json.dumps(forged))
        self.package["scenes"][0]["communication"]["accept"] = ["forged"]
        self.package["specification"] = PREFIX + "approved.json"
        self.put(self.package_path, json.dumps(self.package))
        self.commit()
        self.assertIn("SPEC_MISMATCH", self.codes())

    def test_outside_namespace_reference_not_read(self):
        self.package["scenes"][0]["script"] = "engine/stories/S001.js"
        self.put(self.package_path, json.dumps(self.package))
        self.commit()
        r = self.check()
        self.assertIn("FILE_REFERENCE", {x["code"] for x in r["failures"]})
        self.assertNotIn("engine/stories/S001.js", r["checked_paths"])

    def test_symlink_to_anything_is_rejected(self):
        p = self.root / (PREFIX + "scene.js")
        p.unlink()
        p.symlink_to("helper.js")
        self.commit()
        self.assertIn("FILE_REFERENCE", self.codes())

    def test_missing_node_holds(self):
        r = validate(self.root, self.head, self.package_path, self.spec, node_path="/nonexistent/node")
        self.assertEqual(r["status"], "HOLD")
        self.assertTrue(r["holds"])

    def test_code_is_not_executed(self):
        marker = self.root / "should-not-exist"
        self.put(PREFIX + "scene.js", 'import fs from "node:fs"; fs.writeFileSync(' + json.dumps(str(marker)) + ', "unsafe");')
        self.commit()
        self.assertEqual(self.check()["status"], "PASS")
        self.assertFalse(marker.exists())

    def test_invalid_commit_holds(self):
        self.assertEqual(validate(self.root, "main", self.package_path, self.spec, NODE)["status"], "HOLD")

    def test_invalid_graphic_fails(self):
        self.put(PREFIX + "box.svg", "not SVG")
        self.commit()
        self.assertIn("GRAPHIC_FORMAT", self.codes())

    def test_non_json_numeric_constant_fails(self):
        self.put(self.package_path, '{"fictional": NaN}')
        self.commit()
        self.assertIn("PACKAGE_JSON", self.codes())

    def test_malformed_fixed_hashes_holds(self):
        self.spec["file_sha256"] = ["not a mapping"]
        self.assertEqual(self.check()["status"], "HOLD")

    def test_file_hash_mismatch(self):
        self.spec["file_sha256"] = {PREFIX + "scene.js": "0" * 64}
        self.assertIn("SPEC_MISMATCH", self.codes())


if __name__ == "__main__":
    unittest.main()
