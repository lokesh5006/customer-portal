import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Minus,
  Plus,
  Pencil,
  Building2,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useApp, PaymentMethod } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type ProductId = 'nc_desktop' | 'nc_web' | 'qv_desktop' | 'datanet';

interface ProductDef {
  id: ProductId;
  name: string;
  initial: string;
  unitPrice: number;
  hasSeats: boolean;
}

const PRODUCTS: ProductDef[] = [
  { id: 'nc_desktop',   name: 'NumberCruncher Desktop', initial: 'ND', unitPrice: 129.78, hasSeats: true },
  { id: 'nc_web',       name: 'NumberCruncher Web',     initial: 'NW', unitPrice: 129.78, hasSeats: true },
  { id: 'qv_desktop',   name: 'QuickView Desktop',      initial: 'QV', unitPrice: 99.00,  hasSeats: true },
  { id: 'datanet',      name: 'DataNet',                initial: 'DN', unitPrice: 29.00,  hasSeats: false },
];

const PAID_IDS: ProductId[] = ['nc_desktop', 'nc_web', 'qv_desktop'];
const TAX_RATE = 0.07;

const formatMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const round2 = (n: number) => Math.round(n * 100) / 100;

interface BillingInfo {
  company: string;
  email: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const billingAddressLine = (b: BillingInfo) =>
  [b.address1, b.city, [b.state, b.zip].filter(Boolean).join(' '), b.country]
    .filter(s => s && s.trim())
    .join(', ');

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { currentCompany, currentUser, createQuote, checkoutPurchase, getAvailablePaymentMethods, getCompanyConfig } = useApp();
  const { toast } = useToast();
  const availableMethods = getAvailablePaymentMethods();
  const config = getCompanyConfig();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(availableMethods[0] || 'pay_immediately');

  const [selected, setSelected] = useState<Record<ProductId, boolean>>({
    nc_desktop: false,
    nc_web: false,
    qv_desktop: false,
    datanet: false,
  });
  const [seats, setSeats] = useState<Record<ProductId, number>>({
    nc_desktop: 1,
    nc_web: 1,
    qv_desktop: 1,
    datanet: 1,
  });
  const [dataNetManuallyUnchecked, setDataNetManuallyUnchecked] = useState(false);

