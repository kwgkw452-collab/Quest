"""Offline contracts for the free, unprivileged QA workflow."""
import pathlib
import unittest

from check_pr_scope import reasons_for


ROOT = pathlib.Path(__file__).resolve().parents[2]


class WorkflowContractTests(unittest.TestCase):
    def test_free_checker_runs_for_production_prs(self):
        workflow = (ROOT / ".github/workflows/qa-guard-free.yml").read_text(encoding="utf-8")
        self.assertIn("pull_request:", workflow)
        self.assertIn("s005-fixed-195-stage-clean-test", workflow)
        self.assertIn("github.event.pull_request.base.sha", workflow)
        self.assertIn("github.event.pull_request.head.sha", workflow)
        self.assertIn("permissions:\n  contents: read", workflow)
        self.assertNotIn("pull_request_target:", workflow)
        self.assertNotIn("workflow_dispatch:", workflow)

    def test_guard_mutations_are_detected_by_path_rule(self):
        for protected in (
            ".github/workflows/qa-guard-free.yml",
            "scripts/qa_guard/check_pr_scope.py",
            "docs/approved/S008.json",
        ):
            with self.subTest(path=protected):
                self.assertTrue(reasons_for(protected))

    def test_no_paid_ai_api_or_automation_token(self):
        workflow = (ROOT / ".github/workflows/qa-guard-free.yml").read_text(encoding="utf-8").lower()
        for forbidden in (
            "openai_api_key", "gemini_api_key", "anthropic_api_key",
            "api.openai.com", "api.anthropic.com", "pull_request_target:",
            "contents: write", "secrets.", "npm install", "pip install",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, workflow)


if __name__ == "__main__":
    unittest.main()
