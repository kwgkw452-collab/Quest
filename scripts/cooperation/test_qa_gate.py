import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from qa_gate import canonical, verify_and_route, NAMESPACE


class PublicQAKeyTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.top=Path(self.temp.name)
        self.repo=self.top/'candidate';self.repo.mkdir();self.key=self.top/'fake-qa-key'
        subprocess.run(['ssh-keygen','-q','-t','ed25519','-N','','-f',str(self.key)],check=True,capture_output=True)
        self.signers=self.top/'allowed-signers';self.signers.write_text('independent-fixture '+self.key.with_suffix('.pub').read_text())
        self.digest=hashlib.sha256(self.signers.read_bytes()).hexdigest()
        self.machine={'schema':'quest-cooperation-machine-v1','base_sha':'a'*40,'head_sha':'b'*40,'status':'PASS','violations':[],
                      'production_merge':'NOT_AUTHORIZED','independent_qa':'NOT_ASSESSED'}
        self.payload={'schema':'quest-independent-qa-verdict-v1','base_sha':'a'*40,'head_sha':'b'*40,'reviewer':'independent-fixture','verdict':'PASS'}

    def sign(self,payload=None):
        payload=payload or self.payload;file=self.top/'verdict';file.write_bytes(canonical(payload))
        sig=Path(str(file)+'.sig')
        if sig.exists():sig.unlink()
        subprocess.run(['ssh-keygen','-Y','sign','-f',str(self.key),'-n',NAMESPACE,str(file)],check=True,capture_output=True)
        return {'payload':payload,'signature':sig.read_text()}

    def gate(self,qa=None,**kwargs):
        return verify_and_route(self.machine,qa or self.sign(),kwargs.get('signers',self.signers),kwargs.get('digest',self.digest),self.repo,
                                producer=kwargs.get('producer','creator'),repair_actor='repair')

    def test_public_key_pass_waits_for_director_never_merge(self):
        r=self.gate();self.assertEqual(r['gate'],'DIRECTOR_REVIEW_PENDING');self.assertFalse(r['merge_authorized'])

    def test_public_key_fail_returns_to_repair(self):
        self.payload['verdict']='FAIL';self.assertEqual(self.gate()['gate'],'QA_REPAIR_REQUIRED')

    def test_stale_qa_is_rejected(self):
        self.payload['head_sha']='c'*40;self.assertEqual(self.gate()['reason'],'QA_SHA_STALE')

    def test_forged_content_and_signature_rejected(self):
        signed=self.sign();signed['payload']['verdict']='FAIL';self.assertEqual(self.gate(signed)['reason'],'INVALID_QA_SIGNATURE')

    def test_producer_cannot_self_approve(self):
        self.assertEqual(self.gate(producer='independent-fixture')['reason'],'QA_SELF_APPROVAL')

    def test_candidate_local_signers_rejected(self):
        local=self.repo/'keys';local.write_bytes(self.signers.read_bytes());self.assertEqual(self.gate(signers=local)['reason'],'CANDIDATE_LOCAL_QA_TRUST')

    def test_changed_public_key_file_rejected(self):
        self.assertEqual(self.gate(digest='0'*64)['reason'],'QA_SIGNERS_DIGEST_CHANGED')

    def test_no_trusted_public_key_holds(self):
        self.assertEqual(self.gate(signers=self.top/'absent')['reason'],'QA_TRUST_NOT_ESTABLISHED')

    def test_unsigned_qa_cannot_be_used(self):
        self.assertEqual(self.gate({'payload':self.payload,'signature':''})['reason'],'INVALID_QA_SIGNATURE')

    def test_unknown_verdict_holds_even_signed(self):
        self.payload['verdict']='MAYBE';self.assertEqual(self.gate()['reason'],'QA_NOT_PASS')
