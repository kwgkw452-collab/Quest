import json
import unittest
import test_story_adapter as fixture
from story_format import convert
from story_adapter import validate

class FormatTests(unittest.TestCase):
    def test_authoring_conversion_runs_existing_engine(self):
        v=fixture.V5Tests("test_normal");v.setUp();self.addCleanup(v.doCleanups)
        q=v.pack["challenges"]["q1"]
        src={"schema":"quest-story-authoring-v1","fictional":True,"id":"S098","title":"FICTIONAL ONLY","scenes":[
            {"id":"scene01","graphic":v.asset,"lines":[{"speaker":"Pico","text":"Look!","supportText":"見て！"}],"communication":[dict(q,id="q10",cases=v.spec["judgeCases"]["q1"])]},
            {"id":"scene02","graphic":v.asset,"communication":[dict(q,id="q2",cases=v.spec["judgeCases"]["q2"])]}]}
        pack,spec=convert(src)
        v.f.put(v.path,json.dumps(pack));sha=v.f.commit()
        report=validate(v.f.root,sha,v.path,json.loads(json.dumps(spec,sort_keys=True)),fixture.fixture.NODE)
        self.assertEqual(report["status"],"PASS",repr(report))
        self.assertEqual(pack["scenes"]["scene02"]["steps"][-1],{"type":"end"})
        self.assertEqual(spec["challengeOrder"],["q10","q2"])
        src["fictional"]=False
        with self.assertRaisesRegex(ValueError,"FICTIONAL_AUTHORING_ONLY"):convert(src)
