import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CreditCard, Key, Download, LifeBuoy, Settings, RefreshCw,
} from 'lucide-react';
import { RenewalFlyout } from '@/components/billing/RenewalFlyout';
import { openProfileDrawer } from '@/lib/profileDrawer';

export const QuickActionsWidget = () => {
  const navigate = useNavigate();
  const { hasAccess, getCompanyInvoices, getCompanySubscriptions } = useApp();
  const [renewalOpen, setRenewalOpen] = useState(false);

  const invoices = getCompanyInvoices();
  const subs = getCompanySubscriptions();
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const totalOverdue = overdueInvoices.reduce((a, i) => a + i.balance, 0);
  const hasOverdue = overdueInvoices.length > 0;

  const isOwner = hasAccess(['account_owner']);
  const isBilling = hasAccess(['billing_admin']);
  const canManage = isOwner || isBilling;

  const payOverdue = () => {
    const first = overdueInvoices[0];
    if (!first) return;
    navigate('/pay', {
      state: {
        source: 'invoice',
        invoiceId: first.id,
        subtotal: first.amount,
        tax: 0,
        totalAmount: first.amount,
        returnTo: '/dashboard',
      },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {hasOverdue && canManage && (
            <Button variant="destructive" onClick={payOverdue}>
              <CreditCard className="h-4 w-4 mr-2" />Pay Dues – ${totalOverdue.toLocaleString()}
            </Button>
          )}
          {canManage && !hasOverdue && (
            <Button variant="outline" onClick={() => setRenewalOpen(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />Renew Subscription
            </Button>
          )}
          {canManage && (
            <Button variant="outline" onClick={() => navigate('/licenses')}>
              <Key className="h-4 w-4 mr-2" />Adjust Licenses
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/downloads')}>
            <Download className="h-4 w-4 mr-2" />Downloads
          </Button>
          <Button variant="outline" onClick={() => navigate('/support')}>
            <LifeBuoy className="h-4 w-4 mr-2" />Support
          </Button>
          <Button variant="outline" onClick={() => openProfileDrawer('profile')}>
            <Settings className="h-4 w-4 mr-2" />Profile
          </Button>
        </div>
      </CardContent>
      <RenewalFlyout
        open={renewalOpen}
        onOpenChange={setRenewalOpen}
        subscriptionId={subs[0]?.id || ''}
      />
    </Card>
  );
};
