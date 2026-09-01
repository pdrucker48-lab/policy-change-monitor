import { assertPublicUrl } from './url-safety.js';

export async function deliverWebhook(url, payload, {
    bearerToken,
    timeoutMs = 15_000,
    fetchImpl = globalThis.fetch,
} = {}) {
    const target = await assertPublicUrl(url, { httpsOnly: true });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchImpl(target, {
            method: 'POST',
            redirect: 'error',
            signal: controller.signal,
            headers: {
                'content-type': 'application/json',
                'user-agent': 'PolicyChangeMonitor/0.1 (+https://github.com/pdrucker48-lab/policy-change-monitor)',
                ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
        return { delivered: true, status: response.status };
    } catch (error) {
        if (error.name === 'AbortError') throw new Error(`Webhook timed out after ${timeoutMs / 1000} seconds`);
        throw error;
    } finally {
        clearTimeout(timer);
    }
}
