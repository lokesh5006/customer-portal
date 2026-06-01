# Claude Code Prompt v9a — Profile Settings Drawer + Dark Mode + Avatar Dropdown Restructure

Copy everything below this line into Claude Code in VS Code. Run on the project root.

This is the FIRST of two related batches (v9a now, v9b after). v9a builds the Profile Settings drawer with three tabs (Profile, Password, Payment), implements real dark mode end-to-end, and restructures the avatar dropdown to be the drawer's entry point. v9b will add the Notifications tab and the bell feed.

---

## Context

This is a major UX consolidation. Today, profile-related concerns are scattered: the `/payment-methods` sidebar page handles cards/ACH, the `/profile` route exists but is unrouted, dark mode does not exist, the avatar dropdown only has Sign Out. After this batch, all account-level concerns live in a single right-side drawer accessed from the avatar.

Before you write any code, read these files in this exact order:

1. `src/contexts/AppContext.tsx` — read `SavedPaymentMethod`, `addPaymentMethod`, `removePaymentMethod`, `setPrimaryPaymentMethod`, `getCompanyPaymentMethods`. Also read the user/role state and the `can()` helper.
2. `src/pages/PaymentMethodsPage.tsx` — current full-page management. This page goes away in this batch; its logic moves into the drawer.
3. `src/pages/ProfilePage.tsx` — currently unrouted. Will be deleted at the end.
4. `src/components/layout/Header.tsx` — the avatar dropdown lives here.
5. `src/components/layout/Sidebar.tsx` — the Payment Methods nav item must be removed.
6. `src/components/layout/MainLayout.tsx` — verify `pageAccess` doesn't reference `/payment-methods` after the page is dropped.
7. `src/App.tsx` — routes for `/payment-methods` and `/profile` need removal.
8. `tailwind.config.ts` and `src/index.css` — design tokens. Dark mode depends entirely on what lives here.
9. `src/components/ui/button.tsx`, `card.tsx`, `dialog.tsx`, `sheet.tsx`, `input.tsx`, `badge.tsx`, `switch.tsx`, `tabs.tsx` — to confirm they use CSS variables (not hardcoded colors). Most should already.

Do NOT start coding until you have read those files.

---

## Final Decisions (binding for v9a)

| Topic | Decision |
|---|---|
| Avatar dropdown content | Three items: "Settings / Profile" (opens drawer), "Log out", and a thin separator above logout. No Dark Mode item — moved into drawer. |
| Drawer width | `w-full sm:max-w-xl` (wider than ManageLicensesDrawer; the Payment tab has dense content) |
| Drawer tabs | Four (Profile, Password, Payment, Notifications). v9a builds the first three; v9b builds Notifications. |
| `/payment-methods` route | DELETED. Sidebar item removed. The Payment tab is the only access. |
| `/profile` route | DELETED. File `ProfilePage.tsx` deleted. The drawer's Profile tab replaces it. |
| Payment tab role gating | Visible only when current user has `account_owner` OR `billing_admin` role. Hidden for others. |
| Email editability in drawer | Read-only. Help text: "Email address cannot be changed. Contact your administrator if you need to update it." |
| Email editability in Admin User Edit drawer | Still editable. No change to that drawer. |
| Saved methods scope | Company-scoped (unchanged). The drawer surfaces the company's methods. |
| Dark Mode persistence | `localStorage` key: `leimberg.theme` with value `'light'` | `'dark'` | `'system'`. Defaults to `'system'`. |
| Dark Mode toggle location | Only inside Profile tab (one place). Not in dropdown. |
| Dark Mode scope | Full theme — every page, every component must read from CSS variables, not hardcoded colors. |

---

## Change 1 — Avatar dropdown restructure

### 1.1 File: `src/components/layout/Header.tsx`

Currently the avatar dropdown has Sign Out and possibly other items. Restructure to exactly three items:

