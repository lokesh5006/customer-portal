import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  Key, 
  FileText, 
  UserPlus, 
  AlertCircle,
  Download,
  LifeBuoy,
  Settings
} from 'lucide-react';

export const QuickActionsWidget = () => {
  const navigate = useNavigate();
  const { hasAccess, getCompanyInvoices } = useApp();
  
  const invoices = getCompanyInvoices();
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const hasOverdue = overdueInvoices.length > 0;
  const totalOverdue = overdueInvoices.reduce((a, i) => a + i.balance, 0);

  const isOwner = hasAccess(['owner']);
  const isBilling = hasAccess(['billing']);
  const isAdmin = hasAccess(['admin']);
  const canManageSubscriptions = isOwner || isBilling;
  const canManageUsers = isOwner || isAdmin;
  const canManageLicenses = isOwner || isAdmin;
  const canViewBilling = isOwner || isBilling;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {/* Pay Now - Priority action when overdue */}
          {canViewBilling && hasOverdue && (
            <Button 
              variant="destructive" 
              onClick={() => navigate('/billing')}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Pay Now – ${totalOverdue.toLocaleString()}
            </Button>
          )}
          
          {/* Manage Subscription - Owner & Billing only */}
          {canManageSubscriptions && (
            <Button variant="outline" onClick={() => navigate('/subscriptions')}>
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Subscriptions
            </Button>
          )}
          
          {/* Invite User - Owner & Admin only */}
          {canManageUsers && (
            <Button variant="outline" onClick={() => navigate('/users')}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          )}
          
          {/* Manage Licenses - Owner & Admin only */}
          {canManageLicenses && (
            <Button variant="outline" onClick={() => navigate('/licenses')}>
              <Key className="h-4 w-4 mr-2" />
              Manage Licenses
            </Button>
          )}
          
          {/* View Invoices - Owner & Billing only */}
          {canViewBilling && !hasOverdue && (
            <Button variant="outline" onClick={() => navigate('/billing')}>
              <FileText className="h-4 w-4 mr-2" />
              View Invoices
            </Button>
          )}
          
          {/* Always available actions */}
          <Button variant="outline" onClick={() => navigate('/downloads')}>
            <Download className="h-4 w-4 mr-2" />
            Downloads
          </Button>
          
          <Button variant="outline" onClick={() => navigate('/support')}>
            <LifeBuoy className="h-4 w-4 mr-2" />
            Support
          </Button>
          
          <Button variant="outline" onClick={() => navigate('/profile')}>
            <Settings className="h-4 w-4 mr-2" />
            Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
