# Claude Code Prompt v7a — Role System Rework + User Edit Drawer + Read-Only Mode + Multi-Subscription Support

Copy everything below this line into Claude Code in VS Code. Run it on the project root.

This prompt is the FIRST of two related batches (v7a now, v7b later). It implements the role permission matrix, redesigns the User Edit drawer, adds read-only mode for pending-payment subscriptions, and enables multi-subscription viewing.

---

## Context

This is the seventh major batch of changes for the Leimberg customer portal. Previous batches handled: rebrand, Checkout, catalog cleanup, Downloads gating, header cleanup, Subscriptions redesign, polish, sticky right column, universal payment page, login fix, fixed page headers, 3-dot action menus, Payment Methods, renewal drawer, DataNet page.

This batch is grounded in two documents the user supplied: a Business Rules document (126 rules) and a Role Access Matrix. Most decisions in this prompt come directly from those documents; only the explicit decisions called out in `Final Decisions` below override or augment them.

Before you write any code, read these files in this exact order:

1. `src/contexts/AppContext.tsx` — read the `Role` type, the `User` interface, `pageAccess`, all role-checking selectors (`hasAccess`, `getEffectiveRoles`), seed users, role-related context methods (`changeUserRoles`, `addUser`, `deactivateUser`, `reactivateUser`)
2. `src/components/layout/MainLayout.tsx` — page-access guard
3. `src/components/layout/Sidebar.tsx` — role-based nav filtering
4. `src/components/layout/Header.tsx` — Role Demo dropdown
5. `src/pages/UsersPage.tsx` — current Users table and dialogs
6. `src/pages/ContactsPage.tsx` — current Contacts table
7. `src/pages/SubscriptionsPage.tsx` — subscription selector pill row and the empty state
8. `src/pages/CheckoutPage.tsx` — payment method picker
9. `src/pages/Dashboard.tsx` — overdue/pending banner area
10. `src/pages/BillingPage.tsx` — invoice rows for Pay-on-Receipt
11. `src/pages/QuotesPage.tsx` — for Accept Quote PO field

Do NOT start coding until you have read those files.

---

## Final Decisions (binding for this prompt)

These supersede anything in the source documents that conflicts. The user has explicitly confirmed each one.

| Topic | Decision |
|---|---|
| Old role IDs | **Replace entirely.** Old: `owner`, `billing`, `admin`, `standard`. New: `account_owner`, `billing_admin`, `license_admin`, `registered_contact`. Migrate every reference in code and seed data. |
| Username format | Lowercase, first name + last name with NO separator. `John Smith` → `johnsmith`. |
| Username duplicates | Auto-generation appends numeric suffix: `johnsmith` → `johnsmith1` → `johnsmith2`. Manual entry in edit drawer shows "Username already exists" error if duplicate within the same company. |
| Pay on Receipt activation | Subscription = **Pending Payment**. Does not activate until invoice paid. |
| Pay on Terms activation | Subscription = **Active immediately**. No grace logic. |
| Grace period (non-Terms) | None. Subscription is **suspended on expiry** until renewal invoice paid. |
| License decrease | If unpaid renewal invoice exists → edit seats on that invoice's renewal drawer. If renewal paid → cannot decrease below `purchasedLicenseCount`. Mid-cycle decrease on a paid subscription is blocked. |
| Multiple subscriptions | Portal viewable, customer cannot self-purchase a second subscription. Seed data must demo this. |
| Tax rate | Configurable per company from Admin Tool, default 7%. |
| New signup user | Auto-granted **Account Owner role only**. No license auto-assignment. |
| Account Owner deactivation | Blocked if last active Owner — must transfer ownership first (transfer flow is out of scope for this prompt). |
| Quote expiry | 30 days from creation. |
| PO number | Optional on Accept Quote modal; displayed on resulting invoice. |
| License types | Three types: `paid` (default, "User License"), `it_assistant` ("IT Assistant License"), `trial` ("Trial License"). License types are set by backend/admin, NOT from the portal. Portal displays the type as a badge wherever the license shows. |
| Send Invite, Assign Licence toggles, Send Change Password button | **Removed** from User Edit drawer. |
| Read-only mode (pending payment) | Persistent banner + greyed CRUD buttons + tooltip on click. Still enabled: pay the invoice, manage payment methods, edit own profile, create support ticket. |

---

## Change 1 — Role System Rework

### 1.1 Update the Role type and seed data

**File: `src/contexts/AppContext.tsx`**

Replace the existing `Role` type:

```ts
export type Role = 'account_owner' | 'billing_admin' | 'license_admin' | 'registered_contact';
```

Add a display-label helper near the top of the file:

```ts
export const ROLE_LABELS: Record<Role, string> = {
  account_owner: 'Account Owner',
  billing_admin: 'Billing Admin',
  license_admin: 'License Admin',
  registered_contact: 'Registered Contact',
};
```

