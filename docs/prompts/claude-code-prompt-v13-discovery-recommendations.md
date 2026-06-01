# Claude Code Prompt v13 — Discovery Recommendations (All 14 in One Commit)

Copy everything below this line into Claude Code in VS Code. Run on the project root (`cusotmerportal2`).

**This is one atomic update implementing 14 client recommendations from a recent discovery call.** The client has NOT yet confirmed these recommendations — they are our team's proposed answers, captured in a discovery document being sent for client review. You are building against the recommendations on speculation to keep momentum. A risk register accompanies this prompt so reverts can be surgical if the client overrides any.

**Commit strategy:** ONE single commit at the end covering all changes. Do not commit until I review.

---

## Context

This portal is a Lovable-generated React + TypeScript + Vite + Tailwind + shadcn customer portal for Leimberg, LeClair & Lackner. It has been incrementally built across v1–v12 prompts with full feature coverage: subscriptions, multi-payment-method checkout, Manage Licenses drawer with seat reduction overlay, Pay Now, Quotes lifecycle, Users & Contacts, DataNet, Notifications system, Demo Role switcher, Admin Tool, and demo-friendly login that routes unknown emails to ABC Accounting.

Before you write any code, read these files in this order to understand current state:

1. `src/contexts/AppContext.tsx` — the central state, all data operations, the proration helpers (look for any existing `proratedCharge` or `calculateLicenseChange` math), the `Company` type, the `CatalogProduct` type, the `Subscription` type, the `Invoice` type
2. `src/components/subscriptions/QuoteDialogs.tsx` (or wherever `ManageLicensesDrawer` lives) — the seat-reduction overlay, the paid-license counter, the per-user expiry/remove-now choice UI
3. `src/pages/AdminPage.tsx` — current admin tool sections, including any company configuration form
4. `src/pages/PaymentPage.tsx` (or `/pay` page) — current invoice payment screen and what fields it captures
5. `src/components/checkout/CheckoutDialogs.tsx` or `src/pages/CheckoutPage.tsx` — quote-accept flow, PO field placement
6. `src/pages/QuotesPage.tsx` — the Request Quote dialog and self-quote flow
7. `src/contexts/AppContext.tsx` (search for) `permissions` / role-gating helpers

Do NOT start coding until you have read those files.

---

## The 14 recommendations (with their final implementation rules)

Each recommendation is tagged CRITICAL (blocks client review) or NICE (helpful refinement). All are implemented in this prompt.

### Q1 — Pricing model: license + maintenance split with proration only on maintenance (CRITICAL)

**Rule:** Each catalog product has a TOTAL price and a MAINTENANCE portion (configured in admin tool per product). The license portion (= total − maintenance) is the perpetual-license cost. The maintenance portion is the annual service fee.

