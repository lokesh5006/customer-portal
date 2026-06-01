# Claude Code Prompt — Header Cleanup + Subscriptions Page Redesign

Copy everything below this line into Claude Code in VS Code. Run it on the project root.

---

## Context

This is the third update to the Leimberg customer portal prototype. Previous prompts handled the Leimberg rebrand + Checkout rebuild, then the product catalog cleanup + Downloads gating + Subscription activation on payment. All previous work stays in place.

This prompt has three related changes:

1. **Header cleanup** — Remove company switcher entirely. Hide the Role Demo dropdown behind a `?demo=1` query param. Keep only the notification bell and user avatar dropdown on the right.
2. **Subscription pill: filter + rename** — Filter the selector pills to only show Annual Plan-type subscriptions (hiding any "Tax Add-on Plan"), and add an inline pencil icon on each pill that opens a Rename Subscription dialog. A new `renameSubscription` method is added to AppContext.
3. **Subscriptions page redesign** — Switch the Overview tab to a two-column layout (subscription overview + products on the left, billing details + renewal options on the right) per a provided visual spec.

Before you write any code, read these files in this exact order:

1. `src/components/layout/Header.tsx` — the file you'll restructure most
2. `src/pages/SubscriptionsPage.tsx` — the file you'll redesign
3. `src/contexts/AppContext.tsx` — to understand the `Subscription` shape, `getCompanySubscriptions`, `getCompanyConfig`, payment-method types
4. `src/components/billing/RenewalFlyout.tsx` — referenced by SubscriptionsPage, leave alone but understand its props
5. `src/components/subscriptions/QuoteDialogs.tsx` — referenced by SubscriptionsPage, leave alone but understand which dialogs are used
6. `src/components/layout/MainLayout.tsx` — to understand if any header-related logic lives there

Do NOT start coding until you have read those six files.

---

## Change 1 — Header cleanup

### File: `src/components/layout/Header.tsx`

