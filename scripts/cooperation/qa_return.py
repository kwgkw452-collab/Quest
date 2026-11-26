"""Signed QA return, limited to pre-pinned fictional checks and one repair per CI run."""
import copy
from controller import Controller, Hold, decision
from run_cycle import head, branch, clean, load_policy, committed_text, commit_proposal, git, machine
from story_adapter import validate
from qa_gate import verify_and_route
from repair_worker import propose
from public_github import branch_tip

def qa_return(repo, policy_file, digest, state_dir, machine_report, qa, signers,
              signers_digest, producer, repair_actor, *, node=None, publish=False,
              runner=propose, fetch_tip=branch_tip):
    """Reproduce signed FAIL using external policy, then commit exactly one repair.
    Never uses QA text as commands or changes fixed expectations.
    """
    try:
        p = load_policy(policy_file, digest, repo)
        current = head(repo)
        clean(repo, p["branch"], current)
        if machine_report.get("base_sha") != p["base_sha"] or machine_report.get("head_sha") != current:
            raise Hold("QA_SHA_STALE")
        gate = verify_and_route(machine_report, qa, signers, signers_digest, repo,
                                producer=producer, repair_actor=repair_actor, fetch_tip=fetch_tip)
        if gate["gate"] not in ("QA_REPAIR_REQUIRED", "DIRECTOR_REVIEW_PENDING"):
            return gate
        # Additional QA expectations must be pinned externally before the candidate runs.
        spec = copy.deepcopy(p["approved_spec"])
        if spec.get("schema") == "quest-v5-story-spec-v1":
            raise Hold("V5_INDEPENDENT_QA_REPRODUCTION_NOT_CONFIGURED")
        extra = p.get("qa_file_sha256", {})
        if not isinstance(extra, dict) or not extra or not set(extra) <= set(p["allowed_paths"]):
            raise Hold("QA_CRITERIA_NOT_PINNED")
        original = spec.setdefault("file_sha256", {})
        if any(k in original and original[k] != v for k,v in extra.items()):
            raise Hold("QA_CRITERIA_CONFLICT")
        original.update(extra)
        c = Controller(state_dir, repo, p["task_id"], p["branch"], p["base_sha"], p["initial_head"])
        with c.locked():
            clean(repo, p["branch"], current)
            if fetch_tip(p["branch"]) != current or c._load()["head"] != current:
                raise Hold("QA_SHA_STALE")
            report = validate(repo, current, p["package_path"], spec, node)
            if gate["gate"] == "DIRECTOR_REVIEW_PENDING":
                if report["status"] != "PASS":
                    raise Hold("QA_PASS_CONFLICTS_WITH_PINNED_CHECKS")
                return gate
            if report["status"] != "FAIL":
                raise Hold("QA_FAILURE_NOT_REPRODUCED")
            failures = report["failures"]
            # Only fixed hash failures on pre-authorized files qualify. No free-text repair.
            if any(f["code"] != "SPEC_MISMATCH" or f["path"] not in extra for f in failures):
                raise Hold("QA_FAILURE_OUTSIDE_PINNED_CHECKS")
            paths = sorted({f["path"] for f in failures})
            findings = qa["payload"].get("failed_paths")
            if not isinstance(findings, list) or sorted(findings) != paths:
                raise Hold("QA_SIGNED_FINDINGS_MISMATCH")
            selected = paths[:p.get("max_files_per_attempt", len(paths))]
            permit = c.authorize_attempt(p["branch"], current,
                                         ["QA_HASH:"+x for x in paths], p["allowed_paths"])
            if permit["gate"] != "REPAIR_RUNNING":
                return permit
            if fetch_tip(p["branch"]) != current:
                raise Hold("REMOTE_HEAD_CHANGED_BEFORE_QA_REPAIR")
            task = {"allowed_paths": selected, "approved_spec": spec, "failures": failures,
                    "files": {f: committed_text(repo, current, f) for f in selected}}
            response = runner(task)
            load_policy(policy_file, digest, repo)
            if fetch_tip(p["branch"]) != current:
                raise Hold("REMOTE_HEAD_CHANGED_DURING_QA_REPAIR")
            after = commit_proposal(repo, p["branch"], current, response["proposal"], selected)
            c.record_repair(current, after)
            if publish:
                if git(repo, "remote", "get-url", "origin").decode().strip() != "https://github.com/kwgkw452-collab/Quest.git":
                    raise Hold("UNAPPROVED_PUBLISH_DESTINATION")
                git(repo, "push", "origin", after+":refs/heads/"+p["branch"])
            return decision("CI_RETEST_PENDING", head_sha=after, previous_sha=current,
                            qa_repair_paths=selected, independent_qa="NOT_ASSESSED")
    except Exception as exc:
        return decision("HOLD", str(exc))
