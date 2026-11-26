"""Actual Git/Node integration; proposals are deterministic test doubles."""
import hashlib
import json
import struct
import zlib
import unittest
import test_run_cycle as fixture
from story_adapter import validate
from run_cycle import run

class V5Tests(unittest.TestCase):
    def setUp(self):
        self.f=fixture.RunCycleTests("test_dirty_tree_holds_without_ai")
        self.f.setUp()
        self.addCleanup(self.f.doCleanups)
        f=self.f
        self.asset=fixture.PREFIX+"v5.png"
        self.path=fixture.PREFIX+"v5-story.json"
        def chunk(t,d):
            return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
        png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",1560,720,8,2,0,0,0))+chunk(b"IDAT",zlib.compress((b"\0"+b"\xff"*4680)*720))+chunk(b"IEND",b"")
        (f.root/self.asset).write_bytes(png)
        q={"goalJa":"箱を見せてください。","modelEn":"Show me the box.","hints":["箱を見せてもらおう。","Show me を使おう。","Show me the box. と言おう。"],"rule":{"accept":["Show me the box."],"excludeExact":["Show me the book."]}}
        self.pack={"schemaVersion":1,"id":"S099","title":"FICTIONAL ONLY","entry":"scene01","sceneOrder":["scene01","scene02"],"scenes":{"scene01":{"steps":[{"type":"scene","asset":self.asset},{"type":"challenge","id":"q1"},{"type":"goto","to":"scene02"}]},"scene02":{"steps":[{"type":"scene","asset":self.asset},{"type":"challenge","id":"q2"},{"type":"end"}]}},"challenges":{"q1":q,"q2":q},"saveKeys":{}}
        cases=[{"text":"Show me the box.","decision":"ACCEPT"},{"text":"Show me the book.","decision":"REJECT"},{"text":"rainbow","decision":"UNKNOWN"}]
        self.spec={"schema":"quest-v5-story-spec-v1","fictional":True,"pack":self.pack,"assets":[self.asset,self.asset],"judgeCases":{"q1":cases,"q2":cases}}
        # Unique asset registry; scene display sequence can reuse a graphic.
        self.spec["assets"]=[self.asset]
        self.spec["sceneAssets"]=[self.asset,self.asset]
        f.put(self.path,json.dumps(self.pack))
        f.commit()
    def check(self):
        f=self.f
        return validate(f.root,f.git("rev-parse","HEAD"),self.path,self.spec,fixture.NODE)
    def test_normal(self):
        self.assertEqual(self.check()["status"],"PASS")
    def test_fault_repair_retest(self):
        f=self.f
        broken=json.loads(json.dumps(self.pack))
        broken["challenges"]["q1"]["rule"]["accept"]=["Wrong"]
        f.put(self.path,json.dumps(broken));f.commit()
        self.assertEqual(self.check()["status"],"FAIL")
        f.package_path=self.path;f.spec=self.spec;f.policy([self.path])
        calls=[]
        def proposal(task):
            calls.append(task)
            return f.response({self.path:json.dumps(self.pack)})
        r=run(f.root,f.policy_file,f.digest,f.state_dir,runner=proposal,node_path=fixture.NODE)
        self.assertEqual(r["gate"],"INDEPENDENT_QA_PENDING")
        self.assertEqual(len(calls),1)
        self.assertEqual(f.git("diff","--name-only",f.initial,r["head_sha"]),self.path)
        self.assertEqual([e["report"]["status"] for e in r["events"] if e["stage"]=="validate"],["FAIL","PASS"])
        self.assertFalse(r["merge_authorized"])
    def test_missing_graphic(self):
        f=self.f
        (f.root/self.asset).unlink();f.commit()
        self.assertEqual(self.check()["status"],"FAIL")
    def test_bad_judge_corpus(self):
        self.spec["judgeCases"]["q1"][0]["decision"]="REJECT"
        self.assertEqual(self.check()["status"],"FAIL")
    def test_no_end(self):
        f=self.f
        self.pack["scenes"]["scene02"]["steps"][-1]={"type":"goto","to":"scene01"}
        f.put(self.path,json.dumps(self.pack));f.commit()
        self.assertEqual(self.check()["status"],"FAIL")
