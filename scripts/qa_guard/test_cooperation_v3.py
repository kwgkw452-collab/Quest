"""Run the new local cooperation regressions in the inherited free Actions job."""
from pathlib import Path
import unittest


def load_tests(loader, tests, pattern):
    folder = Path(__file__).resolve().parents[1] / "cooperation"
    return loader.discover(str(folder), pattern="test_*.py", top_level_dir=str(folder))
