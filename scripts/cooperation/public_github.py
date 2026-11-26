"""Bounded anonymous reads of the one authorized public repository."""
import json
import re
from urllib.parse import quote
from urllib.request import Request, urlopen

REPO = "kwgkw452-collab/Quest"


def branch_tip(branch):
    if not isinstance(branch, str) or not branch.startswith("automation/") or any(c in branch for c in ('?', '#', '\\', '\n', '\r')):
        raise ValueError("Unscoped remote branch")
    url = "https://api.github.com/repos/" + REPO + "/git/ref/heads/" + quote(branch, safe='/')
    request = Request(url, headers={"Accept":"application/vnd.github+json", "User-Agent":"Quest-zero-cost-cooperation-v3"})
    with urlopen(request, timeout=20) as response:
        value = json.load(response)
    if value.get("ref") != "refs/heads/" + branch or value.get("object",{}).get("type") != "commit":
        raise ValueError("Remote branch identity not established")
    sha = value["object"]["sha"]
    if not re.fullmatch(r"[a-f0-9]{40}", sha):
        raise ValueError("Invalid remote SHA")
    return sha
