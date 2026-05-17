import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ReadOnlyBanner } from './ReadOnlyBanner';
import { TrialBanner } from './TrialBanner';
import { useApp, Role } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';

interface MainLayoutProps {
  children: ReactNode;
}

const pageAccess: Record<string, Role[]> = {
  '/dashboard': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/support': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/downloads': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/datanet': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/news': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  // Visibility-only entries; in-page filtering restricts what each role sees.
  '/users': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/users-contacts': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/contacts': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
  '/subscriptions': ['account_owner', 'billing_admin', 'license_admin'],
  '/checkout': ['account_owner', 'billing_admin'],
  '/pay': ['account_owner', 'billing_admin'],
  '/invoices': ['account_owner', 'billing_admin'],
  '/billing': ['account_owner', 'billing_admin'],
  '/quotes': ['account_owner', 'billing_admin'],
  '/admin': ['account_owner', 'license_admin'],
};

export const MainLayout = ({ children }: MainLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, hasAccess, isFirstTimeCustomer, hasSentQuote, hasDeclinedQuote, isReadOnlyMode } = useApp();
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    const currentPath = location.pathname;
    const requiredRoles = pageAccess[currentPath];

    if (requiredRoles && !hasAccess(requiredRoles)) {
      toast({
        title: 'Access Denied',
        description: 'Your role does not have access to that page.',
        variant: 'destructive',
      });
      navigate('/dashboard');
      return;
    }

    // Read-only mode (Pending Payment) — show all menus but disable CRUD per-page.
    // The first-time gate only kicks in when we're NOT yet in pending payment.
    if (isFirstTimeCustomer() && !isReadOnlyMode()) {
      let allowed: string[];
      if (hasSentQuote() && !hasDeclinedQuote()) {
        allowed = ['/quotes', '/support', '/pay'];
      } else if (hasSentQuote() && hasDeclinedQuote()) {
        allowed = ['/quotes', '/support', '/subscriptions', '/checkout', '/pay'];
      } else {
        allowed = ['/subscriptions', '/checkout', '/support', '/pay'];
      }
      if (!allowed.includes(currentPath)) {
        navigate(hasSentQuote() && !hasDeclinedQuote() ? '/quotes' : '/subscriptions');
      }
    }
  }, [isAuthenticated, location.pathname, hasAccess, isFirstTimeCustomer, hasSentQuote, hasDeclinedQuote, isReadOnlyMode, navigate, toast]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <ReadOnlyBanner />
      <TrialBanner />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="p-6 max-w-7xl mx-auto w-full animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
