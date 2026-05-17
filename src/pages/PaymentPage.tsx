import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CreditCard, Lock, ShieldCheck, Loader2, ArrowLeft, Landmark, Plus,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useApp, Invoice, QuoteLineItem, SavedPaymentMethod } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { openProfileDrawer } from '@/lib/profileDrawer';

type PaymentSource = 'checkout' | 'quote' | 'invoice' | 'renewal';

interface PaymentIntentBase {
  subtotal: number;
  tax: number;
  totalAmount: number;
  returnTo?: string;
}

interface CheckoutIntent extends PaymentIntentBase {
  source: 'checkout';
  lineItems: QuoteLineItem[];
}

interface QuoteIntent extends PaymentIntentBase {
  source: 'quote';
  quoteId: string;
  lineItems: QuoteLineItem[];
  poNumber?: string;
}

interface InvoiceIntent extends PaymentIntentBase {
  source: 'invoice';
  invoiceId: string;
}

interface RenewalIntent extends PaymentIntentBase {
  source: 'renewal';
  subscriptionId: string;
  invoiceId?: string;
  lineItems: QuoteLineItem[];
  newLicenseCounts?: Record<string, number>;
}

type PaymentIntent = CheckoutIntent | QuoteIntent | InvoiceIntent | RenewalIntent;

type Tab = 'card' | 'ach';

const formatMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const cardBrandColor = (brand?: string) => {
  switch (brand) {
    case 'Visa': return 'text-blue-600 dark:text-blue-300';
    case 'Mastercard': return 'text-red-600 dark:text-red-300';
    default: return 'text-primary';
  }
};

const deriveBrandFromNumber = (num: string): SavedPaymentMethod['cardBrand'] => {
  const first = num.charAt(0);
  if (first === '4') return 'Visa';
  if (first === '5') return 'Mastercard';
  if (first === '3') return 'Amex';
  if (first === '6') return 'Discover';
  return 'Visa';
};

