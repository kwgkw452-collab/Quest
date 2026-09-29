#!/usr/bin/env python3
"""Localhost-only dev Candidate Store for Growing Recognition Knowledge V1."""

import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = int(os.environ.get("EIGO_CANDIDATE_STORE_PORT", "8001"))
STORE_FILE = os.environ.get("EIGO_CANDIDATE_STORE_FILE", "/tmp/EigoDEQuest-central-candidates.json")
LOCK = threading.Lock()


def candidate_key(value):
    candidate = value.get("candidate") or {}
    return json.dumps([
        str(value.get("taskId", "")), str(value.get("rawExpression", "")).strip().lower(),
        str(candidate.get("slotId", "")), candidate.get("value"),
        str(candidate.get("conceptId", "")), str(candidate.get("token", "")),
    ], ensure_ascii=False, separators=(",", ":"))


def clean_observation(value):
    candidate = value.get("candidate") if isinstance(value, dict) else None
    if not isinstance(candidate, dict):
        return None
    cleaned_candidate = {}
    if "slotId" in candidate and "value" in candidate:
        cleaned_candidate = {"slotId": str(candidate["slotId"]), "value": candidate["value"]}
    elif "conceptId" in candidate:
        cleaned_candidate = {"conceptId": str(candidate["conceptId"])}
    elif "token" in candidate:
        cleaned_candidate = {"token": str(candidate["token"])}
    task_id = str(value.get("taskId", "")).strip()
    expression = str(value.get("rawExpression", "")).strip()
    if not task_id or not expression or not cleaned_candidate:
        return None
    return {"taskId": task_id, "rawExpression": expression, "candidate": cleaned_candidate}


def load_items():
    try:
        with open(STORE_FILE, "r", encoding="utf-8") as source:
            value = json.load(source)
            return value if isinstance(value, list) else []
    except (OSError, ValueError):
        return []


def save_items(items):
    temporary = STORE_FILE + ".tmp"
    with open(temporary, "w", encoding="utf-8") as output:
        json.dump(items, output, ensure_ascii=False, separators=(",", ":"))
    os.replace(temporary, STORE_FILE)


def record_observation(value):
    observation = clean_observation(value)
    if not observation:
        raise ValueError("invalid_observation")
    with LOCK:
        items = load_items()
        key = candidate_key(observation)
        existing = next((item for item in items if candidate_key(item) == key), None)
        if existing:
            existing["observationCount"] = int(existing.get("observationCount", 0)) + 1
        else:
            existing = dict(observation)
            existing.update({"observationCount": 1, "reviewStatus": "pending", "promotionStatus": "not_ready"})
            items.append(existing)
        save_items(items)
        return items


def update_review(value):
    observation = clean_observation(value)
    if not observation:
        raise ValueError("invalid_candidate")
    with LOCK:
        items = load_items()
        existing = next((item for item in items if candidate_key(item) == candidate_key(observation)), None)
        if not existing:
            raise KeyError("candidate_not_found")
        review_status = value.get("reviewStatus")
        promotion_status = value.get("promotionStatus")
        if review_status not in (None, "approved", "rejected"):
            raise ValueError("invalid_review_status")
        if promotion_status not in (None, "ready"):
            raise ValueError("invalid_promotion_status")
        if review_status is None and promotion_status is None:
            raise ValueError("missing_review_operation")
        if review_status in ("approved", "rejected"):
            existing["reviewStatus"] = review_status
            existing["promotionStatus"] = "not_ready"
        if promotion_status == "ready":
            if existing.get("reviewStatus") != "approved":
                raise ValueError("candidate_not_approved")
            key = candidate_key(existing)
            conflict = any(
                item.get("taskId") == existing.get("taskId")
                and str(item.get("rawExpression", "")).strip().lower()
                == str(existing.get("rawExpression", "")).strip().lower()
                and candidate_key(item) != key
                for item in items
            )
            if conflict:
                raise ValueError("candidate_conflict")
            existing["promotionStatus"] = "ready"
        save_items(items)
        return items


def generate_teacher_review_sample():
    sample = []

    def add(task_id, expression, value, count, review="pending", promotion="not_ready"):
        sample.append({"taskId": task_id, "rawExpression": expression,
                       "candidate": {"slotId": "quantity", "value": value},
                       "observationCount": count, "reviewStatus": review,
                       "promotionStatus": promotion})

    for index in range(3):
        add("dev.shop.order.apple.2", "conflict-%d" % index, 2, 15 - index)
        add("dev.shop.order.apple.2", "conflict-%d" % index, 3, 4 - index)
    for index in range(8):
        add("dev.shop.order.orange.3", "frequent-%d" % index, 3, 10 - index)
    for index in range(10):
        add("dev.shop.order.banana.1", "safe-%d" % index, 1, 1)
    for index in range(30):
        add("dev.shop.order.banana.3", "low-%d" % index, 1, 1)
    for index in range(10):
        add("dev.shop.order.orange.3", "rejected-%d" % index, 3, 2, "rejected")
        add("dev.shop.order.orange.3", "promoted-%d" % index, 3, 3, "approved", "promoted")

    with LOCK:
        items = load_items()
        by_key = {candidate_key(item): item for item in items}
        for value in sample:
            by_key[candidate_key(value)] = value
        result = list(by_key.values())
        save_items(result)
        return result


class Handler(BaseHTTPRequestHandler):
    def _headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "http://localhost:8000")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _body(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

    def _write(self, value, status=200):
        self._headers(status)
        self.wfile.write(json.dumps(value, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self._headers(204)

    def do_GET(self):
        if self.path != "/candidates":
            self._write({"error": "not_found"}, 404)
            return
        with LOCK:
            self._write({"candidates": load_items()})

    def do_POST(self):
        if self.path == "/dev/teacher-review-sample":
            self._write({"candidates": generate_teacher_review_sample()})
            return
        if self.path != "/observations":
            self._write({"error": "not_found"}, 404)
            return
        try:
            self._write({"candidates": record_observation(self._body())})
        except (ValueError, TypeError):
            self._write({"error": "invalid_observation"}, 400)

    def do_PATCH(self):
        if self.path != "/candidates/review":
            self._write({"error": "not_found"}, 404)
            return
        try:
            self._write({"candidates": update_review(self._body())})
        except ValueError:
            self._write({"error": "invalid_candidate"}, 400)
        except KeyError:
            self._write({"error": "candidate_not_found"}, 404)

    def log_message(self, _format, *_args):
        return


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
