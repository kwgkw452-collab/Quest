"""V10 CLI process integration. Git/Node/SSH are real; CI and AI doubles are labeled."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import unittest
import test_story_adapter as fixture
from quest_operate import operate,prepare,WORKFLOW
from qa_gate import canonical,NAMESPACE

class OperateTests(unittest.TestCase):
    def setUp(self):
        self.v=fixture.V5Tests("test_normal");self.v.setUp();self.addCleanup(self.v.doCleanups)
        v=self.v;f=v.f
        q=v.pack["challenges"]["q1"]
        self.source={"schema":"quest-story-authoring-v1","fictional":True,"id":"S098","title":"FICTIONAL ONLY",
          "scenes":[{"id":"scene01","graphic":v.asset,"communication":[dict(q,id="q1",cases=v.spec["judgeCases"]["q1"])]},
                    {"id":"scene02","graphic":v.asset,"communication":[dict(q,id="q2",cases=v.spec["judgeCases"]["q2"])]}],
          "layout":{"width":1560,"height":720,"safeBottom":108,"subjects":{v.asset:[[10,20,100,200]]}},
          "saveContract":{"schemaVersion":1,"storyId":"S098","keys":{}}}
        self.prepared=prepare(self.source)
        broken=json.loads(json.dumps(self.prepared["pack"]))
        broken["challenges"]["q1"]["rule"]["accept"]=["Wrong"]
        f.put(v.path,json.dumps(broken));f.commit()
        f.package_path=v.path;f.spec=self.prepared["spec"];f.policy([v.path])
        self.calls=[]
    def cli(self,mode,*args):
        f=self.v.f;out=f.top/"cli-out.json"
        if out.exists():out.unlink()
        result=subprocess.run([sys.executable,str(Path(__file__).with_name("quest_operate.py")),mode,
                               "--repo",str(f.root),"--out",str(out),*map(str,args)],capture_output=True,text=True,timeout=40)
        return result,json.loads(out.read_text()) if out.exists() else None
    def opts(self):
        f=self.v.f
        return ["--policy",f.policy_file,"--policy-sha256",f.digest,"--state-dir",f.state_dir,"--node",fixture.fixture.NODE]
    def ci(self,sha,status="completed",conclusion="success"):
        return [{"id":123,"head_sha":sha,"head_branch":"automation/test-runtime","path":WORKFLOW,
                 "event":"pull_request","status":status,"conclusion":conclusion}]
    def run_op(self,**kw):
        f=self.v.f
        args=dict(node=fixture.fixture.NODE,fetch_tip=lambda _:f.git("rev-parse","HEAD"),fetch=self.ci)
        args.update(kw)
        return operate(f.root,f.policy_file,f.digest,f.state_dir,**args)
    def proposal(self,task):
        self.calls.append(task)
        return {"proposal":{"summary":"TEST DOUBLE only","replacements":[{"path":self.v.path,"content":json.dumps(self.prepared["pack"])}]}}
    def test_cli_prepare_request_response_actual_process(self):
        f=self.v.f;source=f.top/"source.json";source.write_text(json.dumps(self.source))
        proc,r=self.cli("prepare","--source",source)
        self.assertEqual(proc.returncode,0,proc.stderr);self.assertEqual(r,self.prepared)
        proc,r=self.cli("operate",*self.opts())
        self.assertEqual(proc.returncode,0,proc.stderr);self.assertEqual(r["gate"],"EXTERNAL_AI_PENDING",repr(r))
        proposal=self.proposal(r["request"])["proposal"]
        response=f.top/"response.json";response.write_text(json.dumps({"schema":"quest-repair-response-v1","request_sha256":r["request_sha256"],"proposal":proposal}))
        # The real CLI is deliberately offline in fixture mode. CI identity is injected below.
        proc,r=self.cli("operate",*self.opts(),"--response",response,"--offline")
        self.assertEqual(proc.returncode,0,proc.stderr);self.assertEqual(r["gate"],"CI_RETEST_PENDING",repr(r))
        self.assertEqual(f.git("diff","--name-only",f.initial,f.git("rev-parse","HEAD")),self.v.path)
        self.assertEqual(self.run_op()["gate"],"INDEPENDENT_QA_PENDING")
        print("V10 evidence: real CLI prepare -> request -> response -> Git commit -> local PASS; synthetic CI -> QA pending")
    def test_live_worker_invoked_and_ci_fail_closed(self):
        r=self.run_op(live=True,worker=self.proposal,fetch=lambda sha:self.ci(sha,"in_progress",None))
        self.assertEqual(r["gate"],"CI_RETEST_PENDING",repr(r));self.assertEqual(len(self.calls),1)
        self.assertEqual(self.run_op(fetch=lambda sha:self.ci(sha,"completed","failure"))["reason"],"EXACT_SHA_CI_FAILED")
        self.assertEqual(self.run_op()["gate"],"INDEPENDENT_QA_PENDING")
    def test_invalid_proposal_and_policy(self):
        f=self.v.f;r=self.run_op()
        bad={"schema":"quest-repair-response-v1","request_sha256":r["request_sha256"],"proposal":{"summary":"bad","replacements":[{"path":"engine/core.js","content":"bad"}]}}
        self.assertEqual(self.run_op(response=bad)["gate"],"HOLD")
        f.policy_file.write_text(f.policy_file.read_text()+" ")
        self.assertEqual(self.run_op()["reason"],"POLICY_DIGEST_CHANGED")
        self.assertEqual(f.git("rev-parse","HEAD"),f.initial)
    def test_head_change_and_production_branch(self):
        f=self.v.f
        def race(sha):
            f.git("commit","--allow-empty","-qm","concurrent")
            return self.ci(sha)
        r=self.run_op(live=True,worker=self.proposal,fetch=race)
        self.assertEqual(r["reason"],"HEAD_CHANGED_DURING_HANDOFF")
        f.git("checkout","-qb","s005-fixed-195-stage-clean-test")
        self.assertEqual(self.run_op()["gate"],"HOLD")
    def test_safe_area_and_save_contract(self):
        source=json.loads(json.dumps(self.source))
        source["layout"]["subjects"][self.v.asset]=[[0,600,10,20]]
        with self.assertRaisesRegex(Exception,"SAFE_AREA"):prepare(source)
        source=json.loads(json.dumps(self.source));source["saveContract"]["storyId"]="S007"
        with self.assertRaisesRegex(Exception,"SAVE_IDENTITY"):prepare(source)
    def test_signed_qa_context_and_hold(self):
        f=self.v.f;self.run_op(live=True,worker=self.proposal)
        key=f.top/"test-key";subprocess.run(["ssh-keygen","-q","-t","ed25519","-N","","-f",str(key)],check=True)
        signers=f.top/"signers";signers.write_text("fixture-qa "+key.with_suffix(".pub").read_text())
        trust={"schema":"quest-qa-trust-v1","repository":"kwgkw452-collab/Quest","pr":48,"expectations":"fixture-v1","trust_commit":"a"*40,"signers_sha256":hashlib.sha256(signers.read_bytes()).hexdigest(),"reviewers":["fixture-qa"],"producer":"producer","repair_actor":"repair","policy_sha256":f.digest}
        tf=f.top/"trust.json";tf.write_text(json.dumps(trust));td=hashlib.sha256(tf.read_bytes()).hexdigest()
        payload={"schema":"quest-independent-qa-verdict-v1","base_sha":f.base,"head_sha":f.git("rev-parse","HEAD"),"reviewer":"fixture-qa","verdict":"HOLD",**{k:trust[k] for k in ("repository","pr","expectations","trust_commit")}}
        target=f.top/"qa-payload";target.write_bytes(canonical(payload))
        subprocess.run(["ssh-keygen","-Y","sign","-f",str(key),"-n",NAMESPACE,str(target)],check=True,capture_output=True)
        qa={"payload":payload,"signature":Path(str(target)+".sig").read_text()}
        args=dict(trust_file=tf,trust_digest=td,signers=signers)
        self.assertEqual(self.run_op(qa=qa,**args)["reason"],"QA_NOT_PASS")
        qa["payload"]["verdict"]="PASS"
        self.assertEqual(self.run_op(qa=qa,**args)["reason"],"INVALID_QA_SIGNATURE")
        qa["payload"]["pr"]=49
        self.assertEqual(self.run_op(qa=qa,**args)["reason"],"QA_CONTEXT_MISMATCH:pr")
    def test_candidate_control_files_rejected(self):
        f=self.v.f;source=f.root/"source.json";source.write_text(json.dumps(self.source))
        p,r=self.cli("prepare","--source",source)
        self.assertEqual(p.returncode,2);self.assertEqual(r["reason"],"CANDIDATE_LOCAL_CONTROL_FILE")
