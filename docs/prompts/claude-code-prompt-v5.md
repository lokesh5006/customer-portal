# Claude Code Prompt — Checkout/Quote Routing + Payment Page + Login + Global UI Polish

Copy everything below this line into Claude Code in VS Code. Run it on the project root.

---

## Context

This is the fifth update to the Leimberg customer portal. Previous prompts handled: Leimberg rebrand, Checkout rebuild, catalog cleanup, Downloads gating, subscription activation, header cleanup, Subscriptions page redesign, polish pass, sticky right column.

This prompt has nine related changes touching Checkout, Quotes, Payment, Login, and global layout patterns.

Before you write any code, read these files in this exact order:

1. `src/App.tsx` — routing
2. `src/contexts/AppContext.tsx` — read `login`, `checkoutPurchase`, `markInvoicePaid`, `requestLicenseChange`, `acceptQuote`, `Invoice`, `Quote`, `PaymentMethod` types
3. `src/pages/CheckoutPage.tsx`
4. `src/pages/QuotesPage.tsx`
5. `src/components/subscriptions/QuoteDialogs.tsx` — for AcceptQuoteDialog and ManageLicensesDrawer
6. `src/components/layout/MainLayout.tsx`
7. `src/components/layout/Header.tsx`
8. `src/pages/Login.tsx`
9. `src/pages/BillingPage.tsx`
10. `src/pages/SubscriptionsPage.tsx`
11. `src/pages/UsersPage.tsx` and `src/pages/ContactsPage.tsx` — for action column patterns
12. `src/components/billing/RenewalFlyout.tsx`
13. `src/pages/SupportPage.tsx`
14. `src/pages/Dashboard.tsx`

Do NOT start coding until you have read those files.

---

## Change 1 — Checkout routing from quote regeneration and "New Quote"

### File: `src/components/subscriptions/QuoteDialogs.tsx`

In `DeclineQuoteDialog`, there's already a `regenerate` action. Find any place where a declined quote's Regenerate action is wired. The current behavior may navigate to `/checkout?fromQuote=...` already — verify it does. If it does not, add navigation to `/checkout` with route state containing the quote's line items so Checkout can prefill.

### File: `src/pages/QuotesPage.tsx`

Find the button that today reads "New Quote" or "Create Quote." Its click handler must route to `/checkout` (not just open a modal). The condition is:
- If the current company has at least one active paid subscription → show button labeled `"Request Quote"` that opens the existing `RequestQuoteDialog`
- Else → show button labeled `"New Quote"` that navigates to `/checkout`

```tsx
const subs = getCompanySubscriptions();
const hasActivePaidSubscription = subs.some(s => s.status === 'active');

// ...
{hasActivePaidSubscription ? (
  <Button onClick={() => setRequestQuoteOpen(true)}>Request Quote</Button>
) : (
  <Button onClick={() => navigate('/checkout')}>New Quote</Button>
)}
```

### File: `src/pages/CheckoutPage.tsx`

Reintroduce the prefill-from-quote behavior that was removed in an earlier prompt. When Checkout is loaded with route state `{ fromQuote: quoteId, lineItems: [...] }` OR query params `?fromQuote=...`, prefill the product line selections and seat counts from that quote.

Implementation:
```ts
const location = useLocation();
const fromQuoteId = location.state?.fromQuote;
const prefillLineItems = location.state?.lineItems;

useEffect(() => {
  if (prefillLineItems?.length) {
    setLines(currentLines =>
      currentLines.map(l => {
        const match = prefillLineItems.find(p => p.productName === l.productName);
        return match
          ? { ...l, selected: true, licenseCount: match.licenseCount }
          : l;
      })
    );
  }
}, [/* run once on mount */]);
```

### Sidebar visibility for "quote-in-flight" state

The previous first-time customer gate has these visible states:
- Pre-payment, no quote → Subscriptions + Support
- Pre-payment, quote sent → Quotes + Support

