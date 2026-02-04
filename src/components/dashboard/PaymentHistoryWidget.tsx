import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { Receipt, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const PaymentHistoryWidget = () => {
  const navigate = useNavigate();
  const { getCompanyInvoices } = useApp();
  
  const invoices = getCompanyInvoices();
  const sortedInvoices = [...invoices].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <DashboardWidgetCard 
      title="Recent Payments" 
      icon={Receipt}
      onClick={() => navigate('/billing')}
    >
      <div className="space-y-3">
        {sortedInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment history</p>
        ) : (
          <div className="space-y-2">
            {sortedInvoices.slice(0, 3).map(invoice => (
              <div key={invoice.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <div>
                  <div className="font-medium text-sm">{invoice.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(invoice.date).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">${invoice.amount.toLocaleString()}</div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs status-${invoice.status}`}
                  >
                    {invoice.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-between"
          onClick={(e) => { e.stopPropagation(); navigate('/billing'); }}
        >
          View All Invoices
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </DashboardWidgetCard>
  );
};
