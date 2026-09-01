# Bulk vendor-register onboarding

Policy Change Monitor is most valuable when one procurement, compliance, or advisory team monitors a large portfolio rather than a single page.

## Capacity

- Up to 500 public pages per run
- Five concurrent checks by default, configurable from one to ten
- One named snapshot store per independent client, portfolio, or environment
- A caller-controlled Apify spending limit still stops future checks when reached

At the published price of $0.004 per page check:

| Portfolio | Schedule | Approximate checks/month | Gross price/month |
| --- | --- | ---: | ---: |
| 100 pages | Weekly | 433 | $1.73 |
| 100 pages | Daily | 3,000 | $12.00 |
| 500 pages | Daily | 15,000 | $60.00 |
| 2,000 pages across four tasks | Daily | 60,000 | $240.00 |

The highest-leverage customer is therefore a compliance consultant, managed service provider, procurement platform, or vendor-risk team managing hundreds or thousands of supplier documents.

## Fastest onboarding path

1. Export the vendor register with one row per public document URL.
2. Convert it to the Actor `pages` array with a clear `label` such as `Vendor — DPA`.
3. Split lists larger than 500 pages into stable portfolio tasks.
4. Use a unique `stateStoreName` for each portfolio.
5. Run once to create baselines, then schedule daily or weekly checks.
6. Deliver only meaningful changes to the team's HTTPS webhook.

The ready-made [`enterprise-vendor-policy-pack.json`](../examples/enterprise-vendor-policy-pack.json) shows a multi-vendor input. Replace those URLs with the customer's actual contracted vendors before production use.

## Revenue-oriented packaging

Keep the Actor price unchanged for now. Sell the workflow, not an isolated diff:

- **Vendor register watch:** all terms, privacy, DPA, SLA, pricing, and acceptable-use pages
- **Client portfolio watch:** one named state store and webhook per consulting client
- **AI vendor watch:** AI providers' service terms, privacy, DPA, and usage policies
- **Payments stack watch:** processors, merchant agreements, DPAs, and prohibited-business policies

The self-serve Actor remains $0.004 per check. A later managed setup service can be priced separately only after there is evidence of demand and an authorized sales channel.
