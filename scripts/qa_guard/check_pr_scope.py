#!/usr/bin/env python3
"""Zero-cost, read-only PR scope guard for Eigo DE Quest.

Always compare the PR base commit and PR head commit. No GitHub write token,
external service, AI API, or proprietary dependency is required.
"""
import argparse
import json
import os
import re
import subprocess
import sys

STORY_LOCK = re.compile(r"(?i)(?<![a-z0-9])(?:s00[1-4]|st004)(?![0-9])")
AUDIO_LOCK = re.compile(r"(?i)(?:^|[/_.-])(?:audio(?![-_]?free(?:[/_.-]|$))|voice|bgm|sound|music|sfx|tts)")
AUDIO_FORMAT = re.compile(r"(?i)\.(?:mp3|wav|ogg|m4a|aac|flac|mid|midi)$")
GUARD_LOCK = re.compile(r"^(?:scripts/qa_guard/|\.github/workflows/qa-guard-free\.yml$|docs/approved/)", re.I)
EARLY_IMAGE = re.compile(r"(?i)^images/(?:00[1-4])/")
EARLY_DATA = re.compile(r"(?i)^(?:data|stories|story|scenes)/.*(?:s00[1-4]|00[1-4])(?:[/.\\_-]|$)")


def escape_actions(value):
    """GitHub Actions command-message escaping; reject newline injection."""
    return value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def reasons_for(path, bootstrap=False):
    """Return reasons a modification needs explicit Director decision."""
    path = path.replace("\\\\", "/").removeprefix("./")
    reasons = []
    if STORY_LOCK.search(path) or EARLY_IMAGE.search(path) or EARLY_DATA.search(path):
        reasons.append("S001-S004 freeze")
    if AUDIO_LOCK.search(path) or AUDIO_FORMAT.search(path):
        reasons.append("Audio/Voice freeze until S015")
    if not bootstrap and GUARD_LOCK.search(path):
        reasons.append("QA guard or Director-approved rules changed; require independent review")
    return reasons


def changed_paths(base, head):
    args = ["git", "diff", "--name-only", "-z", "--no-renames", base, head, "--"]
    process = subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return [p.decode("utf-8") for p in process.stdout.split(b"\0") if p]


def evaluate(paths, bootstrap=False):
    failures = []
    for path in paths:
        reasons = reasons_for(path, bootstrap=bootstrap)
        if reasons:
            failures.append((path, reasons))
    return failures


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="PR base SHA")
    parser.add_argument("--head", required=True, help="PR head SHA")
    parser.add_argument("--bootstrap", action="store_true", help="First installation only; audited by Director")
    parser.add_argument("--report-file", help="Write a deterministic QA handoff JSON file")
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[0-9a-f]{40}", args.base) or not re.fullmatch(r"[0-9a-f]{40}", args.head):
        parser.error("base and head must be complete commit SHAs")
    paths = changed_paths(args.base, args.head)
    problems = evaluate(paths, bootstrap=args.bootstrap)
    report = {
        "schema": "quest-free-qa-handoff-v1",
        "scope": "filename-diff-only",
        "base_sha": args.base,
        "head_sha": args.head,
        "status": "FAIL" if problems else "PASS",
        "independent_qa": "NOT_ASSESSED",
        "production_merge": "NOT_AUTHORIZED",
        "changed_count": len(paths),
        "violations": [
            {"path": path, "reasons": reasons, "action": "Restore frozen path; request Director exception if necessary"}
            for path, reasons in problems
        ],
        "next_action": (
            "Developer: repair the reported protected paths on the same PR, then rerun. "
            "Independent QA must independently verify the exact updated SHA."
            if problems else
            "Independent QA: review Story behavior and evidence at this SHA; do not infer independent PASS."
        ),
    }
    if args.report_file:
        with open(args.report_file, "w", encoding="utf-8") as handoff:
            json.dump(report, handoff, ensure_ascii=False, indent=2, sort_keys=True)
            handoff.write("\n")
    print(f"PR scope: {len(paths)} changed paths; {len(problems)} frozen-path violations")
    for path, reasons in problems:
        print(f"::error title=Frozen production scope::{escape_actions(path)}: {', '.join(reasons)}")
    # A deterministic, human-readable handoff in the PR's Actions summary.
    # This file is written by the trusted base guard when deployed.
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write("### Eigo DE Quest frozen-scope check\n\n")
            summary.write(f"- Result: **{'FAIL' if problems else 'PASS'}**\n")
            summary.write(f"- Examined: {len(paths)} changed file paths\n")
            summary.write(f"- Protected-path violations: {len(problems)}\n")
            summary.write(f"- Base SHA: \u0060{args.base}\u0060\n- Head SHA: \u0060{args.head}\u0060\n")
            if problems:
                summary.write("\\n#### Developer repair handoff\\n\\n")
                for path, reasons in problems:
                    safe_path = path.replace("\\n", "\\u000a").replace("\\r", "\\u000d").replace("`", "'")
                    summary.write(f"- \`{safe_path}\`: {', '.join(reasons)} — restore protected change or escalate to Director\\n")
            summary.write(f"\\n**Next:** {report['next_action']}\\n")
            summary.write("\nA scope PASS is not independent QA PASS or Production merge authorization.\n")
    if problems:
        print("FAIL. Separate the protected changes; Director authorization is required.")
        return 1
    print("PASS: no S001-S004 or Audio/Voice paths changed in this diff.")
    print("Note: this is a path-scope check, not a behavioral QA PASS or Director merge approval.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
