#!/usr/bin/env python3
"""One bounded public-CI poll -> subscription repair -> exact-SHA retest handoff.

Invoke from an existing authorized task or manually. No scheduler is installed.
"""
import argparse
import json
from pathlib import Path
import sys
import time
from urllib.request import Request, urlopen

from run_cycle import run, head, branch, load_policy, machine
from qa_gate import verify_and_route
from public_github import branch_tip

REPO = "kwgkw452-collab/Quest"
WORKFLOW = ".github/workflows/qa-guard-free.yml"


def public_runs(sha):
    url = "https://api.github.com/repos/" + REPO + "/actions/runs?head_sha=" + sha + "&per_page=20"
    request = Request(url, headers={"Accept":"application/vnd.github+json", "User-Agent":"Quest-zero-cost-cooperation-v3"})
    # Public read only, no API keys, no uploads/storage, no billing settings.
    with urlopen(request, timeout=20) as response:
        return json.load(response)["workflow_runs"]


def advance(repo, policy, digest, state, *, node=None, publish=False, fetch=public_runs, execute=run, qa=None, signers=None, signers_digest=None, producer=None, repair_actor=None, fetch_tip=branch_tip):
    current = head(repo)
    p = load_policy(policy, digest, repo)
    if branch(repo) != p["branch"]:
        return {"gate":"HOLD", "reason":"BRANCH_CHANGED", "merge_authorized":False}
    if fetch_tip(p["branch"]) != current:
        return {"gate":"HOLD", "reason":"REMOTE_HEAD_CHANGED", "merge_authorized":False}
    runs = fetch(current)
    matching = [r for r in runs if r.get("head_sha") == current and r.get("head_branch") == p["branch"]
                and r.get("path") == WORKFLOW and r.get("event") == "pull_request"]
    if not matching:
        return {"gate":"HOLD", "reason":"EXACT_SHA_CI_NOT_FOUND", "head_sha":current, "merge_authorized":False}
    latest = max(matching, key=lambda r:(r.get("run_number",0),r.get("run_attempt",1)))
    evidence = {"ci_run_id":latest["id"],"ci_url":latest.get("html_url"),"ci_head_sha":current,
                "ci_conclusion":latest.get("conclusion")}
    if latest.get("status") != "completed":
        return {"gate":"HOLD", "reason":"EXACT_SHA_CI_PENDING", "merge_authorized":False, **evidence}
    if latest.get("conclusion") not in ("success","failure"):
        return {"gate":"HOLD", "reason":"UNKNOWN_CI_RESULT", "merge_authorized":False, **evidence}
    result = execute(repo, policy, digest, state, node_path=node, publish=publish)
    result.update(evidence)
    if result.get("gate") != "HOLD" and (branch(repo) != p["branch"] or head(repo) != result.get("head_sha", current)):
        result.update(gate="HOLD", reason="BRANCH_OR_HEAD_CHANGED_AFTER_EXECUTION")
        return result
    if result.get("head_sha",current) != current or any(e.get("stage")=="repair" for e in result.get("events",[])):
        if result.get("gate") != "HOLD":
            result["gate"] = "CI_RETEST_PENDING"
    elif latest["conclusion"] == "failure" and result.get("gate") != "HOLD":
        result.update(gate="HOLD",reason="CI_FAILURE_NOT_EXPLAINED_BY_PACKAGE")
    if qa is not None and result.get("gate") == "INDEPENDENT_QA_PENDING":
        reports = [e["report"] for e in result.get("events", []) if e.get("stage") == "validate"]
        if not reports or not all([signers, signers_digest, producer, repair_actor]):
            result.update(gate="HOLD", reason="QA_TRUST_NOT_ESTABLISHED")
        else:
            result.update(verify_and_route(machine(reports[-1], p["base_sha"]), qa, signers,
                                          signers_digest, repo, producer=producer, repair_actor=repair_actor, fetch_tip=fetch_tip))
    if result.get("gate") != "HOLD" and (branch(repo) != p["branch"] or head(repo) != result.get("head_sha", current)):
        result.update(gate="HOLD", reason="BRANCH_OR_HEAD_CHANGED_DURING_HANDOFF")
    if result.get("gate") != "HOLD" and (publish or result.get("head_sha",current)==current) and fetch_tip(p["branch"]) != result.get("head_sha", current):
        result.update(gate="HOLD", reason="REMOTE_HEAD_CHANGED_DURING_HANDOFF")
    return result


def wait_for_handoff(step, *, polls=10, interval=60, sleeper=time.sleep):
    """Bounded continuation inside one process; not a new scheduled automation."""
    if type(polls) is not int or not 1 <= polls <= 10 or not 30 <= interval <= 60:
        raise ValueError("Bounded polling requires 1..10 polls and interval 30..60 seconds")
    snapshots=[]
    for index in range(polls):
        result=step()
        snapshots.append(result)
        pending=(result.get("gate")=="CI_RETEST_PENDING" or
                 result.get("gate")=="HOLD" and result.get("reason") in ("EXACT_SHA_CI_PENDING","EXACT_SHA_CI_NOT_FOUND"))
        if not pending:
            return {**result,"poll_history":snapshots}
        if index+1<polls:
            sleeper(interval)
    return {**result,"gate":"HOLD","reason":"BOUNDED_CI_WAIT_EXHAUSTED","poll_history":snapshots,"merge_authorized":False}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo",required=True);p.add_argument("--policy",required=True)
    p.add_argument("--policy-sha256",required=True);p.add_argument("--state-dir",required=True)
    p.add_argument("--wait-for-ci",action="store_true");p.add_argument("--max-polls",type=int,default=10)
    p.add_argument("--qa");p.add_argument("--qa-signers");p.add_argument("--qa-signers-sha256")
    p.add_argument("--producer");p.add_argument("--repair-actor")
    p.add_argument("--node");p.add_argument("--publish",action="store_true");p.add_argument("--out",required=True)
    a=p.parse_args()
    out=Path(a.out).resolve();root=Path(a.repo).resolve()
    if out==root or root in out.parents:raise SystemExit("Output must be external")
    def step():
        return advance(a.repo,a.policy,a.policy_sha256,a.state_dir,node=a.node,publish=a.publish,
                  qa=json.loads(Path(a.qa).read_text()) if a.qa else None,
                  signers=a.qa_signers,signers_digest=a.qa_signers_sha256,
                  producer=a.producer,repair_actor=a.repair_actor)
    try:r=wait_for_handoff(step,polls=a.max_polls) if a.wait_for_ci else step()
    except Exception as exc:r={"gate":"HOLD","reason":str(exc),"merge_authorized":False}
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in r.items() if k not in ('events','poll_history')},ensure_ascii=False))
    return 2 if r['gate']=='HOLD' else 0


if __name__=='__main__':sys.exit(main())
