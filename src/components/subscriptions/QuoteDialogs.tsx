import { useState, useEffect } from 'react';
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
import { useApp, Subscription, SubscriptionProduct, Quote, PaymentMethod } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, CheckCircle2, Lock } from 'lucide-react';

/* ============================================================
 * Payment Method Picker (radio cards)
 * ========================================================== */
const PaymentMethodPicker = ({
  value, onChange, available, payOnTermsEnabled, terms,
}: {
  value: PaymentMethod | '';
  onChange: (v: PaymentMethod) => void;
  available: PaymentMethod[];
  payOnTermsEnabled: boolean;
  terms?: string;
}) => {
  const cards: { id: PaymentMethod; title: string; desc: string }[] = [
    { id: 'pay_immediately', title: 'Pay Immediately', desc: 'Pay now and activate your subscription after successful payment.' },
    { id: 'pay_on_receipt', title: 'Pay on Receipt', desc: 'An invoice will be generated. Subscription will be activated after payment is received.' },
    { id: 'pay_on_terms', title: 'Pay on Terms', desc: terms ? `Invoice will be generated under approved payment terms (${terms}).` : 'Invoice will be generated under approved payment terms.' },
  ];
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as PaymentMethod)} className="space-y-2">
      {cards.map(c => {
        const isAvail = available.includes(c.id);
        const isTerms = c.id === 'pay_on_terms';
        if (isTerms && !payOnTermsEnabled) {
          return (
            <label key={c.id} className="flex items-start gap-2 border rounded-md p-3 opacity-60 cursor-not-allowed bg-muted/30">
              <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">Pay on Terms is not enabled for this company.</div>
              </div>
            </label>
          );
        }
        return (
          <label key={c.id} className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 ${value === c.id ? 'border-primary bg-primary/5' : ''}`}>
            <RadioGroupItem value={c.id} className="mt-0.5" disabled={!isAvail} />
            <div>
              <div className="text-sm font-medium">{c.title}</div>
              <div className="text-xs text-muted-foreground">{c.desc}</div>
            </div>
          </label>
        );
      })}
    </RadioGroup>
  );
};

/* ============================================================
 * Manage Licenses Drawer
 * ========================================================== */
export const ManageLicensesDrawer = ({
  open, onOpenChange, subscription, product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subscription: Subscription | null;
  product: SubscriptionProduct | null;
}) => {
  const { getAssignedLicenseCount, requestLicenseChange, getCompanyConfig, getAvailablePaymentMethods } = useApp();
  const { toast } = useToast();
  const purchased = product?.purchasedLicenseCount ?? product?.licenseCount ?? 0;
  const current = product?.licenseCount ?? 0;
  const pending = product?.pendingLicenseCount ?? 0;
  const assigned = subscription && product ? getAssignedLicenseCount(subscription.id, product.id) : 0;
  const cfg = getCompanyConfig(subscription?.companyId);
  const available = getAvailablePaymentMethods(subscription?.companyId);

  const [seatCount, setSeatCount] = useState(current);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setSeatCount(current);
    setPaymentMethod('');
    setSavedMessage(null);
  }, [current, product?.id, open]);

  const minusDisabled = seatCount <= purchased;
  const delta = seatCount - current;
  const cost = delta > 0 ? delta * (product?.pricePerLicense || 0) : 0;
  const requiresPayment = delta > 0;

  const handleSave = () => {
    if (!subscription || !product) return;
    if (delta === 0) {
      setSavedMessage('No license changes to save.');
      return;
    }
    if (requiresPayment && !paymentMethod) {
      toast({ title: 'Please select a payment method to continue.', variant: 'destructive' });
      return;
    }
    const result = requestLicenseChange(subscription.id, product.id, seatCount, requiresPayment ? (paymentMethod as PaymentMethod) : 'pay_on_receipt');
    if (delta < 0) {
      setSavedMessage('License count updated successfully.');
      toast({ title: 'License count updated successfully.' });
    } else if (paymentMethod === 'pay_immediately') {
      setSavedMessage('Payment successful. License count updated.');
      toast({ title: 'Payment successful', description: 'License count updated.' });
    } else if (paymentMethod === 'pay_on_terms') {
      setSavedMessage('License count updated under approved payment terms.');
      toast({ title: 'License count updated under approved payment terms.' });
    } else {
      setSavedMessage('Invoice generated. Additional licenses will be activated after payment is received.');
      toast({ title: 'Invoice generated', description: `${delta} additional seats pending payment.` });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage Licenses</SheetTitle>
          <SheetDescription>Adjust seats. Cannot go below the originally purchased count.</SheetDescription>
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
              {pending > 0 && (
                <div className="text-xs text-warning pt-1">{pending} additional seats pending payment.</div>
              )}
            </div>

            <div>
              <Label className="text-sm">New Seat Count</Label>
              <div className="flex items-center justify-center gap-3 mt-2">
                <Button variant="outline" size="icon" disabled={minusDisabled} onClick={() => setSeatCount(s => Math.max(purchased, s - 1))}>
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
                <p className="text-xs text-muted-foreground mt-2 text-center">License count cannot be lower than the purchased license count.</p>
              )}
            </div>

            {delta !== 0 && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span>{product.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Current seats</span><span>{current}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">New requested seats</span><span>{seatCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{delta > 0 ? 'Added seats' : 'Removed seats'}</span><span>{Math.abs(delta)}</span></div>
                {requiresPayment && (
                  <div className="flex justify-between font-semibold pt-1 border-t"><span>Estimated charge</span><span>${cost.toLocaleString()}</span></div>
                )}
              </div>
            )}

            {requiresPayment && (
              <div>
                <Label className="text-sm">Payment Method</Label>
                <div className="mt-2">
                  <PaymentMethodPicker
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    available={available}
                    payOnTermsEnabled={cfg.payOnTermsEnabled}
                    terms={cfg.terms}
                  />
                </div>
              </div>
            )}

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
  const { acceptQuote, getCompanyConfig, getAvailablePaymentMethods } = useApp();
  const { toast } = useToast();
  const [poNumber, setPoNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const cfg = getCompanyConfig(quote?.companyId);
  const available = getAvailablePaymentMethods(quote?.companyId);

  useEffect(() => {
    if (open) {
      setPoNumber(quote?.poNumber || '');
      setPaymentMethod('');
    }
  }, [open, quote?.poNumber]);

  if (!quote) return null;

  const handleConfirm = () => {
    if (!paymentMethod) {
      toast({ title: 'Please select a payment method to continue.', variant: 'destructive' });
      return;
    }
    const result = acceptQuote(quote.id, { poNumber: poNumber || undefined, paymentMethod });
    if (!result) {
      toast({ title: 'Unable to accept quote', description: 'This quote has expired.', variant: 'destructive' });
      return;
    }
    if (paymentMethod === 'pay_immediately') {
      toast({ title: 'Quote accepted and payment completed.', description: `Subscription activated. Invoice ${result.invoice.invoiceNumber}.` });
    } else if (paymentMethod === 'pay_on_terms') {
      toast({ title: 'Quote accepted under approved payment terms.', description: `Subscription activated. Invoice ${result.invoice.invoiceNumber}.` });
    } else {
      toast({ title: 'Quote accepted.', description: `Invoice ${result.invoice.invoiceNumber} generated. Subscription activates after payment.` });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accept Quote</DialogTitle>
          <DialogDescription>Review and confirm acceptance of this quote.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Quote #</span><span className="font-medium">{quote.quoteNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Products</span><span className="font-medium text-right">{quote.lineItems.map(l => `${l.productName} (${l.licenseCount})`).join(', ')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">${quote.amount.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium">{new Date(quote.createdDate).toLocaleDateString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expires</span><span className="font-medium">{new Date(quote.expiryDate).toLocaleDateString()}</span></div>
            {quote.note && <div className="pt-1 text-xs text-muted-foreground">Note: {quote.note}</div>}
          </div>

          <div>
            <Label htmlFor="po">PO Number</Label>
            <Input id="po" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Enter PO number if applicable" />
          </div>

          <div>
            <Label>Payment Method</Label>
            <div className="mt-2">
              <PaymentMethodPicker
                value={paymentMethod}
                onChange={setPaymentMethod}
                available={available}
                payOnTermsEnabled={cfg.payOnTermsEnabled}
                terms={cfg.terms}
              />
            </div>
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
    toast({ title: 'Quote request submitted successfully.', description: 'Email notification sent to admin.' });
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
