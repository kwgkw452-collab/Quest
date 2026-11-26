"""Static checks that PRs cannot silently bypass the trusted base workflow."""
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class WorkflowContractTests(unittest.TestCase):
    def test_trusted_checker_runs_on_target_branch(self):
        workflow = (ROOT / ".github/workflows/qa-guard-trusted.yml").read_text(encoding="utf-8")
        self.assertIn("pull_request_target:", workflow)
        self.assertIn("s005-fixed-195-stage-clean-test", workflow)
        self.assertIn("github.event.pull_request.base.sha", workflow)
        self.assertIn('git fetch origin "$BASE_SHA" "refs/pull/$PR_NUMBER/head"', workflow)
        self.assertIn('if [ "$ACTUAL_HEAD" != "$HEAD_SHA" ]; then', workflow)

    def test_trusted_checker_never_runs_head_source(self):
        workflow = (ROOT / ".github/workflows/qa-guard-trusted.yml").read_text(encoding="utf-8")
        self.assertIn("persist-credentials: false", workflow)
        self.assertIn("contents: read", workflow)
        self.assertIn("python3 scripts/qa_guard/check_pr_scope.py", workflow)
        self.assertNotIn("pull_request.head.sha }}\n", workflow.split("with:", 1)[1].split("persist-credentials:", 1)[0])
        self.assertNotIn("pip install", workflow)
        self.assertNotIn("npm install", workflow)
        self.assertNotIn("github-script", workflow)

    def test_no_external_paid_ai_invocation(self):
        for name in ("qa-guard-free.yml", "qa-guard-trusted.yml"):
            workflow = (ROOT / ".github/workflows" / name).read_text(encoding="utf-8").lower()
            for forbidden in ("openai_api_key", "gemini_api_key", "anthropic_api_key", "api.openai.com", "api.anthropic.com"):
                self.assertNotIn(forbidden, workflow)


if __name__ == "__main__":
    unittest.main()
