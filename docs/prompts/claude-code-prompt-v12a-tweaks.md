# Claude Code Prompt v12a-tweaks — Manage Seats: Interactive Toggles + Overlay-on-Save + Renewal Messaging

Copy everything below this line into Claude Code in VS Code. Run on the project root.

This is a follow-up to v12a (already applied). It refines three behaviors in the Manage seats drawer. Do NOT rebuild the drawer \u2014 only adjust the three things below.

---

## Context

v12a built the redesigned Manage seats drawer with the purple summary card, seat editor, the Assigned users list, and the decrease-below-assigned overlay. This tweak batch changes:

1. The Assigned/Unassigned badges become interactive toggle buttons (inline quick assign/unassign).
2. The removal overlay triggers on Save changes (not on Apply), and only when the assigned count still exceeds the new seat count.
3. Add explicit "takes effect at renewal" messaging inside the overlay (the Subscriptions page preview from v12a stays).

Before you write any code, read these files in this exact order:

1. `src/components/subscriptions/QuoteDialogs.tsx` \u2014 the `ManageLicensesDrawer` (Manage seats) as built in v12a: the Apply handler, the overlay trigger, the Assigned users list, the Save changes handler
2. `src/contexts/AppContext.tsx` \u2014 the license assignment model: how a user is assigned/unassigned to a product, the helper that lists assigned users, and the pending-change fields from v12a (`pendingLicenseCount`, `pendingEffectiveDate`, `pendingUnassignedUserIds`)

Do NOT start coding until you have read those files and confirmed how v12a currently wires the Apply\u2192overlay trigger.

---

## Tweak 1 \u2014 Interactive Assigned / Unassigned toggle buttons

### Current state (from v12a)
The Assigned users list shows each user with a static "Assigned" or "Unassigned" badge.

### New behavior
Make each badge a clickable toggle BUTTON that immediately assigns or unassigns that user\u2019s license for this product.

- Clicking an "Assigned" badge \u2192 unassigns the user immediately (badge flips to "Unassigned")
- Clicking an "Unassigned" badge \u2192 assigns the user immediately (badge flips to "Assigned"), provided there is seat capacity
- The "{assignedCount} of {newSeats} seats assigned" counter updates live as toggles change
- Assigning is blocked when assignedCount already equals the available seat capacity for the current term; show a small inline message or disabled state ("No seats available")

### Styling
Render the badge as a button with clear affordance:

```tsx
<button
  onClick={() => toggleAssignment(user.id)}
  disabled={!canToggle}
  className={cn(
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
    isAssigned
      ? 'bg-success/10 text-success hover:bg-success/20'
      : 'bg-muted text-muted-foreground hover:bg-muted/70'
  )}
  aria-label={isAssigned ? `Unassign ${user.firstName}` : `Assign ${user.firstName}`}
>
  <span className={cn('h-1.5 w-1.5 rounded-full', isAssigned ? 'bg-success' : 'bg-muted-foreground')} />
  {isAssigned ? 'Assigned' : 'Unassigned'}
</button>
```

### Important semantics
Inline-unassigning a user is an IMMEDIATE action \u2014 equivalent to the overlay\u2019s "Remove now." It takes effect right away (the user loses their license for this product). It does NOT defer to renewal. The only way to defer a drop to renewal is via the overlay\u2019s "Expire end of year" option (Tweak 2).

These inline toggles operate on the CURRENT term assignment state. They do not change the paid seat count and do not issue refunds (consistent with v12a\u2019s seat/money model).

---

## Tweak 2 \u2014 Move the overlay trigger from Apply to Save changes

### Current state (from v12a)
Clicking Apply, when the new count is below the assigned count, opens the removal overlay immediately.

### New behavior
- **Apply** only recalculates the summary card (Current/New/Currently assigned, Seats delta, Price change) and ENABLES the Save changes button. Apply does NOT open the overlay.
- **Save changes** is where the overlay logic runs:
  1. On Save changes click, compute whether the current assigned count still EXCEEDS the new seat count.
  2. If assigned count <= new seat count (the admin already unassigned enough via inline toggles, OR it\u2019s an increase, OR no over-allocation exists) \u2192 commit the save directly (no overlay).
  3. If assigned count > new seat count \u2192 open the removal overlay to resolve ONLY the remaining over-allocation.

### Overlay reduction count
The overlay\u2019s required-removals count is now dynamic:

```
requiredRemovals = currentAssignedCount \u2212 newSeats
```

computed at the moment Save changes is clicked \u2014 AFTER any inline unassignments the admin already did. So if the admin manually unassigned 1 of the 3 they needed to drop, the overlay opens asking for only 2.

The overlay lists only users who are STILL assigned at Save time. Users already inline-unassigned are not in the overlay (they\u2019re already handled as immediate removals).

