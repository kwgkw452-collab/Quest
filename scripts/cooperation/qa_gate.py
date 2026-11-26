#!/usr/bin/env python3
"""External QA publisher verification with a pinned public SSH key, no signing key.

The repair process never receives the QA private key. Local tests use disposable
keys; no real QA identity or approval is provisioned by this module.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

from controller import decision, route

NAMESPACE = "quest-independent-qa-v1"


def canonical(payload):
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def verify_and_route(machine, qa, signers, signers_digest, candidate_repo, *, producer, repair_actor):
    machine_gate = route(machine)
    if machine_gate["gate"] != "INDEPENDENT_QA_PENDING":
        return machine_gate
    try:
        source = Path(signers).resolve()
        root = Path(candidate_repo).resolve()
        if source == root or root in source.parents:
            return decision("HOLD", "CANDIDATE_LOCAL_QA_TRUST")
        raw = source.read_bytes()
        if hashlib.sha256(raw).hexdigest() != signers_digest:
            return decision("HOLD", "QA_SIGNERS_DIGEST_CHANGED")
        if not isinstance(qa, dict) or set(qa) != {"payload", "signature"}:
            return decision("HOLD", "UNAUTHENTICATED_QA")
        payload, signature = qa["payload"], qa["signature"]
        actor = payload.get("reviewer")
        if not isinstance(actor, str) or not actor or actor in (producer, repair_actor):
            return decision("HOLD", "QA_SELF_APPROVAL")
        if not isinstance(signature, str) or len(signature) > 16384:
            return decision("HOLD", "INVALID_QA_SIGNATURE")
        with tempfile.TemporaryDirectory(prefix="quest-qa-verify-") as td:
            folder = Path(td)
            # Verify the pinned bytes, not a mutable pathname after the hash check.
            (folder/"signers").write_bytes(raw)
            (folder/"verdict.sig").write_text(signature)
            result = subprocess.run(["ssh-keygen", "-Y", "verify", "-f", str(folder/"signers"),
                                     "-I", actor, "-n", NAMESPACE, "-s", str(folder/"verdict.sig")],
                                    input=canonical(payload), capture_output=True, timeout=10)
        if result.returncode:
            return decision("HOLD", "INVALID_QA_SIGNATURE")
        if payload.get("schema") != "quest-independent-qa-verdict-v1":
            return decision("HOLD", "UNKNOWN_QA_SCHEMA")
        if payload.get("base_sha") != machine["base_sha"] or payload.get("head_sha") != machine["head_sha"]:
            return decision("HOLD", "QA_SHA_STALE")
        if payload.get("verdict") == "FAIL":
            return decision("QA_REPAIR_REQUIRED", target_sha=machine["head_sha"], reviewer=actor)
        if payload.get("verdict") != "PASS":
            return decision("HOLD", "QA_NOT_PASS")
        return decision("DIRECTOR_REVIEW_PENDING", target_sha=machine["head_sha"], reviewer=actor,
                        note="Verified publisher signature; Director still decides integration")
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError):
        return decision("HOLD", "QA_TRUST_NOT_ESTABLISHED")


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--machine',required=True);p.add_argument('--qa',required=True)
    p.add_argument('--signers',required=True);p.add_argument('--signers-sha256',required=True)
    p.add_argument('--repo',required=True);p.add_argument('--producer',required=True);p.add_argument('--repair-actor',required=True)
    p.add_argument('--out',required=True);a=p.parse_args()
    output=Path(a.out).resolve();root=Path(a.repo).resolve()
    if output==root or root in output.parents:raise SystemExit('Output must be external')
    try:
        r=verify_and_route(json.loads(Path(a.machine).read_text()),json.loads(Path(a.qa).read_text()),
                           a.signers,a.signers_sha256,a.repo,producer=a.producer,repair_actor=a.repair_actor)
    except Exception as exc:r=decision('HOLD',str(exc))
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
    return 2 if r['gate']=='HOLD' else 0


if __name__=='__main__':sys.exit(main())
