#!/usr/bin/env python3
"""Bounded local subscription repair loop; no merge and no production execution."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

from controller import Controller, Hold, route, safe_path
from package_check import validate
from repair_worker import propose, validate_proposal


def git(repo, *args, data=None, env=None):
    return subprocess.run(["git", "-C", str(repo), *args], input=data, check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, timeout=40).stdout


def head(repo):
    return git(repo, "rev-parse", "HEAD").decode().strip()


def branch(repo):
    return git(repo, "symbolic-ref", "--short", "HEAD").decode().strip()


def load_policy(file, digest, repo):
    source = Path(file).resolve()
    root = Path(repo).resolve()
    if source == root or root in source.parents:
        raise Hold("CANDIDATE_LOCAL_POLICY")
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != digest:
        raise Hold("POLICY_DIGEST_CHANGED")
    p = json.loads(raw)
    if p.get("schema") != "quest-cooperation-policy-v1" or p.get("cost_mode") != "chatgpt_subscription":
        raise Hold("UNAPPROVED_POLICY_OR_COST_MODE")
    if p.get("fictional") is not True:
        raise Hold("REAL_STORY_SPEC_NOT_CONFIGURED")
    for name in p["allowed_paths"]:
        safe_path(name)
        if not name.startswith("tests/cooperation/fictional/"):
            raise Hold("V3_EXECUTOR_IS_FICTIONAL_ONLY")
    if not p["allowed_paths"] or len(set(p["allowed_paths"])) != len(p["allowed_paths"]):
        raise Hold("INVALID_SCOPE")
    cap = p.get("max_files_per_attempt", len(p["allowed_paths"]))
    if type(cap) is not int or not 1 <= cap <= len(p["allowed_paths"]):
        raise Hold("INVALID_PER_ATTEMPT_SCOPE_LIMIT")
    return p


def clean(repo, expected_branch, expected_head):
    if branch(repo) != expected_branch or head(repo) != expected_head:
        raise Hold("BRANCH_OR_HEAD_CHANGED")
    if git(repo, "status", "--porcelain", "--untracked-files=all").strip():
        raise Hold("DIRTY_WORKTREE")


def committed_text(repo, sha, name):
    safe_path(name)
    entry = git(repo, "ls-tree", "-z", sha, "--", name).split(b"\0")[0]
    if not entry.startswith(b"100644 blob ") or entry.split(b"\t")[-1].decode() != name:
        raise Hold("REPAIR_INPUT_NOT_REGULAR_FILE")
    data = git(repo, "show", sha + ":" + name)
    if len(data) > 512 * 1024:
        raise Hold("INPUT_TOO_LARGE")
    return data.decode("utf-8")


def commit_proposal(repo, expected_branch, before, proposal, allowed):
    """Construct a Git tree in a temporary index: candidate hooks never execute.

    Branch update is compare-and-swap. The caller must hold the external branch
    lock. The CLI is intended for its own clean, dedicated worktree only.
    """
    validate_proposal(proposal, allowed)
    if not proposal["replacements"]:
        raise Hold("EMPTY_AI_PROPOSAL")
    clean(repo, expected_branch, before)
    with tempfile.TemporaryDirectory(prefix="quest-index-") as td:
        env = dict(os.environ, GIT_INDEX_FILE=str(Path(td) / "index"))
        git(repo, "read-tree", before, env=env)
        for item in proposal["replacements"]:
            committed_text(repo, before, item["path"])
            blob = git(repo, "hash-object", "-w", "--stdin", data=item["content"].encode()).decode().strip()
            git(repo, "update-index", "--add", "--cacheinfo", "100644," + blob + "," + item["path"], env=env)
        tree = git(repo, "write-tree", env=env).decode().strip()
        if tree == git(repo, "rev-parse", before + "^{tree}").decode().strip():
            raise Hold("NO_CHANGE_PROPOSAL")
        after = git(repo, "-c", "user.name=Quest subscription repair", "-c", "user.email=quest-repair@example.invalid",
                    "commit-tree", tree, "-p", before, data=b"Repair isolated fictional package within pinned scope\n").decode().strip()
    changed = git(repo, "diff", "--name-only", "-z", before, after).split(b"\0")
    if any(p.decode() not in allowed for p in changed if p):
        raise Hold("OUT_OF_SCOPE_COMMIT")
    clean(repo, expected_branch, before)
    # update-ref requires the old SHA; a concurrent ref change cannot be overwritten.
    git(repo, "update-ref", "refs/heads/" + expected_branch, after, before)
    if branch(repo) != expected_branch or head(repo) != after:
        raise Hold("BRANCH_OR_HEAD_CHANGED_AFTER_COMMIT")
    # Refresh only paths from the proposal. No checkout/reset of protected game files.
    paths = [item["path"] for item in proposal["replacements"]]
    git(repo, "-c", "core.hooksPath=/dev/null", "restore", "--source=" + after, "--staged", "--worktree", "--", *paths)
    clean(repo, expected_branch, after)
    return after


def machine(report, base):
    return {"schema": "quest-cooperation-machine-v1", "base_sha": base,
            "head_sha": report["head_sha"], "status": report["status"],
            "violations": report["failures"], "independent_qa": "NOT_ASSESSED",
            "production_merge": "NOT_AUTHORIZED"}


def run(repo, policy_file, policy_digest, state_dir, *, runner=propose, node_path=None, publish=False):
    repo = Path(repo).resolve()
    p = load_policy(policy_file, policy_digest, repo)
    c = Controller(state_dir, repo, p["task_id"], p["branch"], p["base_sha"], p["initial_head"])
    events = []
    result = {"schema": "quest-cooperation-execution-v1", "fictional": True,
              "merge_authorized": False, "independent_qa": "NOT_ASSESSED",
              "additional_paid_service": False, "events": events,
              "policy_sha256": policy_digest,
              "tool_sha256": {name: hashlib.sha256((Path(__file__).parent/name).read_bytes()).hexdigest()
                              for name in ("run_cycle.py", "controller.py", "package_check.py", "repair_worker.py")}}
    try:
        with c.locked():
            while True:
                current = head(repo)
                clean(repo, p["branch"], current)
                load_policy(policy_file, policy_digest, repo)
                state = c._load()
                if current != state["head"]:
                    raise Hold("HEAD_CHANGED")
                report = validate(repo, current, p["package_path"], p["approved_spec"], node_path)
                events.append({"stage": "validate", "report": report})
                if report["status"] != "FAIL":
                    result.update(route(machine(report, p["base_sha"])))
                    result["head_sha"] = current
                    return result
                ids = sorted({f["code"] + ":" + f["path"] for f in report["failures"]})
                gate = c.authorize_attempt(p["branch"], current, ids, p["allowed_paths"])
                events.append({"stage": "authorize", "decision": gate})
                if gate["gate"] != "REPAIR_RUNNING":
                    result.update(gate)
                    return result
                cap = p.get("max_files_per_attempt", len(p["allowed_paths"]))
                failing_paths = {f["path"] for f in report["failures"]}
                selected = ([f for f in p["allowed_paths"] if f in failing_paths][:cap]
                            if "max_files_per_attempt" in p else p["allowed_paths"])
                if not selected:
                    raise Hold("FAILURE_OUTSIDE_REPAIR_SCOPE")
                task = {"allowed_paths": selected, "approved_spec": p["approved_spec"],
                        "failures": report["failures"], "files": {
                            f: committed_text(repo, current, f) for f in selected}}
                response = runner(task)
                load_policy(policy_file, policy_digest, repo)
                after = commit_proposal(repo, p["branch"], current, response["proposal"], selected)
                c.record_repair(current, after)
                events.append({"stage": "repair", "before_sha": current, "after_sha": after,
                               "proposal_sha256": response.get("proposal_sha256"),
                               "summary": response["proposal"]["summary"]})
                if publish:
                    remote = git(repo, "remote", "get-url", "origin").decode().strip()
                    if remote != "https://github.com/kwgkw452-collab/Quest.git":
                        raise Hold("UNAPPROVED_PUBLISH_DESTINATION")
                    # Ordinary non-force push only; never merge, never Production.
                    git(repo, "push", "origin", after + ":refs/heads/" + p["branch"])
                    events.append({"stage": "push", "head_sha": after, "branch": p["branch"]})
    except Exception as exc:
        result.update({"gate": "HOLD", "reason": str(exc)})
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--policy", required=True)
    parser.add_argument("--policy-sha256", required=True)
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--node")
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    out = Path(args.out).resolve()
    root = Path(args.repo).resolve()
    if out == root or root in out.parents:
        raise SystemExit("Report must be outside candidate repository")
    try:
        result = run(args.repo, args.policy, args.policy_sha256, args.state_dir,
                     node_path=args.node, publish=args.publish)
    except Exception as exc:
        result = {"gate": "HOLD", "reason": str(exc), "merge_authorized": False}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k:v for k,v in result.items() if k != "events"}, ensure_ascii=False))
    return 2 if result["gate"] == "HOLD" else 0


if __name__ == "__main__":
    sys.exit(main())