Now we need a THIRD state: pre-payment, quote sent, user clicked Regenerate or New Quote → Subscriptions/Checkout + Quotes + Support.

Update `src/components/layout/Sidebar.tsx`. Currently:
```ts
if (isFirstTimeCustomer()) {
  if (hasSentQuote()) {
    visibleItems = visibleItems.filter(i => i.path === '/quotes' || i.path === '/support');
  } else {
    visibleItems = visibleItems.filter(i => i.path === '/subscriptions' || i.path === '/support');
  }
}
```

Change to: if the user has sent a quote AND is currently on `/checkout` (or on `/subscriptions`, which redirects to `/checkout`), they're regenerating. Show three items.

Cleanest approach is to expose a new derived selector. Add to `AppContext.tsx`:

```ts
const hasDeclinedQuote = useCallback((): boolean => {
  const companyId = state.currentCompany?.id;
  if (!companyId) return false;
  return state.quotes.some(q => q.companyId === companyId && q.status === 'declined');
}, [state.quotes, state.currentCompany]);
```

Then update Sidebar logic:
```ts
if (isFirstTimeCustomer()) {
  if (hasSentQuote() && !hasDeclinedQuote()) {
    // Only quote in flight, not yet acted on
    visibleItems = visibleItems.filter(i => i.path === '/quotes' || i.path === '/support');
  } else if (hasSentQuote() && hasDeclinedQuote()) {
    // User has at least one declined quote → may want to regenerate via Checkout
    visibleItems = visibleItems.filter(
      i => i.path === '/quotes' || i.path === '/support' || i.path === '/subscriptions'
    );
  } else {
    // No quote yet
    visibleItems = visibleItems.filter(i => i.path === '/subscriptions' || i.path === '/support');
  }
}
```

Also update the `MainLayout.tsx` allowed-routes guard in lockstep so users can actually navigate to `/checkout` from `/quotes` after declining. The `allowed` array needs to include `/checkout` whenever Subscriptions is visible.

### Acceptance for Change 1

- User signs up → lands on Checkout → sees only Subscriptions + Support
- User clicks "Get Quote" → quote saved → redirected to `/quotes` → sees only Quotes + Support
- User declines that quote → clicks "Regenerate" → lands on Checkout with the products prefilled → sidebar now shows Quotes + Support + Subscriptions
- User clicks "New Quote" on Quotes page (only visible when no active paid subscription) → lands on Checkout
- After user pays from Checkout → full sidebar restored

---

## Change 2 — "Request Quote" vs "New Quote" by subscription state

This is covered inside Change 1. Restating the rule:

- If `getCompanySubscriptions().some(s => s.status === 'active')` → button label is `"Request Quote"`, click opens the existing `RequestQuoteDialog` modal (with the optional Send-to + Notes fields, as it already does today)
- Else → button label is `"New Quote"`, click navigates to `/checkout`

This applies to the Quotes page and any other places (e.g., the Quotes tab inside Subscriptions, the Dashboard quick action). Audit those too.

---

## Change 3 — Accept Quote as a side drawer instead of a dialog

### File: `src/components/subscriptions/QuoteDialogs.tsx`

The current `AcceptQuoteDialog` uses shadcn `Dialog`. Convert it to a side drawer using shadcn `Sheet` (right side).

Rename the export to `AcceptQuoteDrawer` (and update all import sites: SubscriptionsPage, QuotesPage). Keep the props interface unchanged.

Use the same structure as `ManageLicensesDrawer` already in the same file — same `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` pattern. Set `side="right"` and `className="w-full sm:max-w-xl flex flex-col"`.

The drawer body keeps the existing contents: quote summary (products, seats, totals), payment method picker (which already follows the available-methods rules from the previous prompt), and an Accept Quote button that triggers acceptance.

**Behavior change in Accept Quote action:** Currently clicking Accept Quote calls `acceptQuote(quote.id, paymentMethod)` which creates an invoice immediately. After this change, the flow forks based on payment method:

