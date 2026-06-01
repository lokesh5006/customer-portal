import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, Subscription, SubscriptionProduct } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  ExternalLink,
  Download,
  Users,
  LifeBuoy,
  CreditCard,
  Key,
  ShoppingCart,
  MessageSquare,
  AlertCircle,
  Clock,
  Info,
  ArrowRight,
} from 'lucide-react';

import { OverdueAlertBanner } from '@/components/dashboard/OverdueAlertBanner';
import { SupportSnapshotWidget } from '@/components/dashboard/SupportSnapshotWidget';
import { UserOverviewWidget } from '@/components/dashboard/UserOverviewWidget';
import { QuickActionsWidget } from '@/components/dashboard/QuickActionsWidget';
import { MyTicketsWidget } from '@/components/dashboard/MyTicketsWidget';
import { RenewalFlyout } from '@/components/billing/RenewalFlyout';
import { ManageLicensesDrawer } from '@/components/subscriptions/QuoteDialogs';
import { PageHeader } from '@/components/layout/PageHeader';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, currentCompany, hasAccess, demoRoles, getCompanySubscriptions, getCompanyInvoices, getAssignedLicenseCount } = useApp();
  const [dataNetOptOut, setDataNetOptOut] = useState(false);
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSub, setManageSub] = useState<Subscription | null>(null);
  const [manageProd, setManageProd] = useState<SubscriptionProduct | null>(null);

  const openManageSeats = (sub: Subscription, prod: SubscriptionProduct) => {
    setManageSub(sub);
    setManageProd(prod);
    setManageOpen(true);
  };

  const isOwner = hasAccess(['account_owner']);
  const isBilling = hasAccess(['billing_admin']);
  const isAdmin = hasAccess(['license_admin']);
  const isStandard = demoRoles.length === 1 && demoRoles[0] === 'registered_contact';
  const canViewBilling = isOwner || isBilling;
  const canViewUsers = isOwner || isAdmin;

  const subscriptions = getCompanySubscriptions();
  const invoices = getCompanyInvoices();
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const totalOutstanding = [...overdueInvoices, ...pendingInvoices].reduce((a, i) => a + i.balance, 0);

  // Determine account status
  const getAccountStatus = () => {
    if (overdueInvoices.length > 0) return 'overdue';
    if (pendingInvoices.length > 0) return 'pending';
    return 'current';
  };
  const accountStatus = getAccountStatus();

  // Get renewal date from first active subscription
  const nextRenewal = subscriptions.find(s => s.status === 'active')?.renewalDate;
  const renewalFormatted = nextRenewal
    ? new Date(nextRenewal).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'N/A';

  const firstName = currentUser?.firstName || 'Customer';

  return (
    <MainLayout>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${firstName}.`}
      />
      <div className="space-y-4">
        <OverdueAlertBanner />

        {/* Top Row: Account Status (wide) + DataNet (narrow) */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Account Status Card - spans 2 cols */}
          <Card className={`md:col-span-2 ${
            accountStatus === 'current' ? 'bg-success/5 border-success/20' :
            accountStatus === 'pending' ? 'bg-warning/5 border-warning/20' :
            'bg-destructive/5 border-destructive/20'
          }`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Account Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  {accountStatus === 'current' && (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-6 w-6 text-success" />
                        <span className="text-xl font-bold text-success">Account is Current</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Renews {renewalFormatted}
                      </p>
                    </>
                  )}
                  {accountStatus === 'pending' && (
                    <>
                      <div className="flex items-center gap-2">
                        <Clock className="h-6 w-6 text-warning" />
                        <span className="text-xl font-bold text-warning">Additional License Invoice Due</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        ${totalOutstanding.toLocaleString()} outstanding
                      </p>
                    </>
                  )}
                  {accountStatus === 'overdue' && (
                    <>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                        <span className="text-xl font-bold text-destructive">Annual Fee Due</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        ${totalOutstanding.toLocaleString()} past due &middot; Renews {renewalFormatted}
                      </p>
                    </>
                  )}

                  <div className="flex items-center gap-4 pt-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Subscriptions:</span>{' '}
                      <span className="font-semibold">{subscriptions.length}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Products:</span>{' '}
                      <span className="font-semibold">{subscriptions.reduce((a, s) => a + s.products.length, 0)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total Seats:</span>{' '}
                      <span className="font-semibold">
                        {subscriptions.reduce((a, s) => a + s.products.reduce((b, p) => b + p.licenseCount, 0), 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {totalOutstanding > 0 && canViewBilling && (
                  <Button
                    variant={accountStatus === 'overdue' ? 'destructive' : 'default'}
                    onClick={() => {
                      const first = overdueInvoices[0] || pendingInvoices[0];
                      if (first) {
                        navigate('/pay', {
                          state: {
                            source: 'invoice',
                            invoiceId: first.id,
                            subtotal: first.amount,
                            tax: 0,
                            totalAmount: first.amount,
                            returnTo: '/dashboard',
                          },
                        });
                      } else {
                        setRenewalOpen(true);
                      }
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />Pay Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* DataNet Card */}
          <Card className="cursor-pointer hover:shadow-md hover:border-primary/20 transition-all" onClick={() => navigate('/datanet')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">DataNet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <span className="text-primary font-medium inline-flex items-center gap-1 hover:underline">
                  Current DataNet
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
                <p className="text-xs text-muted-foreground">Access the latest industry data and alerts</p>
                <div className="flex items-center gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    id="datanet-optout"
                    checked={!dataNetOptOut}
                    onCheckedChange={(v) => setDataNetOptOut(!v)}
                  />
                  <Label htmlFor="datanet-optout" className="text-xs text-muted-foreground cursor-pointer">
                    Receive DataNet emails
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Download version info */}
        <Card className="bg-accent/30 border-accent">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              <span className="text-sm">
                Your last download was <strong>NumberCruncher v4.1</strong> &mdash; <strong>v4.2 is available</strong>.
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/downloads')}>
              <Download className="h-4 w-4 mr-1" />Update Now
            </Button>
          </CardContent>
        </Card>

        {/* License Assignments Summary */}
        {!isStandard && (() => {
          const activeSubs = subscriptions.filter(s => s.status === 'active');
          const seatProducts = activeSubs.flatMap(sub =>
            sub.products
              .filter(p => p.name !== 'DataNet')
              .map(p => ({ sub, prod: p }))
          );
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">License Assignments</h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/licenses')}>
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              {seatProducts.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    No active products yet.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {seatProducts.map(({ sub, prod }) => {
                    const assigned = getAssignedLicenseCount(sub.id, prod.id);
                    const hasScheduledChange = prod.scheduledLicenseCount !== undefined;
                    return (
                      <button
                        key={`${sub.id}-${prod.id}`}
                        onClick={() => openManageSeats(sub, prod)}
                        aria-label={`Manage seats for ${prod.name}, ${assigned} of ${prod.licenseCount} assigned`}
                        className="text-left rounded-md border bg-card hover:bg-muted/40 hover:shadow-sm transition-all p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{prod.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{sub.name} &middot; {sub.planType}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {hasScheduledChange && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Clock className="h-4 w-4 text-info" aria-label="Scheduled renewal change pending" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Scheduled change on renewal: {prod.licenseCount} → {prod.scheduledLicenseCount} seats
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <span className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-sm font-semibold text-primary">
                              {assigned}/{prod.licenseCount}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Bottom widgets */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {canViewUsers && <UserOverviewWidget />}
          <SupportSnapshotWidget />
          {isStandard && <MyTicketsWidget />}
        </div>

        <QuickActionsWidget />
      </div>
      <RenewalFlyout
        open={renewalOpen}
        onOpenChange={setRenewalOpen}
        subscriptionId={subscriptions[0]?.id || ''}
      />
      <ManageLicensesDrawer
        open={manageOpen}
        onOpenChange={setManageOpen}
        subscription={manageSub}
        product={manageProd}
      />
    </MainLayout>
  );
};
