import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { FileText, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const BillingStatusWidget = () => {
  const navigate = useNavigate();
  const { getCompanyInvoices } = useApp();
  
  const invoices = getCompanyInvoices();
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  
  const totalOutstanding = [...overdueInvoices, ...pendingInvoices].reduce((a, i) => a + i.balance, 0);
  const hasOverdue = overdueInvoices.length > 0;

  return (
    <DashboardWidgetCard 
      title="Billing Status" 
      icon={FileText}
      className={hasOverdue ? 'border-destructive/50 bg-destructive/5' : ''}
      onClick={() => navigate('/billing')}
    >
      <div className="space-y-3">
        {hasOverdue ? (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <div className="font-bold">Payment Overdue</div>
              <div className="text-sm">${overdueInvoices.reduce((a, i) => a + i.balance, 0).toLocaleString()} past due</div>
            </div>
          </div>
        ) : totalOutstanding > 0 ? (
          <div className="flex items-center gap-2 text-warning">
            <Clock className="h-5 w-5" />
            <div>
              <div className="font-semibold">Payment Due</div>
              <div className="text-sm text-muted-foreground">${totalOutstanding.toLocaleString()} outstanding</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <div className="font-semibold">All Paid</div>
              <div className="text-sm text-muted-foreground">No outstanding balance</div>
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          {overdueInvoices.length > 0 && (
            <Badge variant="outline" className="status-overdue">
              {overdueInvoices.length} overdue
            </Badge>
          )}
          {pendingInvoices.length > 0 && (
            <Badge variant="outline" className="status-pending">
              {pendingInvoices.length} pending
            </Badge>
          )}
          {paidInvoices.length > 0 && (
            <Badge variant="outline" className="status-paid">
              {paidInvoices.length} paid
            </Badge>
          )}
        </div>
        
        {totalOutstanding > 0 && (
          <Button 
            variant={hasOverdue ? 'destructive' : 'default'} 
            size="sm" 
            className="w-full"
            onClick={(e) => { e.stopPropagation(); navigate('/billing'); }}
          >
            Pay Now – ${totalOutstanding.toLocaleString()}
          </Button>
        )}
      </div>
    </DashboardWidgetCard>
  );
};
