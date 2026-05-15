import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ListingPageHeader } from '@/components/listing';
import { useApp, PRODUCT_CATALOG, PaymentMethod } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, AlertTriangle, FileSignature, CreditCard, Lock } from 'lucide-react';

interface LineDraft {
  productName: string;
  licenseCount: number;
  unitPrice: number;
  selected: boolean;
}

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { getCompanySubscriptions, createQuote, getCompanyConfig, getAvailablePaymentMethods, checkoutPurchase } = useApp();
  const { toast } = useToast();

  const hasActiveSubscription = getCompanySubscriptions().some(s => ['active', 'overdue', 'pending_payment'].includes(s.status));
  const cfg = getCompanyConfig();
  const available = getAvailablePaymentMethods();

  const prefillProduct = params.get('product');
  const prefillLicenses = parseInt(params.get('licenses') || '0', 10);
  const prefillNote = params.get('note') || '';
  const fromQuote = params.get('fromQuote');

  const [lines, setLines] = useState<LineDraft[]>(() =>
    PRODUCT_CATALOG.map(p => ({
      productName: p.name,
      licenseCount: prefillProduct === p.name ? Math.max(1, prefillLicenses) : 1,
      unitPrice: p.defaultPrice || 10,
      selected: prefillProduct === p.name,
    }))
  );
  const [note, setNote] = useState(prefillNote);
  const [poNumber, setPoNumber] = useState('');
  const [mode, setMode] = useState<'purchase' | 'quote'>(prefillNote ? 'quote' : 'purchase');
  // Default to Pay on Receipt for new signups
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pay_on_receipt');

  const total = useMemo(
    () => lines.filter(l => l.selected).reduce((a, l) => a + l.licenseCount * l.unitPrice, 0),
    [lines]
  );

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };

  const selectedLines = () => lines.filter(l => l.selected).map(l => ({
    productName: l.productName,
    licenseCount: l.licenseCount,
    unitPrice: l.unitPrice,
    total: l.licenseCount * l.unitPrice,
  }));

  const handleCreateQuote = () => {
    const items = selectedLines();
    if (items.length === 0) { toast({ title: 'Select at least one product', variant: 'destructive' }); return; }
    const quote = createQuote({ lineItems: items, note });
    toast({ title: 'Quote created successfully', description: `${quote.quoteNumber} — The quote will expire in 30 days.` });
    navigate('/quotes');
  };

  const handlePurchase = () => {
    const items = selectedLines();
    if (items.length === 0) { toast({ title: 'Select at least one product', variant: 'destructive' }); return; }
    const inv = checkoutPurchase({ lineItems: items, paymentMethod, poNumber: poNumber || undefined });
    if (paymentMethod === 'pay_immediately') {
      toast({ title: 'Payment successful. Subscription activated.', description: `Invoice ${inv.invoiceNumber}` });
    } else if (paymentMethod === 'pay_on_terms') {
      toast({ title: 'Invoice generated under payment terms. Subscription activated.', description: `Invoice ${inv.invoiceNumber}` });
    } else {
      toast({ title: 'Invoice generated successfully.', description: 'Subscription will be activated after payment is received.' });
    }
    navigate('/invoices');
  };

  const paymentCards: { id: PaymentMethod; title: string; desc: string }[] = [
    { id: 'pay_immediately', title: 'Pay Immediately', desc: 'Pay now and activate your subscription after successful payment.' },
    { id: 'pay_on_receipt', title: 'Pay on Receipt', desc: 'An invoice will be generated. Subscription will be activated after payment is received.' },
    { id: 'pay_on_terms', title: 'Pay on Terms', desc: cfg.terms ? `Invoice will be generated under approved payment terms (${cfg.terms}).` : 'Invoice will be generated under approved payment terms.' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl">
        <ListingPageHeader
          title="Checkout"
          description={fromQuote ? `Regenerating quote ${fromQuote}` : 'Build a new purchase or quote for your account.'}
        />

        {hasActiveSubscription && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You already have an active subscription. To modify or add products/licenses, please request a quote from the Subscriptions page.
              <Button variant="link" className="px-1" onClick={() => navigate('/subscriptions?tab=quotes')}>Go to Subscriptions</Button>
            </AlertDescription>
          </Alert>
        )}

        {!hasActiveSubscription && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'purchase' | 'quote')}>
            <TabsList>
              <TabsTrigger value="purchase">Purchase</TabsTrigger>
              <TabsTrigger value="quote">Create Quote</TabsTrigger>
            </TabsList>
            <TabsContent value="purchase" className="mt-4 space-y-6">
              {/* Products */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" />Products</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {lines.map((l, idx) => (
                    <div key={l.productName} className="flex items-center gap-3 p-3 border rounded-md">
                      <Checkbox checked={l.selected} onCheckedChange={(v) => updateLine(idx, { selected: !!v })} />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{l.productName}</div>
                        <div className="text-xs text-muted-foreground">${l.unitPrice}/license</div>
                      </div>
                      <div className="w-32">
                        <Label className="text-xs text-muted-foreground">Licenses</Label>
                        <Input type="number" min={1} value={l.licenseCount} disabled={!l.selected}
                          onChange={(e) => updateLine(idx, { licenseCount: Math.max(1, parseInt(e.target.value) || 1) })} />
                      </div>
                      <div className="w-24 text-right">
                        <div className="text-xs text-muted-foreground">Subtotal</div>
                        <div className="font-medium">${(l.selected ? l.licenseCount * l.unitPrice : 0).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Payment */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />Payment Method</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="space-y-2">
                    {paymentCards.map(c => {
                      const isAvail = available.includes(c.id);
                      const isTerms = c.id === 'pay_on_terms';
                      if (isTerms && !cfg.payOnTermsEnabled) {
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
                        <label key={c.id} className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 ${paymentMethod === c.id ? 'border-primary bg-primary/5' : ''}`}>
                          <RadioGroupItem value={c.id} className="mt-0.5" disabled={!isAvail} />
                          <div>
                            <div className="text-sm font-medium">{c.title}</div>
                            <div className="text-xs text-muted-foreground">{c.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </RadioGroup>
                  <div>
                    <Label htmlFor="po">PO Number (optional)</Label>
                    <Input id="po" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Enter PO number if applicable" />
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-lg font-semibold">${total.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
                <Button onClick={handlePurchase}><CreditCard className="h-4 w-4 mr-1" />Confirm Purchase</Button>
              </div>
            </TabsContent>

            <TabsContent value="quote" className="mt-4 space-y-6">
              {/* Quote products */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" />Products</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {lines.map((l, idx) => (
                    <div key={l.productName} className="flex items-center gap-3 p-3 border rounded-md">
                      <Checkbox checked={l.selected} onCheckedChange={(v) => updateLine(idx, { selected: !!v })} />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{l.productName}</div>
                        <div className="text-xs text-muted-foreground">${l.unitPrice}/license</div>
                      </div>
                      <div className="w-32">
                        <Label className="text-xs text-muted-foreground">Licenses</Label>
                        <Input type="number" min={1} value={l.licenseCount} disabled={!l.selected}
                          onChange={(e) => updateLine(idx, { licenseCount: Math.max(1, parseInt(e.target.value) || 1) })} />
                      </div>
                      <div className="w-24 text-right">
                        <div className="text-xs text-muted-foreground">Subtotal</div>
                        <div className="font-medium">${(l.selected ? l.licenseCount * l.unitPrice : 0).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSignature className="h-4 w-4 text-primary" />Quote Details</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="note">Quote Note</Label>
                    <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Add any notes or instructions for this quote." className="mt-1.5 min-h-[100px]" />
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-muted-foreground">Quote total</span>
                    <span className="text-lg font-semibold">${total.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <Badge variant="outline" className="status-active mr-1">Active</Badge>
                    Quotes are valid for 30 days from the date of creation.
                  </p>
                </CardContent>
              </Card>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
                <Button onClick={handleCreateQuote}><FileSignature className="h-4 w-4 mr-1" />Create Quote</Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
};

export default CheckoutPage;
