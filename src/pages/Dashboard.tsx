import { useApp, UserRole } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Key,
  FileText,
  Users,
  AlertCircle,
  ArrowRight,
  UserPlus,
  Plus,
} from 'lucide-react';

export const Dashboard = () => {
  const navigate = useNavigate();
  const {
    currentCompany,
    getCompanySubscriptions,
    getCompanyInvoices,
    getCompanyUsers,
    getAssignedLicenseCount,
    hasAccess,
    demoRoles,
  } = useApp();

  const subscriptions = getCompanySubscriptions();
  const invoices = getCompanyInvoices();
  const users = getCompanyUsers();
  
  const totalSeats = subscriptions.reduce((acc, s) => acc + s.purchasedSeats, 0);
  const assignedSeats = subscriptions.reduce((acc, s) => acc + getAssignedLicenseCount(s.product), 0);
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const pendingInvoices = invoices.filter(i => i.status === 'pending');

  const isOwner = hasAccess(['owner']);
  const isBilling = hasAccess(['billing']);
  const isAdmin = hasAccess(['admin']);
  const isStandard = demoRoles.length === 1 && demoRoles[0] === 'standard';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to {currentCompany?.name}</p>
        </div>

        {/* Alert for overdue invoices */}
        {(isOwner || isBilling) && overdueInvoices.length > 0 && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Overdue Invoice</p>
                  <p className="text-sm text-muted-foreground">
                    You have {overdueInvoices.length} overdue invoice(s) totaling ${overdueInvoices.reduce((a, i) => a + i.balance, 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => navigate('/billing')}>
                Pay Now
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Subscriptions Card */}
          <Card className="card-hover cursor-pointer" onClick={() => navigate('/subscriptions')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Subscriptions
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscriptions.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {subscriptions.filter(s => s.status === 'active').length} active
              </p>
            </CardContent>
          </Card>

          {/* Licenses Card */}
          {(isOwner || isAdmin) && (
            <Card className="card-hover cursor-pointer" onClick={() => navigate('/licenses')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  License Usage
                </CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{assignedSeats} / {totalSeats}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalSeats - assignedSeats} seats available
                </p>
              </CardContent>
            </Card>
          )}

          {/* Invoices Card - Only show amounts for Owner/Billing */}
          {(isOwner || isBilling) && (
            <Card className="card-hover cursor-pointer" onClick={() => navigate('/billing')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Invoices
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invoices.length}</div>
                <div className="flex gap-2 mt-1">
                  {pendingInvoices.length > 0 && (
                    <Badge variant="outline" className="status-pending text-xs">
                      {pendingInvoices.length} pending
                    </Badge>
                  )}
                  {overdueInvoices.length > 0 && (
                    <Badge variant="outline" className="status-overdue text-xs">
                      {overdueInvoices.length} overdue
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Users Card */}
          {(isOwner || isAdmin) && (
            <Card className="card-hover cursor-pointer" onClick={() => navigate('/users')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Users
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {users.filter(u => u.status === 'active').length} active
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {hasAccess(['owner', 'billing', 'admin']) && (
              <Button variant="outline" onClick={() => navigate('/subscriptions')}>
                <CreditCard className="h-4 w-4 mr-2" />
                View Subscriptions
              </Button>
            )}
            
            {hasAccess(['owner', 'admin']) && (
              <Button variant="outline" onClick={() => navigate('/licenses')}>
                <Key className="h-4 w-4 mr-2" />
                Manage Licenses
              </Button>
            )}
            
            {hasAccess(['owner', 'billing']) && (
              <>
                <Button variant="outline" onClick={() => navigate('/billing')}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Invoices
                </Button>
                {overdueInvoices.length > 0 && (
                  <Button variant="destructive" onClick={() => navigate('/billing')}>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Pay Now
                  </Button>
                )}
              </>
            )}
            
            {hasAccess(['owner', 'admin']) && (
              <Button variant="outline" onClick={() => navigate('/users')}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Standard User Limited View */}
        {isStandard && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                As a Standard User, you have access to:
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => navigate('/downloads')}>
                  Downloads
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={() => navigate('/support')}>
                  Support
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={() => navigate('/profile')}>
                  Profile
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity - Subscriptions */}
        {hasAccess(['owner', 'billing', 'admin']) && subscriptions.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Active Subscriptions</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/subscriptions')}>
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {subscriptions.slice(0, 3).map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{sub.product}</p>
                      <p className="text-sm text-muted-foreground">
                        {sub.purchasedSeats} seats • Renews {new Date(sub.renewalDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="status-active">
                      {sub.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};
