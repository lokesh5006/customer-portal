import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CreditCard, Key, Download, LifeBuoy, Settings, RefreshCw,
} from 'lucide-react';
import { RenewalFlyout } from '@/components/billing/RenewalFlyout';

export const QuickActionsWidget = () => {
  const navigate = useNavigate();
  const { hasAccess, getCompanyInvoices, getCompanySubscriptions } = useApp();
  const [renewalOpen, setRenewalOpen] = useState(false);

  const invoices = getCompanyInvoices();
  const subs = getCompanySubscriptions();
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const totalOverdue = overdueInvoices.reduce((a, i) => a + i.balance, 0);
  const hasOverdue = overdueInvoices.length > 0;

  const isOwner = hasAccess(['owner']);
  const isBilling = hasAccess(['billing']);
  const canManage = isOwner || isBilling;

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {hasOverdue && canManage && (
            <Button variant="destructive" onClick={() => setRenewalOpen(true)}>
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
          <Button variant="outline" onClick={() => navigate('/profile')}>
            <Settings className="h-4 w-4 mr-2" />Profile
          </Button>
        </div>
      </CardContent>
      <RenewalFlyout
        open={renewalOpen}
        onOpenChange={setRenewalOpen}
        subscription={subs[0] || null}
        renewalPeriod="Jan 1, 2027 → Dec 31, 2027"
      />
    </Card>
  );
};
