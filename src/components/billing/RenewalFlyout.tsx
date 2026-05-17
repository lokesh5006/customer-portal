import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RenewalFlyoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
  invoiceId?: string;
}

const PRODUCT_INITIALS: Record<string, string> = {
  'NumberCruncher Desktop': 'ND',
  'NumberCruncher Web': 'NW',
  'QuickView Desktop': 'QV',
  'DataNet': 'DN',
};

const initialFor = (name: string) => PRODUCT_INITIALS[name] || name.slice(0, 2).toUpperCase();

const TAX_RATE = 0.07;
const formatMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const round2 = (n: number) => Math.round(n * 100) / 100;

export const RenewalFlyout = ({ open, onOpenChange, subscriptionId, invoiceId }: RenewalFlyoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscriptions, invoices } = useApp();

  const subscription = useMemo(
    () => subscriptions.find(s => s.id === subscriptionId) || null,
    [subscriptions, subscriptionId]
  );
  const linkedInvoice = useMemo(
    () => invoiceId ? invoices.find(i => i.id === invoiceId) || null : null,
    [invoices, invoiceId]
  );

  const [seatCounts, setSeatCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open && subscription) {
      const map: Record<string, number> = {};
      subscription.products.forEach(p => { map[p.id] = p.licenseCount; });
      setSeatCounts(map);
    }
  }, [open, subscription]);

  if (!subscription) return null;

  const periodStart = linkedInvoice?.date || new Date().toISOString();
  const periodEnd = linkedInvoice?.dueDate
    || new Date(new Date(subscription.renewalDate).getTime() + 365 * 86400000).toISOString();
  const formatPeriod = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const anyOtherSelected = subscription.products.some(p => p.name !== 'DataNet');

  const lines = subscription.products.map(p => {
    const isDataNet = p.name === 'DataNet';
    const included = isDataNet && anyOtherSelected;
    const count = seatCounts[p.id] ?? p.licenseCount;
    const unitPrice = p.pricePerLicense || subscription.perSeatCost || 10;
    const amount = included ? 0 : count * unitPrice;
    return {
      productId: p.id,
      productName: p.name,
      licenseCount: count,
      unitPrice,
      amount,
      isDataNet,
      included,
    };
  });

  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0));
  const tax = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + tax);

  const setSeat = (id: string, value: number) => {
    setSeatCounts(prev => ({ ...prev, [id]: Math.max(1, Math.floor(value || 1)) }));
  };

  const stepSeat = (id: string, delta: number) => {
    setSeatCounts(prev => ({ ...prev, [id]: Math.max(1, (prev[id] ?? 1) + delta) }));
  };

  const resetAll = () => {
    const map: Record<string, number> = {};
    subscription.products.forEach(p => { map[p.id] = p.licenseCount; });
    setSeatCounts(map);
  };

  const handlePay = () => {
    const lineItems = lines.map(l => ({
      productName: l.productName,
      licenseCount: l.licenseCount,
      unitPrice: l.included ? 0 : l.unitPrice,
      total: l.amount,
    }));
    const newLicenseCounts: Record<string, number> = {};
    lines.forEach(l => { newLicenseCounts[l.productId] = l.licenseCount; });
    onOpenChange(false);
    navigate('/pay', {
      state: {
        source: 'renewal',
        subscriptionId,
        invoiceId,
        lineItems,
        newLicenseCounts,
        subtotal,
        tax,
        totalAmount: total,
        returnTo: location.pathname,
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>Review &amp; Pay Renewal</SheetTitle>
          <SheetDescription>
            {subscription.name} · Renewal Period {formatPeriod(periodStart)} → {formatPeriod(periodEnd)}
          </SheetDescription>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {lines.map(line => (
            <Card key={line.productId}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox checked disabled className="mt-1.5" aria-label={`${line.productName} included`} />
                  <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                    {initialFor(line.productName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-base font-semibold">{line.productName}</Label>
                      {line.included && (
                        <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/10">
                          Included
                        </Badge>
                      )}
                    </div>
                    {line.isDataNet ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Included with any product selection. If selected alone, DataNet is $29.00/year.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatMoney(line.unitPrice)} per seat/year
                      </p>
                    )}

                    <div className="mt-3">
                      <Label className="text-xs text-muted-foreground">Seats</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          type="button" variant="outline" size="icon" className="h-8 w-8"
                          onClick={() => stepSeat(line.productId, -1)}
                          disabled={line.licenseCount <= 1}
                          aria-label="Decrease seats"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={line.licenseCount}
                          onChange={(e) => setSeat(line.productId, parseInt(e.target.value, 10))}
                          className="h-8 w-16 text-center"
                        />
                        <Button
                          type="button" variant="outline" size="icon" className="h-8 w-8"
                          onClick={() => stepSeat(line.productId, 1)}
                          aria-label="Increase seats"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">Subtotal</div>
                    <div className={cn('text-lg font-semibold mt-0.5', line.included && 'text-success')}>
                      {formatMoney(line.amount)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sticky footer */}
        <div className="border-t bg-card p-4 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (7%)</span>
              <span>{formatMoney(tax)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Balance Due</span>
              <span className="text-primary">{formatMoney(total)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={resetAll}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />Reset
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="h-10" onClick={handlePay}>
              Pay {formatMoney(total)}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
