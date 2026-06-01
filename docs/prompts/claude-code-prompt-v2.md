# Claude Code Prompt — Catalog Cleanup + DataNet Auto-Select + Subscription Activation + Downloads Gating + Font Polish

Copy everything below this line into Claude Code in VS Code. Run it on the project root.

---

## Context

You previously rebranded this React + TypeScript + Vite + Tailwind + shadcn/ui customer portal from "NumberCruncher" to "Leimberg, LeClair & Lackner, Inc." and rebuilt the Checkout page. This prompt is a follow-up with six related changes. All previous work stays in place.

Before you write any code, read these files in this exact order:

1. `src/contexts/AppContext.tsx` — pay attention to `PRODUCT_CATALOG`, `checkoutPurchase`, the `Subscription` interface, and the `initialSubscriptions` seed
2. `src/pages/CheckoutPage.tsx` — your previous rewrite
3. `src/pages/SubscriptionsPage.tsx` — note the "No subscriptions" empty state
4. `src/pages/DownloadsPage.tsx` — current download UI
5. `src/components/layout/Sidebar.tsx`
6. `tailwind.config.ts` and `src/index.css` — for font/size scale work
7. `src/pages/Dashboard.tsx` — to verify type scale consistency

Do NOT start coding until you have read those seven files.

---

## Change 1 — Reduce the product catalog to 4 products

In `src/contexts/AppContext.tsx`, find the `PRODUCT_CATALOG` constant. It currently contains 5 entries: NumberCruncher, QuickView Desktop, DataNet, Rate Module, Audit Module.

**Replace it with exactly these 4 products:**

```ts
export const PRODUCT_CATALOG = [
  { name: 'NumberCruncher Desktop', defaultPrice: 349, description: 'Desktop tax and accounting application', type: 'desktop' as const, latestVersion: '4.2', hasInstaller: true },
  { name: 'NumberCruncher Web', defaultPrice: 349, description: 'Browser-based NumberCruncher access', type: 'web' as const, latestVersion: '4.2', hasInstaller: false },
  { name: 'QuickView Desktop', defaultPrice: 199, description: 'Desktop reporting and analytics app', type: 'desktop' as const, latestVersion: '2.1', hasInstaller: true },
  { name: 'DataNet', defaultPrice: 29, description: 'Industry data network and alerts', type: 'service' as const, latestVersion: '1.0', hasInstaller: false },
];
```

Notes:
- DataNet's `defaultPrice` changes from `0` to `29`. The "included free with any bundle" logic stays in CheckoutPage — it's computed there, not from the catalog price.
- The original catalog had a single `'NumberCruncher'` entry of type `'hybrid'`. We're splitting it into two separate SKUs (Desktop and Web) because the rest of the app already treats them as separate products (see the seed subscriptions `prod-web` and `prod-desktop`).
- Remove `Rate Module` and `Audit Module` entirely.

After this change, search the codebase for any reference to `'Rate Module'` or `'Audit Module'` and remove those references. Do not touch product names in seeded invoices/subscriptions if you can't tell whether they refer to these modules — list them at the end of your run for me to review.

---

## Change 2 — DataNet auto-selection on the Checkout page

In `src/pages/CheckoutPage.tsx`, modify the product-line state behavior:

**Auto-select rule:** When the user checks ANY product other than DataNet, if DataNet is not already checked AND has not been manually unchecked in this session, auto-check DataNet too.

**Manual unchecking is allowed:** If the user manually unchecks DataNet (with another product selected), DataNet stays unchecked. Do NOT re-auto-select it on subsequent product checks within the same session. Track this with a flag.

**User unchecks all other products:** DataNet stays in whatever state the user left it in. The user explicitly chose, so we don't override.

**Suggested implementation:**

```ts
const [dataNetManuallyUnchecked, setDataNetManuallyUnchecked] = useState(false);

const toggleLine = (idx: number, checked: boolean) => {
  setLines(prev => {
    const next = prev.map((l, i) => i === idx ? { ...l, selected: checked } : l);
    const changed = next[idx];

    // If the user just toggled DataNet specifically:
    if (changed.productName === 'DataNet') {
      // Record manual uncheck so we don't auto-re-add it later
      if (!checked) setDataNetManuallyUnchecked(true);
      else setDataNetManuallyUnchecked(false);
      return next;
    }

    // If user just checked a non-DataNet product, and DataNet hasn't been manually unchecked,
    // auto-check DataNet.
    if (checked) {
      const dnIdx = next.findIndex(l => l.productName === 'DataNet');
      if (dnIdx >= 0 && !next[dnIdx].selected && !dataNetManuallyUnchecked) {
        next[dnIdx] = { ...next[dnIdx], selected: true };
      }
    }
    return next;
  });
};
```