Use `ROLE_LABELS[role]` everywhere a role is displayed to the user. Never render the raw enum value.

### 1.2 Migrate seed users

In `initialUsers` and any seeded role references:
- `'owner'` → `'account_owner'`
- `'billing'` → `'billing_admin'`
- `'admin'` → `'license_admin'`
- `'standard'` → `'registered_contact'`

Every seeded user's `roles` array gets the new IDs. Anywhere a string union of roles is used in code (e.g., `requiredRoles: ['owner']`), update to the new IDs.

### 1.3 Update `pageAccess` per the Role Access Matrix

In `MainLayout.tsx`:

```ts
const pageAccess: Record<string, Role[]> = {
  '/dashboard': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/profile': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/support': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/downloads': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/datanet': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/news': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],

  '/users': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],  // visibility varies — handled in page
  '/users-contacts': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/contacts': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],

  '/subscriptions': ['account_owner', 'billing_admin', 'license_admin'],
  '/checkout': ['account_owner', 'billing_admin'],
  '/pay': ['account_owner', 'billing_admin'],
  '/invoices': ['account_owner', 'billing_admin'],
  '/billing': ['account_owner', 'billing_admin'],
  '/quotes': ['account_owner', 'billing_admin'],
  '/payment-methods': ['account_owner', 'billing_admin'],

  '/admin': ['account_owner', 'license_admin'],
};
```

### 1.4 Update Sidebar visibility per role

In `Sidebar.tsx`, the existing role-based filter via `hasAccess()` should continue to work, but verify each nav item's `requiredRoles` matches the matrix:

| Nav item | Required roles |
|---|---|
| Dashboard | all |
| Subscriptions | `account_owner`, `billing_admin`, `license_admin` |
| Users & Contacts | all (Registered Contact sees limited list — handled in page) |
| Product Downloads & Links | all |
| Invoices | `account_owner`, `billing_admin` |
| Quotes | `account_owner`, `billing_admin` |
| DataNet | all |
| Newsletter | all |
| Support | all |
| Admin Tool | `account_owner`, `license_admin` |

The first-time customer gate and the demo gate continue to work on top of this.

### 1.5 New permission helper functions

Add to `AppContext.tsx`:

```ts
// Can the current user perform a specific named action?
export type Permission =
  | 'users.add'
  | 'users.edit'
  | 'users.assign_roles'
  | 'users.deactivate'
  | 'users.impersonate'
  | 'subscriptions.purchase'
  | 'subscriptions.modify_seats'
  | 'subscriptions.cancel'
  | 'licenses.assign'
  | 'billing.view'
  | 'billing.pay'
  | 'billing.manage_methods'
  | 'support.view_all_tickets';

const can = useCallback((perm: Permission): boolean => {
  const roles = getEffectiveRoles();
  const has = (r: Role) => roles.includes(r);
  // Account Owner can do everything
  if (has('account_owner')) return true;

  switch (perm) {
    case 'users.add':
    case 'users.edit':
      return has('license_admin');
    case 'users.assign_roles':
      return has('license_admin'); // limited — only registered_contact, enforced in UI
    case 'users.deactivate':
      return has('license_admin'); // limited — non-owner, non-billing, enforced in UI
    case 'users.impersonate':
      return has('license_admin'); // limited — only registered_contact
    case 'subscriptions.purchase':
    case 'subscriptions.modify_seats':
    case 'subscriptions.cancel':
      return has('billing_admin');
    case 'licenses.assign':
      return has('license_admin');
    case 'billing.view':
    case 'billing.pay':
    case 'billing.manage_methods':
      return has('billing_admin');
    case 'support.view_all_tickets':
      return has('account_owner') || has('billing_admin') || has('license_admin');
    default:
      return false;
  }
}, [getEffectiveRoles]);
```

Expose `can` in the context value. Use it everywhere we check permissions in UI (button disabled states, menu visibility).

### 1.6 Role-assignment visibility rule (Edit User drawer)

When an admin edits another user's roles, the roles they can SEE/GRANT depend on the editor's own roles:

