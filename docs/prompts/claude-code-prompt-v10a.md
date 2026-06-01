# Claude Code Prompt v10a — Pay-on-Receipt Redirects + DataNet Table + Demo-Friendly Login

Copy everything below this line into Claude Code in VS Code. Run on the project root.

This is the FIRST of two related batches (v10a now, v10b after). v10a focuses on small, high-impact fixes: post-Pay-on-Receipt redirects, DataNet table simplification, and a demo-friendly login that routes every login to the seeded ABC Accounting company.

---

## Context

The portal is being prepared for client and team sharing. Several small UX issues are getting in the way:

- Pay on Receipt at Checkout currently lands on `/subscriptions` with the read-only banner. Users are seeing the still-empty subscription state confusingly. They should land directly on `/invoices` where their freshly-created unpaid invoice is visible with an inline Pay Now CTA.
- Manage Licenses' Pay on Receipt does the same thing.
- DataNet table currently uses a 3-dot menu with one "View" item — overkill for a single action.
- Every unknown email creates a fresh empty company, which means demo viewers see a clean slate instead of the rich ABC seed data. This makes the prototype feel hollow during demos.

Before you write any code, read these files in this exact order:

1. `src/contexts/AppContext.tsx` — read the `login` function, `checkoutPurchase`, `requestLicenseChange`, `initialCompanies`, `initialUsers`, `generateUsername`
2. `src/pages/CheckoutPage.tsx` — the Pay on Receipt submit branch
3. `src/components/subscriptions/QuoteDialogs.tsx` — the ManageLicensesDrawer (Pay on Receipt submit branch)
4. `src/pages/DataNetPage.tsx` — current table with 3-dot menu

Do NOT start coding until you have read those four files.

---

## Final Decisions (binding for v10a)

| Topic | Decision |
|---|---|
| Pay on Receipt destination from Checkout | Always navigate to `/invoices` |
| Pay on Receipt destination from Manage Licenses | Close drawer, navigate to `/invoices` |
| DataNet action column | Inline "View" link with ExternalLink icon. NO 3-dot menu. |
| Login behavior for unknown emails | Auto-join ABC Accounting (`company-1`), create a real User record inside ABC with Account Owner role |
| Display name from email | Parse the local part (before @), split on `.`, `_`, or `-`, Title Case each part |
| Signup flow | Unchanged — still creates a fresh company with the first-time customer gate |
| Demo-user cleanup | None. State resets on page reload, which is sufficient. |

---

## Change 1 — Pay on Receipt redirect from Checkout

### File: `src/pages/CheckoutPage.tsx`

Find the Complete Payment / submit handler. There are multiple branches based on the chosen payment method. The Pay on Receipt branch currently calls `checkoutPurchase(...)` and navigates somewhere.

Update the Pay on Receipt branch:

```ts
if (paymentMethod === 'pay_on_receipt') {
  const invoice = checkoutPurchase({
    lineItems: selectedLines,
    paymentMethod: 'pay_on_receipt',
  });
  toast({
    title: 'Invoice generated',
    description: 'Pay your invoice to activate your subscription.',
  });
  navigate('/invoices');
  return;
}
```

The user lands on Invoices, sees the new awaiting-payment invoice with the inline Pay Now button. Read-only banner shows at the top of every page.

The Pay Immediately branch (routes to `/pay`) and Pay on Terms branch (existing destination is fine — `/subscriptions`) stay unchanged. Only Pay on Receipt's redirect target changes.

### Verify the read-only mode renders correctly on Subscriptions

When the user navigates from `/invoices` to `/subscriptions` (via sidebar) while their company is in Pending Payment state, they should see:
- The read-only banner at the top
- The pending subscription in the pill row (status `pending_payment`)
- The subscription's products listed
- All CRUD buttons disabled with tooltips

