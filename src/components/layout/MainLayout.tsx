import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useApp, UserRole } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';

interface MainLayoutProps {
  children: ReactNode;
}

const pageAccess: Record<string, UserRole[]> = {
  '/dashboard': ['owner', 'billing', 'admin', 'standard'],
  '/users': ['owner', 'admin'],
  '/subscriptions': ['owner', 'billing', 'admin'],
  '/licenses': ['owner', 'admin'],
  '/billing': ['owner', 'billing'],
  '/downloads': ['owner', 'billing', 'admin', 'standard'],
  '/support': ['owner', 'billing', 'admin', 'standard'],
  '/profile': ['owner', 'billing', 'admin', 'standard'],
};

export const MainLayout = ({ children }: MainLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, hasAccess, getEffectiveRoles } = useApp();
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
    }
  }, [isAuthenticated, location.pathname, hasAccess, navigate, toast]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
