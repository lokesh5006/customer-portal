# Claude Code Prompt v12b — Dashboard Product Seat Badges + Open Manage Seats Drawer

Copy everything below this line into Claude Code in VS Code. Run on the project root AFTER v12a is applied and verified working.

---

## Context

v12a redesigned the Manage seats drawer and added the decrease overlay. v12b surfaces each product\u2019s seat usage on the Dashboard as a "used/available" badge (e.g., "2/10") and makes clicking it open the same Manage seats drawer \u2014 right there on the Dashboard, without navigating to the Subscriptions page.

Before you write any code, read these files in this exact order:

1. `src/pages/DashboardPage.tsx` (or `Dashboard.tsx`) \u2014 current Dashboard layout and any existing product/subscription summary section
2. `src/components/subscriptions/QuoteDialogs.tsx` \u2014 the `ManageLicensesDrawer` (now "Manage seats") from v12a; confirm its props (it should accept a product/subscription reference and open/close state)
3. `src/pages/SubscriptionsPage.tsx` \u2014 how the Subscriptions page currently opens the Manage seats drawer (to mirror the same wiring on the Dashboard)
4. `src/contexts/AppContext.tsx` \u2014 how to read the current company\u2019s active subscriptions and each product\u2019s licenseCount and assignedCount

Do NOT start coding until you have read those files.

---

## Final Decisions (binding for v12b)

| Topic | Decision |
|---|---|
| Dashboard product section | A section listing each product on the customer\u2019s active subscription(s) |
| Seat badge format | "{assigned}/{licenseCount}" e.g., "2/10" \u2014 assigned over total seats |
| Badge click | Opens the same Manage seats drawer (from v12a) for that product, on the Dashboard |
| Drawer reuse | Use the SAME drawer component v12a built. Do NOT create a second copy. |
| Products with no assignable seats (e.g., DataNet) | Excluded from this section (DataNet is auto-included, no seat management) |
| Roles | Visible to all roles that can see the Dashboard; the drawer\u2019s own role gating (AO/Billing Admin to change seats) still applies inside |

---

## Change 1 \u2014 Dashboard product seat section

### File: `src/pages/DashboardPage.tsx`

Add (or extend an existing) section that lists each product on the company\u2019s active subscription(s). For each product, render a row or card with:

- Product name
- A seat usage badge: `{assignedCount}/{licenseCount}` (e.g., "2/10")
- The badge should be visually prominent and clearly tappable (button-styled, with hover state)

Compute `assignedCount` as the number of users currently holding a license for that product, and `licenseCount` as the product\u2019s total seats (the current paid count, not the pending renewal count).

Exclude DataNet (and any other auto-included, non-seat-managed product) from this list.

If the company has no active subscription, show a brief empty state (e.g., "No active products yet") rather than an empty section.

### Badge styling

```tsx
<button
  onClick={() => openManageSeats(subscriptionId, productId)}
  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 hover:bg-muted transition-colors"
  aria-label={`Manage seats for ${productName}, ${assignedCount} of ${licenseCount} assigned`}
>
  <span className="font-medium">{productName}</span>
  <span className="text-sm font-semibold text-primary">{assignedCount}/{licenseCount}</span>
</button>
```

Adjust to match the Dashboard\u2019s existing visual style (if the Dashboard uses cards, render each product as a small card with the badge inside).

If a product has a pending renewal seat change (from v12a), optionally show a tiny clock indicator next to the badge \u2014 but keep the badge itself showing the CURRENT counts, not the pending ones.

---

## Change 2 \u2014 Wire the badge to open the Manage seats drawer

### Reuse the v12a drawer

The Manage seats drawer is already a component with open/close state and a product/subscription reference. On the Dashboard:

1. Add drawer open state to the Dashboard page:
   ```tsx
   const [manageSeatsState, setManageSeatsState] = useState<{ open: boolean; subscriptionId?: string; productId?: string }>({ open: false });
   const openManageSeats = (subscriptionId: string, productId: string) =>
     setManageSeatsState({ open: true, subscriptionId, productId });
   ```