Audit `SubscriptionsPage.tsx` and confirm:
- The subscription selector pill filter includes `pending_payment` subscriptions, not just `active`. Specifically: `subscriptions.filter(s => s.planType === 'Annual')` should include all statuses except possibly `cancelled`. Verify there's no `s.status === 'active'` filter excluding the pending one.
- If the page is currently showing "No subscriptions" or auto-redirecting to `/checkout`, that's a bug from the first-time customer gate firing too aggressively. The gate logic in `MainLayout.tsx` already special-cases `isReadOnlyMode()` to skip the redirect — verify this branch covers pending_payment subscriptions.

If you find a real bug, fix it with the minimum change needed. Report it in your summary.

---

## Change 2 — Pay on Receipt redirect from Manage Licenses

### File: `src/components/subscriptions/QuoteDialogs.tsx`

In `ManageLicensesDrawer`, find the submit handler. The Pay on Receipt branch currently calls `requestLicenseChange(...)` and likely shows a toast but doesn't navigate.

Update:

```ts
if (paymentMethod === 'pay_on_receipt') {
  const invoice = requestLicenseChange({
    subscriptionId,
    productId,
    newLicenseCount,
    paymentMethod: 'pay_on_receipt',
  });
  toast({
    title: 'Invoice generated for license change',
    description: 'Pay your invoice to apply the seat changes.',
  });
  onOpenChange(false);  // close the drawer
  navigate('/invoices');
  return;
}
```

Make sure `navigate` is imported from `react-router-dom` at the top of the file. If `ManageLicensesDrawer` doesn't currently use navigation, add the import and the `useNavigate()` hook.

For consistency: also apply the same pattern to `AcceptQuoteDrawer` if it has a similar Pay on Receipt branch that doesn't redirect to invoices. Audit and align.

---

## Change 3 — DataNet table: drop 3-dot menu, inline View link

### File: `src/pages/DataNetPage.tsx`

The DataNet table currently has columns: Year | Month | Actions, where the Actions cell renders a `DropdownMenu` with a single "View" item.

Replace with:

| Column | Header | Cell |
|---|---|---|
| Year | `Year` | `update.year` |
| Month | `Month` | `update.monthName` |
| Action | `Action` | A button styled as a link with `ExternalLink` icon and "View" label |

Cell implementation:

```tsx
<TableCell>
  <Button
    variant="link"
    size="sm"
    onClick={() => openUpdateModal(update.id)}
    className="text-primary p-0 h-auto inline-flex items-center gap-1"
  >
    View
    <ExternalLink className="h-3 w-3" />
  </Button>
</TableCell>
```

