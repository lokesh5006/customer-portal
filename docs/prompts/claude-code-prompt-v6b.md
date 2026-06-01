# Claude Code Prompt v6b — DataNet Page + Subscriptions Polish + UI Production-Ready Pass

Copy everything below this line into Claude Code in VS Code. Run it on the project root AFTER v6a has been applied and verified working.

---

## Context

This is the SECOND of two related batches. Run this AFTER v6a is verified working.

This batch focuses on UI polish and a new page:

7. New DataNet page (with sidebar and dashboard tile linking to it)
8. Subscriptions page: DataNet product tile gets a "no manage" treatment with helper text
9. Action column uniformity across every data table (re-audit)
10. Production-ready UI pass: header, menus, page titles, spacing, alignment

Before you write any code, read these files in this exact order:

1. `src/App.tsx` — routing
2. `src/components/layout/MainLayout.tsx` — fixed-header structure
3. `src/components/layout/Header.tsx`
4. `src/components/layout/Sidebar.tsx`
5. `src/components/layout/PageHeader.tsx` (created in earlier prompt)
6. `src/pages/SubscriptionsPage.tsx` — for the DataNet tile change
7. `src/pages/DownloadsPage.tsx` — for the DataNet "Open" wiring
8. `src/pages/Dashboard.tsx` — for the DataNet tile wiring
9. `src/contexts/AppContext.tsx` — for adding DataNet seed data
10. All `src/pages/*.tsx` — quick scan to find every data table (Change 9)

Do NOT start coding until you have read those files.

---

## Change 7 — DataNet page

### Goal

A new page at `/datanet` that lists monthly DataNet updates (Year, Month, View action). The Downloads page's DataNet "Open" button and the Dashboard's DataNet tile both route here.

### Route

Add `/datanet` to `src/App.tsx`. Import `DataNetPage`. Wrap in `MainLayout`.

### Sidebar

The sidebar already has a "DataNet" item from an earlier prompt — verify its `path` points to `/datanet`. If it points to anything else (or its onClick uses `window.open`), fix it to `path: '/datanet'`. Roles: all (any authenticated user can see DataNet updates, since DataNet is "for everyone in the company who has access").

Add `'/datanet': []` (empty array = all roles) to `MainLayout.tsx`'s `pageAccess` map.

### Data model

In `src/contexts/AppContext.tsx`, add:

```ts
export interface DataNetUpdate {
  id: string;
  year: number;
  month: number;            // 1-12
  monthName: string;        // 'April'
  title: string;            // 'Q1 Tax Outlook Update'
  summary: string;          // 1-2 sentences for the modal
  body: string;             // Multi-paragraph placeholder content for the modal
  publishedAt: string;      // ISO date
}
```

Add to `AppState`:
```ts
dataNetUpdates: DataNetUpdate[];
```

Seed 9 entries spanning August 2025 through April 2026, newest first:

| ID | Year | Month | monthName | Title (sample, free to use realistic accounting-industry topics) |
|---|---|---|---|---|
| dn-2026-04 | 2026 | 4 | April | Spring filing season recap |
| dn-2026-03 | 2026 | 3 | March | March compliance bulletin |
| dn-2026-02 | 2026 | 2 | February | Tax season mid-point review |
| dn-2026-01 | 2026 | 1 | January | New year regulatory roundup |
| dn-2025-12 | 2025 | 12 | December | Year-end planning checklist |
| dn-2025-11 | 2025 | 11 | November | November regulatory update |
| dn-2025-10 | 2025 | 10 | October | Q3 industry outlook |
| dn-2025-09 | 2025 | 9 | September | September compliance brief |
| dn-2025-08 | 2025 | 8 | August | Summer planning advisory |

Use generic accounting-industry titles. The `summary` and `body` can be placeholder paragraphs you write — 2-3 short paragraphs of typical industry-update prose. Keep it neutral and professional.

Add a context selector:
```ts
getDataNetUpdates: () => DataNetUpdate[];
```
Returns the list sorted by year desc, month desc.

### New page: `src/pages/DataNetPage.tsx`

Wrap in `MainLayout`. Use `PageHeader`.

**Header:**
- Title: `"DataNet"`
- Description: `"Monthly industry data updates and alerts."`

**Body (inside a Card with `p-6`):**

1. **Filter row** — search input on the left (filter by year or month text), reserved space on the right (no filter button for now — keep alignment).

