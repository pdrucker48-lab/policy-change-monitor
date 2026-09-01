import { createHash } from 'node:crypto';
import { load } from 'cheerio';

const DEFAULT_IGNORED_SELECTORS = [
    'script',
    'style',
    'noscript',
    'svg',
    'canvas',
    'iframe',
    'form',
    'nav',
    'header',
    'footer',
    'aside',
    '[aria-hidden="true"]',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]',
    '[class*="cookie"]',
    '[id*="cookie"]',
    '[class*="consent"]',
    '[id*="consent"]',
    '[class*="breadcrumb"]',
    '[class*="social-share"]',
    '[class*="newsletter"]',
];

function cleanText(value) {
    return value
        .replace(/\u00a0/g, ' ')
        .replace(/[\t\r\n ]+/g, ' ')
        .trim();
}

function compileIgnorePatterns(patterns) {
    return patterns.map((pattern) => {
        if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > 250) {
            throw new Error('Each ignore pattern must contain 1–250 characters');
        }
        try {
            return new RegExp(pattern, 'i');
        } catch (error) {
            throw new Error(`Invalid ignore pattern "${pattern}": ${error.message}`);
        }
    });
}

function isUsefulBlock(text, patterns) {
    if (!text || text.length < 3 || patterns.some((pattern) => pattern.test(text))) return false;
    if (/^(home|menu|close|search|skip to (main )?content|back to top)$/i.test(text)) return false;
    return true;
}

export function normalizeHtml(html, { ignoreSelectors = [], ignorePatterns = [], maxBlocks = 2_000 } = {}) {
    const $ = load(html);
    const title = cleanText($('title').first().text());

    for (const selector of [...DEFAULT_IGNORED_SELECTORS, ...ignoreSelectors]) {
        if (typeof selector !== 'string' || selector.length === 0 || selector.length > 250) {
            throw new Error('Each ignored selector must contain 1–250 characters');
        }
        try {
            $(selector).remove();
        } catch (error) {
            throw new Error(`Invalid CSS selector "${selector}": ${error.message}`);
        }
    }

    const patterns = compileIgnorePatterns(ignorePatterns);
    const root = $('main').first().length
        ? $('main').first()
        : $('article').first().length
            ? $('article').first()
            : $('body').first();

    const blocks = [];
    root.find('h1,h2,h3,h4,h5,h6,p,li,blockquote,dt,dd,pre,table tr').each((_, element) => {
        if (blocks.length >= maxBlocks) return false;
        const node = $(element);
        const text = element.tagName === 'tr'
            ? node.find('th,td').map((__, cell) => cleanText($(cell).text())).get().filter(Boolean).join(' | ')
            : cleanText(node.text());
        if (isUsefulBlock(text, patterns) && blocks.at(-1) !== text) blocks.push(text.slice(0, 4_000));
        return undefined;
    });

    if (blocks.length === 0) {
        const fallback = root.text().split(/\n+/).map(cleanText).filter((text) => isUsefulBlock(text, patterns));
        for (const text of fallback) {
            if (blocks.length >= maxBlocks) break;
            if (blocks.at(-1) !== text) blocks.push(text.slice(0, 4_000));
        }
    }

    if (blocks.length === 0) throw new Error('No meaningful text content was found on the page');

    const normalizedText = blocks.join('\n');
    return {
        title,
        blocks,
        textLength: normalizedText.length,
        contentHash: createHash('sha256').update(normalizedText).digest('hex'),
    };
}
