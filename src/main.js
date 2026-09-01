import { Actor, log } from 'apify';
import { monitorPage } from './monitor.js';
import { deliverWebhook } from './webhook.js';
import { mapWithConcurrency, normalizeConcurrency } from './concurrency.js';

function validateInput(input) {
    if (!input || !Array.isArray(input.pages) || input.pages.length === 0) {
        throw new Error('Input must include at least one page in the pages array');
    }
    if (input.pages.length > 500) throw new Error('A maximum of 500 pages can be monitored per run');
    normalizeConcurrency(input.maxConcurrency ?? 5);
    for (const [index, page] of input.pages.entries()) {
        if (!page || typeof page.url !== 'string' || page.url.length === 0) {
            throw new Error(`pages[${index}].url must be a non-empty string`);
        }
    }
}

async function runActor() {
    const input = await Actor.getInput() ?? {};
    validateInput(input);

    const {
        pages,
        stateStoreName = 'policy-change-monitor-snapshots',
        emitBaselines = true,
        emitUnchanged = true,
        ignoreSelectors = [],
        ignorePatterns = [],
        webhookUrl,
        webhookBearerToken,
        requestTimeoutSecs = 30,
        maxResponseBytes = 2_000_000,
        maxConcurrency = 5,
    } = input;

    const stateStore = await Actor.openKeyValueStore(stateStoreName);
    const records = [];
    const changes = [];
    const counters = { checked: 0, baseline: 0, changed: 0, unchanged: 0, error: 0 };

    let limitReached = false;
    const processed = await mapWithConcurrency(pages, maxConcurrency, async (page) => {
        if (limitReached) return null;
        const chargeResult = await Actor.charge({ eventName: 'page-check' });
        if (chargeResult.eventChargeLimitReached) {
            if (!limitReached) log.warning('The run spending limit was reached; remaining pages will not be checked.');
            limitReached = true;
            return null;
        }

        try {
            const record = await monitorPage(page, {
                stateStore,
                ignoreSelectors,
                ignorePatterns,
                timeoutMs: requestTimeoutSecs * 1_000,
                maxResponseBytes,
            });
            log.info(`${record.status.toUpperCase()}: ${record.label}`, { url: record.sourceUrl, materiality: record.materiality });
            return record;
        } catch (error) {
            const errorRecord = {
                status: 'error',
                label: page.label || page.url,
                sourceUrl: page.url,
                checkedAt: new Date().toISOString(),
                materiality: 'none',
                categories: [],
                summary: 'The page could not be checked.',
                changedClauses: [],
                error: error.message,
            };
            log.error(`ERROR: ${errorRecord.label}`, { url: page.url, error: error.message });
            return errorRecord;
        }
    });

    for (const record of processed.filter(Boolean)) {
        records.push(record);
        if (record.status === 'error') counters.error += 1;
        else {
            counters.checked += 1;
            counters[record.status] += 1;
        }
        if (record.status === 'changed') changes.push(record);

        const shouldEmit = record.status === 'changed'
            || record.status === 'error'
            || (record.status === 'baseline' && emitBaselines)
            || (record.status === 'unchanged' && emitUnchanged);
        if (shouldEmit) await Actor.pushData(record);
    }

    let webhook = { configured: Boolean(webhookUrl), delivered: false };
    if (webhookUrl && changes.length > 0) {
        try {
            webhook = {
                configured: true,
                ...await deliverWebhook(webhookUrl, {
                    event: 'policy-change-monitor.changes-detected',
                    generatedAt: new Date().toISOString(),
                    changeCount: changes.length,
                    changes,
                }, { bearerToken: webhookBearerToken }),
            };
        } catch (error) {
            webhook = { configured: true, delivered: false, error: error.message };
            log.error('Webhook delivery failed', { error: error.message });
        }
    }

    const output = {
        generatedAt: new Date().toISOString(),
        stateStoreName,
        ...counters,
        emitted: records.filter((record) => record.status === 'changed'
            || record.status === 'error'
            || (record.status === 'baseline' && emitBaselines)
            || (record.status === 'unchanged' && emitUnchanged)).length,
        webhook,
        resultsDatasetId: Actor.getEnv().defaultDatasetId,
    };
    await Actor.setValue('OUTPUT', output);
    log.info('Monitoring run complete', output);
}

await Actor.init();
try {
    await runActor();
    await Actor.exit();
} catch (error) {
    await Actor.fail(error instanceof Error ? error.message : String(error));
}
