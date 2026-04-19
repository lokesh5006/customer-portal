import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Key,
  Download,
  HelpCircle,
  User,
  LogOut,
  Newspaper,
  Contact,
  FileText,
  FileSignature,
} from 'lucide-react';
import { useApp, UserRole } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  requiredRoles: UserRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', requiredRoles: ['owner', 'billing', 'admin', 'standard'] },
  { label: 'Subscriptions', icon: CreditCard, path: '/subscriptions', requiredRoles: ['owner', 'billing', 'admin'] },
  { label: 'License Assignments', icon: Key, path: '/licenses', requiredRoles: ['owner', 'admin'] },
  { label: 'Users', icon: Users, path: '/users', requiredRoles: ['owner', 'admin'] },
  { label: 'Contacts', icon: Contact, path: '/contacts', requiredRoles: ['owner', 'billing', 'admin'] },
  { label: 'Product Downloads & Links', icon: Download, path: '/downloads', requiredRoles: ['owner', 'billing', 'admin', 'standard'] },
  { label: 'Invoices', icon: FileText, path: '/invoices', requiredRoles: ['owner', 'billing'] },
  { label: 'Quotes', icon: FileSignature, path: '/quotes', requiredRoles: ['owner', 'billing'] },
  { label: 'Support', icon: HelpCircle, path: '/support', requiredRoles: ['owner', 'billing', 'admin', 'standard'] },
  { label: 'News', icon: Newspaper, path: '/news', requiredRoles: ['owner', 'billing', 'admin', 'standard'] },
  { label: 'Profile', icon: User, path: '/profile', requiredRoles: ['owner', 'billing', 'admin', 'standard'] },
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasAccess, logout } = useApp();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const visibleItems = navItems.filter(item => hasAccess(item.requiredRoles));

  return (
    <aside className="w-60 border-r bg-card h-[calc(100vh-3.5rem)] sticky top-14 flex flex-col">
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 h-10 text-sm',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              )}
              onClick={() => navigate(item.path)}
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
