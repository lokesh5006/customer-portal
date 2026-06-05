import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useApp, Subscription, SubscriptionProduct, Invoice, Quote, PRODUCT_CATALOG, User,
} from '@/contexts/AppContext';
import {
  ManageLicensesDrawer, AcceptQuoteDrawer, DeclineQuoteDialog, ViewNoteDialog, ViewDeclineReasonDialog,
} from '@/components/subscriptions/QuoteDialogs';
import { AddProductDrawer } from '@/components/subscriptions/AddProductDrawer';
import { EditBillingDetailsDialog } from '@/components/subscriptions/EditBillingDetailsDialog';
import { RenewalFlyout } from '@/components/billing/RenewalFlyout';
import { useReadOnlyGuard } from '@/hooks/useReadOnlyGuard';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import {
  Pencil, Settings, Eye, CreditCard, RefreshCw, MoreVertical, Check, X, MessageSquare, Building2, AlertTriangle,
  Plus, ChevronDown, ChevronRight, Clock, RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
};
const invTotal = (i: Invoice) => i.totalAmount ?? i.amount;

const subStatusBadge = (status: Subscription['status']) => {
  switch (status) {
    case 'active': return { label: 'Active', cls: 'bg-success/10 text-success border-success/30' };
    case 'pending_payment': return { label: 'Pending Payment', cls: 'bg-warning/10 text-warning border-warning/30' };
    case 'suspended': return { label: 'Suspended', cls: 'bg-destructive/10 text-destructive border-destructive/30' };
    default: return { label: status, cls: 'text-muted-foreground border-muted-foreground/40' };
  }
};

const RENEWAL_OPTION_LABELS = ['Direct ACH', 'Credit Card', 'ACH e-Check', 'Paper Check', 'Invoice Only (Net 30)'];

