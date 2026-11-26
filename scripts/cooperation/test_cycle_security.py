"""Independent local review regressions using real isolated Git commits.

These checks are not independent QA Lab final certification.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import run_cycle
from controller import Hold
from repair_worker import validate_proposal


class CycleSecurityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "candidate"
        self.root.mkdir()
        self.file = "tests/cooperation/fictional/scene.js"
        self.expected = "old fixture content\n"
        self.target = self.root / self.file
        self.target.parent.mkdir(parents=True)
        self.target.write_text(self.expected)
        self.git("init", "-q")
        self.git("config", "user.email", "fixture@example.invalid")
        self.git("config", "user.name", "Review fixture")
        self.git("add", ".")
        self.git("commit", "-qm", "synthetic baseline")
        self.git("branch", "-M", "automation/security")
        self.before = self.git("rev-parse", "HEAD").strip()
        self.proposal = {"summary": "synthetic change", "replacements": [{"path": self.file, "content": "new fixture content\n"}]}

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.root), *args], check=True, capture_output=True, text=True).stdout

    def apply(self, proposal=None, allowed=None):
        return run_cycle.commit_proposal(self.root, "automation/security", self.before,
                                        proposal or self.proposal, allowed or [self.file])

    def test_proposal_cannot_change_candidate_spec_or_tests(self):
        for name in ["docs/approved/spec.json", "scripts/cooperation/test_controller.py"]:
            bad = {"summary": "untrusted", "replacements": [{"path": name, "content": "tampered"}]}
            with self.subTest(path=name), self.assertRaises(ValueError):
                self.apply(bad)
            self.assertEqual(self.git("rev-parse", "HEAD").strip(), self.before)
            self.assertEqual(self.target.read_text(), self.expected)

    def test_allowlist_cannot_override_hard_protection(self):
        name = "scripts/cooperation/test_controller.py"
        bad = {"summary": "untrusted", "replacements": [{"path": name, "content": "tampered"}]}
        with self.assertRaises(Hold):
            self.apply(bad, [name])
        self.assertEqual(self.git("rev-parse", "HEAD").strip(), self.before)

    def test_stale_head_stops_before_writes(self):
        extra = self.root / "extra.txt"
        extra.write_text("unrelated")
        self.git("add", ".")
        self.git("commit", "-qm", "parallel change")
        with self.assertRaisesRegex(Hold, "BRANCH_OR_HEAD_CHANGED"):
            self.apply()
        self.assertEqual(self.target.read_text(), self.expected)

    def test_dirty_worktree_stops_before_writes(self):
        self.target.write_text("uncommitted edit")
        with self.assertRaisesRegex(Hold, "DIRTY_WORKTREE"):
            self.apply()
        self.assertEqual(self.target.read_text(), "uncommitted edit")

    def test_regular_file_cannot_be_replaced_through_symlink(self):
        self.target.unlink()
        self.target.symlink_to("elsewhere")
        self.git("add", ".")
        self.git("commit", "-qm", "synthetic symlink")
        self.before = self.git("rev-parse", "HEAD").strip()
        with self.assertRaisesRegex(Hold, "REGULAR_FILE"):
            self.apply()
        self.assertTrue(self.target.is_symlink())

    def test_policy_digest_is_checked_before_use(self):
        policy = Path(self.temp.name) / "policy.json"
        original = b'{"schema":"quest-cooperation-policy-v1","fictional":true}'
        policy.write_bytes(original)
        digest = hashlib.sha256(original).hexdigest()
        policy.write_text('{"schema":"candidate-expanded-allowlist"}')
        with self.assertRaisesRegex(Hold, "POLICY_DIGEST_CHANGED"):
            run_cycle.load_policy(policy, digest, self.root)

    def test_candidate_local_policy_is_not_trusted(self):
        policy = self.root / "policy.json"
        policy.write_text("{}")
        digest = hashlib.sha256(policy.read_bytes()).hexdigest()
        with self.assertRaisesRegex(Hold, "CANDIDATE_LOCAL_POLICY"):
            run_cycle.load_policy(policy, digest, self.root)

    def test_branch_switch_after_ref_update_never_restores_into_other_branch(self):
        self.git("branch", "automation/other", self.before)
        original = run_cycle.git
        switched = False

        def race(repo, *args, **kwargs):
            nonlocal switched
            result = original(repo, *args, **kwargs)
            if args and args[0] == "update-ref" and not switched:
                # Simulate an external branch switch between CAS and refresh.
                self.git("symbolic-ref", "HEAD", "refs/heads/automation/other")
                switched = True
            return result

        with patch.object(run_cycle, "git", side_effect=race), self.assertRaises(Hold):
            self.apply()
        self.assertTrue(switched)
        self.assertEqual(self.git("symbolic-ref", "--short", "HEAD").strip(), "automation/other")
        self.assertEqual(self.target.read_text(), self.expected)
        self.assertEqual(self.git("diff", "--cached", "--name-only"), "")


if __name__ == "__main__":
    unittest.main()