```tsx
<DropdownMenuContent align="end" className="w-56">
  <DropdownMenuLabel className="font-normal">
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
          {getInitials(currentUser)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0">
        <p className="text-sm font-medium truncate">
          {currentUser.firstName} {currentUser.lastName}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {currentUser.email}
        </p>
      </div>
    </div>
  </DropdownMenuLabel>
  <DropdownMenuSeparator />
  <DropdownMenuItem onClick={() => setProfileDrawerOpen(true)}>
    <Settings className="h-4 w-4 mr-2" />
    Settings / Profile
  </DropdownMenuItem>
  <DropdownMenuSeparator />
  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
    <LogOut className="h-4 w-4 mr-2" />
    Log out
  </DropdownMenuItem>
</DropdownMenuContent>
```

`getInitials(user)` returns the first letter of firstName + first letter of lastName, uppercased. If either is missing, fall back to first 2 chars of email.

State `setProfileDrawerOpen` lives in `Header.tsx` and controls the drawer's mount.

### 1.2 Mount the drawer from Header

Import the new drawer component (see Change 2) and render it as a sibling of the dropdown:

```tsx
return (
  <>
    <header>...</header>
    <ProfileSettingsDrawer
      open={profileDrawerOpen}
      onOpenChange={setProfileDrawerOpen}
    />
  </>
);
```

---

## Change 2 — ProfileSettingsDrawer component

### 2.1 New file: `src/components/profile/ProfileSettingsDrawer.tsx`

Wrap shadcn `Sheet`. Right side. Width `w-full sm:max-w-xl`. Layout:

```
┌─────────────────────────────────────┐
│ Profile Settings                  X │  ← SheetHeader, sticky top
│ Manage your account settings and    │
│ preferences                         │
├─────────────────────────────────────┤
│ [Profile][Password][Payment][Notif.]│  ← Tab strip, sticky
├─────────────────────────────────────┤
│                                     │  ← Scrollable content
│ ...tab body...                      │
│                                     │
├─────────────────────────────────────┤
│ [Save Changes]                      │  ← Sticky footer (only on tabs that save)
└─────────────────────────────────────┘
```

Component structure:

```tsx
export function ProfileSettingsDrawer({ open, onOpenChange }) {
  const { currentUser, can } = useApp();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'payment' | 'notifications'>('profile');

  const showPaymentTab = can('billing.view') || can('billing.manage_methods');
  // billing.manage_methods is permitted for account_owner and billing_admin per existing rules

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Profile Settings</SheetTitle>
          <SheetDescription>Manage your account settings and preferences</SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-4 mx-6 mt-4 shrink-0">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            {showPaymentTab && <TabsTrigger value="payment">Payment</TabsTrigger>}
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <TabsContent value="profile"><ProfileTab onClose={() => onOpenChange(false)} /></TabsContent>
            <TabsContent value="password"><PasswordTab /></TabsContent>
            {showPaymentTab && <TabsContent value="payment"><PaymentTab /></TabsContent>}
            <TabsContent value="notifications">
              <div className="text-sm text-muted-foreground italic">Notifications preferences will appear here.</div>
              {/* v9b populates this */}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
```

**Important on the TabsList grid:** if `showPaymentTab` is false, the grid should be `grid-cols-3`, not `grid-cols-4`. Compute the class:

```tsx
const tabCount = showPaymentTab ? 4 : 3;
<TabsList className={`grid grid-cols-${tabCount} mx-6 mt-4 shrink-0`}>
```

