import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export const OverdueAlertBanner = () => {
  const navigate = useNavigate();
  const { getCompanyInvoices, hasAccess } = useApp();
  
  const canViewBilling = hasAccess(['owner', 'billing']);
  const invoices = getCompanyInvoices();
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  
  if (!canViewBilling || overdueInvoices.length === 0) {
    return null;
  }
  
  const totalOverdue = overdueInvoices.reduce((a, i) => a + i.balance, 0);

  return (
    <Card className="border-destructive bg-destructive/5">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-destructive/10 rounded-full">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-destructive">Payment Overdue</p>
            <p className="text-sm text-muted-foreground">
              You have {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''} totaling ${totalOverdue.toLocaleString()}
            </p>
          </div>
        </div>
        <Button variant="destructive" onClick={() => navigate('/billing')}>
          Pay Now
        </Button>
      </CardContent>
    </Card>
  );
};
