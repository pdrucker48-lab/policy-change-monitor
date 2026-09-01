import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeChanges } from '../src/classify.js';
import { diffBlocks, textSimilarity } from '../src/diff.js';

test('diff pairs similar removed and added clauses as a modification', () => {
    const result = diffBlocks(
        ['Terms', 'Fees are billed monthly at $10.', 'Support is available by email.'],
        ['Terms', 'Fees are billed monthly at $15.', 'Support is available by email.'],
    );

    assert.equal(result.totalChanges, 1);
    assert.deepEqual(result.changes[0], {
        type: 'modified',
        before: 'Fees are billed monthly at $10.',
        after: 'Fees are billed monthly at $15.',
        similarity: 0.714,
    });
});

test('classifier identifies high-materiality pricing and arbitration changes', () => {
    const result = summarizeChanges([{
        type: 'modified',
        before: 'The subscription fee is $10 per month.',
        after: 'The subscription fee is $20 per month and disputes require binding arbitration.',
        similarity: 0.4,
    }]);

    assert.equal(result.materiality, 'high');
    assert.deepEqual(result.categories, ['pricing/billing', 'arbitration']);
    assert.match(result.summary, /pricing\/billing, arbitration/);
});

test('similarity is based on shared words rather than character positions', () => {
    assert.ok(textSimilarity('Customer data is retained for 30 days', 'We retain customer data for 90 days') >= 0.4);
});
