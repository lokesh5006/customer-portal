# Claude Code Prompt v11a — Request Quote: Dual-Flow (Old + New) Behind a Feature Flag

Copy everything below this line into Claude Code in VS Code. Run on the project root.

---

## Context

We are adding a NEW version of the Request Quote dialog that splits the flow into two modes (update seats in existing products vs. request a quote for a new product) and filters the product picker accordingly. We want to demo BOTH the old and the new dialog to stakeholders before committing to either.

To support that, this batch keeps BOTH dialog code paths and switches between them with a single code constant `USE_NEW_QUOTE_FLOW`. The button gating (disable Request Quote when the customer has no active subscription) applies in BOTH flows \u2014 it is not part of the toggle.

Before you write any code, read these files in this exact order:

1. `src/components/subscriptions/QuoteDialogs.tsx` \u2014 the current `RequestQuoteDialog` component
2. `src/pages/QuotesPage.tsx` \u2014 where the Request Quote button is rendered and its current enable/disable logic
3. `src/contexts/AppContext.tsx` \u2014 `PRODUCT_CATALOG` (or equivalent), the company\u2019s subscriptions, the `SubscriptionProduct` shape, role helpers, and any helper like `getCompanyActiveSubscriptions`
4. `src/components/ui/radio-group.tsx` \u2014 confirm the shadcn radio group primitive exists; if not, note it

Do NOT start coding until you have read those files.

---

## Final Decisions (binding)

| Topic | Decision |
|---|---|
| Two code paths | Keep the EXISTING dialog untouched. Add the NEW radio-based dialog as a separate component. |
| Flag | A single boolean constant `USE_NEW_QUOTE_FLOW` controls which dialog renders. Default `true` (show the new flow). Flip to `false` to show the old flow. |
| Flag location | A dedicated, easy-to-find file: `src/config/featureFlags.ts` |
| Button gating | Applies in BOTH flows. Request Quote button disabled when the customer has no active subscription. NOT controlled by the flag. |
| New dialog default mode | \u201cRequest a quote for a new product\u201d |
| Existing mode product list | Only products on the customer\u2019s ACTIVE subscription(s). DataNet excluded. |
| New mode product list | Only catalog products NOT on any active subscription. DataNet excluded. |
| Switching radio | Clears all line items. Confirm only if at least one line item exists. |
| Storing mode on quote | Do NOT store the mode. Pure UI filter. |
| Teardown | Document exactly what to delete when one flow is confirmed (see Teardown Notes). |

---

## Change 1 — Feature flag file

### New file: `src/config/featureFlags.ts`

```ts
/**
 * Feature flags for demo-time toggling.
 *
 * USE_NEW_QUOTE_FLOW
 *   true  -> Request Quote dialog uses the NEW radio-based flow
 *            (existing-products vs new-product modes, filtered product lists)
 *   false -> Request Quote dialog uses the OLD flow
 *            (plain product picker, full catalog minus DataNet, no mode radio)
 *
 * Flip this manually before a demo. After the flow is confirmed, remove the
 * losing dialog component and delete this flag (see v11a Teardown Notes).
 */
export const USE_NEW_QUOTE_FLOW = true;
```

Keep this file tiny and obvious. It is the single switch point.

---

## Change 2 — Button gating (applies in BOTH flows)

### File: `src/pages/QuotesPage.tsx`

The Request Quote button gating is independent of the flag. Add the active-subscription condition.

```tsx
const activeSubscriptions = subscriptions.filter(
  s => s.companyId === currentCompany?.id && s.status === 'active'
);
const hasActiveSubscription = activeSubscriptions.length > 0;

const canRequestQuote =
  (currentUserHasRole('account_owner') || currentUserHasRole('billing_admin')) &&
  !isReadOnlyMode();

const requestQuoteDisabled = !canRequestQuote || !hasActiveSubscription;
```

Render the button disabled when `requestQuoteDisabled` is true, wrapped in a tooltip. Because disabled buttons may not fire hover events, wrap the button in a `span`:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span tabIndex={0}>
      <Button disabled={requestQuoteDisabled} onClick={() => setRequestDialogOpen(true)}>
        Request Quote
      </Button>
    </span>
  </TooltipTrigger>
  {requestQuoteDisabled && !hasActiveSubscription && (
    <TooltipContent>
      You need an active subscription to request a quote. Purchase a subscription from Checkout to get started.
    </TooltipContent>
  )}
