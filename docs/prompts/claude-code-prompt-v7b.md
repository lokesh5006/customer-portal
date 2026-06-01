# Claude Code Prompt v7b — Subscription Status Escalation + Suspended State + Downloads Gating + Decline Reason + Trial Expiry Banner

Copy everything below this line into Claude Code in VS Code. Run it on the project root after v7a has been verified working.

---

## Context

This is the second batch of the v7 series. v7a rewired the role system, redesigned the User Edit drawer, added read-only mode for pending-payment subscriptions, and enabled multi-subscription viewing. v7b completes the subscription lifecycle: what happens after expiry when invoices go unpaid, plus a few small polish items from the business rules document.

Before you write any code, read these files in this exact order:

1. `src/contexts/AppContext.tsx` — `Subscription` interface, `isReadOnlyMode`, `isFirstTimeCustomer`, `Invoice` status union, `License` interface with `licenseType` and `trialExpiresAt`
2. `src/components/layout/ReadOnlyBanner.tsx` — banner architecture from v7a (reuse, don't replace)
3. `src/components/layout/MainLayout.tsx` — where the banner is mounted
4. `src/hooks/useReadOnlyGuard.ts` — guard pattern from v7a
5. `src/pages/DownloadsPage.tsx` — current gating, needs additional suspended-state handling
6. `src/components/subscriptions/QuoteDialogs.tsx` — `DeclineQuoteDialog`
7. `src/pages/SubscriptionsPage.tsx` — Annual Plan summary card status badge
8. `src/pages/Dashboard.tsx` — alert banner area
9. `src/pages/AdminPage.tsx` — for the demo-only "force suspend" button (similar pattern to "Force Generate Renewal Invoices" from earlier)

Do NOT start coding until you have read those files.

---

## Final Decisions (binding for this prompt)

| Topic | Decision |
|---|---|
| Suspended state trigger | Subscription renewal date passed AND renewal invoice not paid AND company is NOT on Pay-on-Terms |
| Pay-on-Terms exception | These subscriptions never go to Suspended automatically — terms-based access continues per agreement |
| Suspended state UI | Reuse `ReadOnlyBanner` component with `variant="suspended"` (different text + destructive color) + Downloads gating |
| Suspended Downloads behavior | Cannot download installers. Show disabled buttons with tooltip. Web products' "Open" also disabled. "More Info" stays enabled. |
| Suspended other CRUD | Same read-only mode as pending-payment (banner from v7a logic extends to suspended) |
| Decline Quote reason | Optional free-text textarea, max 500 chars |
| Owner without license on Downloads | Show "Licensed" badge uniformly — no special "Owner Access" badge |
| Trial license expiry banner | Per-user, shown when current user holds at least one Trial license. Banner says "Your Trial license for {Product} expires on {Date}. Contact your administrator to convert to a paid license." Dismissible per session. |

---

## Change 1 — Subscription status escalation

### 1.1 Extend Subscription status type

**File: `src/contexts/AppContext.tsx`**

The `Subscription.status` type likely already includes most of these. Verify and ensure the union is:

```ts
status: 'active' | 'pending_payment' | 'suspended' | 'expired' | 'overdue' | 'cancelled';
```

The states actively used after this change:
- `active` — paid + current
- `pending_payment` — first-time signup paid via Pay on Receipt, waiting for first invoice payment (read-only mode triggers)
- `suspended` — renewal date passed + renewal invoice unpaid + not on Pay-on-Terms (read-only mode triggers AND Downloads blocked)
- `expired` — used only when explicitly cancelled by backend; not auto-derived in the prototype

`overdue` and `cancelled` exist on the union but the portal won't transition into them automatically — they're back-office states. Don't remove them from the type (other code may reference).

### 1.2 Auto-escalation logic

In `AppProvider`, alongside the existing `useEffect` that generates renewal invoices, add a sibling effect that runs once on mount and transitions any subscription that should be suspended:

```ts
useEffect(() => {
  const today = new Date();
  setState(prev => {
    let mutated = false;
    const nextSubs = prev.subscriptions.map(sub => {
      if (sub.status !== 'active') return sub;
      const renewal = new Date(sub.renewalDate);
      if (renewal > today) return sub;  // not yet expired

      // Pay-on-Terms companies never auto-suspend
      const cfg = prev.companyConfigs.find(c => c.companyId === sub.companyId);
      if (cfg?.payOnTermsEnabled) return sub;

      // Renewal invoice exists and is paid? then we shouldn't be in this branch
      // (the renewal flow would have moved renewalDate forward)
      const renewalInvoice = prev.invoices.find(
        i => i.subscriptionId === sub.id && i.source === 'renewal' &&
             i.status !== 'paid'
      );
      if (!renewalInvoice) return sub;  // no unpaid renewal invoice → stay active

      // Past expiry + unpaid renewal invoice + not on Terms → suspend
      mutated = true;
      return { ...sub, status: 'suspended' as const };
    });
    if (!mutated) return prev;
    return { ...prev, subscriptions: nextSubs };
  });
}, []);  // run once on provider mount
```

This sits next to the renewal-invoice generator from a previous prompt. Don't merge them — keep concerns separate.

### 1.3 Auto-reactivate on payment

When a suspended subscription's renewal invoice gets paid, the subscription should flip back to `active` AND its `renewalDate` should extend by 365 days.

This logic likely already exists for `pending_payment → active` in `markInvoicePaid` (via the `activatesSubscription` flag on the invoice). Extend it: also handle the suspended → active case for renewal invoices.

In `markInvoicePaid`, after marking the invoice paid, find the linked subscription:

```ts
const linkedSub = prev.subscriptions.find(s => s.id === paidInvoice.subscriptionId);
if (linkedSub) {
  if (linkedSub.status === 'pending_payment' && paidInvoice.activatesSubscription) {
    // existing: pending → active
    nextSub = { ...linkedSub, status: 'active' };
  } else if (linkedSub.status === 'suspended' && paidInvoice.source === 'renewal') {
    // new: suspended → active + extend renewalDate by 365 days
    const newRenewal = new Date(linkedSub.renewalDate);
    newRenewal.setDate(newRenewal.getDate() + 365);
    nextSub = { ...linkedSub, status: 'active', renewalDate: newRenewal.toISOString() };
  }
}
```

The same logic should apply to the `/pay` page's renewal source handler. Audit `PaymentPage.tsx` to confirm — when source is `renewal`, after the invoice is marked paid, the suspended subscription should reactivate.

### 1.4 New derived selector

In AppContext, add:

```ts
const isSuspendedMode = useCallback((): boolean => {
  const companyId = state.currentCompany?.id;
  if (!companyId) return false;
  return state.subscriptions.some(
    s => s.companyId === companyId && s.status === 'suspended'
  );
}, [state.subscriptions, state.currentCompany]);
```

Expose from context. Used by Downloads gating and the banner.

### 1.5 Extend `isReadOnlyMode` to include suspended

`isReadOnlyMode` from v7a triggers on `pending_payment`. Extend it to also trigger on `suspended`:

```ts
const isReadOnlyMode = useCallback((): boolean => {
  const companyId = state.currentCompany?.id;
  if (!companyId) return false;
  const subs = state.subscriptions.filter(s => s.companyId === companyId);
  return subs.some(s => s.status === 'pending_payment' || s.status === 'suspended');
}, [state.subscriptions, state.currentCompany]);
```

This means all the CRUD guards from v7a automatically apply to suspended companies. No new guarding work needed across pages — the guard is centralized.

### 1.6 Admin Tool demo affordance

Per the pattern established by "Force Generate Renewal Invoices" in v6a, add a demo-only button on the Admin Tool page (visible only in `?demo=1` mode):

- Button label: "Force Subscription Suspension"
- Behavior: Sets the current company's first active subscription to `status: 'suspended'`, and ensures it has an unpaid renewal invoice (creating one if missing).
- Toast: "Subscription suspended for demo purposes."

Also add a paired:
- Button label: "Restore Active Subscription"
- Behavior: Sets any suspended subscription back to `active`, extends `renewalDate` by 365 days.
- Toast: "Subscription restored."

These are testing affordances. They don't appear without `?demo=1` so customers never see them.

---

## Change 2 — Suspended state banner

### 2.1 Extend ReadOnlyBanner with variants

**File: `src/components/layout/ReadOnlyBanner.tsx`**

Currently the banner is hard-coded to "Your subscription is pending payment." Generalize it:

```tsx
type BannerVariant = 'pending_payment' | 'suspended';

const VARIANT_CONFIG: Record<BannerVariant, {
  title: string;
  description: string;
  bgClass: string;
  borderClass: string;
  iconClass: string;
}> = {
  pending_payment: {
    title: 'Your subscription is pending payment.',
    description: 'Pay your invoice to unlock full access.',
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/30',
    iconClass: 'text-warning',
  },
  suspended: {
    title: 'Your subscription is suspended.',
    description: 'Pay your renewal invoice to restore product access and unlock full features.',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/30',
    iconClass: 'text-destructive',
  },
};

export function ReadOnlyBanner() {
  const { isReadOnlyMode, isSuspendedMode, getCompanyInvoices } = useApp();
  const navigate = useNavigate();
  if (!isReadOnlyMode()) return null;

  const variant: BannerVariant = isSuspendedMode() ? 'suspended' : 'pending_payment';
  const config = VARIANT_CONFIG[variant];

  // Find the most relevant unpaid invoice to pay
  const invoices = getCompanyInvoices();
  const targetInvoice = variant === 'suspended'
    ? invoices.find(i => i.source === 'renewal' && i.status !== 'paid')
    : invoices.find(i => i.status === 'awaiting_payment');

  return (
    <div className={`border-b ${config.borderClass} ${config.bgClass} px-6 py-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertCircle className={`h-5 w-5 ${config.iconClass}`} />
          <div>
            <p className="text-sm font-medium">{config.title}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </div>
        {targetInvoice && (
          <Button size="sm" onClick={() => navigate('/pay', {
            state: {
              source: 'invoice',
              invoiceId: targetInvoice.id,
              subtotal: targetInvoice.subtotal,
              tax: targetInvoice.tax,
              totalAmount: targetInvoice.totalAmount,
              returnTo: '/subscriptions',
            },
          })}>
            Pay {formatCurrency(targetInvoice.totalAmount)}
          </Button>
        )}
      </div>
    </div>
  );
}
```

Where `formatCurrency` is the existing helper. If it lives only in `SubscriptionsPage.tsx`, extract it to a shared location like `src/lib/format.ts`.

The banner continues to render once in MainLayout. The variant is auto-selected based on which mode is active.

---

## Change 3 — Downloads gating for Suspended state

### 3.1 Block downloads when suspended

**File: `src/pages/DownloadsPage.tsx`**

Currently the page gates by subscription (Licensed vs Not Subscribed). Add a third state: Suspended.

```ts
const { isSuspendedMode } = useApp();
const suspended = isSuspendedMode();

