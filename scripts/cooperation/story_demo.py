"""Runnable fictional Story demonstration, no remote writes, no real AI claim.
Uses production-facing CLI interfaces rather than reimplementing validation or repair.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import zlib
from quest_operate import prepare, operate
from run_cycle import head, git

def png():
    def chunk(t,d):
        return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
    return b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",1560,720,8,2,0,0,0))+chunk(b"IDAT",zlib.compress((b"\0"+b"\xff"*4680)*720))+chunk(b"IEND",b"")

def demonstrate(out):
    out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="quest-story-demo-") as tmp:
        top=Path(tmp);root=top/"candidate";root.mkdir()
        branch="automation/fictional-demo"
        git(root,"init","-b",branch);git(root,"config","user.name","Quest fixture");git(root,"config","user.email","fixture@example.invalid")
        git(root,"commit","--allow-empty","-m","fixture base");base=head(root)
        prefix="tests/cooperation/fictional/"
        asset=prefix+"demo.png";package=prefix+"demo-story.json"
        (root/prefix).mkdir(parents=True);(root/asset).write_bytes(png())
        q={"goalJa":"箱を見せてください。","modelEn":"Show me the box.","hints":["箱を見せてもらおう。","Show me を使おう。","Show me the box. と言おう。"],"rule":{"accept":["Show me the box."],"excludeExact":["Show me the book."]},"cases":[{"text":"Show me the box.","decision":"ACCEPT"},{"text":"Show me the book.","decision":"REJECT"},{"text":"rainbow","decision":"UNKNOWN"}]}
        source={"schema":"quest-story-authoring-v1","fictional":True,"id":"S098","title":"Synthetic demonstration only","scenes":[{"id":"scene01","graphic":asset,"communication":[dict(q,id="q1")]},{"id":"scene02","graphic":asset,"communication":[dict(q,id="q2")]}],"layout":{"width":1560,"height":720,"safeBottom":108,"subjects":{asset:[[10,20,100,200]]}},"saveContract":{"schemaVersion":1,"storyId":"S098","keys":{}}}
        prepared=prepare(source)
        broken=json.loads(json.dumps(prepared["pack"]))
        broken["challenges"]["q1"]["rule"]["accept"]=["Wrong"]
        (root/package).write_text(json.dumps(broken))
        git(root,"add","--",asset,package);git(root,"commit","-m","intentionally defective fictional Story")
        before=head(root)
        policy={"schema":"quest-cooperation-policy-v1","cost_mode":"chatgpt_subscription","fictional":True,"task_id":"demo","branch":branch,"base_sha":base,"initial_head":before,"allowed_paths":[package],"package_path":package,"approved_spec":prepared["spec"]}
        pf=top/"policy.json";pf.write_text(json.dumps(policy,sort_keys=True));digest=hashlib.sha256(pf.read_bytes()).hexdigest()
        args=(root,pf,digest,top/"state")
        offline={"fetch_tip":lambda _:None,"fetch":lambda _:[]}
        request=operate(*args,**offline)
        assert request["gate"]=="EXTERNAL_AI_PENDING",repr(request)
        token=request["request_sha256"]
        bad={"schema":"quest-repair-response-v1","request_sha256":token,"proposal":{"summary":"forbidden fixture","replacements":[{"path":"engine/core.js","content":"no"}]}}
        rejected=operate(*args,response=bad,**offline)
        assert rejected["gate"]=="HOLD" and head(root)==before,repr(rejected)
        proposal={"summary":"DETERMINISTIC TEST DOUBLE — NOT REAL AI","replacements":[{"path":package,"content":json.dumps(prepared["pack"])}]}
        response={"schema":"quest-repair-response-v1","request_sha256":token,"proposal":proposal}
        repaired=operate(*args,response=response,**offline)
        after=head(root)
        assert repaired["gate"]=="CI_RETEST_PENDING" and after!=before,repr(repaired)
        assert git(root,"diff","--name-only",before,after).decode().strip()==package
        assert any(e.get("report",{}).get("status")=="PASS" for e in repaired["history"]),repr(repaired)
        # No synthetic CI is passed off as real: local candidate remains CI pending.
        evidence={"schema":"quest-story-demo-v1","fictional":True,"real_ai":False,"real_remote_ci_for_fixture":False,"fixture_base":base,"fixture_before":before,"fixture_after":after,"changed_path":package,"gate":repaired["gate"],"independent_qa":"NOT_ASSESSED","merge_authorized":False,"request":request,"rejected":rejected,"response":response,"retest":repaired}
        for name,value in (("authoring.json",source),("prepared.json",prepared),("story-demo.json",evidence)):
            (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+"\n")
        print(json.dumps({k:v for k,v in evidence.items() if k not in ("request","response","rejected","retest")}))
        return evidence

if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("--out",required=True)
    demonstrate(p.parse_args().out)
