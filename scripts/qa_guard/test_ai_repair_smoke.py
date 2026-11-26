"""Synthetic arithmetic fixture for the repair-agent smoke test; never production logic."""
import unittest

class RepairSmoke(unittest.TestCase):
    def test_arithmetic(self):
        self.assertEqual(2 + 2, 4)

if __name__ == '__main__':
    unittest.main()
