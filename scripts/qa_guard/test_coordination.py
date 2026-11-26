"""Exact-SHA workflow routing and independent-QA authority tests."""
import copy
import unittest

from coordination import route


BASE = "a" * 40
HEAD = "b" * 40


def machine(status="PASS"):
    return {
        "schema": "quest-free-qa-handoff-v1",
        "scope": "filename-diff-only",
        "base_sha": BASE,
        "head_sha": HEAD,
        "status": status,
        "independent_qa": "NOT_ASSESSED",
        "production_merge": "NOT_AUTHORIZED",
        "violations": [{"path": "js/AudioManager.js", "reasons": ["Audio/Voice freeze"]}] if status == "FAIL" else [],
    }


def qa(verdict="PASS", head=HEAD):
    return {"schema": "quest-independent-qa-verdict-v1", "base_sha": BASE,
            "head_sha": head, "verdict": verdict}


class CoordinationTests(unittest.TestCase):
    def test_failed_machine_returns_to_developer(self):
        self.assertEqual("DEVELOPER_REPAIR", route(machine("FAIL"))["gate"])

    def test_machine_pass_never_equals_independent_pass(self):
        r = route(machine())
        self.assertEqual("INDEPENDENT_QA_PENDING", r["gate"])
        self.assertFalse(r["merge_authorized"])

    def test_independent_qa_pass_still_requires_director(self):
        r = route(machine(), qa())
        self.assertEqual("DIRECTOR_REVIEW_PENDING", r["gate"])
        self.assertFalse(r["merge_authorized"])

    def test_stale_independent_verdict_cannot_authorize(self):
        r = route(machine(), qa(head="c" * 40))
        self.assertEqual("QA_SHA_STALE", r["gate"])

    def test_independent_fail_returns_repair(self):
        self.assertEqual("QA_REPAIR_REQUIRED", route(machine(), qa("FAIL"))["gate"])

    def test_hold_and_unknown_always_require_qa(self):
        for verdict in ("HOLD", "UNKNOWN", "NOT_TESTED"):
            with self.subTest(verdict=verdict):
                self.assertEqual("INDEPENDENT_QA_PENDING", route(machine(), qa(verdict))["gate"])

    def test_false_machine_claim_of_qa_pass_is_rejected(self):
        forged = machine()
        forged["independent_qa"] = "PASS"
        with self.assertRaises(ValueError):
            route(forged)

    def test_false_machine_merge_authorization_is_rejected(self):
        forged = machine()
        forged["production_merge"] = "AUTHORIZED"
        with self.assertRaises(ValueError):
            route(forged)

    def test_inconsistent_pass_and_violations_is_rejected(self):
        forged = machine()
        forged["violations"] = [{"path": "js/AudioManager.js"}]
        with self.assertRaises(ValueError):
            route(forged)

    def test_malformed_sha_is_rejected(self):
        forged = machine()
        forged["head_sha"] = "not-a-sha"
        with self.assertRaises(ValueError):
            route(forged)


if __name__ == "__main__":
    unittest.main()
