# Claude Code Prompt v13-resume — Finish Previously Held Licenses + Reactivation Dialog

Copy everything below this line into Claude Code in VS Code. Run on the project root.

**Context:** A previous v13 run crashed mid-edit on the Manage Licenses drawer while adding the "Previously held licenses" section. The build is clean, so the partial state is sane. This is a small follow-up prompt that finishes ONLY the remaining piece (Q6 + Q7 from the v13 plan). Do NOT redo any other v13 work.

---

## Step 0 — Audit what already exists

Before writing any code, audit the current state. Read these files and determine which v13 pieces are already done:

1. `src/contexts/AppContext.tsx`
   - Does the `License` type include `deactivatedAt?: string` and `deactivatedReason?: string`? (Q7 — type extension)
   - Is there a `reactivateLicense(...)` operation defined?
   - Is there a helper like `getDeactivatedLicensesForCompany(companyId)` or similar?

2. `src/data/seed.ts` (or wherever license seeds live)
   - Are there at least 2 deactivated licenses seeded for ABC Accounting (`company-1`)? (i.e., License records with `deactivatedAt` set, for two different products at two different dates)

3. `src/lib/permissions.ts` (or wherever the permission map / action keys live)
   - Is there an action key `reactivate_license` (or similar) with `rolesAllowed: ['account_owner', 'billing_admin']`? (Q6)

4. `src/components/subscriptions/QuoteDialogs.tsx` (or wherever `ManageLicensesDrawer` lives)
   - Is there ALREADY a "Previously held licenses" section / heading rendered in the drawer? (Likely NOT — this is what crashed)
   - Is there a `ReactivateLicenseDialog` component imported or referenced?

Based on the audit, only build what is missing. Report at the end which steps you skipped because they were already in place.

---

## Step 1 — Backfill anything missing from foundation (only if needed)

If any of the foundation pieces from Step 0 are missing, add them. The acceptance is:

### 1a. License type extension

```ts
interface License {
  // existing fields...
  deactivatedAt?: string;        // ISO timestamp
  deactivatedReason?: string;    // optional, free text
}
```

### 1b. AppContext operations

Add `reactivateLicense(input)` to AppContext if missing:

```ts
reactivateLicense(input: {
  licenseId: string;
  paymentMethodId: string;  // existing saved method to charge against
}): { invoiceId: string }
```

Behavior:
- Find the deactivated license by id. Confirm it has `deactivatedAt` set.
- Clear `deactivatedAt` and `deactivatedReason` on the license.
- Find the subscription containing this license's product. Increase that product's `licenseCount` by 1.
- Compute prorated maintenance for 1 seat using the existing v13 proration helper (`calculateProratedAdd` or equivalent), with `addDate = now` and `renewalDate = subscription.renewalDate`. Use ONLY the maintenance portion (license portion is NOT charged for reactivation — the customer already paid for the perpetual license previously).
- Create an invoice for that prorated maintenance amount + 7% tax. Mark it `paid` and link to the saved payment method (treat as paid immediately for simplicity — the demo can later split into pay-flow if you want, but reactivation defaults to pay-immediately).
- Return the new invoice id.

Add a getter helper:

```ts
getDeactivatedLicensesForCompany(companyId: string): License[]
```

Returns licenses where `deactivatedAt` is set AND the license belongs to a subscription owned by `companyId`.

### 1c. Seed deactivated licenses for ABC

If not already present, seed 2 deactivated licenses on ABC Accounting (`company-1`):

```ts
// Deactivated 6 months ago, NumberCruncher Desktop
{
  id: 'lic-abc-deactivated-1',
  subscriptionId: '<ABC's main subscription>',
  productId: '<NumberCruncher Desktop product ID on that subscription>',
  userId: null,
  licenseType: 'user',
  assignedAt: <some past date>,
  deactivatedAt: <6 months ago ISO>,
  deactivatedReason: 'Employee left',
},
// Deactivated 14 months ago, QuickView Desktop
{
  id: 'lic-abc-deactivated-2',
  subscriptionId: '<ABC's main subscription>',
  productId: '<QuickView Desktop product ID on that subscription>',
  userId: null,
  licenseType: 'user',
  assignedAt: <some past date>,
  deactivatedAt: <14 months ago ISO>,
  deactivatedReason: 'Reduced team size',
},
```

Use whatever existing date helpers the seed uses (`isoDaysAgo` or similar).

### 1d. Permission action key

In `src/lib/permissions.ts` (or equivalent), add:

```ts
reactivate_license: ['account_owner', 'billing_admin']
```

Skip any of 1a–1d that already exists from the partial v13 run.

---

## Step 2 — Add the "Previously held licenses" section to the drawer

This is the piece that crashed. In `ManageLicensesDrawer` (in `src/components/subscriptions/QuoteDialogs.tsx` or wherever it lives), add a new section AFTER the existing assigned-users list and BEFORE the closing of the main panel content.

### 2a. Role gating

```tsx
const can = useCan();
const canReactivate = can('reactivate_license');
```

Render the section ONLY when `canReactivate === true`. License Admin and Registered Contact will not see it.

### 2b. Section content

```tsx
{canReactivate && (
  <section className="mt-6 pt-6 border-t border-border">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-foreground">Previously held licenses</h3>
      <p className="text-xs text-muted-foreground">
        Reactivate to add a seat back. You'll be charged a prorated maintenance fee for the remainder of this year.
      </p>
    </div>

    {deactivatedLicenses.length === 0 ? (
      <p className="text-sm text-muted-foreground italic">No previously held licenses available to reactivate.</p>
    ) : (
      <ul className="space-y-2">
        {deactivatedLicenses.map((lic) => (
          <li key={lic.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/30">
            <div className="min-w-0">
              <div className="text-sm font-medium">{getProductName(lic.productId)}</div>
              <div className="text-xs text-muted-foreground">
                Deactivated {formatDate(lic.deactivatedAt)}
                {lic.deactivatedReason && ` · ${lic.deactivatedReason}`}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReactivateTarget(lic)}
            >
              Reactivate
            </Button>
          </li>
        ))}
      </ul>
    )}
  </section>
)}
```

