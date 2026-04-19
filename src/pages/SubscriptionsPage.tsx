import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
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
  CreditCard, Eye, Calendar, Edit, CheckCircle2, AlertTriangle, ArrowRight, Download, Check,
  Building2, Mail, Phone, MapPin, FileText, Receipt, FileSignature, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PaymentMethod = 'Direct ACH' | 'Credit Card' | 'ACH e-Check' | 'Paper Check' | 'Invoice Only (Net 30)';

export const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const {
    currentCompany,
    getCompanySubscriptions,
    getCompanyInvoices,
    getAssignedLicenseCount,
  } = useApp();
  const { toast } = useToast();

  const subscriptions = getCompanySubscriptions();
  const invoices = getCompanyInvoices();

  const [selectedSubIndex, setSelectedSubIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [editBillingOpen, setEditBillingOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Credit Card');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('all');

  const currentSub = subscriptions[selectedSubIndex] || null;
  const subInvoices = invoices.filter(i => currentSub && i.subscriptionId === currentSub.id);

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

  // Realistic quotes
  const quotes = currentSub ? [
    { id: 'Q-2026-001', date: '2026-03-20', expires: '2026-05-20',
      description: `Renewal Quote — ${currentSub.name}`,
      amount: subTotal(currentSub), status: 'pending' as const },
    { id: 'Q-2026-002', date: '2026-02-10', expires: '2026-04-10',
      description: `Add-on Seats — ${currentSub.name}`,
      amount: 1495, status: 'expired' as const },
  ] : [];

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
      case 'Current':
        return 'status-active';
      case 'pending':
      case 'Renewal Due':
        return 'status-invited';
      case 'overdue':
      case 'Payment Overdue':
        return 'status-overdue';
      default: return '';
    }
  };

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
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                              <Button variant="outline" size="sm" onClick={() => document.getElementById('renewal-options')?.scrollIntoView({ behavior: 'smooth' })}>
                                <RefreshCw className="h-3 w-3 mr-1" />Renewal Options
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => { setDraftBilling(billing); setEditBillingOpen(true); }}>
                                <Building2 className="h-3 w-3 mr-1" />Billing Details
                              </Button>
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
                                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/licenses')}>
                                    View License Assignments<ArrowRight className="h-3 w-3 ml-1" />
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
                    <TabsContent value="quotes" className="p-6">
                      {quotes.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No quotes available.</div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Quote #</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead>Expires</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {quotes.map(q => (
                              <TableRow key={q.id}>
                                <TableCell className="font-medium">{q.id}</TableCell>
                                <TableCell className="text-sm">{q.description}</TableCell>
                                <TableCell>{new Date(q.date).toLocaleDateString()}</TableCell>
                                <TableCell>{new Date(q.expires).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right font-medium">${q.amount.toLocaleString()}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={q.status === 'pending' ? 'status-invited' : 'status-inactive'}>{q.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Quote viewed', description: q.id })}><Eye className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Downloading quote PDF', description: q.id })}><Download className="h-4 w-4" /></Button>
                                  {q.status === 'pending' && (
                                    <Button variant="outline" size="sm" className="ml-1" onClick={() => toast({ title: 'Quote accepted', description: q.id })}>
                                      <Check className="h-4 w-4 mr-1" />Accept
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
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
    </MainLayout>
  );
};