Currently the header has, from left to right:
- Logo (Leimberg wordmark — keep)
- Company switcher (DropdownMenu with `Building2` icon, current company name, list of all companies) — **REMOVE**
- A spacer
- "Role Demo" dropdown (`Settings` icon, role checkboxes, Billing+Admin switch) — **GATE BEHIND QUERY PARAM**
- Current-roles display (two badges + "+N" overflow) — **GATE BEHIND QUERY PARAM** (it's part of the same demo affordance)
- User avatar dropdown — **KEEP**

You also need to ADD a notification bell button between the demo affordance and the user avatar, since it appears in the visual spec but isn't currently rendered.

### Updated header structure

```
[Logo] ........................................... [Bell] [Avatar ▾]
```

When `?demo=1` is present in the URL, render an additional cluster before the bell:

```
[Logo] ........... [Role Demo ▾] [role badges] [Bell] [Avatar ▾]
```

### Implementation details

**Detecting the demo flag:**

Use `useSearchParams` from `react-router-dom`. But because the user navigates between pages and the param needs to PERSIST across navigation, store the flag in `sessionStorage` once detected:

```ts
import { useSearchParams } from 'react-router-dom';

const [searchParams] = useSearchParams();
const demoMode = useMemo(() => {
  // Persist once detected so it survives client-side navigation
  if (searchParams.get('demo') === '1') {
    sessionStorage.setItem('leimberg.demoMode', '1');
    return true;
  }
  return sessionStorage.getItem('leimberg.demoMode') === '1';
}, [searchParams]);
```

Wrap the entire Role Demo dropdown + current-roles badges block in `{demoMode && (...)}`.

**Notification bell button:**

Use `Bell` from `lucide-react`. Render as an icon button (`<Button variant="ghost" size="icon">`). Onclick → for now, just show a toast: `"You're all caught up. No new notifications."`. Add a tiny red dot when `state.invoices` has any unpaid/overdue/awaiting_payment invoices for the current company — use `<span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />` positioned over the bell icon (the button needs `relative` for this).

**Remove the company switcher entirely:**

- Delete the entire `<DropdownMenu>` block containing the `Building2` icon and company list.
- Remove the imports for `Building2` if no longer used elsewhere in the file.
- Do NOT remove `selectCompany` or `currentCompany` from the destructured `useApp()` call — they're still needed for the company name (if you display it anywhere) and other features. Actually verify: after removing the switcher, is `currentCompany` or `selectCompany` still referenced in `Header.tsx`? If not, drop them from the destructure to keep the file clean.

**Proxy session banner stays:**

The `{isProxySession && proxiedUser && ...}` banner at the top of the component stays exactly as-is. It's only visible during a proxy session (which is started from the Users page) and is part of the demo affordance. Treat it as part of the demo mode — wrap it in `{demoMode && isProxySession && proxiedUser && (...)}` so it only appears in demo mode.

**User avatar dropdown stays:**

Keep the avatar, name, and dropdown (Profile menu item was already removed in the previous run — verify it's gone; if not, remove it). Keep Sign Out.

### Result

After this change:
- A normal user visiting `/dashboard` sees: `[Logo] ............. [Bell] [Avatar]`
- A demo user visiting `/dashboard?demo=1` (then any subsequent page) sees: `[Logo] ........ [Role Demo ▾] [badges] [Bell] [Avatar]` and the proxy banner if active
- Closing the tab clears `sessionStorage`, so demo mode is per-session — exactly the behavior we want for demos

---

## Change 2 — Subscription selector pill: filter + rename

### File: `src/pages/SubscriptionsPage.tsx`

There is currently logic that renders subscription selector pills when `subscriptions.length > 1`:

```tsx
{subscriptions.length > 1 && (
  <div className="flex flex-wrap gap-2">
    {subscriptions.map((sub, idx) => (
      <Button ...>{sub.name}</Button>
    ))}
  </div>
)}
```

### 2a. Filter out non-Annual plans

In the redesigned page, the pill row remains but it should:
- Only render Annual Plan-type subscriptions (`planType === 'Annual'`). Filter out any others.
- Always show the pill row when at least 1 subscription exists (not only when >1).
- If you find any seed data or test code that creates a "Tax Add-on Plan" subscription, leave the seed data alone but ensure the rendered list excludes it.

In practice, after the previous prompts, the user should only ever have at most one `Annual Plan` subscription. If you only find one matching subscription, just render a single active pill — no other plan types are expected.

### 2b. Allow editing the subscription name from the pill

Each rendered pill should have a small inline pencil-edit icon directly inside the pill (right of the name). Clicking the pencil opens a modal that lets the user rename the subscription.

**Pill structure (visual):**

```
[ Annual Plan   ✎ ]
```

The pill itself remains a `<Button>` that selects the subscription on click. The pencil sits inside the pill but is its own clickable element — clicking the pencil must NOT also fire the pill's select handler. Use `e.stopPropagation()` on the pencil's onClick.

**Implementation guidance:**

```tsx
<Button
  key={sub.id}
  variant={selectedSubIndex === idx ? 'default' : 'outline'}
  onClick={() => { setSelectedSubIndex(idx); setActiveTab('overview'); }}
  className="h-auto py-2 pl-4 pr-2"
>
  <div className="flex items-center gap-3">
    <div className="text-left">
      <div className="text-sm font-medium">{sub.name}</div>
      <div className="text-xs opacity-80">
        {sub.planType} · {sub.products.length} product{sub.products.length !== 1 ? 's' : ''}
      </div>
    </div>
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openRenameDialog(sub); }}
      className="ml-1 p-1 rounded hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-current"
      aria-label={`Rename ${sub.name}`}
    >
      <Edit className="h-3.5 w-3.5" />
    </button>
  </div>
</Button>
```

Use the existing `Edit` icon (already imported from `lucide-react` in this file).

**Rename dialog:**

Add a new local Dialog state at the top of the component:

```ts
const [renameOpen, setRenameOpen] = useState(false);
const [renameSubId, setRenameSubId] = useState<string | null>(null);
const [renameDraft, setRenameDraft] = useState('');
```

Handler:
```ts
const openRenameDialog = (sub: Subscription) => {
  setRenameSubId(sub.id);
  setRenameDraft(sub.name);
  setRenameOpen(true);
};
```

Dialog UI (place it near the bottom of the JSX, alongside the existing Edit Billing dialog):

```tsx
<Dialog open={renameOpen} onOpenChange={setRenameOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Rename Subscription</DialogTitle>
      <DialogDescription>
        Give this subscription a name that's meaningful to your team.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-1.5">
      <Label htmlFor="sub-name">Subscription name</Label>
      <Input
        id="sub-name"
        value={renameDraft}
        onChange={(e) => setRenameDraft(e.target.value)}
        autoFocus
      />
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
      <Button
        onClick={() => {
          if (renameSubId && renameDraft.trim()) {
            renameSubscription(renameSubId, renameDraft.trim());
            toast({ title: 'Subscription renamed' });
            setRenameOpen(false);
          }
        }}
        disabled={!renameDraft.trim()}
      >
        Save
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Validation:** Trim whitespace. Disable Save when the trimmed input is empty. No other rules — duplicate names across subscriptions are allowed (rare edge case for this prototype).

**Context method — new:**

The `renameSubscription` function doesn't exist yet. Add it to `src/contexts/AppContext.tsx`:

1. Add to the `AppContextType` interface:
   ```ts
   renameSubscription: (subscriptionId: string, newName: string) => void;
   ```
2. Implement near the other subscription helpers (`addSubscription`, `addProductToSubscription`):
   ```ts
   const renameSubscription = useCallback((subscriptionId: string, newName: string) => {
     setState(prev => ({
       ...prev,
       subscriptions: prev.subscriptions.map(s =>
         s.id === subscriptionId ? { ...s, name: newName } : s
       ),
     }));
   }, []);
   ```
3. Add `renameSubscription` to the context provider `value`.
4. Destructure `renameSubscription` from `useApp()` at the top of SubscriptionsPage.

**One important consequence:** the Annual Plan summary card in the left column (Change 3's `AnnualPlanSummaryCard`) shows the subscription name as its title. After the user renames the subscription, the new name should appear there immediately — since the card pulls from `currentSub.name`, this should "just work" with React's state updates. No extra wiring needed, but confirm this in your manual check.

---

## Change 3 — Subscriptions page redesign

### Overall

Replace the current Overview tab content with a two-column layout. The page structure becomes:

```
[Page header: title + description]
[Subscription selector pills]   (only Annual Plan; one pill in normal flow)
[Tab strip: Overview | Invoices | Quotes]

  ── Overview tab ──
  ┌─────────────────────────────────┬─────────────────────────┐
  │ Annual Plan summary card        │ Billing Details card    │
  │ (status, KPIs)                  │ (with edit pencil)      │
  │                                 │                         │
  │ Products in this subscription   │ Renewal Options card    │
  │ (product tiles)                 │ (payment method radio)  │
  └─────────────────────────────────┴─────────────────────────┘

  ── Invoices tab ──    (unchanged, keep current implementation)
  ── Quotes tab ──      (unchanged, keep current implementation)
```

Implement the Overview tab content as a 12-column grid:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
  <div className="lg:col-span-8 space-y-6">  {/* Left column */}
    ...AnnualPlanSummaryCard
    ...ProductsCard
  </div>
  <div className="lg:col-span-4 space-y-6">  {/* Right column */}
    ...BillingDetailsCard
    ...RenewalOptionsCard
  </div>
</div>
```

### Left column — Annual Plan summary card

This replaces the current "border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" hero card. Visual spec:

- White card (no gradient), 1px default border, rounded.
- Top row: small 40×40 circular avatar on the left (light grey/lavender background like `bg-muted`, can contain the first letter of the plan name "A"), then on the right of the avatar:
  - Title: `Annual Plan` — `text-base font-semibold`
  - Subtitle (one line, muted): `Renews {formatted renewalDate} · Billed Annual · Last paid by {paymentMethod}` — `text-xs text-muted-foreground`
- Far right of the top row: status badge
  - "Payment Overdue" — red (use `bg-destructive/10 text-destructive border-destructive/20`)
  - "Renewal Due" — amber (use `bg-warning/10 text-warning border-warning/20`)
  - "Active" — green (use `bg-success/10 text-success border-success/20`)
- A thin separator row (`border-t`) below the top row.
- KPI row: 4 columns, equal width. Each KPI:
  - Tiny uppercase label — `text-xs font-medium text-muted-foreground uppercase tracking-wide`
  - Big value — `text-xl font-semibold` (for currency: include `$` and comma-separated)
  - Sub-line — `text-xs text-muted-foreground`

The 4 KPIs:
1. **NEXT INVOICE** — value `${nextInvoice?.amount or computed total}` — sub: `due {nextInvoice?.dueDate or renewalDate}`
2. **LAST PAYMENT** — value `${lastPaid?.amount or '—'}` — sub: `{lastPaid?.date} · {paymentMethod}` (or `—` if no last payment)
3. **OUTSTANDING BALANCE** — value `${outstanding}` (red `text-destructive` if > 0, else default) — sub: `Action required` (red) if > 0, else `Nothing due`
4. **PRODUCTS** — value `{currentSub.products.length}` — sub: `in this subscription`

Reuse the existing calculations from the current SubscriptionsPage (`lastPaid`, `nextInvoice`, `outstanding`, `accountStatus`). Don't recompute them differently — pull them from where they already are.

### Left column — Products in this subscription card

A separate Card below the summary card. Visual spec:

- Card header row: title `"Products in this subscription"` on the left (text-base font-semibold), `"{N} total"` on the right in muted small (text-xs text-muted-foreground).
- Body: grid of product tiles, 2 columns on desktop (`grid-cols-1 md:grid-cols-2 gap-3`), 1 on mobile.
- Each product tile is a sub-card (1px border, rounded-md, p-4) containing:
  - Product name — `text-base font-semibold` — use the EXACT product names from the subscription's products array (e.g. `'NumberCruncher Web'`, `'NumberCruncher Desktop'`, `'QuickView Desktop'`, `'DataNet'`). Do not invent labels like "Desktop Add-on".
  - Status line: small green dot + `Active` label — `text-xs`. Green dot = `<span className="inline-block h-2 w-2 rounded-full bg-success mr-1.5" />`. If the product status is not active, dot is grey/red as appropriate.
  - A row with two columns:
    - SEATS — `text-xs uppercase text-muted-foreground` label above a value `{assigned}/{licenseCount}` in `text-sm font-semibold`
    - AVAILABLE — same label style, value = `{licenseCount - assigned}` in `text-sm font-semibold` (red if 0, default otherwise)
  - Bottom: full-width outline button "View License Assignments" (`<Button variant="outline" size="sm" className="w-full">`). Onclick → opens the existing `ManageLicensesDrawer` (same as the current "Manage Licenses" button) with the appropriate sub and product. Update the button label from "Manage Licenses" to "View License Assignments".

### Right column — Billing Details card

Compact card matching the screenshot. Visual spec:

- Card header: title `"Billing Details"` (text-base font-semibold) on the left, pencil-icon button on the right (always visible — NOT hover-only). The pencil button opens the existing Edit Billing Details dialog. Use `<Edit className="h-4 w-4" />` inside `<Button variant="ghost" size="icon" className="h-7 w-7" />`.
- Body: 2-column grid (`grid-cols-2 gap-x-6 gap-y-4`) of label/value pairs. Each pair:
  - Label: `text-xs font-medium text-muted-foreground uppercase tracking-wide`
  - Value: `text-sm` (linkable values like email can be `text-sm`)

Render these pairs in this order (across, top to bottom):
1. COMPANY NAME — `{billing.companyName}` | ADDRESS — `{billing.address}, {billing.city}, {billing.stateZip}` (single line; if it wraps that's fine)
2. BILLING CONTACT — `{billing.contactName}` | PHONE — `{billing.phone}`
3. TAX ID — `{billing.taxId}` | BILLING EMAIL — `{billing.contactEmail}`

Pull values from the existing `billing` state object that lives inside SubscriptionsPage. Don't change the state shape, just render it differently.

The existing payment-eligibility info ("Pay on Receipt", "Default Billing Method", "Terms", "Subscription Status") that's currently shown in a 4-column sub-row of the Billing Details card → **drop these from the visible UI** in the redesign. They were noisy and the new layout has no space for them. They still live in `companyConfigs` state, so any logic depending on them (like payment-method gating elsewhere) still works.

### Right column — Renewal Options card

Visual spec:

- Card header: title `"Renewal Options"` (text-base font-semibold) + below it as a subtitle: `"Select a payment method for your next renewal."` (text-xs text-muted-foreground)
- Body: vertical list of selectable rows. Each row:
  - 1px border by default, rounded-md, p-3
  - Layout: `flex items-center justify-between`
  - Left: radio circle + method name (`text-sm`)
  - Right (only when selected): `"Current"` pill — `<Badge variant="outline" className="bg-primary text-primary-foreground border-primary text-xs">Current</Badge>`
  - When selected: border becomes `border-primary` (a 1px primary-color border around the whole row)
  - When not selected: default border, no pill
- Clicking a row sets the local `paymentMethod` state and toasts: `"Renewal payment method updated"` with the method name as description.

The radio circle: render an actual radio circle (not the existing button approach). Use a `div` with conditional inner dot:
```tsx
<div className="h-4 w-4 rounded-full border-2 border-input flex items-center justify-center">
  {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
</div>
```

Or use the shadcn `RadioGroup` + `RadioGroupItem` — either works. Keep accessibility (label and radio are clickable together).

Method options (unchanged from current page):
- Direct ACH
- Credit Card
- ACH e-Check
- Paper Check
- Invoice Only (Net 30)

Default selected = `'Credit Card'` (matches existing default).

---

## What NOT to touch

- The Leimberg branding and color tokens (`#1D618E`, Inter font) — already applied
- The first-time customer gate (`isFirstTimeCustomer`, sidebar filtering, MainLayout redirects)
- The product catalog (4 products only)
- The DataNet auto-select logic on Checkout
- The Downloads page gating
- `src/components/billing/RenewalFlyout.tsx` — leave the file alone; just keep using it from SubscriptionsPage
- `src/components/subscriptions/QuoteDialogs.tsx` — leave alone
- The Invoices tab and Quotes tab contents in SubscriptionsPage — keep them as they currently are; only the Overview tab content is being redesigned
- The existing edit Billing Details Dialog at the bottom of SubscriptionsPage — keep it; the pencil button still opens it
- The shadcn UI primitives in `src/components/ui/*`
- The seed data arrays

---

## Acceptance criteria

When you're done, all of these must be true:

1. `npm run dev` runs without errors.
2. On `/dashboard` (without `?demo=1`), the header shows only: Logo (left), Bell icon, Avatar dropdown (right). No company switcher, no Role Demo, no role badges. No proxy banner.
3. Adding `?demo=1` to the URL (e.g. `/dashboard?demo=1`) makes the Role Demo dropdown and role badges reappear. After visiting once, the demo affordance persists across navigation in the same tab (e.g. clicking Sidebar items keeps it visible).
4. Closing and reopening the tab without `?demo=1` removes the demo affordance.
5. Clicking the bell icon shows a toast. If there's at least one unpaid/awaiting/overdue invoice, a small red dot appears over the bell.
6. The Subscriptions page Overview tab uses a two-column layout: left column has the Annual Plan summary card and the Products card; right column has the Billing Details card and the Renewal Options card.
7. The Annual Plan summary card uses a 4-KPI grid (NEXT INVOICE / LAST PAYMENT / OUTSTANDING BALANCE / PRODUCTS) with uppercase labels, big values, and small sub-text — matching the visual spec.
8. The Products card lists actual product names from the subscription (e.g. "NumberCruncher Web", "DataNet") — no fake labels like "Desktop Add-on".
9. Each product tile has a status dot + "Active", SEATS X/Y, AVAILABLE Z, and a full-width "View License Assignments" button that opens the existing Manage Licenses drawer.
10. The Billing Details card shows COMPANY NAME / ADDRESS / BILLING CONTACT / PHONE / TAX ID / BILLING EMAIL in a 2-column grid, with an always-visible pencil icon that opens the existing Edit Billing Details modal.
11. The Renewal Options card lists 5 payment methods as selectable rows. The selected row has a primary-color border and a "Current" pill on the right. Clicking another row toggles the selection.
12. The "Tax Add-on Plan" pill is not visible anywhere. Only "Annual Plan" appears as the subscription selector (if seed data contains Tax Add-on, it's hidden, not deleted).
13. Each subscription pill has a small pencil icon next to the name. Clicking the pencil opens a "Rename Subscription" dialog with the current name pre-filled.
14. Clicking the pencil does NOT select the subscription (the click is isolated from the pill's onClick).
15. Saving a new name updates the pill label, the Annual Plan summary card title, and persists in the AppContext state (visible on a fresh navigation to another page and back).
16. Saving with an empty/whitespace-only name is blocked (Save button disabled).
17. The Invoices tab and Quotes tab still work exactly as before.
18. Switching tabs (Overview / Invoices / Quotes) preserves selection in the URL via `?tab=` (existing behavior — should still work).
19. `npm run build` completes without errors.
20. No console errors on navigation.

---

## Reporting back

At the end of your run, give me a short summary with:

1. The list of every file you modified.
2. Confirmation that `currentCompany`, `selectCompany`, and `Building2` are correctly handled in Header.tsx (i.e., destructured only if still used; imports removed only if no longer referenced).
3. Whether any "Tax Add-on Plan" reference exists in seed data and how you handled it.
4. Confirmation that the pencil-icon click in the subscription pill is properly isolated from the pill's select handler (i.e., clicking the pencil opens the rename dialog WITHOUT switching the selected subscription).
5. Confirmation that `renameSubscription` was added to `AppContextType`, implemented in `AppProvider`, and exposed in the context `value`.
6. Any deviations from this spec.
7. The output of `npm run build` (success or full error log).

Do not commit. I will review your changes manually.