- If `paymentMethod === 'pay_immediately'` → close the drawer, navigate to `/pay` with route state `{ source: 'quote', quoteId, lineItems, totalAmount }`. Do NOT call `acceptQuote` yet — the payment page will trigger acceptance on success.
- If `paymentMethod === 'pay_on_receipt'` or `'pay_on_terms'` → call `acceptQuote(quote.id, paymentMethod)` as today, show toast, close drawer.

(The `acceptQuote` function already creates the invoice with the right status. For the immediate path, the new payment page will create the invoice on success — see Change 4.)

Keep all other Quote dialogs (`DeclineQuoteDialog`, `ViewNoteDialog`, `RequestQuoteDialog`) as `Dialog` — they're short, this change only affects Accept.

---

## Change 4 — Dedicated Payment page

### New route + page

Add a new route `/pay` in `src/App.tsx`. Create `src/pages/PaymentPage.tsx`. Wrap in `MainLayout` like other pages.

### Route state contract

The Payment page receives intent via `location.state`:

```ts
type PaymentIntent =
  | { source: 'checkout'; lineItems: LineItem[]; totalAmount: number; subtotal: number; tax: number; returnTo?: string }
  | { source: 'quote'; quoteId: string; lineItems: LineItem[]; totalAmount: number; subtotal: number; tax: number; returnTo?: string }
  | { source: 'invoice'; invoiceId: string; totalAmount: number; subtotal: number; tax: number; returnTo?: string }
  | { source: 'renewal'; subscriptionId: string; lineItems: LineItem[]; totalAmount: number; subtotal: number; tax: number; returnTo?: string };
```

If `location.state` is missing or invalid, redirect to `/dashboard` with a toast `"Payment session expired. Please try again."`.

### Layout — match the supplied visual spec

Two columns. Left column ≈ 2/3 width with two stacked cards (Payment Method + Billing Information). Right column ≈ 1/3 width, sticky, contains Order Summary card.

#### Page header

- Title: `Payment & Billing` (`text-2xl font-semibold tracking-tight`)
- Subtitle: `Confirm your payment method and billing address to complete the order` (`text-sm text-muted-foreground`)

#### Payment Method card (left, top)

- Header row: `"Payment Method"` (text-base font-semibold) on left, `"Change Card"` link button on right (`<Button variant="link" className="text-primary p-0 h-auto">Change Card</Button>`). For now, Change Card click shows a toast `"Card management coming soon"`.
- Tab switcher: two pills, `"Pay by Card"` and `"ACH Transfer"`. Implement as two buttons in a 2-column grid; the active one is `variant="default"` (primary fill), the inactive is `variant="outline"`. Toggle local state.

**Methods to support on this page:**
- "Pay by Card" → mock credit card flow
- "ACH Transfer" → mock ACH flow

This page is for IMMEDIATE payment only. `pay_on_receipt` and `pay_on_terms` do NOT route here — they skip straight to invoice creation in their source flows (Checkout, Accept Quote). The check happens BEFORE routing to `/pay`.

#### Pay by Card tab content

- Saved card row: bordered, rounded box with credit-card icon (lucide `CreditCard`), then text "Visa ending in 4242" with sub-text "Expires 12/26", and a small "Primary" pill on the far right
- "Security Code (CVV)" label
- Input field with `Lock` icon prefix, `type="password"` masked, placeholder `"•••"`, maxLength 4
- Help text below: `"3 digits on back of card"` (`text-xs text-muted-foreground`)

#### ACH Transfer tab content

- Two fields: "Routing Number" (9 digits) and "Account Number" (4–17 digits)
- Both standard text inputs with appropriate labels
- Help text below the routing field: `"Found on the bottom-left of your check"`

#### Auto-renewal row (bottom of Payment Method card)

