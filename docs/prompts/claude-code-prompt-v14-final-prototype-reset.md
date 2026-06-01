# Claude Code Prompt v14 — Final Prototype Reset

Copy everything below this line into Claude Code in VS Code. Run on the project root (`cusotmerportal2`).

**This is a single focused reset prompt** implementing every decision from the pre-reset audit (`Customer_Portal_Pre_Reset_Audit.docx`). The portal is going to be demoed to a mixed business/technical audience. The reset is needed because 13 iterations of feature-additions accumulated friction. After this prompt runs, there will be ONE atomic commit, then a guided walkthrough, then small surgical fix prompts only.

**Do NOT commit at the end of this run.** I will review the build, walk through the portal, then issue the commit command.

**Approach to large scope:** This prompt is sectioned. Work through sections in order. After EACH section, run `npm run build` to verify the section landed cleanly. If a section breaks the build, fix it before moving on. Do not advance to the next section until the current one builds clean.

---

## Foundational locks (apply globally)

| # | Lock |
|---|---|
| 1 | Light mode is the DEFAULT. Dark toggle stays in profile settings, preference persists. |
| 2 | Login screen first (standard B2B). Demo-login button on the login screen for fast access. |
| 3 | ABC Accounting is the primary demo company. |
| 4 | Demo Role switcher stays in header but smaller / less prominent. |

---

## Required pre-reading (do this first, before any code changes)

Before writing any code, read these files to anchor on current state:

1. `src/contexts/AppContext.tsx` — full file. Pay particular attention to `initialSubscriptions`, `initialLicenses`, `initialInvoices`, `initialQuotes`, `requestLicenseChange`, `reactivateLicense`, and the proration helpers.
2. `src/contexts/ThemeProvider.tsx` (or wherever theme defaults are set) — find where the default theme is determined.
3. `src/pages/Dashboard.tsx` — full file.
4. `src/pages/SubscriptionsPage.tsx` — full file. Note the KPI tile section.
5. `src/components/subscriptions/QuoteDialogs.tsx` (or wherever `ManageLicensesDrawer` lives) — full file. This drawer needs the most work.
6. `src/pages/BillingPage.tsx` (Invoices) and `src/pages/PaymentPage.tsx` (Pay Now) — for polish reference.
7. `src/pages/QuotesPage.tsx` and the Request Quote dialog.
8. `src/pages/UsersPage.tsx` — note the KPI tiles, they need to come out.
9. `src/components/layout/Header.tsx` and `src/components/layout/Sidebar.tsx`.
10. `src/pages/LoginPage.tsx` (or wherever login lives) — note the scroll behavior.

Confirm you have read these files before proceeding. Do not skip this step.

---

## Section A — Foundational reset (low risk, do first)

### A1. Theme default to light

Find the ThemeProvider (or however the theme is initialized — likely in `App.tsx`, `main.tsx`, or a dedicated provider). Default the theme to `'light'`. If localStorage already has a preference, respect it. New users land on light.

If `next-themes` or similar is used:
```tsx
<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
```

If a custom provider:
```ts
const [theme, setTheme] = useState<'light' | 'dark'>(() => {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark') return 'dark';
  return 'light';  // default light for everyone
});
```

Verify by clearing localStorage, refreshing — the portal should load in light mode.

### A2. Seed data reset — one subscription per company

In `AppContext.tsx`:

**ABC Accounting (`company-1`):**
- Exactly ONE active subscription with TWO products: NumberCruncher Desktop (5 seats) and NumberCruncher Web (3 seats).
- DataNet included automatically (no separate seat management).
- Subscription status: `active`. Renewal date: ~200 days in the future (so proration math demos are interesting).
- Payment configuration: Pay on Receipt.

**XYZ Consulting (`company-2`):**
- Exactly ONE active subscription with ONE product: NumberCruncher Desktop (10 seats).
- Subscription status: `active`. Renewal date: ~150 days in the future.
- Payment configuration: Pay on Terms (Net 30).

