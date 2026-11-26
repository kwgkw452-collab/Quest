"""Synthetic safety regressions; does not certify independent QA."""
import json
import multiprocessing
from pathlib import Path
import tempfile
import unittest

from controller import Controller, Hold, route, safe_path, sign_qa

A, B, C, D, E = (x * 40 for x in "abcde")
PATH = "tests/cooperation/fictional/story.json"


def competing_lock(state, root, result):
    controller = Controller(state, root, "different-task", "automation/fixture", A, B)
    try:
        with controller.locked():
            result.put("ACQUIRED")
    except Hold as exc:
        result.put(str(exc))


class ControllerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "repo"
        self.root.mkdir()
        self.state = Path(self.temp.name) / "state"
        self.c = self.make()

    def make(self, task="task", **kwargs):
        return Controller(self.state, self.root, task, "automation/fixture", A, B, **kwargs)

    def attempt(self, c=None, head=B, ids=None, paths=None, branch="automation/fixture"):
        c = c or self.c
        return c.authorize_attempt(branch, head, ids or ["json:story"], paths or [PATH])

    def test_persistent_maximum_three_attempts(self):
        with self.c.locked():
            head = B
            for i, new in enumerate([C, D, E]):
                self.assertEqual(self.attempt(head=head, ids=[str(i)])["attempt"], i + 1)
                self.c.record_repair(head, new)
                head = new
        restarted = self.make()
        with restarted.locked():
            r = self.attempt(restarted, E, ["fourth"])
            self.assertEqual(r["gate"], "HOLD")
            self.assertEqual(r["reason"], "MAX_REPAIRS_REACHED")

    def test_same_failure_prevents_repeat_repair(self):
        with self.c.locked():
            self.attempt()
            self.c.record_repair(B, C)
            self.assertEqual(self.attempt(head=C)["reason"], "REPEATED_FAILURE")

    def test_unknown_failure_holds(self):
        with self.c.locked():
            self.assertEqual(self.c.authorize_attempt("automation/fixture", B, [], [PATH])["reason"], "UNKNOWN_FAILURE")

    def test_branch_change_holds(self):
        with self.c.locked():
            self.assertEqual(self.attempt(branch="automation/other")["reason"], "BRANCH_CHANGED")

    def test_head_change_holds(self):
        with self.c.locked():
            self.assertEqual(self.attempt(head=C)["reason"], "HEAD_CHANGED")

    def test_scope_cannot_expand(self):
        with self.c.locked():
            self.attempt()
            self.c.record_repair(B, C)
            self.assertEqual(self.attempt(head=C, ids=["other"], paths=[PATH, "new.js"])["reason"], "REPAIR_SCOPE_CHANGED")

    def test_exclusive_cross_process_lock(self):
        context = multiprocessing.get_context("spawn")
        result = context.Queue()
        with self.c.locked():
            process = context.Process(target=competing_lock, args=(self.state, self.root, result))
            process.start()
            process.join(10)
            self.assertEqual(process.exitcode, 0)
            self.assertEqual(result.get(timeout=2), "CONCURRENT_REPAIR")

    def test_task_hold_does_not_stop_other_task(self):
        with self.c.locked():
            self.assertEqual(self.attempt(head=C)["gate"], "HOLD")
        independent = self.make("unrelated")
        with independent.locked():
            self.assertEqual(self.attempt(independent)["gate"], "REPAIR_RUNNING")

    def test_aborted_attempt_does_not_restart_silently(self):
        with self.c.locked():
            self.attempt()
        resumed = self.make()
        with resumed.locked():
            self.assertEqual(self.attempt(resumed, ids=["different"])["reason"], "UNFINISHED_ATTEMPT")

    def test_controller_requires_lock(self):
        self.assertEqual(self.attempt()["reason"], "LOCK_REQUIRED")

    def test_bad_state_safe_hold(self):
        self.c.file.write_text("{")
        with self.c.locked():
            self.assertEqual(self.attempt()["gate"], "HOLD")

    def test_malformed_attempt_state_safe_hold(self):
        with self.c.locked():
            self.attempt()
        state = json.loads(self.c.file.read_text())
        state["attempts"] = [False]
        self.c.file.write_text(json.dumps(state))
        with self.c.locked():
            self.assertEqual(self.attempt()["gate"], "HOLD")

    def test_state_must_be_external(self):
        with self.assertRaisesRegex(Hold, "CANDIDATE_LOCAL"):
            Controller(self.root / "state", self.root, "task", "automation/fixture", A, B)

    def test_cost_modes_other_than_subscription_rejected(self):
        for mode in ["paid_api", "OPENAI_API_KEY", "unknown", "github_paid_runner"]:
            with self.subTest(mode=mode), self.assertRaisesRegex(Hold, "COST_OR_ATTEMPT"):
                self.make(cost_mode=mode)

    def test_repair_maximum_not_configurable_by_candidate(self):
        with self.assertRaisesRegex(Hold, "COST_OR_ATTEMPT"):
            self.make(max_attempts=4)

    def test_production_branch_rejected(self):
        with self.assertRaisesRegex(Hold, "PRODUCTION"):
            Controller(self.state, self.root, "task", "s005-fixed-195-stage-clean-test", A, B)

    def test_forbidden_paths_rejected(self):
        for path in ["engine/stories/S001.js", "images/001/x.png", "js/speech.js", "audio/x.dat", "voice/x.js", "scripts/cooperation/controller.py", "docs/approved/spec.json", ".github/workflows/change.yml", "tests/expected.py", ".git", ".GIT/config", "Scripts/cooperation/controller.py", "../allowed.js", "a/../b.js", "/tmp/x"]:
            with self.subTest(path=path), self.assertRaises(Hold):
                safe_path(path)

    def test_synthetic_fixture_allowed(self):
        self.assertEqual(safe_path(PATH), PATH)

    def test_repair_transition_not_same_sha(self):
        with self.c.locked():
            self.attempt()
            with self.assertRaisesRegex(Hold, "INVALID_REPAIR"):
                self.c.record_repair(B, B)


