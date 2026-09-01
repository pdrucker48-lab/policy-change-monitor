export function normalizeConcurrency(value = 5) {
    if (!Number.isInteger(value) || value < 1 || value > 10) {
        throw new Error('maxConcurrency must be an integer between 1 and 10');
    }
    return value;
}

export async function mapWithConcurrency(items, concurrency, worker) {
    const limit = normalizeConcurrency(concurrency);
    const results = new Array(items.length);
    let cursor = 0;

    async function runWorker() {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await worker(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
    return results;
}
