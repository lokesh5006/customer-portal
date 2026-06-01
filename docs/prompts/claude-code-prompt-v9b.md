# Claude Code Prompt v9b — Notifications System (Preferences Tab + Bell Feed + Auto-Generation)

Copy everything below this line into Claude Code in VS Code. Run on the project root AFTER v9a is applied and verified working.

---

## Context

v9a built the Profile Settings drawer with Profile, Password, and Payment tabs, implemented dark mode, and replaced the avatar dropdown. The Notifications tab in v9a is a placeholder.

v9b builds the full notification system: a catalog of 22 notification types grouped into 6 categories, per-user Email + In-App toggle preferences, a live notification feed accessed from the bell icon, and auto-generation hooks that create notifications when relevant events occur.

Before you write any code, read these files in this exact order:

1. `src/contexts/AppContext.tsx` — read AppState shape, all event-emitting methods (`checkoutPurchase`, `markInvoicePaid`, `acceptQuote`, `declineQuote`, `addUser`, `deactivateUser`, `addPaymentMethod`, `setPrimaryPaymentMethod`, `requestLicenseChange`, the auto-renewal generator, the auto-suspension escalator)
2. `src/components/profile/ProfileSettingsDrawer.tsx` (from v9a) — the Notifications tab placeholder lives here
3. `src/components/layout/Header.tsx` — the bell icon button
4. `src/components/ui/popover.tsx` — used by the bell feed dropdown
5. `src/contexts/AppContext.tsx` — `User`, `currentUser`, role helpers

Do NOT start coding until you have read those files.

---

## Final Decisions (binding for v9b)

| Topic | Decision |
|---|---|
| Notification catalog | 22 types across 6 categories (full list below) |
| Per-toggle channels | Each notification has independent Email and In-App toggles |
| Default preferences | All notifications default ON for both channels except security and product-update which default ON for Email and In-App both. (Effectively: all default ON.) |
| Role filtering | Notification types render in preferences only when relevant to the user's role. Billing notifications hidden for `registered_contact`. Admin notifications hidden for non-admins. Trial-license notifications hidden for users with no trial license. |
| Persistence of preferences | In-memory on the user record (`User.notificationPrefs: Record<NotificationType, ChannelPrefs>`). |
| Notification storage | An in-memory array on AppState. Each notification belongs to one userId. |
| Bell display | Popover panel anchored to the bell button. Shows up to 10 most recent unread + recent read. Red dot when unread > 0. |
| Mark-as-read | Click on a notification → marks it read AND navigates to its link if any. Plus a "Mark all as read" link at the top of the panel. |
| Auto-generation | New context helper `notify(...)`. Called from every event-emitting context method. v9b wires the common ones; the rest can be added incrementally. |

---

## Change 1 — Data model

### 1.1 Notification type catalog

Add to `src/contexts/AppContext.tsx`:

