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
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                'w-full justify-start gap-2.5 h-9 text-sm font-medium transition-colors relative',
                isActive
                  ? 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary'
                  : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
              )}
              onClick={() => handleNav(item.path)}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="p-2 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2.5 h-9 text-sm text-muted-foreground hover:bg-muted/50 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign Out
        </Button>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5">Customer Portal · v14</p>
      </div>
    </aside>
  );
};
