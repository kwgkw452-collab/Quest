"""Create exact-head machine evidence and next-actor handoff. Never authorize edits or merge."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

def collect(root,base,head,out):
    root=Path(root).resolve();out=Path(out).resolve()
    if out==root or root in out.parents:raise ValueError("evidence directory must be outside checkout")
    if any(not re.fullmatch(r"[0-9a-f]{40}",s) for s in (base,head)):raise ValueError("invalid SHA")
    def git(*args):return subprocess.check_output(["git","-C",str(root),*args],timeout=30).decode().strip()
    if git("rev-parse","HEAD")!=head:raise ValueError("checkout HEAD mismatch")
    git("cat-file","-e",base+"^{commit}")
    out.mkdir(parents=True,exist_ok=True)
    import os,sys
    env=dict(os.environ,PYTHONPATH=str(root/"scripts/qa_guard"))
    result=subprocess.run([sys.executable,"-m","unittest","discover","-s","scripts/qa_guard","-p","test_*.py","-v"],cwd=root,env=env,capture_output=True,text=True,timeout=180)
    log=result.stdout+result.stderr
    (out/"tests.log").write_text(log)
    tests=re.search(r"Ran (\d+) tests?",log)
    passed=result.returncode==0 and tests is not None and re.search(r"(?m)^OK$",log) is not None
    fresh=git("rev-parse","HEAD")==head
    status="PASS" if passed and fresh else "FAIL" if fresh else "HOLD"
    data={"schema":"quest-ci-evidence-v1","repository":"kwgkw452-collab/Quest","pr":48,"base_sha":base,"head_sha":head,
          "status":status,"tests_total":int(tests.group(1)) if tests else None,"exit_code":result.returncode,
          "log_sha256":hashlib.sha256(log.encode()).hexdigest(),
          "next_actor":"independent_qa" if status=="PASS" else "developer_triage" if status=="FAIL" else "stop",
          "independent_qa":"NOT_ASSESSED","merge_authorized":False,"repair_authorized":False,
          "note":"Candidate-run evidence, not trusted independent certification. Test AI/CI responses and SSH keys are fixtures. No paid API."}
    (out/"evidence.json").write_text(json.dumps(data,indent=2)+"\n")
    (out/"NEXT.md").write_text("# Next actor\n\n"+data["next_actor"]+"\n\nExact head: "+head+"\n\nRead tests.log and docs/automation/WORK-LEDGER.md. For failures identify reproducible cause; do not change approved expectations. No automatic write authorization.\n")
    print(json.dumps(data))
    return 0 if status=="PASS" else 1

if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    for k in ("repo","base","head","out"):p.add_argument("--"+k,required=True)
    a=p.parse_args();raise SystemExit(collect(a.repo,a.base,a.head,a.out))
