import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { Key, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const LicenseUtilizationWidget = () => {
  const navigate = useNavigate();
  const { getCompanySubscriptions, getAssignedLicenseCount, hasAccess } = useApp();
  
  const subscriptions = getCompanySubscriptions();
  const canManage = hasAccess(['owner', 'admin']);

  return (
    <DashboardWidgetCard 
      title="License Utilization" 
      icon={Key}
      onClick={() => navigate('/licenses')}
    >
      <div className="space-y-4">
        {subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No licenses to display</p>
        ) : (
          subscriptions.map(sub => {
            const assigned = getAssignedLicenseCount(sub.product);
            const total = sub.purchasedSeats;
            const percentage = total > 0 ? Math.round((assigned / total) * 100) : 0;
            const available = total - assigned;
            const isNearCapacity = percentage >= 90;
            const isAtCapacity = percentage >= 100;
            
            return (
              <div key={sub.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{sub.product}</span>
                  {isAtCapacity && (
                    <Badge variant="outline" className="status-overdue">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      At Capacity
                    </Badge>
                  )}
                  {isNearCapacity && !isAtCapacity && (
                    <Badge variant="outline" className="status-pending">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Near Capacity
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{assigned}</span>
                  <span className="text-muted-foreground">/ {total} seats</span>
                </div>
                
                <Progress 
                  value={percentage} 
                  className={`h-2 ${isAtCapacity ? '[&>div]:bg-destructive' : isNearCapacity ? '[&>div]:bg-warning' : ''}`}
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{percentage}% utilized</span>
                  <span>{available} available</span>
                </div>
              </div>
            );
          })
        )}
        
        {canManage && subscriptions.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={(e) => { e.stopPropagation(); navigate('/licenses'); }}
          >
            Manage Licenses
          </Button>
        )}
      </div>
    </DashboardWidgetCard>
  );
};
