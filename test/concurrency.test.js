import test from 'node:test';
import assert from 'node:assert/strict';
import { mapWithConcurrency, normalizeConcurrency } from '../src/concurrency.js';

test('mapWithConcurrency preserves order and respects the active-worker limit', async () => {
    let active = 0;
    let peak = 0;
    const values = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 3, async (value) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return value * 10;
    });

    assert.deepEqual(values, [10, 20, 30, 40, 50, 60]);
    assert.equal(peak, 3);
});

test('normalizeConcurrency rejects unsafe values', () => {
    assert.equal(normalizeConcurrency(), 5);
    assert.throws(() => normalizeConcurrency(0), /between 1 and 10/);
    assert.throws(() => normalizeConcurrency(11), /between 1 and 10/);
    assert.throws(() => normalizeConcurrency(2.5), /integer/);
});
