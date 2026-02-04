import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { CreditCard, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const SubscriptionSummaryWidget = () => {
  const navigate = useNavigate();
  const { getCompanySubscriptions, hasAccess } = useApp();
  
  const subscriptions = getCompanySubscriptions();
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
  const canManage = hasAccess(['owner', 'billing']);

  return (
    <DashboardWidgetCard 
      title="Subscriptions" 
      icon={CreditCard}
      onClick={() => navigate('/subscriptions')}
    >
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{subscriptions.length}</span>
          <span className="text-sm text-muted-foreground">
            {activeSubscriptions.length} active
          </span>
        </div>
        
        {subscriptions.length > 0 ? (
          <div className="space-y-2">
            {subscriptions.slice(0, 2).map(sub => (
              <div 
                key={sub.id} 
                className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
              >
                <div>
                  <div className="font-medium text-sm">{sub.product}</div>
                  <div className="text-xs text-muted-foreground">
                    {sub.purchasedSeats} seats
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={`status-${sub.status}`}
                >
                  {sub.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active subscriptions</p>
        )}
        
        {canManage && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between"
            onClick={(e) => { e.stopPropagation(); navigate('/subscriptions'); }}
          >
            Manage Subscriptions
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </DashboardWidgetCard>
  );
};
