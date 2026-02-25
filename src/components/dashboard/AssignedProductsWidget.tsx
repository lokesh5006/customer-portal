import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { Package, Download, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const AssignedProductsWidget = () => {
  const navigate = useNavigate();
  const { currentUser, getUserAssignedProducts } = useApp();

  const assignedProducts = currentUser ? getUserAssignedProducts(currentUser.id) : [];

  // Group by subscription
  const grouped = assignedProducts.reduce<Record<string, { subscriptionName: string; products: string[] }>>((acc, p) => {
    if (!acc[p.subscriptionId]) {
      acc[p.subscriptionId] = { subscriptionName: p.subscriptionName, products: [] };
    }
    acc[p.subscriptionId].products.push(p.productName);
    return acc;
  }, {});

  return (
    <DashboardWidgetCard
      title="My Products"
      icon={Package}
      onClick={() => navigate('/downloads')}
    >
      <div className="space-y-3">
        {assignedProducts.length === 0 ? (
          <div className="text-center py-4">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No products assigned yet</p>
            <p className="text-xs text-muted-foreground mt-1">Contact your administrator for access</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([subId, group]) => (
              <div key={subId} className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{group.subscriptionName}</div>
                {group.products.map((prodName, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                    <span className="font-medium text-sm">{prodName}</span>
                    <Badge variant="outline" className="status-active">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Licensed
                    </Badge>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={(e) => { e.stopPropagation(); navigate('/downloads'); }}
        >
          <Download className="h-4 w-4 mr-2" />
          Downloads
        </Button>
      </div>
    </DashboardWidgetCard>
  );
};