`deactivatedLicenses` comes from `getDeactivatedLicensesForCompany(currentCompany.id)` and is filtered to those whose productId matches a product currently on the drawer's subscription (so reactivation always lands on the same subscription the drawer is managing).

If the drawer is scoped to a single product (e.g., the drawer is opened for one specific product on the subscription), filter further so only deactivated licenses for THAT product are shown. Audit the drawer's existing scope and apply consistently.

---

## Step 3 — Build the ReactivateLicenseDialog

Create `src/components/subscriptions/ReactivateLicenseDialog.tsx` (or co-locate inside `QuoteDialogs.tsx` if that matches the existing pattern).

### 3a. Props

```ts
interface ReactivateLicenseDialogProps {
  license: License | null;          // null = closed
  onOpenChange: (open: boolean) => void;
  onConfirmed?: () => void;         // optional callback after success
}
```

### 3b. Dialog content

When `license` is non-null, render an `AlertDialog` (or `Dialog` matching existing pattern):

- **Title:** "Reactivate license"
- **Body:**
  - Product name (large)
  - "This will add 1 seat to your subscription and charge a prorated maintenance fee for the remainder of the current year. No charge for the license itself — you already own it."
  - A summary block showing:
    - Days remaining in current year: `{daysRemaining}` / 365
    - Prorated maintenance amount: `{formatCurrency(proratedAmount)}`
    - Tax (7%): `{formatCurrency(tax)}`
    - Total: `{formatCurrency(total)}` (bold)
  - Payment method selector: dropdown of company's saved payment methods, primary preselected
- **Buttons:** Cancel + "Reactivate & Pay {total}"

### 3c. Compute the prorated amount

Use the v13 proration helper from `src/lib/proration.ts`:

```ts
const subscription = getSubscriptionForLicense(license.id);
const product = getProductOnSubscription(subscription, license.productId);
const charge = calculateProratedAdd({
  product,
  seats: 1,
  addDate: new Date(),
  renewalDate: new Date(subscription.renewalDate),
  useLegacyProration: appState.useLegacyProration,
});
// Reactivation only charges the maintenance portion, NOT the license portion:
const proratedAmount = charge.maintenanceChargeProrated;
const tax = Math.round(proratedAmount * 0.07 * 100) / 100;
const total = proratedAmount + tax;
```

If `useLegacyProration` is true, the helper returns `totalCharge` directly (no separate maintenance portion). In that case, use `charge.totalCharge` for the prorated amount. Comment this branch clearly.

### 3d. On confirm

```ts
const result = reactivateLicense({
  licenseId: license.id,
  paymentMethodId: selectedPaymentMethod.id,
});
toast({
  title: 'License reactivated',
  description: `A seat has been added to ${product.name}. Invoice ${result.invoiceId} has been paid.`,
});
onOpenChange(false);
onConfirmed?.();
```

### 3e. Wire into the drawer

In `ManageLicensesDrawer`:

```tsx
const [reactivateTarget, setReactivateTarget] = useState<License | null>(null);

// ... later in the render ...
<ReactivateLicenseDialog
  license={reactivateTarget}
  onOpenChange={(open) => !open && setReactivateTarget(null)}
  onConfirmed={() => {
    // The drawer's local state will refresh from context automatically since
    // reactivateLicense mutated AppState. No extra action needed.
  }}
/>
```

---

## What NOT to do

- Do NOT redo or modify any other v13 work (pricing math, PO field, notifications, Admin Tool sections, labels, role permissions, owner-only stubs). Verify they exist; do not touch them.
- Do NOT change the proration helper signature — use it as-is from v13.
- Do NOT add a separate `/reactivate` page. Reactivation lives only in the Manage Licenses drawer.
- Do NOT charge the license portion on reactivation — maintenance only.
- Do NOT add a row in the user-assignment table for the reactivated seat until the user manually assigns someone to it.

---

## Acceptance criteria

1. `npm run build` completes without errors.
2. As Account Owner of ABC: open the Manage Licenses drawer. Scroll down. The "Previously held licenses" section is visible with at least 2 deactivated licenses listed.
3. As Billing Admin: same — section visible.
4. As License Admin: section is HIDDEN.
5. As Registered Contact: drawer not accessible at all (existing role gate).
6. Click Reactivate on one license → the dialog opens with product name, prorated breakdown, payment method selector, total.
7. Click Reactivate & Pay → the invoice is created and marked paid, the license's `deactivatedAt` is cleared, the seat count on the matching product increases by 1, the dialog closes, a toast confirms.
8. The reactivated license disappears from "Previously held licenses" (because it no longer has `deactivatedAt`).
9. Visit Invoices: the new paid invoice appears with the correct amount.
10. No console errors during any of the above.

---

## Reporting back

At the end of your run, summarize:

1. The Step 0 audit results: which foundation pieces were already in place vs newly added.
2. Files modified and files created.
3. The reactivation math sanity check: with the new pricing model, reactivating one NumberCruncher Desktop license ($179 annual maintenance) at 200 days remaining → expected: ($179 × 200/365) = $98.08 prorated maintenance + 7% tax ($6.87) = **$104.95 total**. Confirm your engine produces this (or close — rounding may shift by a cent).
4. Confirmation that all other v13 work was left untouched.
5. `npm run build` output.

Do NOT commit yet — I will review. We will then add this on top of the prior v13 changes in the same atomic commit.
