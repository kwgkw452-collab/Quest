"""End-to-end local Git fixture: allowed PR passes, frozen PR fails."""
import contextlib
import io
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

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

    def test_pre_s005_images_fail(self):
        head = self.write("images/004/Scene-01.png", "placeholder\n")
        self.assertEqual(1, self.check(head))


if __name__ == "__main__":
    unittest.main()
