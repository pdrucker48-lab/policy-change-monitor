import assert from 'node:assert/strict';
import test from 'node:test';
import { isPrivateIp, parsePublicUrl } from '../src/url-safety.js';

test('private and reserved addresses are rejected', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1']) {
        assert.equal(isPrivateIp(address), true, address);
    }
    assert.throws(() => parsePublicUrl('http://localhost/secret'), /not allowed/);
    assert.throws(() => parsePublicUrl('http://127.0.0.1/secret'), /not allowed/);
});

test('public URLs are normalized and credentials are rejected', () => {
    assert.equal(parsePublicUrl('https://Example.COM/terms#section').href, 'https://example.com/terms');
    assert.throws(() => parsePublicUrl('https://user:pass@example.com/terms'), /credentials/);
    assert.throws(() => parsePublicUrl('http://example.com/hook', { httpsOnly: true }), /HTTPS/);
});
