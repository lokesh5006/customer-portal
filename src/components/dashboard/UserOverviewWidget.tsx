import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { Users, UserPlus, UserCheck, UserX, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const UserOverviewWidget = () => {
  const navigate = useNavigate();
  const { getCompanyUsers, hasAccess } = useApp();
  
  const users = getCompanyUsers();
  const activeUsers = users.filter(u => u.status === 'active');
  const invitedUsers = users.filter(u => u.status === 'invited');
  const inactiveUsers = users.filter(u => u.status === 'inactive');
  
  const canManage = hasAccess(['owner', 'admin']);

  return (
    <DashboardWidgetCard 
      title="Users" 
      icon={Users}
      onClick={() => navigate('/users')}
    >
      <div className="space-y-3">
        <div className="text-2xl font-bold">{users.length}</div>
        
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-muted/50 rounded-md">
            <div className="flex items-center justify-center gap-1 text-success">
              <UserCheck className="h-4 w-4" />
              <span className="font-semibold">{activeUsers.length}</span>
            </div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div className="p-2 bg-muted/50 rounded-md">
            <div className="flex items-center justify-center gap-1 text-warning">
              <Clock className="h-4 w-4" />
              <span className="font-semibold">{invitedUsers.length}</span>
            </div>
            <div className="text-xs text-muted-foreground">Invited</div>
          </div>
          <div className="p-2 bg-muted/50 rounded-md">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <UserX className="h-4 w-4" />
              <span className="font-semibold">{inactiveUsers.length}</span>
            </div>
            <div className="text-xs text-muted-foreground">Inactive</div>
          </div>
        </div>
        
        {canManage && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={(e) => { e.stopPropagation(); navigate('/users'); }}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        )}
      </div>
    </DashboardWidgetCard>
  );
};