```ts
export type NotificationType =
  // Billing & Payment
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.approaching_due'
  | 'invoice.overdue'
  // Subscription
  | 'subscription.renewal_upcoming'
  | 'subscription.renewed'
  | 'subscription.suspended'
  | 'subscription.reactivated'
  // Quote
  | 'quote.received'
  | 'quote.expiring_soon'
  | 'quote.accepted'
  | 'quote.declined'
  // License & User
  | 'license.assigned_to_me'
  | 'license.unassigned_from_me'
  | 'license.trial_expiring'
  | 'user.invited'
  | 'user.accepted_invitation'
  // Product
  | 'product.new_version'
  | 'datanet.monthly_update'
  | 'maintenance.scheduled'
  // Account
  | 'account.role_changed'
  | 'account.password_changed'
  | 'account.new_login';

export interface NotificationChannelPrefs {
  email: boolean;
  inApp: boolean;
}

export const NOTIFICATION_CATALOG: Array<{
  type: NotificationType;
  category: 'billing' | 'subscription' | 'quote' | 'license_user' | 'product' | 'account';
  label: string;
  description: string;
  rolesAllowed: Role[];  // empty array means all roles
}> = [
  // Billing & Payment
  { type: 'invoice.created', category: 'billing', label: 'Invoice created', description: 'A new invoice is ready for your review.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'invoice.paid', category: 'billing', label: 'Payment received', description: 'Confirmation when a payment is processed successfully.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'invoice.payment_failed', category: 'billing', label: 'Payment failed', description: 'Your payment did not go through.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'invoice.approaching_due', category: 'billing', label: 'Invoice approaching due date', description: 'Reminder three days before an invoice is due.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'invoice.overdue', category: 'billing', label: 'Invoice overdue', description: 'Notification when an invoice passes its due date.', rolesAllowed: ['account_owner', 'billing_admin'] },
  // Subscription
  { type: 'subscription.renewal_upcoming', category: 'subscription', label: 'Subscription renewal coming', description: 'Heads-up 30 days before your subscription renews.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'subscription.renewed', category: 'subscription', label: 'Subscription renewed', description: 'Confirmation when a renewal has been processed.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'subscription.suspended', category: 'subscription', label: 'Subscription suspended', description: 'When your subscription has been suspended due to unpaid renewal.', rolesAllowed: ['account_owner', 'billing_admin', 'license_admin'] },
  { type: 'subscription.reactivated', category: 'subscription', label: 'Subscription reactivated', description: 'When access is restored after payment.', rolesAllowed: ['account_owner', 'billing_admin', 'license_admin'] },
  // Quote
  { type: 'quote.received', category: 'quote', label: 'New quote received', description: 'When your sales contact issues a new quote.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'quote.expiring_soon', category: 'quote', label: 'Quote expiring soon', description: 'Reminder three days before a quote expires.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'quote.accepted', category: 'quote', label: 'Quote accepted', description: 'Confirmation when you accept a quote.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'quote.declined', category: 'quote', label: 'Quote declined', description: 'Confirmation when you decline a quote.', rolesAllowed: ['account_owner', 'billing_admin'] },
  // License & User
  { type: 'license.assigned_to_me', category: 'license_user', label: 'License assigned to me', description: 'When an administrator assigns you a product license.', rolesAllowed: [] },
  { type: 'license.unassigned_from_me', category: 'license_user', label: 'License unassigned from me', description: 'When a license is removed from your account.', rolesAllowed: [] },
  { type: 'license.trial_expiring', category: 'license_user', label: 'Trial license expiring', description: 'Seven days before your trial license expires.', rolesAllowed: [] },
  { type: 'user.invited', category: 'license_user', label: 'New user invited', description: 'When a new user is invited to your organization.', rolesAllowed: ['account_owner', 'license_admin'] },
  { type: 'user.accepted_invitation', category: 'license_user', label: 'User accepted invitation', description: 'When an invited user logs in for the first time.', rolesAllowed: ['account_owner', 'license_admin'] },
  // Product
  { type: 'product.new_version', category: 'product', label: 'New product version available', description: 'When a new version of a product you use is released.', rolesAllowed: [] },
  { type: 'datanet.monthly_update', category: 'product', label: 'DataNet monthly update', description: 'When the latest DataNet bulletin is published.', rolesAllowed: [] },
  { type: 'maintenance.scheduled', category: 'product', label: 'Maintenance window scheduled', description: 'When scheduled portal or product maintenance is announced.', rolesAllowed: [] },
  // Account
  { type: 'account.role_changed', category: 'account', label: 'Role changed', description: 'When your role on this account is changed.', rolesAllowed: [] },
  { type: 'account.password_changed', category: 'account', label: 'Password changed', description: 'When your password is changed.', rolesAllowed: [] },
  { type: 'account.new_login', category: 'account', label: 'New login from unrecognized device', description: 'Security notification when your account is accessed from a new device.', rolesAllowed: [] },
];

export const NOTIFICATION_CATEGORIES = [
  { key: 'billing', label: 'Billing & Payment' },
  { key: 'subscription', label: 'Subscription' },
  { key: 'quote', label: 'Quotes' },
  { key: 'license_user', label: 'Licenses & Users' },
  { key: 'product', label: 'Products & Services' },
  { key: 'account', label: 'Account & Security' },
] as const;
```

