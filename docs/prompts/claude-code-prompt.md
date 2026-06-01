# Claude Code Prompt — Leimberg Rebrand + Checkout Rebuild + Payment Gate

Copy everything below this line into Claude Code in your VS Code panel. Run it on the project root.

---

## Context

You are working on a React + TypeScript + Vite + Tailwind + shadcn/ui customer portal prototype. All state is held in a single React Context (`src/contexts/AppContext.tsx`). There is no backend — state is in-memory only.

Before you write any code, read these files in this exact order so you understand the existing architecture:

1. `src/App.tsx` — routing
2. `src/contexts/AppContext.tsx` — full state model and all business logic
3. `src/components/layout/MainLayout.tsx` — auth + role gating
4. `src/components/layout/Sidebar.tsx` — current nav structure
5. `src/components/layout/Header.tsx` — top bar with current branding
6. `src/pages/Welcome.tsx` and `src/pages/Login.tsx` — entry screens with current branding
7. `src/pages/CheckoutPage.tsx` — the page being rebuilt
8. `src/components/subscriptions/QuoteDialogs.tsx` — existing quote dialogs (RequestQuoteDialog is relevant)
9. `tailwind.config.ts` and `src/index.css` — design tokens

Do NOT start coding until you have read those nine files.

---

## Task summary

There are four related changes:

1. **Rebrand the entire portal from "NumberCruncher" to "Leimberg, LeClair & Lackner, Inc."** Use the supplied logo image and the brand blue `#1D618E`. Apply Inter as the global font.
2. **Rebuild the Checkout page** to match a provided visual spec (two-column layout: product selection + billing info on the left, sticky order summary on the right). Add a 7% tax line. Remove the existing "Annual · Save $21/year" pill. Preserve existing rules (seat stepper appears only after checkbox tick; DataNet is free when bundled with any other product, $29/year if standalone).
3. **Add a "first-time customer" navigation gate.** A brand-new signed-up user who has not yet paid any invoice should see ONLY `Subscriptions` and `Support` in the sidebar. Once they generate a quote, the sidebar collapses further to ONLY `Quotes` and `Support` (Subscriptions is removed). Once they have a paid invoice, the full sidebar is shown per existing role rules.
4. **Add a "Send Quote" modal flow** triggered by the "Get Quote" button on Checkout. Modal shows order summary, an optional comma-separated "Send to" email field, and a Notes textarea. On submit, the quote is saved to context (it should already appear in the Quotes page list), a toast simulates the email send, and the user is redirected to `/quotes`.

---

## Asset: the logo

A logo image is supplied at: `<USER WILL PASTE PATH HERE OR DROP THE FILE INTO public/>`

**Action:** Save it as `public/leimberg-logo.png`. The image is a wordmark (text logo) at approximately 413×62px. Reference it in JSX as `/leimberg-logo.png` (Vite serves `/public` from the root).

If the file is not yet on disk when you run, create a placeholder `public/leimberg-logo.png` and tell me at the end of your run that I need to drop the real logo in. Do not skip the import — the references must be in place.

---

## Design tokens to update

### `tailwind.config.ts`
Change the `primary` color in the theme extension from the current blue to `#1D618E`. If shadcn-style HSL CSS variables are used, also update `--primary` in `src/index.css` to the HSL equivalent of `#1D618E` (approximately `hsl(202 67% 33%)`). Keep `--primary-foreground` as white/near-white so contrast remains AA-compliant.

Verify by searching the codebase for hardcoded blue hex values (`#3b82f6`, `#2563eb`, etc.) — there should be none after this change. If you find any, replace them with `hsl(var(--primary))` or the `text-primary` / `bg-primary` Tailwind utilities.

### `src/index.css`
At the top of the file, add a Google Fonts import for Inter:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

Then in the base layer (or directly on `html, body`), set:

