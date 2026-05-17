import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { CreditCard, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';

export const SubscriptionOverviewWidget = () => {
  const navigate = useNavigate();
  const { getCompanySubscriptions, getAssignedLicenseCount, hasAccess } = useApp();
  const [expandedSubs, setExpandedSubs] = useState<string[]>([]);

  const subscriptions = getCompanySubscriptions();
  const canManage = hasAccess(['account_owner', 'billing_admin']);

  const toggleExpand = (subId: string) => {
    setExpandedSubs(prev =>
      prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
    );
  };

  return (
    <div className="space-y-4">
      {subscriptions.map(sub => {
        const totalLicenses = sub.products.reduce((a, p) => a + p.licenseCount, 0);
        const totalAssigned = sub.products.reduce((a, p) => a + getAssignedLicenseCount(sub.id, p.id), 0);
        const isExpanded = expandedSubs.includes(sub.id);

        return (
          <Card key={sub.id}>
            <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(sub.id)}>
              <CardContent className="p-4">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <div className="font-semibold">{sub.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {sub.billingFrequency} · Renews {new Date(sub.renewalDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`status-${sub.status === 'active' ? 'active' : sub.status === 'pending' ? 'invited' : 'inactive'}`}>
                        {sub.status}
                      </Badge>
                      <div className="text-right text-sm">
                        <div>{sub.products.length} products</div>
                        <div className="text-muted-foreground">{totalAssigned}/{totalLicenses} licenses</div>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mt-4 border-t pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Purchased</TableHead>
                          <TableHead className="text-center">Assigned</TableHead>
                          <TableHead className="text-center">Available</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sub.products.map(prod => {
                          const assigned = getAssignedLicenseCount(sub.id, prod.id);
                          const available = prod.licenseCount - assigned;
                          return (
                            <TableRow key={prod.id}>
                              <TableCell className="font-medium">{prod.name}</TableCell>
                              <TableCell className="text-center">{prod.licenseCount}</TableCell>
                              <TableCell className="text-center">{assigned}</TableCell>
                              <TableCell className="text-center">{available}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`status-${prod.status === 'active' ? 'active' : 'inactive'}`}>
                                  {prod.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    <div className="flex gap-2 mt-3 flex-wrap">
                      {canManage && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => navigate('/subscriptions')}>
                            Manage Subscription
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/licenses')}>
                            Manage Licenses
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/billing')}>
                            View Invoice
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Collapsible>
          </Card>
        );
      })}

      {subscriptions.length === 0 && (
        <DashboardWidgetCard title="Subscriptions" icon={CreditCard}>
          <p className="text-sm text-muted-foreground">No active subscriptions</p>
        </DashboardWidgetCard>
      )}
    </div>
  );
};