2. **Subscription gating** — Check whether the current company has DataNet in any active subscription:
   ```ts
   const subs = getCompanySubscriptions();
   const hasDataNet = subs.some(
     s => s.status === 'active' && s.products.some(p => p.name === 'DataNet')
   );
   ```

   - If `hasDataNet === false`: render an empty state inside the card body with the `Database` icon, heading "DataNet is not included in your subscription", subtext "DataNet provides monthly industry data and alerts. Subscribe to unlock access.", and a primary button "Subscribe to DataNet" that navigates to `/checkout` (with DataNet auto-checked — pass route state `{ prefillProduct: 'DataNet' }` and have CheckoutPage honor it).
   - If `hasDataNet === true`: render the table.

3. **Table** (when subscribed):

   | Column | Source | Notes |
   |---|---|---|
   | Year | `update.year` | text-sm |
   | Month | `update.monthName` | text-sm |
   | Actions | "View" link with `ExternalLink` icon | Opens a modal |

   Right-aligned Actions column. Sort by year desc, month desc by default.

   Apply the standard table styling used elsewhere — same header cell pattern (`text-xs font-medium text-muted-foreground uppercase tracking-wide`).

   Add pagination if more than 12 rows (use the existing `PaginationControls` component in `src/components/listing/`).

4. **View modal:**
   - On clicking View, open a Dialog
   - Title: `"DataNet — {monthName} {year}"`
   - Subtitle: `update.title` (text-sm text-muted-foreground)
   - Body: `update.body` rendered as paragraphs (split on `\n\n` and render each in a `<p className="text-sm leading-relaxed">`)
   - Footer: a single "Close" button

### Wire entry points

**Downloads page DataNet card "Open" button:**

In `src/pages/DownloadsPage.tsx`, find the DataNet product card. Its current "Open" button uses `window.open('#', '_blank')`. Replace with:

```tsx
<Button size="sm" variant="outline" onClick={() => navigate('/datanet')}>
  <ExternalLink className="h-3 w-3 mr-1" />Open
</Button>
```

Apply to BOTH the subscribed state (full opacity, enabled button) and the unsubscribed state (the unsubscribed "Open" button should be disabled — keep it that way; only the "More Info" button is enabled and now also routes to `/datanet` since that's the marketing landing for DataNet).

**Dashboard DataNet tile:**

In `src/pages/Dashboard.tsx`, find the DataNet card. It currently uses `window.open('#', '_blank')`. Replace the click handler with `navigate('/datanet')`. Remove the underlying `<a href="#">` if it's there.

### Prefill DataNet on Checkout

In `src/pages/CheckoutPage.tsx`, in the existing prefill `useEffect`, also honor `location.state?.prefillProduct`:

```ts
const prefillProductName = location.state?.prefillProduct;
useEffect(() => {
  if (prefillProductName) {
    setLines(prev => prev.map(l =>
      l.productName === prefillProductName ? { ...l, selected: true } : l
    ));
  }
}, []);
```

This way, "Subscribe to DataNet" from DataNetPage lands on Checkout with DataNet pre-checked.

---

## Change 8 — Subscriptions page: DataNet product tile

### Goal

The DataNet product tile in the "Products in this subscription" card on `/subscriptions` should NOT have a "Manage Licenses" button. Instead, show helper text explaining that DataNet is included for everyone.

### File: `src/pages/SubscriptionsPage.tsx`

In the Products card's tile-rendering loop, conditional on the product name:

```tsx
{product.name === 'DataNet' ? (
  <div className="mt-3 rounded-md bg-muted/40 border border-dashed p-3">
    <p className="text-xs text-muted-foreground leading-relaxed">
      All active users in your company automatically receive DataNet updates.
      Manage individual delivery preferences from <button onClick={() => navigate('/users')} className="text-primary hover:underline">Users &amp; Contacts</button>.
    </p>
  </div>
) : (
  <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => openManageLicenses(product)}>
    Manage Licenses
  </Button>
)}
```

Also for DataNet, replace the SEATS/AVAILABLE pair with a single label: "ACCESS — All active users" instead of the seat counts. This signals that DataNet has no seat-based gating.

Concretely, in the tile's two-column SEATS/AVAILABLE row, conditional on the product:

```tsx
{product.name === 'DataNet' ? (
  <div>
    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Access</div>
    <div className="text-sm font-semibold">All active users</div>
  </div>
) : (
  // existing SEATS X/Y and AVAILABLE Z two-column layout
  ...
)}
```

The Active green dot + "Active" label stays. The product icon stays. Just the body of the tile changes.

---

## Change 9 — Action column uniformity (re-audit)

### Goal

Every data table in the system uses the SAME 3-dot dropdown pattern for row actions. No exceptions. No inline action buttons hiding in any table.

### Audit list

Walk these files and verify each table's action column matches the pattern. Fix any that don't.

| File | Tables to check |
|---|---|
| `src/pages/UsersPage.tsx` | Users table |
| `src/pages/ContactsPage.tsx` | Contacts table |
| `src/pages/BillingPage.tsx` | Invoices table |
| `src/pages/QuotesPage.tsx` | Quotes table |
| `src/pages/SubscriptionsPage.tsx` | Invoices tab table, Quotes tab table |
| `src/pages/SupportPage.tsx` | Tickets table |
| `src/pages/AdminPage.tsx` | Company config table (if any) |
| `src/pages/DataNetPage.tsx` (new in Change 7) | DataNet updates table — single "View" action |
| `src/pages/PaymentMethodsPage.tsx` (from v6a) | Cards and Bank Accounts lists |

### Pattern (re-iterated for emphasis)

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open menu">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-48">
    <DropdownMenuItem onClick={() => doThing()}>
      <Icon className="h-4 w-4 mr-2" /> Action Name
    </DropdownMenuItem>
    {/* group separator before destructive */}
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => doDestructive()} className="text-destructive focus:text-destructive">
      <Trash2 className="h-4 w-4 mr-2" /> Destructive Action
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Rules:**
- Trigger is always `MoreVertical` icon in a ghost button, `h-8 w-8`
- Menu content `align="end"` so it opens left-aligned to the trigger
- Each item has a 4×4 icon on the left
- Destructive items (`Remove`, `Delete`, `Deactivate`) use `text-destructive focus:text-destructive`
- Separators above destructive items
- Disabled items: use `disabled` prop with reason in `aria-label`
- The DataNet table's single "View" action: still use the 3-dot dropdown for consistency, even though there's only one action. Uniformity wins.