(Tailwind JIT requires literal class names; if `grid-cols-3` and `grid-cols-4` aren't both safelist-discoverable, write them out via conditional rather than interpolation.)

### 2.2 Profile tab — `ProfileTab.tsx`

Subcomponent in the same folder.

Sections in this order with `text-base font-semibold` headings:

**Organization Profile**
- One field: `Customer / Company Name` — populated from `currentCompany.name`. EDITABLE only when current user has `account_owner` role. Help text below: "This is how the customer name shows on invoices, statements, etc."
- For non-owners: rendered read-only with subtle disabled styling.

**Personal Information**
- First Name | Last Name (2-column grid)
- Username (full width)
- Email Address (full width, **disabled**, with help text "Email address cannot be changed. Contact your administrator if you need to update it.")

**Appearance**
- A Switch row: "Dark Mode" with sub-line "Use dark theme across the application"
- Reads/writes via `useTheme()` hook (see Change 3)
- Toggling immediately applies the theme — no Save Changes click needed for this control

**Save Changes**
- Sticky footer button at the bottom right of the drawer (only on Profile tab; Password tab has its own button)
- Disabled when nothing has changed AND nothing is invalid
- On click: validate, call appropriate context methods (`updateUser`, `updateCompany`), toast "Profile updated", close drawer

**Validation rules:**
- First name required
- Last name required
- Username required, must not duplicate within company (use `isUsernameTaken` from AppContext, excluding self)
- Customer/Company Name required (when editable)

**Username auto-suggestion:**
- When First Name or Last Name changes AND the username field is unchanged from its last saved value, regenerate using `generateUsername` logic
- If user manually edits username, stop auto-syncing for the rest of the session

### 2.3 Password tab — `PasswordTab.tsx`

Three fields in a vertical stack:
- Current Password (type="password")
- New Password (type="password")
- Confirm New Password (type="password")

**Password requirements display** below the New Password field:
- At least 8 characters
- At least one uppercase letter
- At least one number
- At least one special character

Show a small checklist with green checkmark icons that turn on/off as the user types. Use `lucide-react` `Check` for met, `X` for unmet (or just toggle text color from `text-muted-foreground` to `text-success`).

**Validation:**
- Current Password required
- New Password meets all 4 requirements
- Confirm matches New Password

**Submit (Update Password button at bottom, primary, full-width):**
- Since there's no backend, the prototype "succeeds" if current password is non-empty and validation passes
- Toast: "Password updated. Use the new password for your next login."
- Clear all 3 fields after success
- Do NOT close the drawer

There's no actual password storage in the demo — `login` ignores password — so this tab is for UX completeness, not real auth.

### 2.4 Payment tab — `PaymentTab.tsx`

This tab is only rendered when the user is `account_owner` or `billing_admin`. The visibility logic in Change 2.1 already enforces this.

Sections:

**Auto Renewal toggle**
- Row with label "Auto Renewal" + sub-line "Automatically renew your subscription"
- Switch on the right
- Reads/writes from a new context field: `currentCompany.autoRenewal: boolean` (default `true`)
- This is a single value on the company, NOT per-subscription, for simplicity
- Add to `Company` interface, seed both companies with `true`, add a context method `setAutoRenewal(companyId, value)`
- Toggling fires immediately + toast: "Auto renewal {enabled|disabled}."

**Method type tabs**
- Two-button switcher: "Pay by Card" | "ACH"
- Toggle which list and add-form is shown below
- Default to whichever has more saved methods, or "Pay by Card" if tied

**Saved methods list**
- For each saved card: card brand icon, `{Brand} ending in {last4}`, sub-line `Expires {MM}/{YY}`
- Right side: "Primary" badge if primary, OR "Make Primary" link button if not
- Delete icon (trash) at far right
- ACH list same shape: bank name, `•••• {accountLast4}`, sub-line `Routing •••• {routingLast4}`

**Add New Payment Method form**
- Conditional on which type-tab is active
- For cards: Card Number | Expiration MM/YY | CVV (3-column grid)
- For ACH: Account Holder Name | Bank Name | Routing Number | Account Number
- "Add Payment Method" button below
- "Make this my primary method" checkbox (default false; auto-force-true if this is the first method of its type)

**Behaviors that mirror what was on `/payment-methods` previously:**
- `addPaymentMethod` validates, generates id, sets primary if first
- `removePaymentMethod` blocks removing the only method; if removing primary, auto-promotes next method
- `setPrimaryPaymentMethod` demotes all others of same type for the company

### 2.5 Footer behavior

Each tab has its own save action:
- Profile tab: a Save Changes button sticky at the bottom-right of the drawer footer
- Password tab: its own Update Password button at the bottom of its content
- Payment tab: no global save — each add/remove/primary action saves immediately
- Notifications tab: v9b will spec

The drawer's overall layout has a sticky footer area that conditionally shows the right button per active tab. Easier: each TabsContent renders its own button at the bottom of its content with `mt-6 flex justify-end`.

---

## Change 3 — Dark Mode

This is a substantial change. Approach it systematically.

### 3.1 Theme system

Add a theme provider. Create `src/components/theme/ThemeProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'leimberg.theme';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored && ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
  });

  const resolvedTheme: 'light' | 'dark' = (() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  })();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  // Listen to system changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  };

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

Mount `<ThemeProvider>` in `src/App.tsx` (or `src/main.tsx`), wrapping the existing app providers. Put it OUTSIDE any router so the theme class is applied early.

### 3.2 Tailwind config

In `tailwind.config.ts`, ensure `darkMode: 'class'`:

```ts
export default {
  darkMode: 'class',
  // ...rest
};
```

### 3.3 Light + Dark CSS variables in `src/index.css`

Replace the existing root variable block with light + dark variants. Use this exact palette anchored on Leimberg blue:

```css
@layer base {
  :root, .light {
    /* Surfaces */
    --background: 210 20% 98%;          /* near-white with subtle blue tint */
    --foreground: 222 47% 11%;          /* near-black */
    --card: 0 0% 100%;                  /* pure white card */
    --card-foreground: 222 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;

    /* Brand */
    --primary: 202 67% 33%;             /* Leimberg #1D618E */
    --primary-foreground: 0 0% 100%;

    /* Secondary surfaces */
    --secondary: 210 20% 94%;
    --secondary-foreground: 222 47% 20%;
    --muted: 210 20% 94%;
    --muted-foreground: 215 16% 47%;
    --accent: 210 20% 94%;
    --accent-foreground: 222 47% 20%;

    /* Status */
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --success: 142 71% 40%;
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;

    /* Borders, inputs, focus */
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 202 67% 33%;

    --radius: 0.5rem;
  }

  .dark {
    /* Surfaces — warm near-black with subtle blue tint */
    --background: 222 30% 9%;           /* very dark blue-gray */
    --foreground: 210 20% 95%;          /* near-white */
    --card: 222 25% 12%;                /* slightly lighter than background */
    --card-foreground: 210 20% 95%;
    --popover: 222 25% 12%;
    --popover-foreground: 210 20% 95%;

    /* Brand — lifted slightly so it pops on dark */
    --primary: 202 70% 55%;             /* brighter Leimberg for dark mode */
    --primary-foreground: 222 47% 11%;

    /* Secondary surfaces */
    --secondary: 222 20% 18%;
    --secondary-foreground: 210 20% 95%;
    --muted: 222 20% 18%;
    --muted-foreground: 215 15% 65%;
    --accent: 222 20% 18%;
    --accent-foreground: 210 20% 95%;

    /* Status — slightly dialed back to avoid eye-burn on dark */
    --destructive: 0 65% 55%;
    --destructive-foreground: 0 0% 100%;
    --success: 142 50% 50%;
    --success-foreground: 0 0% 100%;
    --warning: 38 80% 55%;
    --warning-foreground: 222 47% 11%;

    /* Borders, inputs, focus */
    --border: 222 20% 22%;
    --input: 222 20% 22%;
    --ring: 202 70% 55%;
  }

  * {
    border-color: hsl(var(--border));
  }
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
  }
}
```

### 3.4 Audit pass for hardcoded colors

Grep the codebase for hardcoded color values and replace them with CSS variable references:

```bash
# Run these mentally and verify cleanups:
# bg-white, bg-black, text-white, text-black — should be bg-background / text-foreground
# text-gray-XXX — should be text-muted-foreground or similar
# bg-blue-XXX (specific shades) — should be bg-primary
# text-red-XXX — should be text-destructive
# text-green-XXX — should be text-success
# text-amber-XXX, text-yellow-XXX — should be text-warning
```

Pay particular attention to:
- Status badges (Active / Awaiting Payment / Overdue / Suspended)
- Banner backgrounds (`ReadOnlyBanner` already uses tokens, verify)
- Card backgrounds
- Hover states (`hover:bg-gray-100` → `hover:bg-muted`)
- Borders
- Focus rings

For status badges, prefer the success/warning/destructive tokens with their respective foregrounds. If a badge uses `bg-amber-500/10 text-amber-700`, replace with `bg-warning/10 text-warning`.

### 3.5 Logo behavior in dark mode

The Leimberg logo is a wordmark with black serif text and blue "LeClair." On a dark background, the black serif text becomes invisible.

Three options, in order of preference:

1. **Filter invert in dark mode (cheapest):**
   ```tsx
   <img
     src="/leimberg-logo.png"
     alt="Leimberg, LeClair & Lackner, Inc."
     className="h-7 dark:brightness-0 dark:invert"
   />
   ```
   The `dark:brightness-0 dark:invert` combo turns the dark text white. The blue "LeClair" word will also get inverted (becoming a different shade) — visually slightly off but functional.

2. **Filter only:** `dark:invert` alone. Cleaner but the blue inverts to orange-ish.

3. **Provide a `leimberg-logo-dark.png` asset:** ideal, but we don't have one. Skip this option for now and pick option 1.

Apply option 1 to every logo usage: Welcome page, Login page, Sidebar header, Profile drawer header.

If the result looks bad in your local testing, fall back to wrapping the logo in a light background pill in dark mode:
```tsx
<div className="rounded px-2 py-1 dark:bg-white dark:bg-opacity-95">
  <img src="/leimberg-logo.png" className="h-7" />
