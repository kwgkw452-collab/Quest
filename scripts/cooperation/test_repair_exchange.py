"""External exchange integration over real local Git; response is a test double."""
import json
import unittest
import test_story_adapter as fixture
from repair_exchange import request

class ExchangeTests(unittest.TestCase):
    def setUp(self):
        self.v=fixture.V5Tests("test_normal")
        self.v.setUp()
        self.addCleanup(self.v.doCleanups)
        v=self.v;f=v.f
        broken=json.loads(json.dumps(v.pack))
        broken["challenges"]["q1"]["rule"]["accept"]=["Wrong"]
        f.put(v.path,json.dumps(broken));f.commit()
        f.package_path=v.path;f.spec=v.spec;f.policy([v.path])

    def step(self,response=None):
        f=self.v.f
        return request(f.root,f.policy_file,f.digest,f.state_dir,response=response,node=fixture.fixture.NODE)

    def response(self,r,path=None,content=None):
        return {"schema":"quest-repair-response-v1","request_sha256":r["request_sha256"],
                "proposal":{"summary":"fixture proposal, not real AI",
                            "replacements":[{"path":path or self.v.path,"content":content or json.dumps(self.v.pack)}]}}

    def test_exchange_commit_retest_handoff(self):
        f=self.v.f
        r=self.step()
        self.assertEqual(r["gate"],"EXTERNAL_AI_PENDING",repr(r))
        self.assertEqual(r["request"]["head_sha"],f.initial)
        self.assertEqual(r["request"]["allowed_paths"],[self.v.path])
        self.assertEqual(r["request"]["attempt"],1)
        response=self.response(r)
        out=self.step(response)
        self.assertEqual(out["gate"],"LOCAL_RETEST_COMPLETE",repr(out))
        self.assertEqual(out["report"]["status"],"PASS",repr(out))
        self.assertEqual(f.git("diff","--name-only",f.initial,out["head_sha"]),self.v.path)
        self.assertEqual(self.step()["gate"],"INDEPENDENT_QA_PENDING")
        self.assertEqual(self.step(response)["gate"],"HOLD")
        self.assertFalse(out["merge_authorized"])

    def test_bad_scope_and_stale_token_no_commit(self):
        f=self.v.f;r=self.step()
        invalid=self.response(r,path="scripts/cooperation/controller.py")
        self.assertEqual(self.step(invalid)["gate"],"HOLD")
        stale=self.response(r);stale["request_sha256"]="0"*64
        self.assertEqual(self.step(stale)["reason"],"STALE_OR_INVALID_RESPONSE")
        self.assertEqual(f.git("rev-parse","HEAD"),f.initial)
        self.assertEqual(self.step()["request"]["attempt"],1)

    def test_wrong_repair_repeated_failure_holds(self):
        r=self.step()
        broken=json.loads(json.dumps(self.v.pack))
        broken["challenges"]["q1"]["rule"]["accept"]=["Still wrong"]
        out=self.step(self.response(r,content=json.dumps(broken)))
        self.assertEqual(out["report"]["status"],"FAIL",repr(out))
        self.assertEqual(self.step()["reason"],"REPEATED_FAILURE")