Remove any second subscription that may have been seeded on either company in earlier iterations. Audit `initialSubscriptions` and ensure only the above two subscriptions exist.

### A3. Deactivated licenses — zero on first load

In `AppContext.tsx` `initialLicenses`: remove any seeded licenses with `deactivatedAt` set. The "Previously held licenses" section should be HIDDEN on first load — the demoer creates the scenario during the demo by decreasing seats with the "Remove now" option.

If `getDeactivatedLicenses` doesn't already filter to companies' products, ensure it does.

### A4. Invoice and quote seed — keep as-is

Verify the v13 invoice and quote seed data is intact:
- 6 ABC invoices (one per lifecycle status) + 4 XYZ invoices
- 6 ABC quotes (one per state) + 2 XYZ quotes

If any are missing, restore from v8a's seed spec. If all present, leave alone.

### A5. Build checkpoint

Run `npm run build`. Must complete clean. Fix anything broken before proceeding.

---

## Section B — Login page reset

### B1. Tight, no-scroll login UI

Current login page has scroll. Fix:

- Single centered card, max-width ~440px.
- Card contains: Leimberg logo at top, "Sign in to your account" heading, email field, password field, "Sign in" button (primary, full-width), divider, "Demo login" button (secondary, full-width), and below the card a small "New customer? Create account" link.
- Use `min-h-screen flex items-center justify-center` on the page wrapper. Inside, just the card. No hero section, no marketing copy, no scrolling.
- Match shadcn's standard login pattern.
- Background: subtle. In light mode a very light gray (`bg-muted/30` or similar).

Demo login button: signs in as `john.smith@abcaccounting.com` (the seeded Account Owner of ABC). This is the fast path for demoers.

The "Create account" link routes to a signup flow that creates a fresh empty company and forces them through Checkout (first-time customer gate). Don't change this behavior — verify it still works after the seed reset.

### B2. First-time customer experience

Verify: when a user has no active subscription (fresh signup), the sidebar collapses to just Subscriptions + Support, and any other route redirects them to Checkout. This existing v6+ behavior should still work after the seed reset.

### B3. Build checkpoint

Run `npm run build`. Verify the login page is tight and doesn't scroll at 1280×720 (a typical demo resolution).

---

## Section C — Manage Licenses drawer rework (HIGHEST risk, most intricate)

This is the most important section. The drawer behavior needs a complete rework per the audit's flow specification. Read this section completely before writing any code in it.

### C1. Drawer structure

The Manage Licenses drawer (in `QuoteDialogs.tsx` or wherever it lives) shows for ONE product on ONE subscription:

- **Header:** Product name + "Manage Licenses" title.
- **Counts section:** Two number inputs side-by-side:
  - "Current paid licenses" (with stepper +/− buttons, min = current assigned count when decreasing without confirmation)
  - "Paid licenses at next renewal" (with stepper +/− buttons)
- **Pricing preview:** When count changes, show prorated charge (using v13 proration helpers). If decreasing, show "$0.00 — no refund issued."
- **Assigned users section:** List of users currently assigned to this product. Each row: avatar/initials, name, email, "Remove" action button.
- **Available seats:** Show empty slot count. Each empty slot has an "Assign user" button that opens a small user-picker.
- **Previously held licenses section:** Appears ONLY when `getDeactivatedLicenses(companyId, productId).length > 0`. Otherwise the section is fully absent (not an empty state — fully not rendered).

### C2. Increase paid license count

