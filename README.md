# Policy & Terms Change Monitor

An Apify Actor that answers the useful question behind a webpage diff: **what contractually important thing changed?**

Give it public terms, privacy, DPA, pricing, SLA, or acceptable-use URLs. The first run saves a clean baseline. Later runs remove common page noise, compare clause-level text, preserve exact before/after fragments, classify the subject, and assign low, medium, or high materiality.

No external AI API or API key is required.

## Best for

- Vendor-risk and procurement teams watching supplier contracts
- Privacy and compliance teams tracking policy, DPA, and data-use changes
- SaaS operators monitoring platform pricing, API limits, SLAs, and acceptable-use rules
- Agencies and consultants who need dated before-and-after evidence for clients

For larger portfolios, one run can monitor up to 500 pages with bounded concurrency. See the [bulk vendor-register onboarding guide](docs/BULK-ONBOARDING.md).

## Pricing

**$0.004 per page check** (US$4 per 1,000 checks). Each URL processed counts as one page check. Baselines, unchanged results, errors, and change records are not charged a second time.

| Portfolio | Schedule | Approximate monthly cost |
| --- | --- | ---: |
| 25 pages | Daily | $3.00 |
| 100 pages | Daily | $12.00 |
| 500 pages | Daily | $60.00 |

Start with the [Enterprise Vendor Policy Pack](https://apify.com/peterdrucker481/policy-change-monitor/examples/enterprise-vendor-policy-pack), or open the [Policy Change Monitor Actor](https://apify.com/peterdrucker481/policy-change-monitor) to monitor your own vendor register.

## What it reports

- Exact added, removed, and modified clause fragments
- Categories: pricing/billing, data use, data retention, liability, termination, arbitration, API limits, service levels, and geographic restrictions
- Overall materiality and plain-language summary
- Source URL, final redirected URL, timestamps, and content hashes
- Optional HTTPS webhook containing all meaningful changes from the run
- Baseline, unchanged, and error records when enabled

## Quick start on Apify

1. Click **Try for free** on the Actor page.
2. Add one or more public URLs under **Pages to monitor**.
3. Run once to establish clean baselines.
4. Save the input as an Actor Task and add a daily or weekly Apify schedule.
5. Keep the same **Snapshot storage name** on future runs. A different name creates an independent set of baselines.

The next scheduled run reports `unchanged`, `changed`, or `error` for every monitored page. Add an HTTPS webhook if you want alerts delivered to your existing workflow.

Example input:

```json
{
  "pages": [
    {
      "url": "https://docs.apify.com/legal/general-terms-and-conditions",
      "label": "Apify Terms"
    },
    {
      "url": "https://docs.apify.com/legal/privacy-policy",
      "label": "Apify Privacy"
    }
  ],
  "stateStoreName": "vendor-policy-baselines",
  "emitBaselines": true,
  "emitUnchanged": true,
  "webhookUrl": "https://hooks.example.com/policy-changes"
}
```

The complete example is in [`examples/input.json`](examples/input.json).

## Ready-made monitoring pages

Use a focused public task when you want a one-click starting point:

- [Terms of Service Change Monitor](https://apify.com/peterdrucker481/policy-change-monitor/examples/terms-change-monitor)
- [Privacy Policy Change Monitor](https://apify.com/peterdrucker481/policy-change-monitor/examples/privacy-policy-change-monitor)
- [Vendor DPA Change Monitor](https://apify.com/peterdrucker481/policy-change-monitor/examples/vendor-dpa-change-monitor)
- [Enterprise Vendor Policy Pack](https://apify.com/peterdrucker481/policy-change-monitor/examples/enterprise-vendor-policy-pack)

Matching task inputs are kept in [`examples/terms-task.json`](examples/terms-task.json), [`examples/privacy-task.json`](examples/privacy-task.json), and [`examples/vendor-dpa-task.json`](examples/vendor-dpa-task.json). Replace the example URL with the vendor page you want to monitor, then schedule the task daily or weekly.

For a multi-vendor starting point, use [`examples/enterprise-vendor-policy-pack.json`](examples/enterprise-vendor-policy-pack.json). It includes eight public AI, cloud, and payments policy pages and should be customized to match the user's real vendor register. Additional focused inputs cover [SaaS pricing and billing](examples/pricing-billing-task.json), [service-level agreements](examples/sla-task.json), and [API acceptable-use policies](examples/api-acceptable-use-task.json).

## Output

Each emitted dataset item has this shape:

```json
{
  "status": "changed",
  "label": "Vendor Terms",
  "sourceUrl": "https://vendor.example/terms",
  "checkedAt": "2026-09-01T14:00:00.000Z",
  "previousCapturedAt": "2026-08-31T14:00:00.000Z",
  "materiality": "high",
  "categories": ["pricing/billing", "arbitration"],
  "summary": "1 modified clause detected across pricing/billing, arbitration.",
  "changedClauses": [
    {
      "type": "modified",
      "before": "The monthly fee is $10.",
      "after": "The monthly fee is $20 and disputes require binding arbitration.",
      "similarity": 0.31,
      "categories": ["pricing/billing", "arbitration"],
      "materiality": "high",
      "materialityReasons": [
        "Pricing, fees, refunds, or billing terms changed",
        "Dispute resolution, arbitration, or class-action terms changed"
      ]
    }
  ]
}
```

The `OUTPUT` record in the run's default key-value store contains aggregate counts and webhook delivery status.

## Reducing false positives

The Actor removes scripts, styles, forms, navigation, headers, footers, sidebars, cookie/consent elements, social widgets, and other common chrome before comparison. For a noisy site, add:

- `ignoreSelectors`: CSS selectors for dynamic regions
- `ignorePatterns`: case-insensitive regular expressions matching entire text blocks to exclude

Avoid broad selectors or patterns that could remove real contract clauses. The Actor limits stored text and reported changes to keep runs predictable.

## Persistent state

Snapshots are stored in a named Apify key-value store. That makes baselines survive across runs and allows several Actor Tasks to share a monitor when they use the same storage name. Use distinct names when different teams or workflows should not share history.

If a page cannot be fetched or parsed, its previous good snapshot is preserved.

## Webhook behavior

The optional webhook is called only when at least one page has a meaningful change. It must use HTTPS and resolve to public IP addresses. Redirects, embedded URL credentials, localhost, private networks, link-local addresses, and cloud metadata hosts are blocked. An optional secret bearer token can be stored in encrypted Actor input.

## Scope and safeguards

This Actor:

- Fetches public HTTP(S) pages without credentials or cookies
- Does not log in, bypass CAPTCHAs, evade access controls, or access restricted content
- Blocks private-network targets and validates redirects to reduce SSRF risk
- Limits redirects, request duration, response size, text blocks, and reported changes
- Uses deterministic rules rather than sending page content to a third-party model

Respect website terms, robots policies, applicable law, and reasonable request frequency. The output is triage information, not legal advice.

## For source reviewers and developers

Requires Node.js 20 or later.

```sh
pnpm install
pnpm test
pnpm start
```

For a local Actor run, place input at `storage/key_value_stores/default/INPUT.json`. Local storage is excluded from Git.

The source records one `page-check` pay-per-event event before each page is processed and stops gracefully when the user's run limit is reached. Test the billing path locally with `ACTOR_TEST_PAY_PER_EVENT=true`; the Apify SDK writes test events to its local charging log.

## Current V1 limitations

- Server-rendered HTML, Markdown, and plain-text pages only; JavaScript-only pages may need a browser-based fallback in a later version.
- Classification is keyword-based and intentionally explainable. It flags likely materiality but does not replace legal review.
- Moves and substantial rewrites can appear as separate removed and added clauses.

## License

No license has been granted for reuse or redistribution. The repository is public for Actor deployment and review.
