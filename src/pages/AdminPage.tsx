import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ListingPageHeader } from '@/components/listing';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useApp, PaymentTerms, CatalogProduct } from '@/contexts/AppContext';
import { calculateProratedAdd } from '@/lib/proration';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { useReadOnlyGuard } from '@/hooks/useReadOnlyGuard';
import {
  Building2, ShieldCheck, Save, RefreshCw, AlertOctagon, Undo2, CheckCircle2,
  Calculator, DollarSign, UserCog, AlertTriangle,
} from 'lucide-react';

export const AdminPage = () => {
  const {
    companies, getCompanyConfig, updateCompanyConfig, forceGenerateRenewalInvoices,
    forceSuspendCurrentSubscription, restoreActiveSubscription, approvePendingQuoteRequests,
    catalogProducts, updateCatalogProductMaintenance, useLegacyProration, setUseLegacyProration, can,
  } = useApp();
  const { toast } = useToast();
  const { readOnly } = useReadOnlyGuard();
  const showAccountManagement = can('owner_only_actions');
  const [pricingDialogProduct, setPricingDialogProduct] = useState<CatalogProduct | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const demoMode = useMemo(() => {
    if (searchParams.get('demo') === '1') {
      sessionStorage.setItem('leimberg.demoMode', '1');
      return true;
    }
    return sessionStorage.getItem('leimberg.demoMode') === '1';
  }, [searchParams]);
  const [companyId, setCompanyId] = useState(companies[0]?.id || 'company-1');
  const cfg = getCompanyConfig(companyId);
  const [eligibility, setEligibility] = useState<'pay_on_receipt' | 'pay_on_terms'>(cfg.paymentEligibility);
  const [terms, setTerms] = useState<PaymentTerms>(cfg.terms || 'Net 30');

  // Re-sync when company changes
  const onCompanyChange = (id: string) => {
    setCompanyId(id);
    const c = getCompanyConfig(id);
    setEligibility(c.paymentEligibility);
    setTerms(c.terms || 'Net 30');
  };

  const handleSave = () => {
    const payOnTermsEnabled = eligibility === 'pay_on_terms';
    updateCompanyConfig(companyId, {
      paymentEligibility: eligibility,
      payOnTermsEnabled,
      terms: payOnTermsEnabled ? terms : undefined,
      defaultBillingMethod: payOnTermsEnabled ? 'pay_on_terms' : 'pay_on_receipt',
    });
    toast({ title: 'Payment eligibility updated successfully.' });
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-3xl">
        <ListingPageHeader
          title="Admin Tool"
          description="Configure customer billing eligibility and run admin actions."
          showCompanyContext={false}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />Company Payment Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label>Company / Firm</Label>
              <Select value={companyId} onValueChange={onCompanyChange}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />{c.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Payment Eligibility</Label>
              <RadioGroup value={eligibility} onValueChange={(v) => setEligibility(v as 'pay_on_receipt' | 'pay_on_terms')} className="mt-2 space-y-2">
                <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 ${eligibility === 'pay_on_receipt' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="pay_on_receipt" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Pay on Receipt only</div>
                    <div className="text-xs text-muted-foreground">Customer can use Pay Immediately or Pay on Receipt.</div>
                  </div>
                </label>
                <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 ${eligibility === 'pay_on_terms' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="pay_on_terms" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Pay on Terms</div>
                    <div className="text-xs text-muted-foreground">Customer also gets Pay on Terms with approved net terms.</div>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {eligibility === 'pay_on_terms' && (
              <div>
                <Label>Payment Terms</Label>
                <Select value={terms} onValueChange={(v) => setTerms(v as PaymentTerms)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Net 15">Net 15</SelectItem>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 45">Net 45</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Current Eligibility</span><Badge variant="outline" className="status-active">{cfg.paymentEligibility === 'pay_on_terms' ? 'Pay on Terms' : 'Pay on Receipt'}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pay on Terms Enabled</span><span>{cfg.payOnTermsEnabled ? 'Yes' : 'No'}</span></div>
              {cfg.terms && <div className="flex justify-between"><span className="text-muted-foreground">Terms</span><span>{cfg.terms}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Default Billing Method</span><span>{cfg.defaultBillingMethod.replace(/_/g, ' ')}</span></div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={readOnly}><Save className="h-4 w-4 mr-1" />Save Configuration</Button>
            </div>
          </CardContent>
        </Card>

        {/* Product Pricing Configuration (per discovery Q5) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />Product Pricing Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border p-3 space-y-3 bg-muted/30">
              <div className="text-sm font-medium">Pricing Calculation Mode</div>
              <RadioGroup
                value={useLegacyProration ? 'legacy' : 'new'}
                onValueChange={(v) => setUseLegacyProration(v === 'legacy')}
                className="space-y-2"
              >
                <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 bg-card ${!useLegacyProration ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="new" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">New (maintenance-only proration)</div>
                    <div className="text-xs text-muted-foreground">
                      License portion is charged in full on mid-cycle adds; maintenance portion is prorated by day.
                    </div>
                  </div>
                </label>
                <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 bg-card ${useLegacyProration ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="legacy" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Legacy (full-price proration)</div>
                    <div className="text-xs text-muted-foreground">
                      Falls back to the previous simple proration on the TOTAL price. Use to revert if needed.
                    </div>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              {catalogProducts.map(p => {
                const licensePortion = Math.max(0, p.pricePerSeatPerYear - p.maintenancePerSeatPerYear);
                return (
                  <div key={p.name} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center border rounded-md p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Total {formatCurrency(p.pricePerSeatPerYear)} · License {formatCurrency(licensePortion)} · Maintenance {formatCurrency(p.maintenancePerSeatPerYear)}
                      </div>
                    </div>
                    <div className="text-right">
                      <Label htmlFor={`maint-${p.name}`} className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Maintenance / seat / year
                      </Label>
                      <Input
                        id={`maint-${p.name}`}
                        type="number"
                        min={0}
                        max={p.pricePerSeatPerYear}
                        value={p.maintenancePerSeatPerYear}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          const safe = Number.isFinite(v) ? Math.max(0, Math.min(p.pricePerSeatPerYear, v)) : 0;
                          updateCatalogProductMaintenance(p.name, safe);
                        }}
                        className="w-28 mt-1 text-right"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="text-right">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Total
                      </Label>
                      <div className="text-sm font-medium mt-1">{formatCurrency(p.pricePerSeatPerYear)}</div>
                    </div>
                    <div>
                      <Button variant="outline" size="sm" onClick={() => setPricingDialogProduct(p)}>
                        <Calculator className="h-3.5 w-3.5 mr-1" />View pricing config
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {showAccountManagement && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCog className="h-4 w-4 text-primary" />Account Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Capabilities reserved for the Account Owner only.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setTransferOpen(true)}>
                  <UserCog className="h-4 w-4 mr-1" />Transfer Ownership
                </Button>
                <Button variant="destructive" onClick={() => setCloseOpen(true)}>
                  <AlertTriangle className="h-4 w-4 mr-1" />Close Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {demoMode && (
          <Card className="border-warning/40 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-warning" />Demo Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Generate renewal invoices for any active subscription regardless of how far away its renewal date is.
                Useful for showing the renewal flow end-to-end.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const created = forceGenerateRenewalInvoices();
                    toast({
                      title: created > 0 ? `Generated ${created} renewal invoice${created === 1 ? '' : 's'}` : 'No new invoices generated',
                      description: created > 0 ? 'Check the Invoices page.' : 'All eligible subscriptions already have renewal invoices.',
                    });
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />Force Generate Renewal Invoices
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const ok = forceSuspendCurrentSubscription();
                    toast({
                      title: ok ? 'Subscription suspended for demo purposes.' : 'No active subscription to suspend',
                      description: ok ? 'Reload the page to see the destructive banner and gated downloads.' : undefined,
                    });
                  }}
                >
                  <AlertOctagon className="h-4 w-4 mr-1" />Force Subscription Suspension
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    restoreActiveSubscription();
                    toast({ title: 'Subscription restored.' });
                  }}
                >
                  <Undo2 className="h-4 w-4 mr-1" />Restore Active Subscription
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const n = approvePendingQuoteRequests();
                    toast({
                      title: n > 0
                        ? `Approved ${n} quote request${n === 1 ? '' : 's'}`
                        : 'No pending quote requests',
                      description: n > 0
                        ? 'Customers can now accept their formal quote.'
                        : undefined,
                    });
                  }}
                  disabled={readOnly}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />Approve Pending Quote Requests
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <PricingConfigDialog
        product={pricingDialogProduct}
        useLegacyProration={useLegacyProration}
        onOpenChange={(v) => !v && setPricingDialogProduct(null)}
      />

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
            <DialogDescription>
              This feature is coming soon. Contact support to transfer ownership.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setTransferOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />Close Account
            </DialogTitle>
            <DialogDescription>
              This feature is coming soon. Contact support to close your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled>Close Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

const PricingConfigDialog = ({
  product, useLegacyProration, onOpenChange,
}: {
  product: CatalogProduct | null;
  useLegacyProration: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const [seats, setSeats] = useState(5);
  const [daysRemaining, setDaysRemaining] = useState(200);

  if (!product) return null;
  const licensePortion = Math.max(0, product.pricePerSeatPerYear - product.maintenancePerSeatPerYear);
  const today = new Date();
  const renewalDate = new Date(today.getTime() + daysRemaining * 86400000);
  const proration = calculateProratedAdd({
    product,
    seats: Math.max(1, seats),
    addDate: today,
    renewalDate,
    useLegacyProration,
  });

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pricing config — {product.name}</DialogTitle>
          <DialogDescription>
            License/maintenance split and a live proration calculator. Customer invoices
            show a single line-item total; this split is internal only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total / seat / year</div>
              <div className="font-semibold mt-1">{formatCurrency(product.pricePerSeatPerYear)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">License portion</div>
              <div className="font-semibold mt-1">{formatCurrency(licensePortion)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Maintenance portion</div>
              <div className="font-semibold mt-1">{formatCurrency(product.maintenancePerSeatPerYear)}</div>
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <div className="text-sm font-medium">Live proration calculator</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="calc-seats">Seats</Label>
                <Input
                  id="calc-seats" type="number" min={1}
                  value={seats}
                  onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="calc-days">Days remaining (of 365)</Label>
                <Input
                  id="calc-days" type="number" min={0} max={365}
                  value={daysRemaining}
                  onChange={(e) => setDaysRemaining(Math.max(0, Math.min(365, parseInt(e.target.value, 10) || 0)))}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="rounded-md bg-card border p-3 text-sm space-y-1">
              {useLegacyProration ? (
                <div className="flex justify-between"><span className="text-muted-foreground">Legacy prorated total</span><span className="font-semibold">{formatCurrency(proration.totalCharge)}</span></div>
              ) : (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">License charge ({formatCurrency(licensePortion)} × {seats})</span><span>{formatCurrency(proration.licenseCharge)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Prorated maintenance ({formatCurrency(product.maintenancePerSeatPerYear)} × {seats}) × ({proration.daysRemaining}/365)</span><span>{formatCurrency(proration.maintenanceChargeProrated)}</span></div>
                  <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{formatCurrency(proration.totalCharge)}</span></div>
                </>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPage;