export const SubscriptionDetailPage = () => {
  const navigate = useNavigate();
  const { subscriptionId } = useParams();
  const {
    getCompanySubscriptions, getCompanyInvoices, getCompanyQuotes, getCompanyUsers,
    getAssignedLicenseCount, getCompanyPaymentMethods, getCompanyConfig, currentCompany, can,
    licenses, users, markLicensesExpiringAtRenewal, updateRenewalSeatCount,
  } = useApp();
  const { toast } = useToast();

  const subscriptions = getCompanySubscriptions();
  const activeSubs = subscriptions.filter(s => s.status !== 'cancelled' && s.status !== 'expired');
  const subscription = subscriptions.find(s => s.id === subscriptionId) || null;

  // Manage Licenses drawer
  const [manageSub, setManageSub] = useState<Subscription | null>(null);
  const [manageProd, setManageProd] = useState<SubscriptionProduct | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [editBillingOpen, setEditBillingOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // v21 Section C — tab pre-selection via ?tab= query param (overview | invoices | quotes).
  const [searchParams, setSearchParams] = useSearchParams();
  const TAB_VALUES = ['overview', 'invoices', 'quotes'];
  const paramTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(paramTab && TAB_VALUES.includes(paramTab) ? paramTab : 'overview');
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TAB_VALUES.includes(t)) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const handleTabChange = (v: string) => {
    setActiveTab(v);
    setSearchParams({ tab: v }, { replace: true });
  };

  useEffect(() => {
    if (!subscription) navigate('/subscriptions', { replace: true });
  }, [subscription, navigate]);

  if (!subscription) return null;

  const badge = subStatusBadge(subscription.status);
  const canEditBilling = can('edit_billing_details');
  const canManageSeats = can('manage_seats_count');

  // Section E9 — products from the catalog not yet on this subscription (DataNet excluded).
  const availableToAdd = PRODUCT_CATALOG.filter(
    c => c.name !== 'DataNet' && !subscription.products.some(p => p.name === c.name));
  const renewalDateLong = new Date(subscription.renewalDate)
    .toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  // Section C — users marked expiring at renewal on this subscription's licenses.
  const expiringLicenses = licenses.filter(
    l => l.subscriptionId === subscription.id && l.expiringAtRenewal && !!l.userId && !l.deactivatedAt);
  const expiringForProduct = (productId: string) =>
    expiringLicenses
      .filter(l => l.productId === productId)
      .map(l => users.find(u => u.id === l.userId))
      .filter((u): u is NonNullable<typeof u> => !!u);
  const expiringUsersAll = expiringLicenses
    .map(l => ({
      user: users.find(u => u.id === l.userId),
      product: subscription.products.find(p => p.id === l.productId),
    }))
    .filter((x): x is { user: NonNullable<typeof x.user>; product: NonNullable<typeof x.product> } => !!x.user && !!x.product);

  const openManage = (prod: SubscriptionProduct) => {
    setManageSub(subscription);
    setManageProd(prod);
    setManageOpen(true);
  };

  // v22 Section B — route the pending-payment invoice link straight to checkout.
  const handlePayPendingInvoice = (inv: Invoice) => {
    navigate('/pay', {
      state: {
        source: 'invoice', invoiceId: inv.id,
        subtotal: inv.subtotal ?? invTotal(inv), tax: inv.tax ?? 0, totalAmount: invTotal(inv),
        returnTo: `/subscriptions/${subscription.id}`,
      },
    });
  };

  // v22 Section D — mark a single expiring user's seat as renewing from this page:
  // clear the expiring flag AND bump the product's renewal seat count by 1 (same
  // behavior as the drawer's Mark as renewing).
  const canRenewalStatus = can('manage_seat_renewal_status');
  const handleMarkRenewing = (user: User, product: SubscriptionProduct) => {
    markLicensesExpiringAtRenewal(subscription.id, product.id, [user.id], false);
    const current = product.renewalSeatCount ?? product.licenseCount;
    updateRenewalSeatCount(subscription.id, product.id, current + 1);
    toast({
      title: `${user.firstName} ${user.lastName} will renew.`,
      description: 'Their seat is kept at the next renewal.',
    });
  };

  // Payment description from the company's primary saved method.
  const methods = getCompanyPaymentMethods();
  const primaryMethod = methods.find(m => m.isPrimary) || methods[0];
  const lastPaidDesc = primaryMethod
    ? (primaryMethod.type === 'card'
        ? `${primaryMethod.cardBrand} ending in ${primaryMethod.cardLast4}`
        : `ACH from ${primaryMethod.bankName} •••• ${primaryMethod.accountLast4}`)
    : 'No saved payment method on file';

  const config = getCompanyConfig();
  const hasCard = methods.some(m => m.type === 'card');
  const hasAch = methods.some(m => m.type === 'ach');
  const renewalConfigured: Record<string, boolean> = {
    'Direct ACH': hasAch,
    'Credit Card': hasCard,
    'ACH e-Check': hasAch,
    'Paper Check': false,
    'Invoice Only (Net 30)': !!config.payOnTermsEnabled,
  };

  // Billing Details
  const allUsers = getCompanyUsers();
  const contacts = (currentCompany?.billingContactUserIds || [])
    .map(id => allUsers.find(u => u.id === id))
    .filter(Boolean) as ReturnType<typeof getCompanyUsers>;
  const addr = currentCompany?.address;
  const addressLines = addr
    ? [addr.line1, addr.line2, [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '), addr.country].filter(Boolean)
    : [];

  return (
    <MainLayout>
      <PageHeader
        title={subscription.name}
        description={`${badge.label} · Renews ${fmtDate(subscription.renewalDate)}`}
        actions={canManageSeats ? (
          availableToAdd.length === 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button disabled>
                    <Plus className="h-4 w-4 mr-2" />Add Product
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Your subscription includes all available products.</TooltipContent>
            </Tooltip>
          ) : (
            <Button onClick={() => setAddProductOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Add Product
            </Button>
          )
        ) : undefined}
      />

      {/* Subscription selector — only when the company has >1 active subscription */}
      {activeSubs.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          {activeSubs.map(s => (
            <Button
              key={s.id}
              size="sm"
              variant={s.id === subscription.id ? 'default' : 'outline'}
              onClick={() => navigate(`/subscriptions/${s.id}`)}
            >
              {s.name}
            </Button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Badge variant="outline" className={cn(badge.cls)}>{badge.label}</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
        </TabsList>

        {/* ---------- OVERVIEW ---------- */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left column ~60% */}
            <div className="lg:col-span-3 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Subscription &amp; Licenses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {subscription.products.map(prod => {
                    const assigned = getAssignedLicenseCount(subscription.id, prod.id);
                    const available = Math.max(0, prod.licenseCount - assigned);
                    const renewalSeats = prod.renewalSeatCount ?? prod.licenseCount;
                    const renewalChangePending = renewalSeats !== prod.licenseCount;
                    const isPending = prod.status === 'pending_payment';
                    // DataNet is auto-included for all active users — no seat math,
                    // no Manage Licenses (delivery prefs live in Users & Contacts).
                    const isDataNet = prod.name === 'DataNet';
                    const expiringUsers = expiringForProduct(prod.id);
                    const isExpanded = expandedProductId === prod.id;
                    // v22 Section B — mid-cycle "Add seats now" seats awaiting payment on an
                    // ACTIVE product (a fully-pending NEW product keeps the v20 G3 cue below).
                    const pendingSeatLics = isPending ? [] : licenses.filter(l =>
                      l.subscriptionId === subscription.id && l.productId === prod.id &&
                      l.status === 'pending_payment' && !l.deactivatedAt);
                    const pendingPaymentSeats = pendingSeatLics.length;
                    const pendingSeatInvoice = pendingPaymentSeats > 0
                      ? getCompanyInvoices().find(i => i.id === pendingSeatLics[0]?.pendingPaymentInvoiceId)
                      : undefined;
                    // v20 Section G3 — invoice backing a pending product (for the cue + link).
                    let pendingInvNumber = '';
                    if (isPending) {
                      const lic = licenses.find(l =>
                        l.subscriptionId === subscription.id && l.productId === prod.id && l.pendingPaymentInvoiceId);
                      pendingInvNumber = getCompanyInvoices().find(i => i.id === lic?.pendingPaymentInvoiceId)?.invoiceNumber ?? '';
                    }
                    return (
                      <div key={prod.id} className={cn('border rounded-md p-3', isPending && 'opacity-70 bg-muted/30')}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate flex items-center gap-2">
                              {prod.name}
                              {isPending && (
                                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                                  Pending payment
                                </Badge>
                              )}
                            </div>
                            {isDataNet ? (
                              <div className="text-xs text-muted-foreground">
                                Included free · all active users
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {prod.licenseCount} paid licenses · {available}/{prod.licenseCount} seats available
                              </div>
                            )}
                            {isDataNet && (
                              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                All active users in your company automatically receive DataNet updates.
                                Manage individual delivery preferences from{' '}
                                <button
                                  type="button"
                                  onClick={() => navigate('/users')}
                                  className="text-primary hover:underline focus:outline-none focus-visible:underline"
                                >
                                  Users &amp; Contacts
                                </button>.
                              </p>
                            )}
                            {/* v22 Section B — inline pending-payment indicator for added-now seats */}
                            {pendingPaymentSeats > 0 && (
                              <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>
                                  Pending payment: +{pendingPaymentSeats} seat{pendingPaymentSeats === 1 ? '' : 's'}
                                  {pendingSeatInvoice && (
                                    <>
                                      {' '}(
                                      <button
                                        type="button"
                                        className="underline hover:no-underline"
                                        onClick={() => handlePayPendingInvoice(pendingSeatInvoice)}
                                      >
                                        {pendingSeatInvoice.invoiceNumber}
                                      </button>
                                      )
                                    </>
                                  )}
                                </span>
                              </div>
                            )}
                            {/* Section G3 — awaiting-payment cue for a pending product */}
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => navigate('/invoices')}
                                className="mt-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                              >
                                Awaiting payment of invoice {pendingInvNumber}
                              </button>
                            )}
                            {/* Section C1 — expandable renewal-change indicator */}
                            {renewalChangePending && (
                              <div className="mt-1">
                                <button
                                  type="button"
                                  onClick={() => setExpandedProductId(isExpanded ? null : prod.id)}
                                  className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  <span>Renewal change pending: {prod.licenseCount} → {renewalSeats} at {renewalDateLong}</span>
                                  {expiringUsers.length > 0 && (isExpanded
                                    ? <ChevronDown className="h-3.5 w-3.5" />
                                    : <ChevronRight className="h-3.5 w-3.5" />)}
                                </button>
                                {isExpanded && expiringUsers.length > 0 && (
                                  <div className="mt-2 ml-1 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs space-y-1.5">
                                    <div className="font-medium text-amber-700 dark:text-amber-300">Users expiring at renewal:</div>
                                    <ul className="space-y-0.5">
                                      {expiringUsers.map(u => (
                                        <li key={u.id} className="text-amber-700/90 dark:text-amber-300/90">
                                          • {u.firstName} {u.lastName} ({u.email})
                                        </li>
                                      ))}
                                    </ul>
                                    <div className="text-amber-700/80 dark:text-amber-300/80 pt-1">
                                      At renewal these users will lose access unless the seats are marked as renewing.
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {isDataNet ? null : isPending ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0} className="shrink-0">
                                  <Button size="sm" variant="outline" disabled>
                                    <Settings className="h-3.5 w-3.5 mr-1" />Manage Licenses
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Activate this product by paying the invoice first.</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => openManage(prod)}>
                              <Settings className="h-3.5 w-3.5 mr-1" />Manage Licenses
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Section C2 — Users expiring at renewal */}
              {expiringUsersAll.length > 0 && (
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      Users expiring at renewal
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {expiringUsersAll.length} user{expiringUsersAll.length === 1 ? '' : 's'}
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {expiringUsersAll.map(({ user, product }) => (
                      <div key={`${user.id}-${product.id}`} className="flex items-start justify-between gap-3 border rounded-md p-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                            {(`${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{user.firstName} {user.lastName}</div>
                            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                            <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                              {product.name} · expires {renewalDateLong}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {canRenewalStatus && (
                            <Button size="sm" variant="outline" onClick={() => handleMarkRenewing(user, product)}>
                              <RotateCw className="h-3.5 w-3.5 mr-1" />Mark as renewing
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openManage(product)}>
                            <Settings className="h-3.5 w-3.5 mr-1" />Manage
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Payment</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">
                    You last paid by <span className="font-medium">{lastPaidDesc}</span>.
                  </p>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Renewal options</p>
                    <ul className="space-y-1.5">
                      {RENEWAL_OPTION_LABELS.map(label => (
                        <li key={label} className="flex items-center gap-2 text-sm">
                          <span className={cn(
                            'h-4 w-4 rounded-full border flex items-center justify-center',
                            renewalConfigured[label] ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40',
                          )}>
                            {renewalConfigured[label] && <Check className="h-3 w-3" />}
                          </span>
                          <span className={renewalConfigured[label] ? '' : 'text-muted-foreground'}>{label}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Informational — your payment method is selected at checkout / payment time.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column ~40% — Billing Details */}
            <div className="lg:col-span-2">
              <Card className="group">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Billing Details</CardTitle>
                  {canEditBilling && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setEditBillingOpen(true)} aria-label="Edit billing details"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Company Name</p>
                    <p className="font-medium">{currentCompany?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    {addressLines.length > 0
                      ? addressLines.map((l, i) => <p key={i}>{l}</p>)
                      : <p className="text-muted-foreground">Not set</p>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Company Contact(s)</p>
                    <p>{contacts.length > 0 ? contacts.map(c => `${c.firstName} ${c.lastName}`).join(', ') : 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email Addresses</p>
                    <p className="break-words">{contacts.length > 0 ? contacts.map(c => c.email).join(', ') : 'Not set'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ---------- INVOICES (scoped to this subscription) ---------- */}
        <TabsContent value="invoices" className="mt-4">
          <SubscriptionInvoicesTab subscriptionId={subscription.id} />
        </TabsContent>

        {/* ---------- QUOTES (scoped to this subscription's company) ---------- */}
        <TabsContent value="quotes" className="mt-4">
          <SubscriptionQuotesTab />
        </TabsContent>
      </Tabs>

      <ManageLicensesDrawer open={manageOpen} onOpenChange={setManageOpen} subscription={manageSub} product={manageProd} />
      <AddProductDrawer open={addProductOpen} onOpenChange={setAddProductOpen} subscription={subscription} />
      <EditBillingDetailsDialog open={editBillingOpen} onOpenChange={setEditBillingOpen} company={currentCompany} />
    </MainLayout>
  );
};

/* ============================================================
 * Invoices tab — same actions as the sidebar page, filtered to this subscription.
 * ========================================================== */
const SubscriptionInvoicesTab = ({ subscriptionId }: { subscriptionId: string }) => {
  const navigate = useNavigate();
  const { getCompanyInvoices, getCompanyConfig } = useApp();
  const { toast } = useToast();
  const invoices = getCompanyInvoices().filter(i => i.subscriptionId === subscriptionId);
  const termsLabel = getCompanyConfig().terms || 'Net 30';

  const [detail, setDetail] = useState<Invoice | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewInvId, setRenewInvId] = useState<string | undefined>(undefined);

  const statusPill = (inv: Invoice) => {
    const map: Record<string, string> = {
      paid: 'bg-success/10 text-success border-success/30',
      awaiting_payment: 'bg-warning/10 text-warning border-warning/30',
      payment_terms_applied: 'bg-info/10 text-info border-info/30',
      overdue: 'bg-destructive/10 text-destructive border-destructive/30',
      upcoming: 'text-muted-foreground border-muted-foreground/40',
      unpaid: 'bg-warning/10 text-warning border-warning/30',
    };
    const label = inv.status === 'payment_terms_applied' ? termsLabel : inv.status.replace(/_/g, ' ');
    return <Badge variant="outline" className={cn('capitalize', map[inv.status] || '')}>{label}</Badge>;
  };

  const isPayable = (inv: Invoice) =>
    inv.status === 'awaiting_payment' || inv.status === 'overdue' || inv.status === 'unpaid';

  const handlePay = (inv: Invoice) => {
    navigate('/pay', {
      state: {
        source: 'invoice', invoiceId: inv.id,
        subtotal: inv.subtotal ?? invTotal(inv), tax: inv.tax ?? 0, totalAmount: invTotal(inv),
        returnTo: `/subscriptions/${subscriptionId}`,
      },
    });
  };

  if (invoices.length === 0) {
    return <Card className="p-10 text-center text-sm text-muted-foreground">No invoices for this subscription yet.</Card>;
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice ID</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map(inv => (
            <TableRow key={inv.id}>
              <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
              <TableCell className="text-sm">{fmtDate(inv.date)}</TableCell>
              <TableCell className="text-sm">{fmtDate(inv.dueDate)}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(invTotal(inv))}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {statusPill(inv)}
                  {isPayable(inv) && <Button size="sm" className="h-7 px-2" onClick={() => handlePay(inv)}>Pay Now</Button>}
                  {inv.status === 'upcoming' && inv.source === 'renewal' && (
                    <Button size="sm" variant="outline" className="h-7 px-2"
                      onClick={() => { setRenewInvId(inv.id); setRenewOpen(true); }}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />Renew
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDetail(inv)}><Eye className="h-4 w-4 mr-2" />View Invoice</DropdownMenuItem>
                    {isPayable(inv) && <DropdownMenuItem onClick={() => handlePay(inv)}><CreditCard className="h-4 w-4 mr-2" />Pay</DropdownMenuItem>}
                    <DropdownMenuItem onClick={() => toast({ title: 'PDF download coming soon', description: inv.invoiceNumber })}>
                      Download PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Invoice {detail?.invoiceNumber}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.lineItems.map((li, i) => (
                    <TableRow key={i}>
                      <TableCell>{li.product}</TableCell>
                      <TableCell className="text-center">{li.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(li.unitPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(li.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Total</span><span>{formatCurrency(invTotal(detail))}</span>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setDetail(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <RenewalFlyout open={renewOpen} onOpenChange={setRenewOpen} subscriptionId={subscriptionId} invoiceId={renewInvId} />
    </Card>
  );
};

/* ============================================================
 * Quotes tab — company quotes (no Plan column per #1531).
 * Quotes are company-scoped; with one subscription per company this equals
 * the subscription's quotes.
 * ========================================================== */
const SubscriptionQuotesTab = () => {
  const { getCompanyQuotes, hasAccess } = useApp();
  const { toast } = useToast();
  const { readOnly } = useReadOnlyGuard();
  const quotes = getCompanyQuotes();
  const canAccept = hasAccess(['account_owner', 'billing_admin']) && !readOnly;

  const [accept, setAccept] = useState<Quote | null>(null);
  const [decline, setDecline] = useState<Quote | null>(null);
  const [note, setNote] = useState<Quote | null>(null);
  const [declineReason, setDeclineReason] = useState<Quote | null>(null);

  const statusColor = (s: Quote['status']) => {
    switch (s) {
      case 'requested': return 'bg-warning/10 text-warning border-warning/30';
      case 'active': return 'bg-info/10 text-info border-info/30';
      case 'accepted': return 'bg-success/10 text-success border-success/30';
      case 'declined': return 'text-muted-foreground border-muted-foreground/40';
      case 'expired': return 'bg-warning/10 text-warning border-warning/30';
    }
  };

  if (quotes.length === 0) {
    return <Card className="p-10 text-center text-sm text-muted-foreground">No quotes for this subscription yet.</Card>;
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quote ID</TableHead>
            <TableHead>Products</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Expiry</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map(q => {
            const names = q.lineItems.map(l => l.productName);
            const label = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
            return (
              <TableRow key={q.id}>
                <TableCell className="font-mono text-sm">{q.quoteNumber}</TableCell>
                <TableCell className="text-sm">{label}</TableCell>
                <TableCell className="text-sm">{fmtDate(q.createdDate)}</TableCell>
                <TableCell className="text-sm">{fmtDate(q.expiryDate)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(q.amount)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('capitalize', statusColor(q.status))}>{q.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setNote(q)}><Eye className="h-4 w-4 mr-2" />View Quote</DropdownMenuItem>
                      {q.status === 'declined' && q.declineReason && (
                        <DropdownMenuItem onClick={() => setDeclineReason(q)}><MessageSquare className="h-4 w-4 mr-2" />View Decline Reason</DropdownMenuItem>
                      )}
                      {q.status === 'active' && canAccept && (
                        <>
                          <DropdownMenuItem onClick={() => setAccept(q)}><Check className="h-4 w-4 mr-2" />Accept Quote</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDecline(q)}>
                            <X className="h-4 w-4 mr-2" />Decline Quote
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

      <AcceptQuoteDrawer open={!!accept} onOpenChange={(v) => !v && setAccept(null)} quote={accept} />
      <DeclineQuoteDialog open={!!decline} onOpenChange={(v) => !v && setDecline(null)} quote={decline} />
      <ViewNoteDialog open={!!note} onOpenChange={(v) => !v && setNote(null)} quote={note} />
      <ViewDeclineReasonDialog open={!!declineReason} onOpenChange={(v) => !v && setDeclineReason(null)} quote={declineReason} />
    </Card>
  );
};

export default SubscriptionDetailPage;
