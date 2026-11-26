"""External Director-pinned QA context. No key creation or approval authority."""
import hashlib
import json
import re
from pathlib import Path
from controller import Hold

def load_trust(file,digest,candidate):
    path=Path(file).resolve();root=Path(candidate).resolve()
    if path==root or root in path.parents:raise Hold("CANDIDATE_LOCAL_QA_TRUST")
    raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=digest:raise Hold("QA_TRUST_DIGEST_CHANGED")
    p=json.loads(raw)
    fields={"schema","repository","pr","expectations","trust_commit","signers_sha256","reviewers","producer","repair_actor","policy_sha256"}
    if set(p)!=fields or p["schema"]!="quest-qa-trust-v1" or p["repository"]!="kwgkw452-collab/Quest":raise Hold("QA_TRUST_SCHEMA")
    if type(p["pr"]) is not int or p["pr"]<1 or not isinstance(p["expectations"],str) or not p["expectations"]:raise Hold("QA_TRUST_CONTEXT")
    if not re.fullmatch(r"[0-9a-f]{40}",p["trust_commit"]) or any(not re.fullmatch(r"[0-9a-f]{64}",p[k]) for k in ("signers_sha256","policy_sha256")):raise Hold("QA_TRUST_PIN")
    if not isinstance(p["reviewers"],list) or not p["reviewers"] or any(not isinstance(r,str) or not r for r in p["reviewers"]):raise Hold("QA_REVIEWERS")
    if not all(isinstance(p[k],str) and p[k] for k in ("producer","repair_actor")) or set(p["reviewers"]) & {p["producer"],p["repair_actor"]}:raise Hold("QA_ROLE_CONFLICT")
    return p

def check_context(qa,trust,policy_digest):
    payload=qa.get("payload",{})
    if trust["policy_sha256"]!=policy_digest:raise Hold("QA_POLICY_MISMATCH")
    for k in ("repository","pr","expectations","trust_commit"):
        if payload.get(k)!=trust[k]:raise Hold("QA_CONTEXT_MISMATCH:"+k)
    if payload.get("reviewer") not in trust["reviewers"]:raise Hold("QA_REVIEWER_NOT_ALLOWED")