- Label: `"Auto renewal"` (text-sm font-medium)
- Sub-line: `"Automatically renew subscriptions at the end of the term."` (text-xs text-muted-foreground)
- Toggle switch on the right (shadcn `Switch`), default ON

This is local state on the page. On submit, if ON, set a flag in the invoice — for now just store `autoRenew: true` in the invoice metadata if you want, or just attach to the new subscription. Keep simple: pass the toggle value to the submit handler but don't wire it deeply — a toast `"Auto-renewal enabled"` after success is fine.

#### Billing Information card (left, bottom)

- Header row: `"Billing Information"` on left, `"Use Saved Address"` link on right (click prefills from `currentCompany` and current user — basically reset to defaults)
- Fields:
  - First Name | Last Name (2 columns)
  - Company (Optional) — full width
  - Street Address — full width
  - City | State | ZIP Code (3 columns)
  - Country — full width
- Checkbox at the bottom: `"Update this billing address for my future renewals"` (default checked)

Use shadcn `Input` and `Label`. Initialize all fields from the current user + company data where possible (firstName, lastName, address from companyConfig billing if available).

#### Order Summary card (right column, sticky)

- Title `"Order Summary"`
- For each line item:
  - Product name (text-sm font-medium)
  - Sub-line: `Qty {n} · Rate ${rate}` (text-xs text-muted-foreground)
  - Right-aligned line subtotal `${amount}` (text-sm)
- Divider
- Subtotal $X (text-sm, label muted)
- Tax $X (text-sm, label muted)
- Divider
- Total: big and bold (text-base font-semibold)
- Balance Due: big and bold (text-base font-semibold, value in primary blue)
- Big primary button: `"Pay ${total}"` — full width, `h-11`, primary color
- Footer text: `"Encrypted and secure payment."` (text-xs text-muted-foreground, centered)

For source `'invoice'` (paying an existing invoice), derive line items from the invoice's `lineItems` array.

#### Cancel/Back behavior

Add a `"Cancel"` button (variant ghost or outline) above the Pay button OR at the top-left of the page. On click, navigate back to `location.state.returnTo` if set, otherwise navigate(-1). This was the user's explicit requirement: cancel returns to where they came from.

#### Submit handler

On clicking Pay $X:

1. Validate required fields (CVV if Pay by Card; both ACH fields if ACH Transfer; at least street + city + state + zip + country in billing)
2. Show loading state on button (`disabled` + spinner)
3. Simulate processing with `await new Promise(r => setTimeout(r, 800))`
4. Branch by source:
   - **`'checkout'`**: call `checkoutPurchase({ lineItems, paymentMethod: 'pay_immediately' })` — this already creates a Subscription + paid Invoice and licenses (from previous prompts)
   - **`'quote'`**: call `acceptQuote(quoteId, 'pay_immediately')` — this creates a paid Invoice. Then ALSO promote the quote's line items into a Subscription if one doesn't exist. Inspect `acceptQuote` — if it already creates a subscription, no extra work; if it doesn't, follow the same pattern used by `checkoutPurchase`.
   - **`'invoice'`**: call `markInvoicePaid(invoiceId)` — this already handles pending license changes
   - **`'renewal'`**: extend the subscription's `renewalDate` by 365 days, and create a paid Invoice for the renewal total. Use `addSubscription`-like helper or update the subscription directly via a new context method `renewSubscription(subscriptionId)` that you add to AppContext
5. On success: show success toast `"Payment successful. Thank you!"`, then navigate to `/subscriptions`
6. On failure: show destructive toast and stay on page with button re-enabled

Per the user's requirement: **always land on `/subscriptions` after a successful payment**, regardless of the source. (Even though previously Checkout landed on `/dashboard` — that changes now.)

### Update all callers to route to /pay

The following entry points must route through the new payment page when the chosen payment method is `pay_immediately`:

#### CheckoutPage — "Complete Payment" button

