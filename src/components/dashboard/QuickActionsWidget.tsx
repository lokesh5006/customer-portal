import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  PackagePlus,
  ArrowUpRight,
  CreditCard,
  Download,
  LifeBuoy,
  Settings
} from 'lucide-react';

export const QuickActionsWidget = () => {
  const navigate = useNavigate();
  const { hasAccess, getCompanyInvoices } = useApp();

  const invoices = getCompanyInvoices();
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const hasOverdue = overdueInvoices.length > 0;
  const totalOverdue = overdueInvoices.reduce((a, i) => a + i.balance, 0);

  const isOwner = hasAccess(['owner']);
  const isBilling = hasAccess(['billing']);
  const canManageSubscriptions = isOwner || isBilling;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {canManageSubscriptions && (
            <Button variant="outline" onClick={() => navigate('/signup')}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Buy New Subscription
            </Button>
          )}

          {canManageSubscriptions && (
            <Button variant="outline" onClick={() => navigate('/subscriptions')}>
              <PackagePlus className="h-4 w-4 mr-2" />
              Add Product to Subscription
            </Button>
          )}

          {canManageSubscriptions && (
            <Button variant="outline" onClick={() => navigate('/subscriptions')}>
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Increase Licenses
            </Button>
          )}

          {hasOverdue && canManageSubscriptions && (
            <Button variant="destructive" onClick={() => navigate('/billing')}>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Invoice – ${totalOverdue.toLocaleString()}
            </Button>
          )}

          {!hasOverdue && canManageSubscriptions && (
            <Button variant="outline" onClick={() => navigate('/billing')}>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Invoice
            </Button>
          )}

          <Button variant="outline" onClick={() => navigate('/downloads')}>
            <Download className="h-4 w-4 mr-2" />
            Downloads
          </Button>

          <Button variant="outline" onClick={() => navigate('/support')}>
            <LifeBuoy className="h-4 w-4 mr-2" />
            Support
          </Button>

          <Button variant="outline" onClick={() => navigate('/profile')}>
            <Settings className="h-4 w-4 mr-2" />
            Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