### 1.2 User record extension

Add to the `User` interface:

```ts
notificationPrefs?: Record<NotificationType, NotificationChannelPrefs>;
```

It's optional because seeded users won't have it. Provide a getter that returns defaults when missing:

```ts
export const getDefaultNotificationPrefs = (): Record<NotificationType, NotificationChannelPrefs> => {
  const prefs = {} as Record<NotificationType, NotificationChannelPrefs>;
  NOTIFICATION_CATALOG.forEach(entry => {
    prefs[entry.type] = { email: true, inApp: true };
  });
  return prefs;
};

const getUserNotificationPrefs = useCallback((userId?: string): Record<NotificationType, NotificationChannelPrefs> => {
  const id = userId || state.currentUser?.id;
  if (!id) return getDefaultNotificationPrefs();
  const user = state.users.find(u => u.id === id);
  if (!user?.notificationPrefs) return getDefaultNotificationPrefs();
  // Merge stored prefs with defaults so any new catalog entry gets sensible default
  return { ...getDefaultNotificationPrefs(), ...user.notificationPrefs };
}, [state.users, state.currentUser]);

const updateUserNotificationPrefs = useCallback((userId: string, type: NotificationType, channel: 'email' | 'inApp', value: boolean) => {
  setState(prev => ({
    ...prev,
    users: prev.users.map(u => {
      if (u.id !== userId) return u;
      const current = u.notificationPrefs || getDefaultNotificationPrefs();
      return {
        ...u,
        notificationPrefs: {
          ...current,
          [type]: { ...current[type], [channel]: value },
        },
      };
    }),
  }));
}, []);
```

Expose both from the context value.

### 1.3 Notification record

```ts
export interface Notification {
  id: string;
  userId: string;             // who sees it
  companyId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;              // e.g., '/invoices', '/quotes', '/datanet'
  linkLabel?: string;         // e.g., 'View invoice'
  createdAt: string;
  readAt: string | null;
}
```

Add to `AppState`:
```ts
notifications: Notification[];
```

Initialize as empty array — runtime auto-generation populates it. Optionally seed a few examples for demo richness (see Change 5).

### 1.4 Core helpers

```ts
const notify = useCallback((input: {
  userId?: string;            // defaults to currentUser
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  linkLabel?: string;
}) => {
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const userId = input.userId || state.currentUser?.id;
  if (!userId) return;
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  const companyId = user.companyId;
  // Check preference: only create in-app notification if inApp toggle is ON
  const prefs = getUserNotificationPrefs(userId);
  if (!prefs[input.type]?.inApp) return;
  const notification: Notification = {
    id, userId, companyId,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link,
    linkLabel: input.linkLabel,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  setState(prev => ({ ...prev, notifications: [notification, ...prev.notifications] }));
}, [state.currentUser, state.users, getUserNotificationPrefs]);

const getUserNotifications = useCallback((userId?: string): Notification[] => {
  const id = userId || state.currentUser?.id;
  if (!id) return [];
  return state.notifications
    .filter(n => n.userId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}, [state.notifications, state.currentUser]);

const getUnreadNotificationCount = useCallback((userId?: string): number => {
  return getUserNotifications(userId).filter(n => !n.readAt).length;
}, [getUserNotifications]);

const markNotificationRead = useCallback((notificationId: string) => {
  setState(prev => ({
    ...prev,
    notifications: prev.notifications.map(n =>
      n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n
    ),
  }));
}, []);

const markAllNotificationsRead = useCallback((userId?: string) => {
  const id = userId || state.currentUser?.id;
  if (!id) return;
  setState(prev => ({
    ...prev,
    notifications: prev.notifications.map(n =>
      n.userId === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n
    ),
  }));
}, [state.currentUser]);
```

Expose all five from the context value.

---

## Change 2 — Notifications tab in Profile Settings drawer

### 2.1 Replace placeholder

In `src/components/profile/ProfileSettingsDrawer.tsx`, replace the Notifications tab placeholder with a real component `NotificationsTab.tsx`:

```tsx
<TabsContent value="notifications" className="mt-0">
  <NotificationsTab />
</TabsContent>
```

