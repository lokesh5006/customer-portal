# Claude Code Prompt v12a — Manage Seats Drawer Redesign + Decrease-Below-Assigned Overlay

Copy everything below this line into Claude Code in VS Code. Run on the project root.

This is the FIRST of two related batches (v12a now, v12b after). v12a redesigns the Manage Licenses drawer (renamed conceptually to "Manage seats") and adds the decrease-below-assigned overlay flow. v12b will wire the Dashboard product badges to open this same drawer.

---

## Context

The current Manage Licenses drawer lets a user change a product\u2019s seat count and pick a payment method. We are redesigning it to match a new spec and adding a richer decrease flow.

Key new behavior: when a user decreases the seat count BELOW the number of currently-assigned licenses, an overlay appears requiring them to choose which assigned users to drop \u2014 each either "Remove now" (unassign immediately) or "Expire end of year" (keep until renewal). Critically, decreases do NOT reduce the current paid term; they are scheduled to take effect on the renewal (new subscription start date).

Before you write any code, read these files in this exact order:

1. `src/components/subscriptions/QuoteDialogs.tsx` \u2014 the `ManageLicensesDrawer` component (current seat stepper, payment picker, submit logic)
2. `src/contexts/AppContext.tsx` \u2014 `Subscription`, `SubscriptionProduct`, the license model, how assigned licenses are tracked per product, `requestLicenseChange`, `formatCurrency`, and any pending-change fields already added in prior work (check for `pendingLicenseCount`, `pendingEffectiveDate`, `pendingUnassignedUserIds` from US-SP09-SB-001 spec \u2014 they may or may not exist yet)
3. `src/pages/SubscriptionsPage.tsx` \u2014 how product cards render seat counts (we add a scheduled-change preview here)
4. `src/components/ui/dialog.tsx`, `sheet.tsx`, `checkbox.tsx`, `button.tsx` \u2014 confirm primitives

Do NOT start coding until you have read those files.

---

## Final Decisions (binding for v12a)

| Topic | Decision |
|---|---|
| Drawer title | "Manage seats" (subtitle: product/subscription name + plan type) |
| Summary card | Purple card showing Current seats, New seats, Currently assigned, then a divider, then Seats delta and Price change, then a per-seat cost line |
| Seat editor | \u2212 / number input / + / Apply. Apply disabled until the count differs from current; enabled on change |
| User list badge wording | "Assigned" / "Unassigned" (NOT Active/Inactive) \u2014 reflects license assignment, not account status |
| Increase flow | Straightforward: Apply enables Save changes; payment follows existing rules (Pay Immediately / Pay on Receipt / Pay on Terms) |
| Decrease above assigned | Allowed freely; no overlay (no assigned users need dropping) |
| Decrease below assigned | On Apply, overlay appears requiring the user to choose which assigned users to drop |
| Overlay choices | Per selected user: "Remove now" OR "Expire end of year". Total selected across both columns must equal the reduction count |
| Remove now | Unassign the user\u2019s license immediately on Save; the seat remains paid for the current term and can be reassigned |
| Expire end of year | User keeps their assignment until renewal, then drops |
| Seat count effect | Current paid term does NOT drop. The reduced count is scheduled for the renewal/new-subscription start date. No refund. |
| Price change shown | The renewal-term difference (negative for a decrease, positive for an increase). For increases, the increase is also charged for the current term per existing payment rules. |
| Subscriptions page preview | On the affected product card, show the scheduled count change effective on the renewal date |

---

## Change 1 \u2014 Redesign the drawer layout

### File: `src/components/subscriptions/QuoteDialogs.tsx` (`ManageLicensesDrawer`)

Restructure the drawer to match this layout (top to bottom):

**Header**
- Title: "Manage seats"
- Subtitle: `{productName}` in normal weight + `{planType}` (e.g., "Annual") in muted text

**Summary card (purple, `bg-primary text-primary-foreground`, rounded, padded)**
- Row: "Current seats" \u2026 right-aligned `{currentSeats}`
- Row: "New seats" \u2026 right-aligned `{newSeats}` (reflects the pending input after Apply; before Apply it equals currentSeats)
- Row: "Currently assigned" \u2026 right-aligned `{assignedCount}`
- A subtle divider line
- Row: "Seats" \u2026 right-aligned delta with arrow: `\u2191 +N seats` (increase) or `\u2193 \u2212N seats` (decrease) or `+0 seats` (no change)
- Row: "Price change" \u2026 right-aligned `+$X.XX/year` or `\u2212$X.XX/year`
- Sub-line in muted text: `per seat cost +${perSeatCost}/year`

