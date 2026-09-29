#!/usr/bin/env python3

import json
import os
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER = os.path.join(ROOT, "dev", "central-candidate-store.py")


def request(url, method="GET", body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    item = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(item, timeout=3) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


def rejected(url, body, expected_status):
    try:
        request(url, "PATCH", body)
    except urllib.error.HTTPError as error:
        assert error.code == expected_status
        return
    raise AssertionError("Central Store unexpectedly accepted an invalid Review update")


with socket.socket() as probe:
    probe.bind(("127.0.0.1", 0))
    port = probe.getsockname()[1]

store_file = tempfile.mktemp(prefix="eigo-central-store-test-", suffix=".json")
environment = dict(os.environ)
environment["EIGO_CANDIDATE_STORE_PORT"] = str(port)
environment["EIGO_CANDIDATE_STORE_FILE"] = store_file
process = subprocess.Popen(["/usr/bin/python3", SERVER], env=environment,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
base = "http://127.0.0.1:%d" % port

try:
    for _ in range(30):
        try:
            request(base + "/candidates")
            break
        except Exception:
            time.sleep(0.1)
    observation = {"taskId": "dev.shop.order.orange.3", "rawExpression": "central-free",
                   "candidate": {"slotId": "quantity", "value": 3},
                   "studentName": "must-not-store", "userId": "must-not-store"}
    for _ in range(100):
        status, _ = request(base + "/observations", "POST", observation)
        assert status == 200
    _, payload = request(base + "/candidates")
    matching = [value for value in payload["candidates"] if value["rawExpression"] == "central-free"]
    assert len(matching) == 1
    assert matching[0]["observationCount"] == 100
    assert "studentName" not in matching[0] and "userId" not in matching[0]

    other = {"taskId": "dev.shop.order.orange.3", "rawExpression": "central-other",
             "candidate": {"slotId": "quantity", "value": 2}}
    request(base + "/observations", "POST", other)
    _, payload = request(base + "/candidates")
    assert len(payload["candidates"]) == 2

    review = {"taskId": observation["taskId"], "rawExpression": observation["rawExpression"],
              "candidate": observation["candidate"], "reviewStatus": "approved"}
    _, payload = request(base + "/candidates/review", "PATCH", review)
    approved = [value for value in payload["candidates"] if value["candidate"]["value"] == 3][0]
    assert approved["reviewStatus"] == "approved"
    _, second_client = request(base + "/candidates")
    assert [value for value in second_client["candidates"] if value["rawExpression"] == "central-free"][0]["reviewStatus"] == "approved"
    ready_request = {"taskId": observation["taskId"], "rawExpression": observation["rawExpression"],
                     "candidate": observation["candidate"], "promotionStatus": "ready"}
    _, payload = request(base + "/candidates/review", "PATCH", ready_request)
    ready = [value for value in payload["candidates"] if value["candidate"]["value"] == 3][0]
    assert ready["promotionStatus"] == "ready"
    _, second_client = request(base + "/candidates")
    assert [value for value in second_client["candidates"] if value["rawExpression"] == "central-free"][0]["promotionStatus"] == "ready"

    reject_request = {"taskId": other["taskId"], "rawExpression": other["rawExpression"],
                      "candidate": other["candidate"], "reviewStatus": "rejected"}
    request(base + "/candidates/review", "PATCH", reject_request)
    _, second_client = request(base + "/candidates")
    assert [value for value in second_client["candidates"] if value["rawExpression"] == "central-other"][0]["reviewStatus"] == "rejected"
    rejected(base + "/candidates/review", dict(other, promotionStatus="ready"), 400)

    pending = {"taskId": "dev.shop.order.banana.1", "rawExpression": "pending",
               "candidate": {"slotId": "quantity", "value": 1}}
    request(base + "/observations", "POST", pending)
    rejected(base + "/candidates/review", dict(pending, promotionStatus="ready"), 400)

    conflict_a = {"taskId": "dev.shop.order.apple.2", "rawExpression": "conflict",
                  "candidate": {"slotId": "quantity", "value": 2}}
    conflict_b = {"taskId": "dev.shop.order.apple.2", "rawExpression": "conflict",
                  "candidate": {"slotId": "quantity", "value": 3}}
    request(base + "/observations", "POST", conflict_a)
    request(base + "/observations", "POST", conflict_b)
    request(base + "/candidates/review", "PATCH", dict(conflict_a, reviewStatus="approved"))
    rejected(base + "/candidates/review", dict(conflict_a, promotionStatus="ready"), 400)
    rejected(base + "/candidates/review", {"taskId": "missing", "rawExpression": "none",
             "candidate": {"slotId": "quantity", "value": 1}, "reviewStatus": "approved"}, 404)
    rejected(base + "/candidates/review", {"taskId": "bad", "rawExpression": "bad",
             "candidate": {}, "reviewStatus": "approved"}, 400)
    _, sample_payload = request(base + "/dev/teacher-review-sample", "POST", {})
    teacher_rows = [value for value in sample_payload["candidates"]
                    if value["rawExpression"].startswith(("conflict-", "frequent-", "safe-", "low-", "rejected-", "promoted-"))]
    assert len(teacher_rows) == 74
    assert len([value for value in teacher_rows if value["rawExpression"].startswith("conflict-")]) == 6
    assert len([value for value in teacher_rows if value["rawExpression"].startswith("frequent-")]) == 8
    assert len([value for value in teacher_rows if value["rawExpression"].startswith("safe-")]) == 10
    assert len([value for value in teacher_rows if value["rawExpression"].startswith("low-")]) == 30
    assert len([value for value in teacher_rows if value["reviewStatus"] != "pending" or value["promotionStatus"] == "promoted"]) == 20
    assert all("studentName" not in value and "userId" not in value for value in teacher_rows)
    print("Teacher Review Operations Phase 6 tests: PASS")
finally:
    process.terminate()
    process.wait(timeout=5)
    try:
        os.remove(store_file)
    except OSError:
        pass
