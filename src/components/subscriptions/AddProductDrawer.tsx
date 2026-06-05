import { useEffect, useMemo, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp, Subscription, PRODUCT_CATALOG } from '@/contexts/AppContext';
import { calculateProratedAdd } from '@/lib/proration';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';
import { Plus, Minus, ArrowLeft, Package } from 'lucide-react';

const TAX_RATE = 0.07;
const round2 = (n: number) => Math.round(n * 100) / 100;

/* ============================================================
 * Add Product Drawer (v19)
 *
 * Two-step flow:
 *   1. Pick a catalog product not yet on this subscription.
 *   2. Choose seats + review a checkout-style order summary.
 * Confirm adds the product as Pay-on-Receipt (pending_payment) — it co-terminates
 * with the parent subscription and activates when the generated invoice is paid.
 * ========================================================== */
export const AddProductDrawer = ({
  open, onOpenChange, subscription,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subscription: Subscription | null;
}) => {
  const {
    getCatalogProduct, useLegacyProration, addProductToSubscriptionPendingPayment, subscriptions,
  } = useApp();
  const { toast } = useToast();

  const liveSub = useMemo(
    () => (subscription ? subscriptions.find(s => s.id === subscription.id) ?? subscription : null),
    [subscriptions, subscription],
  );

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [seats, setSeats] = useState(1);

  useEffect(() => {
    if (open) {
      setSelectedName(null);
      setSeats(1);
    }
  }, [open]);

  const availableProducts = useMemo(() => {
    if (!liveSub) return [];
    // DataNet is auto-included company-wide and has no seat management.
    return PRODUCT_CATALOG.filter(c => c.name !== 'DataNet' && !liveSub.products.some(p => p.name === c.name));
  }, [liveSub]);

  if (!liveSub) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl" />
      </Sheet>
    );
  }

  const catalog = selectedName ? getCatalogProduct(selectedName) : undefined;
  const catalogMeta = selectedName ? PRODUCT_CATALOG.find(c => c.name === selectedName) : undefined;
  const pricePerSeat = catalog?.pricePerSeatPerYear ?? 0;
  const maintenancePerSeat = catalog?.maintenancePerSeatPerYear ?? 0;
  const renewalDate = new Date(liveSub.renewalDate);
  const daysRemaining = Math.max(0, Math.ceil((renewalDate.getTime() - Date.now()) / 86400000));
  const renewalDateLabel = renewalDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  const proration = selectedName
    ? calculateProratedAdd({
        product: { pricePerSeatPerYear: pricePerSeat, maintenancePerSeatPerYear: maintenancePerSeat },
        seats,
        addDate: new Date(),
        renewalDate,
        useLegacyProration,
      })
    : null;
  const subtotal = proration?.totalCharge ?? 0;
  const tax = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + tax);

  const handleConfirm = () => {
    if (!selectedName) return;
    const res = addProductToSubscriptionPendingPayment({
      subscriptionId: liveSub.id,
      productName: selectedName,
      seats,
    });
    if (res) {
      toast({
        title: `Added ${selectedName} pending payment.`,
        description: `Invoice ${res.invoice.invoiceNumber} created.`,
      });
      onOpenChange(false);
    } else {
      toast({ title: 'Could not add product', variant: 'destructive' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 space-y-1">
          <SheetTitle className="text-lg">Add Product to Subscription</SheetTitle>
          <SheetDescription>{liveSub.name} · co-terminates on {renewalDateLabel}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          {/* Step 1 — pick product */}
          {!selectedName && (
            <>
              <h3 className="text-sm font-semibold">Available products</h3>
              {availableProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Your subscription already includes all available products.
                </p>
              ) : (
                <div className="space-y-2">
                  {availableProducts.map(p => (
                    <div key={p.name} className="flex items-center gap-3 border rounded-md p-3">
                      <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.description}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{formatCurrency(p.defaultPrice)}/year per seat</div>
                      </div>
                      <Button size="sm" onClick={() => { setSelectedName(p.name); setSeats(1); }}>Select</Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step 2 — seats + order summary */}
          {selectedName && (
            <>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">Add {selectedName}</div>
                  {catalogMeta && <div className="text-xs text-muted-foreground truncate">{catalogMeta.description}</div>}
                </div>
                <Button variant="link" size="sm" className="h-7 px-0" onClick={() => setSelectedName(null)}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />Change
                </Button>
              </div>

              <div>
                <Label className="text-sm">Seats</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9" disabled={seats <= 1}
                    onClick={() => setSeats(v => Math.max(1, v - 1))} aria-label="Decrease seats">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input type="number" min={1} value={seats}
                    onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-9 w-20 text-center text-base font-semibold" />
                  <Button variant="outline" size="icon" className="h-9 w-9"
                    onClick={() => setSeats(v => v + 1)} aria-label="Increase seats">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Checkout-style order summary */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-semibold">Order Summary</div>
                <div className="flex items-start justify-between text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{selectedName} × {seats}</div>
                    <div className="text-xs text-muted-foreground">Prorated for {daysRemaining} of 365 days</div>
                  </div>
                  <span className="font-medium shrink-0">{formatCurrency(subtotal)}</span>
                </div>
                <div className="border-t pt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax (7%)</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                This product will be added as pending payment and co-terminates with your subscription
                on {renewalDateLabel}. Seats activate once the invoice is paid.
              </p>
            </>
          )}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {selectedName && (
            <Button onClick={handleConfirm}>Add product (Pay on Receipt)</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
