# Claude Code Prompt v6a — Payment Methods, Invoice Pay Flow, Renewal Drawer, Auto-Renewal

Copy everything below this line into Claude Code in VS Code. Run it on the project root.

This prompt is the FIRST of two related batches. Run this one first, verify it works, THEN run v6b. Do not run them together.

---

## Context

Fifth-ish update to the Leimberg customer portal. Previous prompts handled: Leimberg rebrand, Checkout rebuild, catalog cleanup, Downloads gating, subscription activation, header cleanup, Subscriptions page redesign, polish pass, sticky right column, universal payment page, login fix, fixed page headers, 3-dot action menus.

This batch focuses on **workflow gaps** that surfaced during testing:

1. Pay button missing for invoices created via Pay on Receipt
2. "Mark as Paid" is a demo affordance and shouldn't exist in a customer portal
3. Saved payment methods (multiple cards/ACH, primary flag, manageable from a new page)
4. Invoice and Quote table columns need a clean redesign
5. Auto-renewal invoices generated 30 days before subscription renewal
6. Renewal drawer with seat-only adjustments per product (matching Checkout's UI)

Before you write any code, read these files in this exact order:

1. `src/App.tsx` — routing
2. `src/contexts/AppContext.tsx` — `PaymentMethod`, `Invoice`, `Subscription`, `getCompanyInvoices`, `markInvoicePaid`, `acceptQuote`, `checkoutPurchase`, `getCompanyConfig`, `initialInvoices`, `initialSubscriptions`
3. `src/pages/PaymentPage.tsx` — universal payment page (from previous prompt)
4. `src/pages/BillingPage.tsx` — all invoices list
5. `src/pages/SubscriptionsPage.tsx` — Invoices tab and Quotes tab inside Overview
6. `src/pages/QuotesPage.tsx`
7. `src/pages/ProfilePage.tsx` — for context on user-scoped data
8. `src/components/billing/RenewalFlyout.tsx` — to redesign
9. `src/components/subscriptions/QuoteDialogs.tsx` — for ManageLicensesDrawer pattern

Do NOT start coding until you have read those files.

---

## Change 1 — Pay button for Pay-on-Receipt and Renewal invoices

### Problem

When a user picks "Pay on Receipt" in Manage Licenses, an invoice is created with status `awaiting_payment`. On the Invoices page, that row currently has no "Pay" action. The customer can see the invoice but has no way to pay it.

### Fix

In the action menu (3-dot dropdown) for invoices, always include a "Pay" option when:
- `invoice.status === 'awaiting_payment'`, OR
- `invoice.status === 'overdue'`, OR
- `invoice.status === 'upcoming'` (renewal invoices — see Change 5)

The "Pay" action navigates to `/pay` with route state:
```ts
{
  source: 'invoice',
  invoiceId: invoice.id,
  subtotal: invoice.subtotal ?? invoice.totalAmount,
  tax: invoice.tax ?? 0,
  totalAmount: invoice.totalAmount,
  returnTo: location.pathname,
}
```

Apply this fix in three places:
- `src/pages/BillingPage.tsx` (Invoices list)
- `src/pages/SubscriptionsPage.tsx` (Invoices tab inside subscription)
- Any "Pay" entry point on Dashboard that needs it

For invoices with `status === 'payment_terms_applied'` (Pay on Terms), do NOT show a Pay action — those are credit-terms invoices and payment happens out-of-band. Show only "View" and "Download PDF" actions for those.

---

## Change 2 — Remove "Mark as Paid" everywhere

### Problem

"Mark as Paid" was a demo shortcut. It shouldn't appear in a customer portal — customers don't self-mark invoices paid.

### Fix

Search the entire `src/` tree for "Mark as Paid" (case-insensitive) and remove every instance. Files known to have it:
- `src/pages/BillingPage.tsx`
- `src/pages/SubscriptionsPage.tsx` (Invoices tab)

Remove the menu item from the 3-dot dropdown in both. Do NOT remove `markInvoicePaid` from `AppContext` — it's still used internally by the payment flow when a payment succeeds. Just remove the user-facing button/menu item.

---

## Change 3 — Saved Payment Methods

### Goal

Customers can save multiple cards and bank accounts, mark one as Primary, and pick which one to use on the payment page. New page at `/payment-methods` for managing these.

### Data model changes

In `src/contexts/AppContext.tsx`, add a new type and state:

```ts
export interface SavedPaymentMethod {
  id: string;
  userId: string;            // owner of this saved method (within the company)
  companyId: string;
  type: 'card' | 'ach';
  // For cards:
  cardBrand?: 'Visa' | 'Mastercard' | 'Amex' | 'Discover';
  cardLast4?: string;
  cardExpMonth?: number;     // 1-12
  cardExpYear?: number;      // 4-digit
  // For ACH:
  bankName?: string;
  accountLast4?: string;
  routingLast4?: string;     // last 4 of routing number (full routing is sensitive)
  // Common:
  holderName: string;
  isPrimary: boolean;
  createdAt: string;
}
```

Add to `AppState`:
```ts
savedPaymentMethods: SavedPaymentMethod[];
```

Seed two methods for each seeded company (so the demo has real data):
- ABC Accounting: 1 card (Visa 4242, primary), 1 ACH (Chase, last4 6789, not primary)
- XYZ Consulting: 1 card (Mastercard 5454, primary)

Add these context methods to `AppContextType`:

```ts
getUserPaymentMethods: (userId?: string) => SavedPaymentMethod[];
getCompanyPaymentMethods: (companyId?: string) => SavedPaymentMethod[];
addPaymentMethod: (m: Omit<SavedPaymentMethod, 'id' | 'createdAt'>) => SavedPaymentMethod;
removePaymentMethod: (id: string) => void;
setPrimaryPaymentMethod: (id: string) => void;
```

Implementations:
- `getCompanyPaymentMethods(companyId?)` returns all methods for the company (so all users in the company can see and use shared methods)
- `getUserPaymentMethods(userId?)` returns methods owned by the specific user. For this demo, use `getCompanyPaymentMethods` — methods are company-scoped, since customer portals typically share billing methods at the company level.
- `addPaymentMethod` generates `id = 'pm-${Date.now()}'`, sets `createdAt = new Date().toISOString()`. If `isPrimary: true`, demote all other methods of the same type for that company first.
- `removePaymentMethod` cannot remove the only remaining method. If you try to remove the primary, the next method (by creation date) becomes primary automatically.
- `setPrimaryPaymentMethod` sets the chosen one to primary and demotes all others of the same type for that company.

### New page: Payment Methods management

Create `src/pages/PaymentMethodsPage.tsx`. Wrap in MainLayout. Use the standard `PageHeader` from the previous prompt.

Title: "Payment Methods"  
Description: "Manage saved cards and bank accounts for paying invoices."

Layout: single column, max-width `4xl`. Inside:

**Section 1 — Cards card**
- Card title row: "Cards" + right-aligned button "Add Card"
- If no cards: empty state with `CreditCard` icon and text "No saved cards yet"
- Else: vertical list of card rows
  - Left: card brand icon (use lucide `CreditCard` colored by brand: Visa blue, MC red, Amex/Discover grey)
  - Middle: `{Brand} ending in {last4}` (font-medium), sub-line `Expires {MM}/{YY two-digit}`
  - Right: a "Primary" badge if applicable, plus a 3-dot action menu with: `Make Primary` (only if not primary), `Remove`

**Section 2 — Bank Accounts (ACH) card**
- Same structure: title "Bank Accounts" + "Add Bank Account" button
- Per row: `Building2` or `Landmark` icon, `{Bank Name} •••• {accountLast4}` font-medium, sub-line `Routing •••• {routingLast4}`
- Same action menu

**Add Card dialog**

Click "Add Card" → opens a Dialog:
- Cardholder Name (required)
- Card Number (16 digits, masked except last 4 — for demo, just take last 4 and derive brand from first digit: 4=Visa, 5=Mastercard, 3=Amex, 6=Discover; fallback to Visa)
- Expiration (MM and YY two-digit inputs)
- CVV (3-4 digits, not stored — just collected to look real)
- "Make this my primary card" checkbox (default false; if no card exists yet, force true and disable)
- Cancel | Add Card buttons

On submit: call `addPaymentMethod(...)`, toast "Card added", close dialog.

**Add Bank Account dialog**

Similar structure:
- Account Holder Name
- Bank Name (free text)
- Routing Number (9 digits — store last 4 only)
- Account Number (4-17 digits — store last 4 only)
- Primary checkbox

### Sidebar entry

Add a sidebar item "Payment Methods" with `CreditCard` icon, between "Invoices" and "Quotes" (or wherever fits — your judgment). Required roles: `owner`, `billing`. Apply the existing first-time customer gate logic.

Also add to MainLayout's `pageAccess` map: `'/payment-methods': ['owner', 'billing']`.

### Profile page entry

In `src/pages/ProfilePage.tsx`, add a row: "Payment Methods" with a button "Manage" that navigates to `/payment-methods`. This gives users a second discoverable entry point.

### Wire saved methods into PaymentPage

Update `src/pages/PaymentPage.tsx` (the existing universal payment page). Currently it shows a hardcoded "Visa ending in 4242" row.

**Replace that with a real picker:**

In "Pay by Card" tab:
- If user has saved cards: render a `RadioGroup` listing each saved card. Pre-select the Primary card.
- Each card row: card icon + `{Brand} ending in {last4}` + sub-line `Expires MM/YY` + Primary badge if applicable
- Below the list: a small text button "Use a different card" → opens the Add Card dialog (same one as Payment Methods page). On success, the new card is selected.
- If user has no saved cards: show inline form (current behavior) and a checkbox "Save this card for future payments" (default checked).

In "ACH Transfer" tab:
- Same pattern with saved bank accounts.

**CVV input behavior:**
- When a saved card is selected: show CVV input below the picker (security best practice — never store CVV)
- When using a brand-new card from the form: CVV is part of the inline form

**Submit handler:**
- If user selected a saved method: submit using that method's id
- If user filled the inline form AND checked "Save this card": call `addPaymentMethod` before submitting payment
- The actual payment logic (which branches by `source`) is unchanged — saved methods are purely a UX layer

### Update PaymentMethod card "Change Card" link

The "Change Card" link in the Payment Method card header should now navigate to `/payment-methods` (so users can manage all their methods), with route state `{ returnTo: '/pay' }`. Replace the current toast.

---

## Change 4 — Invoice and Quote table column redesign

### Invoices table

Apply to BOTH `src/pages/BillingPage.tsx` AND the Invoices tab inside `src/pages/SubscriptionsPage.tsx`.

New column structure:

| Column | Source | Notes |
|---|---|---|
| Invoice # | `invoice.invoiceNumber` or `invoice.id` | Mono font |
| Description | `invoice.description` or derived | See below |
| Amount | `invoice.totalAmount` | Right-aligned, currency formatted with `formatCurrency` |
| Due date | `invoice.dueDate` | Format as `MMM d, yyyy` using date-fns |
| Status | computed badge | See status pills below |
| Actions | 3-dot menu | See below |

**Drop these columns**: "Subscriptions" (only one Annual Plan), separate "Paid date" column (folded into Status), separate inline action buttons.

**Description derivation** (if `invoice.description` is empty):
- If invoice has `subscriptionId` and source is annual/renewal → "Annual renewal {YYYY}" or "Annual subscription"
- If `source === 'license_change'` → "License adjustment"
- If `source === 'checkout'` → "Initial subscription purchase"
- Fallback: "Invoice"

**Status pills** — use these exact styles:
- `paid` → green badge "Paid" with optional sub-line "Paid {date}" muted xs
- `awaiting_payment` → amber badge "Awaiting Payment"
- `payment_terms_applied` → blue badge `Net {terms}` (e.g., "Net 30")
- `overdue` → red badge "Overdue" with sub-line `Due {dueDate}` red xs
- `upcoming` → grey/outline badge "Upcoming" with sub-line `Due {dueDate}` muted xs

**Actions menu (3-dot):**
- `View Invoice` — always
- `Pay` — if status is `awaiting_payment` | `overdue` | `upcoming`
- `Renew` — if `source === 'renewal'` (opens the new RenewalDrawer — see Change 6)
- `Download PDF` — always (toast "PDF download coming soon")
- NO "Mark as Paid" — removed per Change 2

### Quotes table

Apply to BOTH `src/pages/QuotesPage.tsx` AND the Quotes tab inside `src/pages/SubscriptionsPage.tsx`.

New column structure:

| Column | Source | Notes |
|---|---|---|
| Quote # | `quote.quoteNumber` or `quote.id` | Mono font |
| Products | derived | Show first 2 product names joined by `, `; if more, append `+N` |
| Amount | `quote.totalAmount` | Right-aligned, currency |
| Expires | `quote.expiryDate` | `MMM d, yyyy` |
| Status | badge | active=blue, accepted=green, declined=grey, expired=amber |
| Actions | 3-dot menu | See below |

**Actions menu:**
- `View Quote` — always (opens a read-only view dialog — keep existing if present, or create a simple summary dialog)
- `View Note` — if `quote.note` is set
- `Accept Quote` — only if `status === 'active'`
- `Decline Quote` — only if `status === 'active'`
- `Regenerate` — only if `status === 'declined'` (navigates to `/checkout` with prefill)
- `Download PDF` — always (toast)

---

## Change 5 — Auto-renewal invoices (30 days before renewal)

### Goal

For any active subscription whose `renewalDate` is within 30 days, a renewal invoice should appear in the customer's invoice list with status `upcoming` (or `payment_terms_applied` for Pay-on-Terms companies, since they auto-renew on terms).

### Approach (no backend)

Two parts:

**Part A — seed at least one renewal invoice in mock data**

In `src/contexts/AppContext.tsx`, find `initialInvoices`. Add a new entry tied to the XYZ Consulting subscription, with:

```ts
{
  id: 'inv-renewal-2026-xyz',
  invoiceNumber: 'INV-RNW-2026-001',
  companyId: 'company-2',
  subscriptionId: <XYZ's subscription id>,
  subscriptionName: 'Annual Plan',
  date: <30 days before XYZ's renewalDate, ISO>,
  dueDate: <XYZ's renewalDate, ISO>,
  totalAmount: <recalculate from XYZ's products and licenseCount, plus 7% tax>,
  subtotal: <without tax>,
  tax: <7% of subtotal>,
  status: 'payment_terms_applied',  // XYZ is on Pay on Terms
  source: 'renewal',
  description: 'Annual renewal — {year+1}',
  lineItems: [...derived from XYZ's subscription.products...],
  balance: 0,                       // Pay-on-Terms = already credited
  paidAt: null,
}
```

Also add one for ABC if convenient (ABC is on Pay on Receipt, so status would be `upcoming`). Keep the seed data realistic: only generate renewal invoices for subscriptions where renewal is genuinely within 30 days of today.

**Part B — runtime generation for new subscriptions**

Add a one-shot effect at the top of `AppProvider` (or a `useEffect` in MainLayout):

```ts
useEffect(() => {
  const today = new Date();
  const thirtyDaysOut = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  setState(prev => {
    const newInvoices: Invoice[] = [];
    prev.subscriptions.forEach(sub => {
      if (sub.status !== 'active') return;
      const renewal = new Date(sub.renewalDate);
      if (renewal <= today || renewal > thirtyDaysOut) return;

      // Already has a renewal invoice for this period?
      const periodKey = `${renewal.getFullYear()}`;
      const alreadyExists = prev.invoices.some(
        inv => inv.subscriptionId === sub.id && inv.source === 'renewal' &&
               inv.description?.includes(periodKey)
      );
      if (alreadyExists) return;

      // Generate one
      const config = prev.companyConfigs.find(c => c.companyId === sub.companyId);
      const status: Invoice['status'] = config?.payOnTermsEnabled
        ? 'payment_terms_applied'
        : 'upcoming';
      const subtotal = sub.products.reduce(
        (acc, p) => acc + p.pricePerLicense * p.licenseCount, 0
      );
      const tax = +(subtotal * 0.07).toFixed(2);
      const total = +(subtotal + tax).toFixed(2);

      newInvoices.push({
        id: `inv-renewal-${sub.id}-${periodKey}`,
        invoiceNumber: `INV-RNW-${periodKey}-${sub.id.slice(-3)}`,
        companyId: sub.companyId,
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        date: new Date(renewal.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: sub.renewalDate,
        subtotal,
        tax,
        totalAmount: total,
        balance: status === 'payment_terms_applied' ? 0 : total,
        status,
        source: 'renewal',
        description: `Annual renewal — ${periodKey}`,
        lineItems: sub.products.map(p => ({
          productName: p.name,
          quantity: p.licenseCount,
          unitPrice: p.pricePerLicense,
          totalPrice: p.pricePerLicense * p.licenseCount,
        })),
        paidAt: null,
      });
    });
    if (newInvoices.length === 0) return prev;
    return { ...prev, invoices: [...prev.invoices, ...newInvoices] };
  });
}, []);  // run once on provider mount
```

This is the "no backend" simulation. Real systems would do this as a cron — for a demo, doing it on app load is fine.

**Note on test-mode:** Add a tiny utility button on the Admin Tool page (only visible in `?demo=1` mode) labeled "Force Generate Renewal Invoices" that runs the same logic with the 30-day window relaxed to 365 days, so a tester can immediately see renewal invoices in the list. Toast result.

---

## Change 6 — Renewal Drawer (replaces RenewalFlyout)

### Goal

When a user clicks "Renew" on an invoice row (or on the Dashboard renewal alert), open a right-side drawer showing the subscription's products with per-product seat steppers and a sticky order summary. On clicking "Pay $X", route to the universal `/pay` page.

### File: `src/components/billing/RenewalFlyout.tsx`

Rebuild this component. Keep the file name and exported component name (`RenewalFlyout`) so existing imports continue to work, but restructure the contents.

### Trigger

The drawer is opened with props:

```ts
interface RenewalFlyoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;          // which subscription is being renewed
  invoiceId?: string;              // optional — if renewal is tied to an existing renewal invoice
}
```

### Header

- Title: `"Review & Pay Renewal"`
- Description: `"{subscription.name} · Renewal Period {start} → {end}"` where start = today (or `invoice.date`) and end = today + 365 days (or `invoice.dueDate + 365 days`)

### Body

For each product in the subscription:

- Card with a checkbox **PRE-CHECKED AND DISABLED** (products are locked — user cannot remove products on renewal, per your decision)
- The 2-letter abbreviation tile (ND/NW/QV/DN) on the left
- Product name + price `${price} per seat/year`
- On the right: `Subtotal` label above amount
- A "Seats" row below with the ± stepper and seat count
- **NO** "Annual · Save $21/year" pill. Remove it from anywhere it appears in this component. Permanent removal.

For DataNet:
- Render with the "Included" badge if any other product is selected (which is always the case here since products are locked)
- Subtotal = $0.00 (included)
- Seat stepper still shows but is mostly informational — DataNet doesn't have a per-seat charge when bundled

### Sticky summary footer

Pinned at the bottom of the drawer:

- Subtotal line
- Tax (7%) line
- Total line (font-semibold)
- Balance Due line (primary blue)
- Three buttons in a row:
  - `Reset` (ghost, left-aligned) — resets all seat counts to current subscription values
  - `Cancel` (outline) — closes drawer with no changes
  - `Pay ${total}` (primary, larger) — routes to `/pay` with appropriate state

### Pay button behavior

On click of `Pay $X`:

```ts
const lineItems = lines.map(l => ({
  productName: l.productName,
  quantity: l.licenseCount,
  unitPrice: l.unitPrice,
  totalPrice: l.licenseCount * l.unitPrice,
}));
onOpenChange(false);
navigate('/pay', {
  state: {
    source: 'renewal',
    subscriptionId,
    invoiceId,         // pass through if it exists
    lineItems,
    subtotal, tax, totalAmount,
    returnTo: location.pathname,
  },
});
```

The PaymentPage's `'renewal'` source handler should:
1. Extend the subscription's `renewalDate` by 365 days
2. Update the subscription's products' `licenseCount` to match what was selected
3. If there's a linked `invoiceId`, mark that invoice as paid
4. Else create a new paid invoice for this renewal
5. Toast success and navigate to `/subscriptions`

Implement this in `PaymentPage.tsx`'s submit handler. The relevant context method may need a new helper:

```ts
// in AppContext
const renewSubscription = useCallback((
  subscriptionId: string,
  newLicenseCounts: Record<string, number>,  // productId -> new seat count
  totalAmount: number,
  invoiceId?: string
) => {
  setState(prev => {
    // 1) update subscription: renewalDate += 365d, products.licenseCount updated
    // 2) if invoiceId provided, mark paid; else create new paid invoice
    // 3) return updated state
  });
}, []);
```

Expose it via the context.

### Wire up the new drawer

The component is imported in multiple places. Make sure they all pass the new props:

- Dashboard's "Pay Now" button (when there's an upcoming renewal — see SubscriptionsPage)
- Invoices table's "Renew" action (new — when invoice source is renewal)
- Subscriptions page (if "Pay Now" / "Renew" appears)