### Overlay Confirm
On Confirm, the same v12a logic applies:
- "Remove now" selections \u2192 unassign immediately
- "Expire end of year" selections \u2192 keep assigned now, scheduled to drop at renewal via `pendingUnassignedUserIds`
- Then the save commits: pending fields set (`pendingLicenseCount`, `pendingEffectiveDate`, `pendingUnassignedUserIds`), current paid seat count unchanged, no refund

### Save changes enablement
Save changes is enabled whenever there is a pending change (the input was applied and differs from current). It no longer requires the overlay to have been pre-confirmed \u2014 because the overlay now appears AS PART OF the save action when needed.

---

## Tweak 3 \u2014 Explicit renewal-effect messaging in the overlay

### Current state (from v12a)
The overlay header reads: "The licenses you have paid for will last through the year. Please select the {N} users you would like to remove now or at the end of the year."

The Subscriptions page shows a preview row.

### New behavior
Add an explicit, prominent line inside the overlay (below the header text, above the table) stating the renewal effective date:

> "The reduced seat count takes effect on your renewal date: {renewalDate}."

- Format `{renewalDate}` as `MMM d, yyyy` (e.g., "Mar 15, 2027")
- Style it to stand out: bold or in the primary color, with a small calendar/clock icon prefix
- Keep the existing overlay header text as well

The Subscriptions page preview row from v12a stays exactly as built \u2014 no change there.

---

## What NOT to touch

- The purple summary card layout
- The seat editor (\u2212 / input / + / Apply) other than Apply no longer opening the overlay
- The seat/money model: no refund, current paid term unchanged, reduction scheduled for renewal
- The pending-change data model and the renewal-date activation logic
- The Subscriptions page preview row
- The increase payment flow (Pay Immediately / Pay on Receipt / Pay on Terms)
- DataNet, dark mode, role system, notifications
- shadcn primitives

---

## Acceptance criteria

1. `npm run dev` and `npm run build` complete without errors.
2. Each user in the Assigned users list shows a clickable Assigned/Unassigned toggle button.
3. Clicking an Assigned badge immediately unassigns the user (badge flips, counter decrements).
4. Clicking an Unassigned badge immediately assigns the user if seat capacity allows; blocked with a message when at capacity.
5. The "N of M seats assigned" counter updates live as badges are toggled.
6. Clicking Apply recalculates the summary and enables Save changes WITHOUT opening the overlay.
7. Clicking Save changes when assigned count <= new seat count commits directly with no overlay.
8. Clicking Save changes when assigned count > new seat count opens the overlay.
9. The overlay\u2019s required-removal count equals (current assigned count \u2212 new seats) computed at Save time, reflecting any prior inline unassignments.
10. The overlay lists only users still assigned at Save time.
11. The overlay shows the explicit line "The reduced seat count takes effect on your renewal date: {date}".
12. Overlay Confirm applies Remove now (immediate) and Expire end of year (renewal) correctly, then commits the save.
13. Inline-unassigning a user behaves as an immediate removal (equivalent to Remove now), not a renewal-deferred drop.
14. Current paid seat count is unchanged by any decrease or inline unassignment; no refund.
15. The Subscriptions page preview row still appears for scheduled reductions.
16. No console errors during toggle, apply, save, or overlay interactions.

---

## Manual demo flow

1. Open Manage seats for a product with 20 seats, 20 assigned.
2. Click one user\u2019s "Assigned" badge \u2192 it flips to "Unassigned" immediately; counter shows "19 of 20 seats assigned."
3. Set the input to 17, click Apply \u2192 summary shows \u2193 \u22123 seats; Save changes enables; NO overlay yet.
4. Click Save changes \u2192 because 19 assigned > 17 new seats, the overlay opens asking for 2 removals (not 3 \u2014 one was already inline-unassigned).
5. Confirm the overlay shows the line "The reduced seat count takes effect on your renewal date: {date}."
6. Select 1 user "Remove now" and 1 user "Expire end of year" \u2192 counter "2 of 2", green, Confirm enables.
7. Confirm \u2192 save commits; toast shows; drawer closes.
8. Reopen the drawer \u2192 the two "remove now"-style users (the inline one + the overlay one) show Unassigned; paid seat count still 20; the "expire end of year" user still Assigned.
9. Subscriptions page shows the scheduled "Effective {renewal date}: 20 \u2192 17 seats" preview.
10. Separately, set a product to a count >= assigned and Save \u2192 commits directly, no overlay.

---

## Reporting back

At the end of your run, summarize:

1. Files modified.
2. Confirmation that the overlay now triggers on Save changes, not Apply.
3. Confirmation that inline toggle = immediate (Remove now equivalent) and that the overlay\u2019s required count recomputes after inline unassignments.
4. Confirmation that the renewal-effect line appears in the overlay.
5. Confirmation that current paid seat count and no-refund behavior are unchanged.
6. Any deviations from this spec.
7. `npm run build` output.

Do not commit. I will review.