Currently calls `checkoutPurchase(...)` and toasts. Change to:
```ts
const subtotal = /* existing calc */;
const tax = subtotal * 0.07;
const total = subtotal + tax;
navigate('/pay', {
  state: {
    source: 'checkout',
    lineItems: selectedLines,
    subtotal, tax, totalAmount: total,
    returnTo: '/checkout',
  },
});
```

#### AcceptQuoteDrawer — Pay action when method is pay_immediately

(Already specified in Change 3.) Pseudocode:
```ts
if (paymentMethod === 'pay_immediately') {
  onOpenChange(false);
  navigate('/pay', { state: { source: 'quote', quoteId: quote.id, lineItems: quote.lineItems, subtotal, tax, totalAmount, returnTo: '/quotes' } });
} else {
  acceptQuote(quote.id, paymentMethod);
  toast(...);
  onOpenChange(false);
}
```

#### BillingPage — invoice "Pay" action

Currently calls `markInvoicePaid(invoice.id)`. Change to navigate to `/pay`:
```ts
navigate('/pay', {
  state: {
    source: 'invoice',
    invoiceId: invoice.id,
    subtotal: invoice.subtotal ?? invoice.totalAmount,
    tax: invoice.tax ?? 0,
    totalAmount: invoice.totalAmount,
    returnTo: '/invoices',
  },
});
```

The "Mark as Paid" button (which is a demo affordance) can stay as-is — it's a shortcut for testing.

#### SubscriptionsPage — Invoices tab "Pay" button

Same treatment as BillingPage. Route to `/pay` instead of `markInvoicePaid` directly.

#### RenewalFlyout — "Pay" button when method is pay_immediately

Same treatment. Route to `/pay` with `source: 'renewal'`.

#### Dashboard — Overdue alert "Pay Now" button

Currently opens RenewalFlyout. Change: if there's an overdue invoice, route to `/pay` with `source: 'invoice'` for that specific invoice. Otherwise (just upcoming renewal) keep opening RenewalFlyout.

---

## Change 5 — Universal payment flow

Captured inside Change 4 above. Reiterating: every "Pay" entry point that means "pay immediately" routes through `/pay`. The same page handles all four sources (checkout, quote, invoice, renewal) via the route state contract.

