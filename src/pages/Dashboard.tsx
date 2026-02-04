import { useApp } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';

// Dashboard widgets
import { OverdueAlertBanner } from '@/components/dashboard/OverdueAlertBanner';
import { AccountOverviewWidget } from '@/components/dashboard/AccountOverviewWidget';
import { SubscriptionSummaryWidget } from '@/components/dashboard/SubscriptionSummaryWidget';
import { BillingStatusWidget } from '@/components/dashboard/BillingStatusWidget';
import { LicenseUtilizationWidget } from '@/components/dashboard/LicenseUtilizationWidget';
import { UserOverviewWidget } from '@/components/dashboard/UserOverviewWidget';
import { DownloadsWidget } from '@/components/dashboard/DownloadsWidget';
import { SupportSnapshotWidget } from '@/components/dashboard/SupportSnapshotWidget';
import { AssignedProductsWidget } from '@/components/dashboard/AssignedProductsWidget';
import { MyTicketsWidget } from '@/components/dashboard/MyTicketsWidget';
import { PaymentHistoryWidget } from '@/components/dashboard/PaymentHistoryWidget';
import { QuickActionsWidget } from '@/components/dashboard/QuickActionsWidget';

export const Dashboard = () => {
  const { currentCompany, hasAccess, demoRoles } = useApp();

  // Role checks
  const isOwner = hasAccess(['owner']);
  const isBilling = hasAccess(['billing']);
  const isAdmin = hasAccess(['admin']);
  const isStandard = demoRoles.length === 1 && demoRoles[0] === 'standard';

  // Combined permissions
  const canViewBilling = isOwner || isBilling;
  const canViewUsers = isOwner || isAdmin;
  const canViewLicenses = isOwner || isAdmin;
  const canViewSubscriptions = isOwner || isBilling || isAdmin;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to {currentCompany?.name}</p>
        </div>

        {/* Overdue Alert Banner - Owner & Billing only */}
        <OverdueAlertBanner />

        {/* Account Owner Dashboard */}
        {isOwner && !isBilling && !isAdmin && (
          <>
            {/* Top Row - Critical Status */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AccountOverviewWidget />
              <BillingStatusWidget />
              <LicenseUtilizationWidget />
            </div>
            
            {/* Middle Row - Operational KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <SubscriptionSummaryWidget />
              <UserOverviewWidget />
              <SupportSnapshotWidget />
            </div>
            
            {/* Bottom Row - Actions & Resources */}
            <QuickActionsWidget />
            <DownloadsWidget />
          </>
        )}

        {/* Billing User Dashboard */}
        {isBilling && !isOwner && !isAdmin && (
          <>
            {/* Top Row - Billing Focus */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <BillingStatusWidget />
              <SubscriptionSummaryWidget />
              <PaymentHistoryWidget />
            </div>
            
            {/* Middle Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <SupportSnapshotWidget />
              <DownloadsWidget />
            </div>
            
            {/* Bottom Row */}
            <QuickActionsWidget />
          </>
        )}

        {/* Firm Admin Dashboard */}
        {isAdmin && !isOwner && !isBilling && (
          <>
            {/* Top Row - User & License Focus */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <UserOverviewWidget />
              <LicenseUtilizationWidget />
              <SupportSnapshotWidget />
            </div>
            
            {/* Middle Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <SubscriptionSummaryWidget />
              <DownloadsWidget />
            </div>
            
            {/* Bottom Row */}
            <QuickActionsWidget />
          </>
        )}

        {/* Standard User Dashboard */}
        {isStandard && (
          <>
            {/* Top Row - Personal Focus */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AssignedProductsWidget />
              <MyTicketsWidget />
              <DownloadsWidget />
            </div>
            
            {/* Bottom Row */}
            <QuickActionsWidget />
          </>
        )}

        {/* Multi-Role Dashboard (Owner + others or combined roles) */}
        {((isOwner && (isBilling || isAdmin)) || (isBilling && isAdmin)) && (
          <>
            {/* Top Row - Critical Status */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <AccountOverviewWidget />
              {canViewBilling && <BillingStatusWidget />}
              {canViewLicenses && <LicenseUtilizationWidget />}
              {canViewUsers && <UserOverviewWidget />}
            </div>
            
            {/* Middle Row - Details */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {canViewSubscriptions && <SubscriptionSummaryWidget />}
              {canViewBilling && <PaymentHistoryWidget />}
              <SupportSnapshotWidget />
            </div>
            
            {/* Bottom Row - Actions & Resources */}
            <QuickActionsWidget />
            <DownloadsWidget />
          </>
        )}
      </div>
    </MainLayout>
  );
};