Keep the existing `$0 when bundled, $29 when standalone` pricing logic. Just wire the auto-select on top of it.

**Visual cue:** When DataNet's card is auto-selected (i.e., its checkbox is checked AND at least one other product is checked), keep the existing "Included" green badge visible. The card behaves like any other selected card but its subtotal shows $0.00.

---

## Change 3 — Remove the blue border on selected product cards

In `src/pages/CheckoutPage.tsx`, find where the product cards apply the conditional class `border-primary` or similar selected-state styling.

**Remove the selected-state border highlight entirely.** Selected and unselected cards should have identical borders. The only visual difference between selected and unselected should be:
- The checkbox state (checked vs unchecked)
- Whether the seat stepper row is rendered (only when selected)
- The right-side Subtotal value (real number vs $0.00)

Specifically:
- Strip any class like `border-primary` or `border-2` from selected cards.
- Both states use the same `border` (default 1px gray border from shadcn Card).
- Do NOT change the card's hover state.

---

## Change 4 — Checkout payment creates a real Subscription

This is the biggest change. Currently, `checkoutPurchase` in `AppContext.tsx` only creates an Invoice — it does NOT create a Subscription record. That's why the Subscriptions page shows "No Subscriptions" after first payment.

### Update `checkoutPurchase` in `src/contexts/AppContext.tsx`

Change its signature and behavior so it ALSO creates a Subscription containing the purchased products, and links the Invoice to that Subscription.

Replace the existing `checkoutPurchase` implementation with one that does the following:

