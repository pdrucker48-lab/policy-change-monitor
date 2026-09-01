import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHtml } from '../src/normalize.js';

test('normalization keeps policy clauses and removes page chrome', () => {
    const result = normalizeHtml(`
        <html>
          <head><title>Privacy Policy</title><script>dynamic()</script></head>
          <body>
            <nav>Home Products Pricing</nav>
            <div class="cookie-banner">Accept all cookies</div>
            <main>
              <h1>Privacy Policy</h1>
              <p>We collect account information to provide the service.</p>
              <p>We retain billing records for seven years.</p>
            </main>
            <footer>Copyright 2026</footer>
          </body>
        </html>
    `);

    assert.equal(result.title, 'Privacy Policy');
    assert.deepEqual(result.blocks, [
        'Privacy Policy',
        'We collect account information to provide the service.',
        'We retain billing records for seven years.',
    ]);
    assert.equal(result.contentHash.length, 64);
});

test('normalization supports custom noise patterns', () => {
    const result = normalizeHtml(`
        <main>
          <h1>Terms</h1>
          <p>Last generated: 2026-09-01 10:30</p>
          <p>You must pay all subscription fees within 30 days.</p>
        </main>
    `, { ignorePatterns: ['^Last generated:'] });

    assert.deepEqual(result.blocks, [
        'Terms',
        'You must pay all subscription fees within 30 days.',
    ]);
});

test('normalization accepts Markdown and plain-text policy responses', () => {
    const result = normalizeHtml('# Terms\n\nSubscription fees are billed monthly.\n\n## Termination\n\nEither party may terminate with 30 days notice.');

    assert.deepEqual(result.blocks, [
        '# Terms',
        'Subscription fees are billed monthly.',
        '## Termination',
        'Either party may terminate with 30 days notice.',
    ]);
});