</div>
```

Use whichever approach reads cleanly.

### 3.6 Shadow handling in dark mode

The existing hero card on Subscriptions uses `shadow-sm`. Shadows on dark backgrounds are nearly invisible. They're fine to leave — they degrade gracefully — but if any card relies heavily on shadow for elevation, swap to a subtle border in dark mode:

```tsx
className="shadow-sm dark:shadow-none dark:border-border"
```

The hero card already uses `border-primary/10` so it should look fine in both modes. Audit and adjust only where flat-dark feels indistinct.

---

## Change 4 — Remove deprecated pages

### 4.1 Delete `src/pages/PaymentMethodsPage.tsx`

Remove the file. Remove its import from `src/App.tsx`. Remove its route. Remove the "Payment Methods" sidebar nav item from `src/components/layout/Sidebar.tsx`. Remove `/payment-methods` from `MainLayout.tsx`'s `pageAccess` map.

### 4.2 Delete `src/pages/ProfilePage.tsx`

The file was kept on disk in case we'd need it (per an earlier prompt). Delete it now since the drawer fully replaces it. Remove `/profile` from `pageAccess` (it should already be absent or its mapping was kept for future use).

### 4.3 Update any inline references

Any `navigate('/payment-methods')` or `navigate('/profile')` calls in the codebase need to be updated:
- Existing "Change Card" link on the universal `/pay` page: previously routed to `/payment-methods`. Now it should open the Profile Settings drawer's Payment tab.
- Anywhere ProfilePage was referenced from action menus or sidebars: clean up.

For the "Change Card" link specifically, the universal payment page is a route, not a child of Header. Easiest approach: use a global state for the drawer (already in Header), and expose a method from a shared `useProfileDrawer` hook OR a URL hash (e.g., navigate to `#profile=payment` and have Header listen for hash changes). Simplest: store in `sessionStorage` and a custom event:

