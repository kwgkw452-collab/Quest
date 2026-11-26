#!/usr/bin/env python3
"""Read-only, no-API handoff router. Never grants merge authorization."""
import argparse
import json
import os
import re
import sys


def route(machine, qa=None):
    """Produce an advisory next role; never a merge authorization."""
    if machine.get("schema") != "quest-free-qa-handoff-v1":
        raise ValueError("unrecognized machine report")
    if not re.fullmatch(r"[0-9a-f]{40}", str(machine.get("base_sha", ""))):
        raise ValueError("invalid base SHA")
    if not re.fullmatch(r"[0-9a-f]{40}", str(machine.get("head_sha", ""))):
        raise ValueError("invalid head SHA")
    if machine.get("production_merge") != "NOT_AUTHORIZED":
        raise ValueError("machine report must never authorize Production merge")
    if machine.get("independent_qa") != "NOT_ASSESSED":
        raise ValueError("machine guard cannot impersonate independent QA")
    status = machine.get("status")
    if status == "FAIL":
        if not machine.get("violations"):
            raise ValueError("FAIL report missing violations")
        return {"gate": "DEVELOPER_REPAIR", "target_sha": machine["head_sha"],
                "next_actor": "production_developer", "mergable": False}
    if status != "PASS" or machine.get("violations"):
        raise ValueError("inconsistent PASS/FAIL guard report")
    if qa is None:
        return {"gate": "INDEPENDENT_QA_PENDING", "target_sha": machine["head_sha"],
                "next_actor": "independent_qa", "mergable": False}
    if qa.get("schema") != "quest-independent-qa-verdict-v1":
        raise ValueError("invalid independent QA verdict schema")
    if qa.get("base_sha") != machine["base_sha"] or qa.get("head_sha") != machine["head_sha"]:
        return {"gate": "QA_SHA_STALE", "target_sha": machine["head_sha"],
                "next_actor": "independent_qa", "mergable": False}
    verdict = qa.get("verdict")
    if verdict == "FAIL":
        return {"gate": "QA_REPAIR_REQUIRED", "target_sha": machine["head_sha"],
                "next_actor": "production_developer", "mergable": False}
    if verdict != "PASS":
        return {"gate": "INDEPENDENT_QA_PENDING", "target_sha": machine["head_sha"],
                "next_actor": "independent_qa", "mergable": False}
    # Even a matching QA PASS is not independently authenticated by this script.
    # The Director must verify the actual source/identity of the QA decision.
    return {"gate": "DIRECTOR_REVIEW_PENDING", "target_sha": machine["head_sha"],
            "next_actor": "director", "mergable": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--machine", required=True)
    parser.add_argument("--qa")
    args = parser.parse_args(argv)
    try:
        with open(args.machine, encoding="utf-8") as fp:
            machine = json.load(fp)
        with open(args.qa, encoding="utf-8") as fp:
            qa = json.load(fp) if args.qa else None
    except (OSError, ValueError, TypeError) as exc:
        print(f"::error title=Handoff unreadable::{exc}", file=sys.stderr)
        return 2
    try:
        decision = route(machine, qa)
    except (ValueError, TypeError, AttributeError) as exc:
        print(f"::error title=Handoff rejected::{exc}", file=sys.stderr)
        return 2
    print(json.dumps(decision, sort_keys=True))
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as fp:
            fp.write("\\n### QA-to-developer routing (advisory only)\\n")
            fp.write(f"- Next gate: **{decision['gate']}**\\n")
            fp.write(f"- Next actor: {decision['next_actor']}\\n")
            fp.write(f"- Exact head SHA: \`{decision['target_sha']}\`\\n")
            fp.write("- Production merge authorization: **NOT GRANTED**\\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