### 2.2 NotificationsTab component

Create `src/components/profile/NotificationsTab.tsx`:

Layout:

- Top: a short blurb "Choose how you'd like to receive updates. Email goes to your registered email address. In-app notifications appear in the bell icon at the top of the page."
- A 2-column header above the list: empty left column, "Email" + "In-App" labels right-aligned

Then for each of the 6 categories (in catalog order):

- Category header (`text-sm font-semibold mt-6`) — the human-readable category name (e.g., "Billing & Payment")
- For each notification type in the category that's relevant to this user (role filter applied):
  - Two-line text on the left: label (font-medium text-sm) over description (text-xs text-muted-foreground)
  - Two switches on the right, aligned with the column headers: Email, In-App

Use a CSS grid to ensure column alignment:

```tsx
<div className="grid grid-cols-[1fr,80px,80px] gap-x-4 items-center py-2 border-b border-border last:border-b-0">
  <div>
    <div className="text-sm font-medium">{entry.label}</div>
    <div className="text-xs text-muted-foreground">{entry.description}</div>
  </div>
  <div className="flex justify-center">
    <Switch checked={prefs[entry.type]?.email} onCheckedChange={(v) => updateUserNotificationPrefs(currentUser.id, entry.type, 'email', v)} />
  </div>
  <div className="flex justify-center">
    <Switch checked={prefs[entry.type]?.inApp} onCheckedChange={(v) => updateUserNotificationPrefs(currentUser.id, entry.type, 'inApp', v)} />
  </div>
</div>
```

The column headers row uses the same grid template so they line up:

```tsx
<div className="grid grid-cols-[1fr,80px,80px] gap-x-4 mb-2">
  <div></div>
  <div className="text-xs font-medium text-center text-muted-foreground uppercase tracking-wide">Email</div>
  <div className="text-xs font-medium text-center text-muted-foreground uppercase tracking-wide">In-App</div>
</div>
```

### 2.3 Role filtering

For each catalog entry, only render if:
- `entry.rolesAllowed.length === 0` (means all roles), OR
- The current user has at least one of `entry.rolesAllowed`

Additional special filters:
- `license.trial_expiring`: only render if the current user has at least one license with `licenseType === 'trial'` (use `getCurrentUserTrialLicenses` from v7b)

If a category ends up with zero visible notifications for this user (e.g., a Registered Contact viewing the Billing category), HIDE the entire category section (don't render an empty heading).

### 2.4 No Save Changes button

Each toggle saves immediately (calls `updateUserNotificationPrefs`). No batch save. Consistent with how the inline DataNet toggle works in the Users table.

A small "Reset to defaults" link at the bottom of the tab restores all toggles for the current user. Calls a context helper:

```ts
const resetUserNotificationPrefs = useCallback((userId: string) => {
  setState(prev => ({
    ...prev,
    users: prev.users.map(u => u.id === userId ? { ...u, notificationPrefs: getDefaultNotificationPrefs() } : u),
  }));
}, []);
```

Toast on reset: "Notification preferences reset to defaults."

---

## Change 3 — Bell feed in Header

### 3.1 File: `src/components/layout/Header.tsx`

The bell currently toasts "no new notifications". Replace with a Popover containing a notification panel.

```tsx
const { getUserNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } = useApp();
const navigate = useNavigate();
const [bellOpen, setBellOpen] = useState(false);

const notifications = getUserNotifications();
const unreadCount = getUnreadNotificationCount();

<Popover open={bellOpen} onOpenChange={setBellOpen}>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon" className="h-9 w-9 relative" aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}>
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border-2 border-background" />
      )}
    </Button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-96 p-0">
    <NotificationPanel
      notifications={notifications}
      onItemClick={(n) => {
        markNotificationRead(n.id);
        setBellOpen(false);
        if (n.link) navigate(n.link);
      }}
      onMarkAllRead={() => markAllNotificationsRead()}
      onSettingsClick={() => {
        setBellOpen(false);
        window.dispatchEvent(new CustomEvent('leimberg:open-profile', { detail: { tab: 'notifications' } }));
      }}
    />
  </PopoverContent>
</Popover>
```

### 3.2 NotificationPanel component

Create `src/components/notifications/NotificationPanel.tsx`:

Structure:
- Header row: "Notifications" title (text-base font-semibold) on the left, "Mark all as read" link button on the right (only when unreadCount > 0). Below that, a thin border.
- Body: scrollable area (`max-h-[480px] overflow-y-auto`).
  - Empty state when no notifications: centered Bell icon (grey) + "You're all caught up." text + small muted "We'll let you know when something needs your attention."
  - Otherwise: list of notifications, newest first.
- Footer: "Notification settings" link button (text-xs, centered) at the bottom, on its own row inside `border-t`.

Each notification row:
```tsx
<button
  onClick={() => onItemClick(notification)}
  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0 ${
    !notification.readAt ? 'bg-primary/5' : ''
  }`}
