import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useApp, Subscription, SubscriptionProduct, Quote, PaymentMethod, QuoteRequestReason,
  PRODUCT_CATALOG, License, SavedPaymentMethod, User, Invoice,
  ROLE_LABELS, ROLE_BADGE_CLASS,
} from '@/contexts/AppContext';
import { calculateProratedAdd } from '@/lib/proration';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';
import { Plus, Minus, Info, ArrowLeft, AlertCircle, CreditCard, Landmark, UserPlus, UserMinus, Search, ArrowUp, ArrowDown, MoreVertical, RotateCw } from 'lucide-react';

/* ============================================================
 * Payment Method Picker (radio cards)
 * ========================================================== */
const PaymentMethodPicker = ({
  value, onChange, available, terms,
}: {
  value: PaymentMethod | '';
  onChange: (v: PaymentMethod) => void;
  available: PaymentMethod[];
  terms?: string;
}) => {
  const cardsForAvailable: { id: PaymentMethod; title: string; desc: string }[] = [
    { id: 'pay_immediately', title: 'Pay Immediately', desc: 'Pay now and activate your subscription after successful payment.' },
    { id: 'pay_on_receipt', title: 'Pay on Receipt', desc: 'An invoice will be generated. Subscription will be activated after payment is received.' },
    { id: 'pay_on_terms', title: 'Pay on Terms', desc: terms ? `Invoice will be generated under approved payment terms (${terms}).` : 'Invoice will be generated under approved payment terms.' },
  ];
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as PaymentMethod)} className="space-y-2">
      {cardsForAvailable
        .filter(c => available.includes(c.id))
        .map(c => (
          <label key={c.id} className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 ${value === c.id ? 'border-primary bg-primary/5' : ''}`}>
            <RadioGroupItem value={c.id} className="mt-0.5" />
            <div>
              <div className="text-sm font-medium">{c.title}</div>
              <div className="text-xs text-muted-foreground">{c.desc}</div>
            </div>
          </label>
        ))}
    </RadioGroup>
  );
};

/* ============================================================
 * Manage Licenses Drawer (v18 rebuild)
 *
 * Conceptual model (locked):
 *   • Current seats      — paid & active this cycle. READ-ONLY. Increases only via
 *                          "Add seats now" (Pay on Receipt — seats are pending until
 *                          the invoice is paid). Never decreases mid-cycle (no refund).
 *   • Pending payment    — seats added mid-cycle whose invoice is not yet paid. They
 *                          count toward the renewal but are not assignable until paid.
 *   • New seats          — the seat count committed for the NEXT renewal. Editable in
 *                          both directions via the stepper; Apply commits immediately
 *                          to product.renewalSeatCount (no separate Save step).
 *   • Currently assigned — live count of active assignments.
 *
 * All actions (assign / unassign / mark-renewing / Apply) commit to AppContext
 * immediately. Because callers pass a snapshot product/subscription, the drawer
 * re-derives the LIVE product/subscription from context by id so every render
 * reflects current state (fixes the v17 prefill + state-inconsistency bugs).
 * ========================================================== */
const userInitials = (u: { firstName?: string; lastName?: string; email: string }) =>
  (`${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || u.email[0]?.toUpperCase() || '?');

type AssignedRecord = { license: License; user: User };

const byUserName = (a: { user: User }, b: { user: User }) =>
  `${a.user.firstName} ${a.user.lastName}`.localeCompare(`${b.user.firstName} ${b.user.lastName}`);

export const ManageLicensesDrawer = ({
  open, onOpenChange, subscription, product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subscription: Subscription | null;
  product: SubscriptionProduct | null;
}) => {
  const navigate = useNavigate();
  const {
    getCatalogProduct,
    useLegacyProration,
    assignLicense,
    unassignLicense,
    markLicensesExpiringAtRenewal,
    updateRenewalSeatCount,
    addSeatsPendingPayment,
    assignUserToPendingSeat,
    unassignUserFromPendingSeat,
    finalizePendingInvoice,
    discardPendingInvoice,
    getAvailablePaymentMethods,
    subscriptions,
    licenses,
    invoices,
    users,
    can,
  } = useApp();
  const { toast } = useToast();

  const canManageSeats = can('manage_seats_count');
  const canAssign = can('manage_user_assignment');
  const canRenewalStatus = can('manage_seat_renewal_status');

  // Re-derive LIVE product/subscription from context (props are a stale snapshot).
  const liveSub = useMemo(
    () => (subscription ? subscriptions.find(s => s.id === subscription.id) ?? subscription : null),
    [subscriptions, subscription],
  );
  const liveProduct = useMemo(
    () => (liveSub && product ? liveSub.products.find(p => p.id === product.id) ?? product : null),
    [liveSub, product],
  );

  // Live licenses for this product (excludes deactivated "previously held" rows).
  const productLicenses = useMemo(() => {
    if (!liveSub || !liveProduct) return [] as License[];
    return licenses.filter(l =>
      l.subscriptionId === liveSub.id && l.productId === liveProduct.id && !l.deactivatedAt);
  }, [licenses, liveSub, liveProduct]);

  // v20 — pending state is INVISIBLE. Every user with a license (active OR pre-assigned
  // pending) renders uniformly in the assigned list; pending seats count as normal seats.
  const assignedRecords = useMemo<AssignedRecord[]>(() => {
    return productLicenses
      .filter(l => !!l.userId)
      .map(l => ({ license: l, user: users.find(u => u.id === l.userId)! }))
      .filter(x => !!x.user);
  }, [productLicenses, users]);

  // Empty pending-payment seats are still tracked internally (so a new assignment lands on
  // one and stays tied to the invoice, and so the Pay button can appear) — never rendered.
  const emptyPendingSeats = useMemo(
    () => productLicenses.filter(l => l.status === 'pending_payment' && !l.userId),
    [productLicenses],
  );
  const pendingSeats = useMemo(
    () => productLicenses.filter(l => l.status === 'pending_payment'),
    [productLicenses],
  );

  // ---- Derived counts (all from live context) ----
  const licenseCount = liveProduct?.licenseCount ?? 0;          // total seats incl. added-now
  const pendingTotalCount = pendingSeats.length;
  const assignedCount = assignedRecords.length;                 // active + pre-assigned
  const activeAssignedCount = assignedRecords.filter(r => r.license.status !== 'pending_payment').length;
  // A free ACTIVE seat exists when active-assigned is below the non-pending capacity.
  const freeActiveSeats = Math.max(0, (licenseCount - pendingTotalCount) - activeAssignedCount);
  const renewalCount = liveProduct?.renewalSeatCount ?? licenseCount;       // committed renewal target
  const initialRenewalCount = renewalCount;

  // ---- Stepper (Section A/D — single source of truth, re-synced from live state) ----
  const [stepperInput, setStepperInput] = useState(initialRenewalCount);

  // ---- Dialog / overlay state ----
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayChoices, setOverlayChoices] = useState<Record<string, 'now' | 'expire'>>({});
  const [reduceConfirmOpen, setReduceConfirmOpen] = useState(false);
  const [increaseOpen, setIncreaseOpen] = useState(false);
  const [increaseMode, setIncreaseMode] = useState<'now' | 'renewal'>('now');
  const [unassignTarget, setUnassignTarget] = useState<AssignedRecord | null>(null);
  const [assignWarningUser, setAssignWarningUser] = useState<User | null>(null);
  // v20 — shopping-cart footer state.
  const [dirty, setDirty] = useState(false);                 // any committed in-session change
  const [payOpen, setPayOpen] = useState(false);             // PaymentMethodDialog
  const [payMethod, setPayMethod] = useState<PaymentMethod>('pay_immediately');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  // Section A2/D3 — full reset ONLY on open / product switch. v22: this effect must NOT
  // depend on initialRenewalCount — Apply commits update the live renewal count, and a
  // reset here was wiping `dirty` right after the handlers set it (Save never enabled).
  useEffect(() => {
    setStepperInput(initialRenewalCount);
    setOverlayOpen(false);
    setOverlayChoices({});
    setReduceConfirmOpen(false);
    setIncreaseOpen(false);
    setIncreaseMode('now');
    setUnassignTarget(null);
    setAssignWarningUser(null);
    setDirty(false);
    setPayOpen(false);
    setDiscardConfirmOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, liveProduct?.id]);

  // Re-snap the stepper to the new committed baseline whenever the live renewal count
  // changes (e.g. after an Apply commits) — WITHOUT resetting the in-session dirty flag,
  // so Save changes stays enabled after "Add at renewal only" / per-user removal.
  useEffect(() => {
    setStepperInput(initialRenewalCount);
  }, [initialRenewalCount]);

  // ---- Pricing helpers ----
  const catalog = liveProduct ? getCatalogProduct(liveProduct.name) : undefined;
  const pricePerSeatPerYear = catalog?.pricePerSeatPerYear ?? liveProduct?.pricePerLicense ?? 0;
  const maintenancePerSeatPerYear = catalog?.maintenancePerSeatPerYear ?? 0;

  const prorate = (seats: number): number => {
    if (seats <= 0 || !liveSub) return 0;
    return calculateProratedAdd({
      product: { pricePerSeatPerYear, maintenancePerSeatPerYear },
      seats,
      addDate: new Date(),
      renewalDate: new Date(liveSub.renewalDate),
      useLegacyProration,
    }).totalCharge;
  };

  // ---- Pending-change preview (stepper vs committed renewal) ----
  const delta = stepperInput - renewalCount;
  const annualDelta = delta * pricePerSeatPerYear;          // only shown when delta > 0
  const proratedToday = delta > 0 ? prorate(delta) : 0;     // never negative
  const applyDisabled = !canManageSeats || delta === 0;
  // Show the "no refund" note while actively reducing OR when a committed renewal
  // reduction is standing (renewal below the current paid count, no active edit).
  const showReductionNote = delta < 0 || (delta === 0 && renewalCount < licenseCount);

  // Section B — checkout-style order summary (Subtotal / Tax (7%) / Total) for an increase.
  const orderSubtotal = proratedToday;
  const orderTax = round2(orderSubtotal * TAX_RATE);
  const orderTotal = round2(orderSubtotal + orderTax);
  const daysRemaining = liveSub
    ? Math.max(0, Math.ceil((new Date(liveSub.renewalDate).getTime() - Date.now()) / 86400000))
    : 0;

  const renewalDateLabel = liveSub
    ? new Date(liveSub.renewalDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  // v20 — the provisional pending invoice for THIS product drives the footer Pay button.
  const pendingInvoice = useMemo(() => {
    const lic = pendingSeats.find(l => l.pendingPaymentInvoiceId);
    if (!lic) return null;
    const inv = invoices.find(i => i.id === lic.pendingPaymentInvoiceId);
    return inv && (inv.status === 'awaiting_payment' || inv.status === 'unpaid') ? inv : null;
  }, [pendingSeats, invoices]);
  const pendingAmount = pendingInvoice ? (pendingInvoice.totalAmount ?? pendingInvoice.amount) : 0;
  const availableMethods = getAvailablePaymentMethods(liveSub?.companyId);

  // ---- Apply: branch by direction ----
  const alreadyExpiringCount = assignedRecords.filter(r => !!r.license.expiringAtRenewal).length;
  const overlayRequired = Math.max(0, assignedCount - stepperInput - alreadyExpiringCount);

  const handleApply = () => {
    if (applyDisabled || !liveSub || !liveProduct) return;
    if (delta > 0) {
      setIncreaseMode('now');
      setIncreaseOpen(true);
    } else if (overlayRequired > 0) {
      setOverlayChoices({});
      setOverlayOpen(true);
    } else {
      setReduceConfirmOpen(true);
    }
  };

  // ---- Increase choice (Section G2) ----
  const increaseN = Math.max(0, stepperInput - renewalCount);
  const increaseProrated = prorate(increaseN);
  const handleIncreaseConfirm = () => {
    if (!liveSub || !liveProduct) return;
    if (increaseMode === 'now') {
      // v20 — add the seats now (provisional). The drawer STAYS open so the admin can
      // pre-assign users; the footer Pay button is where they pick how to pay.
      const res = addSeatsPendingPayment({
        subscriptionId: liveSub.id,
        productId: liveProduct.id,
        additionalSeats: increaseN,
      });
      setIncreaseOpen(false);
      if (res) {
        setDirty(true);
        toast({
          title: `${increaseN} seat${increaseN === 1 ? '' : 's'} added.`,
          description: 'Assign users below, then choose how to pay.',
        });
      }
    } else {
      updateRenewalSeatCount(liveSub.id, liveProduct.id, renewalCount + increaseN);
      setIncreaseOpen(false);
      setDirty(true);
      toast({
        title: 'Renewal count updated.',
        description: `${increaseN} seat${increaseN === 1 ? '' : 's'} will be added at renewal on ${renewalDateLabel}.`,
      });
    }
  };

  // ---- Simple reduce confirmation (no users affected) ----
  const reduceDelta = (renewalCount - stepperInput) * pricePerSeatPerYear;
  const handleReduceConfirm = () => {
    if (!liveSub || !liveProduct) return;
    updateRenewalSeatCount(liveSub.id, liveProduct.id, stepperInput);
    setReduceConfirmOpen(false);
    setDirty(true);
    toast({
      title: 'Renewal count updated.',
      description: 'Reducing renewal seat count. No refund issued for current cycle.',
    });
  };

  // ---- Per-user removal overlay (reduce below assigned) ----
  const overlayUsers = assignedRecords.filter(r => !r.license.expiringAtRenewal);
  const overlaySelected = Object.keys(overlayChoices).length;
  const overlayMatched = overlaySelected === overlayRequired;
  const toggleOverlayChoice = (userId: string, choice: 'now' | 'expire') => {
    setOverlayChoices(prev => {
      const next = { ...prev };
      if (next[userId] === choice) delete next[userId];
      else next[userId] = choice;
      return next;
    });
  };
  const handleOverlayConfirm = () => {
    if (!overlayMatched || !liveSub || !liveProduct) return;
    const removeNow: string[] = [];
    const expire: string[] = [];
    Object.entries(overlayChoices).forEach(([uid, c]) => {
      if (c === 'now') removeNow.push(uid);
      else expire.push(uid);
    });
    removeNow.forEach(uid => unassignLicense(uid, liveSub.id, liveProduct.id));
    if (expire.length) markLicensesExpiringAtRenewal(liveSub.id, liveProduct.id, expire, true);
    updateRenewalSeatCount(liveSub.id, liveProduct.id, stepperInput);
    setOverlayOpen(false);
    setOverlayChoices({});
    setDirty(true);
    toast({
      title: 'Renewal change applied.',
      description: 'Reducing renewal seat count. No refund issued for current cycle.',
    });
  };

  // ============================================================
  // EXPIRING SEAT ASSIGNMENT — STATE & HANDLER (v25, Section F)
  // ============================================================
  // Helper that does the actual assignment + optional expiring tag (performAssignment).
  const doAssign = (user: User, asExpiring: boolean) => {
    if (!liveSub || !liveProduct) return;
    // Prefer a free ACTIVE seat (immediate access). Otherwise fill an empty pending seat
    // (the assignment stays tied to the unpaid invoice — invisible to the admin, but the
    // user won't see access until the invoice is paid).
    let ok = false;
    if (freeActiveSeats > 0) {
      ok = assignLicense(user.id, liveSub.id, liveProduct.id);
    } else if (emptyPendingSeats.length > 0) {
      ok = assignUserToPendingSeat(user.id, liveSub.id, liveProduct.id);
    }
    if (!ok) {
      toast({ title: 'No available seats', description: 'Add seats before assigning more users.', variant: 'destructive' });
      return;
    }
    setDirty(true);
    if (asExpiring) {
      // Tag the newly-created license as expiring at renewal. Licenses in this model
      // are keyed by (userId, subscriptionId, productId) — there are no license ids.
      markLicensesExpiringAtRenewal(liveSub.id, liveProduct.id, [user.id], true);
      toast({
        title: 'Assigned to expiring seat',
        description: `${user.firstName} ${user.lastName} is assigned to a seat that expires at renewal. They'll lose access unless the seat is marked as renewing before then.`,
      });
    } else {
      toast({ title: 'Assigned', description: `${user.firstName} ${user.lastName} assigned to ${liveProduct.name}.` });
    }
  };

  const handleAssignClick = (user: User) => {
    if (!liveSub || !liveProduct) return;
    if (assignedCount >= licenseCount) return; // button is disabled anyway

    // Compute the "going-away seat" check (v25):
    //   pendingRenewalCount    = the value the admin has chosen for next renewal
    //                          = renewalSeatCount (if set) OR licenseCount (fallback)
    //   currentlyAssignedCount = users CURRENTLY assigned to this product
    //                          (active licenses only — excludes pending-payment and
    //                          released "previously held" rows)
    // If currentlyAssignedCount + 1 > pendingRenewalCount, this new assignment is
    // filling a seat that's going away at renewal — fire the warning.
    const pendingRenewalCount = liveProduct.renewalSeatCount ?? liveProduct.licenseCount;

    const currentlyAssignedCount = licenses.filter(l =>
      l.subscriptionId === liveSub.id &&
      l.productId === liveProduct.id &&
      !!l.userId &&                       // must have a user
      l.status !== 'pending_payment' &&   // exclude pending-payment licenses
      !l.deactivatedAt                    // exclude deactivated rows
    ).length;

    const willFillExpiringSeat = currentlyAssignedCount + 1 > pendingRenewalCount;

    // Debug log — remove after verification
    console.log('[Assign Check]', {
      userId: user.id,
      productId: liveProduct.id,
      pendingRenewalCount,
      currentlyAssignedCount,
      willFillExpiringSeat,
    });

    if (willFillExpiringSeat) {
      // Fire the warning dialog — STOP, do not assign yet.
      setAssignWarningUser(user);
      return;
    }

    // Normal assignment path (not a going-away seat).
    doAssign(user, false);
  };

  // "Assign anyway" on the warning dialog.
  const confirmAssignExpiring = () => {
    if (!assignWarningUser) return;
    doAssign(assignWarningUser, true); // true = expiring
    setAssignWarningUser(null);
  };

  const confirmUnassign = () => {
    if (!unassignTarget || !liveSub || !liveProduct) return;
    const u = unassignTarget.user;
    const isPending = unassignTarget.license.status === 'pending_payment';
    if (isPending) {
      // Revert to an empty pending seat (keep the paid seat + invoice link).
      unassignUserFromPendingSeat(u.id, liveSub.id, liveProduct.id);
    } else {
      unassignLicense(u.id, liveSub.id, liveProduct.id);
    }
    setDirty(true);
    toast({ title: `Unassigned ${u.firstName} ${u.lastName}.`, description: 'Seat is available for reassignment.' });
    setUnassignTarget(null);
  };

  const handleMarkRenewing = (rec: AssignedRecord) => {
    if (!liveSub || !liveProduct) return;
    // Flip the flag to false, then increment the renewal seat count by 1
    // (we just decided to keep this seat).
    markLicensesExpiringAtRenewal(liveSub.id, liveProduct.id, [rec.user.id], false);
    updateRenewalSeatCount(liveSub.id, liveProduct.id, renewalCount + 1);
    setDirty(true);
    toast({
      title: 'Marked as renewing',
      description: `Seat will renew at ${renewalDateLabel}. Renewal count updated.`,
    });
  };

  // ---- v20 Pay button flow ----
  const handlePayConfirm = () => {
    if (!pendingInvoice) return;
    setPayOpen(false);
    if (payMethod === 'pay_immediately') {
      onOpenChange(false);
      navigate('/pay', {
        state: {
          source: 'invoice',
          invoiceId: pendingInvoice.id,
          subtotal: pendingInvoice.subtotal ?? pendingInvoice.amount,
          tax: pendingInvoice.tax ?? 0,
          totalAmount: pendingInvoice.totalAmount ?? pendingInvoice.amount,
          returnTo: '/subscriptions',
        },
      });
      return;
    }
    finalizePendingInvoice(pendingInvoice.id, payMethod);
    if (payMethod === 'pay_on_terms') {
      toast({ title: `Invoice ${pendingInvoice.invoiceNumber} created with Net 30 terms.`, description: 'Seats are active now.' });
    } else {
      toast({ title: `Invoice ${pendingInvoice.invoiceNumber} created.`, description: 'Pay within 7 days to activate the seats.' });
    }
    onOpenChange(false);
  };

  // Cancel: with a provisional pending invoice, confirm discard first.
  const handleCancelClick = () => {
    if (pendingInvoice) {
      setDiscardConfirmOpen(true);
    } else {
      onOpenChange(false);
    }
  };
  const handleDiscard = () => {
    if (pendingInvoice) discardPendingInvoice(pendingInvoice.id);
    setDiscardConfirmOpen(false);
    onOpenChange(false);
  };

  if (!liveSub || !liveProduct) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl" />
      </Sheet>
    );
  }

  // ---- Unified Users list — pending is invisible; everyone renders uniformly (Section A) ----
  const assignedActive = assignedRecords.filter(r => !r.license.expiringAtRenewal).sort(byUserName);
  const assignedExpiring = assignedRecords.filter(r => !!r.license.expiringAtRenewal).sort(byUserName);
  const assignedUserIds = new Set(assignedRecords.map(r => r.user.id));
  const notAssigned = users
    .filter(u => u.companyId === liveSub.companyId && u.status === 'active' && !assignedUserIds.has(u.id))
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const noSeatsAvailable = assignedCount >= licenseCount;

  const ActivePill = () => <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
  const ExpiringPill = () => <Badge className="bg-warning/10 text-warning border-warning/20">Expiring at renewal</Badge>;

  const AssignedRow = ({ rec, expiring }: { rec: AssignedRecord; expiring?: boolean }) => (
    <div className="flex items-start gap-3 p-3 hover:bg-muted/40">
      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
        {userInitials(rec.user)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{rec.user.firstName} {rec.user.lastName}</div>
        <div className="text-xs text-muted-foreground truncate">
          {rec.user.email} · {rec.user.roles[0] ? ROLE_LABELS[rec.user.roles[0]] : 'User'}
        </div>
        <div className="mt-1.5">{expiring ? <ExpiringPill /> : <ActivePill />}</div>
      </div>
      {canAssign && (
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Button size="sm" variant="outline" className="h-7" onClick={() => setUnassignTarget(rec)}>
            <UserMinus className="h-3.5 w-3.5 mr-1" />Unassign
          </Button>
          {expiring && canRenewalStatus && (
            <Button size="sm" variant="outline" className="h-7" onClick={() => handleMarkRenewing(rec)}>
              <RotateCw className="h-3.5 w-3.5 mr-1" />Mark as renewing
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 space-y-1">
          <SheetTitle className="text-lg">Manage Licenses</SheetTitle>
          <SheetDescription>{liveProduct.name} · {liveSub.planType}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-6">
          {/* Summary card */}
          <div className="rounded-lg bg-primary text-primary-foreground p-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-foreground/80">Current seats</span>
                <span className="text-lg font-bold">{licenseCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-foreground/80">New seats</span>
                <span className="text-lg font-bold">{stepperInput}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-foreground/80">Currently assigned</span>
                <span className="text-lg font-bold">{assignedCount}</span>
              </div>
            </div>

            {/* Section B — checkout-style Order Summary (only on a pending increase) */}
            {delta > 0 && (
              <>
                <div className="border-t border-primary-foreground/20" />
                <div className="space-y-1.5">
                  <div className="text-xs uppercase tracking-wide text-primary-foreground/70">Order Summary</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-primary-foreground/90">{liveProduct.name} × {delta}</span>
                    <span className="font-medium">{formatCurrency(orderSubtotal)}</span>
                  </div>
                  <div className="text-[11px] text-primary-foreground/60">
                    Prorated for {daysRemaining} of 365 days
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-primary-foreground/80">Subtotal</span>
                    <span>{formatCurrency(orderSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-primary-foreground/80">Tax (7%)</span>
                    <span>{formatCurrency(orderTax)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold pt-1.5 border-t border-primary-foreground/20">
                    <span>Total</span>
                    <span>{formatCurrency(orderTotal)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Pending decrease: no charge today (Section B3 — no negative amounts) */}
            {delta < 0 && (
              <>
                <div className="border-t border-primary-foreground/20" />
                <div className="text-sm text-primary-foreground/90">
                  No charge today — changes apply at next renewal.
                </div>
              </>
            )}

            <div className="text-xs text-primary-foreground/70">
              per seat cost {formatCurrency(pricePerSeatPerYear)}/year
            </div>
          </div>

          {/* Decrease info note (Section C2 — State 3) */}
          {showReductionNote && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Reducing renewal seat count. No refund issued for current cycle.
              </AlertDescription>
            </Alert>
          )}

          {/* Stepper */}
          <div>
            <h3 className="text-sm font-medium text-center">Update seats at renewal</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <Button variant="default" size="icon" disabled={!canManageSeats || stepperInput <= 0}
                      onClick={() => setStepperInput(v => Math.max(0, v - 1))} aria-label="Decrease renewal seats">
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input type="number" min={0} value={stepperInput} disabled={!canManageSeats}
                      onChange={(e) => setStepperInput(Math.max(0, parseInt(e.target.value) || 0))}
                      className="h-10 w-20 text-center text-lg font-semibold" />
                    <Button variant="default" size="icon" disabled={!canManageSeats}
                      onClick={() => setStepperInput(v => v + 1)} aria-label="Increase renewal seats">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button variant="default" className="ml-2" disabled={applyDisabled} onClick={handleApply}>
                      Apply
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canManageSeats && (
                  <TooltipContent>Contact your Billing Admin to change seat counts.</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Unified Users list (Section B) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Users</span>
              <span className="text-xs text-muted-foreground">{assignedCount} of {licenseCount} assigned</span>
            </div>
            <div className="border rounded-md divide-y max-h-[420px] overflow-y-auto">
              {assignedActive.length === 0 && assignedExpiring.length === 0 && notAssigned.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground text-center">No active users in this company.</div>
              ) : (
                <>
                  {assignedActive.map(rec => <AssignedRow key={rec.user.id} rec={rec} expiring={false} />)}
                  {assignedExpiring.map(rec => <AssignedRow key={rec.user.id} rec={rec} expiring={true} />)}

                  {/* Not-assigned users */}
                  {notAssigned.map(u => (
                    <div key={u.id} className="flex items-start gap-3 p-3 hover:bg-muted/40">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {userInitials(u)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {u.email} · {u.roles[0] ? ROLE_LABELS[u.roles[0]] : 'User'}
                        </div>
                        <div className="mt-1.5">
                          <Badge variant="secondary" className="bg-muted text-muted-foreground">Not assigned</Badge>
                        </div>
                      </div>
                      {canAssign && (
                        <div className="shrink-0">
                          {noSeatsAvailable ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span tabIndex={0}>
                                    <Button size="sm" className="h-7" disabled>
                                      <UserPlus className="h-3.5 w-3.5 mr-1" />Assign
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[240px]">
                                  All paid seats are assigned. Increase seats at renewal or add seats now to assign more users.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Button size="sm" className="h-7" onClick={() => handleAssignClick(u)}>
                              <UserPlus className="h-3.5 w-3.5 mr-1" />Assign
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer — Pay button appears when a provisional charge is pending (Section B) */}
        <SheetFooter className="border-t px-5 py-4 sm:flex-col sm:items-stretch sm:space-x-0 gap-2">
          {pendingInvoice ? (
            <>
              <div className="text-xs text-muted-foreground">Pending charge from added seats</div>
              <div className="flex flex-row justify-end gap-2">
                <Button variant="outline" onClick={handleCancelClick}>Cancel</Button>
                <Button onClick={() => { setPayMethod(availableMethods[0] ?? 'pay_immediately'); setPayOpen(true); }}>
                  Pay {formatCurrency(pendingAmount)}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => onOpenChange(false)} disabled={!dirty}>Save changes</Button>
            </div>
          )}
        </SheetFooter>

        {/* Per-user removal overlay */}
        <Dialog open={overlayOpen} onOpenChange={setOverlayOpen}>
          <DialogContent className="max-w-lg bg-amber-50 dark:bg-amber-950/30 border-primary">
            <DialogHeader>
              <DialogTitle>Reduce seats at renewal</DialogTitle>
              <DialogDescription className="text-sm">
                The licenses you have paid for last through the current cycle. Select the {overlayRequired} user{overlayRequired === 1 ? '' : 's'} to remove now or expire at the next renewal.
              </DialogDescription>
            </DialogHeader>

            <div className="border rounded-md overflow-hidden bg-background">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
                <div>User</div>
                <div className="text-center w-20">Remove now</div>
                <div className="text-center w-28">Expire at renewal</div>
              </div>
              <div className="divide-y max-h-[240px] overflow-y-auto">
                {overlayUsers.map(rec => {
                  const choice = overlayChoices[rec.user.id];
                  return (
                    <div key={rec.user.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                          {userInitials(rec.user)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{rec.user.firstName} {rec.user.lastName}</div>
                          <div className="text-xs text-muted-foreground truncate">{rec.user.email}</div>
                        </div>
                      </div>
                      <div className="text-center w-20">
                        <Checkbox checked={choice === 'now'} onCheckedChange={() => toggleOverlayChoice(rec.user.id, 'now')}
                          aria-label={`Remove ${rec.user.email} now`} />
                      </div>
                      <div className="text-center w-28">
                        <Checkbox checked={choice === 'expire'} onCheckedChange={() => toggleOverlayChoice(rec.user.id, 'expire')}
                          aria-label={`Expire ${rec.user.email} at renewal`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`text-sm font-medium ${overlayMatched ? 'text-success' : 'text-destructive'}`}>
              {overlaySelected} of {overlayRequired} required selections
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOverlayOpen(false)}>
                <ArrowLeft className="h-4 w-4 mr-1" />Back
              </Button>
              <Button onClick={handleOverlayConfirm} disabled={!overlayMatched}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Simple reduce confirmation */}
        <Dialog open={reduceConfirmOpen} onOpenChange={setReduceConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reduce renewal seat count?</DialogTitle>
              <DialogDescription>
                Reduce renewal seat count from {renewalCount} to {stepperInput}? No users are affected.
                Your annual cost will drop by {formatCurrency(Math.abs(reduceDelta))}/year starting at the next renewal.
                No refund is issued for the current cycle.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setReduceConfirmOpen(false)}>Cancel</Button>
              <Button onClick={handleReduceConfirm}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Increase choice (Section G2) */}
        <Dialog open={increaseOpen} onOpenChange={setIncreaseOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add {increaseN} more seat{increaseN === 1 ? '' : 's'}?</DialogTitle>
              <DialogDescription>Choose when to apply this change.</DialogDescription>
            </DialogHeader>
            <RadioGroup value={increaseMode} onValueChange={(v) => setIncreaseMode(v as 'now' | 'renewal')} className="space-y-2">
              <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 ${increaseMode === 'now' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem value="now" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Add seats now</div>
                  <div className="text-xs text-muted-foreground">
                    Seats are added immediately so you can assign users. Prorated amount: {formatCurrency(increaseProrated)} — choose how to pay before you close.
                  </div>
                </div>
              </label>
              <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 ${increaseMode === 'renewal' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem value="renewal" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Add at renewal only</div>
                  <div className="text-xs text-muted-foreground">
                    Seats will be added at your next renewal on {renewalDateLabel}. No charge today.
                  </div>
                </div>
              </label>
            </RadioGroup>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIncreaseOpen(false)}>Cancel</Button>
              <Button onClick={handleIncreaseConfirm}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Expiring Seat Assignment Warning (Section F / v25) */}
        <AlertDialog open={!!assignWarningUser} onOpenChange={(o) => !o && setAssignWarningUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>This seat is set to expire at renewal</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <span className="block">
                  You are assigning <strong>{assignWarningUser?.firstName} {assignWarningUser?.lastName}</strong> to
                  a seat that is scheduled to be removed at the next renewal ({renewalDateLabel}).
                </span>
                <span className="block">
                  After renewal, this user will lose access to <strong>{liveProduct.name}</strong> unless
                  you increase the renewal seat count OR mark this seat as renewing before then.
                </span>
                <span className="block">Continue with the assignment?</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setAssignWarningUser(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmAssignExpiring}>Assign anyway</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Inline unassign confirmation (v17 copy, kept) */}
        <AlertDialog open={!!unassignTarget} onOpenChange={(o) => !o && setUnassignTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Unassign {unassignTarget?.user.firstName} {unassignTarget?.user.lastName}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {unassignTarget?.user.firstName} will lose access to {liveProduct.name} immediately. The seat
                remains paid through the current cycle and can be reassigned to another user at any time.
                No refund is issued.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={confirmUnassign}>
                Unassign
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* v20 — Payment method dialog (Pay button) */}
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>How would you like to pay?</DialogTitle>
              <DialogDescription>
                {formatCurrency(pendingAmount)} for the seats added to {liveProduct.name}.
              </DialogDescription>
            </DialogHeader>
            <RadioGroup value={payMethod} onValueChange={(v) => setPayMethod(v as PaymentMethod)} className="space-y-2">
              {availableMethods.includes('pay_immediately') && (
                <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 ${payMethod === 'pay_immediately' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="pay_immediately" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Pay Immediately</div>
                    <div className="text-xs text-muted-foreground">Select a saved payment method or add new. Seats activate on payment.</div>
                  </div>
                </label>
              )}
              {availableMethods.includes('pay_on_receipt') && (
                <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 ${payMethod === 'pay_on_receipt' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="pay_on_receipt" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Pay on Receipt</div>
                    <div className="text-xs text-muted-foreground">Invoice due upon receipt (7 days). Seats activate when paid.</div>
                  </div>
                </label>
              )}
              {availableMethods.includes('pay_on_terms') && (
                <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40 ${payMethod === 'pay_on_terms' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="pay_on_terms" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Pay on Terms (Net 30)</div>
                    <div className="text-xs text-muted-foreground">Invoice with 30-day terms. Seats activate immediately.</div>
                  </div>
                </label>
              )}
            </RadioGroup>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
              <Button onClick={handlePayConfirm}>Continue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* v20 — discard confirmation for unpaid changes (Cancel with pending invoice) */}
        <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard unpaid changes?</AlertDialogTitle>
              <AlertDialogDescription>
                You have unpaid changes. Discarding will remove the added seats, delete the
                unpaid invoice, and undo any pre-assignments to those seats. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDiscard}>
                Discard changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
};

/* ============================================================
 * Reactivate License Dialog (per discovery Q7)
 * ========================================================== */
const TAX_RATE = 0.07;
const round2 = (n: number) => Math.round(n * 100) / 100;

export const ReactivateLicenseDialog = ({
  target, onOpenChange,
}: {
  target: { license: License; subscription: Subscription; product: SubscriptionProduct } | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const {
    getCatalogProduct,
    useLegacyProration,
    getCompanyPaymentMethods,
    reactivateLicense,
  } = useApp();
  const { toast } = useToast();
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');

  // Reset selected payment method when target changes.
  useEffect(() => {
    if (!target) {
      setSelectedMethodId('');
      return;
    }
    const methods = getCompanyPaymentMethods(target.subscription.companyId);
    const primary = methods.find(m => m.isPrimary) || methods[0];
    setSelectedMethodId(primary?.id || '');
  }, [target, getCompanyPaymentMethods]);

  if (!target) return null;

  const catalog = getCatalogProduct(target.product.name);
  const maintenancePerSeat = catalog?.maintenancePerSeatPerYear ?? 0;
  const totalPerSeat = catalog?.pricePerSeatPerYear ?? target.product.pricePerLicense;
  const today = new Date();
  const renewalDate = new Date(target.subscription.renewalDate);
  // Maintenance-only proration: pass total=maintenance so the helper's license portion
  // computes to zero. In legacy mode the helper returns totalCharge against the value
  // passed as price — also fine since we pass maintenance there.
  const charge = calculateProratedAdd({
    product: {
      pricePerSeatPerYear: maintenancePerSeat,
      maintenancePerSeatPerYear: maintenancePerSeat,
    },
    seats: 1,
    addDate: today,
    renewalDate,
    useLegacyProration,
  });
  void totalPerSeat;
  const proratedAmount = charge.totalCharge;
  const tax = round2(proratedAmount * TAX_RATE);
  const total = round2(proratedAmount + tax);
  const methods = getCompanyPaymentMethods(target.subscription.companyId);

  const handleConfirm = () => {
    const result = reactivateLicense({
      subscriptionId: target.subscription.id,
      productId: target.product.id,
      licenseAssignedAt: target.license.assignedAt,
      paymentMethodId: selectedMethodId || undefined,
    });
    if (!result) {
      toast({ title: 'Could not reactivate this license', variant: 'destructive' });
      return;
    }
    toast({
      title: 'License reactivated',
      description: `A seat has been added to ${target.product.name}. Invoice ${result.invoice.invoiceNumber} is paid.`,
    });
    onOpenChange(false);
  };

  const renderMethodLabel = (m: SavedPaymentMethod) => {
    if (m.type === 'card') {
      return `${m.cardBrand} ending in ${m.cardLast4}`;
    }
    return `${m.bankName} •••• ${m.accountLast4}`;
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reactivate license</DialogTitle>
          <DialogDescription>
            This will add 1 seat to your subscription and charge a prorated maintenance fee
            for the remainder of the current year. No charge for the license itself — you
            already own it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3">
            <div className="text-base font-semibold">{target.product.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {target.subscription.name} · {target.subscription.planType}
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Days remaining</span>
              <span>{charge.daysRemaining} / 365</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prorated maintenance</span>
              <span>{formatCurrency(proratedAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (7%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="ra-method">Payment Method</Label>
            {methods.length === 0 ? (
              <Alert variant="default" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No saved payment methods on file. Add one from Profile → Payment first.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
                <SelectTrigger id="ra-method" className="mt-1.5">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="inline-flex items-center gap-2">
                        {m.type === 'card'
                          ? <CreditCard className="h-3.5 w-3.5" />
                          : <Landmark className="h-3.5 w-3.5" />}
                        {renderMethodLabel(m)}
                        {m.isPrimary ? ' (primary)' : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={methods.length === 0 || !selectedMethodId}
          >
            Reactivate &amp; Pay {formatCurrency(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* helpers for ManageLicensesDrawer — memoize derived lists to keep renders cheap */
function useMemoAssignedUsers(
  licenses: ReturnType<typeof useApp>['licenses'],
  users: ReturnType<typeof useApp>['users'],
  subscriptionId: string | undefined,
  productId: string | undefined,
) {
  return useMemo(() => {
    if (!subscriptionId || !productId) return [] as typeof users;
    const userIds = new Set(
      licenses
        .filter(l => l.subscriptionId === subscriptionId && l.productId === productId)
        .map(l => l.userId)
    );
    return users.filter(u => userIds.has(u.id));
  }, [licenses, users, subscriptionId, productId]);
}

function useMemoCompanyUsers(
  users: ReturnType<typeof useApp>['users'],
  companyId: string | undefined,
) {
  return useMemo(() => {
    if (!companyId) return [] as typeof users;
    return users.filter(u => u.companyId === companyId && u.status === 'active');
  }, [users, companyId]);
}

/* ============================================================
 * Accept Quote Drawer (side Sheet)
 * ========================================================== */
export const AcceptQuoteDrawer = ({
  open, onOpenChange, quote,
}: { open: boolean; onOpenChange: (v: boolean) => void; quote: Quote | null }) => {
  const navigate = useNavigate();
  const { acceptQuote, getCompanyConfig, getAvailablePaymentMethods } = useApp();
  const { toast } = useToast();
  const cfg = getCompanyConfig(quote?.companyId);
  const available = getAvailablePaymentMethods(quote?.companyId);
  const defaultMethod: PaymentMethod = available.includes('pay_on_terms') ? 'pay_on_terms' : 'pay_on_receipt';
  const [poNumber, setPoNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultMethod);

  useEffect(() => {
    if (open) {
      setPoNumber(quote?.poNumber || '');
      setPaymentMethod(defaultMethod);
    }
  }, [open, quote?.poNumber, defaultMethod]);

  if (!quote) return null;

  const subtotal = quote.amount;
  const tax = Math.round(subtotal * 0.07 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const handleConfirm = () => {
    if (paymentMethod === 'pay_immediately') {
      onOpenChange(false);
      navigate('/pay', {
        state: {
          source: 'quote',
          quoteId: quote.id,
          lineItems: quote.lineItems,
          subtotal,
          tax,
          totalAmount: total,
          returnTo: '/quotes',
          poNumber: poNumber || undefined,
        },
      });
      return;
    }
    const result = acceptQuote(quote.id, { poNumber: poNumber || undefined, paymentMethod });
    if (!result) {
      toast({ title: 'Unable to accept quote', description: 'This quote has expired.', variant: 'destructive' });
      return;
    }
    if (paymentMethod === 'pay_on_terms') {
      toast({ title: 'Quote accepted under approved payment terms.', description: `Subscription activated. Invoice ${result.invoice.invoiceNumber}.` });
      onOpenChange(false);
      return;
    }
    // Pay on Receipt — route to Invoices so the user can pay the new invoice.
    toast({
      title: 'Invoice generated',
      description: 'Pay your invoice to activate your subscription.',
    });
    onOpenChange(false);
    navigate('/invoices');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Accept Quote</SheetTitle>
          <SheetDescription>Review and confirm acceptance of this quote.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Quote #</span><span className="font-medium">{quote.quoteNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Products</span><span className="font-medium text-right">{quote.lineItems.map(l => `${l.productName} (${l.licenseCount})`).join(', ')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">${quote.amount.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium">{new Date(quote.createdDate).toLocaleDateString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expires</span><span className="font-medium">{new Date(quote.expiryDate).toLocaleDateString()}</span></div>
            {quote.note && <div className="pt-1 text-xs text-muted-foreground">Note: {quote.note}</div>}
          </div>

          <div>
            <Label htmlFor="po">PO Number (optional)</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              Provide a purchase order reference if required by your company.
            </p>
            <Input id="po" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Enter PO number if applicable" />
          </div>

          <div>
            <Label>Payment Method</Label>
            <div className="mt-2">
              <PaymentMethodPicker
                value={paymentMethod}
                onChange={setPaymentMethod}
                available={available}
                terms={cfg.terms}
              />
            </div>
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm}>
            {paymentMethod === 'pay_immediately' ? 'Continue to Payment' : 'Confirm Acceptance'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

// Backward-compat alias so existing imports of AcceptQuoteDialog continue to work
export const AcceptQuoteDialog = AcceptQuoteDrawer;

/* ============================================================
 * Decline Quote Dialog
 * ========================================================== */
export const DeclineQuoteDialog = ({
  open, onOpenChange, quote,
}: { open: boolean; onOpenChange: (v: boolean) => void; quote: Quote | null }) => {
  const { declineQuote } = useApp();
  const { toast } = useToast();
  const [reason, setReason] = useState('');

  useEffect(() => { if (open) setReason(''); }, [open]);

  if (!quote) return null;

  const handleDecline = () => {
    declineQuote(quote.id, reason || undefined);
    toast({ title: 'Quote declined successfully', description: quote.quoteNumber });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline Quote</DialogTitle>
          <DialogDescription>Are you sure you want to decline this quote?</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            placeholder="Help us understand why you're declining this quote..."
            rows={3}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">{reason.length}/500</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDecline}>Decline Quote</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================
 * View Decline Reason Dialog
 * ========================================================== */
export const ViewDeclineReasonDialog = ({
  open, onOpenChange, quote,
}: { open: boolean; onOpenChange: (v: boolean) => void; quote: Quote | null }) => {
  if (!quote) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline Reason — {quote.quoteNumber}</DialogTitle>
          <DialogDescription>Reason recorded when this quote was declined.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
          {quote.declineReason || '—'}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================
 * View Note Dialog
 * ========================================================== */
export const ViewNoteDialog = ({
  open, onOpenChange, quote,
}: { open: boolean; onOpenChange: (v: boolean) => void; quote: Quote | null }) => {
  if (!quote) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quote Note — {quote.quoteNumber}</DialogTitle>
          <DialogDescription>Note added when this quote was created.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
          {quote.note || '—'}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ============================================================
 * Request a Quote Dialog
 * ========================================================== */
const REQUEST_REASONS: QuoteRequestReason[] = [
  'Adding seats to a current product',
  'Adding a new product',
  'Other',
];

export const RequestQuoteDialog = ({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { createQuote, notify } = useApp();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [reason, setReason] = useState<QuoteRequestReason | ''>('');

  useEffect(() => {
    if (open) { setSelected({}); setNote(''); setReason(''); }
  }, [open]);

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = { ...prev };
      if (name in next) delete next[name];
      else next[name] = 1;
      return next;
    });
  };

  const updateCount = (name: string, count: number) => {
    setSelected(prev => ({ ...prev, [name]: Math.max(1, count) }));
  };

  const handleSubmit = () => {
    const entries = Object.entries(selected);
    // Per discovery Q8: only product(s) + seat count are required. PO and note are optional.
    if (entries.length === 0) {
      toast({ title: 'Please select at least one product', variant: 'destructive' });
      return;
    }
    if (entries.some(([name, qty]) => name !== 'DataNet' && (!Number.isFinite(qty) || qty < 1))) {
      toast({ title: 'Please enter a seat count for each selected product', variant: 'destructive' });
      return;
    }
    const lineItems = entries.map(([productName, qty]) => {
      const cat = PRODUCT_CATALOG.find(p => p.name === productName);
      const unitPrice = cat?.defaultPrice ?? 0;
      const count = productName === 'DataNet' ? 1 : qty;
      return {
        productName,
        licenseCount: count,
        unitPrice,
        total: unitPrice * count,
      };
    });
    createQuote({
      lineItems,
      note: note.trim(),
      status: 'requested',
      requestReason: reason || undefined,
    });
    notify({
      type: 'quote.received',
      title: 'Quote request submitted',
      message: "Your sales team will respond shortly. You'll see the formal quote here when it's ready.",
      link: '/quotes',
      linkLabel: 'View quotes',
    });
    toast({
      title: 'Quote request submitted',
      description: 'Your sales team will respond shortly.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a Quote</DialogTitle>
          <DialogDescription>Tell us what you need and our team will prepare a quote for you.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Your request will be reviewed by our sales team. You&apos;ll be notified when the formal quote is ready to accept.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Product Requirement</Label>
            <div className="space-y-2">
              {PRODUCT_CATALOG.map(p => {
                const isSel = p.name in selected;
                const isDN = p.name === 'DataNet';
                return (
                  <div key={p.name} className="flex items-center gap-3 border rounded-md p-2.5">
                    <Checkbox checked={isSel} onCheckedChange={() => toggle(p.name)} />
                    <span className="flex-1 text-sm">{p.name}</span>
                    <Input
                      type="number" min={1} className="w-24"
                      value={isSel ? selected[p.name] : ''}
                      placeholder={isDN ? 'n/a' : 'Qty'}
                      disabled={!isSel || isDN}
                      onChange={(e) => updateCount(p.name, parseInt(e.target.value) || 1)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="qr-reason">Reason for request (optional)</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as QuoteRequestReason)}>
              <SelectTrigger id="qr-reason" className="mt-1.5">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="qrnote">Note (optional)</Label>
            <Textarea
              id="qrnote"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder="Describe what product, license count, or change you are expecting."
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">{note.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={Object.keys(selected).length === 0}>Submit Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