**Seat editor**
- Centered label: "Update available seats"
- Row: `\u2212` button | number input (centered value) | `+` button | Apply button
- Apply is disabled (muted green) when the input equals current seats; becomes solid green when the input differs
- Clicking Apply commits the input to "New seats" in the summary AND, for a decrease-below-assigned, triggers the overlay (see Change 3)

**Assigned users list**
- Header row: "Assigned users" (left) and "{assignedCount} of {newSeats} seats assigned" (right, muted)
- Scrollable list; each row: avatar initials, name, email, and a status badge reading "Assigned" or "Unassigned"
- The badge reflects whether the user currently holds a license for this product

**Footer**
- Cancel button (closes drawer, no changes)
- Save changes button (primary; disabled until there is a pending change AND, for decrease-below-assigned, the overlay has been confirmed)

---

## Change 2 \u2014 Apply button + summary recalculation

When the user changes the number (via stepper or typing) and clicks Apply:

1. Set `newSeats` = input value
2. Recompute the summary:
   - Seats delta = `newSeats \u2212 currentSeats`
   - Price change = `delta \u00d7 perSeatCost` (negative for a decrease)
3. If `newSeats >= assignedCount`: no overlay needed. Enable Save changes.
4. If `newSeats < assignedCount`: open the decrease overlay (Change 3). Save changes stays disabled until the overlay is confirmed.

Apply is disabled whenever the input equals `currentSeats` (nothing to apply).

The per-seat cost is read from the product\u2019s pricing (the same value used elsewhere). Price change uses `formatCurrency`.

---

## Change 3 \u2014 Decrease-below-assigned overlay

When Apply is clicked and `newSeats < assignedCount`, render an overlay (positioned over the drawer body, modal-on-modal style) with:

**Header text:**
> "The licenses you have paid for will last through the year. Please select the {reductionCount} users you would like to remove now or at the end of the year."

Where `reductionCount = assignedCount \u2212 newSeats`.

**Table:**
- Columns: User | Remove now | Expire end of year
- One row per currently-assigned user
- Each of the two columns has a checkbox per row
- Per-user rule: a user can be checked in AT MOST one of the two columns (mutually exclusive per row). Checking one unchecks the other.
- A user may also be left entirely unchecked.

**Validation counter (below the table):**
- "{selectedCount} of {reductionCount} required removals selected"
- Red text + red-tinted overlay background while `selectedCount !== reductionCount`
- Green text + green-tinted overlay background when `selectedCount === reductionCount`
- `selectedCount` = total users checked across BOTH columns

**Buttons:**
- Back (returns to the drawer without committing the overlay; the seat input stays at the attempted value but Save changes remains disabled until re-confirmed)
- Confirm (disabled until `selectedCount === reductionCount`)

**On Confirm:**
1. Record, per selected user, whether they are "remove_now" or "expire_end_of_year"
2. Close the overlay
3. Enable Save changes on the drawer
4. The summary card now reflects the decrease

---

## Change 4 \u2014 Save changes: persistence + scheduling

When Save changes is clicked:

### For an increase
- Follow the existing payment flow (Pay Immediately / Pay on Receipt / Pay on Terms) exactly as the current Manage Licenses drawer does
- The increase applies to the current term per the existing payment-timing rules
- No overlay was involved

### For a decrease (overlay was confirmed)
- Do NOT reduce the current term\u2019s paid seat count
- Do NOT issue a refund
- For each "remove_now" user: unassign their license for this product immediately (set their assignment to Unassigned). The seat remains paid and reassignable for the current term.
- For each "expire_end_of_year" user: leave their assignment intact now; mark them to be dropped at renewal
- Schedule the new (lower) seat count to take effect on the renewal date via pending-change fields on the SubscriptionProduct:
  - `pendingLicenseCount` = newSeats
  - `pendingEffectiveDate` = subscription renewal date
  - `pendingUnassignedUserIds` = the list of "expire_end_of_year" user IDs (the "remove_now" users were already unassigned immediately, so they need not be scheduled)
- If these pending fields were already introduced by US-SP09-SB-001 work, REUSE them. Do not create parallel duplicate fields.
- Show a success toast and close the drawer

### Pending-change data model (reuse if present)

```ts
interface SubscriptionProduct {
  // ...existing
  licenseCount: number;            // current paid count (unchanged by a decrease)
  pendingLicenseCount?: number;    // scheduled count effective on renewal
  pendingEffectiveDate?: string;   // renewal date
  pendingUnassignedUserIds?: string[]; // expire-end-of-year users to drop at renewal
}
```