>
  <div className="flex items-start gap-3">
    <div className="mt-1">
      {!notification.readAt ? (
        <div className="h-2 w-2 rounded-full bg-primary" />
      ) : (
        <div className="h-2 w-2" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{notification.title}</p>
        <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(notification.createdAt)}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{notification.message}</p>
      {notification.linkLabel && (
        <span className="text-xs text-primary mt-1 inline-block">{notification.linkLabel} →</span>
      )}
    </div>
  </div>
</button>
```

`formatRelativeTime` returns strings like "Just now", "5m ago", "2h ago", "Yesterday", "Mar 15". Add to `src/lib/format.ts` next to `formatCurrency`:

```ts
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  const d = new Date(iso);
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
}
```

### 3.3 Limit displayed notifications

Show at most the 20 most recent notifications. If more exist, show a "View all" link at the bottom (above "Notification settings") that... well, for now, just show "View all" disabled with tooltip "Notification history page coming soon." The full history page can be a future enhancement.

### 3.4 Bell badge updates live

When the user receives a new notification (via any context method calling `notify`), the unread count and red dot update automatically since `getUnreadNotificationCount` is a React-state-derived value.

---

## Change 4 — Auto-generation hooks

Wire `notify(...)` calls into key context methods so notifications appear naturally as the user interacts with the portal.

### 4.1 In `checkoutPurchase`

After creating the subscription and invoice:

```ts
notify({
  type: 'invoice.created',
  title: 'New invoice ready',
  message: `Invoice ${newInvoice.invoiceNumber} for ${formatCurrency(newInvoice.totalAmount)} is awaiting review.`,
  link: '/invoices',
  linkLabel: 'View invoice',
});
```

If `paymentMethod === 'pay_immediately'`, additionally:
```ts
notify({
  type: 'invoice.paid',
  title: 'Payment received',
  message: `Your payment of ${formatCurrency(newInvoice.totalAmount)} has been processed.`,
  link: '/invoices',
});
```

### 4.2 In `markInvoicePaid`

```ts
notify({
  type: 'invoice.paid',
  title: 'Payment received',
  message: `Your payment of ${formatCurrency(paidInvoice.totalAmount)} has been processed.`,
  link: '/invoices',
});