class QARoutingTests(unittest.TestCase):
    def setUp(self):
        self.key = b"test-only-independent-key-do-not-deploy" * 2
        self.machine = {"schema": "quest-cooperation-machine-v1", "base_sha": A, "head_sha": B,
                        "production_merge": "NOT_AUTHORIZED", "independent_qa": "NOT_ASSESSED",
                        "status": "PASS", "violations": []}
        self.qa = {"schema": "quest-independent-qa-verdict-v1", "base_sha": A, "head_sha": B,
                   "reviewer": "separate-qa", "verdict": "PASS"}

    def route(self, qa=None, **kwargs):
        return route(self.machine, qa, qa_key=self.key, approved_reviewers=["separate-qa"], **kwargs)

    def signed(self, **kwargs):
        return sign_qa({**self.qa, **kwargs}, self.key)

    def test_machine_pass_waits_for_independent_qa(self):
        self.assertEqual(self.route()["gate"], "INDEPENDENT_QA_PENDING")

    def test_authenticated_qa_pass_waits_for_director(self):
        result = self.route(self.signed())
        self.assertEqual(result["gate"], "DIRECTOR_REVIEW_PENDING")
        self.assertFalse(result["merge_authorized"])

    def test_old_sha_qa_pass_is_invalid(self):
        result = self.route(self.signed(head_sha=C))
        self.assertEqual(result["gate"], "HOLD")
        self.assertEqual(result["reason"], "QA_SHA_STALE")

    def test_self_approval_blocked_even_with_valid_signature(self):
        result = self.route(self.signed(), repair_actor="separate-qa")
        self.assertEqual(result["reason"], "QA_SELF_APPROVAL_OR_UNKNOWN_REVIEWER")

    def test_candidate_cannot_forge_qa_verdict(self):
        signed = self.signed()
        signed["payload"]["verdict"] = "FAIL"
        self.assertEqual(self.route(signed)["reason"], "INVALID_QA_SIGNATURE")

    def test_unsigned_report_not_accepted(self):
        self.assertEqual(self.route(self.qa)["reason"], "UNAUTHENTICATED_QA")

    def test_unknown_reviewer_blocked(self):
        self.assertEqual(self.route(self.signed(reviewer="forged"))["reason"], "QA_SELF_APPROVAL_OR_UNKNOWN_REVIEWER")

    def test_no_external_qa_key_cannot_claim_trust(self):
        self.assertEqual(route(self.machine, self.signed())["reason"], "QA_TRUST_NOT_ESTABLISHED")

    def test_qa_fail_returns_to_repair(self):
        self.assertEqual(self.route(self.signed(verdict="FAIL"))["gate"], "QA_REPAIR_REQUIRED")

    def test_qa_hold_stays_hold(self):
        self.assertEqual(self.route(self.signed(verdict="HOLD"))["gate"], "HOLD")

    def test_unknown_machine_report_holds(self):
        self.assertEqual(route({})["gate"], "HOLD")

    def test_machine_cannot_grant_merge_or_qa(self):
        for key, value in [("production_merge", "AUTHORIZED"), ("independent_qa", "PASS")]:
            self.assertEqual(route({**self.machine, key: value})["reason"], "FORGED_MACHINE_AUTHORITY")

    def test_failed_machine_requires_evidence(self):
        self.assertEqual(route({**self.machine, "status": "FAIL"})["gate"], "HOLD")
        self.assertEqual(route({**self.machine, "status": "FAIL", "violations": [{"code": "JSON"}]})["gate"], "DEVELOPER_REPAIR")

    def test_unknown_status_holds(self):
        self.assertEqual(route({**self.machine, "status": "MAYBE"})["gate"], "HOLD")


if __name__ == "__main__":
    unittest.main()