Import `ExternalLink` from `lucide-react`. Remove the `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `MoreVertical` imports if they're no longer used in this file.

The modal that opens on click stays as-is (existing behavior — shows the issue's title, summary, and body).

**Rationale:** This is a deliberate exception to the "uniform 3-dot menu" rule established in v6b. The same exception already applies to the inline "Pay Now" / "Renew" CTAs in the invoice status column. Single-action rows benefit from inline visibility over a nested menu.

---

## Change 4 — Demo-friendly login

### File: `src/contexts/AppContext.tsx`

Update the `login` function. Currently it:
1. Finds a user by email (case-insensitive match)
2. If found and active → logs them in
3. If not found → auto-creates a fresh Company + User, marks both as new

New behavior:
1. Find a user by email (case-insensitive match)
2. If found and active → log them in (UNCHANGED — seeded users like john.smith@abcaccounting.com still log into their own company)
3. If not found → auto-create a User record **inside the seeded ABC Accounting company** (`company-1`), with Account Owner role. Do NOT create a new company.

### Implementation

```ts
const login = useCallback((email: string, _password: string): boolean => {
  if (!email.trim()) return false;
  const normalized = email.trim().toLowerCase();
  const existingUser = state.users.find(u => u.email.toLowerCase() === normalized);

  if (existingUser) {
    if (existingUser.status === 'inactive') return false;

    // Existing user found — log in normally. If invited, flip to active.
    const company = state.companies.find(c => c.id === existingUser.companyId);
    setState(prev => ({
      ...prev,
      isAuthenticated: true,
      currentUser: existingUser.status === 'invited'
        ? { ...existingUser, status: 'active', lastLoginAt: new Date().toISOString() }
        : existingUser,
      currentCompany: company || null,
      demoRoles: existingUser.roles,
      users: existingUser.status === 'invited'
        ? prev.users.map(u =>
            u.id === existingUser.id
              ? { ...u, status: 'active' as const, lastLoginAt: new Date().toISOString() }
              : u
          )
        : prev.users,
    }));
    return true;
  }

  // Unknown email — auto-join ABC Accounting as Account Owner
  const abcCompany = state.companies.find(c => c.id === 'company-1');
  if (!abcCompany) return false;  // safety: ABC must exist in seed

  const { firstName, lastName } = parseDisplayNameFromEmail(normalized);
  const generatedUsername = generateUsername(firstName, lastName, abcCompany.id, state.users);

  const newUser: User = {
    id: `user-demo-${Date.now()}`,
    companyId: abcCompany.id,
    email: normalized,
    firstName,
    lastName,
    username: generatedUsername,
    roles: ['account_owner'],
    status: 'active',
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    invitedAt: new Date().toISOString(),
    dataNetEmailOptIn: true,
  };

  setState(prev => ({
    ...prev,
    users: [...prev.users, newUser],
    isAuthenticated: true,
    currentUser: newUser,
    currentCompany: abcCompany,
    demoRoles: ['account_owner'],
  }));
  return true;
}, [state.users, state.companies]);
```

### Helper: `parseDisplayNameFromEmail`

Add near the top of `AppContext.tsx`:

```ts
function parseDisplayNameFromEmail(email: string): { firstName: string; lastName: string } {
  const localPart = email.split('@')[0] || 'demo';

  // Split on . _ - or whitespace
  const parts = localPart.split(/[._\-\s+]/).filter(Boolean);

  const titleCase = (s: string): string => {
    if (!s) return '';
    // Strip trailing digits ("john123" -> "john"); keep the word part
    const stripped = s.replace(/\d+$/, '');
    const word = stripped || s;  // if stripping leaves nothing, keep the digits
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  };

  if (parts.length === 0) {
    return { firstName: 'Demo', lastName: 'User' };
  }
  if (parts.length === 1) {
    return { firstName: titleCase(parts[0]), lastName: 'User' };
  }
  return {
    firstName: titleCase(parts[0]),
    lastName: titleCase(parts.slice(1).join(' ')),
  };
}
```

Examples:
- `john.doe@example.com` → `John Doe`
- `jane_smith@anything.com` → `Jane Smith`
- `mike-tyson@yopmail.com` → `Mike Tyson`
- `demo123@test.com` → `Demo User` (single token "demo", lastName falls back to "User")
- `support@acme.com` → `Support User` (single token)
- `j@x.com` → `J User`

### Signup flow stays untouched

The Signup wizard (`/signup`) continues to create a fresh empty Company + User. The first-time customer gate logic in MainLayout/Sidebar continues to route them to Checkout. This is unchanged.

The distinction is purely about the **login** path: previously creating a fresh company on unknown email, now joining ABC.

### Important — what this means for testing

After this change:
- Logging in with `demo@anything.com` → joins ABC, sees the full seed data immediately (10 invoices, 8 quotes, 2 subscriptions, trial license banner)
- Logging in with `john.smith@abcaccounting.com` → joins ABC as the seeded John Smith (existing behavior)
- Logging in with `michael.chen@xyzconsulting.com` → joins XYZ as the seeded Michael Chen (existing behavior)
- Going through Signup with any email → creates a fresh company, first-time-customer gate, Checkout-first

This is the desired demo-friendly behavior.

### Edge case — Demo user's roles

The auto-created user gets `['account_owner']` only. They are NOT also Billing Admin or License Admin. The role-demo dropdown in the header still lets them switch roles during the demo to see other role experiences. This matches the "Account Owner has full access" rule from the role matrix.

---

## What NOT to touch

- Leimberg branding, colors, fonts
- The dark mode system
- The notification system from v9b
- The role system and permissions
- Any seed data EXCEPT verifying that `inv-abc-004` (renewal Upcoming) and `inv-xyz-003` (renewal Net 30) exist (they were seeded in v8a)
- The Profile Settings drawer
- The Payment Methods management (now inside the drawer)
- The Signup wizard
- The shadcn UI primitives

---

## Acceptance criteria

When you're done, all of these must be true:

1. `npm run dev` and `npm run build` complete without errors.
2. Logging in with any new email (e.g., `demo@anywhere.com`) immediately shows the ABC Accounting environment with all its seeded data. The display name in the avatar reads "Demo Anywhere" or similar Title-Case parse from the email.
3. The auto-created user has Account Owner role, status active, and is added to ABC's users list.
4. Logging in with `john.smith@abcaccounting.com` still logs in as the seeded John Smith (no behavior change for existing seeded users).
5. Going through `/signup` still creates a fresh empty company (first-time customer experience).
6. At Checkout, selecting Pay on Receipt and submitting:
   - Creates a new pending-payment subscription
   - Creates an awaiting-payment invoice
   - Toasts "Invoice generated. Pay your invoice to activate your subscription."
   - Navigates to `/invoices`
   - The new invoice is visible in the list with an inline Pay Now button
7. Navigating from /invoices to /subscriptions while in pending-payment state shows the pending subscription with disabled CRUD and the read-only banner. NOT a redirect to Checkout. NOT "No subscriptions."
8. At Manage Licenses, selecting Pay on Receipt and submitting:
   - Creates an awaiting-payment invoice for the seat change
   - Toasts "Invoice generated for license change. Pay your invoice to apply the seat changes."
   - Closes the drawer
   - Navigates to `/invoices`
9. DataNet page table has columns: Year | Month | Action. No 3-dot menu. Action column shows an inline "View" link with ExternalLink icon.
10. Clicking the View link opens the existing DataNet update modal.
11. The renewal invoice `inv-abc-004` (or equivalent) is visible in ABC's Invoices list with "Upcoming" status. The renewal invoice for XYZ is visible with "Net 30" status. (If these are missing from seed, re-add them — see v8a spec for the exact shape.)

---

## Manual demo flow

1. Open the app in an incognito browser tab. Log in with `firstname.lastname@anything.com`.
2. Header shows "Firstname Lastname" as the display name. The avatar shows initials.
3. Sidebar shows full menu (because ABC has paid invoices in its seed history). All pages load with rich data.
4. Visit Invoices. See `inv-abc-001` through `inv-abc-006` plus the XYZ-side entries are absent (you're in ABC). Confirm `inv-abc-004` shows "Upcoming" status.
5. Visit Quotes. See 6 ABC quotes across all lifecycle states.
6. Now test the Pay on Receipt path. Click Subscriptions → click "Manage Licenses" on any product → increase seats → choose Pay on Receipt → confirm. Drawer closes, redirected to Invoices, see the new awaiting-payment invoice.
7. Click the inline Pay Now button → routes to `/pay` → complete payment → land on `/subscriptions` with paid state.
8. Now test the Checkout Pay on Receipt path. Open `/signup` in a new tab. Go through the wizard with a new email. After signup, land on Checkout. Choose products. Click Complete Payment → choose Pay on Receipt → submit. Redirected to `/invoices`. See the awaiting-payment invoice.
9. Navigate to `/subscriptions`. See the pending subscription, with the read-only banner at the top, CRUD disabled.
10. Pay the invoice → banner clears, CRUD unlocks, subscription is active.

---

## Reporting back

At the end of your run, summarize:

1. Every file modified.
2. The list of any Subscriptions-page bugs you found and fixed (filter exclusions, gate redirects, banner triggers).
3. Confirmation that the renewal invoices `inv-abc-004` and `inv-xyz-003` (or equivalents) exist in seed data and are visible in Invoices.
4. Any deviations from this spec.
5. The output of `npm run build`.

Do not commit. I will review.