1. Build a new `Subscription` record:
   - `id`: `sub-${Date.now()}`
   - `companyId`: `state.currentCompany?.id || 'company-1'`
   - `name`: `'Annual Plan'`
   - `planType`: `'Annual'`
   - `billingFrequency`: `'annual'`
   - `status`: `'active'` if `paymentMethod === 'pay_immediately'`, else `'pending_payment'`
   - `startDate`: today
   - `renewalDate`: today + 365 days
   - `baseFee`: `1000` (matches the seeded subscriptions' convention)
   - `perSeatCost`: `10`
   - `products`: derive from line items. For each line item create a `SubscriptionProduct` with:
     - `id`: `prod-${Date.now()}-${index}`
     - `name`: line item productName
     - `licenseCount`: line item quantity
     - `purchasedLicenseCount`: line item quantity
     - `pricePerLicense`: line item unitPrice
     - `status`: `'active'`

2. Build the Invoice as before, but set its `subscriptionId` to the new subscription's id, and its `subscriptionName` to `'Annual Plan'`. Keep `activatesSubscription: paymentMethod === 'pay_on_receipt'`.

3. Add the new subscription to `state.subscriptions` AND add the invoice to `state.invoices` in a single `setState` call.

4. Return the invoice (existing return shape preserved).

**Auto-assign licenses for the first user:** After creating the subscription, also create one `License` per product assigned to the current user (so they can immediately use what they bought). Each license:
- `userId`: `state.currentUser?.id || 'user-1'`
- `subscriptionId`: the new subscription's id
- `productId`: the corresponding product id
- `assignedAt`: today

This means a newly-signed-up user immediately has their bought products assigned to themselves.

**Also revisit the `completeSignup` function** that I previously asked you to modify. Currently it auto-creates a subscription for the brand-new signup with all the wizard-selected products plus an `awaiting_payment` invoice. That logic is now redundant because the Checkout page will be doing the actual purchase. Update `completeSignup` so it:

- Still creates the new company and user
- Does NOT create a subscription anymore (the user will create it via Checkout)
- Does NOT create any invoice anymore
- Does NOT create any licenses
- Just sets `currentUser`, `currentCompany`, `isAuthenticated: true`, `demoRoles: ['owner']`

This way the brand-new signup lands on the portal with `hasPaidInvoice() === false` and no subscriptions yet — they MUST go through Checkout. After they complete Checkout, the real subscription is created with whatever products they actually pick (which may differ from what they clicked in the wizard).

### Update the SubscriptionsPage empty state

In `src/pages/SubscriptionsPage.tsx`, when `subscriptions.length === 0`, the empty state already shows a "Get Started" button that navigates to `/signup`. Change that button to navigate to `/checkout` instead. Update the helper text to "You don't have any active subscriptions yet. Get started by selecting products." Keep the icon and overall layout.

Remember: the existing `useEffect` you added that auto-redirects first-time customers from `/subscriptions` to `/checkout` still works correctly — this empty-state change is a fallback for the rare case where someone lands on `/subscriptions` after wiping their state in another way.

---

## Change 5 — Downloads page: gate by actual subscription

In `src/pages/DownloadsPage.tsx`, change how products are listed and how their buttons behave.

### Source of truth

Replace any logic that lists "all products" with this:
- Always show all 4 products from `PRODUCT_CATALOG` (the user should see what they could subscribe to, not just what they own — that's the marketing tactic the user wants).
- For each product, compute `isSubscribed` = whether ANY of the user's active subscriptions contains a product with the same `name`. Use `getCompanySubscriptions()` for this.

```ts
const subs = getCompanySubscriptions();
const isSubscribed = (productName: string) =>
  subs.some(s => s.status === 'active' && s.products.some(p => p.name === productName));
```

### Card rendering rules

For each of the 4 products:

**If subscribed:**
- Show "Licensed" green badge (top-right of card)
- Show product name, description, version, release date
- Buttons depend on product type:
  - Desktop product (`NumberCruncher Desktop`, `QuickView Desktop`): "Download" primary button + format dropdown chevron + "Resources" outline button
  - Web product (`NumberCruncher Web`): "Open" button (opens new tab — toast for now since no real URL) + "Resources" outline button
  - Service product (`DataNet`): "Open" button + "Resources" outline button

**If NOT subscribed:**
- Show "Not Subscribed" grey badge (top-right of card)
- Show product name, description, version, release date — keep these visible (this is the marketing tactic; user wants to see what they're missing)
- Buttons:
  - "Download" button (or "Open" for non-installable products) — **rendered but disabled** (grey, no hover, no click). Tooltip on hover: "Subscribe to download" (or "Subscribe to access" for web/service products).
  - "More Info" button — **enabled and clickable**. Onclick shows a toast: `"More info about {Product Name} — Contact sales for pricing details."` (placeholder action — we'll replace with a real link later)

### Visual treatment of unsubscribed cards

Apply a slight opacity treatment to the unsubscribed card so it's clearly differentiated: wrap the product name and description in a `div` with `opacity-70`, but keep the buttons section at full opacity. The "Not Subscribed" badge uses the same grey style as the existing greyed-out badges in the codebase (use `variant="outline"` with `text-muted-foreground` and `bg-muted/40`).

### Remove the existing subscription filter dropdown

There's currently a "Subscription: All" filter at the top-left of the page. Leave it where it is and keep its functionality — it filters by which subscription the products belong to. Just verify it still works after your product-list changes. Do not redesign it.

---

## Change 6 — Font and type scale consistency pass

You previously loaded Inter globally. Inter IS the right font. The remaining inconsistencies the user is noticing are most likely in the type scale — different pages using different Tailwind size classes for what should be the same semantic role.

Enforce a strict type scale across the app. Use this exact mapping wherever you find a heading or label that should fit one of these roles:

| Role | Tailwind classes |
|---|---|
| Page title (e.g. "Downloads", "Subscriptions") | `text-2xl font-semibold tracking-tight` |
| Page description / subtitle | `text-sm text-muted-foreground` |
| Section heading inside a page (e.g. "1. Select Products") | `text-xl font-semibold` |
| Section description | `text-sm text-muted-foreground` |
| Card title | `text-base font-semibold` |
| Card subtitle / metadata | `text-xs text-muted-foreground` |
| Body text | `text-sm` |
| Form labels | `text-sm font-medium` |
| Small captions / footnotes | `text-xs text-muted-foreground` |
| Button text | inherits from button variant (do not change) |
| Table header cells | `text-xs font-medium text-muted-foreground uppercase tracking-wide` |
| Money / numeric emphasis | `font-semibold` (size depends on context) |

**Do not blanket-rewrite every page.** Instead, audit these specific pages and align them to the scale:
- `src/pages/Dashboard.tsx`
- `src/pages/CheckoutPage.tsx`
- `src/pages/SubscriptionsPage.tsx`
- `src/pages/DownloadsPage.tsx`
- `src/pages/Login.tsx`
- `src/pages/Welcome.tsx`
- `src/components/layout/Sidebar.tsx` (sidebar items: `text-sm font-medium`)
- `src/components/layout/Header.tsx` (header text: `text-sm`)

When auditing, only change a class if it's clearly wrong for its semantic role (e.g. a section heading using `text-lg` when the scale says `text-xl`). Leave anything that's already correct alone.

**Also set base line-height** in `src/index.css`:
```css
html, body {
  /* keep existing font-family rule */
  line-height: 1.5;
}
```

---

## What NOT to touch

- The Leimberg branding (logo, color, login layout) — already done previously
- The first-time customer gate logic (`isFirstTimeCustomer`, `hasSentQuote`, sidebar filtering in `Sidebar.tsx` and `MainLayout.tsx`)
- The shadcn UI primitives in `src/components/ui/*`
- The seeded data arrays (`initialCompanies`, `initialUsers`, `initialSubscriptions`, etc.) EXCEPT where they reference removed products like Rate Module / Audit Module — if any seeded data references those, flag them to me at the end (do not silently delete)
- The Send Quote modal — keep as-is
- The existing role-based access (`hasAccess`, `pageAccess`)

---

## Acceptance criteria

When you're done, all of these must be true:

1. `npm run dev` runs without errors.
2. The product catalog has exactly 4 products: NumberCruncher Desktop, NumberCruncher Web, QuickView Desktop, DataNet — in that order.
3. On the Checkout page, checking any product (other than DataNet) auto-checks DataNet.
4. If the user manually unchecks DataNet after it was auto-selected, it stays unchecked and is not re-auto-selected on later product checks within the same session.
5. DataNet's subtotal is $0.00 when bundled with any other product, and $29.00 × seats when standalone.
6. Selected product cards on Checkout no longer have a blue border highlight — they look the same as unselected cards apart from the checkbox state and the subtotal value.
7. After clicking Complete Payment on Checkout (as a brand-new signup who has nothing yet), the user lands on Dashboard and the Subscriptions page now shows a real subscription containing the products they purchased.
8. The Subscriptions page no longer shows "No Subscriptions" for a user who has paid via Checkout.
9. The Downloads page shows all 4 products. Products in the user's active subscription show "Licensed" badge with working Download/Open buttons. Products not in any subscription show "Not Subscribed" badge with a disabled Download/Open button and an enabled "More Info" button that shows a toast.
10. The Downloads page applies a slight opacity to unsubscribed product name/description but keeps buttons at full opacity.
11. Page titles, section headings, body text, labels, and metadata across Dashboard, Checkout, Subscriptions, Downloads, Login, and Welcome use the type scale specified above. No page should feel visually inconsistent next to another.
12. `npm run build` (or `npm run build:dev`) completes without errors.
13. No console errors when navigating between pages.

---

## Demo flow to verify the whole change manually

After your changes, this end-to-end flow should work:

1. Go to `/`, click "Create Account & Start Subscription"
2. Go through the 8-step signup wizard
3. Click finish → land on `/checkout`. Sidebar shows only Subscriptions + Support.
4. Check "NumberCruncher Desktop" → DataNet auto-checks, both cards have NO blue border, NumberCruncher Desktop shows seat stepper, DataNet's subtotal is $0.00.
5. Manually uncheck DataNet → DataNet stays unchecked.
6. Check NumberCruncher Web → DataNet does NOT auto-recheck (remembered manual uncheck).
7. Refresh the page → state resets. Check NumberCruncher Desktop again → DataNet auto-checks (manual flag was reset by refresh — that's fine).
8. Click "Complete Payment" → toast confirms payment → redirected to `/dashboard` → sidebar now shows the full menu.
9. Click "Subscriptions" → see the new Annual Plan subscription with NumberCruncher Desktop + DataNet listed.
10. Click "Product Downloads & Links" → NumberCruncher Desktop and DataNet show "Licensed" with working buttons; NumberCruncher Web and QuickView Desktop show "Not Subscribed" with disabled Download button and enabled More Info button.
11. Click "More Info" on QuickView Desktop → toast confirms.
12. Visually scan Dashboard, Checkout, Subscriptions, Downloads — font sizes feel uniform across pages.

---

## Reporting back

At the end of your run, give me a short summary with:

1. The list of every file you modified.
2. Any references to `'Rate Module'` or `'Audit Module'` you found in non-catalog files (especially seed data, page text, etc.) and the action you took for each.
3. Any seeded subscriptions/invoices/quotes that still reference removed products — flag them, do not delete.
4. Any deviations from this spec.
5. The output of `npm run build` (success or full error log).

Do not commit. I'll review your changes manually.
