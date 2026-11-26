"""Runtime integration checks over actual isolated Git trees and fake AI proposals.

These deterministic tests prove controller transitions, not independent QA approval.
The production subscription-AI evidence is collected separately by the executor.
"""
import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from controller import Hold
from package_check import PACKAGE_SCHEMA, SPEC_SCHEMA
from run_cycle import run

PREFIX = "tests/cooperation/fictional/"
NODE = shutil.which("node") or "/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"


class RunCycleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="quest-cycle-")
        self.addCleanup(self.temp.cleanup)
        self.top = Path(self.temp.name)
        self.root = self.top / "candidate"
        self.root.mkdir()
        self.git("init", "-q")
        self.git("config", "user.name", "Runtime fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.git("symbolic-ref", "HEAD", "refs/heads/automation/test-runtime")
        self.package_path = PREFIX + "package.json"
        self.scene = PREFIX + "scene1.js"
        self.helper = PREFIX + "helper1.js"
        self.second = PREFIX + "scene2.js"
        self.other = PREFIX + "helper2.js"
        self.contents = {self.scene: "export const sceneNumber = 1;\n",
                         self.helper: "export const helperNumber = 1;\n",
                         self.second: "export const sceneNumber = 2;\n",
                         self.other: "export const helperNumber = 2;\n"}
        self.package = {"schema": PACKAGE_SCHEMA, "fictional": True, "story_id": "FICTIONAL-RUNTIME",
                        "scenes": [
                            {"number": 1, "script": self.scene, "graphic": PREFIX + "box.svg",
                             "references": [self.helper], "communication": {"goal": "Find fictional box", "accept": ["fictional box"]}},
                            {"number": 2, "script": self.second, "graphic": PREFIX + "box.svg",
                             "references": [self.other], "communication": {"goal": "Return fictional box", "accept": ["your fictional box"]}}]}
        self.spec = {"schema": SPEC_SCHEMA, "fictional": True, "story_id": "FICTIONAL-RUNTIME",
                     "scenes": copy.deepcopy(self.package["scenes"])}
        self.original_package = json.dumps(self.package, sort_keys=True, indent=2) + "\n"
        for name, text in self.contents.items():
            self.put(name, text)
        self.put(self.package_path, self.original_package)
        self.put(PREFIX + "box.svg", '<svg xmlns="http://www.w3.org/2000/svg" width="1560" height="720"/>')
        self.base = self.commit()
        self.policy_file = self.top / "trusted-policy.json"
        self.state_dir = self.top / "controller-state"
        self.calls = []

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.root), *args], check=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.decode().strip()

    def put(self, name, text):
        p = self.root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)

    def commit(self):
        self.git("add", ".")
        self.git("commit", "-qm", "fictional runtime fixture")
        return self.git("rev-parse", "HEAD")

    def policy(self, allowed=None):
        self.initial = self.git("rev-parse", "HEAD")
        p = {"schema": "quest-cooperation-policy-v1", "fictional": True,
             "cost_mode": "chatgpt_subscription", "task_id": "runtime-integration",
             "branch": "automation/test-runtime", "base_sha": self.base,
             "initial_head": self.initial, "package_path": self.package_path,
             "allowed_paths": allowed or [self.package_path, *self.contents],
             "approved_spec": self.spec}
        self.policy_file.write_text(json.dumps(p, sort_keys=True, indent=2))
        self.digest = hashlib.sha256(self.policy_file.read_bytes()).hexdigest()

    def response(self, replacements):
        return {"proposal": {"summary": "Repair fictional implementation only",
                             "replacements": [{"path": name, "content": text} for name, text in replacements.items()]},
                "proposal_sha256": "0" * 64}

    def execute(self, runner):
        def observed(task):
            self.calls.append(copy.deepcopy(task))
            return runner(task)
        return run(self.root, self.policy_file, self.digest, self.state_dir,
                   runner=observed, node_path=NODE, publish=False)

    def test_multifile_js_and_package_repair_retests_and_never_publishes(self):
        self.put(self.scene, "export const sceneNumber = ;\n")
        bad = copy.deepcopy(self.package)
        bad["scenes"][0]["communication"]["accept"] = ["another box"]
        self.put(self.package_path, json.dumps(bad))
        self.commit()
        self.policy()
        result = self.execute(lambda task: self.response({self.scene: self.contents[self.scene], self.package_path: self.original_package}))
        self.assertEqual(result["gate"], "INDEPENDENT_QA_PENDING")
        self.assertFalse(result["merge_authorized"])
        self.assertEqual(result["independent_qa"], "NOT_ASSESSED")
        self.assertEqual(len(self.calls), 1)
        stages = [event["stage"] for event in result["events"]]
        self.assertEqual(stages, ["validate", "authorize", "repair", "validate"])
        self.assertEqual(result["events"][0]["report"]["status"], "FAIL")
        self.assertEqual(result["events"][-1]["report"]["status"], "PASS")
        changed = self.git("diff", "--name-only", self.initial, result["head_sha"]).splitlines()
        self.assertEqual(set(changed), {self.scene, self.package_path})
        self.assertEqual(self.git("config", "--local", "--get-regexp", "user\\."), "user.name Runtime fixture\nuser.email fixture@example.invalid")
        self.assertEqual(self.git("status", "--porcelain"), "")
        self.assertEqual(self.git("remote"), "")

    def test_partial_fix_then_second_fix_is_allowed(self):
        for name in (self.scene, self.helper):
            self.put(name, "export const broken = ;")
        self.commit()
        self.policy()
        queue = [self.scene, self.helper]
        result = self.execute(lambda task: self.response({queue.pop(0): self.contents[[self.scene, self.helper][len(self.calls) - 1]]}))
        self.assertEqual(result["gate"], "INDEPENDENT_QA_PENDING")
        self.assertEqual(len(self.calls), 2)
        reports = [x["report"]["status"] for x in result["events"] if x["stage"] == "validate"]
        self.assertEqual(reports, ["FAIL", "FAIL", "PASS"])

    def test_same_defect_repair_is_held_after_one_attempt(self):
        self.put(self.scene, "export const bad = ;")
        self.commit()
        self.policy()
        result = self.execute(lambda task: self.response({self.scene: "export const stillBad = ;"}))
        self.assertEqual(result["gate"], "HOLD")
        self.assertEqual(result["reason"], "REPEATED_FAILURE")
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(sum(x["stage"] == "repair" for x in result["events"]), 1)

    def test_four_distinct_reducing_failures_stop_at_three_repairs(self):
        queue = list(self.contents)
        for name in queue:
            self.put(name, "export const broken = ;")
        self.commit()
        self.policy()
        def runner(task):
            name = queue.pop(0)
            return self.response({name: self.contents[name]})
        result = self.execute(runner)
        self.assertEqual(result["gate"], "HOLD")
        self.assertEqual(result["reason"], "MAX_REPAIRS_REACHED")
        self.assertEqual(len(self.calls), 3)
        self.assertEqual(sum(x["stage"] == "repair" for x in result["events"]), 3)
        self.assertEqual(len(queue), 1)

    def test_cap_one_requires_two_real_repair_commits(self):
        for name in (self.scene, self.helper):
            self.put(name, "export const broken = ;")
        self.commit()
        self.policy()
        policy = json.loads(self.policy_file.read_text())
        policy["max_files_per_attempt"] = 1
        self.policy_file.write_text(json.dumps(policy, sort_keys=True, indent=2))
        self.digest = hashlib.sha256(self.policy_file.read_bytes()).hexdigest()
        def runner(task):
            self.assertEqual(len(task["allowed_paths"]), 1)
            self.assertEqual(set(task["files"]), set(task["allowed_paths"]))
            name = task["allowed_paths"][0]
            return self.response({name: self.contents[name]})
        result = self.execute(runner)
        self.assertEqual(result["gate"], "INDEPENDENT_QA_PENDING")
        self.assertEqual([task["allowed_paths"] for task in self.calls], [[self.scene], [self.helper]])
        repairs = [event for event in result["events"] if event["stage"] == "repair"]
        self.assertEqual(len(repairs), 2)
        for event, expected in zip(repairs, [self.scene, self.helper]):
            changed = self.git("diff", "--name-only", event["before_sha"], event["after_sha"]).splitlines()
            self.assertEqual(changed, [expected])
        self.assertEqual([event["report"]["status"] for event in result["events"] if event["stage"] == "validate"],
                         ["FAIL", "FAIL", "PASS"])
        self.assertEqual(self.git("status", "--porcelain"), "")
        self.assertEqual(json.loads(self.policy_file.read_text())["approved_spec"], self.spec)

    def test_invalid_per_attempt_cap_holds_before_ai(self):
        self.policy()
        original = json.loads(self.policy_file.read_text())
        for invalid in [0, -1, True, 1.5, "1", len(original["allowed_paths"]) + 1]:
            with self.subTest(cap=invalid):
                policy = dict(original, max_files_per_attempt=invalid)
                self.policy_file.write_text(json.dumps(policy, sort_keys=True, indent=2))
                self.digest = hashlib.sha256(self.policy_file.read_bytes()).hexdigest()
                with self.assertRaisesRegex(Hold, "INVALID_PER_ATTEMPT_SCOPE_LIMIT"):
                    self.execute(lambda task: self.response({}))
                self.assertEqual(self.calls, [])
                self.assertEqual(self.git("rev-parse", "HEAD"), self.initial)

    def test_changed_policy_digest_is_rejected_before_ai(self):
        self.policy()
        self.policy_file.write_text(self.policy_file.read_text() + "\n")
        with self.assertRaisesRegex(Hold, "POLICY_DIGEST_CHANGED"):
            self.execute(lambda task: self.response({}))
        self.assertEqual(self.calls, [])

    def test_policy_changed_during_ai_is_rejected_before_commit(self):
        self.put(self.scene, "export const broken = ;")
        self.commit()
        self.policy()
        def runner(task):
            self.policy_file.write_text(self.policy_file.read_text() + "\n")
            return self.response({self.scene: self.contents[self.scene]})
        result = self.execute(runner)
        self.assertEqual(result["gate"], "HOLD")
        self.assertEqual(result["reason"], "POLICY_DIGEST_CHANGED")
        self.assertEqual(self.git("rev-parse", "HEAD"), self.initial)
        self.assertNotIn("repair", [x["stage"] for x in result["events"]])

    def test_dirty_tree_holds_without_ai(self):
        self.policy()
        self.put(self.scene, "uncommitted work")
        result = self.execute(lambda task: self.response({}))
        self.assertEqual(result["gate"], "HOLD")
        self.assertEqual(result["reason"], "DIRTY_WORKTREE")
        self.assertEqual(self.calls, [])
        self.assertEqual((self.root / self.scene).read_text(), "uncommitted work")

    def test_branch_change_holds_without_ai(self):
        self.policy()
        self.git("checkout", "-qb", "automation/other-task")
        result = self.execute(lambda task: self.response({}))
        self.assertEqual(result["gate"], "HOLD")
        self.assertEqual(result["reason"], "BRANCH_OR_HEAD_CHANGED")
        self.assertEqual(self.calls, [])

    def test_forbidden_proposal_does_not_change_tests_or_spec(self):
        self.put(self.scene, "export const broken = ;")
        self.commit()
        self.policy()
        for forbidden in ["scripts/cooperation/test_run_cycle.py", "docs/approved/spec.json"]:
            with self.subTest(path=forbidden):
                # Each case has its own external task state, since failed AI attempts remain recorded.
                self.state_dir = self.top / forbidden.replace("/", "-")
                result = self.execute(lambda task: self.response({forbidden: "forged expectation"}))
                self.assertEqual(result["gate"], "HOLD")
                self.assertIn("out-of-scope", result["reason"])
                self.assertEqual(self.git("rev-parse", "HEAD"), self.initial)
                self.assertFalse((self.root / forbidden).exists())
                self.assertEqual(self.git("status", "--porcelain"), "")

    def test_exact_scope_is_supplied_to_ai_without_candidate_spec_override(self):
        self.put(self.scene, "export const broken = ;")
        self.commit()
        self.policy([self.scene])
        original_spec = copy.deepcopy(self.spec)
        result = self.execute(lambda task: self.response({self.scene: self.contents[self.scene]}))
        self.assertEqual(result["gate"], "INDEPENDENT_QA_PENDING")
        self.assertEqual(self.calls[0]["allowed_paths"], [self.scene])
        self.assertEqual(set(self.calls[0]["files"]), {self.scene})
        self.assertEqual(self.calls[0]["approved_spec"], original_spec)
        self.assertEqual(json.loads(self.policy_file.read_text())["approved_spec"], original_spec)


if __name__ == "__main__":
    unittest.main()
