import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useApp, Invoice } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';

type BannerVariant = 'pending_payment' | 'suspended';

const VARIANT_CONFIG: Record<BannerVariant, {
  title: string;
  description: string;
  containerClass: string;
  iconClass: string;
}> = {
  pending_payment: {
    title: 'Your subscription is pending payment.',
    description: 'Pay your invoice to unlock full access.',
    containerClass: 'border-warning/30 bg-warning/10',
    iconClass: 'text-warning',
  },
  suspended: {
    title: 'Your subscription is suspended.',
    description: 'Pay your renewal invoice to restore product access and unlock full features.',
    containerClass: 'border-destructive/30 bg-destructive/10',
    iconClass: 'text-destructive',
  },
};

export const ReadOnlyBanner = () => {
  const { isReadOnlyMode, isSuspendedMode, getCompanyInvoices } = useApp();
  const navigate = useNavigate();

  if (!isReadOnlyMode()) return null;

  const variant: BannerVariant = isSuspendedMode() ? 'suspended' : 'pending_payment';
  const config = VARIANT_CONFIG[variant];

  const invoices = getCompanyInvoices();
  const targetInvoice: Invoice | undefined = variant === 'suspended'
    ? invoices.find(i => i.source === 'renewal' && i.status !== 'paid')
    : invoices.find(i => i.status === 'awaiting_payment');
  const total = targetInvoice ? (targetInvoice.totalAmount ?? targetInvoice.amount) : 0;

  return (
    <div className={`border-b px-6 py-3 ${config.containerClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertCircle className={`h-5 w-5 shrink-0 ${config.iconClass}`} />
          <div>
            <p className="text-sm font-medium">{config.title}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </div>
        {targetInvoice && (
          <Button
            size="sm"
            onClick={() => navigate('/pay', {
              state: {
                source: 'invoice',
                invoiceId: targetInvoice.id,
                subtotal: targetInvoice.subtotal ?? total,
                tax: targetInvoice.tax ?? 0,
                totalAmount: total,
                returnTo: '/subscriptions',
              },
            })}
          >
            Pay {formatCurrency(total)}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ReadOnlyBanner;
