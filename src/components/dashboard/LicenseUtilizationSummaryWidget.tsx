import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { Key } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

export const LicenseUtilizationSummaryWidget = () => {
  const navigate = useNavigate();
  const { getCompanySubscriptions, getAssignedLicenseCount, hasAccess } = useApp();

  const subscriptions = getCompanySubscriptions();
  const canManage = hasAccess(['account_owner', 'license_admin']);

  const rows = subscriptions.flatMap(sub =>
    sub.products.map(prod => {
      const assigned = getAssignedLicenseCount(sub.id, prod.id);
      const pct = prod.licenseCount > 0 ? Math.round((assigned / prod.licenseCount) * 100) : 0;
      return { subName: sub.name, prodName: prod.name, total: prod.licenseCount, assigned, available: prod.licenseCount - assigned, pct };
    })
  );

  return (
    <DashboardWidgetCard title="License Utilization" icon={Key} onClick={() => navigate('/licenses')}>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No licenses to display</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium truncate">{r.prodName}</span>
                  <span className="text-muted-foreground">{r.assigned}/{r.total}</span>
                </div>
                <Progress
                  value={r.pct}
                  className={`h-2 ${r.pct >= 100 ? '[&>div]:bg-destructive' : r.pct >= 90 ? '[&>div]:bg-warning' : ''}`}
                />
                <div className="text-xs text-muted-foreground">{r.subName} · {r.available} available</div>
              </div>
            ))}
          </div>
        )}
        {canManage && rows.length > 0 && (
          <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); navigate('/licenses'); }}>
            Manage Licenses
          </Button>
        )}
      </div>
    </DashboardWidgetCard>
  );
};
