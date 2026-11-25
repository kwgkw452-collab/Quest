'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { judge } = require('../judge.cjs');
const { challenges } = require('./S006/story.json');

function expectDecision(question, utterances, decision) {
  const { rule } = challenges['s006.communication.' + question];
  for (const utterance of utterances) {
    assert.equal(judge(rule, utterance).decision, decision, utterance);
  }
}

test('QA35-03: Q2 rejects a different box while Q3 can ask where it is', () => {
  expectDecision(2, ['What color is another box?', 'Can you describe another book?'], 'REJECT');
  expectDecision(2, ['What color is the box?', 'What color is it?'], 'ACCEPT');
  expectDecision(3, ['Where is another box?'], 'ACCEPT');
});

test('QA35-04: Q4 accepts described boxes in affirmative show me/us requests', () => {
  expectDecision(4, [
    'Could you show me that red box?',
    'Show us that little box, please.',
    'Show me that red book.'
  ], 'ACCEPT');
  expectDecision(4, [
    'Show us that little bag, please.',
    'Do not show us that little box.',
    'Could you show me that red box and take it away?'
  ], 'REJECT');
});

test('QA35-05: Q10 rejects a different box and keeps the approved handover and legacy behavior', () => {
  assert.equal(challenges['s006.communication.10'].goalJa, 'これはあなたの箱です。');
  expectDecision(10, ['This is another box.', 'This is another book.', 'I found another box.'], 'REJECT');
  expectDecision(10, ['This is your box.', 'This is your book.', 'I found the box.'], 'ACCEPT');
});
