const CATEGORY_RULES = [
    {
        category: 'pricing/billing',
        materiality: 'high',
        reason: 'Pricing, fees, refunds, or billing terms changed',
        pattern: /\b(price|pricing|fee|fees|charge|charges|billing|invoice|payment|paid|refund|renewal|subscription|tax(?:es)?)\b/i,
    },
    {
        category: 'data use',
        materiality: 'high',
        reason: 'Personal-data collection, use, sharing, or processing changed',
        pattern: /\b(personal data|personal information|collect|collection|process(?:ing)?|share|sharing|sell|advertis(?:e|ing)|profil(?:e|ing)|tracking)\b/i,
    },
    {
        category: 'data retention',
        materiality: 'high',
        reason: 'Data retention or deletion obligations changed',
        pattern: /\b(retain|retention|delete|deletion|erase|erasure|storage period|stored for)\b/i,
    },
    {
        category: 'liability',
        materiality: 'high',
        reason: 'Liability, warranty, damages, or indemnity terms changed',
        pattern: /\b(liability|liable|indemni(?:ty|fy|fication)|warrant(?:y|ies)|damages|disclaimer|limitation of liability)\b/i,
    },
    {
        category: 'termination',
        materiality: 'high',
        reason: 'Suspension, cancellation, or termination rights changed',
        pattern: /\b(terminat(?:e|ion)|suspend|suspension|cancel|cancellation|close your account|disable access)\b/i,
    },
    {
        category: 'arbitration',
        materiality: 'high',
        reason: 'Dispute resolution, arbitration, or class-action terms changed',
        pattern: /\b(arbitrat(?:e|ion)|class action|dispute resolution|jury trial|governing law|jurisdiction|venue)\b/i,
    },
    {
        category: 'API limits',
        materiality: 'medium',
        reason: 'API access, quotas, or usage limits changed',
        pattern: /\b(API|rate limit|quota|request limit|usage limit|throttl(?:e|ing)|developer access)\b/i,
    },
    {
        category: 'service levels',
        materiality: 'medium',
        reason: 'Availability, support, credits, or service-level commitments changed',
        pattern: /\b(SLA|service level|uptime|availability|service credit|support response|maintenance window|downtime)\b/i,
    },
    {
        category: 'geographic restrictions',
        materiality: 'high',
        reason: 'Country, residency, sanctions, or territorial restrictions changed',
        pattern: /\b(country|countries|territor(?:y|ies)|region|resident|residency|geographic|sanction|embargo|export control)\b/i,
    },
];

const MATERIALITY_RANK = { low: 1, medium: 2, high: 3 };

export function classifyClause(change) {
    const text = `${change.before ?? ''}\n${change.after ?? ''}`;
    const matches = CATEGORY_RULES.filter((rule) => rule.pattern.test(text));
    const categories = [...new Set(matches.map((rule) => rule.category))];
    const materiality = matches.reduce(
        (highest, rule) => MATERIALITY_RANK[rule.materiality] > MATERIALITY_RANK[highest] ? rule.materiality : highest,
        'low',
    );

    return {
        ...change,
        categories,
        materiality,
        materialityReasons: [...new Set(matches.map((rule) => rule.reason))],
    };
}

export function summarizeChanges(changes) {
    const categorized = changes.map(classifyClause);
    const categories = [...new Set(categorized.flatMap((change) => change.categories))];
    const materiality = categorized.reduce(
        (highest, change) => MATERIALITY_RANK[change.materiality] > MATERIALITY_RANK[highest] ? change.materiality : highest,
        'low',
    );
    const counts = categorized.reduce((result, change) => {
        result[change.type] = (result[change.type] ?? 0) + 1;
        return result;
    }, {});
    const parts = [
        counts.modified ? `${counts.modified} modified` : null,
        counts.added ? `${counts.added} added` : null,
        counts.removed ? `${counts.removed} removed` : null,
    ].filter(Boolean);

    return {
        changes: categorized,
        categories,
        materiality,
        summary: `${parts.join(', ')} clause${categorized.length === 1 ? '' : 's'} detected${categories.length ? ` across ${categories.join(', ')}` : ''}.`,
    };
}