### Exceptions explicitly allowed

- The Renewal Options card on Subscriptions (the radio rows for payment methods) is NOT a data table — it's a form control. Keep it as radio rows, not 3-dot menus.
- The product tiles on Subscriptions are not table rows — keep their "Manage Licenses" button as is (DataNet tile excepted per Change 8).
- The notification bell, avatar menu — keep as is.

If you find any table with inline buttons (View / Edit / Delete in separate buttons), replace them with a single 3-dot dropdown. Report each one you fixed in the summary.

---

## Change 10 — Production-ready UI pass

### Goal

The header, menus, page titles, and overall layout should feel polished and production-ready. Tighten spacing, alignment, hover states, and consistency across the system.

### A. Top header (`src/components/layout/Header.tsx`)

Verify and apply:

- Height: exactly `h-16` (64px)
- Background: `bg-background`
- Border-bottom: `border-b border-border`
- Position: `sticky top-0 z-30`
- Horizontal padding: `px-6`
- Flex: `flex items-center justify-between`
- Left side: logo image, `h-7` (28px tall), maintained aspect ratio
- Right side: bell button + avatar dropdown, `gap-2` between them
- Bell button: `<Button variant="ghost" size="icon" className="h-9 w-9 relative">` with `Bell` icon `h-4 w-4`. The unread red dot uses `absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border-2 border-background`
- Avatar dropdown trigger: `<Button variant="ghost" className="h-9 px-2 gap-2">` with circular avatar (h-7 w-7 rounded-full bg-muted), then user name (`text-sm font-medium hidden md:inline`), then `ChevronDown` icon (`h-4 w-4 text-muted-foreground`)

In demo mode (`?demo=1`):
- The Role Demo cluster sits before the bell, with `gap-2` separators
- Apply same `h-9` height to keep alignment

### B. Sidebar (`src/components/layout/Sidebar.tsx`)

Verify and apply:

- Width: `w-64` (256px) on desktop; collapsible/drawer pattern on mobile is out of scope for this prompt (leave as is)
- Background: `bg-background` (lighter than main content's muted background — provides contrast)
- Border-right: `border-r border-border`
- Position: `sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto` so it scrolls independently of the main content
- Vertical layout: flex column
- Top padding: `pt-4`
- Each nav item: `px-3 py-2 rounded-md mx-3 mb-1`, `text-sm font-medium`, icon `h-4 w-4 mr-3`
- Default state: `text-foreground hover:bg-muted`
- Active state: `bg-primary/10 text-primary` (subtle, not the heavy fill)
- Bottom of sidebar: `Sign Out` button styled the same as nav items but with `Logout` icon, separated by a `mt-auto pt-4 border-t mx-3` divider

### C. PageHeader (`src/components/layout/PageHeader.tsx`)

Verify and apply:

- Position: `sticky top-16 z-20`
- Background: `bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80` (subtle frosted glass effect under header)
- Border-bottom: `border-b border-border`
- Padding: `px-6 py-4`
- Layout: `flex items-start justify-between gap-4`
- Title: `text-2xl font-semibold tracking-tight text-foreground`
- Description: `text-sm text-muted-foreground mt-1` (slight gap)
- Actions slot on the right: `flex items-center gap-2`

### D. Page body wrapper

All authenticated pages should have a consistent body wrapper after PageHeader:

```tsx
<div className="px-6 py-6 space-y-6">
  {/* page content */}
</div>
```

Audit every page in `src/pages/` (other than Welcome, Login, Signup which are full-screen). Apply this wrapper consistently. Remove any duplicate `<div className="container mx-auto py-6">` or similar that conflict.

### E. Card consistency

Across all pages, cards should use:
- `rounded-lg` corners
- `border-border` border
- `shadow-sm` (subtle elevation; only the hero card on Subscriptions uses the gradient + heavier styling)
- Internal padding: `p-6` for full cards, `p-4` for nested sub-cards (like product tiles)
- Title row: `pb-4` separator before the body
- Title text: `text-base font-semibold` (consistent)

### F. Spacing tokens (vertical rhythm)

Standardize gaps:
- Between major page sections: `space-y-6`
- Within a card: `space-y-4`
- Within a tight group (label + value pairs): `space-y-1`
- Between form fields: `space-y-4`
- Two-column form rows: `grid grid-cols-2 gap-4`

### G. Focus rings and transitions

- All interactive elements (buttons, inputs, links, menu triggers) should have a visible focus ring: shadcn defaults are fine (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`)
- Hover transitions: keep them — `transition-colors` on buttons and nav items

### H. Misc cleanup

While auditing, fix:

- Any `<button>` without proper accessibility (add `aria-label` where it's icon-only)
- Any text that still says "NumberCruncher" as the portal name (should be "Leimberg"). Product names stay.
- Any leftover `console.log` calls in modified files
- Any duplicate or conflicting Tailwind classes (e.g., `text-sm text-base` together)
- Inconsistent date formats — standardize on `MMM d, yyyy` (e.g., "Apr 15, 2026") using date-fns `format` across all tables and metadata

### I. Page-specific polish targets

For each of these pages, verify the title and description are correct and uses `PageHeader`:

| Path | Title | Description |
|---|---|---|
| `/dashboard` | `Dashboard` | `Welcome back, {firstName}.` |
| `/subscriptions` | `Subscriptions` | `Manage your active products, renewal options, invoices, and billing details.` |
| `/users` | `Users & Contacts` | `Manage users and contacts for your company.` |
| `/downloads` | `Product Downloads & Links` | `Access software, documentation, guides, and learning materials.` |
| `/invoices` | `Invoices` | `View and pay invoices for your subscription.` |
| `/quotes` | `Quotes` | `Review, accept, or decline quotes for new subscriptions and changes.` |
| `/datanet` | `DataNet` | `Monthly industry data updates and alerts.` |
| `/support` | `Support` | `Open tickets, view history, and find answers.` |
| `/news` | `News` | `Latest announcements and product updates.` |
| `/payment-methods` | `Payment Methods` | `Manage saved cards and bank accounts.` |
| `/admin` | `Admin Tool` | `Configure customer billing eligibility and run admin actions.` |
| `/checkout` | `Checkout` | `Select products to start your subscription.` |
| `/pay` | `Payment & Billing` | `Confirm your payment method and billing address to complete the order.` |

If any page is missing the PageHeader or has a different title than the table above, fix it.

---

## What NOT to touch

- Leimberg branding tokens (logo, primary color, font family)
- The first-time customer gate logic
- The `?demo=1` query-param gate
- The new payment page logic (other than the saved-methods wiring from v6a)
- The new renewal drawer logic (v6a)
- The shadcn UI primitives in `src/components/ui/*`
- The seed users, companies, subscriptions, invoices, quotes, tickets (just adding new collections like `dataNetUpdates` and `savedPaymentMethods` from v6a)
- The existing PageHeader signature — only styling adjustments

---

## Acceptance criteria

1. `npm run dev` runs without errors. `npm run build` completes without errors.
2. A new "DataNet" sidebar item appears (already from earlier prompt) and routes to `/datanet`.
3. The DataNet page renders with title "DataNet", description "Monthly industry data updates and alerts.", a search input, and a table of monthly updates sorted newest first.
4. Clicking "View" on any row opens a modal with the update's title, summary, and multi-paragraph body. Modal closes cleanly.
5. For companies without DataNet in their active subscription, the DataNet page shows an empty state with a "Subscribe to DataNet" CTA that routes to `/checkout` with DataNet pre-checked.
6. Clicking "Subscribe to DataNet" from the empty state and arriving at `/checkout` shows DataNet already checked.
7. On `/downloads`, the DataNet card's "Open" button (when subscribed) navigates to `/datanet`. The "More Info" button (when not subscribed) also navigates to `/datanet`.
8. On `/dashboard`, the DataNet tile navigates to `/datanet`.
9. On `/subscriptions` Products card, the DataNet product tile has NO "Manage Licenses" button. Instead it shows the dashed-border helper text about all users receiving updates, with a clickable link to `/users`.
10. The DataNet tile's body shows "ACCESS — All active users" instead of SEATS/AVAILABLE.
11. Every data table in the system uses the same 3-dot dropdown action pattern (Users, Contacts, Invoices, Quotes, Subscriptions tabs, Support tickets, Admin, DataNet, Payment Methods). No inline action buttons remain.
12. The top header is exactly `h-16`, sticky at top, has the logo on the left, bell + avatar on the right (plus demo cluster when `?demo=1`). It does not scroll out of view.
13. The PageHeader bar sits at `top-16`, is sticky, has a subtle frosted background, and stays visible when the body scrolls.
14. The Sidebar is `w-64`, sticky from top-16, scrolls independently if its content overflows. Active item uses subtle `bg-primary/10 text-primary` styling.
15. Every authenticated page wraps its body in `<div className="px-6 py-6 space-y-6">` consistently. No conflicting container classes.
16. Every page's title and description matches the table in section I above.
17. Date format `MMM d, yyyy` is used consistently in every data table.
18. No `"NumberCruncher"` text remains as the portal name (product names like "NumberCruncher Desktop" remain).
19. No `console.log` calls in any modified file.
20. No console errors on any navigation.

---

## Manual demo flow

1. Log in as any seeded user → sidebar visible → click "DataNet" → land on `/datanet` with monthly updates table.
2. Click "View" on the April 2026 row → modal opens with title, summary, body. Close.
3. Use a fresh signup user who has no DataNet subscription → click "DataNet" in sidebar → see the empty state with "Subscribe to DataNet" button → click → land on `/checkout` with DataNet pre-checked.
4. Navigate to `/dashboard` → click DataNet tile → land on `/datanet`.
5. Navigate to `/downloads` → click "Open" on DataNet card → land on `/datanet`.
6. Navigate to `/subscriptions` → look at the DataNet product tile in the Products card → no "Manage Licenses" button, helper text visible with link to `/users`.
7. Scroll any page → top header stays, page title bar stays, sidebar stays, body scrolls.
8. Open the action menu (3-dot) on rows in: Users, Contacts, Invoices, Quotes, Subscriptions Invoices tab, Subscriptions Quotes tab, Support, DataNet, Payment Methods. Each opens with the standard menu items.
9. Tab through interactive elements with keyboard → focus rings visible on each.
10. Verify dates everywhere render as "Apr 15, 2026" style.

---

## Reporting back

At the end of your run, summarize:

1. Every file modified and every file created.
2. A list of every table you audited and any inline-action buttons you converted to 3-dot dropdowns (file + row description).
3. Confirmation that the DataNet page handles both the subscribed and unsubscribed states.
4. Confirmation that `/dashboard`, `/downloads`, and the sidebar DataNet item all route to `/datanet` (no more `window.open('#')` dead clicks).
5. Confirmation that the DataNet tile on Subscriptions page has no Manage Licenses button.
6. The list of pages whose `PageHeader` you added or corrected.
7. Any deviations from this spec.
8. `npm run build` output.

Do not commit. I will review.