For each call site, pass the correct `subscriptionId` and (if applicable) `invoiceId`.

---

## What NOT to touch

- Leimberg branding, color, font
- The first-time customer gate
- The DataNet auto-select on Checkout
- The Admin Tool's payment-method gating logic
- The shadcn UI primitives
- The 3-dot action pattern (just adding/removing items from existing menus)
- `ProfilePage` other than adding the new "Payment Methods" row

---

## Acceptance criteria

1. `npm run dev` runs without errors. `npm run build` completes without errors.
2. Invoice rows with status `awaiting_payment`, `overdue`, or `upcoming` show a "Pay" item in their 3-dot menu that routes to `/pay`. Invoices with `payment_terms_applied` do NOT show "Pay".
3. No "Mark as Paid" button or menu item appears anywhere in the customer-facing UI.
4. A new "Payment Methods" sidebar item appears (for owner/billing roles).
5. The Payment Methods page lists Cards and Bank Accounts in separate cards. Add Card and Add Bank Account dialogs work. Removing the primary card auto-promotes the next one.
6. On `/pay`, the Pay by Card tab shows a list of saved cards (radio-selectable), with Primary pre-selected. The "Use a different card" link opens the Add Card dialog inline.
7. Same picker behavior for ACH Transfer tab.
8. After successful payment with a brand-new card and the "Save this card" checkbox checked, the new card appears in the Payment Methods page.
9. Invoices table (both BillingPage and SubscriptionsPage Invoices tab) uses the new 6-column structure: Invoice # | Description | Amount | Due date | Status | Actions.
10. Quotes table (both QuotesPage and SubscriptionsPage Quotes tab) uses the new 6-column structure: Quote # | Products | Amount | Expires | Status | Actions.
11. On app load, at least one renewal invoice exists in the Invoices list for XYZ Consulting (per seeded data). The invoice has status `Net 30` (Pay on Terms company) with source `renewal`.
12. After paying for a fresh signup and waiting/forcing it, additional renewal invoices appear in the list 30 days before each subscription's renewal date.
13. Clicking "Renew" on a renewal invoice opens the redesigned RenewalFlyout drawer with locked product checkboxes, per-product seat steppers, no "Annual · Save" pill, and a sticky summary footer with Reset | Cancel | Pay $X buttons.
14. Clicking "Pay $X" in the renewal drawer routes to `/pay` with source `'renewal'`.
15. Successful payment in the `renewal` flow: extends the subscription's renewalDate by 365 days, updates seat counts per product, marks the linked invoice paid (or creates a new one), toast, and redirects to `/subscriptions`.
16. The "Annual · Save $21/year" pill does not appear in Checkout OR the renewal drawer OR anywhere else.
17. The Admin Tool has a "Force Generate Renewal Invoices" button visible only in `?demo=1` mode that bypasses the 30-day window.