When a customer adds licenses or products mid-cycle:
- The license portion is charged in FULL (no proration — they either own that perpetual seat or they don't).
- The maintenance portion is prorated by DAYS for the remainder of the current subscription year.

When a customer renews:
- Renewal charges ONLY the maintenance portion (no license re-purchase) for each existing seat.

**Customer-facing UI:** Show ONE prorated total per line item. Do NOT break out license vs maintenance to the customer. The split is an internal calculation only.

**Implementation:**

a. Extend `CatalogProduct` type:
```ts
interface CatalogProduct {
  // existing fields...
  maintenancePerSeatPerYear: number;  // NEW — admin-configurable
}
```
Default seed values when extending existing products: maintenance = 30% of total price, rounded to nearest dollar. (E.g., NumberCruncher Desktop at $595 → maintenance $179, license $416. Match the discovery doc's example.)

b. Add proration helper in `src/lib/proration.ts` (create file if missing; otherwise add to existing):
```ts
const DAYS_IN_YEAR = 365;

export interface ProratedAddCharge {
  seats: number;
  daysRemaining: number;
  licenseCharge: number;        // FULL license portion × seats
  maintenanceChargeProrated: number;   // (days/365) × maintenance × seats
  totalCharge: number;          // sum
}

export function calculateProratedAdd(input: {
  product: CatalogProduct;
  seats: number;
  addDate: Date;
  renewalDate: Date;
  useLegacyProration?: boolean;  // for fallback (see Q1 fallback below)
}): ProratedAddCharge {
  const daysRemaining = Math.max(0, Math.ceil((input.renewalDate.getTime() - input.addDate.getTime()) / (1000 * 60 * 60 * 24)));

  if (input.useLegacyProration) {
    // Legacy: simple flat proration on the TOTAL price
    const totalPerSeat = input.product.pricePerSeatPerYear;
    const prorated = (daysRemaining / DAYS_IN_YEAR) * totalPerSeat * input.seats;
    return {
      seats: input.seats, daysRemaining,
      licenseCharge: 0,
      maintenanceChargeProrated: 0,
      totalCharge: Math.round(prorated * 100) / 100,
    };
  }

  // New math: license full, maintenance prorated
  const totalPerSeat = input.product.pricePerSeatPerYear;
  const maintenancePerSeat = input.product.maintenancePerSeatPerYear;
  const licensePerSeat = totalPerSeat - maintenancePerSeat;
  const licenseCharge = licensePerSeat * input.seats;
  const maintenanceChargeProrated = (daysRemaining / DAYS_IN_YEAR) * maintenancePerSeat * input.seats;
  return {
    seats: input.seats, daysRemaining,
    licenseCharge: Math.round(licenseCharge * 100) / 100,
    maintenanceChargeProrated: Math.round(maintenanceChargeProrated * 100) / 100,
    totalCharge: Math.round((licenseCharge + maintenanceChargeProrated) * 100) / 100,
  };
}

export function calculateRenewalCharge(input: {
  product: CatalogProduct;
  seats: number;
}): number {
  return Math.round(input.product.maintenancePerSeatPerYear * input.seats * 100) / 100;
}
```

c. Replace existing proration calls in `requestLicenseChange`, `addProductToSubscription`, and renewal-invoice generation with the new helpers. Pass the company's `useLegacyProration` flag through (see Q1 fallback). When `useLegacyProration === true`, the new helper falls back to the old simple math.

d. Invoice line items continue showing ONE total per line (no breakdown). Internally, the line stores both portions so an audit could surface them later, but the customer-facing description is unchanged.

### Q1 fallback toggle — Admin Tool

Add to `AppState` an admin-level flag `useLegacyProration: boolean` (default `false`). Expose a toggle in the Admin Tool:
```
Pricing Calculation Mode:
[●] New (maintenance-only proration)   ← default
[ ] Legacy (full-price proration)

Use this toggle to revert to the previous simple proration math if needed.
```

Read this flag in every proration call. The flag is global (not per-company) for simplicity.

### Q2 — No portal action for separate-subscription exception (NICE)

**Rule:** The portal does NOT expose any "Request separate subscription" action. Out-of-band contact (email/phone) is the path for customers who need a separate billing arrangement.

**Implementation:** Verify nothing in the portal advertises this. No changes expected. If you find any stale UI suggesting customers can request a separate subscription, remove it.

### Q3 — Optional PO field on Pay Now invoice screen (CRITICAL)

**Rule:** When a customer pays an awaiting-payment invoice via `/pay`, they can OPTIONALLY enter a PO number. The PO is captured on the invoice record. Not required.

**Exception:** If the invoice came from quote-accept (it already had a PO captured), pre-fill the field with the existing PO and allow editing.

**Implementation:**

a. Add to the Pay Now page form a collapsible / always-visible "PO Number (optional)" field.
b. On submit, write the PO to the invoice: `invoice.poNumber = poNumber` (or update existing field).
c. After payment success, the invoice detail shows the PO.
d. Wire this in for ALL invoice payment flows that route through `/pay`: checkout (pay immediately), invoice pay-now from `/invoices`, suspension-recovery pay, renewal pay, quote-accept pay-immediately.

### Q4 — Notification on PO-bearing OR PO-required mid-cycle invoice (CRITICAL)

**Rule:** When a customer creates an invoice via mid-cycle license change (Manage Licenses → Pay on Receipt or Pay Immediately), notify the admin team if EITHER:
- The customer entered a PO on Pay Now, OR
- The company is flagged with `alwaysRequirePO` (we are NOT building this flag per Q5 refinement — see Q5 below — so for now: notify only when a PO is entered).

**Per-Q5-refinement:** Since we are not adding the `alwaysRequirePO` admin flag, the notification trigger simplifies to: **notify when a PO is entered on a mid-cycle invoice.**

**Implementation:**

a. Add a new `NotificationType`: `'admin.po_entered_on_invoice'`. Add to the catalog with category `account` (or a new `admin` category if cleaner). `rolesAllowed`: empty (notify the admin team — but in this prototype, the "admin team" is the admin users of Leimberg, which doesn't exist as a real entity; for demo purposes, also notify the AO of the customer's company AND log the notification on the seeded demo user `lindsay@leimberg.com` if such a user exists, otherwise just the AO).
b. In `Pay Now` submit handler, when PO is entered AND invoice source is `mid_cycle_license` (or `mid_cycle_add`): call `notify(...)` with the new type.
c. Title: "PO entered on mid-cycle invoice". Message: `${customerCompany} entered PO ${poNumber} on invoice ${invoiceNumber} for ${formatCurrency(amount)}.` Link: `/invoices`.

### Q5 — Admin tool: maintenance amount per product + fallback toggle (NICE, refined)

**Rule (refined from discovery doc):** We are NOT building the "always require PO" company flag. The admin tool gains:
- A per-product **maintenance amount** field (number input, dollars per seat per year).
- A "View pricing config" button per product showing the license/maintenance split and a prorated example.
- The Q1 fallback toggle (Pricing Calculation Mode).

**Implementation:**

a. Admin Tool gets a new section: **Product Pricing Configuration**. Lists each catalog product with:
   - Total price (read-only display)
   - Maintenance amount (editable number input)
   - "View pricing config" button
b. The "View pricing config" button opens a dialog showing:
   - License portion: `$X` (= total − maintenance)
   - Maintenance portion: `$Y`
   - **Live preview:** "For 5 seats added with 200 of 365 days remaining: License charge $X × 5 = $A. Prorated maintenance: ($Y × 5) × (200/365) = $B. Total: $A + $B = $C."
   - Inputs for "seats" and "days remaining" so the admin can plug different numbers and verify the math.
c. Save persists changes to the in-memory catalog. State resets on reload.
d. The Pricing Calculation Mode toggle (Q1 fallback) sits at the top of this section.

### Q6 — License reactivation: AO + Billing Admin only (NICE)

**Rule:** Only Account Owner and Billing Admin can initiate license reactivation. License Admin and Registered Contact cannot.

**Implementation:** Wire into the permission system. The reactivation action button only renders for those two roles.

### Q7 — Previously-held licenses visible for reactivation (NICE)

**Rule:** A customer can reactivate a previously-held (deactivated) license for the prorated cost of the remainder of the current subscription year. No back-charge for missed renewal years.

**Implementation:**

a. Extend the `License` type with `deactivatedAt?: string` and `deactivatedReason?: string` (optional).
b. When a user is removed from a seat AND the seat is then explicitly "released" (not just reassigned), mark the license `deactivatedAt = now`. For the prototype, simulate this in seed data: add 2 deactivated licenses on ABC Accounting (different products, different deactivation dates).
c. In `ManageLicensesDrawer`, add a new section "Previously held licenses" (visible to AO + Billing Admin only — Q6 gates it). The section lists deactivated licenses for the current company's products with:
   - Product name
   - Original assignment date and deactivation date
   - "Reactivate" button → opens a small confirmation dialog showing:
     - Prorated maintenance for the remainder of the current year (uses Q1 helper, applied to 1 seat)
     - Payment method selector (existing payment methods)
     - Pay button
d. On reactivate confirm:
   - Generate an invoice with the prorated maintenance amount (license portion is NOT charged because the customer already paid for the perpetual license previously).
   - The license record's `deactivatedAt` is cleared.
   - The seat count for that product on the subscription increases by 1.
   - User assignment is left empty (the AO/BA assigns a user to it after via the existing seat-assignment flow).

### Q8 — Self-quote required fields: product + seats only (NICE)

**Rule:** When a customer self-creates a quote (Request Quote dialog), the only required fields are:
- At least one product
- Seat count per product

Optional: PO number, customer note.

**Implementation:** Verify the existing Request Quote dialog has this validation. If PO or note is currently required, change to optional. Submit button enables only when at least one product + seats are present.

### Q9 — Terminology: "Current paid licenses" / "Paid licenses at next renewal" (CRITICAL)

**Rule:** The Manage Licenses drawer's two seat-count fields use these exact labels:
- "Current paid licenses" — the count today (left field)
- "Paid licenses at next renewal" — the count after the cycle ends (right field)

**Implementation:** Find and rename all occurrences. This appears in:
- The drawer header section
- The seat-reduction overlay
- Help text and tooltips
- Any toast or confirmation messages referencing the counts

Replace the current labels (likely "Number of paid licenses" or similar). Audit the whole drawer carefully.

### Q10 — Notice for expiring-seat assignment by License Admin (CRITICAL)

**Rule:** When a License Admin assigns a user to an existing expiring seat (a seat marked "Expire at end of cycle"), display this exact notice:

> "This license is paid through {endOfCycleDate}. To continue this seat at renewal, your Billing Admin must mark it as renewing in Manage Licenses."

Where `{endOfCycleDate}` is replaced with the formatted subscription renewal date (e.g., "December 31, 2026").

**Implementation:**

a. In the seat-assignment flow (when assigning a user to a seat from `ManageLicensesDrawer` or `UserEditDrawer`), check if the target seat is marked expiring.
b. If yes AND current role is License Admin: render the notice as a non-dismissible callout (amber tint, info icon) in the assignment dialog before the user can complete the assignment.
c. The notice is informational only — the assignment proceeds normally. The Billing Admin separately handles flipping the seat to "renewing" via the drawer's existing expire/renew controls.
d. If the current role is Billing Admin or Account Owner: the notice does NOT show (they can directly flip the seat themselves).

### Q11 — Expiring/renewing toggle in Manage Licenses only (NICE)

**Rule:** The toggle to mark a seat as expiring vs renewing exists ONLY in the Manage Licenses drawer. Do NOT add the same toggle to the user record screen or anywhere else.

**Implementation:** Verify no duplicate toggle exists elsewhere. If you find one, remove it.

### Q12 — Manage Licenses role permissions (CRITICAL)

**Rule:** Enforce this exact permission table in the Manage Licenses drawer:

| Action | Account Owner | Billing Admin | License Admin |
|---|---|---|---|
| Change current paid license count | ✓ | ✓ | ✗ |
| Change paid licenses at next renewal | ✓ | ✓ | ✗ |
| Choose remove-now vs expire-at-cycle-end per user | ✓ | ✓ | ✗ |
| Change a seat from expiring to renewing (or back) | ✓ | ✓ | ✗ |
| Assign / unassign users in existing paid seats | ✓ | ✓ | ✓ |
| Reactivate previously-held licenses (per Q6) | ✓ | ✓ | ✗ |

Registered Contact has no access to the Manage Licenses drawer (read-only / no entry point).

**Implementation:** Audit the drawer's role gating. Add or correct `useCan('manage_seats_count')`, `useCan('manage_user_assignment')`, `useCan('manage_seat_renewal_status')`, `useCan('reactivate_license')` action keys as needed. Define the action keys in `permissions.ts` (or wherever the action-permission map lives).

### Q13 — Owner-only capabilities (NICE)

**Rule:** Reserve two capabilities for Account Owner only:
- Transfer account ownership
- Close / cancel the account

Everything else can be shared with Billing Admin.

**Implementation:** These are net-new features. Build them as STUBS:

a. In the Admin Tool, add a new section "Account Management" visible only to Account Owner. It contains two stub buttons:
   - "Transfer Ownership" → opens a dialog with a placeholder ("This feature is coming soon. Contact support to transfer ownership.")
   - "Close Account" → opens a confirm dialog with destructive styling and placeholder text ("This feature is coming soon. Contact support to close your account.")

These are intentionally non-functional stubs. The point is to establish the placement and role gating so client review can confirm.

b. Both stubs require `useCan('owner_only_actions')` returning true. Define this action key — only `account_owner` role is allowed.

### Q14 — Keep current role labels (CRITICAL)

**Rule:** Use existing role labels everywhere: Account Owner, Billing Admin, License Admin, Registered Contact. Do not rename.

**Implementation:** Verify no rename has crept in. Check ROLE_LABELS, all UI references. Should be no changes expected — verify only.

---

## What NOT to touch

- The Leimberg branding, colors, fonts
- The dark mode system
- The four-role taxonomy itself (Account Owner, Billing Admin, License Admin, Registered Contact)
- The Demo Role switcher
- The notification bell UI (the new `admin.po_entered_on_invoice` type just plugs into the existing system)
- Existing seed users, companies, subscriptions, quotes (only EXTEND seed for deactivated licenses, do not replace)
- The shadcn UI primitives
- Existing first-time customer gate, suspension, renewal generator logic (only the proration math inside them changes per Q1)
- Quote acceptance PO flow (unchanged — PO already captured at accept time per existing v7+ behavior)

---

## Acceptance criteria

When you're done, all of these must be true:

### Build & basics
1. `npm run dev` and `npm run build` complete without errors.
2. No console errors during any of the demo flows below.
3. Dark mode renders correctly on all new UI (admin tool changes, reactivation section, PO field on Pay Now).

### Q1 — Pricing & proration
4. Each catalog product has a `maintenancePerSeatPerYear` value; existing seed products are extended with 30%-of-total defaults.
5. The proration engine charges full license + prorated maintenance on mid-cycle adds.
6. Customer-facing UI shows ONE prorated total per line item (no breakdown into license/maintenance).
7. The Pricing Calculation Mode toggle in Admin Tool flips between new and legacy math, and the change reflects in subsequent proration calculations.

### Q3 — PO on Pay Now
8. The Pay Now screen (`/pay`) shows an optional "PO Number" field for invoice payments.
9. Entering a PO and submitting writes `invoice.poNumber`. Leaving it blank does NOT block payment.
10. For invoices that already had a PO (from quote-accept), the field pre-fills with the existing PO and remains editable.

### Q4 — Notification on PO-entered mid-cycle invoice
11. When a customer enters a PO while paying a mid-cycle license invoice, the new `admin.po_entered_on_invoice` notification is created.
12. The notification appears in the bell feed for the appropriate recipient (AO of the customer's company; bonus if a Leimberg-side admin user exists).
13. The notification is NOT created when no PO is entered.

### Q5 — Admin tool product pricing
14. Admin Tool has a "Product Pricing Configuration" section listing all catalog products.
15. Each row has an editable "Maintenance amount per seat per year" input.
16. "View pricing config" opens a dialog with license/maintenance split + a live calculator (seats + days remaining inputs producing a prorated total).
17. The Pricing Calculation Mode toggle is at the top of this section.

### Q6 + Q7 — License reactivation
18. The Manage Licenses drawer shows a "Previously held licenses" section (visible to AO + BA only).
19. The section lists ≥1 seeded deactivated license for ABC Accounting (add 2 in seed if missing).
20. "Reactivate" opens a small dialog with the prorated maintenance amount and a payment method selector.
21. Confirming creates an invoice for the prorated amount and increases the seat count on the subscription by 1.
22. License Admin and Registered Contact do NOT see the "Previously held licenses" section.

### Q8 — Self-quote validation
23. Request Quote dialog requires only product(s) + seats. PO and note fields are optional.

### Q9 — Terminology
24. The Manage Licenses drawer's two seat-count fields are labeled exactly "Current paid licenses" and "Paid licenses at next renewal".
25. No instance of the old label ("Number of paid licenses" or similar) remains in the drawer, related toasts, or tooltips.

### Q10 — Expiring-seat notice
26. When a License Admin assigns a user to an expiring seat, the exact notice (with the date interpolated) appears as an amber callout.
27. The notice does NOT appear when an Account Owner or Billing Admin makes the same assignment.

### Q11 — Toggle location
28. The expiring/renewing toggle exists only in the Manage Licenses drawer. No duplicate elsewhere.

### Q12 — Role permissions in Manage Licenses
29. License Admin cannot change paid-license counts, expire/renew status, or reactivate; can only assign/unassign users in existing seats.
30. AO and BA can do everything in the drawer.
31. Registered Contact has no entry to the drawer.

### Q13 — Owner-only stubs
32. Admin Tool has an "Account Management" section visible only to Account Owner.
33. "Transfer Ownership" and "Close Account" buttons exist as stubs with placeholder dialogs.

### Q14 — Role labels
34. Role labels unchanged: Account Owner, Billing Admin, License Admin, Registered Contact.

---

## Manual demo flow

1. Log in as `john.smith@abcaccounting.com` (Account Owner).
2. Go to Admin Tool → Product Pricing Configuration. Verify the list of products with maintenance amounts.
3. Click "View pricing config" on NumberCruncher Desktop. Verify the dialog shows the license/maintenance split and a live calculator. Plug "5 seats, 200 days remaining" → verify math.
4. Toggle Pricing Calculation Mode to Legacy. Go to Manage Licenses, add 5 seats — verify the prorated total is the legacy math. Toggle back to New, repeat — verify the new math (license full + maintenance prorated).
5. Manage Licenses → verify the drawer shows "Current paid licenses" and "Paid licenses at next renewal" labels.
6. Reduce paid licenses by 2 → verify the seat-reduction overlay still works and the labels match Q9.
7. Scroll to "Previously held licenses" section. Click Reactivate on one. Verify the prorated maintenance dialog, payment selector, and that confirming creates an invoice + increases seat count.
8. Switch to License Admin role via Demo Role switcher. Open Manage Licenses → verify "Previously held licenses" section is hidden. Assign a user to an expiring seat → verify the Q10 notice appears.
9. Switch to Account Owner → assign a user to an expiring seat → notice does NOT appear (you can flip it yourself).
10. Pay any awaiting-payment mid-cycle invoice on `/pay`. Enter a PO number → verify it saves and the new admin notification appears in the bell.
11. Go to Admin Tool → verify the "Account Management" section appears. Click "Transfer Ownership" → verify stub dialog.
12. Switch to Billing Admin → Admin Tool's Account Management section is HIDDEN.

---

## Reporting back

At the end of your run, summarize:

1. Every file modified and every file created.
2. The complete list of changes per recommendation (Q1 through Q14), with status: "implemented as specified" / "implemented with deviation X" / "verified existing — no change".
3. The proration math sanity check: for NumberCruncher Desktop at $595 total / $179 maintenance, 5 seats added at 200 of 365 days remaining → expected output: license $416 × 5 = $2,080 + maintenance ($179 × 5) × (200/365) = $490.41 → total $2,570.41. Confirm your engine produces this.
4. Any places where the existing code structure made a recommendation harder to implement cleanly, and the workaround you chose.
5. Confirmation that the changes are wrapped in a SINGLE commit-ready set (working tree shows all the edits together).
6. `npm run build` output.

Do NOT commit yet. I will review, then provide the commit message for an atomic single commit.
