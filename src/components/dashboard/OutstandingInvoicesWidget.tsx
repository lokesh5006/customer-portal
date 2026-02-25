import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { Receipt, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const OutstandingInvoicesWidget = () => {
  const navigate = useNavigate();
  const { getCompanyInvoices } = useApp();

  const invoices = getCompanyInvoices();
  const outstanding = invoices.filter(i => i.status === 'overdue' || i.status === 'pending');
  const sorted = [...outstanding].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <DashboardWidgetCard title="Outstanding Invoices" icon={Receipt} onClick={() => navigate('/billing')}>
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outstanding invoices</p>
        ) : (
          <div className="space-y-2">
            {sorted.slice(0, 4).map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <div>
                  <div className="font-medium text-sm">{inv.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground">{inv.subscriptionName}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">${inv.balance.toLocaleString()}</div>
                  <Badge variant="outline" className={`text-xs ${inv.status === 'overdue' ? 'status-inactive' : 'status-invited'}`}>
                    {inv.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-between" onClick={(e) => { e.stopPropagation(); navigate('/billing'); }}>
          View All Invoices
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </DashboardWidgetCard>
  );
};