---

## Manual demo flow

1. Log in as `michael.chen@xyzconsulting.com` → Invoices page → there's a renewal invoice with status "Net 30" and source "Annual renewal — 2027" (or relevant year).
2. Log in as `john.smith@abcaccounting.com` → Manage Licenses on a product → set seats to add 2 more → pick Pay on Receipt → confirm. Go to Invoices → the new awaiting-payment invoice has a "Pay" action in its 3-dot menu.
3. Click Pay → land on `/pay` with the new invoice's data. See saved cards picker. Pay → land on `/subscriptions` with the licenses applied.
4. Navigate to Payment Methods → see cards. Click 3-dot on a non-primary card → "Make Primary" works. Add a new card → it appears in the list.
5. Click `?demo=1` URL → Admin Tool → "Force Generate Renewal Invoices" → renewal invoices appear for all active subscriptions.
6. Click "Renew" on a renewal invoice → drawer opens with locked products, adjustable seats, no Save pill. Adjust seats → click Pay → land on `/pay`. Pay → land on `/subscriptions` with renewalDate pushed forward.

---

## Reporting back

At the end of your run, summarize:

1. Every file modified and every file created.
2. Confirmation that all three Pay-button locations (BillingPage, SubscriptionsPage Invoices tab, Dashboard if applicable) route to `/pay`.
3. Confirmation that NO "Mark as Paid" reference remains in the customer-facing UI.
4. Confirmation that the saved-methods picker is fully wired in `/pay`.
5. Confirmation that `renewSubscription` is implemented and handles both the `invoiceId` path and the new-invoice path.
6. The seed data: how many renewal invoices exist after first load.
7. `npm run build` output.
8. Any deviations from this spec.

Do not commit. I will review.