```css
html, body {
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

Do not change any other CSS rule.

### `index.html`
Change `<title>Lovable App</title>` to `<title>Leimberg Customer Portal</title>`. Also update the `og:title` and `og:description` meta tags to match. Leave everything else alone.

---

## Branding replacement — exact instructions per file

The current portal uses a circular blue tile with the letters "NC" plus the word "NumberCruncher" in three places. Replace these with the Leimberg wordmark logo. The logo is wider than it is tall (roughly 6.7:1 aspect ratio), so it should be rendered as an `<img>` tag with a constrained height — never inside a circular tile.

### `src/pages/Welcome.tsx`
- Remove the `<div className="inline-flex ... bg-primary mb-4">` with "NC" text.
- Remove the `<h1>NumberCruncher</h1>`.
- Keep the `<p className="text-muted-foreground mt-2">Customer Portal</p>` line below.
- Insert in their place: `<img src="/leimberg-logo.png" alt="Leimberg, LeClair & Lackner, Inc." className="h-12 mx-auto mb-4" />`
- In the "Demo Accounts" card, leave the seeded emails as-is (they reference `abcaccounting.com` / `xyzconsulting.com` — that's seed data for fictitious customer firms, NOT the portal vendor's brand, so they stay).

### `src/pages/Login.tsx`
- Remove the `<div className="inline-flex ... bg-primary mb-3"><span>NC</span></div>`.
- Change `<h1>Sign in to NumberCruncher</h1>` to `<h1>Sign in to the Customer Portal</h1>`.
- Insert above the heading: `<img src="/leimberg-logo.png" alt="Leimberg, LeClair & Lackner, Inc." className="h-10 mx-auto mb-3" />`

### `src/components/layout/Header.tsx`
- Find the block:
  ```
  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
    <span className="text-primary-foreground font-bold text-sm">NC</span>
  </div>
  <span className="font-semibold text-foreground hidden sm:inline">NumberCruncher</span>
  ```
- Replace it with:
  ```
  <img src="/leimberg-logo.png" alt="Leimberg, LeClair & Lackner, Inc." className="h-7" />
  ```

### `src/pages/SignupWizard.tsx`
- Search for any literal "NumberCruncher" string. Replace any user-facing portal-vendor reference with "Leimberg". Do NOT change product names like "NumberCruncher Desktop", "NumberCruncher Web", "QuickView Desktop", "DataNet", "Rate Module", "Audit Module" — those are products in the seeded catalog and they stay.
- Specifically the toast `"Welcome to NumberCruncher!"` should read `"Welcome to Leimberg!"`.

### Search the rest of the codebase for "NumberCruncher" portal-vendor references
Run a global search for the word `NumberCruncher`. For each hit, decide:
- If it's a **product name** (e.g. `'NumberCruncher Web'`, `'NumberCruncher Desktop'` in the product catalog, in invoice line items, in subscription seed data) → **LEAVE IT ALONE**. These are product SKUs.
- If it's the **portal/vendor name** (e.g. "Welcome to NumberCruncher", "NumberCruncher v4.2", "NumberCruncher Customer Portal") → replace with "Leimberg".

When in doubt, leave it alone and list it at the end of your run for me to review.

### Profile page removal
- Remove the `/profile` route from `src/App.tsx`.
- Remove the `Profile` import from `src/App.tsx`.
- Remove the Profile menu item from the avatar dropdown in `src/components/layout/Header.tsx` (the `<DropdownMenuItem onClick={() => navigate('/profile')}>` block — also remove the `<DropdownMenuSeparator />` immediately above it so we don't leave an orphan divider).
- Do NOT delete the file `src/pages/ProfilePage.tsx` — just unwire it. Keep it on disk in case we reintroduce it later.
- The Sidebar does not currently have a Profile item, so nothing to remove there.

---

## AppContext changes — new derived state

In `src/contexts/AppContext.tsx`, add three derived selectors. Add them in the `AppContextType` interface, implement them inside `AppProvider`, and expose them in the context `value`.

```ts
// In AppContextType interface, add:
hasPaidInvoice: () => boolean;
hasSentQuote: () => boolean;
isFirstTimeCustomer: () => boolean;
```

Implementations (place near the other `getCompany*` selectors):

```ts
const hasPaidInvoice = useCallback((): boolean => {
  const companyId = state.currentCompany?.id;
  if (!companyId) return false;
  return state.invoices.some(i => i.companyId === companyId && i.status === 'paid');
}, [state.invoices, state.currentCompany]);

