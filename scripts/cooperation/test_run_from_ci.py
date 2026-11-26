import unittest
from unittest.mock import patch
from run_from_ci import advance, WORKFLOW

A='a'*40
B='b'*40


class CIEntryTests(unittest.TestCase):
    def setUp(self):
        self.r={"id":1,"head_sha":A,"head_branch":"automation/test","path":WORKFLOW,
                "event":"pull_request","status":"completed","conclusion":"failure","run_number":1,
                "html_url":"https://github.com/example/run/1"}
        self.patches=[patch('run_from_ci.head',return_value=A),patch('run_from_ci.branch',return_value='automation/test'),
                      patch('run_from_ci.load_policy',return_value={'branch':'automation/test'})]
        self.head_mock=self.patches[0].start();self.addCleanup(self.patches[0].stop)
        for p in self.patches[1:]:p.start();self.addCleanup(p.stop)

    def run_case(self, report=None, runs=None):
        calls=[]
        def execute(*args,**kwargs):
            calls.append((args,kwargs))
            if report and report.get('head_sha'):self.head_mock.return_value=report['head_sha']
            return report or {'gate':'INDEPENDENT_QA_PENDING','merge_authorized':False,'head_sha':A,'events':[]}
        r=advance('repo','policy','digest','state',fetch=lambda _: [self.r] if runs is None else runs,execute=execute,fetch_tip=lambda _:self.head_mock.return_value)
        return r,calls

    def test_ci_failure_triggers_execution_and_retest_gate_on_new_sha(self):
        r,calls=self.run_case({'gate':'INDEPENDENT_QA_PENDING','merge_authorized':False,'head_sha':B,'events':[{'stage':'repair'}]})
        self.assertEqual(r['gate'],'CI_RETEST_PENDING');self.assertEqual(len(calls),1);self.assertEqual(r['ci_head_sha'],A)

    def test_success_current_sha_hands_to_qa(self):
        self.r['conclusion']='success';r,calls=self.run_case();self.assertEqual(r['gate'],'INDEPENDENT_QA_PENDING');self.assertEqual(len(calls),1)

    def test_ci_failure_with_no_reproduced_fault_is_hold(self):
        r,_=self.run_case();self.assertEqual(r['reason'],'CI_FAILURE_NOT_EXPLAINED_BY_PACKAGE')

    def test_stale_ci_does_not_start_ai(self):
        self.r['head_sha']=B;r,calls=self.run_case();self.assertEqual(r['gate'],'HOLD');self.assertFalse(calls)

    def test_missing_ci_does_not_start_ai(self):
        r,calls=self.run_case(runs=[]);self.assertEqual(r['reason'],'EXACT_SHA_CI_NOT_FOUND');self.assertFalse(calls)

    def test_pending_ci_does_not_start_ai(self):
        self.r['status']='in_progress';r,calls=self.run_case();self.assertEqual(r['reason'],'EXACT_SHA_CI_PENDING');self.assertFalse(calls)

    def test_other_workflow_or_branch_does_not_authorize_ai(self):
        for k,v in [('path','attacker.yml'),('head_branch','other'),('event','push')]:
            with self.subTest(k=k):
                r=dict(self.r);r[k]=v;answer,calls=self.run_case(runs=[r]);self.assertEqual(answer['gate'],'HOLD');self.assertFalse(calls)

    def test_unknown_ci_outcome_hold(self):
        self.r['conclusion']='cancelled';r,calls=self.run_case();self.assertEqual(r['reason'],'UNKNOWN_CI_RESULT');self.assertFalse(calls)

    def test_latest_attempt_overrides_previous_success(self):
        older=dict(self.r,status='completed',conclusion='success',run_attempt=1)
        self.r.update(status='in_progress',run_attempt=2)
        r,calls=self.run_case(runs=[older,self.r]);self.assertEqual(r['reason'],'EXACT_SHA_CI_PENDING');self.assertFalse(calls)

    def test_controller_hold_not_replaced_by_ci_retest(self):
        r,_=self.run_case({'gate':'HOLD','reason':'MAX_REPAIRS_REACHED','merge_authorized':False,'events':[{'stage':'repair'}]})
        self.assertEqual(r['gate'],'HOLD');self.assertEqual(r['reason'],'MAX_REPAIRS_REACHED')

    def test_head_changes_during_ci_read_never_starts_repair(self):
        calls=[]
        def fetch(_):
            self.head_mock.return_value=B
            return [self.r]
        result=advance('repo','policy','digest','state',fetch=fetch,
                       execute=lambda *a,**kw:calls.append('execute'),
                       fetch_tip=lambda _:A)
        self.assertEqual(result['reason'],'BRANCH_OR_HEAD_CHANGED_BEFORE_EXECUTION')
        self.assertEqual(calls,[])
        self.assertFalse(result['merge_authorized'])

    def test_remote_changes_during_ci_read_never_starts_repair(self):
        calls=[]
        tips=iter([A,B])
        result=advance('repo','policy','digest','state',fetch=lambda _:[self.r],
                       execute=lambda *a,**kw:calls.append('execute'),
                       fetch_tip=lambda _:next(tips))
        self.assertEqual(result['reason'],'REMOTE_HEAD_CHANGED_BEFORE_EXECUTION')
        self.assertEqual(calls,[])
        self.assertFalse(result['merge_authorized'])

    def test_branch_changes_during_ci_read_never_starts_repair(self):
        calls=[]
        with patch('run_from_ci.branch',side_effect=['automation/test','automation/other']):
            result=advance('repo','policy','digest','state',fetch=lambda _:[self.r],
                           execute=lambda *a,**kw:calls.append('execute'),
                           fetch_tip=lambda _:A)
        self.assertEqual(result['reason'],'BRANCH_OR_HEAD_CHANGED_BEFORE_EXECUTION')
        self.assertEqual(calls,[])
        self.assertFalse(result['merge_authorized'])
