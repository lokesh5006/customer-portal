import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ListingPageHeader } from '@/components/listing';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp, PaymentTerms } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { useReadOnlyGuard } from '@/hooks/useReadOnlyGuard';
import { Building2, ShieldCheck, Save, RefreshCw, AlertOctagon, Undo2 } from 'lucide-react';

export const AdminPage = () => {
  const {
    companies, getCompanyConfig, updateCompanyConfig, forceGenerateRenewalInvoices,
    forceSuspendCurrentSubscription, restoreActiveSubscription,
  } = useApp();
  const { toast } = useToast();
  const { readOnly } = useReadOnlyGuard();
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminPage;