  // Prefill from quote regeneration (route state OR ?fromQuote= URL params)
  useEffect(() => {
    const navState = location.state as {
      fromQuote?: string;
      lineItems?: { productName: string; licenseCount: number }[];
      prefillProduct?: string;
    } | null;
    const stateLineItems = navState?.lineItems;
    const prefillProductName = navState?.prefillProduct;
    const findIdByName = (name: string): ProductId | null => {
      const def = PRODUCTS.find(p => p.name.toLowerCase() === name.toLowerCase());
      return def ? def.id : null;
    };

    // Single-product prefill (e.g. from DataNet empty-state CTA)
    if (prefillProductName) {
      const id = findIdByName(prefillProductName);
      if (id) {
        setSelected(prev => ({ ...prev, [id]: true }));
      }
    }

    if (stateLineItems && stateLineItems.length > 0) {
      const nextSelected: Partial<Record<ProductId, boolean>> = {};
      const nextSeats: Partial<Record<ProductId, number>> = {};
      stateLineItems.forEach(l => {
        const id = findIdByName(l.productName);
        if (id) {
          nextSelected[id] = true;
          if (id !== 'datanet') nextSeats[id] = Math.max(1, l.licenseCount);
        }
      });
      if (Object.keys(nextSelected).length > 0) {
        setSelected(prev => ({ ...prev, ...nextSelected }));
        setSeats(prev => ({ ...prev, ...nextSeats }));
      }
      return;
    }

    // Backward-compat: ?fromQuote=...&product=...&licenses=...
    const fromQuote = searchParams.get('fromQuote');
    const product = searchParams.get('product');
    const licenses = parseInt(searchParams.get('licenses') || '1', 10);
    if (fromQuote && product) {
      const id = findIdByName(product);
      if (id) {
        setSelected(prev => ({ ...prev, [id]: true }));
        if (id !== 'datanet') {
          setSeats(prev => ({ ...prev, [id]: Math.max(1, licenses || 1) }));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [billing, setBilling] = useState<BillingInfo>({
    company: currentCompany?.name || 'Company Name',
    email: currentUser?.email || 'user@example.com',
    address1: '123 Main St',
    city: 'Anytown',
    state: 'NY',
    zip: '10001',
    country: 'USA',
  });

  const [editBillingOpen, setEditBillingOpen] = useState(false);
  const [billingDraft, setBillingDraft] = useState<BillingInfo>(billing);

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteRecipients, setQuoteRecipients] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');

  const anyOtherSelected = PAID_IDS.some(id => selected[id]);

  const lineSubtotal = (id: ProductId): number => {
    if (!selected[id]) return 0;
    const def = PRODUCTS.find(p => p.id === id)!;
    if (id === 'datanet') {
      return anyOtherSelected ? 0 : def.unitPrice;
    }
    return round2(seats[id] * def.unitPrice);
  };

  const orderLines = useMemo(() => {
    return PRODUCTS.filter(p => selected[p.id]).map(p => {
      const isDN = p.id === 'datanet';
      const qty = isDN ? 1 : seats[p.id];
      const amount = lineSubtotal(p.id);
      const included = isDN && anyOtherSelected;
      return {
        id: p.id,
        name: p.name,
        initial: p.initial,
        qty,
        rate: p.unitPrice,
        amount,
        included,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, seats, anyOtherSelected]);

  const subtotal = round2(orderLines.reduce((a, l) => a + l.amount, 0));
  const tax = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + tax);

  const toggleSelected = (id: ProductId) => {
    setSelected(prev => {
      const checked = !prev[id];
      const next = { ...prev, [id]: checked };

      if (id === 'datanet') {
        // Track manual choice so we don't override the user later this session.
        setDataNetManuallyUnchecked(!checked);
        return next;
      }

      // Auto-check DataNet when any other product is checked, unless the user
      // has previously unchecked DataNet manually this session.
      if (checked && !next.datanet && !dataNetManuallyUnchecked) {
        next.datanet = true;
      }
      return next;
    });
  };

  const changeSeats = (id: ProductId, delta: number) => {
    setSeats(prev => ({ ...prev, [id]: Math.max(1, prev[id] + delta) }));
  };

  const setSeatsExact = (id: ProductId, value: number) => {
    const safe = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
    setSeats(prev => ({ ...prev, [id]: safe }));
  };

  const openEditBilling = () => {
    setBillingDraft(billing);
    setEditBillingOpen(true);
  };

  const saveBilling = () => {
    setBilling(billingDraft);
    setEditBillingOpen(false);
    toast({ title: 'Billing information updated.' });
  };

  const buildLineItems = () =>
    orderLines.map(l => ({
      productName: l.name,
      licenseCount: l.qty,
      unitPrice: l.included ? 0 : l.rate,
      total: l.amount,
    }));

  const handleCompletePayment = () => {
    if (orderLines.length === 0) {
      toast({ title: 'Please select at least one product to continue.', variant: 'destructive' });
      return;
    }
    if (paymentMethod === 'pay_immediately') {
      navigate('/pay', {
        state: {
          source: 'checkout',
          lineItems: buildLineItems(),
          subtotal,
          tax,
          totalAmount: total,
          returnTo: '/checkout',
        },
      });
      return;
    }
    if (paymentMethod === 'pay_on_receipt') {
      checkoutPurchase({ lineItems: buildLineItems(), paymentMethod: 'pay_on_receipt' });
      toast({ title: 'Invoice generated.', description: 'Pay to activate your subscription.' });
      navigate('/subscriptions');
      return;
    }
    if (paymentMethod === 'pay_on_terms') {
      checkoutPurchase({ lineItems: buildLineItems(), paymentMethod: 'pay_on_terms' });
      toast({ title: 'Subscription activated under approved payment terms.' });
      navigate('/subscriptions');
    }
  };

  const methodCopy: Record<PaymentMethod, { title: string; desc: string }> = {
    pay_immediately: { title: 'Pay Immediately', desc: 'Pay now and activate your subscription after successful payment.' },
    pay_on_receipt: { title: 'Pay on Receipt', desc: 'An invoice will be generated. Subscription will be activated after payment is received.' },
    pay_on_terms: { title: 'Pay on Terms', desc: config.terms ? `Invoice will be generated under approved payment terms (${config.terms}).` : 'Invoice will be generated under approved payment terms.' },
  };

  const completeButtonLabel =
    paymentMethod === 'pay_immediately' ? 'Complete Payment'
    : paymentMethod === 'pay_on_receipt' ? 'Generate Invoice'
    : 'Activate Subscription';

  const openGetQuote = () => {
    if (orderLines.length === 0) {
      toast({ title: 'Please select at least one product to continue.', variant: 'destructive' });
      return;
    }
    setQuoteRecipients('');
    setQuoteNotes('');
    setQuoteOpen(true);
  };

  const handleSendQuote = () => {
    const recipients = quoteRecipients
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    createQuote({
      lineItems: buildLineItems(),
      note: quoteNotes.trim(),
      recipients: recipients.length > 0 ? recipients : undefined,
    });

    if (recipients.length > 0) {
      toast({ title: `Quote sent to: ${recipients.join(', ')}` });
    } else {
      toast({ title: 'Quote saved. View it on the Quotes page.' });
    }
    setQuoteOpen(false);
    navigate('/quotes');
  };

  const hasSelection = orderLines.length > 0;

  return (
    <MainLayout>
      <PageHeader
        title="Checkout"
        description="Select products to start your subscription."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: product list + billing */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">1. Select Products</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select one or more products to include in your subscription.
            </p>
          </div>

          <div className="space-y-3">
            {PRODUCTS.map(p => {
              const isSelected = selected[p.id];
              const isDN = p.id === 'datanet';
              const included = isDN && isSelected && anyOtherSelected;
              const subtotalForCard = lineSubtotal(p.id);
              return (
                <Card
                  key={p.id}
                  className="transition-all"
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <Checkbox
                        id={`select-${p.id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleSelected(p.id)}
                        className="mt-1.5"
                        aria-label={`Select ${p.name}`}
                      />
                      <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                        {p.initial}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Label htmlFor={`select-${p.id}`} className="text-base font-semibold cursor-pointer">
                            {p.name}
                          </Label>
                          {included && (
                            <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/10">
                              Included
                            </Badge>
                          )}
                        </div>

                        {isDN ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Included with any product selection. If selected alone, DataNet is $29.00/year.
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatMoney(p.unitPrice)} per seat/year
                          </p>
                        )}

                        {!isDN && isSelected && (
                          <div className="mt-3">
                            <Label className="text-xs text-muted-foreground">Seats</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => changeSeats(p.id, -1)}
                                disabled={seats[p.id] <= 1}
                                aria-label="Decrease seats"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                value={seats[p.id]}
                                onChange={(e) => setSeatsExact(p.id, parseInt(e.target.value, 10))}
                                className="h-8 w-16 text-center"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => changeSeats(p.id, 1)}
                                aria-label="Increase seats"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">Subtotal</div>
                        <div className="text-lg font-semibold mt-0.5">
                          {formatMoney(subtotalForCard)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Billing Information */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-foreground">2. Billing Information</h2>
              <Button variant="link" className="gap-1.5 text-primary" onClick={openEditBilling}>
                <Pencil className="h-3.5 w-3.5" />
                Edit Details
              </Button>
            </div>
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      Company
                    </div>
                    <div className="font-medium text-foreground mt-1">{billing.company}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </div>
                    <div className="font-medium text-foreground mt-1">{billing.email}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Billing Address
                  </div>
                  <div className="font-medium text-foreground mt-1">
                    {billingAddressLine(billing) || '—'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right: order summary */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20 space-y-4">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-base font-semibold">Order Summary</h3>

                <div className="space-y-3">
                  {orderLines.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No products selected.</p>
                  ) : (
                    orderLines.map(l => (
                      <div key={l.id} className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                          {l.initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{l.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {l.included
                              ? 'Included'
                              : `Qty ${l.qty} · Rate ${formatMoney(l.rate)}`}
                          </div>
                        </div>
                        <div
                          className={cn(
                            'text-sm font-semibold text-right shrink-0',
                            l.included && 'text-success'
                          )}
                        >
                          {formatMoney(l.amount)}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax (7%)</span>
                    <span className="font-medium">{formatMoney(tax)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold pt-1.5 border-t">
                    <span>Total</span>
                    <span>{formatMoney(total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance Due</span>
                    <span className="font-medium text-primary">{formatMoney(total)}</span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Payment Method</Label>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                    className="space-y-2 mt-2"
                  >
                    {availableMethods.map(m => (
                      <label
                        key={m}
                        className={cn(
                          'flex items-start gap-2 border rounded-md p-2 cursor-pointer text-sm',
                          paymentMethod === m ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                        )}
                      >
                        <RadioGroupItem value={m} className="mt-0.5" />
                        <div>
                          <div className="font-medium">{methodCopy[m].title}</div>
                          <div className="text-xs text-muted-foreground">{methodCopy[m].desc}</div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2 pt-1">
                  <Button
                    className="w-full h-11"
                    onClick={handleCompletePayment}
                    disabled={!hasSelection}
                  >
                    {completeButtonLabel}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-11"
                    onClick={openGetQuote}
                    disabled={!hasSelection}
                  >
                    Get Quote
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Secure checkout</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Billing Modal */}
      <Dialog open={editBillingOpen} onOpenChange={setEditBillingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Billing Information</DialogTitle>
            <DialogDescription>Update your company and billing contact details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="bi-company">Company Name</Label>
              <Input
                id="bi-company"
                value={billingDraft.company}
                onChange={(e) => setBillingDraft({ ...billingDraft, company: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="bi-email">Email</Label>
              <Input
                id="bi-email"
                type="email"
                value={billingDraft.email}
                onChange={(e) => setBillingDraft({ ...billingDraft, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="bi-address1">Address Line 1</Label>
              <Input
                id="bi-address1"
                value={billingDraft.address1}
                onChange={(e) => setBillingDraft({ ...billingDraft, address1: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="bi-city">City</Label>
                <Input
                  id="bi-city"
                  value={billingDraft.city}
                  onChange={(e) => setBillingDraft({ ...billingDraft, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="bi-state">State</Label>
                <Input
                  id="bi-state"
                  value={billingDraft.state}
                  onChange={(e) => setBillingDraft({ ...billingDraft, state: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="bi-zip">ZIP</Label>
                <Input
                  id="bi-zip"
                  value={billingDraft.zip}
                  onChange={(e) => setBillingDraft({ ...billingDraft, zip: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="bi-country">Country</Label>
              <Input
                id="bi-country"
                value={billingDraft.country}
                onChange={(e) => setBillingDraft({ ...billingDraft, country: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBillingOpen(false)}>Cancel</Button>
            <Button onClick={saveBilling}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Get Quote Modal */}
      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Get Quote</DialogTitle>
            <DialogDescription>
              Review your order and send it as a quote. You can include optional recipients and notes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border p-3 space-y-3">
              {orderLines.map(l => (
                <div key={l.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                      {l.initial}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{l.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.included ? 'Included' : `Qty ${l.qty} · ${formatMoney(l.rate)}`}
                      </div>
                    </div>
                  </div>
                  <div className={cn('font-medium shrink-0 ml-3', l.included && 'text-success')}>
                    {formatMoney(l.amount)}
                  </div>
                </div>
              ))}
              <div className="border-t pt-2 space-y-1 text-sm">
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
              </div>
            </div>

            <div>
              <Label htmlFor="quote-send-to">Send to</Label>
              <Input
                id="quote-send-to"
                value={quoteRecipients}
                onChange={(e) => setQuoteRecipients(e.target.value)}
                placeholder="finance@example.com, ap@example.com"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional. Comma-separated email addresses to send the quote to.
              </p>
            </div>

            <div>
              <Label htmlFor="quote-notes">Notes</Label>
              <Textarea
                id="quote-notes"
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder="Any details we should include with this quote..."
                className="mt-1.5"
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">Optional.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteOpen(false)}>Cancel</Button>
            <Button onClick={handleSendQuote}>Send Quote</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default CheckoutPage;