if (linkedSub?.status === 'suspended' /* was suspended before flip */) {
  notify({
    type: 'subscription.reactivated',
    title: 'Subscription reactivated',
    message: `Access to ${linkedSub.name} has been restored.`,
    link: '/subscriptions',
  });
}
```

### 4.3 In `acceptQuote`

```ts
notify({
  type: 'quote.accepted',
  title: 'Quote accepted',
  message: `Quote ${quote.quoteNumber} for ${formatCurrency(quote.totalAmount)} has been accepted. Invoice generated.`,
  link: '/invoices',
});
```

### 4.4 In `declineQuote`

```ts
notify({
  type: 'quote.declined',
  title: 'Quote declined',
  message: `Quote ${quote.quoteNumber} has been declined.`,
  link: '/quotes',
});
```

### 4.5 In `addUser`

Notify all admins of the company (account_owner + license_admin) — not just the current user:

```ts
const companyAdmins = state.users.filter(u =>
  u.companyId === newUser.companyId &&
  u.status === 'active' &&
  (u.roles.includes('account_owner') || u.roles.includes('license_admin'))
);
companyAdmins.forEach(admin => {
  notify({
    userId: admin.id,
    type: 'user.invited',
    title: 'New user invited',
    message: `${newUser.firstName} ${newUser.lastName} has been invited to your organization.`,
    link: '/users',
  });
});
```

### 4.6 In the auto-renewal generator (runtime useEffect)

When a new renewal invoice is created:

```ts
notify({
  userId: <find an account_owner or billing_admin of the company>,
  type: 'subscription.renewal_upcoming',
  title: 'Subscription renewal coming',
  message: `Your ${sub.name} renews in approximately 30 days. Renewal invoice ${newInvoice.invoiceNumber} is ready.`,
  link: '/invoices',
});
```

Since this runs in an effect outside any user's session context, pick the first active account_owner of the company as the recipient.

### 4.7 In the auto-suspension escalator

```ts
notify({
  userId: <account owner of the company>,
  type: 'subscription.suspended',
  title: 'Subscription suspended',
  message: `Your ${sub.name} has been suspended due to an unpaid renewal invoice. Pay to restore access.`,
  link: '/invoices',
});
```

### 4.8 In `login` (when a user first transitions invited → active)

```ts
const companyAdmins = state.users.filter(u =>
  u.companyId === user.companyId &&
  u.status === 'active' &&
  (u.roles.includes('account_owner') || u.roles.includes('license_admin')) &&
  u.id !== user.id
);
companyAdmins.forEach(admin => {
  notify({
    userId: admin.id,
    type: 'user.accepted_invitation',
    title: 'User accepted invitation',
    message: `${user.firstName} ${user.lastName} has logged in for the first time.`,
    link: '/users',
  });
});
```

### 4.9 In `changeUserRoles`

```ts
// Notify the user whose roles were changed
notify({
  userId: targetUser.id,
  type: 'account.role_changed',
  title: 'Your role was updated',
  message: `Your role on ${company.name} was changed.`,
  link: '/dashboard',
});
```

### 4.10 In the Password tab submit (v9a)

In v9a's PasswordTab, after the toast "Password updated":

```ts
notify({
  type: 'account.password_changed',
  title: 'Password changed',
  message: 'Your password has been updated successfully.',
});
```

(No link — they're already inside the drawer.)

### 4.11 What NOT to auto-generate in v9b

Skip these for now — they require either a scheduled job or events the prototype doesn't naturally emit. Mark them in code with a comment:

```ts
// TODO (v10): auto-generate for:
// - invoice.payment_failed (currently no payment-failure simulation path)
// - invoice.approaching_due (requires daily cron — not in prototype)
// - invoice.overdue (currently set via demo button, no auto-emit)
// - license.trial_expiring (requires daily check — not in prototype)
// - license.assigned_to_me / unassigned_from_me (can be added in v10 from User Edit drawer save)
// - product.new_version, datanet.monthly_update, maintenance.scheduled (no event source)
// - account.new_login (no device-fingerprint logic in prototype)
```

The preference toggles for these still appear and persist — only auto-generation is deferred.

---

## Change 5 — Seed notifications for demo richness

To make the bell feel alive on first load, seed a few notifications for the demo users.

For `user-abc-1` (John Smith, Account Owner of ABC):

- Quote received (5 hours ago) — unread — links to `/quotes`
- Subscription renewal coming (1 day ago) — unread — links to `/invoices`
- Invoice paid (3 days ago) — read — links to `/invoices`
- User accepted invitation (1 week ago) — read — links to `/users`

For `user-xyz-1` (Michael Chen, Account Owner of XYZ):
- Quote accepted (2 days ago) — read
- Subscription renewal coming (5 days ago) — unread

Seed these in `initialNotifications` array in AppContext. Use relative timestamps via the same `isoDaysAgo` / `isoHoursAgo` pattern v8a established.

Result: on first login as john.smith, the bell shows 2 unread (red dot), and clicking it shows a real-looking notification list.

---

## What NOT to touch

- The Profile Settings drawer's Profile, Password, Payment tabs (v9a built these)
- The dark mode system (v9a built it; notifications should look correct in both themes)
- The role system
- The shadcn UI primitives
- Existing seed users, companies, subscriptions, invoices, quotes
- The bell icon's visual treatment (only its onClick changes)
- The auto-renewal generator and auto-suspension escalator (just adding `notify()` calls inside them)

---

## Acceptance criteria

When you're done, all of these must be true:

1. `npm run dev` and `npm run build` complete without errors.
2. The Notifications tab in the Profile Settings drawer shows 6 category sections (or fewer if some are entirely hidden by role filtering) with two columns of toggles per row: Email and In-App.
3. Toggles save immediately on click. No global Save button on this tab.
4. A "Reset to defaults" link at the bottom resets all toggles for the current user.
5. Logging in as a Registered Contact and opening the Notifications tab: the Billing & Payment category is NOT visible. Subscription category shows only the suspended/reactivated rows (no renewal_upcoming since that requires billing access).
6. The bell icon click opens a popover panel (NOT a toast).
7. The panel shows a list of notifications for the current user, newest first, with relative timestamps.
8. Unread notifications have a primary-blue dot on the left and a tinted background (`bg-primary/5`).
9. Clicking a notification marks it read AND navigates to its link if any. The popover closes.
10. "Mark all as read" link clears all unread for the current user.
11. The panel footer has a "Notification settings" link that opens the Profile Settings drawer on the Notifications tab.
12. The bell shows a red unread-count dot when at least one notification is unread for the current user.
13. The dot disappears when all are read.
14. Seeded demo notifications: logging in as john.smith@abcaccounting.com shows 2 unread + 2 read in the panel.
15. Logging in as michael.chen@xyzconsulting.com shows 1 unread + 1 read.
16. Auto-generation: paying an invoice generates an `invoice.paid` notification for the payer. Accepting a quote generates a `quote.accepted`. Adding a user generates `user.invited` notifications for all admins of the company.
17. A notification is NOT created in-app if the user has the In-App toggle OFF for that type.
18. Empty state in the panel: when no notifications exist, the panel shows a Bell icon and "You're all caught up." message.
19. The panel renders correctly in dark mode (no hardcoded backgrounds, all tokens).
20. Relative timestamps render as expected: "Just now", "5m ago", "2h ago", "Yesterday", "3d ago", or absolute date for older.
21. No console errors on any notification action.

---

## Manual demo flow

1. Log in as `john.smith@abcaccounting.com`. The bell shows a red dot.
2. Click the bell. The panel opens with 4 notifications, 2 of them showing as unread (blue dot + tinted background).
3. Click the "Quote received" notification. The panel closes; you're routed to `/quotes`. Reopen the bell — the clicked notification is now read (no dot, no tint).
4. Click "Mark all as read". Bell red dot disappears.
5. Click the avatar → Settings / Profile → switch to the Notifications tab.
6. See 6 categories of toggles. Switch off "Quote accepted" in-app.
7. Go to Quotes, accept any active quote. Open the bell — no new "Quote accepted" notification appeared (because in-app is off). Re-enable in-app, accept another quote — a new notification appears immediately.
8. Click "Reset to defaults" at the bottom of the tab → toast confirms, all toggles back on.
9. Switch role to Registered Contact via the header demo dropdown. Open the Notifications tab. Verify Billing & Payment, Quotes, and most Subscription rows are hidden.
10. Switch to dark mode (Profile tab → Dark Mode toggle). Reopen the bell — verify the panel renders cleanly in dark theme (text readable, unread tint visible, no white backgrounds).

---

## Reporting back

At the end of your run, summarize:

1. Every file modified and every file created.
2. The list of context methods that now emit `notify` calls.
3. Confirmation that role-based filtering removes irrelevant categories cleanly (empty categories don't render their heading).
4. Confirmation that the panel respects the user's In-App preference (a notification with In-App OFF for that type is never created).
5. Whether you encountered any dark-mode rendering issues in the new components and how you fixed them.
6. Any deviations from this spec.
7. `npm run build` output.

Do not commit. I will review.
