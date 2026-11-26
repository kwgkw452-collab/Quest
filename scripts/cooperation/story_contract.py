"""Mechanical layout and save namespace contracts; not visual or legacy-save QA."""
import re

def check(pack,spec):
    errors=[]
    if spec.get("layout") is not None:
        layout=spec["layout"]
        if not isinstance(layout,dict) or set(layout)!={"width","height","safeBottom","subjects"} or [layout.get(k) for k in ("width","height","safeBottom")]!=[1560,720,108]:
            errors.append("LAYOUT_CONTRACT")
        else:
            subjects=layout["subjects"]
            if not isinstance(subjects,dict) or set(subjects)!=set(spec["assets"]):
                errors.append("SUBJECT_REGISTRY")
            else:
                for asset,boxes in subjects.items():
                    if not isinstance(boxes,list) or not boxes:
                        errors.append("SUBJECT_BOX_MISSING:"+asset);continue
                    for box in boxes:
                        if not isinstance(box,list) or len(box)!=4 or any(type(n) is not int for n in box):
                            errors.append("SUBJECT_BOX_INVALID:"+asset);continue
                        x,y,w,h=box
                        if min(x,y)<0 or min(w,h)<=0 or x+w>1560 or y+h>612:
                            errors.append("SAFE_AREA:"+asset)
    if spec.get("saveContract") is not None:
        contract=spec["saveContract"]
        if not isinstance(contract,dict) or contract.get("schemaVersion")!=1 or contract.get("storyId")!=pack.get("id"):
            errors.append("SAVE_IDENTITY")
        else:
            keys=pack.get("saveKeys",{})
            if keys!=contract.get("keys") or any(not k.startswith(pack["id"].lower()+".") or v not in ("boolean","string","number") for k,v in keys.items()):
                errors.append("SAVE_NAMESPACE")
    return errors
