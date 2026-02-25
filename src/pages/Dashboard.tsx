import { useApp } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';

import { OverdueAlertBanner } from '@/components/dashboard/OverdueAlertBanner';
import { AccountOverviewWidget } from '@/components/dashboard/AccountOverviewWidget';
import { SubscriptionOverviewWidget } from '@/components/dashboard/SubscriptionOverviewWidget';
import { BillingStatusWidget } from '@/components/dashboard/BillingStatusWidget';
import { LicenseUtilizationSummaryWidget } from '@/components/dashboard/LicenseUtilizationSummaryWidget';
import { UserOverviewWidget } from '@/components/dashboard/UserOverviewWidget';
import { DownloadsWidget } from '@/components/dashboard/DownloadsWidget';
import { SupportSnapshotWidget } from '@/components/dashboard/SupportSnapshotWidget';
import { AssignedProductsWidget } from '@/components/dashboard/AssignedProductsWidget';
import { MyTicketsWidget } from '@/components/dashboard/MyTicketsWidget';
import { OutstandingInvoicesWidget } from '@/components/dashboard/OutstandingInvoicesWidget';
import { QuickActionsWidget } from '@/components/dashboard/QuickActionsWidget';

export const Dashboard = () => {
  const { currentCompany, hasAccess, demoRoles } = useApp();

  const isOwner = hasAccess(['owner']);
  const isBilling = hasAccess(['billing']);
  const isAdmin = hasAccess(['admin']);
  const isStandard = demoRoles.length === 1 && demoRoles[0] === 'standard';

  const canViewBilling = isOwner || isBilling;
  const canViewUsers = isOwner || isAdmin;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to {currentCompany?.name}</p>
        </div>

        <OverdueAlertBanner />

        {/* Owner-only Dashboard */}
        {isOwner && !isBilling && !isAdmin && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AccountOverviewWidget />
              <BillingStatusWidget />
              <LicenseUtilizationSummaryWidget />
            </div>
            <SubscriptionOverviewWidget />
            <div className="grid gap-4 md:grid-cols-2">
              <UserOverviewWidget />
              <SupportSnapshotWidget />
            </div>
            <QuickActionsWidget />
            <DownloadsWidget />
          </>
        )}

        {/* Billing-only Dashboard */}
        {isBilling && !isOwner && !isAdmin && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <BillingStatusWidget />
              <OutstandingInvoicesWidget />
              <LicenseUtilizationSummaryWidget />
            </div>
            <SubscriptionOverviewWidget />
            <div className="grid gap-4 md:grid-cols-2">
              <SupportSnapshotWidget />
              <DownloadsWidget />
            </div>
            <QuickActionsWidget />
          </>
        )}

        {/* Admin-only Dashboard */}
        {isAdmin && !isOwner && !isBilling && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <UserOverviewWidget />
              <LicenseUtilizationSummaryWidget />
              <SupportSnapshotWidget />
            </div>
            <SubscriptionOverviewWidget />
            <div className="grid gap-4 md:grid-cols-2">
              <DownloadsWidget />
              <AccountOverviewWidget />
            </div>
            <QuickActionsWidget />
          </>
        )}

        {/* Standard User Dashboard */}
        {isStandard && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AssignedProductsWidget />
              <MyTicketsWidget />
              <DownloadsWidget />
            </div>
            <QuickActionsWidget />
          </>
        )}

        {/* Multi-Role Dashboard */}
        {((isOwner && (isBilling || isAdmin)) || (isBilling && isAdmin)) && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <AccountOverviewWidget />
              {canViewBilling && <BillingStatusWidget />}
              <LicenseUtilizationSummaryWidget />
              {canViewUsers && <UserOverviewWidget />}
            </div>
            <SubscriptionOverviewWidget />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {canViewBilling && <OutstandingInvoicesWidget />}
              <SupportSnapshotWidget />
              <DownloadsWidget />
            </div>
            <QuickActionsWidget />
          </>
        )}
      </div>
    </MainLayout>
  );
};
