"""End-to-end local Git fixture: allowed PR passes, frozen PR fails."""
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from check_pr_scope import main


class GitGuardIntegrationTests(unittest.TestCase):
    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.root, text=True).strip()

    def write(self, name, text):
        file = self.root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text, encoding="utf-8")
        self.git("add", name)
        self.git("commit", "-qm", f"fixture: {name}")
        return self.git("rev-parse", "HEAD")

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.git("init", "-q")
        self.git("config", "user.name", "QA Fixture")
        self.git("config", "user.email", "qa@example.invalid")
        self.base = self.write("README.txt", "baseline\n")
        self.old_cwd = os.getcwd()
        os.chdir(self.root)
        self.addCleanup(os.chdir, self.old_cwd)

    def check(self, head, bootstrap=False):
        with contextlib.redirect_stdout(io.StringIO()):
            return main(["--base", self.base, "--head", head] + (["--bootstrap"] if bootstrap else []))

    def test_new_story_is_allowed(self):
        head = self.write("stories/S008/story.json", '{"id":"S008"}\n')
        self.assertEqual(0, self.check(head))

    def test_audio_change_fails_git_gate(self):
        head = self.write("js/AudioManager.js", "modified\n")
        self.assertEqual(1, self.check(head))

    def test_guard_workflow_edit_requires_review(self):
        head = self.write(".github/workflows/qa-guard-free.yml", "different guard\n")
        self.assertEqual(1, self.check(head))
        self.assertEqual(0, self.check(head, bootstrap=True))

    def test_actions_summary_is_generated_for_both_outcomes(self):
        head = self.write("stories/S008/story.json", '{"id":"S008"}\\n')
        output = self.root / "github-summary.md"
        with patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(output)}):
            self.assertEqual(0, self.check(head))
        text = output.read_text(encoding="utf-8")
        self.assertIn("Result: **PASS**", text)
        self.assertIn("Base SHA:", text)
        self.assertIn("Head SHA:", text)
        self.assertIn("independent QA PASS", text)
        head2 = self.write("resources/intro.wav", "binary fixture\\n")
        with patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(output)}):
            self.assertEqual(1, self.check(head2))
        self.assertIn("Result: **FAIL**", output.read_text(encoding="utf-8"))

    def test_json_handoff_is_deterministic_and_not_a_qa_pass(self):
        head = self.write("stories/S008/story.json", '{"id":"S008"}\\n')
        filename = self.root / "qa-handoff.json"
        with contextlib.redirect_stdout(io.StringIO()):
            code = main([
                "--base", self.base, "--head", head,
                "--report-file", str(filename),
            ])
        self.assertEqual(0, code)
        report = json.loads(filename.read_text(encoding="utf-8"))
        self.assertEqual("quest-free-qa-handoff-v1", report["schema"])
        self.assertEqual("PASS", report["status"])
        self.assertEqual("NOT_ASSESSED", report["independent_qa"])
        self.assertEqual("NOT_AUTHORIZED", report["production_merge"])
        self.assertEqual(self.base, report["base_sha"])
        self.assertEqual(head, report["head_sha"])
        self.assertEqual([], report["violations"])
        head2 = self.write("js/AudioManager.js", "unapproved source change\\n")
        with contextlib.redirect_stdout(io.StringIO()):
            code = main(["--base", self.base, "--head", head2, "--report-file", str(filename)])
        self.assertEqual(1, code)
        report = json.loads(filename.read_text(encoding="utf-8"))
        self.assertEqual("FAIL", report["status"])
        self.assertEqual(head2, report["head_sha"])
        self.assertEqual("js/AudioManager.js", report["violations"][0]["path"])
        self.assertIn("repair", report["next_action"])
        
    def test_pre_s005_images_fail(self):
        head = self.write("images/004/Scene-01.png", "placeholder\n")
        self.assertEqual(1, self.check(head))


if __name__ == "__main__":
    unittest.main()
