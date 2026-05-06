import { useState, useMemo, useEffect } from 'react';
import { useApp, Subscription } from '@/contexts/AppContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Minus, Plus, AlertTriangle, CheckCircle2, CreditCard, Loader2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RenewalFlyoutProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subscription: Subscription | null;
  /** Renewal Period override label e.g. "Jan 1, 2027 → Dec 31, 2027" */
  renewalPeriod?: string;
}

type RemovalChoice = 'now' | 'eoy' | null;

export const RenewalFlyout = ({ open, onOpenChange, subscription, renewalPeriod }: RenewalFlyoutProps) => {
  const { getAssignedLicenseCount, updateProductLicenseCount, unassignLicense, getCompanyUsers, licenses } = useApp();
  const { toast } = useToast();

  const [seatCounts, setSeatCounts] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<string>('Credit Card');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [removalModalOpen, setRemovalModalOpen] = useState(false);
  const [removalProdId, setRemovalProdId] = useState<string | null>(null);
  const [removals, setRemovals] = useState<Record<string, RemovalChoice>>({});

  useEffect(() => {
    if (subscription && open) {
      const s: Record<string, number> = {};
      subscription.products.forEach(p => { s[p.id] = p.licenseCount; });
      setSeatCounts(s);
      setPaymentStatus('idle');
      setRemovals({});
    }
  }, [subscription, open]);

  const users = getCompanyUsers();
  if (!subscription) return null;

  const baseFee = subscription.baseFee ?? 1000;
  const totalSeats = Object.values(seatCounts).reduce((a, b) => a + b, 0);
  const seatCharges = subscription.products.reduce(
    (a, p) => a + (seatCounts[p.id] ?? p.licenseCount) * (p.pricePerLicense || subscription.perSeatCost || 10),
    0
  );
  const total = baseFee + seatCharges;
  const originalTotal = baseFee + subscription.products.reduce(
    (a, p) => a + p.licenseCount * (p.pricePerLicense || subscription.perSeatCost || 10), 0
  );
  const delta = total - originalTotal;

  const productNeedingRemoval = subscription.products.find(p => {
    const assigned = getAssignedLicenseCount(subscription.id, p.id);
    return (seatCounts[p.id] ?? p.licenseCount) < assigned;
  });

  const requiredRemovalsForProduct = (prodId: string) => {
    const prod = subscription.products.find(p => p.id === prodId);
    if (!prod) return 0;
    const assigned = getAssignedLicenseCount(subscription.id, prodId);
    return Math.max(0, assigned - (seatCounts[prodId] ?? prod.licenseCount));
  };

  const removalsValid = !productNeedingRemoval || (() => {
    const needed = requiredRemovalsForProduct(productNeedingRemoval.id);
    const selected = Object.values(removals).filter(v => v !== null).length;
    return selected >= needed;
  })();

  const adjustSeat = (prodId: string, value: number) => {
    setSeatCounts(prev => ({ ...prev, [prodId]: Math.max(0, Math.min(500, value)) }));
  };

  const resetChanges = () => {
    const s: Record<string, number> = {};
    subscription.products.forEach(p => { s[p.id] = p.licenseCount; });
    setSeatCounts(s);
    setRemovals({});
  };

  const handlePay = async () => {
    if (productNeedingRemoval && !removalsValid) {
      setRemovalProdId(productNeedingRemoval.id);
      setRemovalModalOpen(true);
      return;
    }
    setPaymentStatus('processing');
    await new Promise(r => setTimeout(r, 1500));
    // Demo: 90% success
    if (Math.random() > 0.1) {
      // Apply seat changes
      subscription.products.forEach(p => {
        const newCount = seatCounts[p.id] ?? p.licenseCount;
        if (newCount !== p.licenseCount) {
          updateProductLicenseCount(subscription.id, p.id, newCount);
        }
      });
      // Apply "remove now" users
      Object.entries(removals).forEach(([uid, choice]) => {
        if (choice === 'now' && removalProdId) {
          unassignLicense(uid, subscription.id, removalProdId);
        }
      });
      setPaymentStatus('success');
      toast({ title: 'Renewal payment successful', description: 'Your subscription has been renewed.' });
    } else {
      setPaymentStatus('failed');
    }
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(() => setPaymentStatus('idle'), 300);
  };

  const assignedUsersForRemoval = removalProdId
    ? users.filter(u => licenses.some(l => l.userId === u.id && l.subscriptionId === subscription.id && l.productId === removalProdId))
    : [];

  const removalsSelected = Object.values(removals).filter(v => v !== null).length;
  const removalsNeeded = removalProdId ? requiredRemovalsForProduct(removalProdId) : 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Review &amp; Pay Renewal</SheetTitle>
            <SheetDescription>
              {subscription.name} · Renewal Period {renewalPeriod || 'Jan 1, 2027 → Dec 31, 2027'}
            </SheetDescription>
          </SheetHeader>

          {paymentStatus === 'success' ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
              <h3 className="text-lg font-semibold">Renewal payment successful</h3>
              <p className="text-sm text-muted-foreground">
                {subscription.name} renewed for {renewalPeriod || 'Jan 1, 2027 → Dec 31, 2027'}.
              </p>
              <div className="bg-muted/40 rounded-lg p-3 text-sm text-left max-w-sm mx-auto space-y-1">
                <div className="flex justify-between"><span>Total Paid</span><span className="font-semibold">${total.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Seats</span><span className="font-semibold">{totalSeats}</span></div>
                <div className="flex justify-between"><span>Status</span><Badge variant="outline" className="status-active">Active</Badge></div>
              </div>
              <Button onClick={close}>Done</Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Auto-populated info */}
              <Card className="bg-muted/30">
                <CardContent className="p-3 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Subscription:</span> <span className="font-medium">{subscription.name}</span></div>
                  <div><span className="text-muted-foreground">Base Fee:</span> <span className="font-medium">${baseFee.toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Per-seat cost:</span> <span className="font-medium">${subscription.perSeatCost ?? 10}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="status-overdue">Overdue</Badge></div>
                </CardContent>
              </Card>

              {/* Per-product seat editors */}
              {subscription.products.map(prod => {
                const assigned = getAssignedLicenseCount(subscription.id, prod.id);
                const newCount = seatCounts[prod.id] ?? prod.licenseCount;
                const avail = newCount - assigned;
                const seatDelta = newCount - prod.licenseCount;
                const priceImpact = seatDelta * (prod.pricePerLicense || subscription.perSeatCost || 10);
                return (
                  <Card key={prod.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-sm">{prod.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            Previous: {prod.licenseCount} seats · Assigned: {assigned}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8"
                            onClick={() => adjustSeat(prod.id, newCount - 1)}><Minus className="h-3 w-3" /></Button>
                          <Input type="number" value={newCount}
                            onChange={(e) => adjustSeat(prod.id, parseInt(e.target.value) || 0)}
                            className="w-16 h-8 text-center" />
                          <Button variant="outline" size="icon" className="h-8 w-8"
                            onClick={() => adjustSeat(prod.id, newCount + 1)}><Plus className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className={cn('rounded p-1.5 bg-muted/40 text-center', avail < 0 && 'bg-destructive/10 text-destructive')}>
                          <div className="text-muted-foreground">Available</div>
                          <div className="font-semibold">{avail}</div>
                        </div>
                        <div className="rounded p-1.5 bg-muted/40 text-center">
                          <div className="text-muted-foreground">Δ Seats</div>
                          <div className={cn('font-semibold', seatDelta > 0 && 'text-success', seatDelta < 0 && 'text-destructive')}>
                            {seatDelta > 0 ? `+${seatDelta}` : seatDelta}
                          </div>
                        </div>
                        <div className="rounded p-1.5 bg-muted/40 text-center">
                          <div className="text-muted-foreground">Price impact</div>
                          <div className="font-semibold">{priceImpact >= 0 ? '+' : ''}${priceImpact.toLocaleString()}</div>
                        </div>
                      </div>
                      {avail < 0 && (
                        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 rounded p-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5" />
                          Reducing below assigned users requires removal selection before payment.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Order Summary */}
              <Card className="border-primary/30">
                <CardContent className="p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span>Base Fee</span><span>${baseFee.toLocaleString()}</span></div>
                  {subscription.products.map(p => {
                    const c = seatCounts[p.id] ?? p.licenseCount;
                    const cost = c * (p.pricePerLicense || subscription.perSeatCost || 10);
                    return (
                      <div key={p.id} className="flex justify-between">
                        <span>{p.name} licenses ({c} × ${p.pricePerLicense || subscription.perSeatCost || 10})</span>
                        <span>${cost.toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {delta !== 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Adjustment vs original invoice</span>
                      <span className={delta > 0 ? 'text-success' : 'text-destructive'}>{delta > 0 ? '+' : ''}${delta.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total Due</span>
                    <span className="text-primary">${total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-muted-foreground text-xs">Invoice Status</span>
                    <Badge variant="outline" className={delta !== 0 ? 'status-invited' : 'status-overdue'}>
                      {delta !== 0 ? 'Pending until payment' : 'Overdue'}
                    </Badge>
                  </div>
                  <div className="pt-2">
                    <label className="text-xs text-muted-foreground">Payment Method</label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Credit Card', 'Direct ACH', 'ACH e-Check', 'Paper Check'].map(m =>
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {paymentStatus === 'failed' && (
                <div className="bg-destructive/10 border border-destructive/30 rounded p-3 text-sm text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">Payment failed.</p>
                    <p className="text-xs">No license changes were applied. You can retry or reset.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {paymentStatus !== 'success' && (
            <SheetFooter className="gap-2 flex-row">
              <Button variant="ghost" size="sm" onClick={resetChanges}>
                <RotateCcw className="h-3 w-3 mr-1" />Reset
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={close} disabled={paymentStatus === 'processing'}>Cancel</Button>
              <Button onClick={handlePay} disabled={paymentStatus === 'processing'}>
                {paymentStatus === 'processing' ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing</>
                ) : paymentStatus === 'failed' ? (
                  <><CreditCard className="h-4 w-4 mr-2" />Retry Payment</>
                ) : (
                  <><CreditCard className="h-4 w-4 mr-2" />Pay ${total.toLocaleString()}</>
                )}
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Required removals modal */}
      <Dialog open={removalModalOpen} onOpenChange={setRemovalModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select users to remove from license access</DialogTitle>
            <DialogDescription>
              The selected seat count is lower than the number of currently assigned users.
              Select which users should lose access before payment can continue.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Remove Now</TableHead>
                <TableHead className="text-center">Expire End of Term</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedUsersForRemoval.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-center">
                    <input type="radio" name={`r-${u.id}`} checked={removals[u.id] === 'now'}
                      onChange={() => setRemovals(prev => ({ ...prev, [u.id]: 'now' }))} />
                  </TableCell>
                  <TableCell className="text-center">
                    <input type="radio" name={`r-${u.id}`} checked={removals[u.id] === 'eoy'}
                      onChange={() => setRemovals(prev => ({ ...prev, [u.id]: 'eoy' }))} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className={cn('text-sm', removalsSelected >= removalsNeeded ? 'text-success' : 'text-muted-foreground')}>
            {removalsSelected} of {removalsNeeded} required removals selected
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovalModalOpen(false)}>Back</Button>
            <Button disabled={removalsSelected < removalsNeeded} onClick={() => { setRemovalModalOpen(false); }}>
              Continue to Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
