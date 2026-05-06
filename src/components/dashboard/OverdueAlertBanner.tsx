import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { RenewalFlyout } from '@/components/billing/RenewalFlyout';

export const OverdueAlertBanner = () => {
  const { getCompanyInvoices, getCompanySubscriptions, hasAccess } = useApp();
  const [open, setOpen] = useState(false);

  const canViewBilling = hasAccess(['owner', 'billing']);
  const invoices = getCompanyInvoices();
  const subs = getCompanySubscriptions();
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');

  if (!canViewBilling || overdueInvoices.length === 0) return null;

  const totalOverdue = overdueInvoices.reduce((a, i) => a + i.balance, 0);
  const sub = subs.find(s => s.id === overdueInvoices[0].subscriptionId) || null;

  return (
    <>
      <Card className="border-destructive bg-destructive/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 rounded-full">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-destructive">Your renewal payment is overdue.</p>
              <p className="text-sm text-muted-foreground">
                Access continues for now, but payment is required to keep the subscription active.
                Outstanding: ${totalOverdue.toLocaleString()}
              </p>
            </div>
          </div>
          <Button variant="destructive" onClick={() => setOpen(true)}>Pay Now</Button>
        </CardContent>
      </Card>
      <RenewalFlyout open={open} onOpenChange={setOpen} subscription={sub} renewalPeriod="Jan 1, 2027 → Dec 31, 2027" />
    </>
  );
};