const buttonState = (productName: string) => {
  if (suspended) return 'suspended';
  if (isSubscribed(productName)) return 'enabled';
  return 'not_subscribed';
};
```

For each product card:

- **Enabled state**: Download / Open buttons work, "Licensed" green badge (existing behavior)
- **Not Subscribed**: Download/Open disabled with "Subscribe to download" tooltip, More Info enabled (existing)
- **Suspended** (NEW): Download/Open disabled with tooltip "Pay your renewal invoice to restore access." More Info still enabled. The "Licensed" badge changes to "Access Restricted" using `bg-destructive/10 text-destructive border-destructive/20`.

Important: a suspended company's user still sees which products they had access to (the "Licensed" → "Access Restricted" pivot), so they know what they're missing and what they'll get back after paying.

The Download button still renders so the user understands it's their product, just locked.

### 3.2 Card visual treatment

Wrap the product card with `opacity-80` when suspended (slightly muted to signal locked, but not as muted as the unsubscribed `opacity-70` state). The "Access Restricted" badge in destructive color is the primary visual signal.

---

## Change 4 — Decline Quote reason

### 4.1 Update DeclineQuoteDialog

**File: `src/components/subscriptions/QuoteDialogs.tsx`**

The `DeclineQuoteDialog` currently calls `declineQuote(quote.id)`. Update to capture a reason.

Add to the dialog:

```tsx
const [reason, setReason] = useState('');

