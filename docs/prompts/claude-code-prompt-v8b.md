# Claude Code Prompt v8b — Table Column Restructure + Search/Sort + Inline DataNet Toggle + Name-as-Link

Copy everything below this line into Claude Code in VS Code. Run on the project root AFTER v8a is verified working.

---

## Context

This is the SECOND of two related batches (v8a was data seeds + Role Demo visibility). v8b restructures the Invoices and Quotes tables, adds search and sort to both, makes the user Name column a link to Edit, drops the View action (Edit only), and adds an inline DataNet Email toggle directly in the Users/Contacts table rows.

Before you write any code, read these files in this exact order:

1. `src/pages/BillingPage.tsx` — current Invoices columns
2. `src/pages/QuotesPage.tsx` — current Quotes columns
3. `src/pages/SubscriptionsPage.tsx` — Invoices tab and Quotes tab inside Overview (need parallel changes)
4. `src/pages/UsersPage.tsx` — current Name cell, action menu, DataNet Email column
5. `src/pages/ContactsPage.tsx` — same pattern
6. `src/components/listing/` (if it exists) — any shared listing primitives like `DataTable`, `ListingPageHeader`, `SearchFilterCard` — check what is reusable

Do NOT start coding until you have read those six files.

---

## Final Decisions (binding)

| Topic | Decision |
|---|---|
| DataNet inline toggle behavior | Optimistic flip on click. Toast confirms with an Undo action. The same toggle stays in the Edit drawer for full edits. |
| Search/sort scope | Both Invoices and Quotes tables (BillingPage, QuotesPage, Subscriptions Invoices tab, Subscriptions Quotes tab). Every column sortable. Free-text search across visible columns. |
| Name-as-link in Users/Contacts | Clicking the Name cell opens the Edit drawer (same as clicking Edit in the 3-dot menu). Action menu drops View — Edit only. |
| Action menu items | Users: Edit, Proxy as User (if permitted), Activate/Deactivate. Contacts: Edit, Delete. No "View" item anywhere. |

---

## Change 1 — Invoices table columns

### 1.1 Apply to BOTH `BillingPage.tsx` AND the Invoices tab in `SubscriptionsPage.tsx`

Replace the existing column structure with EXACTLY this:

| Column | Header | Cell content | Sortable | Notes |
|---|---|---|---|---|
| Invoice ID | `Invoice ID` | `invoice.invoiceNumber` or `invoice.id` | Yes | Mono font (`font-mono text-sm`). For PO-bearing invoices, append `PO #{poNumber}` on a second line in `text-xs text-muted-foreground`. |
| Invoice Created | `Invoice Created` | `invoice.date` formatted `MMM d, yyyy` | Yes | |
| Due Date | `Due Date` | `invoice.dueDate` formatted `MMM d, yyyy` | Yes | If `paidAt` exists and is set, show in muted color (already settled). |
| Total | `Total` | `formatCurrency(invoice.totalAmount)` | Yes | Right-aligned (numeric column). |
| Status | `Status` | Pill badge + inline CTA when applicable. See pills + CTA rules below. | Yes (sorted by status enum order) | |
| Actions | (empty) | 3-dot menu | No | Right-aligned. |

**Dropped columns** (from existing implementation):
- `Description` — was a hybrid label-and-source cell. Information is preserved: source moves into the Invoice detail modal, PO Number moves under Invoice ID.
- `Subscriptions` — redundant when only one Annual Plan exists per company in normal flow.

### 1.2 Status pills + inline CTAs

The Status column shows a pill plus, for actionable statuses, an inline button. This is the explicit exception to the "all actions in 3-dot menu" rule, agreed upon for critical actions:

| Status | Pill style | Inline CTA |
|---|---|---|
| `paid` | green `Paid` | No CTA. Optional second line: `Paid {date}` muted xs. |
| `awaiting_payment` | amber `Awaiting Payment` | `Pay Now` button (size sm, primary, ml-2). Routes to `/pay` with `source: 'invoice'`. |
| `payment_terms_applied` | blue `Net {terms}` (read terms from `companyConfig.terms` or default `Net 30`) | No CTA — terms-based payment is out-of-band. |
| `overdue` | red `Overdue` | `Pay Now` button (size sm, destructive, ml-2). Routes to `/pay`. |
| `upcoming` | grey outline `Upcoming` | `Renew` button (size sm, outline, ml-2). Opens the Renewal drawer for the linked subscription. |