```ts
// in src/lib/profileDrawer.ts
export function openProfileDrawer(tab: 'profile' | 'password' | 'payment' | 'notifications' = 'profile') {
  window.dispatchEvent(new CustomEvent('leimberg:open-profile', { detail: { tab } }));
}
```

Header listens on mount:
```tsx
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    setProfileDrawerOpen(true);
    if (detail?.tab) setInitialTab(detail.tab);
  };
  window.addEventListener('leimberg:open-profile', handler);
  return () => window.removeEventListener('leimberg:open-profile', handler);
}, []);
```

`PaymentPage`'s "Change Card" link now calls `openProfileDrawer('payment')`.

---

## What NOT to touch

- The Leimberg branding (logo file, primary color hex — only the dark variants are NEW)
- The role system
- The Users/Contacts pages (admin User Edit drawer's email field stays editable)
- The shadcn UI primitives in `src/components/ui/*` — they should already use CSS variables; only audit
- The seed data
- The Notifications tab (placeholder content only — v9b builds it)
- The bell icon behavior (still toasts "no new notifications" — v9b changes it)

---

## Acceptance criteria

When you're done, all of these must be true:

1. `npm run dev` and `npm run build` complete without errors.
2. Clicking the avatar in the header opens a dropdown with: avatar + name + email header block, "Settings / Profile" item, "Log out" item. Nothing else.
3. Clicking "Settings / Profile" opens a right-side drawer titled "Profile Settings" with tabs Profile, Password, Payment, Notifications.
4. The Payment tab is HIDDEN for users without `account_owner` or `billing_admin` role. The tab grid adjusts from 4 columns to 3 in that case.
5. The Notifications tab shows placeholder text ("Notifications preferences will appear here.") — v9b will replace this.
6. Profile tab: Organization name editable only for Account Owners. Personal info First/Last/Username editable. Email field disabled with help text. Dark Mode switch toggles theme immediately.
7. Username on the Profile tab auto-syncs to First/Last changes UNTIL the user manually edits username. After manual edit, no further auto-sync that session.
8. Password tab: three fields + live-updating requirements checklist (8+ chars, uppercase, number, special). Submit toasts success and clears fields.
9. Payment tab: shows the company's saved methods. Pay by Card | ACH switcher works. Add Payment Method form validates and saves. Make Primary and trash actions work.
10. Payment tab Auto Renewal switch reads/writes `currentCompany.autoRenewal`. Default true. Toast confirms changes.
11. `/payment-methods` route is GONE. Sidebar item is GONE. The route doesn't exist.
12. `/profile` route is GONE. `ProfilePage.tsx` file is deleted.
13. The "Change Card" link on the universal `/pay` page opens the Profile Settings drawer on the Payment tab.
14. Dark mode works end-to-end: toggling the Dark Mode switch in the Profile tab immediately switches the theme. Selection persists across reloads (via localStorage).
15. When no preference is stored, the app respects `prefers-color-scheme` (system theme).
16. In dark mode: backgrounds are dark blue-gray, text is near-white, the Leimberg blue is slightly brighter to pop against the dark, all status badges remain readable, the Leimberg logo is legible (via `dark:brightness-0 dark:invert` or equivalent).
17. The light theme palette is unchanged from before this prompt — only NEW palette is dark.
18. Every page (Dashboard, Subscriptions, Checkout, /pay, Quotes, Invoices, Users, Contacts, Downloads, DataNet, Support, News, Admin Tool) renders correctly in both light and dark modes with no hardcoded color leaks (no white backgrounds in dark mode, no black text on near-black, no invisible borders).
19. No console errors when toggling between modes.

---

## Manual demo flow

1. Log in as `john.smith@abcaccounting.com`.
2. Click the avatar → dropdown shows three items. Click "Settings / Profile". Drawer opens on Profile tab.
3. Type a new first name → username auto-suggests. Edit the username manually → it stops auto-syncing.
4. Toggle the Dark Mode switch → entire app flips to dark immediately. Close the drawer → background, sidebar, header, cards all dark. Status badges still readable.
5. Reload the page → still dark (persisted).
6. Open the drawer again → toggle back to light → instant.
7. Switch to the Password tab. Type a new password — the requirements checklist updates live. Submit → toast confirms.
8. Switch to the Payment tab. See the company's saved Visa + Mastercard. Click "Make Primary" on Mastercard — it becomes Primary, Visa loses the Primary badge. Click the trash on Visa — confirmation. Add a new card via the form → it appears in the list.
9. Toggle Auto Renewal off → toast confirms.
10. Log out, log back in as a `registered_contact` user (via Role Demo dropdown). Open the avatar dropdown → "Settings / Profile". The Payment tab should NOT appear. Only Profile, Password, Notifications.
11. Go to `/pay` (route there from any invoice's Pay Now). Click "Change Card" link — Profile Settings drawer opens directly on the Payment tab.

---

## Reporting back

At the end of your run, summarize:

1. Every file modified, every file created, every file deleted.
2. Confirmation that `/payment-methods` and `/profile` routes are fully removed (sidebar, App.tsx routes, pageAccess map, all imports).
3. The list of hardcoded color values you found in `src/` during the dark mode audit, and what you replaced each with.
4. Confirmation that the Leimberg logo renders legibly in both themes — describe what treatment you used.
5. Any components in `src/components/ui/*` that needed CSS-variable fixes for dark mode to work (they should be using variables already; flag any that weren't).
6. Confirmation that the Payment tab is role-gated by `can('billing.manage_methods')` or equivalent.
7. Any deviations from this spec.
8. `npm run build` output.

Do not commit. I will review.
