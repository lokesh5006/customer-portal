import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useApp, Subscription, SubscriptionProduct, Quote, PRODUCT_CATALOG } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, CheckCircle2, AlertTriangle, FileSignature, X } from 'lucide-react';

/* ============================================================
 * Manage Licenses Drawer (Sheet, right-side)
 * ========================================================== */
export const ManageLicensesDrawer = ({
  open, onOpenChange, subscription, product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subscription: Subscription | null;
  product: SubscriptionProduct | null;
}) => {
  const { getAssignedLicenseCount, updateProductLicenseCount } = useApp();
  const { toast } = useToast();
  const purchased = product?.purchasedLicenseCount ?? product?.licenseCount ?? 0;
  const current = product?.licenseCount ?? 0;
  const assigned = subscription && product ? getAssignedLicenseCount(subscription.id, product.id) : 0;

  const [seatCount, setSeatCount] = useState(current);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setSeatCount(current);
    setSavedMessage(null);
  }, [current, product?.id, open]);

  const minusDisabled = seatCount <= purchased;
  const delta = seatCount - current;

  const handleSave = () => {
    if (!subscription || !product) return;
    if (delta === 0) {
      setSavedMessage('No license changes to save.');
      return;
    }
    updateProductLicenseCount(subscription.id, product.id, seatCount);
    setSavedMessage(`License changes saved successfully. Seat count is now ${seatCount}.`);
    toast({ title: 'License changes saved', description: `${product.name}: ${seatCount} seats` });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage Licenses</SheetTitle>
          <SheetDescription>
            Adjust seats for this product. Seat count cannot go below the originally purchased count.
          </SheetDescription>
        </SheetHeader>

        {subscription && product && (
          <div className="space-y-5 py-4">
            <div className="rounded-md border p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="font-medium">{product.name}</div>
                <Badge variant="outline" className="status-active">{subscription.name}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs pt-2">
                <div><div className="text-muted-foreground">Purchased</div><div className="font-semibold text-sm">{purchased}</div></div>
                <div><div className="text-muted-foreground">Current Seats</div><div className="font-semibold text-sm">{current}</div></div>
                <div><div className="text-muted-foreground">Assigned</div><div className="font-semibold text-sm">{assigned}</div></div>
              </div>
            </div>

            <div>
              <Label className="text-sm">New Seat Count</Label>
              <div className="flex items-center justify-center gap-3 mt-2">
                <Button
                  variant="outline" size="icon"
                  onClick={() => setSeatCount(s => Math.max(purchased, s - 1))}
                  disabled={minusDisabled}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number" min={purchased} value={seatCount}
                  onChange={(e) => setSeatCount(Math.max(purchased, parseInt(e.target.value) || purchased))}
                  className="w-24 text-center text-lg font-semibold"
                />
                <Button variant="outline" size="icon" onClick={() => setSeatCount(s => s + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {minusDisabled && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  License count cannot be lower than the purchased license count.
                </p>
              )}
              {delta !== 0 && (
                <p className="text-xs text-center mt-2">
                  <span className={delta > 0 ? 'text-success' : 'text-destructive'}>
                    {delta > 0 ? `+${delta}` : delta} seats
                  </span>
                </p>
              )}
            </div>

            {savedMessage && (
              <div className="rounded-md border border-success/30 bg-success/10 text-sm p-3 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                <span>{savedMessage}</span>
              </div>
            )}
          </div>
        )}

        <SheetFooter className="gap-2">
          {savedMessage ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

/* ============================================================
 * Accept Quote Dialog
 * ========================================================== */
export const AcceptQuoteDialog = ({
  open, onOpenChange, quote,
}: { open: boolean; onOpenChange: (v: boolean) => void; quote: Quote | null }) => {
  const { acceptQuote } = useApp();
  const { toast } = useToast();
  const [poNumber, setPoNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pay_on_receipt' | 'pay_on_terms' | ''>('');

  useEffect(() => {
    if (open) {
      setPoNumber(quote?.poNumber || '');
      setPaymentMethod('');
    }
  }, [open, quote?.poNumber]);

  if (!quote) return null;

  const handleConfirm = () => {
    if (!paymentMethod) {
      toast({ title: 'Please select a payment method', variant: 'destructive' });
      return;
    }
    const result = acceptQuote(quote.id, { poNumber: poNumber || undefined, paymentMethod });
    if (!result) {
      toast({ title: 'Unable to accept quote', description: 'This quote has expired.', variant: 'destructive' });
      return;
    }
    toast({
      title: 'Quote accepted successfully',
      description: `Invoice ${result.invoice.invoiceNumber} has been generated.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Accept Quote</DialogTitle>
          <DialogDescription>Review and confirm acceptance of this quote.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Quote #</span><span className="font-medium">{quote.quoteNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Products</span><span className="font-medium text-right">{quote.lineItems.map(l => `${l.productName} (${l.licenseCount})`).join(', ')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">${quote.amount.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expiry</span><span className="font-medium">{new Date(quote.expiryDate).toLocaleDateString()}</span></div>
          </div>

          <div>
            <Label htmlFor="po">PO Number</Label>
            <Input id="po" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Enter PO number if applicable" />
          </div>

          <div>
            <Label>Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'pay_on_receipt' | 'pay_on_terms')} className="mt-2 space-y-2">
              <label className="flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="pay_on_receipt" id="por" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Pay on Receipt</div>
                  <div className="text-xs text-muted-foreground">Subscription will be activated only after payment is received.</div>
                </div>
              </label>
              <label className="flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="pay_on_terms" id="pot" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Pay on Terms</div>
                  <div className="text-xs text-muted-foreground">Subscription activation will follow the approved payment terms.</div>
                </div>
              </label>
            </RadioGroup>
            {paymentMethod === 'pay_on_receipt' && (
              <p className="text-xs text-muted-foreground mt-2">Invoice will be generated after acceptance. Subscription will be activated only after payment is received.</p>
            )}
            {paymentMethod === 'pay_on_terms' && (
              <p className="text-xs text-muted-foreground mt-2">Invoice will be generated after acceptance. Subscription activation will follow the approved payment terms.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm Acceptance</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================
 * Decline Quote Dialog
 * ========================================================== */
export const DeclineQuoteDialog = ({
  open, onOpenChange, quote,
}: { open: boolean; onOpenChange: (v: boolean) => void; quote: Quote | null }) => {
  const { declineQuote } = useApp();
  const { toast } = useToast();
  const [reason, setReason] = useState('');

  useEffect(() => { if (open) setReason(''); }, [open]);

  if (!quote) return null;

  const handleDecline = () => {
    declineQuote(quote.id, reason || undefined);
    toast({ title: 'Quote declined successfully', description: quote.quoteNumber });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline Quote</DialogTitle>
          <DialogDescription>Are you sure you want to decline this quote?</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason / Note (optional)</Label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add reason for declining quote" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDecline}>Decline Quote</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================
 * View Note Dialog
 * ========================================================== */
export const ViewNoteDialog = ({
  open, onOpenChange, quote,
}: { open: boolean; onOpenChange: (v: boolean) => void; quote: Quote | null }) => {
  if (!quote) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quote Note — {quote.quoteNumber}</DialogTitle>
          <DialogDescription>Note added when this quote was created.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
          {quote.note || '—'}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================
 * Request a Quote Dialog
 * ========================================================== */
const REQUESTABLE = ['NumberCruncher Desktop', 'NumberCruncher Web', 'QuickView Desktop', 'DataNet'];

export const RequestQuoteDialog = ({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { addQuoteRequest } = useApp();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) { setSelected({}); setNote(''); }
  }, [open]);

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = { ...prev };
      if (name in next) delete next[name];
      else next[name] = 1;
      return next;
    });
  };

  const updateCount = (name: string, count: number) => {
    setSelected(prev => ({ ...prev, [name]: Math.max(1, count) }));
  };

  const handleSubmit = () => {
    const products = Object.entries(selected).map(([productName, desiredLicenseCount]) => ({ productName, desiredLicenseCount }));
    if (products.length === 0) {
      toast({ title: 'Please select at least one product', variant: 'destructive' });
      return;
    }
    if (!note.trim()) {
      toast({ title: 'Please add a note describing your request', variant: 'destructive' });
      return;
    }
    addQuoteRequest({ products, note });
    toast({ title: 'Quote request submitted successfully', description: 'Email notification sent to admin.' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a Quote</DialogTitle>
          <DialogDescription>Tell us what you need and our team will prepare a quote for you.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Product Requirement</Label>
            <div className="space-y-2">
              {REQUESTABLE.map(p => {
                const isSel = p in selected;
                return (
                  <div key={p} className="flex items-center gap-3 border rounded-md p-2.5">
                    <Checkbox checked={isSel} onCheckedChange={() => toggle(p)} />
                    <span className="flex-1 text-sm">{p}</span>
                    <Input
                      type="number" min={1} className="w-24"
                      value={isSel ? selected[p] : ''}
                      placeholder="Qty"
                      disabled={!isSel}
                      onChange={(e) => updateCount(p, parseInt(e.target.value) || 1)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <Label htmlFor="qrnote">Note</Label>
            <Textarea id="qrnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe what product, license count, or change you are expecting." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Submit Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
