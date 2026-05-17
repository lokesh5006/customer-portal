import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Download,
  HelpCircle,
  LogOut,
  Newspaper,
  FileText,
  FileSignature,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { useApp, Role } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  requiredRoles: Role[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'Subscriptions', icon: CreditCard, path: '/subscriptions', requiredRoles: ['account_owner', 'billing_admin', 'license_admin'] },
  { label: 'Users & Contacts', icon: Users, path: '/users-contacts', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'Product Downloads & Links', icon: Download, path: '/downloads', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'DataNet', icon: Database, path: '/datanet', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'Invoices', icon: FileText, path: '/invoices', requiredRoles: ['account_owner', 'billing_admin'] },
  { label: 'Quotes', icon: FileSignature, path: '/quotes', requiredRoles: ['account_owner', 'billing_admin'] },
  { label: 'Support', icon: HelpCircle, path: '/support', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'News', icon: Newspaper, path: '/news', requiredRoles: ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] },
  { label: 'Admin Tool', icon: ShieldCheck, path: '/admin', requiredRoles: ['account_owner', 'license_admin'] },
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasAccess, logout, isFirstTimeCustomer, hasSentQuote, hasDeclinedQuote, isReadOnlyMode } = useApp();

  const handleNav = (path: string) => {
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
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

  return (
    <aside className="w-64 border-r bg-background h-[calc(100vh-4rem)] sticky top-16 flex flex-col">
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 h-10 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                  : 'text-foreground hover:bg-muted'
              )}
              onClick={() => handleNav(item.path)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="p-3 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-10 text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
};
