import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Building2,
  LayoutDashboard,
  Users,
  CreditCard,
  Download,
  HelpCircle,
  Newspaper,
  FileText,
  FileSignature,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { useApp, Role } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { openProfileDrawer } from '@/lib/profileDrawer';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  requiredRoles: Role[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'Subscriptions', icon: CreditCard, path: '/subscriptions', requiredRoles: ['account_owner', 'billing_admin', 'license_admin'] },
  { label: 'Invoices', icon: FileText, path: '/invoices', requiredRoles: ['account_owner', 'billing_admin'] },
  { label: 'Quotes', icon: FileSignature, path: '/quotes', requiredRoles: ['account_owner', 'billing_admin'] },
  { label: 'Users & Contacts', icon: Users, path: '/users-contacts', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'Product Downloads & Links', icon: Download, path: '/downloads', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'DataNet', icon: Database, path: '/datanet', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'Support', icon: HelpCircle, path: '/support', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'News', icon: Newspaper, path: '/news', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'Admin Tool', icon: ShieldCheck, path: '/admin', requiredRoles: ['account_owner', 'license_admin'] },
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasAccess, isFirstTimeCustomer, hasSentQuote, hasDeclinedQuote, isReadOnlyMode } = useApp();
  const [expanded, setExpanded] = useState(false);

  const handleNav = (path: string) => {
    navigate(path);
  };

  let visibleItems = navItems.filter(item => hasAccess(item.requiredRoles));

  // Pay-on-Receipt path: show ALL menus (CRUD is gated by read-only mode instead).
  // The pre-purchase first-time gate only applies when we're not yet pending payment.
  if (isFirstTimeCustomer() && !isReadOnlyMode()) {
    if (hasSentQuote() && hasDeclinedQuote()) {
      visibleItems = visibleItems.filter(i =>
        i.path === '/quotes' || i.path === '/support' || i.path === '/subscriptions'
      );
    } else if (hasSentQuote()) {
      visibleItems = visibleItems.filter(i => i.path === '/quotes' || i.path === '/support');
    } else {
      visibleItems = visibleItems.filter(i => i.path === '/subscriptions' || i.path === '/support');
    }
  }

  const rowClass = (active: boolean) => cn(
    'flex items-center gap-3 h-10 mx-2 px-[11px] rounded-md shrink-0 transition-colors overflow-hidden',
    active
      ? 'bg-primary/10 text-primary'
      : 'text-foreground/70 hover:bg-muted/60 hover:text-foreground',
  );

  return (
    <>
      {/* Spacer reserves the collapsed rail's width in the page's flex layout —
          the actual sidebar below is fixed-positioned so it can expand over the
          page content on hover without shifting anything else. */}
      <div className="w-16 shrink-0" aria-hidden="true" />

      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={cn(
          'fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] border-r bg-background flex flex-col py-3 gap-1',
          'transition-[width] duration-150 ease-in-out overflow-hidden',
          expanded ? 'w-56 shadow-lg' : 'w-16',
        )}
      >
        <button
          type="button"
          onClick={() => openProfileDrawer('profile')}
          className={rowClass(false)}
          aria-label="Company profile"
        >
          <Building2 className="h-[18px] w-[18px] shrink-0" />
          {expanded && <span className="text-sm whitespace-nowrap">Company profile</span>}
        </button>

        <div className="mx-4 border-t my-1" />

        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {visibleItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                type="button"
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={rowClass(isActive)}
                aria-label={item.label}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {expanded && <span className="text-sm whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
