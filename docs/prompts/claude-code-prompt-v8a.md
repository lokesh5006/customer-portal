# Claude Code Prompt v8a — Demo Seed Data + Always-Visible Role Demo

Copy everything below this line into Claude Code in VS Code. Run on the project root.

This is the FIRST of two related batches (v8a now, v8b after). v8a focuses on data: seed every invoice and quote scenario, then make the Role Demo dropdown always visible (no `?demo=1` gate). The Admin Tool's force-buttons stay gated under `?demo=1`.

---

## Context

This is the eighth major batch in the Leimberg portal series. Previous batches established the role system, payment flows, suspended state, and other lifecycle behavior. The portal is now feature-complete enough to demo to stakeholders — but the current seed data is sparse, which makes scenarios hard to demonstrate without manipulation.

This batch fixes that by adding deliberately-designed demo data: one invoice example per state, one quote example per lifecycle state, plus a handful of historical entries for "back of the table" realism. After v8a runs, anyone can open the portal and walk through every flow without needing to fake anything.

Before you write any code, read these files in this exact order:

1. `src/contexts/AppContext.tsx` — `initialInvoices`, `initialQuotes`, `initialSubscriptions`, `initialUsers`, `initialCompanies`, `initialLicenses`. Understand the Invoice / Quote / Subscription types and current seed shapes.
2. `src/components/layout/Header.tsx` — the `?demo=1` gate around the Role Demo cluster
3. `src/pages/AdminPage.tsx` — confirm the force-buttons live here gated under `?demo=1`

Do NOT start coding until you have read those three files.

---

## Final Decisions (binding)

| Topic | Decision |
|---|---|
| Role Demo dropdown | Always visible in header. No `?demo=1` gate. Other demo affordances (Force Suspension, Force Renewal Generation, Restore) stay gated under `?demo=1`. |
| Demo data philosophy | One example per state for both invoices and quotes. Tied to seeded companies (ABC + XYZ). Dates calculated relative to "today" so they remain realistic over time. |
| State of seeded subscriptions | Do NOT auto-suspend ABC's primary subscription via seed data — keep it active so the demo's default state is healthy. Demo can use the Force Suspension button to trigger the suspended scenario. |
| Currency formatting | All seeded invoice amounts use `formatCurrency` when displayed (already in `src/lib/format.ts`). |

---

## Change 1 — Always-visible Role Demo dropdown

### 1.1 Header changes

**File: `src/components/layout/Header.tsx`**

Currently the Role Demo dropdown + role badges + (possibly) the proxy banner sit inside a `{demoMode && (...)}` block. Restructure so:

- **Role Demo dropdown + role badges**: render UNCONDITIONALLY. No demo gate.
- **Proxy session banner**: keep behind the `demoMode` gate as today.

Concretely, the demo mode detection stays in place (for the proxy banner and the Admin Tool force-buttons), but the role cluster jumps out of the conditional.

Add a small visual cue so users know the role switcher is a demo affordance, not a production feature. Suggested treatment:
- The dropdown trigger button gets a small "Demo" label in muted text inline before the role icons, e.g., `<span className="text-xs text-muted-foreground mr-1">Demo:</span>`
- The dropdown menu header has a description line: "Switch roles to preview different user experiences. Demo only."

This signals to demo viewers that the dropdown is not part of the production product.

### 1.2 Admin Tool force-buttons stay gated

In `AdminPage.tsx`, the Force Generate Renewal Invoices, Force Subscription Suspension, and Restore Active Subscription buttons continue to use the `demoMode` check from `sessionStorage`/`?demo=1`. Do NOT make those buttons always visible.

The reasoning: the Role Demo dropdown is a viewing affordance (no data is mutated), while the Force buttons mutate state. For a demo guide, the user opens `?demo=1` once on the Admin Tool page to access force buttons, but the role switcher works without that step.

---

## Change 2 — Demo seed data: Invoices

### 2.1 Invoice scenarios to seed

The following scenarios MUST exist in `initialInvoices` after this change. Each scenario serves a specific demo purpose.

**For ABC Accounting (`company-1`, Pay on Receipt):**

