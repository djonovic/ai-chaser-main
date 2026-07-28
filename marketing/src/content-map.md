# Content-intent ownership map

Developer-facing reference: which page owns which search intent. When adding or editing
content, keep each intent on its owning page and **link** to that page from others instead
of duplicating templates, FAQs or intros. This prevents keyword cannibalization.

Last updated: 2026-07-28

## Hub

| Page | Owns |
| --- | --- |
| `/templates/invoice-reminder-email-template` | Generic "invoice reminder email template", one concise example per stage, links out to every stage page |
| `/templates` | Template library index (navigation page, no template content of its own) |

## Reminder stages

| Page | Owns | Prev / next stage |
| --- | --- | --- |
| `/templates/friendly-payment-reminder-email` | Friendly/polite/gentle reminders; before due, due today, first week overdue | next: second reminder |
| `/templates/second-invoice-reminder-email` | Second/2nd reminder, follow-up after no response, payment-date requests | prev: friendly, next: firm |
| `/templates/firm-payment-reminder-email` | Firm/strong reminder wording, 2+ weeks overdue | prev: second, next: final notice |
| `/templates/final-notice-unpaid-invoice-email` | Final notice/final demand letter + email, escalation wording | prev: firm |

## Scenario pages

| Page | Owns | Do NOT put here |
| --- | --- | --- |
| `/templates/overdue-invoice-email-template` | Standalone overdue emails **by day** (1/3/7/14/30), disputed invoice, missed promise | Sequence timing/automation content (belongs to -sequence) |
| `/templates/overdue-invoice-email-sequence` | The **automated campaign**: send days, tone progression, stop conditions, deployment | Individual copy-paste day emails (belongs to -template) |
| `/templates/past-due-invoice-notice-template` | Formal **notices**: letter format, 30/60/90-day notices, invoice-summary block | Conversational reminders |
| `/templates/late-payment-fee-email-template` | Invoice late fee **wording**: terms, footers, fee-applied emails, fixed vs % | Fee math (belongs to /tools/invoice-late-fee-calculator) |
| `/templates/email-to-accounts-payable-overdue-invoice` | AP-department follow-ups, PO/reference issues, AP escalation | Direct-client reminders |
| `/templates/payment-reminder-email-subject-lines` | Subject lines only, grouped by stage, linking to each stage's body templates | Full email bodies |

## Industry pages

| Page | Owns |
| --- | --- |
| `/templates/freelancer-invoice-reminder-email-template` | Freelancer-specific tone/scenarios |
| `/templates/agency-invoice-reminder-email-template` | Agency/retainer scenarios |
| `/templates/trades-invoice-payment-reminder-email` | Trades/contractor job billing |
| `/templates/subcontractor-payment-reminder-email` | Subcontractor-to-GC scenarios |

## Guides

| Page | Owns |
| --- | --- |
| `/guides/how-to-chase-unpaid-invoices` | Overall strategy: tone, escalation, when to get help |
| `/guides/unpaid-invoice-follow-up-schedule` | Day-by-day **timing** (the "when", not the "what to write") |
| `/guides/net-30-overdue-what-to-send` | Net-30-specific scripts and timing |

## Commercial / comparison

| Page | Owns |
| --- | --- |
| `/` | Brand ("ChaseAI") + category ("automated invoice chasing software") + conversion |
| `/best-invoice-chasing-software` | Category comparison: all "best/top invoice chasing software" variants |
| `/invoice-chasing-software-for-freelancers` | Freelancer-specific software intent |
| `/vs/chaser` | "Chaser pricing", Chaser alternatives, ChaseAI vs Chaser |
| `/vs/paidnice`, `/vs/satago`, `/vs/manual-chasing` | Respective competitor comparisons |
| `/vs` | Comparison index (navigation) |

## Shared conventions

- Canonicals: no trailing slashes (enforced by `src/lib/canonical.ts` + `trailingSlash: 'never'`).
- Breadcrumbs: pass `breadcrumbs` to `BaseLayout`; it renders the visible trail **and** the
  matching `BreadcrumbList` JSON-LD.
- Copyable templates: use `components/seo/CopyBlock.astro` (never hand-rolled `<pre>` + button).
- Timelines: use `components/seo/TimelineSteps.astro` (never Mermaid/gantt source).
- "Last verified" dates on comparison pages: `src/lib/verification.ts` + `LastVerified.astro`.
- FAQ blocks must be unique per page and match the page's `FAQPage` JSON-LD.
