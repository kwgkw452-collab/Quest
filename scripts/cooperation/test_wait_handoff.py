import unittest
from run_from_ci import wait_for_handoff


class WaitTests(unittest.TestCase):
    def test_repairs_then_pending_ci_then_hands_to_qa_without_relaunch(self):
        gates=iter([{'gate':'CI_RETEST_PENDING'}, {'gate':'HOLD','reason':'EXACT_SHA_CI_PENDING'}, {'gate':'INDEPENDENT_QA_PENDING','merge_authorized':False}])
        sleeps=[];r=wait_for_handoff(lambda:next(gates),polls=3,sleeper=sleeps.append)
        self.assertEqual(r['gate'],'INDEPENDENT_QA_PENDING');self.assertEqual(sleeps,[60,60]);self.assertEqual(len(r['poll_history']),3)

    def test_unknown_hold_does_not_poll(self):
        sleeps=[];r=wait_for_handoff(lambda:{'gate':'HOLD','reason':'UNKNOWN_CI_RESULT'},sleeper=sleeps.append)
        self.assertFalse(sleeps);self.assertEqual(r['reason'],'UNKNOWN_CI_RESULT')

    def test_exhausted_wait_is_hold(self):
        r=wait_for_handoff(lambda:{'gate':'CI_RETEST_PENDING'},polls=2,sleeper=lambda _:None)
        self.assertEqual(r['reason'],'BOUNDED_CI_WAIT_EXHAUSTED');self.assertFalse(r['merge_authorized'])

    def test_invalid_limits_rejected(self):
        for polls,interval in [(0,60),(11,60),(True,60),(2,1)]:
            with self.assertRaises(ValueError):wait_for_handoff(lambda:{},polls=polls,interval=interval)

    def test_authenticated_qa_fail_returns_to_repair_without_approval(self):
        r=wait_for_handoff(lambda:{'gate':'QA_REPAIR_REQUIRED','merge_authorized':False},sleeper=lambda _:None)
        self.assertEqual(r['gate'],'QA_REPAIR_REQUIRED');self.assertFalse(r['merge_authorized'])