When admin increases the count from N to N+M:
- Update subscription's `paidLicenseCount` for this product.
- Add M empty seats (no user assigned).
- Calculate prorated charge: full license cost + prorated maintenance for M seats × days remaining. Use the v13 proration helper (`calculateProratedAdd`).
- Show payment method picker (existing pattern). On submit:
  - Pay Immediately → route to `/pay` with the new invoice
  - Pay on Receipt → create awaiting-payment invoice, seats are QUEUED (don't apply until paid)
  - Pay on Terms → seats apply immediately, invoice with Net 30 status

### C3. Decrease paid license count (the per-user prompt — most intricate)

When admin decreases the count from N to N-M:
- If `N-M >= currentlyAssignedCount`: no prompt, just reduce the count. (E.g., 5 seats with 3 assigned, reducing to 4 → no users affected.)
- If `N-M < currentlyAssignedCount`: trigger the per-user removal prompt.

**The per-user removal prompt:**

A confirmation dialog appears with this structure:

```
You're reducing licenses from {N} to {N-M}.
You currently have {currentlyAssignedCount} users assigned.
Choose what to do with the {currentlyAssignedCount - (N-M)} excess users:

[List of currently-assigned users, with a radio-group per user:]
┌──────────────────────────────────────────────────┐
│ ☐ John Smith                                     │
│ ☐ john.smith@abcaccounting.com                   │
│   ○ Remove now                                    │
│   ○ Remove at end of cycle ({renewalDate})       │
└──────────────────────────────────────────────────┘
[... more users ...]

You must choose exactly {currentlyAssignedCount - (N-M)} users for removal.
The rest will keep their license.

[Cancel]                        [Apply Changes]
```

Implementation details:

- All currently-assigned users are listed with checkboxes — admin selects which ones to remove (must select exactly `currentlyAssignedCount - (N-M)`).
- For each SELECTED user, a radio shows "Remove now" or "Remove at end of cycle".
- "Apply Changes" button is disabled until exactly the right number is selected and each selection has a remove-when choice.

On Apply:
- For users marked "Remove now":
  - License record's `deactivatedAt = now`, `deactivatedReason = 'Seat reduced by admin'`.
  - Subscription's `paidLicenseCount` decrements by 1 per user.
  - The user-product association is removed.
- For users marked "Remove at end of cycle":
  - The license is marked `expiresAt = subscription.renewalDate`.
  - The user keeps access until renewal date.
  - `paidLicenseCount` does NOT decrement now (still pays for them this cycle).
  - `paidLicenseCountAtRenewal` decrements by 1 per user (auto-adjust the "Paid licenses at next renewal" count to match).
- Close drawer. Toast: "{N} users removed now, {M} users will expire at renewal."

### C4. Renewal seat count change (similar to current decrease, but defaults to "Remove at end of cycle")

When admin changes "Paid licenses at next renewal" downward below current renewal-time assigned count:
- Same per-user prompt but the "Remove at end of cycle" radio is preselected for all (since this is about the next cycle, not now).
- Admin can change to "Remove now" if they want, but the default expresses the natural intent.

### C5. Inline assign/unassign in same drawer

The currently-assigned users list shows for each assigned user:
- Avatar/initials + name + email
- A 3-dot menu (or a "Remove" button if you prefer no menu) with action "Unassign user"

Below the assigned list, empty slots show:
- "Slot {n+1}" (placeholder visual)
- "Assign user" button

Clicking "Assign user" opens a small inline popover (NOT a separate drawer/dialog — the admin should not leave the drawer):
- Search-as-you-type input for users in the company who don't yet have this product
- Click a user → assigned. Popover closes.

Clicking "Unassign" on an assigned user: confirmation toast "Unassigned {name} from {product}. License remains paid — assign to someone else?"

Role gating: per v13 — AO + BA can change counts and assign/unassign. License Admin can ONLY assign/unassign (cannot change counts).

### C6. Previously held licenses section

Render ONLY when `getDeactivatedLicenses(currentCompany.id, this.productId).length > 0`.

Section header: "Previously held licenses"
Subtitle: "Reactivate to add a seat back. You'll be charged a prorated maintenance fee for the remainder of this year."

For each deactivated license:
- Product name
- Deactivated date + reason (e.g., "Deactivated Mar 12, 2026 · Seat reduced by admin")
- "Reactivate" button — opens the existing ReactivateLicenseDialog from v13.

Role gating: AO + BA only.

### C7. Build checkpoint

Run `npm run build`. Test the full flow manually:
- Open Manage Licenses on ABC's NumberCruncher Desktop product.
- Increase count from 5 → 7. Verify pricing preview shows correctly. Cancel.
- Decrease count from 5 → 3 (when 5 users are assigned). Verify the per-user prompt appears with 2 users to choose.
- Pick 1 user as "Remove now", 1 as "Remove at end of cycle". Apply. Verify the seat counts adjust and toasts fire.
- Verify the now-deactivated user appears in "Previously held licenses".
- Reactivate them. Verify the prorated invoice is created and they re-enter the available pool.

Do not advance to Section D until C builds clean.

---

## Section D — Subscriptions page polish

### D1. Fix KPI tiles

The Subscriptions page has these tiles at the top: Next Invoice, Last Payment, Outstanding, Products. They're broken.

Rewrite each tile to render with the current company's actual data:

- **Next Invoice:** Lookup the company's next upcoming or awaiting-payment invoice (by date). Show: "$XXX.XX" amount + "Due on {date}" subtitle. If none upcoming: "None scheduled".
- **Last Payment:** Lookup the most recent paid invoice (by paidAt date). Show: "$XXX.XX" amount + "Paid on {date}" subtitle. If none ever: "No payments yet".
- **Outstanding:** Sum the `totalAmount` of all unpaid invoices (`status IN ['awaiting_payment', 'overdue']`). Show: "$XXX.XX" + "{count} unpaid invoice(s)" subtitle. If $0: "All caught up" with check icon.
- **Products:** Count of unique products across all the company's active subscriptions. Show: "{count}" + "Active subscriptions" subtitle (where for ABC = 2 products on 1 subscription).

Each tile: card with subtle border, value in large bold font, subtitle below in muted color, optional icon (Receipt for Next Invoice, Check for Last Payment, AlertTriangle for Outstanding if > 0, Box for Products).

### D2. Subscription rendering — one card per active subscription

Since each company has exactly ONE active subscription, only one card renders. The card shows:
- Subscription name and status badge ("Active" green, "Pending Payment" amber, "Suspended" red)
- Renewal date prominently
- List of products in the subscription, each row with: product name, paid seat count, "Manage Licenses" button.
- Below the product list: a "Quotes" tab and "Invoices" tab (existing v8b pattern stays).

### D3. Visual polish

- Card with proper density (12px–16px padding, not 24px+).
- Status badge in the card header, not sprawled across.
- Sticky page header with breadcrumb (Section J adds breadcrumbs globally).

### D4. Build checkpoint

Run `npm run build`. Verify KPI tiles render correct data for ABC (logged in as john.smith).

---

## Section E — Bulk Import Users (new feature)

Build the full Bulk Import flow per the US-SP07-USR-001 story.

### E1. Entry point

On the Users & Contacts page, alongside the existing "Add User" button, add a "Bulk Import" button (secondary variant). Visible only to AO and License Admin.

### E2. Bulk Import dialog

Multi-step dialog:

**Step 1 — Upload**
- Drag-and-drop area + file picker
- Accepts `.xlsx` and `.csv`
- Template download links: "Download .xlsx template" and "Download .csv template" — these generate sample files in-memory and trigger browser download. Sample has 3 rows of example users with different role assignments.
- After file picked: parse using `xlsx` (already in project deps), show "X rows detected" and an "Open file" / "Cancel" option.

**Step 2 — Preview**
- Table showing first 100 rows of parsed data with columns: First Name, Last Name, Email, Username, Phone, Role(s), DataNet Email, Status.
- Per-row validation badge: green check ✓ if valid, red X if invalid.
- For invalid rows, hover/click reveals the validation error (e.g., "Email already exists in company", "Username contains invalid characters").
- File-level validations (above the table): "X total rows, Y valid, Z invalid". If any invalid: "Cannot import. Fix the invalid rows in your file and re-upload."
- "Cancel" or "Confirm Import" button (Confirm disabled when any invalid).

**Step 3 — Confirm**
- Summary: "Importing {N} users to {company name}".
- "Import" button confirms. All-or-nothing: either all rows import successfully or none do.

**Step 4 — Result**
- Success: "{N} users imported successfully." Each user gets status `invited`.
- Failure: error message with what went wrong. State rolls back.

### E3. Validation rules

Per the story:
- **Required columns:** First Name, Last Name, Email, Username, Role
- **Optional columns:** Phone, DataNet Email Opt-In (true/false, default true), Status (active/inactive, default active)
- **Per-row validations:**
  - First Name and Last Name: non-empty, max 50 chars
  - Email: valid email format, not duplicated within the file, not duplicated within the company's existing users
  - Username: non-empty, alphanumeric + dot/underscore/hyphen, max 50 chars, not duplicated within the file, not duplicated within the company's existing users
  - Role: must be one of "Registered Contact", "License Admin", "Billing Admin" (NOT "Account Owner" — protected role). Multiple roles per user via comma-separated allowed.
  - Phone: optional, but if present must be 7-20 chars
- **File-level validations:**
  - File parses as valid xlsx or csv
  - At least 1 row of data (header row not counted)
  - At most 500 rows (prevent runaway imports)
  - Required columns present

### E4. Implementation

Create `src/components/users/BulkImportDialog.tsx`. Use `xlsx` library (already in package.json) for parsing. Validation logic in a separate `src/lib/bulkImportValidation.ts` file so it's testable.

State management: drives the multi-step UX. After successful import, refresh the user list and close the dialog. Notification: AOs in the company get a `user.invited` notification per the existing notification system.

### E5. Build checkpoint

Run `npm run build`. Manual test:
- Click Bulk Import. Download xlsx template. Verify it has 3 sample rows.
- Add a 4th row with a deliberately bad email. Upload.
- Preview shows the bad row flagged red. Cannot proceed.
- Fix the row, re-upload. All valid. Confirm import.
- Verify the new users appear in the Users list with status "invited".

---

## Section F — Other pages visual polish

For each of these, the data and behavior is fine — just visual polish. Apply consistent treatment:

- Tighter card padding (12–16px not 24px+)
- Reduce excessive vertical spacing between sections
- Status badges sized appropriately (not over-prominent)
- Tables: tighter row height, hover state, subtle dividers
- Page header pattern: title + optional subtitle + primary action button on the right, breadcrumb above

Pages to polish:

### F1. Dashboard
- All 6 elements stay: Account Status, DataNet card, Download banner, License Assignments, Users card, Support card.
- Use a 2-3 column grid on desktop (e.g., Account Status spans 2 cols, DataNet + Users + Support each 1 col, License Assignments full width, Download banner full width).
- Target: fits on 1280×720 without scrolling, or close to it.

### F2. Invoices page
- Polish the table — tighter rows, better status pill styling.
- The inline Pay Now / Renew CTAs (v8b) stay as designed.

### F3. Pay Now (`/pay`) page
- Centered card layout (~600px wide).
- Clear "Paying for: {description}" section at the top.
- Amount prominently displayed.
- PO field optional, well-labeled.
- Card vs ACH tabs.
- "Pay $XXX.XX" button — primary, full-width at the bottom of the card.
- "Cancel" link below the card.

### F4. Quotes page
- Polish the table and Request Quote dialog.
- Status pills consistent with Invoices.

### F5. Users & Contacts page
- **REMOVE the KPI stat tiles at the top** (Total Users / Active / Invited / Inactive). They don't belong on an admin tool.
- Page header just shows the title + Add User + Bulk Import buttons.
- Table polished — tighter rows, better Name-as-link styling, inline DataNet toggle as designed.

### F6. Add/Edit User drawer
- Same drawer pattern as before but tighter spacing.
- Section headers smaller, less prominent.
- Field labels consistent with other forms.

### F7. Build checkpoint

Run `npm run build`. Visual sanity check of each polished page.

---

## Section G — Header polish

### G1. Downsize the Role switcher

Currently the Role Demo dropdown is prominent in the header. Make it smaller:
- Wrap in a subtle button group, smaller font (text-xs), more muted color
- Position to the LEFT of the bell icon (not in the center of attention)
- Keep the "Demo:" prefix as visual cue that it's a demo affordance

### G2. Fix avatar dropdown

The audit flagged this as "awkward." Likely issues: the avatar dropdown menu is too wide, content is poorly spaced, or the menu items are unclear.

Make the avatar dropdown:
- Anchor: avatar circle on the far right of the header
- Menu width: ~240px (fits content without sprawl)
- Menu structure:
  - Header section: avatar (larger) + full name + email
  - Divider
  - "Profile Settings" → opens existing ProfileSettingsDrawer
  - "Log out" → existing logout action
- No "Dark Mode" item here (it lives in Profile Settings per v9a)

### G3. Build checkpoint

Run `npm run build`.

---

## Section H — Sidebar polish

Visual polish only. Existing sidebar items, ordering, and active-state behavior is fine. Apply:
- Tighter item padding
- Slightly smaller icons
- Better hover state (subtle bg-muted/50 instead of strong)
- Active-state pill or underline (more refined than current)
- Logo at top, properly sized
- "Sign out" or version label at the very bottom if space permits

Run `npm run build` after.

---

## Section I — Cross-cutting polish

### I1. Breadcrumbs on every page

Add a `Breadcrumb` component to every authenticated page. Pattern:
- Place above the page header.
- Compact, muted (text-xs text-muted-foreground).
- Hierarchy: Dashboard > Section > Sub-section
- Each link is clickable.

Use shadcn's `Breadcrumb` primitive if installed; otherwise build a simple one in `src/components/ui/breadcrumb.tsx`.

### I2. Loading states

Replace any full-screen spinner with skeleton placeholders. For:
- Tables: skeleton rows (5 placeholder rows with shimmer)
- Cards: skeleton card matching the layout
- Drawers: skeleton sections matching the drawer structure

Use shadcn `Skeleton` component if installed.

### I3. Empty states

For tables/lists with no data, render an empty state component:
- Centered icon (lucide, muted)
- Short headline ("No quotes yet")
- Short description ("Request a quote to get started.")
- Primary CTA button where relevant

Build a reusable `EmptyState` component if not already present.

### I4. Toast confirmations

Audit existing toast usage. Ensure:
- Consistent placement (bottom-right by default)
- 4-second dismiss for confirmations
- Persistent until action for destructive operations (delete, suspend)
- Undo action where the operation is reversible (within ~10s)

### I5. Build checkpoint

Run `npm run build`. Spot-check breadcrumbs, an empty state (e.g., as a brand-new user with no quotes), and a loading state if you can trigger one.

---

## What NOT to touch

Per the audit:
- Notification system (bell + panel + 22 preference toggles) — leave entirely as-is
- Product Downloads & Links page — leave as-is
- DataNet page — leave as-is
- News page — leave as-is
- Support page — leave as-is
- Admin Tool functional behavior — leave as-is (Product Pricing Configuration, Force buttons, Owner stubs all stay)
- All v13 business rules (pricing model, PO field, role permissions for Manage Licenses, expiring-seat notice) — leave as-is
- The Leimberg branding, colors, fonts (just tighten the spacing)
- The shadcn UI primitives — use them, don't modify

---

## Acceptance criteria

When done, all of these must be true:

### Foundation
1. `npm run build` completes without errors.
2. Default theme is light. Clearing localStorage and refreshing loads light mode.
3. ABC Accounting has exactly ONE active subscription with two products (NumberCruncher Desktop + Web). XYZ has exactly ONE with NumberCruncher Desktop.
4. Zero deactivated licenses exist on first load. "Previously held licenses" section is hidden in default state.

### Login
5. Login page has no scroll at 1280×720. Centered card, max-width ~440px.
6. Demo login button signs in as john.smith@abcaccounting.com one click.
7. New customer signup still routes to the first-time customer Checkout gate.

### Manage Licenses
8. Decreasing count below assigned count triggers per-user prompt with "Remove now / Remove at end of cycle" choice per user.
9. "Remove now" deactivates the license immediately. "Remove at end of cycle" marks it expiring at renewal date.
10. After "Remove now", the deactivated license appears in "Previously held licenses" section.
11. Reactivating a deactivated license creates a prorated maintenance invoice and re-adds the seat (uses existing v13 ReactivateLicenseDialog).
12. Inline assign/unassign works without leaving the drawer.
13. Role gating: AO + BA can change counts; License Admin can only assign/unassign.

### Subscriptions
14. The 4 KPI tiles (Next Invoice, Last Payment, Outstanding, Products) render with correct, real data for ABC.

### Bulk Import
15. Bulk Import dialog accepts xlsx and csv with template download.
16. Preview table shows row-level validation.
17. Cannot confirm import when any row is invalid.
18. All-or-nothing import — successful import creates users with status "invited".

### Visual polish
19. Dashboard fits on 1280×720 with minimal scrolling.
20. Users & Contacts page has NO KPI tiles at the top.
21. Header Role switcher is visually smaller and less prominent.
22. Avatar dropdown is compact and well-organized.
23. Breadcrumbs appear above every authenticated page.

---

## Manual demo flow to verify after build

1. Refresh page → land on tight login page in light mode.
2. Click "Demo login" → land on Dashboard.
3. Dashboard fits on screen without major scroll.
4. Go to Subscriptions → see ONE subscription card with two products. KPI tiles show real data.
5. Click "Manage Licenses" on NumberCruncher Desktop. Drawer opens.
6. See assigned users list. No "Previously held licenses" section (because zero deactivated).
7. Decrease paid licenses from 5 to 3. Per-user prompt appears with 2 users to choose.
8. Pick "John Smith — Remove now" and "Sarah Johnson — Remove at end of cycle". Apply.
9. Drawer updates: 3 paid licenses, 4 paid at renewal, John removed, Sarah expiring.
10. Scroll down: "Previously held licenses" section now appears with John's license.
11. Click Reactivate. Dialog shows prorated maintenance. Confirm. Invoice created.
12. Back in drawer: 4 paid licenses, John back in available pool (but unassigned).
13. Switch role to License Admin via header (now smaller). Manage Licenses → can only assign/unassign, count fields disabled.
14. Go to Users & Contacts. NO KPI tiles. Click Bulk Import.
15. Download xlsx template. Upload. Preview validates. Confirm import. New users added.
16. Open Profile Settings via avatar dropdown (now compact). Toggle dark mode. Verify dark renders cleanly.

---

## Reporting back

At the end of your run, summarize:

1. Each section (A through I): status — completed / completed with deviation / blocked.
2. Files modified and files created — full list.
3. Confirmation that the per-user removal prompt in Manage Licenses works end-to-end (this is the most complex new piece — verify yourself before reporting back).
4. Confirmation that Bulk Import works end-to-end with template download, validation, all-or-nothing import.
5. Any sections where you encountered limitations or made judgment calls (e.g., the empty-state CTA wording — you picked something reasonable).
6. Output of `npm run build`.
7. A list of pages you visually polished and a brief description of what changed on each.

Do NOT commit. I will review the build, then walk through the portal myself, then issue the commit command.
