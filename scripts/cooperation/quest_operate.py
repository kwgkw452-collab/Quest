"""Unified V9 entry point. Operate only on isolated fictional candidates."""
import argparse
import json
import hashlib
from pathlib import Path
from controller import decision, Hold
from story_format import convert
from story_contract import check
from run_cycle import load_policy, head, branch, machine
from repair_exchange import request
from repair_worker import propose
from qa_trust import load_trust
from qa_gate import verify_and_route
from qa_return import qa_return
from run_from_ci import public_runs, WORKFLOW
from public_github import branch_tip

def external(path,repo):
    p=Path(path).resolve();r=Path(repo).resolve()
    if p==r or r in p.parents:raise Hold("CANDIDATE_LOCAL_CONTROL_FILE")
    return p

def prepare(source):
    pack,spec=convert(source)
    for k in ("layout","saveContract"):
        if k not in source:raise Hold("MISSING_CONTRACT:"+k)
        spec[k]=source[k]
    errors=check(pack,spec)
    if errors:raise Hold("INVALID_CONTRACT:"+",".join(errors))
    return {"pack":pack,"spec":spec,"merge_authorized":False,"independent_qa":"NOT_ASSESSED"}

def operate(repo,policy,digest,state,*,node=None,response=None,live=False,publish=False,
            qa=None,trust_file=None,trust_digest=None,signers=None,
            worker=propose,fetch=public_runs,fetch_tip=branch_tip):
    history=[]
    try:
        p=load_policy(policy,digest,repo)
        if p["approved_spec"].get("schema")!="quest-v5-story-spec-v1":raise Hold("V9_STORY_SPEC_REQUIRED")
        if any(k not in p["approved_spec"] for k in ("layout","saveContract")):raise Hold("V9_CONTRACT_REQUIRED")
        if publish and fetch_tip(p["branch"])!=head(repo):raise Hold("REMOTE_HEAD_CHANGED")
        if qa is not None and response is not None:raise Hold("QA_AND_MACHINE_REPAIR_MIXED")
        if qa is not None:
            if not all((trust_file,trust_digest,signers)):raise Hold("QA_TRUST_NOT_ESTABLISHED")
            trust=load_trust(trust_file,trust_digest,repo)
        while True:
            r=request(repo,policy,digest,state,response=response,node=node,publish=publish)
            response=None
            history.append(r)
            gate=r["gate"]
            if gate=="CI_RETEST_PENDING":
                return {**r,"history":history}
            if gate=="LOCAL_RETEST_COMPLETE":
                continue
            if gate=="EXTERNAL_AI_PENDING":
                if qa is not None:raise Hold("QA_REQUIRES_MACHINE_PASS")
                if not live:return {**r,"history":history}
                result=worker(r["request"])
                response={"schema":"quest-repair-response-v1","request_sha256":r["request_sha256"],"proposal":result["proposal"]}
                continue
            if gate!="INDEPENDENT_QA_PENDING":
                return {**r,"history":history}
            current=r["head_sha"]
            # A local PASS is not a CI or independent QA PASS.
            if fetch_tip(p["branch"])!=current:
                return decision("CI_RETEST_PENDING",head_sha=current,history=history)
            runs=[x for x in fetch(current) if x.get("head_sha")==current and x.get("head_branch")==p["branch"] and x.get("path")==WORKFLOW and x.get("event")=="pull_request"]
            if not runs:return decision("CI_RETEST_PENDING",head_sha=current,history=history)
            ci=max(runs,key=lambda x:(x.get("run_number",0),x.get("run_attempt",1)))
            if ci.get("status")!="completed":return decision("CI_RETEST_PENDING",head_sha=current,history=history)
            if ci.get("conclusion")!="success":raise Hold("EXACT_SHA_CI_FAILED")
            if head(repo)!=current or branch(repo)!=p["branch"] or fetch_tip(p["branch"])!=current:raise Hold("HEAD_CHANGED_DURING_HANDOFF")
            evidence={"head_sha":current,"base_sha":p["base_sha"],"ci_run_id":ci["id"],"policy_sha256":digest}
            if qa is None:return decision("INDEPENDENT_QA_PENDING",history=history,**evidence)
            baseline=machine(r["report"],p["base_sha"])
            args=dict(producer=trust["producer"],repair_actor=trust["repair_actor"],fetch_tip=fetch_tip)
            verified=verify_and_route(baseline,qa,signers,trust["signers_sha256"],repo,
                                      trust_file=trust_file,trust_digest=trust_digest,policy_digest=digest,**args)
            if verified["gate"]=="QA_REPAIR_REQUIRED":
                # Reuse signed QA return. Without explicit live opt-in no AI is started.
                if not live:return decision("QA_REPAIR_REQUIRED",history=history,**evidence)
                fixed=qa_return(repo,policy,digest,state,baseline,qa,signers,trust["signers_sha256"],
                                trust["producer"],trust["repair_actor"],node=node,publish=publish,runner=worker,fetch_tip=fetch_tip)
                return {**evidence,**fixed,"history":history}
            if verified["gate"]=="DIRECTOR_REVIEW_PENDING" and p.get("qa_file_sha256"):
                verified=qa_return(repo,policy,digest,state,baseline,qa,signers,trust["signers_sha256"],
                                   trust["producer"],trust["repair_actor"],node=node,publish=False,fetch_tip=fetch_tip)
            return {**verified,**evidence,"history":history}
    except Exception as exc:
        return decision("HOLD",str(exc),history=history)

def main():
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument("mode",choices=["prepare","operate"])
    for k in ("repo","out"):a.add_argument("--"+k,required=True)
    for k in ("source","policy","policy-sha256","state-dir","node","response","qa","trust-file","trust-digest","signers"):a.add_argument("--"+k)
    a.add_argument("--live",action="store_true");a.add_argument("--publish",action="store_true");a.add_argument("--offline",action="store_true")
    x=a.parse_args()
    out=external(x.out,x.repo)
    def read(p):return json.loads(external(p,x.repo).read_text()) if p else None
    try:
        if x.mode=="prepare":r=prepare(read(x.source))
        else:
            if x.offline and (x.publish or x.qa):raise Hold("OFFLINE_CANNOT_PUBLISH_OR_VERIFY_QA")
            network=dict(fetch_tip=lambda _:None,fetch=lambda _:[]) if x.offline else {}
            r=operate(x.repo,x.policy,x.policy_sha256,x.state_dir,node=x.node,response=read(x.response),
                      live=x.live,publish=x.publish,qa=read(x.qa),trust_file=x.trust_file,
                      trust_digest=x.trust_digest,signers=x.signers,**network)
    except Exception as exc:r=decision("HOLD",str(exc))
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(r,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({k:v for k,v in r.items() if k not in ("history","request","pack","spec")},ensure_ascii=False))
    return 2 if r.get("gate")=="HOLD" else 0
if __name__=="__main__":raise SystemExit(main())
