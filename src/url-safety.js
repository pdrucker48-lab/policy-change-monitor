import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'localhost.localdomain',
    'metadata.google.internal',
    'metadata.aws.internal',
]);

function isPrivateIpv4(address) {
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;

    const [a, b] = parts;
    return a === 0
        || a === 10
        || a === 127
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 198 && (b === 18 || b === 19))
        || a >= 224;
}

export function isPrivateIp(address) {
    const family = net.isIP(address);
    if (family === 4) return isPrivateIpv4(address);
    if (family !== 6) return true;

    const normalized = address.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;

    const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
}

export function parsePublicUrl(value, { httpsOnly = false } = {}) {
    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error(`Invalid URL: ${value}`);
    }

    const allowedProtocols = httpsOnly ? ['https:'] : ['http:', 'https:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
        throw new Error(`${httpsOnly ? 'HTTPS' : 'HTTP(S)'} URL required: ${value}`);
    }
    if (parsed.username || parsed.password) throw new Error(`URLs containing credentials are not allowed: ${value}`);

    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
    if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
        throw new Error(`Private or local host is not allowed: ${hostname || value}`);
    }
    if (net.isIP(hostname) && isPrivateIp(hostname)) throw new Error(`Private or reserved IP address is not allowed: ${hostname}`);

    parsed.hash = '';
    return parsed;
}

export async function assertPublicUrl(value, options = {}) {
    const parsed = parsePublicUrl(value, options);
    if (!net.isIP(parsed.hostname)) {
        let addresses;
        try {
            addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
        } catch (error) {
            throw new Error(`Could not resolve ${parsed.hostname}: ${error.message}`);
        }
        if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
            throw new Error(`Host does not resolve exclusively to public IP addresses: ${parsed.hostname}`);
        }
    }
    return parsed;
}

export async function fetchPublicPage(value, {
    timeoutMs = 30_000,
    maxResponseBytes = 2_000_000,
    maxRedirects = 5,
    fetchImpl = globalThis.fetch,
} = {}) {
    let currentUrl = await assertPublicUrl(value);

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        try {
            response = await fetchImpl(currentUrl, {
                method: 'GET',
                redirect: 'manual',
                signal: controller.signal,
                headers: {
                    accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1',
                    'user-agent': 'PolicyChangeMonitor/0.1 (+https://github.com/pdrucker48-lab/policy-change-monitor)',
                },
            });
        } catch (error) {
            if (error.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs / 1000} seconds: ${currentUrl}`);
            throw new Error(`Request failed for ${currentUrl}: ${error.message}`);
        } finally {
            clearTimeout(timer);
        }

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) throw new Error(`Redirect from ${currentUrl} did not include a Location header`);
            if (redirectCount === maxRedirects) throw new Error(`Too many redirects while fetching ${value}`);
            currentUrl = await assertPublicUrl(new URL(location, currentUrl).href);
            continue;
        }

        if (!response.ok) throw new Error(`HTTP ${response.status} returned for ${currentUrl}`);

        const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
        if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) {
            throw new Error(`Unsupported content type ${contentType} for ${currentUrl}`);
        }

        const declaredLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
            throw new Error(`Response exceeds the ${maxResponseBytes}-byte limit for ${currentUrl}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error(`Response body was empty for ${currentUrl}`);
        const chunks = [];
        let byteLength = 0;
        while (true) {
            const { done, value: chunk } = await reader.read();
            if (done) break;
            byteLength += chunk.byteLength;
            if (byteLength > maxResponseBytes) {
                await reader.cancel();
                throw new Error(`Response exceeds the ${maxResponseBytes}-byte limit for ${currentUrl}`);
            }
            chunks.push(chunk);
        }

        const bytes = new Uint8Array(byteLength);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }

        return {
            html: new TextDecoder('utf-8').decode(bytes),
            finalUrl: currentUrl.href,
            contentType,
            byteLength,
        };
    }

    throw new Error(`Unable to fetch ${value}`);
}
