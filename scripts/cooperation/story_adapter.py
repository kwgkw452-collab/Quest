"""V5 read-only adapter: committed JSON and graphics; no candidate code execution."""
import json
import hashlib
import re
import struct
import zlib
import subprocess
import shutil
from pathlib import Path
from package_check import _read, PREFIX
from package_check import validate as legacy_validate
from story_contract import check as check_contract

def validate(root, commit, package_path, spec, node_path=None):
    if spec.get("schema") != "quest-v5-story-spec-v1":
        return legacy_validate(root, commit, package_path, spec, node_path)
    failures=[]; holds=[]; checked=[]
    def fail(code,path,message):
        failures.append({"code":code,"path":path,"message":message})
    def report():
        return {"schema":"quest-fictional-package-result-v1","head_sha":commit,
                "status":"HOLD" if holds else "FAIL" if failures else "PASS",
                "failures":failures,"holds":holds,"checked_paths":checked,
                "independent_qa":"NOT_ASSESSED","production_merge":"NOT_AUTHORIZED"}
    if spec.get("fictional") is not True or not re.fullmatch(r"[a-f0-9]{40}",commit):
        holds.append("UNAPPROVED_STORY_OR_SHA");return report()
    try:
        pack=json.loads(_read(root,commit,package_path))
        checked.append(package_path)
    except Exception:
        fail("PACKAGE_JSON",package_path,"invalid committed Story JSON");return report()
    try:
        assets=spec["assets"]
        if not isinstance(assets,list) or not assets or len(set(assets))!=len(assets):
            raise ValueError("invalid pinned assets")
        node=node_path or shutil.which("node")
        if not node:raise ValueError("Node unavailable")
        adapter=Path(__file__).with_name("story_adapter.cjs")
        import os
        p=subprocess.run([node,str(adapter)],input=json.dumps({"pack":pack,"spec":spec}).encode(),
                         capture_output=True,timeout=15,
                         env={k:v for k,v in os.environ.items() if k not in ("NODE_OPTIONS","NODE_PATH")})
        if p.returncode:raise ValueError("trusted reference runtime failed")
        errors=json.loads(p.stdout)
        if not errors:
            errors.extend(check_contract(pack,spec))
        for error in errors:fail("STORY_CONTRACT",package_path,error)
        for asset in assets:
            try:
                data=_read(root,commit,asset)
                if not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data)<33 or data[12:16]!=b"IHDR" or struct.unpack(">II",data[16:24])!=(1560,720):
                    raise ValueError("PNG header must declare 1560x720")
                offset=8; ended=False; count=0
                while offset+12<=len(data):
                    size=struct.unpack(">I",data[offset:offset+4])[0]
                    end=offset+12+size
                    if end>len(data):raise ValueError("truncated PNG chunk")
                    kind=data[offset+4:offset+8]
                    if zlib.crc32(data[offset+4:end-4])&0xffffffff != struct.unpack(">I",data[end-4:end])[0]:
                        raise ValueError("invalid PNG CRC")
                    count+=kind==b"IDAT"
                    offset=end
                    if kind==b"IEND":
                        ended=size==0 and offset==len(data)
                        break
                if not ended or not count:raise ValueError("incomplete PNG")
                checked.append(asset)
            except Exception as exc:fail("GRAPHIC_REFERENCE",asset,str(exc))
        for file, expected in spec.get("file_sha256", {}).items():
            if not isinstance(expected,str) or not re.fullmatch(r"[a-f0-9]{64}",expected):
                raise ValueError("invalid pinned hash")
            if hashlib.sha256(_read(root,commit,file)).hexdigest()!=expected:
                fail("SPEC_MISMATCH",file,"file content differs from fixed SHA-256")
        # Safe area requires human visual inspection; dimensions alone are not approval.
    except Exception as exc:
        holds.append(str(exc))
    return report()