Pay-on-Receipt and Pay-on-Terms flows continue to use direct context calls (they don't take a payment, they just create an invoice with the appropriate status).

---

## Change 6 — Successful payment activates subscription + reflects in Downloads

This is partially already in place from earlier prompts (`checkoutPurchase` creates a Subscription + auto-assigns licenses). Verify the same is true for `acceptQuote`:

### Update `acceptQuote` in `AppContext.tsx`

After it creates the invoice, ALSO:

1. Create a `Subscription` from the quote's line items (same shape as `checkoutPurchase` creates — Annual Plan, status `active` for pay_immediately or pay_on_terms, `pending_payment` for pay_on_receipt)
2. Auto-assign licenses for the accepting user

This mirrors what `checkoutPurchase` already does. Extract the shared logic into a private helper inside the provider:

```ts
const _createSubscriptionFromLineItems = (lineItems, paymentMethod, prev) => {
  // build Subscription, build Licenses, return { subscription, licenses }
};
```

Then both `checkoutPurchase` and `acceptQuote` call it. Don't change the call signatures externally.

### Verify Downloads gating

The Downloads page already gates by `subs.some(s => s.status === 'active' && s.products.some(p => p.name === productName))` per the previous prompt. After Change 6 lands, an accepted-quote-paid-immediately flow should auto-show those products as Licensed. Confirm.

---

## Change 7 — Demo-friendly login

### File: `src/contexts/AppContext.tsx`

Update `login`:

```ts
const login = useCallback((email: string, _password: string): boolean => {
  if (!email.trim()) return false;
  const normalized = email.trim().toLowerCase();
  let user = state.users.find(u => u.email.toLowerCase() === normalized);

  // Demo fallback: auto-create a user for unknown emails so any login works.
  if (!user) {
    const newCompanyId = `company-${Date.now()}`;
    const newCompany: Company = {
      id: newCompanyId,
      name: `${email.split('@')[1]?.split('.')[0] || 'Demo'} Inc.`,
      createdAt: new Date().toISOString(),
    };
    const newUser: User = {
      id: `user-${Date.now()}`,
      companyId: newCompanyId,
      email: normalized,
      firstName: email.split('@')[0].split('.')[0] || 'Demo',
      lastName: email.split('@')[0].split('.')[1] || 'User',
      roles: ['owner'],
      status: 'active',
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      invitedAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      companies: [...prev.companies, newCompany],
      users: [...prev.users, newUser],
      isAuthenticated: true,
      currentUser: newUser,
      currentCompany: newCompany,
      demoRoles: ['owner'],
    }));
    return true;
  }

  if (user.status === 'inactive') return false;

  const company = state.companies.find(c => c.id === user.companyId);
  setState(prev => ({
    ...prev,
    isAuthenticated: true,
    currentUser: user!,
    currentCompany: company || null,
    demoRoles: user!.roles,
  }));
  return true;
}, [state.users, state.companies]);
```

The result: any email + any password succeeds. Auto-created users land in the first-time-customer state (no subscriptions, no invoices) and are routed to `/checkout` by the existing gate.

### File: `src/pages/Login.tsx`

Add a small demo note below the form: `"This is a demo. Any email and password will work."` (text-xs text-muted-foreground, centered).

Also fix the broken `/forgot-password` link from the original analysis — either remove the link entirely or wire it to a toast: `"Password reset is disabled in this demo."`

---

## Change 8 — Fixed top header AND fixed page title

### Goal

When scrolling content on any authenticated page, both the top app header (logo + bell + avatar) AND the page title section (e.g. "Subscriptions" + description) stay visible. Only the body content scrolls.

### Layout restructure

#### File: `src/components/layout/MainLayout.tsx`

Currently MainLayout renders Sidebar + Header + children with normal document flow. Restructure so:

```
┌────────────────────────────────────────────────┐
│ Header (fixed top, full width)                 │  ← position: sticky top:0 z:30
├──────────────┬─────────────────────────────────┤
│              │ Page Title bar (fixed)          │  ← position: sticky top:headerHeight z:20
│  Sidebar     ├─────────────────────────────────┤
│              │ Scrollable page body            │  ← overflow-y-auto
│              │                                 │
└──────────────┴─────────────────────────────────┘
```

Sidebar stays on the left, full height, scrollable internally if needed.

The right column (header + title bar + body) is a flex-column. Header has `sticky top-0 z-30`. The page title bar is a slot fed by the page itself.

#### Slot pattern for page title

Create a small new component `src/components/layout/PageHeader.tsx`:

```tsx
import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="sticky top-16 z-20 bg-background border-b">
      <div className="px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
```

The `top-16` (64px) offset is the height of the top app header. If your header height differs, adjust to `top-14` or `top-20` — test by scrolling.

#### Update every page to use PageHeader

Every authenticated page currently renders its title and description inline as the first thing in its content. Extract those into `<PageHeader title="..." description="..." />` at the top of the page's JSX, and remove the now-redundant inline heading.

Pages to update:
- `Dashboard.tsx` — title "Dashboard", description "Welcome back, {first name}"
- `SubscriptionsPage.tsx` — title "Subscriptions", description "Manage your active products, renewal options, invoices, and billing details."
- `BillingPage.tsx` — title "Invoices", description "..."
- `QuotesPage.tsx` — title "Quotes", description "..."
- `DownloadsPage.tsx` — title "Downloads", description "..."
- `UsersContactsPage.tsx` — title "Users & Contacts", description "..."
- `SupportPage.tsx` — title "Support", description "..."
- `NewsPage.tsx` — title "News", description "..."
- `AdminPage.tsx` — title "Admin Tool", description "..."
- `PaymentPage.tsx` (the new page from Change 4) — title "Payment & Billing", description "..."
- `CheckoutPage.tsx` — title "Checkout", description "Select products to start your subscription."

The page body below PageHeader uses `p-6` padding and contains the rest of the page.

#### Header z-index

Make sure the top `Header.tsx` has `position: sticky; top: 0; z-index: 30` styling (or class equivalent). Then PageHeader gets `top-16 z-20` so it sits below the header and above the body content.

---

## Change 9 — Uniform 3-dot action menu in all data tables

### Goal

Every data table in the system uses the same action column pattern: a single `MoreVertical` icon button per row that opens a `DropdownMenu` with the row's available actions.

### Files affected

- `src/pages/UsersPage.tsx` — currently has inline buttons or per-row dropdown; verify and standardize
- `src/pages/ContactsPage.tsx` — same
- `src/pages/BillingPage.tsx` (Invoices) — currently has separate View / Pay / Mark Paid / Download buttons in the row
- `src/pages/QuotesPage.tsx` — Accept / Decline / View / Regenerate buttons
- `src/pages/SubscriptionsPage.tsx` Invoices tab — same as BillingPage
- `src/pages/SubscriptionsPage.tsx` Quotes tab — same as QuotesPage
- `src/pages/SupportPage.tsx` — Ticket actions

### Pattern

For each table, the rightmost column header is empty (or `Actions`), the cell contains:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {/* row-specific actions */}
  </DropdownMenuContent>
</DropdownMenu>
```

### Specific row action menus per page

**UsersPage:**
- View
- Edit
- Change Roles
- Proxy as User (admin only)
- Reactivate / Deactivate (depending on status)

**ContactsPage:**
- View
- Edit
- Delete

**BillingPage / Invoices tabs:**
- View Invoice
- Pay (only if unpaid — routes to `/pay`)
- Mark as Paid (demo affordance, only if unpaid)
- Download PDF (toast for now)

**QuotesPage / Quotes tab in Subscriptions:**
- View Note (if has note)
- Accept Quote (only if active)
- Decline Quote (only if active)
- Regenerate (only if declined)
- Download PDF (toast)

**SupportPage:**
- View Ticket
- Update Status (admin/owner only)
- Close Ticket (if not already closed)

### Implementation notes

- Use a `DropdownMenuSeparator` between groups (e.g. destructive actions like Deactivate)
- Destructive items use `className="text-destructive focus:text-destructive"`
- Disabled items use `disabled` prop
- Action menu trigger must NOT propagate to the row click (if the row itself is clickable)

If a page (e.g. UsersPage) already has a partial dropdown, just normalize it to this exact structure. Don't rewrite the underlying action handlers.

---

## What NOT to touch

- The Leimberg branding (logo, color, font)
- The Checkout DataNet auto-select logic
- The Downloads page gating (already correct)
- The first-time customer gate's "no quote yet" and "quote in flight" states (just adding the new "regeneration" state in Change 1)
- The shadcn UI primitives in `src/components/ui/*`
- The seed data arrays
- `RenewalFlyout` internal UI — just update its Pay-button onClick to route to `/pay`
- The Admin Tool — payment-method gating logic already works correctly per previous prompt

---

## Acceptance criteria

When you're done, all of these must be true:

1. `npm run dev` runs without errors. `npm run build` completes without errors.
2. A user can log in with ANY email and ANY password (or just any email — password is ignored). Unknown emails auto-create a fresh demo company and user.
3. A brand-new signup user lands on Checkout with only Subscriptions + Support visible.
4. Clicking "Get Quote" → quote saved → user lands on `/quotes` with only Quotes + Support visible.
5. Declining a quote → clicking "Regenerate" → user lands on `/checkout` with the quote's products prefilled. Sidebar now shows Quotes + Support + Subscriptions.
6. On `/quotes`, when the user has NO active paid subscription, the right-side button reads "New Quote" and routes to `/checkout`.
7. On `/quotes`, when the user HAS an active paid subscription, the right-side button reads "Request Quote" and opens the RequestQuoteDialog modal.
8. Clicking "Accept Quote" on any active quote opens a right-side SHEET drawer (not a dialog). Selecting Pay Immediately and submitting routes to `/pay`. Selecting Pay on Receipt/Terms creates the invoice immediately as today (no `/pay` detour).
9. The `/pay` page renders correctly with two columns: Payment Method + Billing Information on the left, sticky Order Summary on the right. Page title is "Payment & Billing".
10. Pay by Card tab shows the saved Visa row + CVV input. ACH Transfer tab shows routing + account inputs. Switching tabs swaps the content correctly.
11. The Order Summary card on `/pay` shows line items, subtotal, tax, total, balance due, and a primary "Pay $X" button matching the supplied design.
12. Successful payment on `/pay` shows a success toast and redirects to `/subscriptions` — regardless of source (checkout / quote / invoice / renewal).
13. After Checkout → Pay → Success, the Subscriptions page lists the new Annual Plan subscription with the bought products, and the Downloads page shows those products as Licensed.
14. After Accept Quote → Pay → Success, same behavior: subscription is created/activated and reflected in Downloads.
15. Clicking "Cancel" on `/pay` returns to the page the user came from (per `returnTo` route state, or `navigate(-1)` fallback).
16. On every authenticated page, scrolling content keeps both the top header (logo + bell + avatar) AND the page title bar pinned. Only the body scrolls.
17. Every data table (Users, Contacts, Invoices, Quotes, Tickets) uses a single 3-dot action button per row with a dropdown of row-specific actions. No inline action buttons remain in tables.
18. The "Pay" action in any invoice/quote/renewal context routes to `/pay`, not directly to `markInvoicePaid`.
19. The "Mark as Paid" demo shortcut still exists in invoice tables.
20. The `/forgot-password` link is either removed or wired to a toast (no more 404).
21. No console errors when navigating between pages.

---

## Manual demo flow to verify

After your changes, this end-to-end flow should work for a brand-new user:

1. Open `/` → click Login → enter `anyemail@anything.com` and any password → land on `/dashboard`
2. Since auto-created user has no subscription, sidebar shows Subscriptions + Support only → click Subscriptions → redirected to `/checkout`
3. Check NumberCruncher Web (DataNet auto-checks) → click "Get Quote" → fill optional notes → Send → land on `/quotes`, sidebar shows Quotes + Support
4. Click Decline on the quote → confirm → quote now shows status Declined → sidebar shows Quotes + Support + Subscriptions
5. Click Regenerate → land on `/checkout` with products prefilled
6. Click Complete Payment → land on `/pay`
7. Fill CVV → click Pay $X → success toast → land on `/subscriptions` with the new Annual Plan subscription showing
8. Sidebar now shows full menu → click Product Downloads & Links → NumberCruncher Web and DataNet show "Licensed"; other products show "Not Subscribed" with disabled Download but enabled More Info
9. Scroll the Subscriptions page → notice the top header and "Subscriptions" page title stay pinned
10. Click any 3-dot menu on an invoice or quote → dropdown shows the row's actions

---

## Reporting back

At the end of your run, give me a short summary with:

1. The list of every file you modified.
2. The list of every file you created (expect at least `PaymentPage.tsx` and `PageHeader.tsx`).
3. Confirmation that the universal `/pay` route handles all four sources (checkout, quote, invoice, renewal).
4. Confirmation that all data tables use the same 3-dot action pattern.
5. Confirmation that auto-renewal toggle exists on the payment page even if the persistence is shallow.
6. Any deviations from this spec.
7. The output of `npm run build` (success or full error log).

Do not commit. I will review your changes manually.
