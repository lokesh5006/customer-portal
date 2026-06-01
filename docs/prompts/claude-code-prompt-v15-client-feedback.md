# Claude Code Prompt v15 — Client Feedback Implementation

Copy everything below this line into Claude Code in VS Code. Run on the project root (`cusotmerportal2`). This runs AFTER v14 has been committed.

**Context:** The client provided feedback on the prototype across 9 user stories (#1525–#1626). Most items are already in the build after v14. This prompt implements the remaining gaps. The biggest item is a new per-subscription detail page with Overview / Invoices / Quotes tabs scoped to that subscription. Other items: dashboard Account Status semantic states, "X/Y seats available" format, Product Downloads flyout cleanup with a Resources rename, and a few smaller polish items.

**Commit strategy:** ONE atomic commit at the end. Do not commit until I review.

---

## Pre-reading (do this first)

Read the current state of:

1. `src/contexts/AppContext.tsx` — current Company, Subscription, Invoice, Quote types; current AccountStatus type if any
2. `src/pages/Dashboard.tsx` — verify current Account Status rendering and the Welcome greeting
3. `src/pages/SubscriptionsPage.tsx` — the list page (the current entry point)
4. `src/pages/BillingPage.tsx` (Invoices) — the sidebar Invoices page
5. `src/pages/QuotesPage.tsx` — the sidebar Quotes page
6. `src/pages/ProductDownloadsPage.tsx` (or wherever Product Downloads lives) — verify current state vs the changes below
7. `src/lib/permissions.ts` — for the new edit_billing_details action

Confirm pre-reading before any code changes.

---

## Section A — Dashboard Account Status semantic states

Replace the current generic green/red Account Status with three explicitly named states tied to actual conditions.

### A1. Define the AccountStatus computation

Add a helper `computeAccountStatus(company: Company, subscriptions: Subscription[], invoices: Invoice[]): AccountStatusState` where:

```ts
type AccountStatusState =
  | { state: 'account_current'; renewalDate: string }
  | { state: 'additional_license_invoice_due'; invoiceAmount: number; invoiceId: string }
  | { state: 'annual_fee_due'; invoiceAmount: number; renewalDate: string; invoiceId: string };
```

Computation rules (apply in this order — first match wins):

1. If the company has an **awaiting-payment invoice with source = mid_cycle_license** → `additional_license_invoice_due`.
2. If the company has an **awaiting-payment invoice with source = renewal** (or the renewal is within 30 days and not yet paid) → `annual_fee_due`.
3. Otherwise → `account_current`.

### A2. Render the three states on Dashboard

In `Dashboard.tsx`, the Account Status block (which currently lives in the upper-left and currently has generic content):

**State: account_current**
- Background: `#e6f5e6` (very light green)
- Heading: "Account is Current" (bold)
- Subtitle: "Renews {renewalDate}" (e.g., "Renews December 1, 2026")
- Optional check icon (lucide CheckCircle2) in the top-left of the card

**State: additional_license_invoice_due**
- Background: `#FFF8E1` (light yellow)
- Heading: "Additional License Invoice Due" (bold)
- Subtitle: "${invoiceAmount} due — Pay now"
- "Pay Now" primary button on the right side of the card → routes to `/pay?invoice={invoiceId}`
- Optional warning icon (lucide AlertCircle) tinted amber

**State: annual_fee_due**
- Background: `#FFF4E6` (light orange/amber — slightly warmer than yellow)
- Heading: "Annual Fee Due" (bold)
- Subtitle: "${invoiceAmount} due — Renews {renewalDate}"
- "Pay Now" primary button → routes to `/pay?invoice={invoiceId}`
- Optional warning icon

### A3. Dashboard Welcome subtitle

Under "Welcome, John!" greeting, add small font subtitle showing the company name: "ABC Accounting" (or whichever company is logged in). Style: `text-sm text-muted-foreground`.

### A4. Account Status block sizing

The Account Status block should span the space of LEFT + CENTER columns (per #1525). If the dashboard grid is `grid-cols-3`, Account Status should use `col-span-2`. The right column is the DataNet card.

### A5. Build checkpoint

`npm run build` should be clean. Demo: as john.smith of ABC, dashboard should show one of the three states based on seeded invoice data. Force the states by manipulating seed data or use the Admin Tool's "Force Renewal Generation" button to trigger annual_fee_due.

---

## Section B — License Assignments row format

In the Dashboard's License Assignments section (the per-product rows), change the "available" indicator:

**Current:** "2 available"
**New:** "2/30 seats available"

Where the format is `{availableSeats}/{totalPaidSeats} seats available`. For products with no available seats: "0/30 seats available" (still shown for consistency).

Apply to every License Assignments row on the Dashboard. The format does NOT change inside the Manage Licenses drawer (where the structured count fields are different).

### B1. Build checkpoint

`npm run build`. Verify the format on the Dashboard's License Assignments section.

---

## Section C — Subscription Detail Page with Tabs (the major new piece)

This is the biggest section. Currently the Subscriptions page is a list. Clicking a subscription opens the existing drawer. **The new model:** Subscriptions list → click → goes to a dedicated detail page with **Overview / Invoices / Quotes** tabs scoped to that subscription.

### C1. Route structure

Add a new route: `/subscriptions/:subscriptionId`

The page component: `src/pages/SubscriptionDetailPage.tsx`

Update `SubscriptionsPage.tsx` so each subscription card in the list is clickable (or has a "View" button) → navigates to `/subscriptions/{id}`.

The Manage Licenses drawer continues to work from the list page (as it does today) — don't remove that. But the primary path to a subscription is now the detail page.

### C2. Subscription Detail Page structure

```tsx
<SubscriptionDetailPage>
  <Breadcrumb>Dashboard > Subscriptions > {subscription name}</Breadcrumb>

  <PageHeader>
    <h1>{subscription.name}</h1>
    <p>{statusBadge} · Renews {renewalDate}</p>
  </PageHeader>

  {/* Subscription selector (multi-subscription companies only) */}
  {companyHasMultipleSubscriptions && (
    <SubscriptionSelector>
      [Subscription A] [Subscription B]
    </SubscriptionSelector>
  )}

  <Tabs defaultValue="overview">
    <TabsList>
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="invoices">Invoices</TabsTrigger>
      <TabsTrigger value="quotes">Quotes</TabsTrigger>
    </TabsList>

    <TabsContent value="overview">
      <OverviewTab subscription={subscription} />
    </TabsContent>

    <TabsContent value="invoices">
      <InvoicesTab subscriptionId={subscription.id} />  {/* filtered to this sub */}
    </TabsContent>

    <TabsContent value="quotes">
      <QuotesTab subscriptionId={subscription.id} />  {/* filtered to this sub */}
    </TabsContent>
  </Tabs>
</SubscriptionDetailPage>
```

The subscription selector (Subscription A / B buttons) renders only when the company has more than one active subscription. Since we locked single-subscription per company in v14, this section is structurally present but visually inactive — confirm it renders nothing visible when there's only one subscription.

### C3. Overview tab content

Two-column layout. Left column ~60% width, right column ~40% width.

**Left column (main content):**

a. **Subscription & Licenses** block (existing data, reformatted):
   - Header: "Subscription & Licenses"
   - For each product on this subscription:
     - Product name
     - Paid licenses count
     - Available seats indicator ("2/30 seats available" format from Section B)
     - "Manage Licenses" button → opens the existing Manage Licenses drawer

b. **Payment info** block (new):
   - Header: "Payment"
   - Line: "You last paid by {paymentMethodDescription}" — where paymentMethodDescription is sourced from the most recent paid invoice's payment method (e.g., "Visa ending in 4242" or "ACH from Bank of America" or "Paper Check #12345")
   - **Renewal options** list — these are the available payment methods at renewal time:
     - Direct ACH
     - Credit Card
     - ACH e-Check
     - Paper Check
     - Invoice Only (Net 30)
   - Render as a vertical list with checkbox or radio indicators showing which are configured for this company. The list is INFORMATIONAL — the actual payment method picker happens during checkout/payment. Just show what's available.

**Right column (Billing Details card):**

c. **Billing Details** card (new, editable):
   - Header: "Billing Details" with an Edit pencil icon button on hover (top-right of the card)
   - Fields displayed:
     - **Company Name:** {company.name}
     - **Address:** {company.address — multi-line; if missing, "Not set"}
     - **Company Contact(s):** {comma-separated list of company-contact users}
     - **Email Addresses:** {comma-separated list of those contacts' emails}
   - Edit pencil click → opens a small dialog/popover with editable form (see C4)
   - Role gating: Edit pencil is visible only to AO + BA. License Admin and Registered Contact see read-only.

### C4. Billing Details edit popup

Create `src/components/subscriptions/EditBillingDetailsDialog.tsx`.

**Dialog content:**
- Title: "Edit Billing Details"
- Fields:
  - Company Name (text input, required)
  - Address Line 1 (text input)
  - Address Line 2 (text input, optional)
  - City (text input)
  - State / Region (text input)
  - Postal Code (text input)
  - Country (text input, default "United States")
  - Company Contacts: multi-select from existing users in this company (chips/tags interface). Selected users' emails are auto-populated for the email addresses display.
- Buttons: Cancel + Save
- On Save: update the Company record in AppContext; close dialog; show toast "Billing details updated."

Add a `updateCompanyBillingDetails(input)` operation to AppContext:

```ts
updateCompanyBillingDetails(input: {
  companyId: string;
  name: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  contactUserIds: string[];  // User IDs that serve as billing contacts
}): void
```

Add an `edit_billing_details` permission action key, allowed for `account_owner` and `billing_admin`. Add useCan('edit_billing_details') check on the edit pencil.

### C5. Invoices tab content

Reuse the existing BillingPage's invoice table component, but filter to invoices where `invoice.subscriptionId === this.subscription.id`. If you can refactor the BillingPage's table into a reusable `InvoiceTable` component that accepts a `filterBySubscriptionId` prop, do so. Otherwise duplicate the rendering logic with the filter applied.

The Pay Now, Renew, View Details actions all work the same way as on the sidebar page.

### C6. Quotes tab content

Reuse the QuotesPage's quote table similarly, filtered to `quote.subscriptionId === this.subscription.id`. ALSO: **remove the "Plan" column from this tab** (per #1531). Keep the column on the sidebar Quotes page where it may still be useful for cross-subscription context.

The Request Quote, Accept, Decline, Regenerate actions work the same.

### C7. Sidebar pages remain unchanged

- `/invoices` (sidebar) shows ALL invoices for the current company across all subscriptions — no changes
- `/quotes` (sidebar) shows ALL quotes for the current company across all subscriptions — no changes
- The Plan column stays on `/quotes`

Dual access confirmed: sidebar = company-wide, tab = subscription-scoped.

### C8. Build checkpoint

`npm run build`. Manual test:
- From Dashboard, click "Subscriptions" in sidebar → see list (one card for ABC's single subscription)
- Click the subscription card → routes to `/subscriptions/{id}` detail page
- Overview tab shows Subscription & Licenses block + Payment info + Billing Details card on right
- Click Edit pencil on Billing Details → popup opens, edit the company address, save → toast confirms
- Switch to Invoices tab → see only THIS subscription's invoices
- Switch to Quotes tab → see only THIS subscription's quotes; "Plan" column is gone
- Go to sidebar Invoices → see ALL company invoices (no scoping)
- Go to sidebar Quotes → see ALL company quotes with Plan column visible

---

## Section D — Product Downloads flyout cleanup

The Product Downloads & Links page currently shows licensed products. Per #1533:

### D1. Show all products, grey-out unpurchased

Change the page to render ALL catalog products. For products the company does NOT own a license to:
- Render the card with reduced opacity (`opacity-50` or similar muted treatment)
- Replace action buttons with a single "Contact Sales" or "Add to Subscription" link (or just remove buttons entirely; greyed appearance signals unavailability)
- Tooltip on hover: "This product is not in your current subscription."

For products the company DOES own:
- Render normally with full action buttons

### D2. Flyout (product detail expansion) — restructure

When a product card expands (or a detail flyout opens), the current structure has section headers like "Documentation", "Rate Sheet", "Release Notes". Replace with a simple **ordered list** of items:

```
1. Installation instructions
2. Quickstart Guide
3. Release Notes
4. Documentation
5. Product Info
```

Each item is a clickable link (opens in a new tab or triggers download depending on the type — for now, all link to "#" placeholders since the actual file URLs aren't in scope).

Visual: clean list, no section headers, items are clickable.

### D3. Rename "Documents" button to "Resources"

Anywhere on the page or in the flyout where there's a "Documents" button, rename to **"Resources"**.

Add a tooltip on hover over the Resources button:
> "Helpful links including installation instructions and quick start guides are here."

Use shadcn `Tooltip` primitive.

### D4. Download button — split with format dropdown

The Download button (which currently is a single-action button) becomes a split button:
- Main button area: "Download" (with the default format implied, e.g., latest version EXE for desktop products, or "Open" for web products)
- Dropdown arrow on the right side
- Dropdown menu shows alternative formats:
  - For desktop products: ".exe (recommended)", ".msi (alternative)", "Previous version (v4.1)"
  - For web products: just "Open"
- Above the dropdown items, a small label: "All Formats" (not "Other Formats")

Use shadcn `DropdownMenu` + `Button` primitives, or a `ButtonGroup` pattern.

### D5. Build checkpoint

`npm run build`. Manual test:
- As ABC's john.smith, go to Product Downloads & Links
- See all catalog products. Products ABC owns (NumberCruncher Desktop + Web) render normally. Other products render greyed.
- Expand a product card. See the 5-item ordered list (no section headers).
- Hover over "Resources" — see the tooltip.
- Click the Download split button on a desktop product — see the main download. Click the dropdown arrow — see "All Formats" with .exe, .msi, previous version.

---

## Section E — Smaller items (verification + tweaks)

### E1. Welcome subtitle on Dashboard

Already covered in Section A3 — verify it's present.

### E2. License Assignments row — remove billing data

Verify: no $500 or any billing/payment data appears in the License Assignments rows on the Dashboard. This was already done in earlier iterations per the change history, but #1626 explicitly calls it out — confirm.

### E3. DataNet card position

Verify: DataNet card occupies the right column on the Dashboard, with the Opt Out checkbox in the lower-right of the card. Per #1525 and existing v9b spec. No new work expected — verify.

### E4. Build checkpoint

`npm run build`. Visual sanity check.

---

## What NOT to touch

- v14 reset work — leave everything from v14 alone (the audit-driven UX rework, bulk import, polish, manage-licenses per-user remove prompt)
- All v13 business rules (pricing, PO field, role permissions, expiring-seat notice, reactivation flow)
- Notification system, DataNet page, News page, Support page, Admin Tool functional behavior
- The Leimberg branding, colors, fonts beyond what's specified above
- The shadcn UI primitives

---

## Acceptance criteria

1. `npm run build` clean.
2. Dashboard shows one of the three Account Status states based on real seed data conditions.
3. The "Account is Current" state uses light green `#e6f5e6` and reads "Account is Current" (not "good standing").
4. "Additional License Invoice Due" state appears when there's an unpaid mid-cycle license invoice. "Annual Fee Due" appears when there's an unpaid renewal invoice or renewal is within 30 days.
5. Both "Due" states have a Pay Now button routing to `/pay?invoice={id}`.
6. Welcome greeting has the small company-name subtitle.
7. License Assignments rows show "{available}/{total} seats available".
8. Subscriptions sidebar list links each subscription to a `/subscriptions/{id}` detail page.
9. The detail page has Overview / Invoices / Quotes tabs.
10. Overview tab has Subscription & Licenses + Payment info on the left, Billing Details card on the right.
11. Billing Details edit pencil opens a popup with editable Company Name, Address fields, and multi-select Company Contacts. Save persists the data and shows a toast.
12. Edit pencil visible only to AO + BA. LA and RC see read-only.
13. Invoices tab in subscription detail page shows ONLY this subscription's invoices.
14. Quotes tab in subscription detail page shows ONLY this subscription's quotes, WITHOUT the Plan column.
15. Sidebar Invoices and Quotes pages remain unchanged — show all company invoices/quotes (and Plan column still there on sidebar Quotes).
16. Product Downloads shows ALL catalog products; unpurchased ones are greyed out with a tooltip.
17. Product detail/flyout shows 5-item ordered list (Installation instructions, Quickstart Guide, Release Notes, Documentation, Product Info) with no section headers.
18. "Documents" button renamed to "Resources" with the specified tooltip.
19. Download button is a split button with a format dropdown labeled "All Formats".

---

## Reporting back

At the end of your run, summarize:

1. Each section A–E: status (completed / completed with deviation / blocked).
2. Files modified and files created — full list.
3. The three Account Status states verified by triggering each (e.g., via Admin Tool Force buttons, or by manipulating seed data).
4. Confirmation that the subscription detail page works end-to-end with all 3 tabs.
5. Confirmation that the Billing Details edit popup persists changes and respects role gating.
6. Output of `npm run build`.

Do NOT commit. I will review and walk through the portal.