// In the dialog body, above the Decline button:
<div className="space-y-2">
  <Label htmlFor="decline-reason">Reason (optional)</Label>
  <Textarea
    id="decline-reason"
    value={reason}
    onChange={(e) => setReason(e.target.value.slice(0, 500))}
    placeholder="Help us understand why you're declining this quote..."
    rows={3}
    maxLength={500}
  />
  <p className="text-xs text-muted-foreground">{reason.length}/500</p>
</div>
```

On submit: `declineQuote(quote.id, reason || undefined)`.

### 4.2 Update declineQuote in AppContext

```ts
declineQuote: (quoteId: string, reason?: string) => void;
```

Implementation: update the quote's status to `declined` and store the reason in a new optional field `declineReason?: string` on the `Quote` interface.

### 4.3 Surface the decline reason

In the Quotes table, when a quote has `status === 'declined'` and a `declineReason`, the 3-dot action menu gains a "View Decline Reason" item. Click → small dialog showing the reason text + "Close" button.

In the View Quote details (existing dialog/view), if `declineReason` is set, show it as a labeled section: "Decline Reason" + the text.

---

## Change 5 — Owner Access on Downloads: NO differentiation

### 5.1 Reverted from earlier discussion

Earlier prompts (C7) suggested an "Owner Access" badge for Account Owners viewing the Downloads page without a license assignment. Per the latest decision: **drop the differentiation entirely**.

In `DownloadsPage.tsx`, the licensed-check should consider the Account Owner role uniformly. The existing logic should already check whether the company has the product in any active subscription — that returns true for the Owner regardless of personal license assignment. Verify:

```ts
const isSubscribed = (productName: string): boolean => {
  const subs = getCompanySubscriptions();
  return subs.some(
    s => s.status === 'active' && s.products.some(p => p.name === productName)
  );
};
```

This is correct — it checks at the company level, not the user level. The Account Owner sees "Licensed" for every product the company owns, same as anyone with an actual license for that product.

No code change strictly required IF this is already the behavior. Verify and confirm in the reporting. If there's any user-level license check that excludes the Account Owner from seeing Licensed badges, remove it.

---

## Change 6 — Trial license expiration banner

### 6.1 Detect trial licenses for current user

In AppContext, add:

```ts
const getCurrentUserTrialLicenses = useCallback(() => {
  const userId = state.currentUser?.id;
  if (!userId) return [];
  return state.licenses
    .filter(l => l.userId === userId && l.licenseType === 'trial' && l.trialExpiresAt)
    .map(l => {
      const sub = state.subscriptions.find(s => s.id === l.subscriptionId);
      const product = sub?.products.find(p => p.id === l.productId);
      return {
        licenseId: l.id,
        productName: product?.name || 'Unknown product',
        expiresAt: l.trialExpiresAt!,
      };
    })
    .filter(t => new Date(t.expiresAt) > new Date());  // not yet expired
}, [state.licenses, state.currentUser, state.subscriptions]);
```

Expose from context.

### 6.2 Create TrialBanner component

**New file: `src/components/layout/TrialBanner.tsx`**

```tsx
import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';

