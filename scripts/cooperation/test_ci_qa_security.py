"""Limited local security regressions, not independent QA certification."""
import hashlib
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from qa_gate import NAMESPACE, canonical, verify_and_route
from run_from_ci import advance, WORKFLOW


class CIQAHeadFreshnessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.top = Path(self.temp.name)
        self.repo = self.top / "candidate"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("config", "user.email", "local-fixture@example.invalid")
        self.git("config", "user.name", "Local security fixture")
        self.file = self.repo / "fixture.txt"
        self.file.write_text("baseline")
        self.git("add", ".")
        self.git("commit", "-qm", "synthetic baseline")
        self.git("branch", "-M", "automation/qa-security")
        self.initial = self.git("rev-parse", "HEAD").strip()
        self.base = self.initial
        self.machine = {"schema": "quest-cooperation-machine-v1", "base_sha": self.base,
                        "head_sha": self.initial, "status": "PASS", "violations": [],
                        "independent_qa": "NOT_ASSESSED", "production_merge": "NOT_AUTHORIZED"}
        self.key = self.top / "disposable-qa-key"
        subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(self.key)], check=True, capture_output=True)
        self.signers = self.top / "allowed-signers"
        self.signers.write_text("local-independent-fixture " + self.key.with_suffix(".pub").read_text())
        self.digest = hashlib.sha256(self.signers.read_bytes()).hexdigest()
        payload = {"schema": "quest-independent-qa-verdict-v1", "base_sha": self.base,
                   "head_sha": self.initial, "reviewer": "local-independent-fixture", "verdict": "PASS"}
        verdict = self.top / "verdict"
        verdict.write_bytes(canonical(payload))
        subprocess.run(["ssh-keygen", "-Y", "sign", "-f", str(self.key), "-n", NAMESPACE, str(verdict)], check=True, capture_output=True)
        self.qa = {"payload": payload, "signature": Path(str(verdict) + ".sig").read_text()}

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.repo), *args], check=True, capture_output=True, text=True).stdout

    def newer(self):
        self.file.write_text("newer candidate")
        self.git("add", ".")
        self.git("commit", "-qm", "synthetic newer candidate")
        return self.git("rev-parse", "HEAD").strip()

    def gate(self):
        return verify_and_route(self.machine, self.qa, self.signers, self.digest, self.repo,
                                producer="fixture-creator", repair_actor="fixture-repair",
                                fetch_tip=lambda branch: self.git("rev-parse", "HEAD").strip())

    def test_remote_branch_advance_blocks_matching_local_qa_pass(self):
        result = verify_and_route(self.machine, self.qa, self.signers, self.digest, self.repo,
                                  producer="fixture-creator", repair_actor="fixture-repair",
                                  fetch_tip=lambda branch: "f" * 40)
        self.assertEqual(result["gate"], "HOLD")
        self.assertEqual(result["reason"], "REMOTE_HEAD_CHANGED")
        self.assertFalse(result["merge_authorized"])

    def test_remote_branch_advance_does_not_start_ci_repair(self):
        policy = {"branch": "automation/qa-security", "base_sha": self.base}
        calls = []
        with patch("run_from_ci.load_policy", return_value=policy):
            result = advance(self.repo, "unused-external-policy", "digest", "external-state",
                             fetch=lambda sha: calls.append("fetch"),
                             execute=lambda *args, **kwargs: calls.append("execute"),
                             fetch_tip=lambda branch: "f" * 40)
        self.assertEqual(result["gate"], "HOLD")
        self.assertEqual(result["reason"], "REMOTE_HEAD_CHANGED")
        self.assertEqual(calls, [])

    def test_matching_signed_old_reports_do_not_override_current_head(self):
        self.newer()
        result = self.gate()
        self.assertEqual(result["gate"], "HOLD")
        self.assertFalse(result["merge_authorized"])

    def test_candidate_advance_during_signature_verification_invalidates_handoff(self):
        actual = subprocess.run
        advanced = False

        def race(command, *args, **kwargs):
            nonlocal advanced
            result = actual(command, *args, **kwargs)
            if command[:3] == ["ssh-keygen", "-Y", "verify"] and not advanced:
                advanced = True
                self.newer()
            return result

        with patch("qa_gate.subprocess.run", side_effect=race):
            result = self.gate()
        self.assertTrue(advanced)
        self.assertEqual(result["gate"], "HOLD")

    def test_branch_switch_during_signature_verification_invalidates_handoff(self):
        self.git("branch", "automation/other", self.initial)
        actual = subprocess.run
        switched = False

        def race(command, *args, **kwargs):
            nonlocal switched
            result = actual(command, *args, **kwargs)
            if command[:3] == ["ssh-keygen", "-Y", "verify"] and not switched:
                switched = True
                self.git("symbolic-ref", "HEAD", "refs/heads/automation/other")
            return result

        with patch("qa_gate.subprocess.run", side_effect=race):
            result = self.gate()
        self.assertTrue(switched)
        self.assertEqual(result["gate"], "HOLD")

    def test_branch_switch_during_ci_fetch_cannot_forward_old_pass(self):
        self.git("branch", "automation/other", self.initial)
        ci = {"id": 1, "head_sha": self.initial, "head_branch": "automation/qa-security",
              "path": WORKFLOW, "event": "pull_request", "status": "completed", "conclusion": "success",
              "run_number": 1, "run_attempt": 1}

        def fetch(sha):
            self.git("symbolic-ref", "HEAD", "refs/heads/automation/other")
            return [ci]

        def execute(*args, **kwargs):
            return {"gate": "INDEPENDENT_QA_PENDING", "merge_authorized": False,
                    "head_sha": self.initial, "events": []}

        policy = {"branch": "automation/qa-security", "base_sha": self.base}
        with patch("run_from_ci.load_policy", return_value=policy):
            result = advance(self.repo, "unused-external-policy", "digest", "external-state",
                             fetch=fetch, execute=execute,
                             fetch_tip=lambda branch: self.git("rev-parse", "HEAD").strip())
        self.assertEqual(result["gate"], "HOLD")

    def test_ci_success_old_report_is_held_if_live_head_changes_during_execution(self):
        ci = {"id": 1, "head_sha": self.initial, "head_branch": "automation/qa-security",
              "path": WORKFLOW, "event": "pull_request", "status": "completed", "conclusion": "success",
              "run_number": 1, "run_attempt": 1}

        def execute(*args, **kwargs):
            self.newer()
            return {"gate": "INDEPENDENT_QA_PENDING", "merge_authorized": False,
                    "head_sha": self.initial, "events": []}

        policy = {"branch": "automation/qa-security", "base_sha": self.base}
        with patch("run_from_ci.load_policy", return_value=policy):
            result = advance(self.repo, "unused-external-policy", "digest", "external-state",
                             fetch=lambda sha: [ci], execute=execute,
                             fetch_tip=lambda branch: self.git("rev-parse", "HEAD").strip())
        self.assertEqual(result["gate"], "HOLD")


if __name__ == "__main__":
    unittest.main()
