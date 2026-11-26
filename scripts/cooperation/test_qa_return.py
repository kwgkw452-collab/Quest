"""Actual Git commits and disposable SSH signatures; AI proposals are test doubles."""
import hashlib
import json
from pathlib import Path
import subprocess
import unittest
from test_run_cycle import RunCycleTests, NODE
from run_cycle import machine, head
from package_check import validate
from qa_gate import canonical, NAMESPACE
from qa_return import qa_return

class QAReturnTests(unittest.TestCase):
    # Reuse fixture construction without inheriting or duplicating its tests.
    def setUp(self):
        self.f = RunCycleTests("test_dirty_tree_holds_without_ai")
        self.f.setUp()
        self.addCleanup(self.f.doCleanups)
        f=self.f
        f.put(f.scene, "export const sceneNumber = 99;\n")
        f.commit()
        f.policy([f.scene])
        p=json.loads(f.policy_file.read_text())
        p["qa_file_sha256"]={f.scene:hashlib.sha256(f.contents[f.scene].encode()).hexdigest()}
        f.policy_file.write_text(json.dumps(p))
        f.digest=hashlib.sha256(f.policy_file.read_bytes()).hexdigest()
        self.key=f.top/"qa-test-key"
        subprocess.run(["ssh-keygen","-q","-t","ed25519","-N","","-f",str(self.key)],check=True)
        self.signers=f.top/"signers"
        self.signers.write_text("independent-fixture "+self.key.with_suffix(".pub").read_text())
        self.digest=hashlib.sha256(self.signers.read_bytes()).hexdigest()
        self.calls=[]

    def signed(self, verdict, paths=None, sha=None, reviewer="independent-fixture"):
        f=self.f
        payload={"schema":"quest-independent-qa-verdict-v1","base_sha":f.base,
                 "head_sha":sha or head(f.root),"reviewer":reviewer,"verdict":verdict}
        if paths is not None: payload["failed_paths"]=paths
        target=f.top/"verdict"
        target.write_bytes(canonical(payload))
        sig=Path(str(target)+".sig")
        if sig.exists(): sig.unlink()
        subprocess.run(["ssh-keygen","-Y","sign","-f",str(self.key),"-n",NAMESPACE,str(target)],check=True,capture_output=True)
        return {"payload":payload,"signature":sig.read_text()}

    def execute(self, qa, replacement=None):
        f=self.f
        report=validate(f.root,head(f.root),f.package_path,f.spec,NODE)
        self.assertEqual(report["status"],"PASS")
        def runner(task):
            self.calls.append(task)
            return f.response({f.scene:replacement or f.contents[f.scene]})
        return qa_return(f.root,f.policy_file,f.digest,f.state_dir,machine(report,f.base),
                         qa,self.signers,self.digest,"producer","repair",node=NODE,
                         runner=runner,fetch_tip=lambda _:head(f.root))

    def test_signed_fail_repairs_actual_git_and_fresh_pass_routes_director(self):
        f=self.f
        old=self.signed("FAIL",[f.scene])
        result=self.execute(old)
        self.assertEqual(result["gate"],"CI_RETEST_PENDING")
        self.assertEqual(f.git("diff","--name-only",f.initial,result["head_sha"]),f.scene)
        self.assertEqual(len(self.calls),1)
        self.assertEqual(self.calls[0]["allowed_paths"],[f.scene])
        self.assertEqual(self.execute(old)["reason"],"QA_SHA_STALE")
        final=self.execute(self.signed("PASS"))
        self.assertEqual(final["gate"],"DIRECTOR_REVIEW_PENDING")
        self.assertFalse(final["merge_authorized"])

    def test_forged_or_wrong_path_does_not_execute(self):
        f=self.f
        q=self.signed("FAIL",[f.scene])
        q["payload"]["failed_paths"]=[f.helper]
        self.assertEqual(self.execute(q)["reason"],"INVALID_QA_SIGNATURE")
        self.assertEqual(self.execute(self.signed("FAIL",[f.helper]))["reason"],"QA_SIGNED_FINDINGS_MISMATCH")
        self.assertFalse(self.calls)
        self.assertEqual(head(f.root),f.initial)

    def test_signed_pass_with_reproducible_defect_is_hold(self):
        self.assertEqual(self.execute(self.signed("PASS"))["reason"],"QA_PASS_CONFLICTS_WITH_PINNED_CHECKS")
        self.assertFalse(self.calls)

    def test_repeat_failure_cannot_consume_another_attempt(self):
        f=self.f
        result=self.execute(self.signed("FAIL",[f.scene]),"export const sceneNumber = 98;\n")
        self.assertEqual(result["gate"],"CI_RETEST_PENDING")
        result=self.execute(self.signed("FAIL",[f.scene]))
        self.assertEqual(result["reason"],"REPEATED_FAILURE")
        self.assertEqual(len(self.calls),1)

    def test_stale_qa_cannot_start_repair(self):
        f=self.f
        self.assertEqual(self.execute(self.signed("FAIL",[f.scene],sha="a"*40))["reason"],"QA_SHA_STALE")
        self.assertFalse(self.calls)

if __name__=="__main__":
    unittest.main()