Stack the pill on a first line and the CTA on a second line if horizontal space is tight, or render them inline if the column is wide enough. Both layouts must look clean.

### 1.3 3-dot action menu

After the inline CTA exception is in place, the menu still exists for non-critical actions:

- `View Invoice` — opens the invoice detail modal (existing behavior). Always present.
- `Download PDF` — toast "PDF download coming soon." Always present.
- `Pay` — only shown if `status === 'awaiting_payment' | 'overdue' | 'upcoming'`. Same destination as the inline CTA — this is a redundancy for users who prefer menus.
- `Renew` — only shown if `source === 'renewal'`. Same destination as the inline Renew CTA.

**Remove from the menu**: any `Mark as Paid` item (already removed in earlier prompt; double-check). Any standalone `View` item is fine because invoices have a detail modal worth opening.

---

## Change 2 — Quotes table columns

### 2.1 Apply to BOTH `QuotesPage.tsx` AND the Quotes tab in `SubscriptionsPage.tsx`

Replace existing column structure with EXACTLY this:

| Column | Header | Cell content | Sortable |
|---|---|---|---|
| Quote ID | `Quote ID` | `quote.quoteNumber` or `quote.id` | Yes (`font-mono text-sm`) |
| Products | `Products` | First 2 product names joined by `, `. If more: append `+{N}` (e.g., `NumberCruncher Web, DataNet +1`). | Yes (sort by first product name) |
| Created Date | `Created Date` | `quote.createdDate` formatted `MMM d, yyyy` | Yes |
| Expiry Date | `Expiry Date` | `quote.expiryDate` formatted `MMM d, yyyy`. For quotes <= 3 days from expiry, render the date in amber text with a small `Clock` icon prefix. | Yes |
| Total | `Total` | `formatCurrency(quote.totalAmount)` right-aligned | Yes |
| Status | `Status` | Pill: `Active` blue, `Accepted` green, `Declined` grey, `Expired` amber | Yes |
| Actions | | 3-dot menu | No |

### 2.2 Quote action menu

- `View Quote` — opens a quote detail dialog. Always present.
- `View Note` — only if `quote.note` exists.
- `View Decline Reason` — only if `status === 'declined'` AND `declineReason` is non-empty.
- `Accept Quote` — only if `status === 'active'`. Opens the AcceptQuoteDrawer.
- `Decline Quote` — only if `status === 'active'`.
- `Regenerate` — only if `status === 'declined'`. Routes to `/checkout` with prefill from the quote.
- `Download PDF` — toast "PDF download coming soon."

---

## Change 3 — Search + Sort on Invoices and Quotes

### 3.1 Sort behavior

Every sortable column header is clickable. Clicking cycles through:
- 1st click: ascending sort
- 2nd click: descending sort
- 3rd click: no sort (return to default order)

A small chevron icon next to the header label indicates current sort direction. Use `ChevronsUpDown` (neutral), `ChevronUp` (asc), `ChevronDown` (desc) from lucide. The chevron is visible at all times — neutral when unsorted, directional when sorted.

Only one column can be sorted at a time. Clicking a new column resets any prior sort.

### 3.2 Search behavior

Add a search input above each table (or inside the existing `SearchFilterCard` if present). Placeholder: `Search invoices...` or `Search quotes...`.

Search is case-insensitive substring match across these fields:

**Invoices:**
- `invoiceNumber` / `id`
- `description` (kept in data model even if no longer rendered as a column)
- `poNumber`
- `subscriptionName`
- Any line item product name

**Quotes:**
- `quoteNumber` / `id`
- Any line item product name
- `note`
- `declineReason`

Search and sort compose: if a search term is active, the sort applies to the filtered set.

### 3.3 Implementation notes

- Use shadcn `Input` with the `Search` icon prefix.
- Store sort state as `{ column: string | null, direction: 'asc' | 'desc' | null }`.
- For dates, sort by the underlying ISO string (lexicographic order works for ISO dates).
- For currency, sort by the numeric `totalAmount`, not the formatted string.
- For status, sort by an explicit enum order — e.g., for invoices: `awaiting_payment, overdue, upcoming, payment_terms_applied, paid`. So actionable items sort to the top when ascending.

If a shared `DataTable` component exists with sort/search built in, use it. If not, implement sort/search locally on each page — keep both pages' implementations consistent so a shared component can be extracted later.

### 3.4 Empty state

When search yields no results, the table body shows:
- Centered text "No invoices match your search." or "No quotes match your search."
- A "Clear search" button below

---