### Activation on renewal date (reuse if present)
- When the renewal date arrives (prototype: app-load check; production: scheduled job), apply pending fields: `licenseCount = pendingLicenseCount`, drop the `pendingUnassignedUserIds` assignments, clear pending fields
- If this activation logic already exists from US-SP09-SB-001, reuse it. Otherwise add it.

...example messages...
- Success toast (decrease): "Seat reduction scheduled. Changes take effect on {renewal date}. Selected users were updated."
- Success toast (immediate unassign portion): integrate into the above; do not double-toast.

---

## Change 5 \u2014 Subscriptions page scheduled-change preview

### File: `src/pages/SubscriptionsPage.tsx`

On each product card that has a `pendingLicenseCount` set, show a small note row below the seat count:

> "Effective {pendingEffectiveDate}: {licenseCount} \u2192 {pendingLicenseCount} seats"

- Use a subtle info-style background with a clock icon prefix
- If `pendingUnassignedUserIds` is non-empty, append: " \u2014 {N} users will be unassigned"
- The note disappears once the renewal date arrives and the change activates

This matches the preview pattern from US-SP09-SB-001. If a preview component already exists for that story, reuse it.

---

## What NOT to touch

- The increase payment flow (Pay Immediately / Pay on Receipt / Pay on Terms) \u2014 preserve exactly
- The redirect-to-/invoices behavior for Pay on Receipt (from v10a)
- The Leimberg branding, dark mode, role system
- DataNet (no seat management; not shown in this drawer)
- The notification system
- shadcn primitives
- The Dashboard (that is v12b)

---

## Acceptance criteria

1. `npm run dev` and `npm run build` complete without errors.
2. The Manage seats drawer shows the redesigned purple summary card with Current seats, New seats, Currently assigned, Seats delta, Price change, and per-seat cost line.
3. The seat editor has \u2212 / input / + / Apply; Apply is disabled until the input differs from current seats.
4. The assigned users list shows "Assigned" / "Unassigned" badges (not Active/Inactive) and a "N of M seats assigned" counter.
5. Increasing seats and clicking Apply updates the summary (positive delta, positive price) and enables Save changes with no overlay; payment follows existing rules.
6. Decreasing seats to or above the assigned count and clicking Apply updates the summary and enables Save changes with no overlay.
7. Decreasing seats below the assigned count and clicking Apply opens the overlay.
8. The overlay header names the exact number of users to remove (assignedCount \u2212 newSeats).
9. Each user row has Remove now and Expire end of year checkboxes that are mutually exclusive per row.
10. The validation counter shows "{selected} of {required} required removals selected", red until matched, green when matched; the overlay background tints accordingly.
11. Confirm is disabled until selected equals required.
12. On Confirm, the overlay closes and Save changes enables.
13. On Save (decrease): current paid seat count is unchanged; "remove now" users are unassigned immediately; "expire end of year" users remain assigned; pendingLicenseCount, pendingEffectiveDate, and pendingUnassignedUserIds are set on the product; no refund is issued.
14. The Subscriptions page shows a scheduled-change preview on the affected product card: "Effective {date}: {current} \u2192 {pending} seats".
15. On the renewal date (app-load check), pending fields activate and clear.
16. No console errors during apply, overlay, confirm, or save.

---

## Manual demo flow

1. Open the Manage seats drawer for a product with 20 seats, 20 assigned.
2. Confirm the summary card layout and the "Assigned" badges.
3. Decrease to 17, click Apply \u2014 the overlay opens: "select the 3 users\u2026"
4. Check 2 users "Expire end of year" and 1 user "Remove now" \u2014 counter reads "3 of 3", turns green, Confirm enables.
5. Confirm \u2014 overlay closes, summary shows \u2193 \u22123 seats and a negative price change, Save changes enables.
6. Save \u2014 toast confirms; drawer closes.
7. On the Subscriptions page, the product card shows "Effective {renewal date}: 20 \u2192 17 seats \u2014 2 users will be unassigned".
8. Reopen the drawer \u2014 the "remove now" user now shows "Unassigned"; assigned count dropped by 1 (the remove-now user); paid seat count is still 20.
9. Separately, increase a product from 20 to 22, Apply \u2014 no overlay; Save routes through the existing payment flow.

---

## Reporting back

At the end of your run, summarize:

1. Files modified.
2. Whether pending-change fields were reused from prior US-SP09-SB-001 work or newly added.
3. Confirmation that a decrease does NOT reduce the current paid seat count and issues no refund.
4. Confirmation that "remove now" unassigns immediately while "expire end of year" defers to renewal.
5. Confirmation that the increase payment flow is unchanged.
6. Whether the renewal-date activation logic was reused or added.
7. Any deviations from this spec.
8. `npm run build` output.

Do not commit. I will review.
