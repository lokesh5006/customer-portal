import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp, Quote, SubscriptionProduct, Subscription } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { ListingPageHeader } from '@/components/listing';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard, Eye, Edit, CheckCircle2, AlertTriangle, ArrowRight, Download, Check,
  Building2, Mail, Phone, MapPin, FileText, Receipt, FileSignature, RefreshCw, Settings, X, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RenewalFlyout } from '@/components/billing/RenewalFlyout';
import {
  ManageLicensesDrawer, AcceptQuoteDialog, DeclineQuoteDialog, ViewNoteDialog, RequestQuoteDialog,
} from '@/components/subscriptions/QuoteDialogs';

type PaymentMethod = 'Direct ACH' | 'Credit Card' | 'ACH e-Check' | 'Paper Check' | 'Invoice Only (Net 30)';

export const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const {
    currentCompany,
    getCompanySubscriptions,
    getCompanyInvoices,
    getCompanyQuotes,
    getCompanyQuoteRequests,
    getAssignedLicenseCount,
    getCompanyConfig,
    markInvoicePaid,
  } = useApp();
  const { toast } = useToast();
  const cfg = getCompanyConfig();

  const subscriptions = getCompanySubscriptions();
  const invoices = getCompanyInvoices();
  const quotes = getCompanyQuotes();
  const quoteRequests = getCompanyQuoteRequests();

  const [selectedSubIndex, setSelectedSubIndex] = useState(0);
  const initialTab = params.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editBillingOpen, setEditBillingOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Credit Card');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('all');
  const [renewalOpen, setRenewalOpen] = useState(false);

  // Drawer + dialogs state
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSub, setManageSub] = useState<Subscription | null>(null);
  const [manageProd, setManageProd] = useState<SubscriptionProduct | null>(null);
  const [acceptQuote, setAcceptQuote] = useState<Quote | null>(null);
  const [declineQuote, setDeclineQuote] = useState<Quote | null>(null);
  const [noteQuote, setNoteQuote] = useState<Quote | null>(null);
  const [requestQuoteOpen, setRequestQuoteOpen] = useState(false);

  const currentSub = subscriptions[selectedSubIndex] || null;
  const subInvoices = invoices.filter(i => currentSub && i.subscriptionId === currentSub.id);
  const hasActiveSubscription = subscriptions.some(s => ['active', 'overdue', 'pending_payment'].includes(s.status));

  // Realistic billing details (state-managed for the edit modal)
  const [billing, setBilling] = useState({
    companyName: currentCompany?.name || 'ABC Accounting',
    address: '123 Main St, Suite 400',
    city: 'New York',
    stateZip: 'NY 10001',
    contactName: 'Sarah Johnson',
    contactEmail: 'billing@abcaccounting.com',
    phone: '(212) 555-0101',
    taxId: '12-3456789',
  });
  const [draftBilling, setDraftBilling] = useState(billing);

  const subTotal = (sub: typeof subscriptions[number]) =>
    sub.products.reduce((a, p) => a + p.licenseCount * p.pricePerLicense, 0);

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    setParams({ tab: v }, { replace: true });
  };

  const openManageDrawer = (sub: Subscription, prod: SubscriptionProduct) => {
    setManageSub(sub);
    setManageProd(prod);
    setManageOpen(true);
  };


  const accountStatus: 'Current' | 'Renewal Due' | 'Payment Overdue' = (() => {
    const overdue = subInvoices.some(i => i.status === 'overdue');
    if (overdue) return 'Payment Overdue';
    const renewal = currentSub ? new Date(currentSub.renewalDate) : null;
    if (renewal && (renewal.getTime() - Date.now()) / (1000 * 60 * 60 * 24) < 60) return 'Renewal Due';
    return 'Current';
  })();

  const statusBadgeClass = (s: string) => {
    switch (s) {
      case 'paid':
      case 'active':
      case 'payment_terms_applied':
      case 'Current':
        return 'status-active';
      case 'pending':
      case 'awaiting_payment':
      case 'pending_payment':
      case 'Renewal Due':
        return 'status-invited';
      case 'overdue':
      case 'unpaid':
      case 'Payment Overdue':
        return 'status-overdue';
      default: return '';
    }
  };
  const formatStatus = (s: string) => s.replace(/_/g, ' ');

  const filteredInvoices = subInvoices.filter(i => invoiceFilter === 'all' || i.status === invoiceFilter);

  const lastPaid = subInvoices.find(i => i.status === 'paid');
  const nextInvoice = subInvoices.find(i => i.status !== 'paid');
  const outstanding = subInvoices.filter(i => i.balance > 0).reduce((a, i) => a + i.balance, 0);

  const paymentMethods: PaymentMethod[] = ['Direct ACH', 'Credit Card', 'ACH e-Check', 'Paper Check', 'Invoice Only (Net 30)'];

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="Subscriptions"
          description="Manage your active products, renewal options, invoices, and billing details."
        />

        {subscriptions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Subscriptions</h3>
              <p className="text-muted-foreground mb-4">You don't have any active subscriptions yet.</p>
              <Button onClick={() => navigate('/signup')}>Get Started</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Subscription Selector */}
            {subscriptions.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {subscriptions.map((sub, idx) => (
                  <Button
                    key={sub.id}
                    variant={selectedSubIndex === idx ? 'default' : 'outline'}
                    onClick={() => { setSelectedSubIndex(idx); setActiveTab('overview'); }}
                    className="h-auto py-2 px-4"
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium">{sub.name}</div>
                      <div className="text-xs opacity-80">{sub.planType} · {sub.products.length} product{sub.products.length !== 1 ? 's' : ''}</div>
                    </div>
                  </Button>
                ))}
              </div>
            )}

            {currentSub && (
              <Card>
                <CardContent className="p-0">
                  <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <div className="border-b px-4 pt-4">
                      <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="invoices">Invoices</TabsTrigger>
                        <TabsTrigger value="quotes">Quotes</TabsTrigger>
                      </TabsList>
                    </div>

                    {/* OVERVIEW TAB */}
                    <TabsContent value="overview" className="p-6 space-y-6">
                      {/* SECTION 1: Subscription Summary Header */}
                      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                        <CardContent className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold">{currentSub.name}</h3>
                                <Badge variant="outline" className={statusBadgeClass(accountStatus)}>{accountStatus}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Renews {new Date(currentSub.renewalDate).toLocaleDateString()} · Billed {currentSub.planType} · Last paid by {paymentMethod}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {accountStatus === 'Payment Overdue' && (
                                <Button size="sm" variant="destructive" onClick={() => setRenewalOpen(true)}>
                                  <CreditCard className="h-3 w-3 mr-1" />Pay Now
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-4 mt-4 pt-4 border-t">
                            <div>
                              <p className="text-xs text-muted-foreground">Next Invoice</p>
                              <p className="font-semibold">${(nextInvoice?.amount || subTotal(currentSub)).toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">due {new Date(currentSub.renewalDate).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Last Payment</p>
                              <p className="font-semibold">{lastPaid ? `$${lastPaid.amount.toLocaleString()}` : '—'}</p>
                              <p className="text-xs text-muted-foreground">{lastPaid ? new Date(lastPaid.date).toLocaleDateString() : '—'} · {paymentMethod}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                              <p className={cn('font-semibold', outstanding > 0 && 'text-destructive')}>${outstanding.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{outstanding > 0 ? 'Action required' : 'Nothing due'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Products</p>
                              <p className="font-semibold">{currentSub.products.length}</p>
                              <p className="text-xs text-muted-foreground">in this subscription</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* SECTION 2: Products Under This Subscription */}
                      <div>
                        <h3 className="font-semibold mb-3 text-sm">Products in this subscription</h3>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {currentSub.products.map(prod => {
                            const assigned = getAssignedLicenseCount(currentSub.id, prod.id);
                            const avail = prod.licenseCount - assigned;
                            return (
                              <Card key={prod.id} className="hover:border-primary/40 transition-colors">
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-semibold text-sm">{prod.name}</h4>
                                    <Badge variant="outline" className={statusBadgeClass(prod.status)}>{prod.status}</Badge>
                                  </div>
                                  <div className="flex items-baseline justify-between text-sm">
                                    <span className="text-muted-foreground text-xs">Seats assigned</span>
                                    <span className="font-semibold">{assigned}/{prod.licenseCount}</span>
                                  </div>
                                  <div className="flex items-baseline justify-between text-sm">
                                    <span className="text-muted-foreground text-xs">Available</span>
                                    <span className={cn('font-semibold', avail === 0 ? 'text-destructive' : 'text-success')}>{avail}</span>
                                  </div>
                                  <Button variant="outline" size="sm" className="w-full" onClick={() => openManageDrawer(currentSub, prod)}>
                                    <Settings className="h-3 w-3 mr-1" />Manage Licenses
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>

                      {/* Section 3: Billing Summary + Renewal Options */}
                      <div id="renewal-options" className="grid gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Receipt className="h-4 w-4 text-primary" />Billing Summary
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Last Payment Date</span>
                              <span className="font-medium">{lastPaid ? new Date(lastPaid.date).toLocaleDateString() : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Last Payment Method</span>
                              <span className="font-medium">Credit Card</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Next Invoice Amount</span>
                              <span className="font-medium">${(nextInvoice?.amount || subTotal(currentSub)).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Next Renewal Date</span>
                              <span className="font-medium">{new Date(currentSub.renewalDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Current Balance</span>
                              <span className="font-medium">${outstanding.toLocaleString()}</span>
                            </div>
                            {outstanding > 0 && (
                              <div className="flex justify-between text-destructive">
                                <span>Outstanding Balance</span>
                                <span className="font-semibold">${outstanding.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="pt-2 border-t flex justify-between items-center">
                              <span className="text-muted-foreground">Status</span>
                              <Badge variant="outline" className={statusBadgeClass(accountStatus)}>{accountStatus}</Badge>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Section 3: Renewal Options */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <RefreshCw className="h-4 w-4 text-primary" />Renewal Options
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs text-muted-foreground mb-3">Select a payment method for your next renewal.</p>
                            <div className="space-y-2">
                              {paymentMethods.map(opt => {
                                const selected = paymentMethod === opt;
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => { setPaymentMethod(opt); toast({ title: 'Renewal payment method updated', description: opt }); }}
                                    className={cn(
                                      'w-full flex items-center justify-between p-2.5 rounded-md border text-sm transition-colors text-left',
                                      selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                                    )}
                                  >
                                    <span className={cn('flex items-center gap-2', selected && 'font-medium')}>
                                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                                      {opt}
                                    </span>
                                    {selected && <Badge variant="outline" className="status-active text-xs"><Check className="h-3 w-3 mr-1" />Current</Badge>}
                                  </button>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Section 4: Billing Details */}
                      <Card className="group">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />Billing Details
                          </CardTitle>
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => { setDraftBilling(billing); setEditBillingOpen(true); }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-4 md:grid-cols-2 text-sm">
                            <div className="flex items-start gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Company Name</p>
                                <p className="font-medium">{billing.companyName}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Address</p>
                                <p className="font-medium">{billing.address}<br />{billing.city}, {billing.stateZip}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Billing Contact</p>
                                <p className="font-medium">{billing.contactName}</p>
                                <p className="text-xs text-muted-foreground">{billing.contactEmail}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs text-muted-foreground">Phone</p>
                                <p className="font-medium">{billing.phone}</p>
                                <p className="text-xs text-muted-foreground mt-1">Tax ID: {billing.taxId}</p>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t grid gap-3 md:grid-cols-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Payment Eligibility</p>
                              <Badge variant="outline" className={statusBadgeClass(cfg.payOnTermsEnabled ? 'active' : 'pending')}>
                                {cfg.payOnTermsEnabled ? 'Pay on Terms' : 'Pay on Receipt'}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Default Billing Method</p>
                              <p className="font-medium capitalize">{cfg.defaultBillingMethod.replace(/_/g, ' ')}</p>
                            </div>
                            {cfg.terms && (
                              <div>
                                <p className="text-xs text-muted-foreground">Terms</p>
                                <p className="font-medium">{cfg.terms}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-muted-foreground">Subscription Status</p>
                              <Badge variant="outline" className={statusBadgeClass(currentSub.status)}>{formatStatus(currentSub.status)}</Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">
                            Payment eligibility is managed by Admin. Contact support if you need payment terms enabled.
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* INVOICES TAB */}
                    <TabsContent value="invoices" className="p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex gap-1">
                          {(['all', 'paid', 'pending', 'overdue'] as const).map(f => (
                            <Button
                              key={f}
                              variant={invoiceFilter === f ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setInvoiceFilter(f)}
                              className="capitalize"
                            >
                              {f}
                            </Button>
                          ))}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
                          <FileText className="h-4 w-4 mr-1" />All Invoices
                        </Button>
                      </div>
                      {filteredInvoices.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Receipt className="h-12 w-12 mx-auto mb-2 opacity-30" />
                          No invoices match this filter.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Invoice #</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredInvoices.map(inv => (
                              <TableRow key={inv.id}>
                                <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {inv.lineItems.map(l => l.product).join(', ')}
                                </TableCell>
                                <TableCell>{new Date(inv.date).toLocaleDateString()}</TableCell>
                                <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={statusBadgeClass(inv.status)}>{inv.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">${inv.amount.toLocaleString()}</TableCell>
                                <TableCell className="text-right">
                                  {(inv.status === 'overdue' || inv.status === 'unpaid' || inv.status === 'pending') && (
                                    <Button variant="default" size="sm" className="mr-1" onClick={() => {
                                      if (inv.invoiceType === 'Renewal Invoice' || inv.invoiceType === 'Initial Invoice') {
                                        setRenewalOpen(true);
                                      } else {
                                        toast({ title: 'Pay invoice', description: `Opening payment for ${inv.invoiceNumber}` });
                                      }
                                    }}>
                                      <CreditCard className="h-3 w-3 mr-1" />Pay Now
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Downloading PDF', description: inv.invoiceNumber })}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>

                    {/* QUOTES TAB */}
                    <TabsContent value="quotes" className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">Quotes</h3>
                          <p className="text-xs text-muted-foreground">Active quotes expire 30 days after creation.</p>
                        </div>
                        {hasActiveSubscription ? (
                          <Button onClick={() => setRequestQuoteOpen(true)}>
                            <FileSignature className="h-4 w-4 mr-1" />Request a Quote
                          </Button>
                        ) : (
                          <Button onClick={() => navigate('/checkout')}>
                            <FileSignature className="h-4 w-4 mr-1" />New Quote
                          </Button>
                        )}
                      </div>

                      {hasActiveSubscription && (
                        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                          You already have an active subscription. To modify or add products/licenses, please request a quote.
                        </div>
                      )}

                      {quotes.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No quotes available.</div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Quote #</TableHead>
                              <TableHead>Product(s)</TableHead>
                              <TableHead className="text-center">Licenses</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead>Expires</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Note</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {quotes.map(q => {
                              const isExpired = q.status === 'expired';
                              const totalLicenses = q.lineItems.reduce((a, l) => a + l.licenseCount, 0);
                              const noteShort = q.note ? (q.note.length > 30 ? q.note.slice(0, 30) + '…' : q.note) : '—';
                              const statusClass =
                                q.status === 'active' ? 'status-active' :
                                q.status === 'accepted' ? 'status-active' :
                                q.status === 'declined' ? 'status-overdue' :
                                'status-inactive';
                              return (
                                <TableRow key={q.id}>
                                  <TableCell className="font-medium">{q.quoteNumber}</TableCell>
                                  <TableCell className="text-sm">{q.lineItems.map(l => l.productName).join(', ')}</TableCell>
                                  <TableCell className="text-center">{totalLicenses}</TableCell>
                                  <TableCell>{new Date(q.createdDate).toLocaleDateString()}</TableCell>
                                  <TableCell>{new Date(q.expiryDate).toLocaleDateString()}</TableCell>
                                  <TableCell className="text-right font-medium">${q.amount.toLocaleString()}</TableCell>
                                  <TableCell><Badge variant="outline" className={statusClass}>{q.status}</Badge></TableCell>
                                  <TableCell>
                                    {q.note ? (
                                      <button className="text-xs text-primary hover:underline text-left" onClick={() => setNoteQuote(q)}>
                                        {noteShort}
                                      </button>
                                    ) : <span className="text-xs text-muted-foreground">—</span>}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1 items-center">
                                      {q.status === 'active' && (
                                        <>
                                          <Button size="sm" variant="outline" onClick={() => setAcceptQuote(q)}>
                                            <Check className="h-3 w-3 mr-1" />Accept
                                          </Button>
                                          <Button size="sm" variant="ghost" onClick={() => setDeclineQuote(q)}>
                                            <X className="h-3 w-3 mr-1" />Decline
                                          </Button>
                                        </>
                                      )}
                                      {isExpired && (
                                        <span className="text-xs text-muted-foreground" title="This quote has expired. Please generate a new quote.">
                                          Expired
                                        </span>
                                      )}
                                      {q.status === 'declined' && (
                                        <Button size="sm" variant="outline" onClick={() => navigate(`/checkout?fromQuote=${q.quoteNumber}&product=${encodeURIComponent(q.lineItems[0]?.productName || '')}&licenses=${q.lineItems[0]?.licenseCount || 1}&note=${encodeURIComponent(q.note || '')}`)}>
                                          <RefreshCw className="h-3 w-3 mr-1" />Regenerate
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}

                      {quoteRequests.length > 0 && (
                        <div className="space-y-2 pt-4 border-t">
                          <h4 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" />Quote Requests</h4>
                          <div className="space-y-2">
                            {quoteRequests.map(r => (
                              <div key={r.id} className="border rounded-md p-3 text-sm">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium">{r.products.map(p => `${p.productName} (${p.desiredLicenseCount})`).join(', ')}</div>
                                  <Badge variant="outline" className="status-invited">{r.status.replace('_', ' ')}</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">{new Date(r.createdDate).toLocaleDateString()}</div>
                                <div className="text-xs mt-1">{r.note}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Edit Billing Details Modal */}
      <Dialog open={editBillingOpen} onOpenChange={setEditBillingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Billing Details</DialogTitle>
            <DialogDescription>Update your billing contact and address information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Company Name</Label><Input value={draftBilling.companyName} onChange={e => setDraftBilling({ ...draftBilling, companyName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={draftBilling.address} onChange={e => setDraftBilling({ ...draftBilling, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>City</Label><Input value={draftBilling.city} onChange={e => setDraftBilling({ ...draftBilling, city: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>State / ZIP</Label><Input value={draftBilling.stateZip} onChange={e => setDraftBilling({ ...draftBilling, stateZip: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Contact Name</Label><Input value={draftBilling.contactName} onChange={e => setDraftBilling({ ...draftBilling, contactName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Contact Email</Label><Input value={draftBilling.contactEmail} onChange={e => setDraftBilling({ ...draftBilling, contactEmail: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={draftBilling.phone} onChange={e => setDraftBilling({ ...draftBilling, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Tax ID</Label><Input value={draftBilling.taxId} onChange={e => setDraftBilling({ ...draftBilling, taxId: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBillingOpen(false)}>Cancel</Button>
            <Button onClick={() => { setBilling(draftBilling); toast({ title: 'Billing details saved' }); setEditBillingOpen(false); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RenewalFlyout
        open={renewalOpen}
        onOpenChange={setRenewalOpen}
        subscription={currentSub}
        renewalPeriod="Jan 1, 2027 → Dec 31, 2027"
      />

      <ManageLicensesDrawer
        open={manageOpen}
        onOpenChange={setManageOpen}
        subscription={manageSub}
        product={manageProd}
      />
      <AcceptQuoteDialog open={!!acceptQuote} onOpenChange={(v) => !v && setAcceptQuote(null)} quote={acceptQuote} />
      <DeclineQuoteDialog open={!!declineQuote} onOpenChange={(v) => !v && setDeclineQuote(null)} quote={declineQuote} />
      <ViewNoteDialog open={!!noteQuote} onOpenChange={(v) => !v && setNoteQuote(null)} quote={noteQuote} />
      <RequestQuoteDialog open={requestQuoteOpen} onOpenChange={setRequestQuoteOpen} />
    </MainLayout>
  );
};