## Change 4 — Users & Contacts: Name as link + drop View

### 4.1 Name column becomes clickable

In `UsersPage.tsx` and `ContactsPage.tsx`:

The Name cell currently renders a 3-line stack:
```
Full Name
@username
email@example.com
```

Wrap the entire stack in a button-styled element that opens the Edit drawer for that user/contact:

```tsx
<button
  onClick={() => openEditDrawer(user.id)}
  className="text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
  aria-label={`Edit ${user.firstName} ${user.lastName}`}
>
  <div className="text-sm font-medium text-foreground">{user.firstName} {user.lastName}</div>
  <div className="text-xs text-muted-foreground">@{user.username}</div>
  <div className="text-xs text-muted-foreground">{user.email}</div>
</button>
```

The Full Name in `text-foreground` (the link target). Username and email stay in muted text. Hover shows underline ONLY on the full name (use a nested `<span>` if needed to scope the hover effect to just the top line).

Read-only mode guard: if `readOnly` is true, the click still opens the drawer but in read-only mode (no Save button). The button stays clickable for viewing.

### 4.2 Drop View from action menu

In the 3-dot action menu for users and contacts:

**Users — action menu items:**
- `Edit` — opens drawer in edit mode (read-only mode disables Save, doesn't disable opening)
- `Proxy as User` — only when current user has `users.impersonate` permission AND target is `registered_contact` (License Admin) OR target is anyone (Account Owner). Hidden otherwise.
- `Deactivate` / `Activate` — based on status
- NO `View` item

**Contacts — action menu items:**
- `Edit` — opens drawer
- `Delete` — destructive, with separator above, `text-destructive` styling
- NO `View` item

### 4.3 If the drawer used a "view mode" earlier

The Edit drawer in v7a had three modes: `add`, `edit`, `view`. The `view` mode is now reachable only via two paths:
1. Read-only mode (Pending Payment / Suspended) — Save is hidden, fields display-only
2. (None other)

The button "View" disappearing from the action menu means `view` is never directly invoked as a mode anymore. Simplification: the drawer's mode prop can collapse to `add | edit`. The read-only behavior comes from the `readOnly` flag (already wired). Verify this simplification doesn't break anything.

---

## Change 5 — Inline DataNet Email toggle in row

### 5.1 Replace the badge with a Switch

In Users and Contacts tables, the DataNet Email column currently renders a `Subscribed` / `Unsubscribed` status badge.

Replace with an inline shadcn `Switch`:

```tsx
<div className="flex items-center justify-center">
  <Switch
    checked={user.dataNetEmailOptIn}
    onCheckedChange={(checked) => handleDataNetToggle(user.id, checked)}
    aria-label={`DataNet email ${user.dataNetEmailOptIn ? 'enabled' : 'disabled'} for ${user.firstName}`}
    disabled={readOnly}
  />
</div>
```

### 5.2 Toggle handler with optimistic update + undo

```tsx
const handleDataNetToggle = (userId: string, newValue: boolean) => {
  // Capture old value before mutation
  const oldValue = !newValue;
  // Apply optimistically via existing context method
  updateUser(userId, { dataNetEmailOptIn: newValue });
  // Toast with undo
  toast({
    title: newValue ? 'DataNet email enabled' : 'DataNet email disabled',
    description: `For ${user.firstName} ${user.lastName}.`,
    action: (
      <ToastAction altText="Undo" onClick={() => updateUser(userId, { dataNetEmailOptIn: oldValue })}>
        Undo
      </ToastAction>
    ),
  });
};
```

Where `ToastAction` is the shadcn toast action component. If your existing toast utility doesn't support actions, use the simpler shadcn `toast` API:

```tsx
toast({
  title: newValue ? 'DataNet email enabled' : 'DataNet email disabled',
  description: `For ${user.firstName} ${user.lastName}. Click toggle again to undo.`,
});
```

The optimistic + undo pattern is preferred. Use whichever your toast system supports.

### 5.3 The drawer toggle stays

The Edit drawer's DataNet Email switch (Section E) stays exactly as-is. Both entry points work: row toggle for quick changes, drawer toggle as part of a fuller edit.

When the drawer is open, the row toggle should reflect the same state. The drawer save flow updates `dataNetEmailOptIn` via the same `updateUser` call, so React's state propagation keeps them in sync.

### 5.4 Read-only mode

When `isReadOnlyMode()` returns true, the inline switch is `disabled` with the standard tooltip "Pay your pending invoice to unlock this feature." (or whatever the existing read-only guard tooltip says).

---

## What NOT to touch

- The Leimberg branding, colors, fonts
- The role system, permissions, can() helper
- The User Edit drawer's structure (only its mode/entry point logic changes per Change 4.3)
- The Payment Methods page
- The DataNet page (just the toggle column, which it doesn't have)
- The Renewal drawer logic
- The Auto-renewal generator
- The Suspended state logic
- The seed data introduced in v8a — only its rendering changes
- Any business rules — this is purely UI/interaction polish
- The shadcn UI primitives

---

## Acceptance criteria

When you're done, all of these must be true:

1. `npm run dev` and `npm run build` complete without errors.
2. Invoices tables on BillingPage and the Subscriptions Invoices tab show columns: Invoice ID, Invoice Created, Due Date, Total, Status, Actions — in that order.
3. Each invoice row's Status column shows the appropriate pill plus an inline `Pay Now` (for awaiting/overdue) or `Renew` (for upcoming with source=renewal) button.
4. The inline `Pay Now` button routes to `/pay` with the correct route state. The inline `Renew` button opens the Renewal drawer.
5. PO Number, if present on an invoice, appears as a second line under the Invoice ID column.
6. Quotes tables on QuotesPage and the Subscriptions Quotes tab show columns: Quote ID, Products, Created Date, Expiry Date, Total, Status, Actions — in that order.
7. Quotes' Products column shows up to 2 names joined by `, ` with `+N` suffix when more exist.
8. Quotes' Expiry Date column renders amber + Clock icon for quotes within 3 days of expiry.
9. Every column header on Invoices and Quotes tables is sortable (click cycles asc → desc → none with a directional chevron).
10. A search input above each Invoices and Quotes table filters by the documented fields (case-insensitive substring).
11. Search and sort compose: a filtered set respects the active sort.
12. Empty search shows a "No items match" message with a "Clear search" button.
13. In Users and Contacts tables, the Name column's text is clickable and opens the Edit drawer for that row.
14. The 3-dot action menu in Users and Contacts no longer has a "View" item. Edit is the only entry to the drawer in normal use.
15. The DataNet Email column in Users and Contacts is now an inline `Switch` instead of a badge. Toggling fires `updateUser` immediately and shows a toast (optimally with Undo).
16. The DataNet Email switch in the Edit drawer remains and stays in sync with the row switch.
17. The inline switch is disabled in read-only mode with the standard tooltip.
18. Sorting by Total uses numeric comparison (not string), so `$1,234.00` sorts after `$200.00` (correct numeric order, not lexicographic).
19. Sorting by Status uses an enum order: actionable statuses first when ascending, settled statuses last.
20. No console errors during any sort, search, toggle, or drawer-open operation.

---

## Manual demo flow to verify

1. Log in as `john.smith@abcaccounting.com`. Visit Invoices.
2. Confirm column order matches the spec. The awaiting-payment invoice shows a Pay Now button inline.
3. Click Pay Now → routes to /pay with invoice details.
4. Back to Invoices. Click the Total column header → sorts ascending by amount. Click again → descending. Click again → unsorted.
5. Type "PO" in the search → filters to invoices with PO numbers.
6. Clear search. Visit Quotes.
7. Confirm the columns. Click on the expiring-soon quote (2 days). Expiry Date is amber with a Clock icon.
8. Click the Created Date header → sorts. Type "QuickView" in search → filters to quotes with QuickView Desktop.
9. Visit Users & Contacts. Click on any user's name (the full name link). The Edit drawer opens.
10. Open the 3-dot menu on the same row. No "View" item — only Edit, Proxy as User (where allowed), Deactivate.
11. Click the DataNet Email switch in a row. Toggle flips. Toast confirms with Undo (or with "Click toggle again to undo" depending on toast support).
12. Open the same user's Edit drawer. The DataNet Email switch in Section E reflects the new state.

---

## Reporting back

At the end of your run, summarize:

1. Every file modified and every file created.
2. Whether sort/search was implemented locally per page or as a shared component. If local, note that as future-cleanup work.
3. Confirmation that the action menu in Users/Contacts no longer contains a "View" item anywhere.
4. Confirmation that the drawer mode simplified from add/edit/view to add/edit (read-only behavior via `readOnly` flag).
5. Whether the toast Undo action was implemented or fell back to the simpler "click again to undo" hint.
6. Any deviations from this spec.
7. The output of `npm run build`.

Do not commit. I will review.
