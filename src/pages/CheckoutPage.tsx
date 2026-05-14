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
import { ListingPageHeader } from '@/components/listing';
import { useApp, PRODUCT_CATALOG } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, AlertTriangle, FileSignature } from 'lucide-react';

interface LineDraft {
  productName: string;
  licenseCount: number;
  unitPrice: number;
  selected: boolean;
}

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { getCompanySubscriptions, createQuote } = useApp();
  const { toast } = useToast();

  const hasActiveSubscription = getCompanySubscriptions().some(s => s.status === 'active' || s.status === 'overdue' || s.status === 'pending_payment');

  // Pre-fill from query (e.g. ?product=DataNet&licenses=3&note=...)
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

  const total = useMemo(
    () => lines.filter(l => l.selected).reduce((a, l) => a + l.licenseCount * l.unitPrice, 0),
    [lines]
  );

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };

  const handleCreateQuote = () => {
    const selected = lines.filter(l => l.selected);
    if (selected.length === 0) {
      toast({ title: 'Select at least one product', variant: 'destructive' });
      return;
    }
    const quote = createQuote({
      lineItems: selected.map(l => ({
        productName: l.productName,
        licenseCount: l.licenseCount,
        unitPrice: l.unitPrice,
        total: l.licenseCount * l.unitPrice,
      })),
      note,
    });
    toast({
      title: 'Quote created successfully',
      description: `${quote.quoteNumber} — The quote will expire in 30 days.`,
    });
    navigate('/quotes');
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl">
        <ListingPageHeader
          title="Checkout"
          description={fromQuote ? `Regenerating quote ${fromQuote}` : 'Build a new quote for your account.'}
        />

        {hasActiveSubscription && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You already have an active subscription. To modify or add products/licenses, please request a quote from the
              Subscriptions page.
              <Button variant="link" className="px-1" onClick={() => navigate('/subscriptions?tab=quotes')}>Go to Subscriptions</Button>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />Products
            </CardTitle>
          </CardHeader>
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
                  <Input
                    type="number" min={1} value={l.licenseCount}
                    onChange={(e) => updateLine(idx, { licenseCount: Math.max(1, parseInt(e.target.value) || 1) })}
                    disabled={!l.selected}
                  />
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
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-primary" />Quote Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="note">Quote Note</Label>
              <Textarea
                id="note" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Add any notes or instructions for this quote"
                className="mt-1.5 min-h-[100px]"
              />
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
          <Button onClick={handleCreateQuote}>
            <FileSignature className="h-4 w-4 mr-1" />Create Quote
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default CheckoutPage;
