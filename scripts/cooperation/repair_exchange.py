"""External repair exchange. Requests are regenerated from trusted policy and live Git.
No external response can authorize a path, reset attempts or grant QA/merge approval.
"""
import hashlib
import json
from pathlib import Path
from controller import Controller, Hold, decision
from run_cycle import load_policy, clean, head, committed_text, commit_proposal, machine, git
from story_adapter import validate
from repair_worker import validate_proposal

def digest(obj):
    return hashlib.sha256(json.dumps(obj,sort_keys=True,ensure_ascii=False,separators=(",",":")).encode()).hexdigest()

def request(repo, policy, policy_digest, state_dir, *, response=None, node=None, publish=False):
    try:
        p=load_policy(policy,policy_digest,repo)
        c=Controller(state_dir,repo,p["task_id"],p["branch"],p["base_sha"],p["initial_head"])
        with c.locked():
            current=head(repo)
            clean(repo,p["branch"],current)
            state=c._load()
            if current!=state["head"]:raise Hold("HEAD_CHANGED")
            report=validate(repo,current,p["package_path"],p["approved_spec"],node)
            if report["status"]!="FAIL":
                if response is not None:raise Hold("NO_CURRENT_FAILURE")
                return decision("INDEPENDENT_QA_PENDING" if report["status"]=="PASS" else "HOLD",head_sha=current,report=report)
            paths=sorted({f["path"] for f in report["failures"]})
            if not set(paths)<=set(p["allowed_paths"]):raise Hold("FAILURE_OUTSIDE_REPAIR_SCOPE")
            ids=sorted({f["code"]+":"+f["path"] for f in report["failures"]})
            if len(state["attempts"])>=3:raise Hold("MAX_REPAIRS_REACHED")
            if state["attempts"] and state["attempts"][-1]["after_head"] is None:raise Hold("UNFINISHED_ATTEMPT")
            if any(a["fail_ids"]==ids for a in state["attempts"]):raise Hold("REPEATED_FAILURE")
            selected=paths[:p.get("max_files_per_attempt",len(paths))]
            payload={"schema":"quest-repair-request-v1","branch":p["branch"],"base_sha":p["base_sha"],
                     "head_sha":current,"policy_sha256":policy_digest,"attempt":len(state["attempts"])+1,
                     "allowed_paths":selected,"approved_spec":p["approved_spec"],"failures":report["failures"],
                     "files":{f:committed_text(repo,current,f) for f in selected}}
            token=digest(payload)
            if response is None:return decision("EXTERNAL_AI_PENDING",request=payload,request_sha256=token)
            if not isinstance(response,dict) or set(response)!={"schema","request_sha256","proposal"} or response["schema"]!="quest-repair-response-v1" or response["request_sha256"]!=token:
                raise Hold("STALE_OR_INVALID_RESPONSE")
            proposal=validate_proposal(response["proposal"],selected)
            if publish and git(repo,"remote","get-url","origin").decode().strip()!="https://github.com/kwgkw452-collab/Quest.git":
                raise Hold("UNAPPROVED_PUBLISH_DESTINATION")
            permit=c.authorize_attempt(p["branch"],current,ids,p["allowed_paths"])
            if permit["gate"]!="REPAIR_RUNNING":return permit
            load_policy(policy,policy_digest,repo)
            after=commit_proposal(repo,p["branch"],current,proposal,selected)
            c.record_repair(current,after)
            if publish:git(repo,"push","origin",after+":refs/heads/"+p["branch"])
            retest=validate(repo,after,p["package_path"],p["approved_spec"],node)
            return decision("CI_RETEST_PENDING" if publish else "LOCAL_RETEST_COMPLETE",head_sha=after,previous_sha=current,
                            report=retest,request_sha256=token,proposal_sha256=digest(proposal))
    except Exception as exc:return decision("HOLD",str(exc))

def main():
    import argparse
    a=argparse.ArgumentParser(description=__doc__)
    for name in ("repo","policy","policy-sha256","state-dir","out"):a.add_argument("--"+name,required=True)
    a.add_argument("--response");a.add_argument("--node");a.add_argument("--publish",action="store_true")
    x=a.parse_args();root=Path(x.repo).resolve();out=Path(x.out).resolve()
    if out==root or root in out.parents:raise SystemExit("Output must be external")
    response=json.loads(Path(x.response).read_text()) if x.response else None
    r=request(x.repo,x.policy,x.policy_sha256,x.state_dir,response=response,node=x.node,publish=x.publish)
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(r,ensure_ascii=False,indent=2))
    return 2 if r["gate"]=="HOLD" else 0
if __name__=="__main__":raise SystemExit(main())