const hasSentQuote = useCallback((): boolean => {
  const companyId = state.currentCompany?.id;
  if (!companyId) return false;
  return state.quotes.some(q => q.companyId === companyId);
}, [state.quotes, state.currentCompany]);

const isFirstTimeCustomer = useCallback((): boolean => {
  return !hasPaidInvoice();
}, [hasPaidInvoice]);
```

**Important — seed data preservation:** The existing seed data contains paid invoices for both ABC Accounting (`inv-1001`) and XYZ Consulting (`inv-2001`). This means existing demo users (john.smith, sarah.johnson, michael.chen, etc.) will NOT be treated as first-time customers when they log in. That's the correct behavior — the gate is only meant to fire for brand-new signups, not seeded demo accounts.

To make the first-time gate demo-able, **also** update `completeSignup` in AppContext: currently it auto-creates a `paid` invoice as part of finishing the signup wizard. Change the new invoice's status from `'paid'` to `'awaiting_payment'` and `balance` from `0` to `totalAmount`. This way the brand-new signup user will land on Checkout (the rebuilt one we're about to build) with the first-time gate active, not bypass it. Leave the existing seed `initialInvoices` array completely alone.

After this change, a freshly signed-up user has:
- `hasPaidInvoice()` → false (their invoice is `awaiting_payment`, not `paid`)
- `hasSentQuote()` → false
- `isFirstTimeCustomer()` → true

When they complete payment via Checkout (the rebuilt page calls `markInvoicePaid` on their initial invoice — see Checkout spec below), the gate releases.

---

## Sidebar — first-time gate

Modify `src/components/layout/Sidebar.tsx`. The current `navItems` array stays as-is. Add filtering logic:

```ts
const { hasAccess, logout, isFirstTimeCustomer, hasSentQuote } = useApp();

// existing role filter
let visibleItems = navItems.filter(item => hasAccess(item.requiredRoles));

// first-time customer gate (applied AFTER role filter)
if (isFirstTimeCustomer()) {
  if (hasSentQuote()) {
    // Quote sent but not paid: only Quotes + Support
    visibleItems = visibleItems.filter(i => i.path === '/quotes' || i.path === '/support');
  } else {
    // No quote, no payment: only Subscriptions + Support
    visibleItems = visibleItems.filter(i => i.path === '/subscriptions' || i.path === '/support');
  }
}
```

**Do not touch** the role filter — the new gate sits on top of it.

**Important:** When the gate is active (first-time customer), if the user is currently on a page that is no longer in the visible list, `MainLayout` should redirect them. Update `MainLayout.tsx`:

```ts
// After the existing role check, add:
if (isFirstTimeCustomer()) {
  const allowed = hasSentQuote()
    ? ['/quotes', '/support']
    : ['/subscriptions', '/checkout', '/support'];
  if (!allowed.includes(location.pathname)) {
    navigate(hasSentQuote() ? '/quotes' : '/subscriptions');
  }
}
```

Note that `/checkout` is allowed for pre-payment users (because that's where they need to go to pay), but it's not in the sidebar. The sidebar shows "Subscriptions" — `/subscriptions` should auto-redirect new users to `/checkout` (see SubscriptionsPage note below).

### SubscriptionsPage redirect for first-timers
At the top of `src/pages/SubscriptionsPage.tsx`, inside the component, add:

```ts
const { isFirstTimeCustomer } = useApp();
useEffect(() => {
  if (isFirstTimeCustomer()) navigate('/checkout');
}, []);
```

Import `useEffect` from React if not already imported.

---

## CheckoutPage — full rebuild

Replace the contents of `src/pages/CheckoutPage.tsx`. The new page must match this layout spec exactly.

### Layout

Two-column grid on desktop (≥1024px), single column on mobile. Wrapped in `MainLayout`.

- **Left column** (≈ 2/3 width, grows): two stacked sections
  - Section 1: "Select Products"
  - Section 2: "Billing Information"
- **Right column** (≈ 1/3 width, ~340px fixed): sticky Order Summary card (`position: sticky; top: 80px`)

Use Tailwind `grid grid-cols-1 lg:grid-cols-3 gap-6`. Left column spans 2 (`lg:col-span-2`). Right column is `lg:col-span-1`.

### Section 1 — Select Products

```
1. Select Products
Select one or more products to include in your subscription.

