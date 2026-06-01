import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp, Quote, SubscriptionProduct, Subscription, LicenseType, Invoice } from '@/contexts/AppContext';
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
import { ListingPageHeader, SortableHeader, SortState } from '@/components/listing';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard, Eye, Edit, CheckCircle2, Download, Check,
  FileText, Receipt, FileSignature, RefreshCw, X, MessageSquare,
  Monitor, Globe, BarChart3, Database, Package, MoreVertical, Search, Clock, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ManageLicensesDrawer, AcceptQuoteDrawer, DeclineQuoteDialog, ViewNoteDialog, ViewDeclineReasonDialog, RequestQuoteDialog,
} from '@/components/subscriptions/QuoteDialogs';
import { RenewalFlyout } from '@/components/billing/RenewalFlyout';
import { useReadOnlyGuard, READ_ONLY_TOOLTIP } from '@/hooks/useReadOnlyGuard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type PaymentMethod = 'Direct ACH' | 'Credit Card' | 'ACH e-Check' | 'Paper Check' | 'Invoice Only (Net 30)';

const formatCurrency = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const productIcon = (name: string) => {
  if (name === 'NumberCruncher Desktop') return Monitor;
  if (name === 'NumberCruncher Web') return Globe;
  if (name === 'QuickView Desktop') return BarChart3;
  if (name === 'DataNet') return Database;
  return Package;
};