</Tooltip>
```

Role visibility is unchanged \u2014 do not render the button at all for roles other than AO/Billing Admin (existing behavior). This gating affects both the old and new flows identically.

---

## Change 3 — Render the correct dialog based on the flag

### File: `src/components/subscriptions/QuoteDialogs.tsx`

Keep the existing `RequestQuoteDialog` exactly as it is, but rename it to make the two versions explicit and avoid confusion:

1. Rename the current component to `RequestQuoteDialogClassic` (no behavior change \u2014 just the name). Keep all its current logic: full product list minus DataNet, quantity, note, submit creating a `requested` quote.
2. Create a new component `RequestQuoteDialogModes` implementing the radio-based flow (Change 4).
3. Export a thin wrapper `RequestQuoteDialog` that picks based on the flag:

```tsx
import { USE_NEW_QUOTE_FLOW } from '@/config/featureFlags';

export function RequestQuoteDialog(props: RequestQuoteDialogProps) {
  return USE_NEW_QUOTE_FLOW
    ? <RequestQuoteDialogModes {...props} />
    : <RequestQuoteDialogClassic {...props} />;
}
```

This way, `QuotesPage.tsx` keeps importing `RequestQuoteDialog` and nothing changes at the call site. The flag decides internally.

Both components must accept the SAME props interface so the wrapper can pass through identically. If the existing dialog had props like `open`, `onOpenChange`, keep them identical on the new one.

---

## Change 4 — New dialog: `RequestQuoteDialogModes`

### Radio group at top

```tsx
type QuoteRequestMode = 'existing' | 'new';
const [mode, setMode] = useState<QuoteRequestMode>('new'); // default per decision
```

```tsx
<div className="space-y-3 mb-4">
  <Label className="text-sm font-medium">What would you like to request?</Label>
  <RadioGroup value={mode} onValueChange={handleModeChange}>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="new" id="mode-new" />
      <Label htmlFor="mode-new" className="font-normal cursor-pointer">
        Request a quote for a new product
      </Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="existing" id="mode-existing" />
      <Label htmlFor="mode-existing" className="font-normal cursor-pointer">
        Update seats in existing products
      </Label>
    </div>
  </RadioGroup>
</div>
```

### Mode-switch handler clears line items

```tsx
const handleModeChange = (next: string) => {
  const nextMode = next as QuoteRequestMode;
  if (nextMode === mode) return;
  if (lineItems.length > 0) {
    const confirmed = window.confirm('Switching will clear the products you\u2019ve added. Continue?');
    if (!confirmed) return;
  }
  setLineItems([]);
  setMode(nextMode);
};
```

If the codebase has an `AlertDialog` confirmation pattern already in use, prefer it over `window.confirm` for consistency. Native confirm is acceptable otherwise.

### Filtered product lists

```tsx
const subscribedProductNames = useMemo(() => {
  const names = new Set<string>();
  subscriptions
    .filter(s => s.companyId === currentCompany?.id && s.status === 'active')
    .forEach(s => s.products.forEach(p => names.add(p.name)));
  return names;
}, [subscriptions, currentCompany]);

const catalogWithoutDataNet = useMemo(
  () => PRODUCT_CATALOG.filter(p => p.name !== 'DataNet'),
  []
);