2. Render the SAME `ManageLicensesDrawer` (Manage seats) component at the bottom of the Dashboard page, fed by this state:
   ```tsx
   <ManageLicensesDrawer
     open={manageSeatsState.open}
     onOpenChange={(open) => setManageSeatsState(s => ({ ...s, open }))}
     subscriptionId={manageSeatsState.subscriptionId}
     productId={manageSeatsState.productId}
   />
   ```
3. The drawer\u2019s behavior (summary card, seat editor, decrease overlay, save logic) is entirely inherited from v12a. No behavioral changes here \u2014 only a new place to open it from.

If the drawer\u2019s current props differ from the above, adapt the call to match the actual prop shape. The key requirement: the Dashboard opens the exact same drawer component, not a copy.

### Shared component check

If the drawer is currently tightly coupled to the Subscriptions page (e.g., it reads context that only the Subscriptions page sets up), refactor minimally so it can be opened from the Dashboard too. The drawer should derive everything it needs from the `subscriptionId` + `productId` props plus context \u2014 not from Subscriptions-page-local state.

---

## Change 3 \u2014 After save, refresh the badge

When the drawer saves a change and closes, the Dashboard badge should reflect any immediate change:

- For an increase paid immediately: the licenseCount rises \u2192 badge denominator updates
- For a decrease: the current paid licenseCount does NOT change (per v12a), but if a "remove now" user was unassigned, the assignedCount (numerator) drops \u2192 badge numerator updates
- The pending renewal change does NOT alter the badge\u2019s current numbers (badge shows current term)

Because the drawer writes to context state, the Dashboard badge should update automatically on the next render. Verify this; if the Dashboard caches the counts in local state, ensure it re-reads from context after the drawer closes.

---

## What NOT to touch

- The Manage seats drawer\u2019s internal behavior (built in v12a)
- The decrease overlay logic
- The pending-change data model
- The Subscriptions page Manage seats entry point (it keeps working as-is)
- DataNet
- The notification system, dark mode, role system
- shadcn primitives

---

## Acceptance criteria

1. `npm run dev` and `npm run build` complete without errors.
2. The Dashboard shows a section listing each product on the company\u2019s active subscription(s).
3. Each product shows a seat badge in "{assigned}/{total}" format (e.g., "2/10").
4. DataNet is excluded from this section.
5. Clicking a product\u2019s badge opens the SAME Manage seats drawer used on the Subscriptions page (not a duplicate component).
6. The drawer opened from the Dashboard behaves identically to the one opened from Subscriptions (summary card, seat editor, decrease overlay, save).
7. After an increase paid immediately, the badge denominator reflects the new total.
8. After a decrease with a "remove now" user, the badge numerator drops (current paid total unchanged).
9. A pending renewal decrease does NOT change the badge\u2019s current numbers; optionally a small clock indicator appears.
10. If the company has no active subscription, the section shows a brief empty state.
11. No console errors when opening, editing, or closing the drawer from the Dashboard.

---

## Manual demo flow

1. Log in as a user whose company has active products. Visit the Dashboard.
2. Confirm each product shows a "{assigned}/{total}" badge; DataNet is absent.
3. Click a product badge \u2014 the Manage seats drawer opens on the Dashboard.
4. Increase seats by 2, pay immediately \u2014 drawer closes; the badge denominator increases by 2.
5. Click the badge again, decrease below assigned, complete the overlay with one "remove now" user, save \u2014 the badge numerator drops by 1; the denominator (current paid total) is unchanged.
6. Confirm the Subscriptions page product card shows the scheduled renewal change (from v12a) for the same product.
7. Confirm opening Manage seats from the Subscriptions page still works exactly as before.

---

## Reporting back

At the end of your run, summarize:

1. Files modified.
2. Confirmation that the Dashboard reuses the v12a drawer component (no duplicate).
3. Whether any refactor was needed to decouple the drawer from Subscriptions-page-local state.
4. Confirmation that the badge shows current-term counts (not pending renewal counts).
5. Any deviations from this spec.
6. `npm run build` output.

Do not commit. I will review.
