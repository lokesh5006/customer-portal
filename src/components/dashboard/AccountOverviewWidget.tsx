import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { Building2, Calendar, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { openProfileDrawer } from '@/lib/profileDrawer';

export const AccountOverviewWidget = () => {
  const { currentCompany, getCompanySubscriptions, getCompanyUsers } = useApp();
  
  const subscriptions = getCompanySubscriptions();
  const users = getCompanyUsers();
  const hasActiveSubscription = subscriptions.some(s => s.status === 'active');
  
  const accountStatus = hasActiveSubscription ? 'Active' : 'Inactive';
  const memberSince = currentCompany?.createdAt 
    ? new Date(currentCompany.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'N/A';

  return (
    <DashboardWidgetCard
      title="Account Overview"
      icon={Building2}
      onClick={() => openProfileDrawer('profile')}
    >
      <div className="space-y-3">
        <div>
          <div className="text-xl font-bold">{currentCompany?.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <Badge 
              variant="outline" 
              className={hasActiveSubscription ? 'status-active' : 'status-inactive'}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {accountStatus}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Member since {memberSince}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="text-lg font-semibold">{subscriptions.length}</div>
            <div className="text-xs text-muted-foreground">Subscriptions</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{users.filter(u => u.status === 'active').length}</div>
            <div className="text-xs text-muted-foreground">Active Users</div>
          </div>
        </div>
      </div>
    </DashboardWidgetCard>
  );
};