const availableProducts = useMemo(() => {
  if (mode === 'existing') {
    return catalogWithoutDataNet.filter(p => subscribedProductNames.has(p.name));
  }
  return catalogWithoutDataNet.filter(p => !subscribedProductNames.has(p.name));
}, [mode, catalogWithoutDataNet, subscribedProductNames]);
```

The per-line-item product dropdown sources its options from `availableProducts`. Duplicate-product prevention still applies within the filtered list.

### Empty-list helper note

If `availableProducts` is empty:
- `mode === 'new'`: \u201cYou\u2019re already subscribed to all available products. Switch to \u2018Update seats in existing products\u2019 to request more seats.\u201d
- `mode === 'existing'`: \u201cNo active subscription products found.\u201d (defensive; button gating should prevent reaching this)

When the helper note shows, disable Add Line Item and Submit Request.

### Submit

Submit behaves exactly like the classic dialog: validates at least one line item, no duplicates, creates a quote with `status: 'requested'`, emits the `quote.received` notification. The mode is NOT persisted on the quote.

---

## What NOT to touch

- The quote status model and lifecycle
- The Quote model shape (no new fields, no mode field)
- The Accept / Decline / Regenerate flows
- The Checkout flow
- DataNet auto-inclusion logic
- Pricing logic
- The notification system
- The dark mode system
- shadcn primitives

---

## Acceptance criteria

1. `npm run dev` and `npm run build` complete without errors.
2. A new file `src/config/featureFlags.ts` exports `USE_NEW_QUOTE_FLOW` (default `true`).
3. With `USE_NEW_QUOTE_FLOW = true`, opening Request Quote shows the radio-based dialog defaulting to \u201cRequest a quote for a new product.\u201d
4. With `USE_NEW_QUOTE_FLOW = false`, opening Request Quote shows the original dialog exactly as before this change (no radio, full catalog minus DataNet).
5. The Request Quote button is disabled (in BOTH flows) when the customer has no active subscription, with a tooltip explaining why.
6. The Request Quote button is enabled (in BOTH flows) when the customer has an active subscription and is AO/Billing Admin and not in read-only mode.
7. In the new dialog\u2019s \u201cnew product\u201d mode, the product dropdown shows only products NOT on any active subscription, DataNet excluded.
8. In the new dialog\u2019s \u201cexisting products\u201d mode, the product dropdown shows only subscribed products, DataNet excluded.
9. Switching the radio with line items present prompts for confirmation and clears items on confirm.
10. Switching with no line items switches immediately.
11. DataNet never appears in either product dropdown in the new flow.
12. The new \u201cnew product\u201d mode shows the helper note and disables Add/Submit when the customer already owns every product.
13. Both flows create a quote with `status: 'requested'` on submit; no mode field is stored.
14. Flipping the constant requires no other code change to switch flows.

---

## Manual demo flow

1. Confirm `USE_NEW_QUOTE_FLOW = true`. Log in as a user whose company has an active subscription.
2. Visit Quotes. Request Quote button is enabled. Open it \u2014 the radio-based dialog appears, defaulting to new-product.
3. Verify new-product dropdown excludes subscribed products and DataNet.
4. Add a line item, switch the radio \u2014 confirm prompt, items clear, dropdown now shows subscribed products.
5. Submit \u2014 a Requested quote appears.
6. Set `USE_NEW_QUOTE_FLOW = false`, rebuild/refresh. Open Request Quote \u2014 the ORIGINAL dialog appears (no radio, full catalog minus DataNet).
7. Submit from the classic dialog \u2014 a Requested quote appears, same as before.
8. (Gating, both flows) Log in as a user with no active subscription. The Request Quote button is disabled with the tooltip, regardless of the flag value.

---

## Teardown Notes (for after the flow is confirmed)

When stakeholders confirm which flow to keep, cleanup is simple:

- **If keeping the NEW flow:** delete `RequestQuoteDialogClassic`, delete the wrapper\u2019s conditional, rename `RequestQuoteDialogModes` back to `RequestQuoteDialog`, delete `src/config/featureFlags.ts` (or just the `USE_NEW_QUOTE_FLOW` constant if other flags live there).
- **If keeping the OLD flow:** delete `RequestQuoteDialogModes`, delete the wrapper\u2019s conditional, rename `RequestQuoteDialogClassic` back to `RequestQuoteDialog`, delete the flag.

The button gating (Change 2) stays in both cases \u2014 it is not part of the experiment.

---

## Reporting back

At the end of your run, summarize:

1. Files modified and created.
2. Confirmation that the classic dialog is byte-for-byte behavior-identical to before (only renamed).
3. Confirmation that flipping `USE_NEW_QUOTE_FLOW` swaps flows with no other change.
4. Confirmation that button gating applies in both flows.
5. Confirmation DataNet is excluded from both new-flow product lists.
6. Whether you used `window.confirm` or an existing AlertDialog for the switch confirmation.
7. Any deviations from this spec.
8. `npm run build` output.

Do not commit. I will review.