export const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const {
    currentCompany, currentUser,
    invoices, checkoutPurchase, acceptQuote, markInvoicePaid, renewSubscription,
    getCompanyPaymentMethods, addPaymentMethod,
  } = useApp();

  const intent = location.state as PaymentIntent | null;

  useEffect(() => {
    if (!intent || !intent.source) {
      toast({ title: 'Payment session expired. Please try again.', variant: 'destructive' });
      navigate('/dashboard', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sourceInvoice: Invoice | null = useMemo(() => {
    if (intent?.source === 'invoice') {
      return invoices.find(i => i.id === intent.invoiceId) || null;
    }
    return null;
  }, [intent, invoices]);

  const orderLines = useMemo(() => {
    if (!intent) return [];
    if (intent.source === 'invoice') {
      if (!sourceInvoice) return [];
      return sourceInvoice.lineItems.map(li => ({
        name: li.product,
        qty: li.quantity,
        rate: li.unitPrice,
        amount: li.total,
      }));
    }
    return intent.lineItems.map(li => ({
      name: li.productName,
      qty: li.licenseCount,
      rate: li.unitPrice,
      amount: li.total,
    }));
  }, [intent, sourceInvoice]);

  const allMethods = getCompanyPaymentMethods();
  const savedCards = allMethods.filter(m => m.type === 'card');
  const savedBanks = allMethods.filter(m => m.type === 'ach');

  const primaryCardId = savedCards.find(c => c.isPrimary)?.id || savedCards[0]?.id || '';
  const primaryBankId = savedBanks.find(b => b.isPrimary)?.id || savedBanks[0]?.id || '';

  const [tab, setTab] = useState<Tab>('card');
  const [selectedCardId, setSelectedCardId] = useState(primaryCardId);
  const [selectedBankId, setSelectedBankId] = useState(primaryBankId);
  const [cvv, setCvv] = useState('');

  // Inline new-card form (shown when no saved cards exist)
  const [newCardName, setNewCardName] = useState('');
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardMonth, setNewCardMonth] = useState('');
  const [newCardYear, setNewCardYear] = useState('');
  const [newCardCvv, setNewCardCvv] = useState('');
  const [saveCardForFuture, setSaveCardForFuture] = useState(true);

  // Inline new-bank form
  const [newBankHolder, setNewBankHolder] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [routing, setRouting] = useState('');
  const [account, setAccount] = useState('');
  const [saveBankForFuture, setSaveBankForFuture] = useState(true);

  // Add Card dialog (used by "Use a different card" link)
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [acName, setAcName] = useState('');
  const [acNumber, setAcNumber] = useState('');
  const [acMonth, setAcMonth] = useState('');
  const [acYear, setAcYear] = useState('');
  const [acCvv, setAcCvv] = useState('');
  const [acPrimary, setAcPrimary] = useState(false);

  const [autoRenew, setAutoRenew] = useState(true);
  const [updateAddressFuture, setUpdateAddressFuture] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const defaultBilling = useMemo(() => ({
    firstName: currentUser?.firstName || '',
    lastName: currentUser?.lastName || '',
    company: currentCompany?.name || '',
    street: '123 Main St',
    city: 'Anytown',
    state: 'NY',
    zip: '10001',
    country: 'USA',
  }), [currentUser, currentCompany]);

  const [billing, setBilling] = useState(defaultBilling);

  if (!intent) return null;

  const useSavedAddress = () => setBilling(defaultBilling);

  const handleCancel = () => {
    if (intent.returnTo) navigate(intent.returnTo);
    else navigate(-1);
  };

  const openAddCardDialog = () => {
    setAcName(''); setAcNumber(''); setAcMonth(''); setAcYear(''); setAcCvv('');
    setAcPrimary(savedCards.length === 0);
    setAddCardOpen(true);
  };

  const submitAddCard = () => {
    const month = parseInt(acMonth, 10);
    const year = 2000 + parseInt(acYear, 10);
    if (!acName.trim() || acNumber.length < 4 || Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year) || acCvv.length < 3) {
      toast({ title: 'Please complete all card fields', variant: 'destructive' });
      return;
    }
    if (!currentUser || !currentCompany) return;
    const added = addPaymentMethod({
      userId: currentUser.id,
      companyId: currentCompany.id,
      type: 'card',
      cardBrand: deriveBrandFromNumber(acNumber),
      cardLast4: acNumber.slice(-4),
      cardExpMonth: month,
      cardExpYear: year,
      holderName: acName.trim(),
      isPrimary: savedCards.length === 0 ? true : acPrimary,
    });
    setSelectedCardId(added.id);
    setAddCardOpen(false);
    toast({ title: 'Card added' });
  };

  const validate = (): string | null => {
    if (tab === 'card') {
      if (savedCards.length > 0) {
        if (!selectedCardId) return 'Select a card.';
        if (cvv.trim().length < 3) return 'Enter the CVV for the selected card.';
      } else {
        if (!newCardName.trim() || newCardNumber.length < 4 || !newCardMonth || !newCardYear || newCardCvv.length < 3) {
          return 'Please complete all card fields.';
        }
      }
    } else {
      if (savedBanks.length > 0) {
        if (!selectedBankId) return 'Select a bank account.';
      } else {
        if (!newBankHolder.trim() || !newBankName.trim() || !/^\d{9}$/.test(routing.trim()) || account.trim().length < 4) {
          return 'Please complete all bank fields.';
        }
      }
    }
    if (!billing.street.trim() || !billing.city.trim() || !billing.state.trim() || !billing.zip.trim() || !billing.country.trim()) {
      return 'Please complete the billing address.';
    }
    return null;
  };

  const handlePay = async () => {
    const err = validate();
    if (err) {
      toast({ title: 'Cannot process payment', description: err, variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    // If user filled the inline form AND opted to save, persist before processing
    if (currentUser && currentCompany) {
      if (tab === 'card' && savedCards.length === 0 && saveCardForFuture) {
        const month = parseInt(newCardMonth, 10);
        const year = 2000 + parseInt(newCardYear, 10);
        addPaymentMethod({
          userId: currentUser.id,
          companyId: currentCompany.id,
          type: 'card',
          cardBrand: deriveBrandFromNumber(newCardNumber),
          cardLast4: newCardNumber.slice(-4),
          cardExpMonth: month,
          cardExpYear: year,
          holderName: newCardName.trim(),
          isPrimary: true,
        });
      }
      if (tab === 'ach' && savedBanks.length === 0 && saveBankForFuture) {
        addPaymentMethod({
          userId: currentUser.id,
          companyId: currentCompany.id,
          type: 'ach',
          bankName: newBankName.trim(),
          accountLast4: account.slice(-4),
          routingLast4: routing.slice(-4),
          holderName: newBankHolder.trim(),
          isPrimary: true,
        });
      }
    }

    await new Promise(r => setTimeout(r, 800));

    try {
      if (intent.source === 'checkout') {
        checkoutPurchase({ lineItems: intent.lineItems, paymentMethod: 'pay_immediately' });
      } else if (intent.source === 'quote') {
        const result = acceptQuote(intent.quoteId, { poNumber: intent.poNumber, paymentMethod: 'pay_immediately' });
        if (!result) {
          toast({ title: 'Quote could not be processed', description: 'It may have expired.', variant: 'destructive' });
          setSubmitting(false);
          return;
        }
      } else if (intent.source === 'invoice') {
        markInvoicePaid(intent.invoiceId);
      } else if (intent.source === 'renewal') {
        renewSubscription(
          intent.subscriptionId,
          intent.newLicenseCounts,
          intent.totalAmount,
          intent.invoiceId,
        );
      }
      toast({ title: 'Payment successful. Thank you!' });
      if (autoRenew) {
        toast({ title: 'Auto-renewal enabled.' });
      }
      navigate('/subscriptions');
    } catch {
      toast({ title: 'Payment failed', description: 'Please try again.', variant: 'destructive' });
      setSubmitting(false);
    }
  };

  // Renderers
  const renderSavedCardOption = (m: SavedPaymentMethod) => (
    <label
      key={m.id}
      htmlFor={`pm-${m.id}`}
      className={cn(
        'flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-muted/40',
        selectedCardId === m.id && 'border-primary bg-primary/5',
      )}
    >
      <RadioGroupItem id={`pm-${m.id}`} value={m.id} />
      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
        <CreditCard className={cn('h-5 w-5', cardBrandColor(m.cardBrand))} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{m.cardBrand} ending in {m.cardLast4}</div>
        <div className="text-xs text-muted-foreground">
          Expires {String(m.cardExpMonth).padStart(2, '0')}/{String((m.cardExpYear || 0) % 100).padStart(2, '0')}
        </div>
      </div>
      {m.isPrimary && <Badge variant="outline" className="status-active">Primary</Badge>}
    </label>
  );

  const renderSavedBankOption = (m: SavedPaymentMethod) => (
    <label
      key={m.id}
      htmlFor={`pm-${m.id}`}
      className={cn(
        'flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-muted/40',
        selectedBankId === m.id && 'border-primary bg-primary/5',
      )}
    >
      <RadioGroupItem id={`pm-${m.id}`} value={m.id} />
      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Landmark className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{m.bankName} •••• {m.accountLast4}</div>
        <div className="text-xs text-muted-foreground">Routing •••• {m.routingLast4}</div>
      </div>
      {m.isPrimary && <Badge variant="outline" className="status-active">Primary</Badge>}
    </label>
  );

  return (
    <MainLayout>
      <PageHeader
        title="Payment & Billing"
        description="Confirm your payment method and billing address to complete the order."
        actions={
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-1" />Cancel
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment Method */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Payment Method</h2>
                <Button
                  variant="link"
                  className="text-primary p-0 h-auto"
                  onClick={() => openProfileDrawer('payment')}
                >
                  Manage Methods
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={tab === 'card' ? 'default' : 'outline'}
                  onClick={() => setTab('card')}
                  className="h-10"
                >
                  Pay by Card
                </Button>
                <Button
                  variant={tab === 'ach' ? 'default' : 'outline'}
                  onClick={() => setTab('ach')}
                  className="h-10"
                >
                  ACH Transfer
                </Button>
              </div>

              {tab === 'card' && (
                <div className="space-y-4">
                  {savedCards.length > 0 ? (
                    <>
                      <RadioGroup
                        value={selectedCardId}
                        onValueChange={setSelectedCardId}
                        className="space-y-2"
                      >
                        {savedCards.map(renderSavedCardOption)}
                      </RadioGroup>
                      <Button
                        type="button"
                        variant="link"
                        className="text-primary p-0 h-auto"
                        onClick={openAddCardDialog}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />Use a different card
                      </Button>
                      <div>
                        <Label htmlFor="cvv">Security Code (CVV)</Label>
                        <div className="relative mt-1.5">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="cvv"
                            type="password"
                            inputMode="numeric"
                            placeholder="•••"
                            value={cvv}
                            maxLength={4}
                            onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                            className="pl-9 max-w-[160px]"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">3 digits on back of card</p>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="nc-name">Cardholder Name</Label>
                        <Input id="nc-name" value={newCardName} onChange={(e) => setNewCardName(e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="nc-number">Card Number</Label>
                        <Input id="nc-number" inputMode="numeric" maxLength={16}
                          value={newCardNumber}
                          onChange={(e) => setNewCardNumber(e.target.value.replace(/\D/g, ''))}
                          placeholder="4242 4242 4242 4242"
                          className="mt-1.5" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="nc-mm">MM</Label>
                          <Input id="nc-mm" inputMode="numeric" maxLength={2}
                            value={newCardMonth} onChange={(e) => setNewCardMonth(e.target.value.replace(/\D/g, ''))}
                            placeholder="12" className="mt-1.5" />
                        </div>
                        <div>
                          <Label htmlFor="nc-yy">YY</Label>
                          <Input id="nc-yy" inputMode="numeric" maxLength={2}
                            value={newCardYear} onChange={(e) => setNewCardYear(e.target.value.replace(/\D/g, ''))}
                            placeholder="26" className="mt-1.5" />
                        </div>
                        <div>
                          <Label htmlFor="nc-cvv">CVV</Label>
                          <Input id="nc-cvv" type="password" inputMode="numeric" maxLength={4}
                            value={newCardCvv} onChange={(e) => setNewCardCvv(e.target.value.replace(/\D/g, ''))}
                            placeholder="•••" className="mt-1.5" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Checkbox
                          id="nc-save"
                          checked={saveCardForFuture}
                          onCheckedChange={(v) => setSaveCardForFuture(!!v)}
                        />
                        <Label htmlFor="nc-save" className="text-sm font-normal cursor-pointer">
                          Save this card for future payments
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'ach' && (
                <div className="space-y-4">
                  {savedBanks.length > 0 ? (
                    <>
                      <RadioGroup
                        value={selectedBankId}
                        onValueChange={setSelectedBankId}
                        className="space-y-2"
                      >
                        {savedBanks.map(renderSavedBankOption)}
                      </RadioGroup>
                      <Button
                        type="button"
                        variant="link"
                        className="text-primary p-0 h-auto"
                        onClick={() => openProfileDrawer('payment')}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />Add a different bank account
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="nb-holder">Account Holder Name</Label>
                        <Input id="nb-holder" value={newBankHolder} onChange={(e) => setNewBankHolder(e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="nb-bank">Bank Name</Label>
                        <Input id="nb-bank" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="routing">Routing Number</Label>
                        <Input id="routing" inputMode="numeric" maxLength={9}
                          value={routing}
                          onChange={(e) => setRouting(e.target.value.replace(/\D/g, ''))}
                          className="mt-1.5" />
                        <p className="text-xs text-muted-foreground mt-1">Found on the bottom-left of your check</p>
                      </div>
                      <div>
                        <Label htmlFor="account">Account Number</Label>
                        <Input id="account" inputMode="numeric" maxLength={17}
                          value={account}
                          onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))}
                          className="mt-1.5" />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Checkbox
                          id="nb-save"
                          checked={saveBankForFuture}
                          onCheckedChange={(v) => setSaveBankForFuture(!!v)}
                        />
                        <Label htmlFor="nb-save" className="text-sm font-normal cursor-pointer">
                          Save this account for future payments
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start justify-between border-t pt-4 gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Auto renewal</div>
                  <div className="text-xs text-muted-foreground">
                    Automatically renew subscriptions at the end of the term.
                  </div>
                </div>
                <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
              </div>
            </CardContent>
          </Card>

          {/* Billing Information */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Billing Information</h2>
                <Button
                  variant="link"
                  className="text-primary p-0 h-auto"
                  onClick={useSavedAddress}
                >
                  Use Saved Address
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bi-first">First Name</Label>
                  <Input id="bi-first" value={billing.firstName}
                    onChange={(e) => setBilling({ ...billing, firstName: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="bi-last">Last Name</Label>
                  <Input id="bi-last" value={billing.lastName}
                    onChange={(e) => setBilling({ ...billing, lastName: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bi-company">Company (Optional)</Label>
                <Input id="bi-company" value={billing.company}
                  onChange={(e) => setBilling({ ...billing, company: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="bi-street">Street Address</Label>
                <Input id="bi-street" value={billing.street}
                  onChange={(e) => setBilling({ ...billing, street: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="bi-city">City</Label>
                  <Input id="bi-city" value={billing.city}
                    onChange={(e) => setBilling({ ...billing, city: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="bi-state">State</Label>
                  <Input id="bi-state" value={billing.state}
                    onChange={(e) => setBilling({ ...billing, state: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="bi-zip">ZIP Code</Label>
                  <Input id="bi-zip" value={billing.zip}
                    onChange={(e) => setBilling({ ...billing, zip: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bi-country">Country</Label>
                <Input id="bi-country" value={billing.country}
                  onChange={(e) => setBilling({ ...billing, country: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="bi-future"
                  checked={updateAddressFuture}
                  onCheckedChange={(v) => setUpdateAddressFuture(!!v)}
                />
                <Label htmlFor="bi-future" className="text-sm font-normal cursor-pointer">
                  Update this billing address for my future renewals
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Order Summary */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-32 space-y-3">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-base font-semibold">Order Summary</h3>

                <div className="space-y-3">
                  {orderLines.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No line items.</p>
                  ) : (
                    orderLines.map((l, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{l.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Qty {l.qty} · Rate {formatMoney(l.rate)}
                          </div>
                        </div>
                        <div className="text-sm text-right shrink-0">
                          {formatMoney(l.amount)}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatMoney(intent.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatMoney(intent.tax)}</span>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-1.5">
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total</span>
                    <span>{formatMoney(intent.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <span>Balance Due</span>
                    <span className="text-primary">{formatMoney(intent.totalAmount)}</span>
                  </div>
                </div>

                <Button
                  className={cn('w-full h-11')}
                  onClick={handlePay}
                  disabled={submitting}
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</>
                  ) : (
                    <>Pay {formatMoney(intent.totalAmount)}</>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Encrypted and secure payment.
                </p>
              </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Secure checkout</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Card dialog (inline from "Use a different card") */}
      <Dialog open={addCardOpen} onOpenChange={setAddCardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Card</DialogTitle>
            <DialogDescription>This card will be added to your saved payment methods.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ac-name">Cardholder Name</Label>
              <Input id="ac-name" value={acName} onChange={(e) => setAcName(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="ac-number">Card Number</Label>
              <Input id="ac-number" inputMode="numeric" maxLength={16}
                value={acNumber}
                onChange={(e) => setAcNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="4242 4242 4242 4242"
                className="mt-1.5" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="ac-mm">MM</Label>
                <Input id="ac-mm" inputMode="numeric" maxLength={2}
                  value={acMonth} onChange={(e) => setAcMonth(e.target.value.replace(/\D/g, ''))}
                  placeholder="12" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="ac-yy">YY</Label>
                <Input id="ac-yy" inputMode="numeric" maxLength={2}
                  value={acYear} onChange={(e) => setAcYear(e.target.value.replace(/\D/g, ''))}
                  placeholder="26" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="ac-cvv">CVV</Label>
                <Input id="ac-cvv" type="password" inputMode="numeric" maxLength={4}
                  value={acCvv} onChange={(e) => setAcCvv(e.target.value.replace(/\D/g, ''))}
                  placeholder="•••" className="mt-1.5" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="ac-primary"
                checked={acPrimary || savedCards.length === 0}
                disabled={savedCards.length === 0}
                onCheckedChange={(v) => setAcPrimary(!!v)}
              />
              <Label htmlFor="ac-primary" className="text-sm font-normal cursor-pointer">
                Make this my primary card
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCardOpen(false)}>Cancel</Button>
            <Button onClick={submitAddCard}>Add Card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default PaymentPage;