| ID | Status | Source | Description | Demo purpose |
|---|---|---|---|---|
| `inv-abc-001` | `paid` | `checkout` | "Initial subscription purchase" | Invoice history, settled state |
| `inv-abc-002` | `paid` | `license_change` | "License adjustment — added 2 seats" | Mid-cycle adjustment, paid |
| `inv-abc-003` | `awaiting_payment` | `license_change` | "License adjustment — added 5 seats" | Pay flow from invoice, banner Pay button |
| `inv-abc-004` | `upcoming` | `renewal` | "Annual renewal — {year+1}" | Auto-generated 30-day renewal preview |
| `inv-abc-005` | `paid` | `checkout` | "Initial purchase — NumberCruncher Web Team Expansion" | Tied to ABC's second subscription (multi-sub demo) |
| `inv-abc-006` | `overdue` | `license_change` | "License adjustment — past due" | Overdue state, dunning UX (note: this won't drive suspension because subscription stays active; suspension comes from the renewal flow via Admin Tool) |

**For XYZ Consulting (`company-2`, Pay on Terms):**

| ID | Status | Source | Description | Demo purpose |
|---|---|---|---|---|
| `inv-xyz-001` | `payment_terms_applied` | `checkout` | "Initial subscription purchase" | Net 30 initial, subscription still active |
| `inv-xyz-002` | `paid` | `checkout` | "Prior year subscription" | Historical paid invoice |
| `inv-xyz-003` | `payment_terms_applied` | `renewal` | "Annual renewal — {year+1}" | Auto-renewal under terms |
| `inv-xyz-004` | `paid` | `quote_accept` | "Quote QU-XYZ-002 — Accepted with PO" — PO #PO-2025-XYZ-014 | PO carry-through from quote to invoice |

### 2.2 Date calculation rules

To keep dates realistic without manual maintenance, compute them relative to "today" (use `new Date()` at module load time):

```ts
const DAYS = (n: number) => 1000 * 60 * 60 * 24 * n;
const today = new Date();
const isoDaysAgo = (n: number) => new Date(today.getTime() - DAYS(n)).toISOString();
const isoDaysAhead = (n: number) => new Date(today.getTime() + DAYS(n)).toISOString();
```

Apply these date offsets per invoice:

| ID | `date` | `dueDate` | `paidAt` |
|---|---|---|---|
| `inv-abc-001` | -300 days | -270 days | -260 days |
| `inv-abc-002` | -60 days | -30 days | -25 days |
| `inv-abc-003` | -5 days | +25 days | null |
| `inv-abc-004` | +5 days | +25 days (within 30-day window, so it shows as upcoming) | null |
| `inv-abc-005` | -180 days | -150 days | -145 days |
| `inv-abc-006` | -90 days | -60 days | null (overdue) |
| `inv-xyz-001` | -200 days | -170 days | null (terms applied, not paid yet) |
| `inv-xyz-002` | -560 days | -530 days | -525 days |
| `inv-xyz-003` | +10 days | +40 days (Net 30) | null |
| `inv-xyz-004` | -45 days | -15 days | -10 days |

### 2.3 Invoice data shape

Each invoice should be a complete object matching the existing `Invoice` interface. Pay particular attention to:

- `subscriptionId` — link to the correct subscription
- `subscriptionName` — should mirror the linked subscription's name
- `lineItems` — at least one realistic line item per invoice
- `subtotal`, `tax`, `totalAmount`, `balance` — consistent (`tax = subtotal * 0.07`, `total = subtotal + tax`, `balance = total - any payments applied`)
- `activatesSubscription` — set to `true` ONLY for the initial Pay-on-Receipt invoice that activates a Pending Payment subscription. For all others, `false`.
- `poNumber` — set on `inv-xyz-004` only

Realistic line items: 1-3 line items per invoice referencing products from the subscription. Quantities and unit prices should match the subscription's product configuration so totals reconcile.

### 2.4 Remove old generic-demo invoices

If `initialInvoices` currently contains throwaway invoices like `INV-2024-001`, `INV-2024-002` etc. that aren't tied to specific scenarios, remove them. The new scenario-driven invoices replace them entirely.

Keep any seeded renewal invoice that the v6a runtime generator depends on, IF that generator looks for existing entries to skip duplicates. The new `inv-abc-004` and `inv-xyz-003` cover the renewal slot.

---

## Change 3 — Demo seed data: Quotes

### 3.1 Quote scenarios to seed

**For ABC Accounting:**

| ID | Status | Notes | Demo purpose |
|---|---|---|---|
| `quote-abc-001` | `active` | Created today, 30 days to expire | Happy-path accept/decline |
| `quote-abc-002` | `active` | Created 28 days ago, 2 days remaining | Urgency/expiring-soon UX |
| `quote-abc-003` | `declined` | Reason: "Evaluating budget for Q3 — will revisit." | View Decline Reason in action menu |
| `quote-abc-004` | `declined` | No reason captured | Action menu does NOT show View Reason |
| `quote-abc-005` | `accepted` | PO captured at accept (PO #PO-2025-ABC-009), led to a subscription expansion | Quote-to-invoice conversion, history |
| `quote-abc-006` | `expired` | Past expiry without action | Expired-state viewing |

**For XYZ Consulting:**

| ID | Status | Notes | Demo purpose |
|---|---|---|---|
| `quote-xyz-001` | `active` | Created 5 days ago | Active quote across companies |
| `quote-xyz-002` | `accepted` | PO #PO-2025-XYZ-014, ties to `inv-xyz-004` | PO carry-through demo |

### 3.2 Date calculation per quote

| ID | `createdDate` | `expiryDate` | `acceptedAt` / `declinedAt` |
|---|---|---|---|
| `quote-abc-001` | today | +30 days | — |
| `quote-abc-002` | -28 days | +2 days | — |
| `quote-abc-003` | -10 days | +20 days | declined -3 days ago |
| `quote-abc-004` | -15 days | +15 days | declined -5 days ago |
| `quote-abc-005` | -60 days | -30 days | accepted -45 days ago |
| `quote-abc-006` | -45 days | -15 days | — (expired without action) |
| `quote-xyz-001` | -5 days | +25 days | — |
| `quote-xyz-002` | -50 days | -20 days | accepted -45 days ago (PO captured at accept) |

### 3.3 Quote line items

Each quote should reference 1-2 products with realistic seat counts and pricing. Use products from the `PRODUCT_CATALOG` (NumberCruncher Desktop, NumberCruncher Web, QuickView Desktop, DataNet). Vary the mix across quotes so the Products column in the new Quotes table (coming in v8b) renders interestingly:

- `quote-abc-001` — NumberCruncher Web (5 seats)
- `quote-abc-002` — NumberCruncher Desktop (3 seats) + QuickView Desktop (2 seats)
- `quote-abc-003` — NumberCruncher Web (10 seats)
- `quote-abc-004` — QuickView Desktop (5 seats)
- `quote-abc-005` — NumberCruncher Desktop (4 seats)
- `quote-abc-006` — NumberCruncher Web (8 seats)
- `quote-xyz-001` — NumberCruncher Desktop (6 seats) + DataNet standalone (1 seat)
- `quote-xyz-002` — QuickView Desktop (3 seats)

Totals: compute `subtotal`, `tax (7%)`, `totalAmount` per quote consistently.

### 3.4 Decline reason field

Make sure the seeded `quote-abc-003` has a non-empty `declineReason` field and `quote-abc-004` has `declineReason: undefined` or absent. This drives the action-menu visibility test for "View Decline Reason."

### 3.5 Remove old generic quotes

If `initialQuotes` contains generic Q-1001, Q-1002, Q-1003 entries from earlier prompts, replace them entirely with the eight above. Keep IDs distinct from invoice IDs.

---

## Change 4 — Coordination notes

### 4.1 Runtime renewal-invoice generator

A previous prompt added a `useEffect` in `AppProvider` that generates renewal invoices 30 days before subscription renewal. After this change, `inv-abc-004` and `inv-xyz-003` already serve that role for the seeded subscriptions. Verify the generator's duplicate check still detects them (it should — it looks at `subscriptionId + source === 'renewal' + period year`).

If the duplicate check is too strict and the generator creates extras, adjust it to skip when ANY renewal invoice exists for the subscription's NEXT renewal period.

### 4.2 Trial license seed (from v7b)

The v7b TrialBanner expects at least one near-future trial license. Verify it remains in seed:

```ts
// inside initialLicenses
{
  id: 'lic-abc-trial-qv',
  userId: 'user-abc-1',  // John Smith
  subscriptionId: 'sub-1',
  productId: '<prod-qv-trial in sub-1>',
  licenseType: 'trial',
  trialExpiresAt: isoDaysAhead(12),
  assignedAt: isoDaysAgo(18),
}
```

If the underlying `prod-qv-trial` product was removed from `sub-1` during seed cleanup, add it back so the license has a valid target.

### 4.3 Auto-suspension on app load

The v7b suspension auto-escalator runs on mount and flips active-but-expired subscriptions to suspended. None of the new seed subscriptions should trigger this: ABC's renewal is in the future (per the new dates), XYZ is exempt anyway (Pay on Terms). Verify by mounting the app: no subscription should be in `suspended` state by default.

---

## What NOT to touch

- The Leimberg branding, colors, fonts
- The role system (`Role` type, `ROLE_LABELS`, `pageAccess`, `can()`)
- The first-time-customer gate logic
- The read-only banner architecture (only the data underneath changes)
- The shadcn UI primitives
- The Payment Methods page or its data model
- The DataNet seed data (`dataNetUpdates`) — already curated, no change
- The Newsletter / News page seed
- Any business logic, only data and the header role-switcher visibility

---

## Acceptance criteria

When you're done, all of these must be true:

1. `npm run dev` and `npm run build` complete without errors.
2. On any page, the Role Demo dropdown is visible in the top header regardless of `?demo=1`. The label includes a "Demo:" prefix or similar visual cue.
3. The Admin Tool force-buttons (Force Generate Renewal Invoices, Force Subscription Suspension, Restore Active Subscription) remain hidden unless `?demo=1` is active.
4. Logging in as `john.smith@abcaccounting.com`, the Invoices table shows EXACTLY 6 ABC invoices (`inv-abc-001` through `inv-abc-006`) plus any auto-generated entries. Each one has a status that matches its scenario.
5. The Invoices table shows one invoice with status `Awaiting Payment` (`inv-abc-003`).
6. The Invoices table shows one invoice with status `Upcoming` (`inv-abc-004`).
7. The Invoices table shows one invoice with status `Overdue` (`inv-abc-006`).
8. Logging in as `michael.chen@xyzconsulting.com`, the Invoices table shows EXACTLY 4 XYZ invoices, including two with status `Payment Terms Applied` (Net 30).
9. One XYZ invoice (`inv-xyz-004`) shows a PO number on its description second line.
10. The Quotes table shows EXACTLY 6 ABC quotes plus 2 XYZ quotes (when viewed as the respective company).
11. Quotes show one of each state: Active fresh, Active expiring soon, Declined-with-reason, Declined-no-reason, Accepted, Expired.
12. `quote-abc-003`'s 3-dot menu shows "View Decline Reason" item. `quote-abc-004`'s menu does NOT.
13. After Force Generate Renewal Invoices is clicked, no DUPLICATE renewal invoices appear for `sub-1` or XYZ's subscription. The existing seeded renewals are detected.
14. The Trial banner appears for John Smith on every page (his QuickView trial license still has ~12 days remaining).
15. No subscription is in `suspended` status on first load. The default state is healthy across both seeded companies.

---

## Manual demo flow to verify

1. Log in as `john.smith@abcaccounting.com`. The Role Demo dropdown is in the header — no `?demo=1` needed. Confirm it shows "Demo:" prefix or equivalent label.
2. Switch via the Role Demo dropdown to "Registered Contact only." The sidebar collapses appropriately.
3. Switch back to Account Owner.
4. Visit Invoices. Confirm 6 invoices, one of each scenario, with correct statuses.
5. Visit Quotes. Confirm 6 quotes, one of each lifecycle state.
6. Open the 3-dot menu on the Declined (with reason) quote. "View Decline Reason" is present.
7. Open the 3-dot menu on the Declined (no reason) quote. "View Decline Reason" is absent.
8. Visit the Trial banner — present, ~12 days remaining for QuickView.
9. Open `?demo=1`. Visit Admin Tool. Force buttons are now visible.
10. Click Force Generate Renewal Invoices. No duplicates appear because the seeded renewals already cover the upcoming period.
11. Log out, log in as `michael.chen@xyzconsulting.com`. Confirm 4 invoices, including 2 Net 30 entries. The PO invoice shows the PO number.

---

## Reporting back

At the end of your run, summarize:

1. Every file modified.
2. The total count of seeded invoices and quotes after this change.
3. Confirmation that the Role Demo dropdown is always visible AND the Admin Tool force-buttons remain `?demo=1`-gated.
4. Confirmation that no seeded subscription is in `suspended` status on first load.
5. Confirmation that the renewal-invoice generator does not create duplicates against the seeded renewals.
6. Any seeded entry whose values you had to invent because the spec was ambiguous (e.g., line items, exact amounts).
7. The output of `npm run build`.

Do not commit. I will review.
