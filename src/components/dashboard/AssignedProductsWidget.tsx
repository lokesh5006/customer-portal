import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { Package, Download, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const AssignedProductsWidget = () => {
  const navigate = useNavigate();
  const { currentUser, licenses, getCompanySubscriptions } = useApp();
  
  const subscriptions = getCompanySubscriptions();
  const userLicenses = licenses.filter(l => l.userId === currentUser?.id);
  
  const assignedProducts = userLicenses.map(license => {
    const subscription = subscriptions.find(s => s.product === license.productId);
    return {
      name: license.productId,
      assignedAt: license.assignedAt,
      status: subscription?.status || 'active',
    };
  });

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
          <div className="space-y-2">
            {assignedProducts.map((product, idx) => (
              <div key={idx} className="p-3 bg-muted/50 rounded-md space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Assigned {new Date(product.assignedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="outline" className="status-active">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Licensed
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={(e) => { e.stopPropagation(); navigate('/downloads'); }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardWidgetCard>
  );
};
