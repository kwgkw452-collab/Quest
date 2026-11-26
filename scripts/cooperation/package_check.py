#!/usr/bin/env python3
"""Read-only fictional Story Package checks against caller-supplied fixed criteria.

Never imports package code. Node receives JavaScript only through --check stdin.
This validator is intentionally limited to a non-production fixture namespace.
"""
import hashlib
import json
import os
from pathlib import PurePosixPath
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET

PREFIX = "tests/cooperation/fictional/"
PACKAGE_SCHEMA = "quest-fictional-story-package-v1"
SPEC_SCHEMA = "quest-fictional-approved-v1"


def _git(root, *args):
    return subprocess.run(["git", "-C", os.fspath(root), *args], check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          timeout=20).stdout


def _path(value):
    if not isinstance(value, str) or not value.startswith(PREFIX):
        raise ValueError("path must remain in isolated fictional namespace")
    p = PurePosixPath(value)
    if p.is_absolute() or any(x in ("", ".", "..") for x in value.split("/")):
        raise ValueError("unsafe package path")
    return value


def _read(root, commit, file):
    _path(file)
    entry = _git(root, "ls-tree", "-z", commit, "--", file).split(b"\0")[0]
    if not entry or entry.split(b"\t", 1)[-1].decode("utf-8") != file:
        raise ValueError("referenced file is absent from commit")
    kind = entry.split(b"\t", 1)[0].split()
    if kind[0] != b"100644" or kind[1] != b"blob":
        raise ValueError("reference must be a regular non-executable Git blob (100644)")
    data = _git(root, "show", f"{commit}:{file}")
    if len(data) > 1024 * 1024:
        raise ValueError("fixture exceeds 1 MiB limit")
    return data


def _invalid_constant(value):
    raise ValueError("non-JSON numeric constant: " + value)


