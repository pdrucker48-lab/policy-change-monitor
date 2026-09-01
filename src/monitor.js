import { createHash } from 'node:crypto';
import { summarizeChanges } from './classify.js';
import { diffBlocks } from './diff.js';
import { normalizeHtml } from './normalize.js';
import { fetchPublicPage } from './url-safety.js';

export function snapshotKey(url) {
    const canonical = new URL(url);
    canonical.hash = '';
    return `snapshot-${createHash('sha256').update(canonical.href).digest('hex')}`;
}

export async function monitorPage(page, {
    stateStore,
    ignoreSelectors = [],
    ignorePatterns = [],
    timeoutMs = 30_000,
    maxResponseBytes = 2_000_000,
    fetchPage = fetchPublicPage,
    now = () => new Date(),
} = {}) {
    if (!stateStore?.getValue || !stateStore?.setValue) throw new Error('A persistent state store is required');

    const key = snapshotKey(page.url);
    const previous = await stateStore.getValue(key);
    const checkedAt = now().toISOString();
    const fetched = await fetchPage(page.url, { timeoutMs, maxResponseBytes });
    const normalized = normalizeHtml(fetched.html, { ignoreSelectors, ignorePatterns });
    const snapshot = {
        schemaVersion: 1,
        sourceUrl: page.url,
        finalUrl: fetched.finalUrl,
        label: page.label || normalized.title || page.url,
        capturedAt: checkedAt,
        title: normalized.title,
        contentHash: normalized.contentHash,
        blocks: normalized.blocks,
        textLength: normalized.textLength,
    };

    const base = {
        label: snapshot.label,
        sourceUrl: page.url,
        finalUrl: fetched.finalUrl,
        checkedAt,
        contentHash: snapshot.contentHash,
        textLength: snapshot.textLength,
    };

    let result;
    if (!previous?.contentHash || !Array.isArray(previous.blocks)) {
        result = {
            ...base,
            status: 'baseline',
            materiality: 'none',
            categories: [],
            summary: `Saved the first baseline with ${normalized.blocks.length} text blocks.`,
            changedClauses: [],
        };
    } else if (previous.contentHash === normalized.contentHash) {
        result = {
            ...base,
            status: 'unchanged',
            previousCapturedAt: previous.capturedAt,
            materiality: 'none',
            categories: [],
            summary: 'No meaningful text changes detected.',
            changedClauses: [],
        };
    } else {
        const difference = diffBlocks(previous.blocks, normalized.blocks);
        const classified = summarizeChanges(difference.changes);
        result = {
            ...base,
            status: classified.changes.length ? 'changed' : 'unchanged',
            previousCapturedAt: previous.capturedAt,
            previousContentHash: previous.contentHash,
            materiality: classified.changes.length ? classified.materiality : 'none',
            categories: classified.categories,
            summary: classified.changes.length ? classified.summary : 'No meaningful clause changes detected.',
            changedClauses: classified.changes,
            totalChanges: difference.totalChanges,
            changesTruncated: difference.truncated,
        };
    }

    await stateStore.setValue(key, snapshot);
    return result;
}
