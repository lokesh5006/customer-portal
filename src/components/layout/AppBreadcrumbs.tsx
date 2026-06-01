import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface Crumb {
  label: string;
  path?: string; // omit for the current (last) page
}

// Route → breadcrumb trail. Every authenticated page hangs off Dashboard.
const TRAILS: Record<string, Crumb[]> = {
  '/dashboard': [{ label: 'Dashboard' }],
  '/subscriptions': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Subscriptions' }],
  '/checkout': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Subscriptions', path: '/subscriptions' }, { label: 'Checkout' }],
  '/users': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Users & Contacts' }],
  '/users-contacts': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Users & Contacts' }],
  '/contacts': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Users & Contacts' }],
  '/invoices': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Invoices' }],
  '/billing': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Invoices' }],
  '/pay': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Invoices', path: '/invoices' }, { label: 'Payment' }],
  '/quotes': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Quotes' }],
  '/downloads': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Product Downloads & Links' }],
  '/datanet': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'DataNet' }],
  '/news': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'News' }],
  '/support': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Support' }],
  '/admin': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Admin Tool' }],
};

export const AppBreadcrumbs = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { subscriptions } = useApp();

  let trail = TRAILS[location.pathname];

  // Dynamic subscription detail route: Dashboard > Subscriptions > {name}
  if (!trail && location.pathname.startsWith('/subscriptions/')) {
    const id = location.pathname.split('/')[2];
    const sub = subscriptions.find(s => s.id === id);
    trail = [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Subscriptions', path: '/subscriptions' },
      { label: sub?.name || 'Subscription' },
    ];
  }

  if (!trail) return null;

  return (
    <Breadcrumb className="mb-3">
      <BreadcrumbList className="text-xs">
        {trail.map((c, i) => {
          const isLast = i === trail.length - 1;
          return (
            <BreadcrumbItem key={`${c.label}-${i}`}>
              {isLast || !c.path ? (
                <BreadcrumbPage className="text-xs">{c.label}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink
                    className="text-xs cursor-pointer"
                    onClick={() => navigate(c.path!)}
                  >
                    {c.label}
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