[product card] [product card] [product card] [product card]  ← stacked, full width each
```

Use the existing `PRODUCT_CATALOG` from AppContext. For each product, render a card with:

- A square icon tile on the left (40×40, rounded-md, `bg-primary/10`, `text-primary`, containing 2-letter abbreviation: ND / NW / QV / DN / RM / AM). Generate the abbreviation from the product name (first letter of first word + first letter of second word; for single-word names use the first two letters).
- Product name (font-medium, text-base)
- Below the name: price as "$X.XX per seat/year" (text-sm, text-muted-foreground)
- Special case for DataNet: add a green "Included" badge inline next to the product name when ANY other product is selected. The description text changes to: "Included with any product selection. If selected alone, DataNet is $29.00/year."
- On the far right: "Subtotal" label (text-xs, text-muted-foreground) above the dollar amount (text-lg font-semibold, dark text). Show `$0.00` when not selected.
- A checkbox on the left of the card. Card border highlights with `border-primary` when checked.
- **Seat stepper appears ONLY when the card is checked.** Render below the product name/price row, inside the same card, with a "Seats" label, a `−` button, an input showing the count, and a `+` button. Minimum is 1, no maximum. This is existing behavior — preserve it.
- **REMOVE** the green "Annual · Save $21/year" pill that currently appears next to the seat stepper. Do not render it at all.

### DataNet pricing logic

In your state, track which products are checked and their seat counts.

```ts
const otherProductsSelected = lines.some(l => l.productName !== 'DataNet' && l.selected);
const dataNetSelected = lines.find(l => l.productName === 'DataNet')?.selected;

