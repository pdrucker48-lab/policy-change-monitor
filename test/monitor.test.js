import assert from 'node:assert/strict';
import test from 'node:test';
import { monitorPage } from '../src/monitor.js';

function memoryStore() {
    const values = new Map();
    return {
        async getValue(key) { return values.get(key); },
        async setValue(key, value) { values.set(key, value); },
    };
}

function responseFor(html) {
    return async (url) => ({ html, finalUrl: url, contentType: 'text/html', byteLength: html.length });
}

test('first run creates a baseline and second identical run is unchanged', async () => {
    const stateStore = memoryStore();
    const page = { url: 'https://example.com/terms', label: 'Terms' };
    const html = '<main><h1>Terms</h1><p>You may use the service for lawful purposes.</p></main>';
    let tick = 0;
    const now = () => new Date(`2026-09-01T00:00:0${tick++}.000Z`);

    const baseline = await monitorPage(page, { stateStore, fetchPage: responseFor(html), now });
    const unchanged = await monitorPage(page, { stateStore, fetchPage: responseFor(html), now });

    assert.equal(baseline.status, 'baseline');
    assert.equal(unchanged.status, 'unchanged');
    assert.equal(unchanged.previousCapturedAt, '2026-09-01T00:00:00.000Z');
});

test('later run returns exact before and after clause fragments', async () => {
    const stateStore = memoryStore();
    const page = { url: 'https://example.com/privacy', label: 'Privacy' };
    await monitorPage(page, {
        stateStore,
        fetchPage: responseFor('<main><h1>Privacy</h1><p>We retain account data for 30 days.</p></main>'),
    });
    const changed = await monitorPage(page, {
        stateStore,
        fetchPage: responseFor('<main><h1>Privacy</h1><p>We retain account data for 180 days.</p></main>'),
    });

    assert.equal(changed.status, 'changed');
    assert.equal(changed.materiality, 'high');
    assert.deepEqual(changed.categories, ['data retention']);
    assert.equal(changed.changedClauses[0].before, 'We retain account data for 30 days.');
    assert.equal(changed.changedClauses[0].after, 'We retain account data for 180 days.');
});