const SESSION_DISMISS_KEY = 'leimberg.trialBanner.dismissed';

export function TrialBanner() {
  const { getCurrentUserTrialLicenses } = useApp();
  const [dismissed, setDismissed] = useState(
    sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'
  );

  if (dismissed) return null;
  const trials = getCurrentUserTrialLicenses();
  if (trials.length === 0) return null;

  // Find the earliest-expiring trial
  const next = trials.reduce((min, t) =>
    new Date(t.expiresAt) < new Date(min.expiresAt) ? t : min
  );
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(next.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
          <div>
            <p className="text-sm font-medium">
              Your trial for {next.productName} expires in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}.
            </p>
            <p className="text-xs text-muted-foreground">
              Contact your administrator to convert to a paid license.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

### 6.3 Mount in MainLayout

In `MainLayout.tsx`, render `<TrialBanner />` AFTER `<ReadOnlyBanner />` and BEFORE the page content. If both banners are active simultaneously (a suspended company with a trial-license user — unlikely but possible), the ReadOnly banner shows first, the Trial banner shows below.

### 6.4 Seed data: one trial license that's near expiry

Update v7a's seed addition for trial licenses. At least one should be set to expire within 14 days from "today" so the banner is visible during demo. Example:

```ts
// in initialLicenses
{
  id: 'lic-abc-trial-qv',
  userId: 'user-abc-1',  // assigned to John Smith
  subscriptionId: 'sub-1',
  productId: 'prod-qv-trial',  // QuickView trial product
  licenseType: 'trial',
  trialExpiresAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
  assignedAt: '2026-04-01T00:00:00Z',
}
```

Make sure ABC's subscription has a `prod-qv-trial` entry in its products so this license links to a real product. If your existing seed already has trial licenses from v7a, just confirm at least one has a near-future expiry.

---

## What NOT to touch

- Leimberg branding, colors, fonts
- The role system, permissions, can() helper — all from v7a, stays
- The User Edit drawer — works as built
- Multi-subscription support — works as built
- License auto-assignment — stays disabled per Option C
- Tax rate hardcoding — stays at 7%
- Account ownership transfer — still deferred
- Audit log UI — still out of scope
- IT Assistant session timeout enforcement — still backend concern
- The shadcn UI primitives

---

## Acceptance criteria

When you're done, all of these must be true:

1. `npm run dev` and `npm run build` complete without errors.
2. A subscription whose renewal date has passed AND has an unpaid renewal invoice AND whose company is NOT on Pay-on-Terms is automatically transitioned to status `suspended` on app load.
3. Pay-on-Terms companies do NOT auto-suspend even if their renewal date has passed.
4. When a company has any subscription in `suspended` state, the ReadOnlyBanner renders with destructive coloring and text "Your subscription is suspended." with a "Pay $X" button targeting the renewal invoice.
5. When a company has any subscription in `pending_payment` state (no suspended subs), the banner renders with warning coloring and "Your subscription is pending payment." text.
6. Both states trigger CRUD lockdown via the existing `isReadOnlyMode()` selector — Add User, Manage Licenses, etc. remain disabled with tooltips.
7. On the Downloads page, a suspended company sees products that were Licensed now showing "Access Restricted" badge (destructive color). Download/Open buttons are disabled with tooltip "Pay your renewal invoice to restore access." More Info button stays enabled.
8. Not-subscribed products on a suspended company's Downloads page render the same as for an active company (the suspended state doesn't worsen unsubscribed products — they're already gated).
9. Paying the renewal invoice for a suspended subscription flips it back to `active` and extends `renewalDate` by 365 days.
10. Decline Quote dialog has an optional Reason textarea (max 500 chars with counter). Submitting passes the reason to `declineQuote`.
11. Declined quotes with a reason show "View Decline Reason" in the action menu, which opens a small dialog with the reason text.
12. The Downloads page shows "Licensed" badge for all products the company has in active subscriptions, regardless of whether the Account Owner has a personal license assignment. No "Owner Access" badge exists.
13. A user holding a trial license that hasn't expired sees a yellow TrialBanner at the top of every authenticated page (below the ReadOnlyBanner if both are active). Banner shows product name + days-to-expiry.
14. Dismissing the TrialBanner via the X persists for the browser session (sessionStorage). Reopening the tab brings it back if still applicable.
15. Admin Tool (in `?demo=1`) has a "Force Subscription Suspension" button that suspends the current company's active subscription and ensures an unpaid renewal invoice exists. Paired "Restore Active Subscription" button reverses it.
16. No console errors on any page navigation. The build is clean.

---

## Manual demo flow

1. Log in as `john.smith@abcaccounting.com`. Open `?demo=1` URL. Visit Admin Tool → click "Force Subscription Suspension."
2. Toast confirms. Navigate to Dashboard → see the destructive Suspended banner.
3. Click any sidebar item — CRUD buttons disabled with tooltip.
4. Visit Downloads — products show "Access Restricted" badge with disabled Download buttons. More Info still works.
5. Click "Pay $X" in the banner → routes to /pay → complete payment.
6. Banner disappears. Subscription back to active. Downloads shows Licensed badges again. CRUD unlocked.
7. Visit Admin Tool again → click "Restore Active Subscription" (idempotent, should work even without prior suspension).
8. Visit Quotes → click 3-dot on any active quote → Decline. Optional reason textarea visible. Type a reason → submit.
9. The declined quote's 3-dot menu now shows "View Decline Reason" → opens with the reason text.
10. Log in as a user who has a trial license (per seed data). Visit any page → see the yellow Trial banner. Dismiss via X. Navigate to another page — banner stays dismissed. Close tab and reopen — banner returns.

---

## Reporting back

At the end of your run, summarize:

1. Every file modified and every file created.
2. The conditions under which auto-suspension fires, and confirmation that Pay-on-Terms companies are exempt.
3. Confirmation that paying a renewal invoice for a suspended subscription correctly extends renewalDate by 365 days and flips status to active.
4. Confirmation that `isReadOnlyMode` now covers both pending_payment and suspended.
5. Confirmation that Downloads-page gating shows three distinct states: Licensed, Not Subscribed, Access Restricted.
6. Whether `formatCurrency` was extracted to a shared location (recommended) or duplicated.
7. Any deviations from this spec.
8. The output of `npm run build`.

Do not commit. I will review.