- **Account Owner editing anyone**: sees all 4 roles. Can grant any. (Note: granting Account Owner = transferring ownership = deferred to v7b; for now, the Account Owner checkbox is disabled with tooltip "Ownership transfer coming soon.")
- **License Admin editing**: sees only `registered_contact`. The other 3 checkboxes are hidden (not shown disabled — hidden entirely).
- **Billing Admin editing**: cannot edit users (their button isn't shown).
- **Registered Contact editing**: cannot edit users.

This rule lives in the Edit User drawer (Change 2.4 below).

### 1.7 Header role-demo dropdown

In `Header.tsx`'s demo dropdown (`?demo=1` only), replace the four old role checkboxes with the new role names and IDs:

```
☐ Account Owner
☐ Billing Admin
☐ License Admin
☐ Registered Contact
```

When toggled, set `demoRoles` to the new IDs. The "Billing + Admin Access" switch can stay but should toggle adding `license_admin` to a `billing_admin` user (replicating the previous behavior with new IDs).

---

## Change 2 — Users & Contacts redesign

### 2.1 Add `username` to the User model

In `src/contexts/AppContext.tsx`, add to the `User` interface:

```ts
username: string;
```

Add a helper:

```ts
const generateUsername = (firstName: string, lastName: string, companyId: string, existingUsers: User[]): string => {
  const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!base) return `user${Date.now()}`;
  const inCompany = existingUsers.filter(u => u.companyId === companyId);
  if (!inCompany.some(u => u.username === base)) return base;
  let i = 1;
  while (inCompany.some(u => u.username === `${base}${i}`)) i++;
  return `${base}${i}`;
};
```

Add a duplicate-checker:

```ts
const isUsernameTaken = (username: string, companyId: string, excludeUserId?: string): boolean => {
  return state.users.some(
    u => u.companyId === companyId &&
         u.username.toLowerCase() === username.toLowerCase() &&
         u.id !== excludeUserId
  );
};
```

Expose `isUsernameTaken` from the context. Used by the edit drawer to validate manual edits.

### 2.2 Migrate seed users with usernames

For every user in `initialUsers`, generate a username on load. Update `initialUsers` literal to include the `username` field directly — don't generate at runtime. Examples (use the same generation rule):

- John Smith → `johnsmith`
- Sarah Johnson → `sarahjohnson`
- Michael Chen → `michaelchen`
- (etc. — go through every seeded user and assign one)

### 2.3 Users table column restructure

**File: `src/pages/UsersPage.tsx`**

Replace the existing columns with the following structure. The table renders inside the existing Users tab of `UsersContactsPage`.

| Column | Header | Cell content | Width |
|---|---|---|---|
| Selection | (checkbox) | shadcn Checkbox | `w-10` |
| Name | `Name` | 3-line stack: `Full Name` (text-sm font-medium) over `@username` (text-xs text-muted-foreground) over `email` (text-xs text-muted-foreground) | flex-grow |
| Product Access | `Product Access` | Stacked small badges, one per assigned product. Excludes DataNet. Use `Badge variant="outline" size="sm"` per product name. If none: muted `—`. | `min-w-[200px]` |
| Role | `Role` | Stacked small badges, one per role. Use `ROLE_LABELS[role]`. `Badge variant="secondary"` with color tinting per role (Owner=primary, Billing=blue, License=amber, Contact=grey). | `min-w-[160px]` |
| DataNet Email | `DataNet Email` | Status badge: green `Subscribed` if user has DataNet email opted-in, grey `Unsubscribed` otherwise. The toggle for this is in the Edit drawer (not inline in table). | `w-[140px]` |
| Created On | `Created On` | Date in `MMM d, yyyy` format | `w-[140px]` |
| Status | `Status` | Pill: Active green, Invited blue, Inactive grey | `w-[100px]` |
| Actions | (empty) | 3-dot dropdown | `w-10` |

**Product Access derivation:**

```ts
const productsForUser = (user: User): string[] => {
  const userLicenses = state.licenses.filter(l => l.userId === user.id);
  const productSet = new Set<string>();
  userLicenses.forEach(l => {
    const sub = state.subscriptions.find(s => s.id === l.subscriptionId);
    const prod = sub?.products.find(p => p.id === l.productId);
    if (prod && prod.name !== 'DataNet') productSet.add(prod.name);
  });
  return Array.from(productSet);
};
```

**Role visibility per logged-in user (BR-005 / C5):**

If the current user has ONLY `registered_contact` role, the Users table filters to show only Account Owners, Billing Admins, and License Admins — never other Registered Contacts. Implement as a filter on the rendered users array.

**Remove from columns:** Any pre-existing "Last Login" column. Per user direction, only `Created On` remains.

**Actions menu:**
- `View` — opens Edit drawer in read-only mode (no Save button)
- `Edit User` — opens Edit drawer in editable mode
- `Change Roles` — REMOVED (roles are edited within the main Edit drawer now)
- `Proxy as User` — only when `can('users.impersonate')` AND target user has only `registered_contact` role for License Admin (Account Owner can impersonate anyone)
- `Activate` — when status is `inactive`
- `Deactivate` — when status is `active` or `invited`. Disabled when target is the last active Account Owner (tooltip: "Cannot deactivate the last Account Owner.")

The "Add User" button stays at the top of the table. Visible when `can('users.add')`. Opens the same Edit drawer with empty state.

### 2.4 User Edit drawer (replaces existing Add/Edit/View dialogs)

**File: `src/pages/UsersPage.tsx`** (or extract into its own file if cleaner: `src/components/users/UserEditDrawer.tsx`)

Replace ALL existing user dialogs (Add, View, Edit, Change Roles) with a single side-drawer component used for all three modes. Use shadcn `Sheet` from the right, `className="w-full sm:max-w-md flex flex-col"`.

**Modes:**
- `add` — empty form, "Create User" button
- `edit` — pre-filled, "Save" button
- `view` — read-only, no Save button, no editable inputs (just display values)

**Header:**
- Title: "User Details" (matches the screenshot)
- Close X in the corner

**Body — sections in this exact order, each with `text-sm font-semibold` section heading:**

#### Section A — Personal Information

Two-column grid (`grid-cols-2 gap-3`):
- First Name (required, text input)
- Last Name (required, text input)

Then full-width:
- Username (text input). Auto-populated as user types First/Last Name using `generateUsername`. User can override. On blur, validate via `isUsernameTaken`. If duplicate, show error text below the field: "Username already exists." Disable Save while validation fails.
- Email Address (required, type="email")
- Phone Number (optional)

#### Section B — Account info (read-only display)

Two columns:
- Created on: `MMM d, yyyy`
- Last active: `MMM d, yyyy HH:mm` (or `—` if user has never logged in)

Style: `text-xs text-muted-foreground` for labels, `text-sm` for values.

#### Section C — Assign Role

Renders a 2×2 grid of checkbox rows. Each row: shadcn Checkbox + ROLE_LABELS[role].

Role visibility logic (Change 1.6):
- If logged-in user has `account_owner`: show all 4 roles, but Account Owner checkbox is `disabled` with tooltip "Ownership transfer coming soon."
- If logged-in user has `license_admin` (and not `account_owner`): show only Registered Contact checkbox. Hide the others.

The currently-being-edited user's roles initialize the checkbox states. When editing yourself: cannot uncheck Account Owner if you're the last active Owner.

Validation: at least one role must be checked.

#### Section D — Subscriptions & Products

For each active subscription the company has, render a sub-section:

```
Subscription A
☐ NumberCruncher Desktop
☐ NumberCruncher Web
☐ QuickView Desktop
```

Each product is a checkbox. Excludes DataNet entirely from this list (BR-024/C8 — DataNet is auto-included for all active users, controlled elsewhere).

Pre-fill: checkbox is checked if the user currently has a license for that product in that subscription.

The "Assign Licence" master toggle that exists in the screenshot is REMOVED. Save handles assignment based on individual checkboxes.

If a product has no available seats (i.e., `licenseCount === assigned count` and this user doesn't currently have a license for it), the checkbox is disabled with tooltip: "No available seats for this product. Add seats in Manage Licenses." Showing the count helps: append `(0 available)`.

#### Section E — DataNet Email

A single switch row:
- Label: "Receive DataNet email updates"
- Sub-line: "Monthly industry data and alerts will be sent to the user's email address." (text-xs muted)
- Switch state from `user.dataNetEmailOptIn`. Default true for newly added users.

Add the field to the User interface:
```ts
dataNetEmailOptIn: boolean;  // default true
```

Migrate seed users — set true for everyone except inactive ones.

#### Section F — Status

A single switch row:
- Label: "Active"
- Sub-line: "Inactive users cannot log in and lose all license assignments." (text-xs muted)
- Switch state from `user.status === 'active'`.

For "invited" users (haven't logged in yet): switch defaults to enabled BUT the UI shows their status as Invited in the table. Once they first log in, status flips to active. (Invite-to-active flow — see Change 4.)

Toggling switch OFF: if user is the last active Account Owner, show error toast and don't allow. Otherwise, deactivate. Deactivation also unassigns all the user's licenses (existing behavior).

#### REMOVED sections (per user spec)
- "Send Invite to email" toggle — removed
- "Assign Licence" master toggle — removed
- "Send change password request" button — removed entirely

#### Footer

- Cancel button (closes drawer, discards changes)
- Save button — disabled while validation fails or while no changes have been made
  - In `add` mode, label is "Create User"
  - In `edit` mode, label is "Save"
  - In `view` mode, footer is hidden entirely

On Save:
1. Validate (first/last name not empty, email format, username not duplicate, at least one role checked)
2. Either call `addUser({...})` or `updateUser(id, {...})`
3. Diff the product checkboxes against existing licenses for this user. For each newly-checked product: call `assignLicense(userId, subscriptionId, productId)`. For each newly-unchecked: call `unassignLicense(licenseId)`.
4. Toast success: "User created" or "User updated"
5. Close drawer

### 2.5 Contacts table

**File: `src/pages/ContactsPage.tsx`**

Mirror the same column structure as Users:

| Column | Header | Cell content |
|---|---|---|
| Selection | (checkbox) | |
| Name | `Name` | 3-line stack: Full Name / `@username` / email — same as Users |
| Product Access | `Product Access` | Stacked badges from licenses (same logic) |
| Type | `Type` | Existing contact type field (Billing/Support/etc.) |
| DataNet Email | `DataNet Email` | Same badge as Users |
| Created On | `Created On` | |
| Status | `Status` | |
| Actions | | 3-dot |

If contacts in the current model don't have `username` or `dataNetEmailOptIn`, add them with the same auto-generation logic on first load.

---

## Change 3 — Read-only mode (Pending Payment)

### 3.1 Derived state

In `AppContext.tsx`, add:

```ts
const isReadOnlyMode = useCallback((): boolean => {
  const companyId = state.currentCompany?.id;
  if (!companyId) return false;
  // Read-only when company has at least one Pending Payment subscription
  const subs = state.subscriptions.filter(s => s.companyId === companyId);
  return subs.some(s => s.status === 'pending_payment');
}, [state.subscriptions, state.currentCompany]);
```

Expose `isReadOnlyMode` from context.

### 3.2 Banner component

Create `src/components/layout/ReadOnlyBanner.tsx`:

```tsx
export function ReadOnlyBanner() {
  const { isReadOnlyMode, getCompanyInvoices } = useApp();
  const navigate = useNavigate();
  if (!isReadOnlyMode()) return null;

  const invoices = getCompanyInvoices();
  const pendingInvoice = invoices.find(i => i.status === 'awaiting_payment');

  return (
    <div className="border-b border-warning/30 bg-warning/10 px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-warning" />
          <div>
            <p className="text-sm font-medium">Your subscription is pending payment.</p>
            <p className="text-xs text-muted-foreground">Pay your invoice to unlock full access.</p>
          </div>
        </div>
        {pendingInvoice && (
          <Button size="sm" onClick={() => navigate('/pay', {
            state: { source: 'invoice', invoiceId: pendingInvoice.id, /* ... */ },
          })}>
            Pay {formatCurrency(pendingInvoice.totalAmount)}
          </Button>
        )}
      </div>
    </div>
  );
}
```

Render the banner in `MainLayout.tsx` between the Header and the PageHeader.

### 3.3 Disable CRUD across the system

Add a small helper hook:

```ts
export const useReadOnlyGuard = () => {
  const { isReadOnlyMode } = useApp();
  const readOnly = isReadOnlyMode();
  const guardClick = (fn: () => void) => {
    if (readOnly) {
      toast({
        title: 'Action unavailable',
        description: 'Pay your pending invoice to unlock this feature.',
        variant: 'destructive',
      });
      return;
    }
    fn();
  };
  return { readOnly, guardClick };
};
```

**Apply in these places** (every CRUD button should be disabled with a tooltip when `readOnly` is true):

- `UsersPage`: Add User button, Edit/Deactivate menu items, Save in Edit drawer
- `ContactsPage`: same
- `SubscriptionsPage`: Manage Licenses buttons, Renewal payment-method picker (read-only), pencil edit on Billing Details, rename subscription pencil
- `QuotesPage`: Request Quote / New Quote button, Accept / Decline / Regenerate menu items
- `BillingPage`: NOTHING is disabled here (paying invoices is the EXCEPTION — must stay enabled)
- `AdminPage`: all editing disabled

**Explicitly NOT disabled** (these stay enabled in read-only mode):
- Paying an invoice (anywhere it appears)
- Adding/removing/editing payment methods (`/payment-methods`)
- Creating a support ticket (`/support`)
- Editing your own profile (`/profile`)
- Viewing any page — only writes are blocked
- Logging out

For buttons that should be disabled, apply `disabled={readOnly}` and wrap in a `Tooltip` showing "Pay your pending invoice to unlock this feature." For 3-dot menu items, render them with `disabled` prop and same tooltip.

---

## Change 4 — Invite-to-active flow

### 4.1 New user status flow

In `AppContext.tsx`:
- New user added via `addUser`: `status: 'invited'` (regardless of any old behavior)
- First successful login by that user: flip to `status: 'active'` and set `lastLoginAt`

Update the `login` function so when an existing user logs in with status `invited`, transition them to `active` before returning.

### 4.2 Visual indication

In the Users table, "Invited" status renders as a blue badge with `Clock` icon. In the Edit drawer's Status section, an invited user's switch is ON (they're invited and pending first login) but a sub-text reads: "User has been invited and will become Active on first login."

### 4.3 No "Send Invite" toggle

The toggle that previously controlled whether an invite email was sent is GONE. All newly added users are treated as invited automatically. No user-facing checkbox for this.

---

## Change 5 — Pay on Receipt at Checkout

### 5.1 Show Pay on Receipt in Checkout payment picker

Currently, the Checkout page may only show Pay Immediately. Per BR-021 and BR-042, the picker should show all payment methods enabled for the firm.

In `CheckoutPage.tsx`, the payment method picker uses `getAvailablePaymentMethods()`. That function (per a previous prompt) returns either `[pay_immediately, pay_on_receipt]` or `[pay_immediately, pay_on_terms]` based on company config.

Confirm Checkout displays exactly those — no hiding. For a fresh signup, the company's `companyConfigs` default is `{paymentEligibility: 'pay_on_receipt', payOnTermsEnabled: false}`, so the picker shows Pay Immediately + Pay on Receipt.

### 5.2 Pay on Receipt submission behavior

In `CheckoutPage.tsx`'s submit handler:

- If `paymentMethod === 'pay_immediately'` → route to `/pay` (existing behavior)
- If `paymentMethod === 'pay_on_receipt'`:
  - Call `checkoutPurchase({ lineItems, paymentMethod: 'pay_on_receipt' })`
  - `checkoutPurchase` must:
    - Create the Subscription with `status: 'pending_payment'`
    - Create the Invoice with `status: 'awaiting_payment'`, `balance = totalAmount`
    - Do NOT auto-assign any licenses (the user must explicitly assign — per E3)
  - Toast: "Invoice generated. Pay to activate your subscription."
  - Navigate to `/subscriptions`
- If `paymentMethod === 'pay_on_terms'`:
  - Call `checkoutPurchase({ lineItems, paymentMethod: 'pay_on_terms' })`
  - Subscription `status: 'active'`, Invoice `status: 'payment_terms_applied'`, no license auto-assign
  - Toast: "Subscription activated under approved payment terms."
  - Navigate to `/subscriptions`

### 5.3 Update `checkoutPurchase` in AppContext

This change has several pieces; verify and update each:

- Subscription status: `pending_payment` if pay_on_receipt; `active` if pay_immediately or pay_on_terms
- Invoice status: `paid` if pay_immediately; `awaiting_payment` if pay_on_receipt; `payment_terms_applied` if pay_on_terms
- `activatesSubscription: paymentMethod === 'pay_on_receipt'` (when this invoice is paid, the linked Pending Payment subscription becomes Active)
- License auto-assignment: REMOVE the auto-assignment block entirely. New behavior: NO licenses are auto-created at purchase regardless of payment method. The Account Owner must go to Manage Licenses or User Edit and assign explicitly.

The existing `markInvoicePaid` function already activates pending subscriptions linked via `activatesSubscription`. Verify it works without changes.

### 5.4 First-time customer gate adjustment

When a subscription is Pending Payment, `isFirstTimeCustomer` still returns true (no paid invoice). The sidebar gating logic from a previous prompt continues to work — they see Subscriptions + Support only until they pay.

EXCEPT: per the user's new direction, all menus must be VISIBLE during pending payment but most CRUD is disabled. This conflicts with the existing gate.

Resolution: **the first-time gate is replaced by read-only mode** for the Pending Payment case. Update Sidebar's gate logic:

```ts
if (isFirstTimeCustomer()) {
  if (isReadOnlyMode()) {
    // Pay-on-Receipt customer with invoice pending: show all menus, but CRUD is disabled across pages
    // (do NOT filter visibleItems)
  } else if (hasSentQuote() && !hasDeclinedQuote()) {
    visibleItems = visibleItems.filter(i => i.path === '/quotes' || i.path === '/support');
  } else if (hasSentQuote() && hasDeclinedQuote()) {
    visibleItems = visibleItems.filter(
      i => i.path === '/quotes' || i.path === '/support' || i.path === '/subscriptions'
    );
  } else {
    visibleItems = visibleItems.filter(i => i.path === '/subscriptions' || i.path === '/support');
  }
}
```

So: Pay-on-Receipt path → full sidebar + read-only mode + banner. Quote-in-flight or pre-anything → restricted sidebar (existing behavior).

---

## Change 6 — Multiple subscriptions support

### 6.1 Seed a second subscription on ABC Accounting

In `initialSubscriptions`, add a second subscription for ABC Accounting. This represents a back-office-created additional subscription that ABC didn't self-purchase. Example:

```ts
{
  id: 'sub-abc-addon',
  companyId: 'company-1',
  name: 'NumberCruncher Web — Team Expansion',
  planType: 'Annual',
  billingFrequency: 'annual',
  status: 'active',
  startDate: '2026-03-01T00:00:00Z',
  renewalDate: '2027-03-01T00:00:00Z',
  baseFee: 0,
  perSeatCost: 349,
  products: [
    {
      id: 'prod-abc-addon-web',
      name: 'NumberCruncher Web',
      licenseCount: 5,
      purchasedLicenseCount: 5,
      pricePerLicense: 349,
      status: 'active',
    },
  ],
}
```

Also add 2 paid invoices for it across past dates, and don't auto-include DataNet in this one (it's a top-up subscription, not a primary plan).

### 6.2 Subscription selector pills already render multiple

The pill row in `SubscriptionsPage.tsx` already renders one pill per Annual Plan subscription. Verify it now shows TWO pills for ABC Accounting and ONE for XYZ Consulting. Each pill independently switches the page's selected subscription.

### 6.3 Block customer from self-purchasing a second subscription

The "New Quote" button on Quotes page (currently shown when no active subscription exists) — modify:

- If `getCompanySubscriptions().some(s => s.status === 'active')` → show "Request Quote" (existing behavior)
- Else → show "New Quote" → routes to `/checkout`

This already exists from a previous prompt. Just verify it works when MULTIPLE subscriptions exist (it should always treat "any active" as enough to gate it).

Add a comment in the file explaining why: "Customers cannot purchase additional subscriptions from the portal. Back-office tools can add subscriptions, which the portal then displays. To add or modify products mid-cycle, customers request a quote."

### 6.4 BillingPage scoping

The `BillingPage` already filters invoices by company. Verify the invoice table now shows invoices for BOTH ABC subscriptions correctly. If invoice rows previously had a `subscriptionName` field, surface it in the table's Description (e.g., "Annual Plan — Renewal" vs "Team Expansion — Initial Purchase").

---

## Change 7 — License types display

### 7.1 Add `licenseType` to License model

In AppContext:

```ts
export type LicenseType = 'paid' | 'it_assistant' | 'trial';

export interface License {
  // ... existing fields
  licenseType?: LicenseType; // default 'paid'
  trialExpiresAt?: string;   // only for type === 'trial'
}
```

Update seed licenses: most are `paid`. Add 1-2 `trial` licenses and 1 `it_assistant` license to ABC Accounting's seed data so the demo shows all three types.

### 7.2 Badge display

Create a helper:

```ts
const LICENSE_TYPE_BADGE: Record<LicenseType, { label: string; className: string }> = {
  paid: { label: 'User License', className: 'bg-success/10 text-success border-success/20' },
  it_assistant: { label: 'IT Assistant', className: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  trial: { label: 'Trial', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
};
```

Apply this badge wherever a license is shown to the user:
- **Users table Product Access column**: each product badge in the stack now becomes `{ProductName} ({Type})` — but to avoid clutter, only append type when not 'paid'. So `NumberCruncher Web` stays as is for paid, but `QuickView Desktop (Trial)` for trial.
- **User Edit drawer Subscriptions & Products section**: next to each checked product, show the badge if not 'paid'.
- **Subscriptions page Products card**: the product tile shows a small license-type badge cluster summarizing distribution: "12 User · 1 Trial · 1 IT Assistant"
- **Downloads page**: for products where the user holds a non-paid license, the badge appears next to the product name.

### 7.3 IT Assistant session timeout — out of scope

Acknowledge BR-090/BR-120 in a code comment near the IT Assistant handling: "Per BR-090, IT Assistant license sessions auto-logout after 10 minutes. Out of scope for this prototype — backend would enforce."

---

## Change 8 — PO number capture

### 8.1 Accept Quote drawer

In the existing AcceptQuoteDrawer (in `QuoteDialogs.tsx`), add a field above the payment method picker:

- Label: "PO Number (optional)"
- Sub-line: "Provide a purchase order reference if required by your company."
- Text input

On submit (`acceptQuote(...)`), pass the PO number. Add `poNumber?: string` to the `Quote` and `Invoice` interfaces. The generated invoice should carry the PO number.

### 8.2 Invoice display

In the Invoices table, when an invoice has a `poNumber`, append it to the Description column as a second line: `PO #{poNumber}` (text-xs text-muted-foreground).

In the Invoice detail view (View Invoice modal/drawer), show "PO Number: {poNumber}" prominently in the header.

NOT added: PO number on Checkout payment. Per user's C12 decision, "keep only on accept quote but add in invoice."

---

## What NOT to touch in this prompt

- Leimberg branding and color tokens
- The shadcn UI primitives
- The Payment Methods management page (works as built)
- The universal `/pay` page (works as built; just verify Pay-on-Receipt invoices route to it correctly)
- The DataNet page (works as built)
- The renewal drawer (already supports per-product seat steppers)
- Discount field on invoices (out of scope — admin tool)
- Account ownership transfer (deferred to v7b)
- License decrease specific business logic in the renewal drawer (already partially built; revisit in v7b if needed)
- SSO / Keycloak / HaloPSA / secure CDN integrations (mock everything, no real backend)

---

## Acceptance criteria

When you're done, all of these must be true:

1. `npm run dev` and `npm run build` complete without errors.
2. All four roles use new IDs (`account_owner`, `billing_admin`, `license_admin`, `registered_contact`). No old role IDs (`owner`, `billing`, `admin`, `standard`) appear anywhere in code or seed data.
3. ROLE_LABELS is used everywhere a role is rendered to the user (no raw enum strings visible).
4. `pageAccess` enforces the new matrix. Logging in as a Registered Contact and trying to navigate to `/billing` or `/invoices` is blocked with "Access Denied."
5. The Header demo dropdown (in `?demo=1`) shows the four new role names with their new IDs.
6. Username field exists on every seeded user (auto-generated with the new format). The User Edit drawer auto-populates username as the user types First/Last Name.
7. Manual username editing validates uniqueness within the same company. Duplicate shows inline error.
8. Users table has columns: Selection | Name (3-line) | Product Access | Role | DataNet Email | Created On | Status | Actions. No "Last Login" column.
9. The Name column renders as 3-line stack: Full Name / `@username` / email.
10. Product Access column shows stacked badges per product (excluding DataNet). License type appended in parens for non-paid licenses.
11. Registered Contacts viewing the Users page see only Owner/Billing/License admins, not other Registered Contacts.
12. User Edit drawer matches the screenshot layout: Personal Information / Created+Last Active / Assign Role / Subscriptions & Products / DataNet Email switch / Status switch. NO Send Invite, NO Assign Licence toggle, NO Send Change Password button.
13. Edit drawer Save button updates user fields AND diffs product checkboxes to assign/unassign licenses atomically.
14. License Admin editing another user sees ONLY the Registered Contact checkbox; Owner editing sees all 4 (Account Owner disabled with tooltip).
15. A pending-payment company shows a persistent banner across all pages: "Your subscription is pending payment. Pay invoice to unlock full access." Banner includes a Pay button.
16. While in read-only mode, every CRUD action (add user, edit user, change seats, accept quote, etc.) is disabled with a tooltip. Paying the invoice, managing payment methods, editing own profile, and creating support tickets stay enabled.
17. A brand-new signup user can choose Pay on Receipt on Checkout. Doing so creates: Subscription with `pending_payment` status, Invoice with `awaiting_payment` status, NO auto-assigned licenses. Lands on `/subscriptions` and sees the read-only banner.
18. After paying the pending invoice, the subscription flips to `active`, the banner disappears, and full CRUD becomes available.
19. A newly added user has status `invited` and "Send Invite" toggle/text is GONE. On their first successful login, status flips to `active`.
20. Deactivating the last active Account Owner is blocked with a toast/error.
21. Multiple subscriptions: ABC Accounting shows TWO subscription pills on Subscriptions page. Each switches between independent product/invoice/quote views.
22. New Quote button on Quotes page reads "Request Quote" when an active subscription exists (regardless of count).
23. License type badges visible on Users Product Access column, User Edit drawer, Subscriptions Products card, and Downloads page wherever a non-paid license is held.
24. Accept Quote drawer has an optional PO Number field. Submitted invoices display the PO number in the Invoices table Description column second line and in the Invoice detail view.
25. No console errors on any page navigation. No accessibility violations on the new drawer.

---

## Manual demo flow

1. Log in as `john.smith@abcaccounting.com`. Sidebar shows full menu. Subscriptions page now shows TWO pills (Annual Plan + Team Expansion).
2. Click Users & Contacts. Table renders new columns including 3-line name stack and product badges.
3. Open John's profile via the 3-dot menu → Edit. Drawer opens matching the screenshot layout. No Send Invite, no Assign Licence toggle, no Send Change Password button.
4. Type a new First Name. Username auto-updates. Change manually to a duplicate username → see inline error.
5. Toggle a product checkbox under Subscriptions A. Save. Verify the user's licenses updated.
6. Log out and sign up as a brand-new user. Land on Checkout. Choose Pay on Receipt. Land on Subscriptions, see the pending-payment banner.
7. Navigate to any other page. Banner persists. Click Add User on Users page — button is disabled with tooltip.
8. Click the Pay button in the banner. Land on `/pay`. Pay successfully. Banner disappears. Subscription activates. Sidebar/CRUD fully unlocked.
9. Go to Quotes → click Accept Quote on any active quote → drawer opens → PO Number field present.
10. Demo as a Registered Contact (via `?demo=1`). Navigate to `/invoices` → access denied. Navigate to Users → table shows only admins. Most CRUD buttons hidden or disabled.

---

## Reporting back

At the end of your run, summarize:

1. Every file modified and every file created.
2. The list of every place where old role IDs (`owner`, `billing`, `admin`, `standard`) appeared, and the new ID you replaced each with.
3. Confirmation that ROLE_LABELS is used everywhere a role displays.
4. Confirmation that the four removed UI elements (Send Invite, Assign Licence toggle, Change Roles dialog, Send Change Password) are fully gone.
5. Whether the read-only banner appears on EVERY page (not just Subscriptions) when triggered.
6. List of every CRUD location guarded by `readOnly` and tooltipped.
7. Confirmation that `checkoutPurchase` no longer auto-assigns licenses.
8. Confirmation that multiple subscriptions render correctly on Subscriptions page.
9. Any deviations from this spec, including any business rules you couldn't reconcile.
10. The output of `npm run build`.

Do not commit. I will review.
