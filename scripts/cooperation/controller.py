"""Bounded, fail-closed local coordination; never grants Production merge.

State and QA keys belong outside the candidate repository. The signature API
establishes key provenance, not the professional adequacy of a QA review.
"""
from contextlib import contextmanager
import hashlib
import hmac
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys

# Reuse the existing frozen-scope rules without changing their implementation.
_QA_GUARD = Path(__file__).resolve().parents[1] / "qa_guard"
if str(_QA_GUARD) not in sys.path:
    sys.path.insert(0, str(_QA_GUARD))
from check_pr_scope import reasons_for

_SHA = re.compile(r"[a-f0-9]{40}")
_SPEECH = re.compile(r"(?i)(?:^|[/_.-])(?:speech|microphone|synthesis|recognition)(?:[/_.-]|$)")
_PROTECTED = (".git/", ".github/", "scripts/", "docs/approved/", "specs/")


class Hold(RuntimeError):
    """Stop this task only; other task state remains usable."""


def decision(gate, reason=None, **extra):
    return {"gate": gate, "merge_authorized": False,
            **({"reason": reason} if reason else {}), **extra}


def safe_path(value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise Hold("INVALID_PATH")
    p = PurePosixPath(value)
    if p.is_absolute() or value.startswith("-") or any(x in ("", ".", "..") for x in value.split("/")):
        raise Hold("INVALID_PATH")
    lower = value.lower()
    if (reasons_for(value) or _SPEECH.search(value)
            or lower.startswith(_PROTECTED)
            or lower in tuple(p.rstrip("/") for p in _PROTECTED)):
        raise Hold("FORBIDDEN_PATH: " + value)
    # Test assertions are immutable; a designated synthetic fixture is input data.
    if value.startswith("tests/") and not value.startswith("tests/cooperation/fictional/"):
        raise Hold("TEST_EXPECTATIONS_PROTECTED: " + value)
    return value


def _sha(value):
    if not isinstance(value, str) or not _SHA.fullmatch(value):
        raise Hold("INVALID_SHA")
    return value


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


class Controller:
    """One externally stored task identity, guarded by an exclusive lock."""
    def __init__(self, state_dir, repository, task_id, branch, base_sha, initial_head,
                 *, cost_mode="chatgpt_subscription", max_attempts=3):
        self.root = Path(repository).resolve()
        self.dir = Path(state_dir).resolve()
        if self.dir == self.root or self.root in self.dir.parents:
            raise Hold("CANDIDATE_LOCAL_STATE_FORBIDDEN")
        if not isinstance(task_id, str) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,80}", task_id):
            raise Hold("INVALID_TASK_ID")
        if not isinstance(branch, str) or branch in ("main", "master", "s005-fixed-195-stage-clean-test") or not branch.startswith("automation/"):
            raise Hold("PRODUCTION_OR_UNSCOPED_BRANCH")
        if cost_mode != "chatgpt_subscription" or max_attempts != 3:
            raise Hold("COST_OR_ATTEMPT_POLICY_NOT_ALLOWED")
        self.identity = {"repository": str(self.root), "task_id": task_id,
                         "branch": branch, "base_sha": _sha(base_sha),
                         "initial_head": _sha(initial_head),
                         "cost_mode": cost_mode, "max_attempts": max_attempts}
        key = hashlib.sha256(_canonical({"repository": str(self.root), "task": task_id})).hexdigest()
        self.dir.mkdir(parents=True, exist_ok=True)
        self.file = self.dir / (key + ".json")
        lockkey = hashlib.sha256(_canonical({"repository": str(self.root), "branch": branch})).hexdigest()
        self.lockfile = self.dir / (lockkey + ".lock")
        self._locked = False

    @contextmanager
    def locked(self):
        if self._locked:
            raise Hold("CONCURRENT_REPAIR")
        try:
            fd = os.open(self.lockfile, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            raise Hold("CONCURRENT_REPAIR") from None
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        self._locked = True
        try:
            yield self
        finally:
            self._locked = False
            self.lockfile.unlink()

    def _load(self):
        if not self._locked:
            raise Hold("LOCK_REQUIRED")
        if self.file.is_symlink():
            raise Hold("STATE_SYMLINK_FORBIDDEN")
        if not self.file.exists():
            return {"identity": self.identity, "head": self.identity["initial_head"],
                    "attempts": [], "allowed_paths": None}
        try:
            state = json.loads(self.file.read_text())
            if state["identity"] != self.identity:
                raise Hold("TASK_IDENTITY_CHANGED")
            if not isinstance(state["attempts"], list) or len(state["attempts"]) > 3:
                raise Hold("CORRUPT_STATE")
            _sha(state["head"])
            scope = state["allowed_paths"]
            if scope is not None and (not isinstance(scope, list) or any(not isinstance(p, str) for p in scope)):
                raise Hold("CORRUPT_STATE")
            for attempt in state["attempts"]:
                if not isinstance(attempt, dict):
                    raise Hold("CORRUPT_STATE")
                _sha(attempt["before_head"])
                if attempt["after_head"] is not None:
                    _sha(attempt["after_head"])
                if not re.fullmatch(r"[a-f0-9]{64}", attempt["fingerprint"]):
                    raise Hold("CORRUPT_STATE")
                if not isinstance(attempt["fail_ids"], list) or not attempt["fail_ids"]:
                    raise Hold("CORRUPT_STATE")
            return state
        except (OSError, ValueError, KeyError, TypeError):
            raise Hold("CORRUPT_STATE") from None

    def _save(self, state):
        temp = self.file.with_suffix(".tmp")
        if temp.exists() or temp.is_symlink():
            raise Hold("UNEXPECTED_STATE_TEMP_FILE")
        fd = os.open(temp, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w") as out:
            json.dump(state, out, sort_keys=True, indent=2)
            out.write("\n")
            out.flush()
            os.fsync(out.fileno())
        os.replace(temp, self.file)

    def authorize_attempt(self, branch, head, fail_ids, allowed_paths):
        try:
            state = self._load()
            if branch != self.identity["branch"]:
                raise Hold("BRANCH_CHANGED")
            if _sha(head) != state["head"]:
                raise Hold("HEAD_CHANGED")
            if not isinstance(fail_ids, list) or not fail_ids or any(not isinstance(x, str) or not x for x in fail_ids):
                raise Hold("UNKNOWN_FAILURE")
            if not isinstance(allowed_paths, list) or not allowed_paths:
                raise Hold("EMPTY_REPAIR_SCOPE")
            scope = sorted(set(safe_path(p) for p in allowed_paths))
            if state["allowed_paths"] is not None and state["allowed_paths"] != scope:
                raise Hold("REPAIR_SCOPE_CHANGED")
            if len(state["attempts"]) >= self.identity["max_attempts"]:
                raise Hold("MAX_REPAIRS_REACHED")
            fingerprint = hashlib.sha256(_canonical(sorted(set(fail_ids)))).hexdigest()
            if any(a["fingerprint"] == fingerprint for a in state["attempts"]):
                raise Hold("REPEATED_FAILURE")
            if state["attempts"] and state["attempts"][-1].get("after_head") is None:
                raise Hold("UNFINISHED_ATTEMPT")
            state["allowed_paths"] = scope
            state["attempts"].append({"before_head": head, "fingerprint": fingerprint,
                                      "fail_ids": sorted(set(fail_ids)), "after_head": None})
            state["gate"] = "REPAIR_RUNNING"
            self._save(state)
            return decision("REPAIR_RUNNING", attempt=len(state["attempts"]), allowed_paths=scope)
        except Hold as exc:
            # A task-scoped HOLD is persisted without mutating another task's state.
            if self._locked:
                try:
                    state = self._load()
                    state["gate"], state["hold_reason"] = "HOLD", str(exc)
                    self._save(state)
                except Hold:
                    pass
            return decision("HOLD", str(exc))

    def record_repair(self, before_head, after_head):
        state = self._load()
        before_head, after_head = _sha(before_head), _sha(after_head)
        if (not state["attempts"] or state["head"] != before_head
                or state["attempts"][-1]["before_head"] != before_head
                or state["attempts"][-1]["after_head"] is not None or before_head == after_head):
            raise Hold("INVALID_REPAIR_TRANSITION")
        state["attempts"][-1]["after_head"] = after_head
        state["head"] = after_head
        state["gate"] = "RETEST_REQUIRED"
        self._save(state)
        return state


def sign_qa(payload, key):
    """Only an independent publisher holding the external key may call this."""
    if not isinstance(key, bytes) or len(key) < 32:
        raise Hold("QA_KEY_TOO_SHORT")
    return {"payload": payload, "signature": hmac.new(key, _canonical(payload), hashlib.sha256).hexdigest()}


def route(machine, qa=None, *, qa_key=None, approved_reviewers=(), producer="producer", repair_actor="repair"):
    """Authenticate exact-SHA QA evidence; the last gate is Director review only."""
    try:
        if not isinstance(machine, dict) or machine.get("schema") not in ("quest-free-qa-handoff-v1", "quest-cooperation-machine-v1"):
            return decision("HOLD", "UNKNOWN_MACHINE_REPORT")
        base, head = _sha(machine.get("base_sha")), _sha(machine.get("head_sha"))
        if machine.get("production_merge") != "NOT_AUTHORIZED" or machine.get("independent_qa") != "NOT_ASSESSED":
            return decision("HOLD", "FORGED_MACHINE_AUTHORITY")
        if machine.get("status") == "FAIL":
            return decision("DEVELOPER_REPAIR", target_sha=head) if machine.get("violations") else decision("HOLD", "MISSING_FAILURE_EVIDENCE")
        if machine.get("status") != "PASS" or machine.get("violations"):
            return decision("HOLD", "UNKNOWN_MACHINE_RESULT")
        if qa is None:
            return decision("INDEPENDENT_QA_PENDING", target_sha=head)
        if not isinstance(qa_key, bytes) or len(qa_key) < 32:
            return decision("HOLD", "QA_TRUST_NOT_ESTABLISHED")
        if not isinstance(qa, dict) or not isinstance(qa.get("payload"), dict):
            return decision("HOLD", "UNAUTHENTICATED_QA")
        payload = qa["payload"]
        expected = hmac.new(qa_key, _canonical(payload), hashlib.sha256).hexdigest()
        signature = qa.get("signature")
        if not isinstance(signature, str) or not hmac.compare_digest(signature, expected):
            return decision("HOLD", "INVALID_QA_SIGNATURE")
        if payload.get("schema") != "quest-independent-qa-verdict-v1":
            return decision("HOLD", "UNKNOWN_QA_SCHEMA")
        if payload.get("base_sha") != base or payload.get("head_sha") != head:
            return decision("HOLD", "QA_SHA_STALE", target_sha=head)
        actor = payload.get("reviewer")
        if not isinstance(actor, str) or actor not in approved_reviewers or actor in (producer, repair_actor):
            return decision("HOLD", "QA_SELF_APPROVAL_OR_UNKNOWN_REVIEWER")
        if payload.get("verdict") == "FAIL":
            return decision("QA_REPAIR_REQUIRED", target_sha=head)
        if payload.get("verdict") != "PASS":
            return decision("HOLD", "QA_NOT_PASS", target_sha=head)
        return decision("DIRECTOR_REVIEW_PENDING", target_sha=head, reviewer=actor)
    except (Hold, ValueError, KeyError, TypeError, AttributeError):
        return decision("HOLD", "INVALID_EVIDENCE")