export const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const {
    currentCompany,
    getCompanySubscriptions,
    getCompanyInvoices,
    getCompanyQuotes,
    getCompanyQuoteRequests,
    getCompanyConfig,
    getAssignedLicenseCount,
    isFirstTimeCustomer,
    isReadOnlyMode,
    renameSubscription,
    cancelQuoteRequest,
    licenses,
  } = useApp();
  const { toast } = useToast();
  const { readOnly } = useReadOnlyGuard();

  useEffect(() => {
    // First-time customer gate: send to Checkout unless they're in read-only
    // mode (pending_payment / suspended), in which case they should see their
    // pending subscription with the read-only banner.
    if (isFirstTimeCustomer() && !isReadOnlyMode()) navigate('/checkout');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allSubscriptions = getCompanySubscriptions();
  // Only show Annual Plan-type subscriptions in the selector pills
  const subscriptions = allSubscriptions.filter(s => s.planType === 'Annual');
  const invoices = getCompanyInvoices();
  const quotes = getCompanyQuotes();
  const quoteRequests = getCompanyQuoteRequests();

  const [selectedSubIndex, setSelectedSubIndex] = useState(0);
  const initialTab = params.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editBillingOpen, setEditBillingOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Credit Card');
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewSubId, setRenewSubId] = useState<string>('');
  const [renewInvoiceId, setRenewInvoiceId] = useState<string | undefined>(undefined);

  // Rename subscription dialog
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameSubId, setRenameSubId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Drawer + dialogs state
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSub, setManageSub] = useState<Subscription | null>(null);
  const [manageProd, setManageProd] = useState<SubscriptionProduct | null>(null);
  const [acceptQuote, setAcceptQuote] = useState<Quote | null>(null);
  const [declineQuote, setDeclineQuote] = useState<Quote | null>(null);
  const [noteQuote, setNoteQuote] = useState<Quote | null>(null);
  const [viewDeclineQuote, setViewDeclineQuote] = useState<Quote | null>(null);
  const [requestQuoteOpen, setRequestQuoteOpen] = useState(false);

  // Per-tab search + sort
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceSort, setInvoiceSort] = useState<SortState>({ key: null, direction: null });
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteSort, setQuoteSort] = useState<SortState>({ key: null, direction: null });

  const currentSub = subscriptions[selectedSubIndex] || null;
  const subInvoices = invoices.filter(i => currentSub && i.subscriptionId === currentSub.id);
  const hasActiveSubscription = subscriptions.some(s => s.status === 'active');

  const termsLabel = getCompanyConfig().terms || 'Net 30';

  // Sort/search helpers for invoices tab
  const INVOICE_STATUS_ORDER: Record<Invoice['status'], number> = {
    awaiting_payment: 0, overdue: 1, upcoming: 2, payment_terms_applied: 3,
    unpaid: 4, pending: 5, paid: 6,
  };
  const filteredSubInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return subInvoices;
    return subInvoices.filter(inv => {
      const haystack: string[] = [
        inv.invoiceNumber, inv.id, inv.description || '', inv.poNumber || '',
        inv.subscriptionName || '', ...inv.lineItems.map(l => l.product || ''),
      ];
      return haystack.some(v => v.toLowerCase().includes(q));
    });
  }, [subInvoices, invoiceSearch]);

  const sortedSubInvoices = useMemo(() => {
    if (!invoiceSort.key || !invoiceSort.direction) return filteredSubInvoices;
    const dir = invoiceSort.direction === 'asc' ? 1 : -1;
    return [...filteredSubInvoices].sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      switch (invoiceSort.key) {
        case 'invoiceNumber': av = a.invoiceNumber.toLowerCase(); bv = b.invoiceNumber.toLowerCase(); break;
        case 'date': av = a.date; bv = b.date; break;
        case 'dueDate': av = a.dueDate; bv = b.dueDate; break;
        case 'total': av = a.totalAmount ?? a.amount; bv = b.totalAmount ?? b.amount; break;
        case 'status': av = INVOICE_STATUS_ORDER[a.status] ?? 99; bv = INVOICE_STATUS_ORDER[b.status] ?? 99; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filteredSubInvoices, invoiceSort]);

  // Sort/search helpers for quotes tab — quotes aren't sub-scoped because
  // the data model doesn't link quotes to subscriptions; we show all company quotes.
  const QUOTE_STATUS_ORDER: Record<Quote['status'], number> = {
    requested: 0, active: 1, accepted: 2, declined: 3, expired: 4,
  };
  const REQUESTED_TOOLTIP =
    "Awaiting sales team response. You'll see the formal quote here when it's ready.";
  const filteredQuotes = useMemo(() => {
    const q = quoteSearch.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(qq => {
      const haystack: string[] = [
        qq.quoteNumber, qq.id, qq.note || '', qq.declineReason || '',
        ...qq.lineItems.map(l => l.productName || ''),
      ];
      return haystack.some(v => v.toLowerCase().includes(q));
    });
  }, [quotes, quoteSearch]);

  const sortedQuotes = useMemo(() => {
    if (!quoteSort.key || !quoteSort.direction) return filteredQuotes;
    const dir = quoteSort.direction === 'asc' ? 1 : -1;
    return [...filteredQuotes].sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      switch (quoteSort.key) {
        case 'quoteNumber': av = a.quoteNumber.toLowerCase(); bv = b.quoteNumber.toLowerCase(); break;
        case 'products': av = (a.lineItems[0]?.productName || '').toLowerCase(); bv = (b.lineItems[0]?.productName || '').toLowerCase(); break;
        case 'createdDate': av = a.createdDate; bv = b.createdDate; break;
        case 'expiryDate': av = a.expiryDate; bv = b.expiryDate; break;
        case 'total': av = a.amount; bv = b.amount; break;
        case 'status': av = QUOTE_STATUS_ORDER[a.status] ?? 99; bv = QUOTE_STATUS_ORDER[b.status] ?? 99; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filteredQuotes, quoteSort]);

  // Used to mark quotes as "expiring soon" (within 3 days)
  const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

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

  const openRenameDialog = (sub: Subscription) => {
    setRenameSubId(sub.id);
    setRenameDraft(sub.name);
    setRenameOpen(true);
  };

  const accountStatus: 'Current' | 'Renewal Due' | 'Payment Overdue' = (() => {
    const overdue = subInvoices.some(i => i.status === 'overdue');
    if (overdue) return 'Payment Overdue';
    const renewal = currentSub ? new Date(currentSub.renewalDate) : null;
    if (renewal && (renewal.getTime() - Date.now()) / (1000 * 60 * 60 * 24) < 60) return 'Renewal Due';
    return 'Current';
  })();

  // Status badge for summary card (uses spec-mandated color classes)
  const summaryStatusLabel = accountStatus === 'Current' ? 'Active' : accountStatus;
  const summaryStatusClass =
    accountStatus === 'Payment Overdue'
      ? 'bg-destructive/10 text-destructive border-destructive/20'
      : accountStatus === 'Renewal Due'
      ? 'bg-warning/10 text-warning border-warning/20'
      : 'bg-success/10 text-success border-success/20';

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

  // ---- KPI tiles (Section D1) — computed across all of the company's invoices ----
  const invAmount = (i: Invoice) => i.totalAmount ?? i.amount;
  // Next Invoice: soonest upcoming / awaiting-payment invoice by due date.
  const nextInvoice = invoices
    .filter(i => i.status === 'awaiting_payment' || i.status === 'upcoming')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] || null;
  // Last Payment: most recent paid invoice by paid date.
  const lastPaid = invoices
    .filter(i => i.status === 'paid')
    .sort((a, b) => new Date(b.paidAt || b.date).getTime() - new Date(a.paidAt || a.date).getTime())[0] || null;
  // Outstanding: sum of unpaid (awaiting payment + overdue) invoices.
  const outstandingInvoices = invoices.filter(i => i.status === 'awaiting_payment' || i.status === 'overdue');
  const outstanding = outstandingInvoices.reduce((a, i) => a + invAmount(i), 0);
  // Products: unique product names across the company's active subscriptions.
  const activeProductNames = new Set(
    allSubscriptions.filter(s => s.status === 'active').flatMap(s => s.products.map(p => p.name)),
  );
  const productCount = activeProductNames.size;

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
              <h3 className="text-base font-semibold mb-2">No Subscriptions</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You don't have any active subscriptions yet. Get started by selecting products.
              </p>
              <Button onClick={() => navigate('/checkout')}>Get Started</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Subscription Selector — always shown when at least 1 Annual sub exists */}
            <div className="flex flex-wrap gap-2">
              {subscriptions.map((sub, idx) => (
                <Button
                  key={sub.id}
                  variant={selectedSubIndex === idx ? 'default' : 'outline'}
                  onClick={() => { setSelectedSubIndex(idx); setActiveTab('overview'); }}
                  className="h-auto py-1.5 pl-4 pr-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{sub.name}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); if (!readOnly) openRenameDialog(sub); }}
                      onKeyDown={(e) => {
                        if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          e.stopPropagation();
                          openRenameDialog(sub);
                        }
                      }}
                      className="ml-1 p-1 rounded hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-current inline-flex items-center justify-center"
                      aria-label={`Rename ${sub.name}`}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Button>
              ))}
            </div>

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

                    {/* OVERVIEW TAB — two-column layout */}
                    <TabsContent value="overview" className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* LEFT COLUMN */}
                        <div className="lg:col-span-8 space-y-6">
                          {/* Annual Plan summary card */}
                          <Card className="shadow-sm bg-gradient-to-br from-primary/5 via-card to-card border-primary/10">
                            <CardContent className="p-6">
                              <div className="flex items-start justify-between gap-4">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/subscriptions/${currentSub.id}`)}
                                  className="flex items-start gap-3 min-w-0 text-left group focus:outline-none"
                                >
                                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-semibold text-muted-foreground">
                                    {currentSub.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="text-base font-semibold truncate group-hover:underline">{currentSub.name}</h3>
                                    <p className="text-xs text-muted-foreground">
                                      Renews {new Date(currentSub.renewalDate).toLocaleDateString()} · Billed {currentSub.planType} · Last paid by {paymentMethod}
                                    </p>
                                  </div>
                                </button>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <Badge variant="outline" className={cn(summaryStatusClass)}>
                                    {summaryStatusLabel}
                                  </Badge>
                                  <Button size="sm" variant="outline" onClick={() => navigate(`/subscriptions/${currentSub.id}`)}>
                                    View details
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* KPI tiles */}
                          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                              <CardContent className="p-4 flex items-center justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm text-muted-foreground">Next Invoice</p>
                                  <p className="text-2xl font-bold mt-1 tracking-tight">
                                    {nextInvoice ? formatCurrency(invAmount(nextInvoice)) : '—'}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {nextInvoice ? `Due on ${new Date(nextInvoice.dueDate).toLocaleDateString()}` : 'None scheduled'}
                                  </p>
                                </div>
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Receipt className="h-5 w-5 text-primary" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-4 flex items-center justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm text-muted-foreground">Last Payment</p>
                                  <p className="text-2xl font-bold mt-1 tracking-tight">
                                    {lastPaid ? formatCurrency(invAmount(lastPaid)) : '—'}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {lastPaid ? `Paid on ${new Date(lastPaid.paidAt || lastPaid.date).toLocaleDateString()}` : 'No payments yet'}
                                  </p>
                                </div>
                                <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                                  <Check className="h-5 w-5 text-info" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-4 flex items-center justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm text-muted-foreground">Outstanding</p>
                                  <p className={cn('text-2xl font-bold mt-1 tracking-tight', outstanding > 0 ? 'text-destructive' : 'text-success')}>
                                    {formatCurrency(outstanding)}
                                  </p>
                                  <p className={cn('text-xs mt-1', outstanding > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                                    {outstanding > 0
                                      ? `${outstandingInvoices.length} unpaid invoice${outstandingInvoices.length > 1 ? 's' : ''}`
                                      : 'All caught up'}
                                  </p>
                                </div>
                                <div className={cn(
                                  'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                                  outstanding > 0 ? 'bg-destructive/10' : 'bg-success/10'
                                )}>
                                  <CheckCircle2 className={cn('h-5 w-5', outstanding > 0 ? 'text-destructive' : 'text-success')} />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-4 flex items-center justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm text-muted-foreground">Products</p>
                                  <p className="text-2xl font-bold mt-1 tracking-tight">{productCount}</p>
                                  <p className="text-xs text-muted-foreground mt-1">Active subscriptions</p>
                                </div>
                                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                                  <Package className="h-5 w-5 text-warning" />
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Products in this subscription */}
                          <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-4">
                              <CardTitle className="text-base font-semibold">Products in this subscription</CardTitle>
                              <span className="text-xs text-muted-foreground">{currentSub.products.length} total</span>
                            </CardHeader>
                            <CardContent className="p-6 pt-0">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {currentSub.products.map(prod => {
                                  const assigned = getAssignedLicenseCount(currentSub.id, prod.id);
                                  const avail = prod.licenseCount - assigned;
                                  // Distribution of license types for this product
                                  const productLicenses = licenses.filter(l => l.subscriptionId === currentSub.id && l.productId === prod.id);
                                  const typeCounts: Record<LicenseType, number> = { paid: 0, it_assistant: 0, trial: 0 };
                                  productLicenses.forEach(l => {
                                    const lt = (l.licenseType || 'paid') as LicenseType;
                                    typeCounts[lt]++;
                                  });
                                  const typeSummary = [
                                    typeCounts.paid > 0 ? `${typeCounts.paid} User` : null,
                                    typeCounts.trial > 0 ? `${typeCounts.trial} Trial` : null,
                                    typeCounts.it_assistant > 0 ? `${typeCounts.it_assistant} IT Assistant` : null,
                                  ].filter(Boolean).join(' · ');
                                  const isActive = prod.status === 'active';
                                  const dotClass = isActive
                                    ? 'bg-success'
                                    : prod.status === 'expired'
                                    ? 'bg-destructive'
                                    : 'bg-muted-foreground';
                                  const availClass = avail < 0 ? 'text-destructive' : avail === 0 ? 'text-muted-foreground' : '';
                                  const Icon = productIcon(prod.name);
                                  const isDataNet = prod.name === 'DataNet';
                                  return (
                                    <div key={prod.id} className="border rounded-md p-4 space-y-3">
                                      <div className="flex items-start gap-3">
                                        <div className="h-8 w-8 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                                          <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <h4 className="text-base font-semibold truncate">{prod.name}</h4>
                                          <div className="flex items-center text-xs mt-0.5">
                                            <span className={cn('inline-block h-2 w-2 rounded-full mr-1.5', dotClass)} />
                                            <span className="capitalize">{prod.status}</span>
                                          </div>
                                        </div>
                                      </div>
                                      {isDataNet ? (
                                        <div>
                                          <p className="text-xs uppercase text-muted-foreground tracking-wide">Access</p>
                                          <p className="text-sm font-semibold mt-0.5">All active users</p>
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <p className="text-xs uppercase text-muted-foreground tracking-wide">Seats</p>
                                            <p className="text-sm font-semibold mt-0.5">{assigned}/{prod.licenseCount}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs uppercase text-muted-foreground tracking-wide">Available</p>
                                            <p className={cn('text-sm font-semibold mt-0.5', availClass)}>
                                              {avail}
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                      {!isDataNet && typeSummary && (
                                        <div className="text-xs text-muted-foreground">
                                          {typeSummary}
                                        </div>
                                      )}
                                      {!isDataNet && (prod.pendingLicenseCount || 0) > 0 && (
                                        <div className="text-xs text-warning">
                                          {prod.pendingLicenseCount} additional seats pending payment.
                                        </div>
                                      )}
                                      {!isDataNet && prod.scheduledLicenseCount !== undefined && prod.scheduledEffectiveDate && (
                                        <div className="text-xs rounded-md bg-info/10 text-info border border-info/20 px-2.5 py-1.5 flex items-start gap-1.5">
                                          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                          <span>
                                            Effective {new Date(prod.scheduledEffectiveDate).toLocaleDateString()}: {prod.licenseCount} → {prod.scheduledLicenseCount} seats
                                            {(prod.scheduledUnassignedUserIds?.length || 0) > 0 && (
                                              <> — {prod.scheduledUnassignedUserIds!.length} users will be unassigned</>
                                            )}
                                          </span>
                                        </div>
                                      )}
                                      {isDataNet ? (
                                        <div className="rounded-md bg-muted/40 border border-dashed p-3">
                                          <p className="text-xs text-muted-foreground leading-relaxed">
                                            All active users in your company automatically receive DataNet updates.
                                            Manage individual delivery preferences from{' '}
                                            <button
                                              onClick={() => navigate('/users')}
                                              className="text-primary hover:underline focus:outline-none focus-visible:underline"
                                            >
                                              Users &amp; Contacts
                                            </button>.
                                          </p>
                                        </div>
                                      ) : (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span tabIndex={0} className="block">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => openManageDrawer(currentSub, prod)}
                                                disabled={readOnly}
                                              >
                                                Manage Licenses
                                              </Button>
                                            </span>
                                          </TooltipTrigger>
                                          {readOnly && <TooltipContent>{READ_ONLY_TOOLTIP}</TooltipContent>}
                                        </Tooltip>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="lg:col-span-4">
                          <div className="lg:sticky lg:top-20 space-y-6">
                            {/* Billing Details */}
                            <Card>
                              <CardHeader className="flex flex-row items-center justify-between pb-4">
                                <CardTitle className="text-base font-semibold">Billing Details</CardTitle>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => { setDraftBilling(billing); setEditBillingOpen(true); }}
                                  aria-label="Edit billing details"
                                  disabled={readOnly}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </CardHeader>
                              <CardContent className="p-6 pt-0">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company Name</p>
                                    <p className="text-sm mt-1">{billing.companyName}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</p>
                                    <p className="text-sm mt-1">{billing.address}, {billing.city}, {billing.stateZip}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Contact</p>
                                    <p className="text-sm mt-1">{billing.contactName}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</p>
                                    <p className="text-sm mt-1">{billing.phone}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tax ID</p>
                                    <p className="text-sm mt-1">{billing.taxId}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Email</p>
                                    <p className="text-sm mt-1 break-all">{billing.contactEmail}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Renewal Options */}
                            <Card id="renewal-options">
                              <CardHeader className="pb-4">
                                <CardTitle className="text-base font-semibold">Renewal Options</CardTitle>
                                <p className="text-xs text-muted-foreground mt-1">Select a payment method for your next renewal.</p>
                              </CardHeader>
                              <CardContent className="p-6 pt-0">
                                <div className="space-y-2">
                                  {paymentMethods.map(opt => {
                                    const selected = paymentMethod === opt;
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => {
                                          setPaymentMethod(opt);
                                          toast({ title: 'Renewal payment method updated', description: opt });
                                        }}
                                        className={cn(
                                          'w-full flex items-center justify-between p-3 rounded-md border text-sm text-left transition-colors',
                                          selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                                        )}
                                      >
                                        <span className="flex items-center gap-2.5">
                                          <span className="h-4 w-4 rounded-full border-2 border-input flex items-center justify-center shrink-0">
                                            {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
                                          </span>
                                          <span className="text-sm">{opt}</span>
                                        </span>
                                        {selected && (
                                          <Badge variant="outline" className="bg-primary text-primary-foreground border-primary text-xs">
                                            Current
                                          </Badge>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* INVOICES TAB — new column structure with inline CTAs, search, and per-column sort */}
                    <TabsContent value="invoices" className="p-6 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[240px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search invoices..."
                            value={invoiceSearch}
                            onChange={(e) => setInvoiceSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
                          <FileText className="h-4 w-4 mr-1" />All Invoices
                        </Button>
                      </div>
                      {subInvoices.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Receipt className="h-12 w-12 mx-auto mb-2 opacity-30" />
                          No invoices for this subscription.
                        </div>
                      ) : sortedSubInvoices.length === 0 ? (
                        <div className="text-center py-12 space-y-3">
                          <p className="text-sm text-muted-foreground">No invoices match your search.</p>
                          <Button variant="outline" size="sm" onClick={() => setInvoiceSearch('')}>Clear search</Button>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead><SortableHeader label="Invoice ID" sortKey="invoiceNumber" sort={invoiceSort} onSortChange={setInvoiceSort} /></TableHead>
                              <TableHead><SortableHeader label="Invoice Created" sortKey="date" sort={invoiceSort} onSortChange={setInvoiceSort} /></TableHead>
                              <TableHead><SortableHeader label="Due Date" sortKey="dueDate" sort={invoiceSort} onSortChange={setInvoiceSort} /></TableHead>
                              <TableHead className="text-right"><SortableHeader label="Total" sortKey="total" sort={invoiceSort} onSortChange={setInvoiceSort} align="right" /></TableHead>
                              <TableHead><SortableHeader label="Status" sortKey="status" sort={invoiceSort} onSortChange={setInvoiceSort} /></TableHead>
                              <TableHead className="w-[50px] text-right"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedSubInvoices.map(inv => {
                              const total = inv.totalAmount ?? inv.amount;
                              const isPayable = inv.status === 'awaiting_payment' || inv.status === 'overdue' || inv.status === 'upcoming' || inv.status === 'unpaid';
                              const dueShort = new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                              const createdShort = new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                              const handlePay = () => navigate('/pay', {
                                state: {
                                  source: 'invoice',
                                  invoiceId: inv.id,
                                  subtotal: inv.subtotal ?? total,
                                  tax: inv.tax ?? 0,
                                  totalAmount: total,
                                  returnTo: '/subscriptions?tab=invoices',
                                },
                              });
                              const handleRenew = () => {
                                if (!currentSub) return;
                                setRenewSubId(currentSub.id);
                                setRenewInvoiceId(inv.id);
                                setRenewOpen(true);
                              };
                              return (
                                <TableRow key={inv.id}>
                                  <TableCell>
                                    <div className="flex flex-col leading-tight">
                                      <span className="font-mono text-sm">{inv.invoiceNumber}</span>
                                      {inv.poNumber && <span className="text-xs text-muted-foreground">PO #{inv.poNumber}</span>}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">{createdShort}</TableCell>
                                  <TableCell className={cn('text-sm', inv.paidAt && 'text-muted-foreground')}>{dueShort}</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {inv.status === 'paid' ? (
                                        <div>
                                          <Badge variant="outline" className="bg-success/10 text-success border-success/30">Paid</Badge>
                                          {inv.paidAt && <div className="text-[11px] text-muted-foreground mt-1">Paid {new Date(inv.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                                        </div>
                                      ) : inv.status === 'awaiting_payment' ? (
                                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Awaiting Payment</Badge>
                                      ) : inv.status === 'payment_terms_applied' ? (
                                        <Badge variant="outline" className="bg-info/10 text-info border-info/30">{termsLabel}</Badge>
                                      ) : inv.status === 'overdue' ? (
                                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Overdue</Badge>
                                      ) : inv.status === 'upcoming' ? (
                                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/40">Upcoming</Badge>
                                      ) : (
                                        <Badge variant="outline" className={statusBadgeClass(inv.status)}>{formatStatus(inv.status)}</Badge>
                                      )}
                                      {(inv.status === 'awaiting_payment' || inv.status === 'unpaid') && (
                                        <Button size="sm" className="h-7 px-2" onClick={handlePay}>Pay Now</Button>
                                      )}
                                      {inv.status === 'overdue' && (
                                        <Button size="sm" variant="destructive" className="h-7 px-2" onClick={handlePay}>Pay Now</Button>
                                      )}
                                      {inv.status === 'upcoming' && inv.source === 'renewal' && (
                                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={handleRenew}><RefreshCw className="h-3.5 w-3.5 mr-1" />Renew</Button>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => navigate('/invoices')}>
                                          <Eye className="h-4 w-4 mr-2" />View Invoice
                                        </DropdownMenuItem>
                                        {isPayable && (
                                          <DropdownMenuItem onClick={handlePay}>
                                            <CreditCard className="h-4 w-4 mr-2" />Pay
                                          </DropdownMenuItem>
                                        )}
                                        {inv.source === 'renewal' && currentSub && (
                                          <DropdownMenuItem onClick={handleRenew}>
                                            <RefreshCw className="h-4 w-4 mr-2" />Renew
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={() => toast({ title: 'PDF download coming soon', description: inv.invoiceNumber })}>
                                          <Download className="h-4 w-4 mr-2" />Download PDF
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
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

                      {quotes.length > 0 && (
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search quotes..."
                            value={quoteSearch}
                            onChange={(e) => setQuoteSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      )}
                      {quotes.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No quotes available.</div>
                      ) : sortedQuotes.length === 0 ? (
                        <div className="text-center py-12 space-y-3">
                          <p className="text-sm text-muted-foreground">No quotes match your search.</p>
                          <Button variant="outline" size="sm" onClick={() => setQuoteSearch('')}>Clear search</Button>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead><SortableHeader label="Quote ID" sortKey="quoteNumber" sort={quoteSort} onSortChange={setQuoteSort} /></TableHead>
                              <TableHead><SortableHeader label="Products" sortKey="products" sort={quoteSort} onSortChange={setQuoteSort} /></TableHead>
                              <TableHead><SortableHeader label="Created Date" sortKey="createdDate" sort={quoteSort} onSortChange={setQuoteSort} /></TableHead>
                              <TableHead><SortableHeader label="Expiry Date" sortKey="expiryDate" sort={quoteSort} onSortChange={setQuoteSort} /></TableHead>
                              <TableHead className="text-right"><SortableHeader label="Total" sortKey="total" sort={quoteSort} onSortChange={setQuoteSort} align="right" /></TableHead>
                              <TableHead><SortableHeader label="Status" sortKey="status" sort={quoteSort} onSortChange={setQuoteSort} /></TableHead>
                              <TableHead className="w-[50px] text-right"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedQuotes.map(q => {
                              const productNames = q.lineItems.map(l => l.productName);
                              const productsLabel = productNames.length > 2
                                ? `${productNames.slice(0, 2).join(', ')} +${productNames.length - 2}`
                                : productNames.join(', ');
                              const statusClass =
                                q.status === 'requested' ? 'bg-warning/10 text-warning border-warning/30' :
                                q.status === 'active' ? 'bg-info/10 text-info border-info/30' :
                                q.status === 'accepted' ? 'bg-success/10 text-success border-success/30' :
                                q.status === 'declined' ? 'text-muted-foreground border-muted-foreground/40' :
                                'bg-warning/10 text-warning border-warning/30';
                              const statusLabel = q.status === 'requested' ? 'Requested' : q.status;
                              const expiresIn = daysUntil(q.expiryDate);
                              const isExpiringSoon = q.status === 'active' && expiresIn >= 0 && expiresIn <= 3;
                              const expiryShort = new Date(q.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                              const createdShort = new Date(q.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                              return (
                                <TableRow key={q.id}>
                                  <TableCell className="font-mono text-sm">{q.quoteNumber}</TableCell>
                                  <TableCell className="text-sm">{productsLabel}</TableCell>
                                  <TableCell className="text-sm">{createdShort}</TableCell>
                                  <TableCell>
                                    <span className={cn('text-sm inline-flex items-center gap-1', isExpiringSoon && 'text-warning font-medium')}>
                                      {isExpiringSoon && <Clock className="h-3.5 w-3.5" />}
                                      {expiryShort}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(q.amount)}</TableCell>
                                  <TableCell>
                                    {q.status === 'requested' ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span tabIndex={0}>
                                            <Badge variant="outline" className={statusClass}>{statusLabel}</Badge>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>{REQUESTED_TOOLTIP}</TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <Badge variant="outline" className={statusClass}>{statusLabel}</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setNoteQuote(q)}>
                                          <Eye className="h-4 w-4 mr-2" />View Quote
                                        </DropdownMenuItem>
                                        {q.note && (
                                          <DropdownMenuItem onClick={() => setNoteQuote(q)}>
                                            <Eye className="h-4 w-4 mr-2" />View Note
                                          </DropdownMenuItem>
                                        )}
                                        {q.status === 'declined' && q.declineReason && (
                                          <DropdownMenuItem onClick={() => setViewDeclineQuote(q)}>
                                            <MessageSquare className="h-4 w-4 mr-2" />View Decline Reason
                                          </DropdownMenuItem>
                                        )}
                                        {q.status === 'active' && (
                                          <DropdownMenuItem onClick={() => setAcceptQuote(q)} disabled={readOnly}>
                                            <Check className="h-4 w-4 mr-2" />Accept Quote
                                          </DropdownMenuItem>
                                        )}
                                        {q.status === 'declined' && (
                                          <DropdownMenuItem onClick={() => navigate('/checkout', { state: { fromQuote: q.id, lineItems: q.lineItems } })} disabled={readOnly}>
                                            <RefreshCw className="h-4 w-4 mr-2" />Regenerate
                                          </DropdownMenuItem>
                                        )}
                                        {q.status !== 'requested' && (
                                          <DropdownMenuItem onClick={() => toast({ title: 'PDF download coming soon', description: q.quoteNumber })}>
                                            <Download className="h-4 w-4 mr-2" />Download PDF
                                          </DropdownMenuItem>
                                        )}
                                        {q.status === 'active' && (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeclineQuote(q)} disabled={readOnly}>
                                              <X className="h-4 w-4 mr-2" />Decline Quote
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                        {q.status === 'requested' && (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              className="text-destructive focus:text-destructive"
                                              onClick={() => {
                                                cancelQuoteRequest(q.id);
                                                toast({ title: 'Quote request cancelled.', description: q.quoteNumber });
                                              }}
                                              disabled={readOnly}
                                            >
                                              <Trash2 className="h-4 w-4 mr-2" />Cancel Request
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
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

      {/* Rename Subscription Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Subscription</DialogTitle>
            <DialogDescription>
              Give this subscription a name that's meaningful to your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Subscription name</Label>
            <Input
              id="sub-name"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (renameSubId && renameDraft.trim()) {
                  renameSubscription(renameSubId, renameDraft.trim());
                  toast({ title: 'Subscription renamed' });
                  setRenameOpen(false);
                }
              }}
              disabled={!renameDraft.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <ManageLicensesDrawer
        open={manageOpen}
        onOpenChange={setManageOpen}
        subscription={manageSub}
        product={manageProd}
      />
      <AcceptQuoteDrawer open={!!acceptQuote} onOpenChange={(v) => !v && setAcceptQuote(null)} quote={acceptQuote} />
      <RenewalFlyout
        open={renewOpen}
        onOpenChange={setRenewOpen}
        subscriptionId={renewSubId}
        invoiceId={renewInvoiceId}
      />
      <DeclineQuoteDialog open={!!declineQuote} onOpenChange={(v) => !v && setDeclineQuote(null)} quote={declineQuote} />
      <ViewNoteDialog open={!!noteQuote} onOpenChange={(v) => !v && setNoteQuote(null)} quote={noteQuote} />
      <ViewDeclineReasonDialog open={!!viewDeclineQuote} onOpenChange={(v) => !v && setViewDeclineQuote(null)} quote={viewDeclineQuote} />
      <RequestQuoteDialog open={requestQuoteOpen} onOpenChange={setRequestQuoteOpen} />
    </MainLayout>
  );
};
