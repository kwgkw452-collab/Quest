"""Translate a fictional authoring worksheet into the existing V2 Story schema.
No production write, engine registration or implicit approval.
"""
import copy
import re

def convert(source):
    if not isinstance(source,dict) or source.get("schema")!="quest-story-authoring-v1" or source.get("fictional") is not True:
        raise ValueError("FICTIONAL_AUTHORING_ONLY")
    sid=source["id"]
    if not re.fullmatch(r"S(?:00[89]|0[1-9][0-9]|100)",sid):
        raise ValueError("STORY_SCOPE")
    scenes=source["scenes"]
    if not isinstance(scenes,list) or not scenes:raise ValueError("NO_SCENES")
    keys=[s["id"] for s in scenes]
    if len(set(keys))!=len(keys):raise ValueError("DUPLICATE_SCENE")
    pack={"schemaVersion":1,"id":sid,"title":source["title"],"entry":keys[0],"sceneOrder":keys,"scenes":{},"challenges":{},"saveKeys":{}}
    assets=[];order=[];cases={}
    for i,s in enumerate(scenes):
        asset=s["graphic"]
        if not isinstance(asset,str) or not asset.startswith("tests/cooperation/fictional/") or any(x in ("",".","..") for x in asset.split("/")):
            raise ValueError("GRAPHIC_SCOPE")
        assets.append(asset);steps=[{"type":"scene","asset":asset}]
        for line in s.get("lines",[]):
            steps.append({"type":"line","speaker":line.get("speaker"),"text":line["text"],**({"supportText":line["supportText"]} if "supportText" in line else {})})
        for q in s.get("communication",[]):
            qid=q["id"]
            if qid in cases:raise ValueError("DUPLICATE_CHALLENGE")
            order.append(qid);cases[qid]=copy.deepcopy(q["cases"])
            pack["challenges"][qid]={k:copy.deepcopy(q[k]) for k in ("goalJa","modelEn","hints","rule")}
            steps.append({"type":"challenge","id":qid})
        steps.append({"type":"goto","to":keys[i+1]} if i+1<len(keys) else {"type":"end"})
        pack["scenes"][s["id"]]={"steps":steps}
    return pack,{"schema":"quest-v5-story-spec-v1","fictional":True,"pack":copy.deepcopy(pack),
                 "assets":list(dict.fromkeys(assets)),"sceneAssets":assets,"challengeOrder":order,"judgeCases":cases}