def validate(root, commit, package_path, approved_spec, node_path=None):
    """Return exact-commit PASS/FAIL/HOLD; never mutates Git or candidate files.

    approved_spec must be an independently loaded/pinned dictionary. A path in the
    candidate package is never interpreted as an authority or specification.
    """
    failures, holds = [], []
    checked = []

    def fail(code, file, message):
        failures.append({"code": code, "path": str(file), "message": str(message)})

    def report():
        return {"schema": "quest-fictional-package-result-v1", "head_sha": commit,
                "status": "FAIL" if failures else "HOLD" if holds else "PASS",
                "failures": failures, "holds": holds, "checked_paths": checked,
                "independent_qa": "NOT_ASSESSED", "production_merge": "NOT_AUTHORIZED"}

    if not isinstance(commit, str) or not re.fullmatch(r"[a-f0-9]{40}", commit):
        holds.append("full immutable commit SHA is required")
        return report()
    try:
        if _git(root, "rev-parse", "--verify", commit + "^{commit}").decode().strip() != commit:
            raise ValueError("commit is not a commit object")
    except (subprocess.SubprocessError, ValueError, OSError) as exc:
        holds.append("candidate commit unavailable: " + str(exc))
        return report()
    if (not isinstance(approved_spec, dict) or approved_spec.get("schema") != SPEC_SCHEMA
            or approved_spec.get("fictional") is not True
            or not isinstance(approved_spec.get("scenes"), list)
            or not approved_spec["scenes"]):
        holds.append("trusted fictional specification is unavailable or malformed")
        return report()
    hashes = approved_spec.get("file_sha256", {})
    if (not isinstance(hashes, dict) or any(
            not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{64}", value)
            for value in hashes.values())):
        holds.append("trusted fixed file hashes are malformed")
        return report()
    try:
        for file in hashes:
            _path(file)
    except ValueError as exc:
        holds.append("trusted fixed file hash path malformed: " + str(exc))
        return report()
    try:
        _path(package_path)
        raw = _read(root, commit, package_path)
        package = json.loads(raw.decode("utf-8"), parse_constant=_invalid_constant)
        checked.append(package_path)
    except (ValueError, UnicodeError, subprocess.SubprocessError, OSError) as exc:
        fail("PACKAGE_JSON", package_path, exc)
        return report()
    if (not isinstance(package, dict) or package.get("schema") != PACKAGE_SCHEMA
            or package.get("fictional") is not True
            or package.get("story_id") != approved_spec.get("story_id")):
        fail("SPEC_MISMATCH", package_path, "fictional schema/identity differs from fixed criteria")
        return report()
    scenes = package.get("scenes")
    if not isinstance(scenes, list):
        fail("SCENE_NUMBER", package_path, "scenes must be an ordered list")
        return report()
    expected = approved_spec["scenes"]
    expected_numbers = [x.get("number") if isinstance(x, dict) else None for x in expected]
    if expected_numbers != list(range(1, len(expected) + 1)):
        holds.append("trusted specification scene sequence is malformed")
        return report()
    actual_numbers = [x.get("number") if isinstance(x, dict) else None for x in scenes]
    if actual_numbers != expected_numbers or any(type(n) is not int for n in actual_numbers):
        fail("SCENE_NUMBER", package_path, "scene count/order differs from fixed numbered scenes")
    node = node_path or shutil.which("node")
    checked_scripts = set()
    for index, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            fail("SCENE_FORMAT", package_path, f"scene index {index} is not an object")
            continue
        fixed = expected[index] if index < len(expected) else None
        if fixed is None:
            continue
        communication = scene.get("communication")
        if (not isinstance(communication, dict) or not isinstance(communication.get("goal"), str)
                or not communication["goal"] or not isinstance(communication.get("accept"), list)
                or not communication["accept"]
                or any(not isinstance(x, str) or not x for x in communication["accept"])):
            fail("COMMUNICATION_MISSING", package_path, f"scene {index + 1} needs goal and accept conditions")
        if communication != fixed.get("communication"):
            fail("SPEC_MISMATCH", package_path, f"scene {index + 1} communication differs from fixed criteria")
        for field in ("script", "graphic", "references"):
            if scene.get(field, [] if field == "references" else None) != fixed.get(field, [] if field == "references" else None):
                fail("SPEC_MISMATCH", package_path, f"scene {index + 1} {field} differs from fixed criteria")
        references = scene.get("references", [])
        if not isinstance(references, list):
            fail("FILE_REFERENCE", package_path, "references must be a list")
            references = []
        for field, file in [("script", scene.get("script")), ("graphic", scene.get("graphic"))] + [("reference", x) for x in references]:
            try:
                data = _read(root, commit, file)
                if file not in checked:
                    checked.append(file)
            except (ValueError, TypeError, UnicodeError, subprocess.SubprocessError, OSError) as exc:
                fail("GRAPHIC_REFERENCE" if field == "graphic" else "FILE_REFERENCE", file, exc)
                continue
            if field == "graphic":
                try:
                    if file.endswith(".svg"):
                        graphic = ET.fromstring(data)
                        if graphic.tag.split("}")[-1] != "svg":
                            raise ValueError("not an SVG document")
                    elif file.endswith(".png"):
                        if not data.startswith(b"\x89PNG\r\n\x1a\n"):
                            raise ValueError("invalid PNG signature")
                    else:
                        raise ValueError("fictional graphic must be SVG or PNG")
                except (ValueError, ET.ParseError) as exc:
                    fail("GRAPHIC_FORMAT", file, exc)
            if file.endswith((".js", ".mjs", ".cjs")) and file not in checked_scripts:
                checked_scripts.add(file)
                if not node:
                    holds.append("Node executable unavailable for JS syntax check")
                    continue
                try:
                    syntax = subprocess.run([node, "--check", "--input-type=" + ("commonjs" if file.endswith(".cjs") else "module")],
                                            input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                            timeout=10, env={k: v for k, v in os.environ.items()
                                                            if k not in ("NODE_OPTIONS", "NODE_PATH")})
                    if syntax.returncode:
                        fail("JS_SYNTAX", file, syntax.stderr.decode("utf-8", errors="replace")[:1000])
                except (subprocess.SubprocessError, OSError) as exc:
                    holds.append("JS syntax check unavailable: " + str(exc))
    for file, expected_hash in hashes.items():
        try:
            if hashlib.sha256(_read(root, commit, file)).hexdigest() != expected_hash:
                fail("SPEC_MISMATCH", file, "file content differs from fixed SHA-256")
        except (ValueError, TypeError, UnicodeError, subprocess.SubprocessError, OSError) as exc:
            fail("FILE_REFERENCE", file, exc)
    return report()
