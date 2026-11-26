import os
import unittest
from unittest.mock import patch
from repair_worker import validate_proposal, subscription_environment, propose


class WorkerTests(unittest.TestCase):
    def test_keys_and_custom_api_endpoint_removed(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "fake", "SOME_API_KEY": "fake", "OPENAI_BASE_URL": "https://invalid"}):
            env = subscription_environment()
            self.assertNotIn("OPENAI_API_KEY", env)
            self.assertNotIn("SOME_API_KEY", env)
            self.assertNotIn("OPENAI_BASE_URL", env)

    def test_no_cli_holds(self):
        with patch("repair_worker.shutil.which", return_value=None):
            with self.assertRaisesRegex(RuntimeError, "unavailable"):
                propose({})

    def test_api_login_rejected_before_execution(self):
        class Login:
            returncode = 0
            stdout = "Logged in using an API key"
            stderr = ""
        with patch("repair_worker.subprocess.run", return_value=Login()) as login:
            with self.assertRaisesRegex(RuntimeError, "billing forbidden"):
                propose({}, codex="fake-codex")
            self.assertEqual(login.call_count, 1)

    def test_proposal_cannot_modify_spec_or_tests(self):
        for name in ("specs/approved.json", "scripts/cooperation/test_package_check.py", "../outside", "engine/stories/S001.js"):
            with self.assertRaises(ValueError):
                validate_proposal({"summary":"bad", "replacements":[{"path":name,"content":"changed"}]}, ["tests/cooperation/fictional/package.json"])

    def test_duplicate_paths_rejected(self):
        item = {"path":"allowed", "content":"x"}
        with self.assertRaises(ValueError):
            validate_proposal({"summary":"x", "replacements":[item,item]}, ["allowed"])

    def test_invalid_envelope_rejected(self):
        for value in ([], {"summary":"x","replacements":[],"merge":True}, {"summary":3,"replacements":[]}):
            with self.assertRaises(ValueError):
                validate_proposal(value, [])

    def test_complete_scoped_proposal_accepted(self):
        value = {"summary":"fix", "replacements":[{"path":"allowed", "content":"correct"}]}
        self.assertEqual(validate_proposal(value, ["allowed"]), value)