const lineSubtotal = (line) => {
  if (line.productName === 'DataNet') {
    if (!line.selected) return 0;
    return otherProductsSelected ? 0 : 29 * line.licenseCount;
  }
  return line.selected ? line.licenseCount * line.unitPrice : 0;
};
```

The DataNet card's right-side subtotal reads `$0.00` when it's free, `$29.00 × seats` when standalone.

### Section 2 — Billing Information

A card titled "Billing Information" with an "Edit Details" link button on the right side of the header.

Fields displayed read-only inside the card:
- COMPANY (small grey label) — company name from `currentCompany.name`, with a building icon
- EMAIL (small grey label) — current user's email, with an envelope icon
- BILLING ADDRESS (small grey label, full width below) — show `"123 Main St, Anytown, NY 10001, USA"` as default text; if the company has billing details stored, use those instead.

For this iteration, keep billing details as local component state (matching the existing pattern in SubscriptionsPage). The "Edit Details" link opens a modal with editable fields (company name, email, address line 1, city, state, zip, country). Save closes the modal and updates local state. No persistence to context is required for billing details in this iteration.

### Right column — Order Summary card

Sticky card. Title "Order Summary" (text-lg font-semibold). Below:

For each SELECTED line item:
- The 2-letter icon tile (same style as product cards but slightly smaller, 32×32)
- Product name (font-medium)
- Below name: `Qty {n} · Rate $X.XX` (text-xs, text-muted-foreground)
- Right-aligned: line subtotal in `$X,XXX.XX` format
- Special DataNet treatment: show `"Included"` in place of the qty/rate line when free; show `$0.00` as the subtotal in green/muted color

Then a thin divider.

Then the totals block:
- Subtotal — sum of all line subtotals
- Tax (7%) — Subtotal × 0.07
- Total — Subtotal + Tax (slightly larger, font-semibold)
- Balance Due — same as Total, but rendered in primary blue (font-medium, `text-primary`)

Then two stacked buttons:
- **Complete Payment** — primary, full-width, large (`h-11`). Disabled when no products are selected.
- **Get Quote** — outline, full-width, large. Disabled when no products are selected.

### Action handlers

**Complete Payment:**
1. Validate at least one product is selected.
2. Build line items from selected lines.
3. Call `checkoutPurchase({ lineItems, paymentMethod: 'pay_immediately', poNumber: undefined })` — this exists in AppContext. It creates a paid invoice.
4. Show toast: `"Payment successful. Welcome aboard!"`.
5. Navigate to `/dashboard`.

Because the new invoice has status `paid`, `isFirstTimeCustomer()` flips to false, and the full sidebar becomes visible on the next render.

**Get Quote:** opens the Send Quote modal (see below). Does NOT immediately create the quote — the user has to confirm in the modal.

### Send Quote modal

Built with shadcn `Dialog`. Title: "Get Quote". Description: "Review your order and send it as a quote. You can include optional recipients and notes."

Contents:
1. Read-only order summary section (same line items + totals as the right rail, but inside the modal — re-render the data, don't move the rail).
2. `Send to` field: a text input. Placeholder: `"finance@example.com, ap@example.com"`. Help text below: "Optional. Comma-separated email addresses to send the quote to."
3. `Notes` field: a `<Textarea>`. Placeholder: `"Any details we should include with this quote..."`. Help text: "Optional."

Footer buttons:
- Cancel (variant outline) — closes modal, no action.
- **Send Quote** (variant default/primary) — performs the submit.

**Send Quote handler:**
1. Build line items from selected lines (same as Complete Payment).
2. Call `createQuote({ lineItems, note: notesValue })` — this exists in AppContext.
3. If the `Send to` field is non-empty, show a toast `"Quote sent to: {emails}"`. If empty, show toast `"Quote saved. View it on the Quotes page."`.
4. Close the modal.
5. Navigate to `/quotes`.

After this, `hasSentQuote()` returns true, and the sidebar collapses to Quotes + Support only.

**Important about email recipients:** The `Quote` type in AppContext does not currently have a `recipients` field. Add an optional field to the `Quote` interface:

```ts
recipients?: string[];
```

Then update `createQuote` to accept and store recipients. Also update the signature in `AppContextType`:

```ts
createQuote: (input: { lineItems: QuoteLineItem[]; note: string; recipients?: string[] }) => Quote;
```

Parse the comma-separated string into a string array before passing it in. Trim whitespace, drop empty entries. Do not validate the email format — keep it simple for the prototype.

### Things to remove from the current CheckoutPage

- The Tabs component that switches between "Purchase" and "Quote" modes — the new design has both actions side-by-side in the right rail, no tab switcher.
- The current payment-method picker (Pay Immediately / Pay on Receipt / Pay on Terms radio cards). In this rebuilt page, `Complete Payment` is always "pay immediately" — no method picker. The payment method picker stays in OTHER places (license changes, renewals) — only the Checkout page loses it.
- The `prefillProduct` / `prefillLicenses` / `prefillNote` / `fromQuote` query param handling — for now, drop it. We can reintroduce later if needed.
- The mode === 'quote' branch entirely.

### Things to preserve from the current CheckoutPage

- The seat stepper behavior (appears only on checkbox tick).
- The DataNet free-when-bundled logic ($29 when standalone).
- The use of `PRODUCT_CATALOG` for the product list.
- The toast utility.
- The `MainLayout` wrapper.

---

## What NOT to touch

- `src/components/ui/*` — do not edit any shadcn primitive.
- The seed data arrays in AppContext (`initialCompanies`, `initialUsers`, `initialSubscriptions`, `initialLicenses`, `initialInvoices`, `initialQuotes`, `initialTickets`, `initialCompanyConfigs`). The only AppContext change to seed-adjacent code is the status flip in `completeSignup` mentioned above.
- The role-based access logic (`hasAccess`, `getEffectiveRoles`, `pageAccess` mapping). The first-time gate sits ON TOP of role rules, not in place of them.
- Existing pages other than the ones explicitly listed: SubscriptionsPage (one tiny useEffect addition only), CheckoutPage (full rewrite), Welcome (logo swap), Login (logo swap), Header (logo swap + remove Profile menu item), Sidebar (gate logic), MainLayout (redirect logic), AppContext (new selectors + completeSignup status flip + Quote.recipients field + createQuote signature), App.tsx (remove /profile route).
- The existing `RequestQuoteDialog` in `src/components/subscriptions/QuoteDialogs.tsx`. It's used by the post-purchase Quotes page for existing customers requesting new quotes. The new "Send Quote" modal we're building in Checkout is a DIFFERENT modal — build it inline in CheckoutPage, do not modify RequestQuoteDialog.

---

## Acceptance criteria

When you're done, all of these must be true:

1. `npm run dev` starts without errors.
2. The login page shows the Leimberg wordmark logo at the top.
3. The Welcome page shows the Leimberg wordmark logo.
4. The top-left of the sidebar shows the Leimberg wordmark logo (no more "NC" circle).
5. The primary blue throughout the app (buttons, links, active sidebar item) matches `#1D618E`.
6. The font on every page is Inter.
7. The page title in the browser tab reads "Leimberg Customer Portal".
8. Logging in as `john.smith@abcaccounting.com` shows the FULL sidebar (because ABC has a paid invoice in seed data).
9. Going through `/signup` from start to finish results in landing on `/checkout` with ONLY Subscriptions + Support visible in the sidebar.
10. The rebuilt `/checkout` page matches the visual spec: two-column layout, product cards with right-aligned subtotals, sticky order summary on the right with Subtotal / Tax (7%) / Total / Balance Due, and Complete Payment + Get Quote buttons.
11. The seat stepper appears only when a product checkbox is ticked.
12. The "Annual · Save $21/year" pill is gone.
13. Selecting any product makes DataNet's subtotal $0.00 (when DataNet is also selected). Deselecting all other products makes DataNet's subtotal $29.00 × seats.
14. Clicking "Get Quote" opens a modal with order summary, Send to field, Notes field, Cancel, and Send Quote buttons.
15. Submitting the Send Quote modal saves the quote, shows a toast, and redirects to `/quotes`. After this, the sidebar shows ONLY Quotes + Support.
16. Clicking "Complete Payment" creates a paid invoice, shows a success toast, redirects to `/dashboard`, and the full sidebar is now visible (because the first-time gate is released).
17. The Profile menu item is gone from the avatar dropdown.
18. Visiting `/profile` shows the 404 NotFound page.
19. No "NumberCruncher" text appears anywhere as a portal/vendor name. Product names like "NumberCruncher Web" remain.
20. No console errors when navigating between pages.

---

## Reporting back

At the end of your run, give me a short summary with:

1. The list of every file you modified.
2. The list of every file you created.
3. Any "NumberCruncher" references you found in the codebase that you weren't sure whether to replace, and your reasoning for the choice you made.
4. Any deviations from this spec — if you had to compromise anywhere, say so explicitly.
5. The result of running `npm run build` (or note that you couldn't run it). If it errors, paste the error.

Do not commit anything. I will review your changes and decide what to keep.
