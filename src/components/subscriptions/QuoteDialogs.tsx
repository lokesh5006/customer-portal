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
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Minus, Info, ArrowLeft, AlertCircle, CreditCard, Landmark, UserPlus, UserMinus, Search, ArrowUp, ArrowDown, MoreVertical, RotateCw, Printer, Package, Check } from 'lucide-react';

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
 *                          both directions via the stepper; committed to
 *                          product.renewalSeatCount by Save changes (v28 — no Apply).
 *   • Currently assigned — live count of active assignments.
 *
 * v28: Apply is gone. The Current Seats stepper live-syncs pending seats (floored at the
 * paid count); Save changes is the single commit action and is gated on validity only.
 * Assign / unassign / mark-renewing commit to AppContext immediately. Because callers pass a snapshot product/subscription, the drawer
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
    adjustPendingSeats,
    getAvailablePaymentMethods,
    getCompanyConfig,
    submitSeatRequest,
    subscriptions,
    licenses,
    invoices,
    users,
    can,
    hasAccess,
  } = useApp();
  const { toast } = useToast();

  const canManageSeats = can('manage_seats_count');
  const canAssign = can('manage_user_assignment');
  const canRenewalStatus = can('manage_seat_renewal_status');
  // v26 — Billing Admin gets full range on both tabs but is floored on decreases and can
  // never reach the per-user overlay (they can't choose who loses access). Account Owner
  // is unrestricted. License Admin has canManageSeats === false already, gating both tabs.
  const isOwner = hasAccess(['account_owner']);
  const isFlooredBillingAdmin = canManageSeats && !isOwner;
  // v27 — a "pure" Billing Admin (no license_admin, no account_owner) sees Users & Contacts
  // but every Assign/Unassign button is disabled. A Billing Admin who ALSO holds
  // license_admin keeps full access via that role, unaffected.
  const isPureBillingAdmin = hasAccess(['billing_admin']) && !hasAccess(['license_admin']) && !isOwner;
  // A "pure" License Admin (no billing_admin, no account_owner) gets assign/unassign only —
  // no seat-count or pricing controls at all (US-SP11-SB-004), so the Current Seats/At
  // Renewal tabs are hidden entirely rather than merely disabled.
  const isPureLicenseAdmin = hasAccess(['license_admin']) && !hasAccess(['billing_admin']) && !isOwner;

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

  // v27 — VIP/negotiated-pricing account: hide all pricing, swap Apply for a Request flow
  // that files a ticket instead of mutating seats. hasPendingSeatRequest locks both tabs'
  // seat-count controls (not Users & Contacts) until back office resolves the request.
  const isVip = !!getCompanyConfig(liveSub?.companyId).hasNegotiatedPricing;
  const hasPendingSeatRequest = !!liveProduct?.hasPendingSeatRequest;

  // ---- Derived counts (all from live context) ----
  const licenseCount = liveProduct?.licenseCount ?? 0;          // total seats incl. added-now
  const pendingTotalCount = pendingSeats.length;
  const assignedCount = assignedRecords.length;                 // active + pre-assigned
  const activeAssignedCount = assignedRecords.filter(r => r.license.status !== 'pending_payment').length;
  // A free ACTIVE seat exists when active-assigned is below the non-pending capacity.
  const freeActiveSeats = Math.max(0, (licenseCount - pendingTotalCount) - activeAssignedCount);
  const renewalCount = liveProduct?.renewalSeatCount ?? licenseCount;       // committed renewal target
  // v28 — seats already paid for (pending-payment seats excluded). The Current Seats
  // stepper never goes below this: no mid-cycle reduction of paid seats.
  const paidSeatCount = licenseCount - pendingTotalCount;

  // ---- v26 — two independent tracks, each with its own stepper ----
  type SeatTab = 'current' | 'renewal';
  const [activeTab, setActiveTab] = useState<SeatTab>('current');
  // v28 — Current Seats target. Non-VIP: live-synced to pending seats (see effect below),
  // so new seats are assignable immediately — there is no Apply step.
  const [currentStepperInput, setCurrentStepperInput] = useState(licenseCount);
  // v28 — At Renewal is a draft committed by Save changes. Stored as an offset from the
  // committed renewal count so it survives renewal-count bumps from Current Seats edits.
  const [renewalDraftDelta, setRenewalDraftDelta] = useState(0);
  const renewalStepperInput = renewalCount + renewalDraftDelta;
  const setRenewalStepperInput = (next: number | ((v: number) => number)) =>
    setRenewalDraftDelta(d => {
      const cur = renewalCount + d;
      return (typeof next === 'function' ? next(cur) : next) - renewalCount;
    });

  // ---- Dialog / overlay state ----
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlaySelected, setOverlaySelected] = useState<Set<string>>(new Set());
  const [reduceConfirmOpen, setReduceConfirmOpen] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<AssignedRecord | null>(null);
  const [assignWarningUser, setAssignWarningUser] = useState<User | null>(null);
  // v20 — shopping-cart footer state.
  const [payOpen, setPayOpen] = useState(false);             // PaymentMethodDialog
  const [payMethod, setPayMethod] = useState<PaymentMethod>('pay_immediately');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  // v28 — live sync is armed only after the open/product reset below has landed, so a
  // stale stepper value from a previous session can never add or release seats.
  const [syncedProductId, setSyncedProductId] = useState<string | null>(null);

  // Section A2/D3 — full reset ONLY on open / product switch.
  useEffect(() => {
    setSyncedProductId(open ? liveProduct?.id ?? null : null);
    setActiveTab('current');
    setCurrentStepperInput(licenseCount);
    setRenewalDraftDelta(0);
    setOverlayOpen(false);
    setOverlaySelected(new Set());
    setReduceConfirmOpen(false);
    setUnassignTarget(null);
    setAssignWarningUser(null);
    setPayOpen(false);
    setDiscardConfirmOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, liveProduct?.id]);

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

  const daysRemaining = liveSub
    ? Math.max(0, Math.ceil((new Date(liveSub.renewalDate).getTime() - Date.now()) / 86400000))
    : 0;

  const renewalDateLabel = liveSub
    ? new Date(liveSub.renewalDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  // v26 — header stat tiles + ring (Current Seats basis only, unaffected by active tab)
  const ringPct = licenseCount > 0 ? Math.min(1, assignedCount / licenseCount) : 0;
  const availableToAssign = Math.max(0, licenseCount - assignedCount);
  const renewalVsCurrentDelta = renewalCount - licenseCount;
  const renewalDeltaLabel = renewalVsCurrentDelta === 0
    ? 'No change scheduled'
    : `${renewalVsCurrentDelta > 0 ? '+' : '−'}${Math.abs(renewalVsCurrentDelta)} from ${renewalDateLabel}`;

  // v20 — the provisional pending invoice for THIS product drives the footer Pay button.
  const pendingInvoice = useMemo(() => {
    const lic = pendingSeats.find(l => l.pendingPaymentInvoiceId);
    if (!lic) return null;
    const inv = invoices.find(i => i.id === lic.pendingPaymentInvoiceId);
    return inv && (inv.status === 'awaiting_payment' || inv.status === 'unpaid') ? inv : null;
  }, [pendingSeats, invoices]);
  const pendingAmount = pendingInvoice ? (pendingInvoice.totalAmount ?? pendingInvoice.amount) : 0;
  const availableMethods = getAvailablePaymentMethods(liveSub?.companyId);

  // ============================================================
  // v26 — CURRENT SEATS tab (immediate, increase-only below the paid count)
  // ============================================================
  // VIP: the stepper is a draft for the Request flow (no seats are created).
  const currentDelta = Math.max(0, currentStepperInput - licenseCount);
  // Non-VIP: seats are live-synced, so the order summary reflects the pending invoice.
  const currentNewSeats = isVip ? currentDelta : pendingTotalCount;
  const currentProratedToday = prorate(currentNewSeats);
  const currentOrderSubtotal = currentProratedToday;
  const currentOrderTax = round2(currentOrderSubtotal * TAX_RATE);
  const currentOrderTotal = round2(currentOrderSubtotal + currentOrderTax);
  const currentRequestDisabled = !canManageSeats || currentDelta === 0 || hasPendingSeatRequest;

  const currentFloor = isVip ? licenseCount : paidSeatCount;
  const clampCurrentStepper = (v: number) => Math.max(currentFloor, v);
  useEffect(() => {
    setCurrentStepperInput(v => Math.max(currentFloor, v));
  }, [currentFloor]);

  // v28 — live sync (replaces Apply): grow/shrink pending seats to match the stepper.
  // Only EMPTY pending seats are released; seats holding pre-assigned users stay until
  // those users are unassigned — at which point this re-runs and releases them.
  useEffect(() => {
    if (!open || isVip || !canManageSeats || hasPendingSeatRequest || !liveSub || !liveProduct) return;
    if (syncedProductId !== liveProduct.id) return;
    if (currentStepperInput > licenseCount) {
      adjustPendingSeats({ subscriptionId: liveSub.id, productId: liveProduct.id, delta: currentStepperInput - licenseCount });
    } else if (currentStepperInput < licenseCount && (emptyPendingSeats.length > 0 || freeActiveSeats > 0)) {
      // The context releases only what it safely can (empty pending seats, or pending
      // users moved onto freed paid seats); anything left is the invalid state below.
      adjustPendingSeats({ subscriptionId: liveSub.id, productId: liveProduct.id, delta: currentStepperInput - licenseCount });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, syncedProductId, isVip, canManageSeats, hasPendingSeatRequest, currentStepperInput, licenseCount, emptyPendingSeats.length, freeActiveSeats]);

  // v28 — invalid in-progress reduction: target is below the number of assigned users.
  // Save changes stays disabled until enough users are unassigned (clears automatically).
  const currentInvalid = !isVip && currentStepperInput < assignedCount;
  const usersToUnassign = Math.max(0, assignedCount - currentStepperInput);
  // PLACEHOLDER COPY — pending final client sign-off.
  const currentInvalidMessage = canAssign && !isPureBillingAdmin
    ? `Unassign ${usersToUnassign} user${usersToUnassign === 1 ? '' : 's'} in Users & Contacts to reduce to ${currentStepperInput} seat${currentStepperInput === 1 ? '' : 's'}.`
    : `${usersToUnassign} user${usersToUnassign === 1 ? '' : 's'} must be unassigned by a License Admin or Account Owner to reduce to ${currentStepperInput} seat${currentStepperInput === 1 ? '' : 's'}.`;

  // v27 — VIP path: file a request instead of billing. No seat mutation, no invoice.
  const handleRequestCurrent = () => {
    if (currentRequestDisabled || !liveSub || !liveProduct) return;
    const ok = submitSeatRequest({
      subscriptionId: liveSub.id,
      productId: liveProduct.id,
      description: `Customer requested +${currentDelta} seat${currentDelta === 1 ? '' : 's'} on ${liveProduct.name}, effective immediately.`,
    });
    if (ok) {
      toast({
        title: 'Request submitted.',
        description: "This account has custom pricing. Our team will follow up with you directly.",
      });
    }
  };

  // ============================================================
  // v26 — AT RENEWAL tab (deferred, full range, floored for Billing Admin)
  // ============================================================
  const alreadyExpiringCount = assignedRecords.filter(r => !!r.license.expiringAtRenewal).length;
  // Billing Admin can never trigger the per-user overlay — their input floors at the
  // point where no per-user decision would be required. Account Owner is unrestricted.
  const renewalFloor = isFlooredBillingAdmin ? Math.max(0, assignedCount - alreadyExpiringCount) : 0;
  const clampRenewalStepper = (v: number) => Math.max(renewalFloor, v);

  // Re-clamp if the floor rises out from under an already-typed value (e.g. a user gets
  // assigned elsewhere while a Billing Admin has the At Renewal tab open).
  useEffect(() => {
    setRenewalStepperInput(v => Math.max(renewalFloor, v));
  }, [renewalFloor]);

  const renewalDelta = renewalStepperInput - renewalCount;
  const renewalNewAnnualTotal = renewalStepperInput * pricePerSeatPerYear;
  const renewalRequestDisabled = !canManageSeats || renewalDelta === 0 || hasPendingSeatRequest;
  // Show the "no refund" note while actively reducing OR when a committed renewal
  // reduction is standing (renewal below the current paid count, no active edit).
  const showReductionNote = renewalDelta < 0 || (renewalDelta === 0 && renewalCount < licenseCount);
  const overlayRequired = Math.max(0, assignedCount - renewalStepperInput - alreadyExpiringCount);

  // ============================================================
  // v28 — SAVE CHANGES (single commit action; Apply removed from both tabs)
  // ============================================================
  // Enabled on validity only — never on whether new seats have been assigned.
  const saveDisabled = currentInvalid;

  // Last step of Save: hand off to the existing Pay flow if seats were added, else close.
  const finishSave = () => {
    if (pendingInvoice && !isVip) {
      setPayMethod(availableMethods[0] ?? 'pay_immediately');
      setPayOpen(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleSave = () => {
    if (saveDisabled || !liveSub || !liveProduct) return;
    // Commit the At Renewal draft (non-VIP; VIP changes go through Request instead).
    if (!isVip && canManageSeats && !hasPendingSeatRequest && renewalDelta !== 0) {
      if (renewalDelta > 0) {
        updateRenewalSeatCount(liveSub.id, liveProduct.id, renewalStepperInput);
        setRenewalDraftDelta(0);
        toast({
          title: 'Renewal count updated.',
          description: `${renewalDelta} seat${renewalDelta === 1 ? '' : 's'} will be added at renewal on ${renewalDateLabel}.`,
        });
      } else if (overlayRequired > 0) {
        // Unchanged "Expire at renewal" overlay; its Confirm continues via finishSave.
        setOverlaySelected(new Set());
        setOverlayOpen(true);
        return;
      } else {
        setReduceConfirmOpen(true);
        return;
      }
    }
    finishSave();
  };

  // v27 — VIP path: file a request instead of scheduling/billing. No seat mutation.
  const handleRequestRenewal = () => {
    if (renewalRequestDisabled || !liveSub || !liveProduct) return;
    const amount = Math.abs(renewalDelta);
    const description = renewalDelta > 0
      ? `Customer requested +${amount} seat${amount === 1 ? '' : 's'} on ${liveProduct.name}, effective at renewal on ${renewalDateLabel}.`
      : `Customer requested to reduce seats by ${amount} on ${liveProduct.name}, effective at renewal on ${renewalDateLabel}.`;
    const ok = submitSeatRequest({ subscriptionId: liveSub.id, productId: liveProduct.id, description });
    if (ok) {
      toast({
        title: 'Request submitted.',
        description: "This account has custom pricing. Our team will follow up with you directly.",
      });
    }
  };

  // ---- Simple reduce confirmation (no users affected) ----
  const reduceDelta = (renewalCount - renewalStepperInput) * pricePerSeatPerYear;
  const handleReduceConfirm = () => {
    if (!liveSub || !liveProduct) return;
    updateRenewalSeatCount(liveSub.id, liveProduct.id, renewalStepperInput);
    setRenewalDraftDelta(0);
    setReduceConfirmOpen(false);
    toast({
      title: 'Renewal count updated.',
      description: 'Reducing renewal seat count. No refund issued for current cycle.',
    });
    finishSave();
  };

  // ---- Per-user "expire at renewal" overlay (reduce below assigned) — single mode,
  // since the At Renewal tab is the only track with a decrease path (v26).
  const overlayUsers = assignedRecords.filter(r => !r.license.expiringAtRenewal);
  const overlayMatched = overlaySelected.size === overlayRequired;
  const toggleOverlayUser = (userId: string) => {
    setOverlaySelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };
  const handleOverlayConfirm = () => {
    if (!overlayMatched || !liveSub || !liveProduct) return;
    markLicensesExpiringAtRenewal(liveSub.id, liveProduct.id, Array.from(overlaySelected), true);
    updateRenewalSeatCount(liveSub.id, liveProduct.id, renewalStepperInput);
    setRenewalDraftDelta(0);
    setOverlayOpen(false);
    setOverlaySelected(new Set());
    toast({
      title: 'Renewal change applied.',
      description: 'Reducing renewal seat count. No refund issued for current cycle.',
    });
    finishSave();
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
    toast({ title: `Unassigned ${u.firstName} ${u.lastName}.`, description: 'Seat is available for reassignment.' });
    setUnassignTarget(null);
  };

  const handleMarkRenewing = (rec: AssignedRecord) => {
    if (!liveSub || !liveProduct) return;
    // Flip the flag to false, then increment the renewal seat count by 1
    // (we just decided to keep this seat).
    markLicensesExpiringAtRenewal(liveSub.id, liveProduct.id, [rec.user.id], false);
    updateRenewalSeatCount(liveSub.id, liveProduct.id, renewalCount + 1);
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
    setCurrentStepperInput(paidSeatCount);
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
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button size="sm" variant="outline" className={`h-7 ${isPureBillingAdmin ? 'pointer-events-none' : ''}`}
                  disabled={isPureBillingAdmin} onClick={() => setUnassignTarget(rec)}>
                  <UserMinus className="h-3.5 w-3.5 mr-1" />Unassign
                </Button>
              </span>
            </TooltipTrigger>
            {isPureBillingAdmin && (
              <TooltipContent>Only License Admin or Account Owner can assign or unassign licenses.</TooltipContent>
            )}
          </Tooltip>
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
          <div className="flex items-center gap-2">
            <SheetTitle className="text-lg">Manage Licenses</SheetTitle>
            {isVip && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Custom Pricing</Badge>
            )}
          </div>
          <SheetDescription>{liveProduct.name} · {liveSub.planType}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-6">
          {/* v26 — three-stat header + progress ring (Current Seats basis, unaffected by tab) */}
          <div className="rounded-lg bg-primary text-primary-foreground p-4">
            <div className="flex items-center gap-4">
              <svg width="60" height="60" viewBox="0 0 60 60" className="shrink-0" role="img"
                aria-label={`${assignedCount} of ${licenseCount} seats assigned`}>
                <circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="6" />
                <circle
                  cx="30" cy="30" r="26" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 26}
                  strokeDashoffset={2 * Math.PI * 26 * (1 - ringPct)}
                  transform="rotate(-90 30 30)"
                />
                <text x="30" y="34" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor">
                  {Math.round(ringPct * 100)}%
                </text>
              </svg>
              <div className="grid grid-cols-3 gap-3 flex-1 min-w-0">
                <div>
                  <div className="text-xs text-primary-foreground/70">Current Seats</div>
                  <div className="text-lg font-bold">{licenseCount}</div>
                  <div className="text-[11px] text-primary-foreground/60">
                    {isVip ? 'Custom pricing' : `${formatCurrency(pricePerSeatPerYear)}/seat/yr`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-primary-foreground/70">Assigned</div>
                  <div className="text-lg font-bold">{assignedCount} / {licenseCount}</div>
                  <div className="text-[11px] text-primary-foreground/60">{availableToAssign} available to assign</div>
                </div>
                <div>
                  <div className="text-xs text-primary-foreground/70">At Renewal</div>
                  <div className="text-lg font-bold">{renewalCount}</div>
                  <div className="text-[11px] text-primary-foreground/60">{renewalDeltaLabel}</div>
                </div>
              </div>
            </div>
          </div>

          {/* v26 — Current Seats / At Renewal tabs — hidden for a pure License Admin,
              who gets assign/unassign only, no seat-count or pricing controls. */}
          {!isPureLicenseAdmin && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SeatTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current">Current Seats</TabsTrigger>
              <TabsTrigger value="renewal">At Renewal</TabsTrigger>
            </TabsList>

            {/* ---- Current Seats panel (immediate, increase-only) ---- */}
            <TabsContent value="current" className="space-y-4 pt-2">
              {canManageSeats ? (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-center">Add seats now</h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <Button variant="default" size="icon" disabled={currentStepperInput <= currentFloor || hasPendingSeatRequest}
                              onClick={() => setCurrentStepperInput(v => clampCurrentStepper(v - 1))} aria-label="Decrease current seats">
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input type="number" min={currentFloor} value={currentStepperInput} disabled={hasPendingSeatRequest}
                              onChange={(e) => setCurrentStepperInput(clampCurrentStepper(parseInt(e.target.value) || currentFloor))}
                              aria-invalid={currentInvalid}
                              aria-describedby={currentInvalid ? 'current-seats-error' : undefined}
                              className={`h-10 w-20 text-center text-lg font-semibold ${currentInvalid ? 'border-destructive text-destructive focus-visible:ring-destructive' : ''}`} />
                            <Button variant="default" size="icon" disabled={hasPendingSeatRequest}
                              onClick={() => setCurrentStepperInput(v => clampCurrentStepper(v + 1))} aria-label="Increase current seats">
                              <Plus className="h-4 w-4" />
                            </Button>
                            {/* v28 — Apply removed; VIP keeps its (unchanged) Request flow */}
                            {isVip && (
                              <Button variant="default" className="ml-2" disabled={currentRequestDisabled}
                                onClick={handleRequestCurrent}>
                                Request
                              </Button>
                            )}
                          </div>
                        </TooltipTrigger>
                        {hasPendingSeatRequest && (
                          <TooltipContent>A seat change request is already pending review. Our team will follow up with you.</TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    {currentInvalid && (
                      <p id="current-seats-error" role="alert" className="mt-2 text-xs text-destructive text-center">
                        {currentInvalidMessage}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground text-center">
                      Current seats only ever increase mid-cycle. To reduce seats, use the At Renewal tab.
                    </p>
                    {isVip && (
                      <p className="mt-2 text-xs text-muted-foreground text-center">
                        This account has custom pricing. Submitting this request will notify our team, and they'll follow up with you directly.
                      </p>
                    )}
                  </div>

                  {!isVip && currentNewSeats > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Order Summary</div>
                      <div className="flex justify-between text-sm">
                        <span>{liveProduct.name} × {currentNewSeats}</span>
                        <span className="font-medium">{formatCurrency(currentOrderSubtotal)}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Prorated for {daysRemaining} of 365 days
                      </div>
                      <div className="flex justify-between text-sm pt-1">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatCurrency(currentOrderSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax (7%)</span>
                        <span>{formatCurrency(currentOrderTax)}</span>
                      </div>
                      <div className="flex justify-between text-base font-semibold pt-1.5 border-t">
                        <span>Total Due</span>
                        <span>{formatCurrency(currentOrderTotal)}</span>
                      </div>
                    </div>
                  )}
                  {isVip && currentDelta > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                      Requesting {currentDelta} additional seat{currentDelta === 1 ? '' : 's'} on {liveProduct.name}.
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Only a Billing Admin or Account Owner can update seat counts.
                </p>
              )}
            </TabsContent>

            {/* ---- At Renewal panel (deferred, full range, floored for Billing Admin) ---- */}
            <TabsContent value="renewal" className="space-y-4 pt-2">
              {canManageSeats ? (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-center">Update seats at renewal</h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <Button variant="default" size="icon" disabled={renewalStepperInput <= renewalFloor || hasPendingSeatRequest}
                              onClick={() => setRenewalStepperInput(v => clampRenewalStepper(v - 1))} aria-label="Decrease renewal seats">
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input type="number" min={renewalFloor} value={renewalStepperInput} disabled={hasPendingSeatRequest}
                              onChange={(e) => setRenewalStepperInput(clampRenewalStepper(parseInt(e.target.value) || renewalFloor))}
                              className="h-10 w-20 text-center text-lg font-semibold" />
                            <Button variant="default" size="icon" disabled={hasPendingSeatRequest}
                              onClick={() => setRenewalStepperInput(v => clampRenewalStepper(v + 1))} aria-label="Increase renewal seats">
                              <Plus className="h-4 w-4" />
                            </Button>
                            {/* v28 — Apply removed; the draft commits on Save changes. VIP keeps Request. */}
                            {isVip && (
                              <Button variant="default" className="ml-2" disabled={renewalRequestDisabled}
                                onClick={handleRequestRenewal}>
                                Request
                              </Button>
                            )}
                          </div>
                        </TooltipTrigger>
                        {hasPendingSeatRequest && (
                          <TooltipContent>A seat change request is already pending review. Our team will follow up with you.</TooltipContent>
                        )}
                        {!hasPendingSeatRequest && isFlooredBillingAdmin && (
                          <TooltipContent>As a Billing Admin, you can reduce down to the currently assigned count. An Account Owner can choose specific users to remove.</TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    {isVip && (
                      <p className="mt-2 text-xs text-muted-foreground text-center">
                        This account has custom pricing. Submitting this request will notify our team, and they'll follow up with you directly.
                      </p>
                    )}
                  </div>

                  {/* Decrease info note — non-VIP only; a VIP change isn't applied here, it's requested */}
                  {!isVip && showReductionNote && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Reducing renewal seat count. No refund issued for current cycle.
                      </AlertDescription>
                    </Alert>
                  )}

                  {!isVip && renewalDelta > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Renewal Order Summary</div>
                      <div className="flex justify-between text-sm">
                        <span>At-renewal seats</span>
                        <span className="font-medium">{renewalStepperInput}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Additional seats</span>
                        <span>+{renewalDelta}</span>
                      </div>
                      <div className="flex justify-between text-base font-semibold pt-1.5 border-t">
                        <span>New renewal total</span>
                        <span>{formatCurrency(renewalNewAnnualTotal)}/yr</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Full annual price, not prorated. Effective {renewalDateLabel} — no charge today.
                      </div>
                    </div>
                  )}
                  {!isVip && renewalDelta < 0 && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Renewal Order Summary</div>
                      <div className="flex justify-between text-sm">
                        <span>At-renewal seats</span>
                        <span className="font-medium">{renewalStepperInput}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Fewer seats</span>
                        <span>{renewalDelta}</span>
                      </div>
                      <div className="text-sm text-muted-foreground pt-1">
                        Annual cost drops by {formatCurrency(Math.abs(reduceDelta))}/year starting {renewalDateLabel}.
                      </div>
                    </div>
                  )}
                  {isVip && renewalDelta !== 0 && (
                    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                      {renewalDelta > 0
                        ? `Requesting +${renewalDelta} seat${renewalDelta === 1 ? '' : 's'} on ${liveProduct.name}, effective at renewal on ${renewalDateLabel}.`
                        : `Requesting to reduce seats by ${Math.abs(renewalDelta)} on ${liveProduct.name}, effective at renewal on ${renewalDateLabel}.`}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Only a Billing Admin or Account Owner can update seat counts.
                </p>
              )}
            </TabsContent>
          </Tabs>
          )}

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
                          {isPureBillingAdmin || noSeatsAvailable ? (
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
                                  {isPureBillingAdmin
                                    ? 'Only License Admin or Account Owner can assign or unassign licenses.'
                                    : 'All paid seats are assigned. Increase seats at renewal or add seats now to assign more users.'}
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
          {/* v28 — Save changes is the single commit action, gated on validity only. With
              added seats it hands off to the existing Pay flow. */}
          {pendingInvoice && (
            <div className="text-xs text-muted-foreground">Pending charge from added seats: {formatCurrency(pendingAmount)}</div>
          )}
          <div className="flex flex-row justify-end gap-2">
            <Button variant="outline" onClick={handleCancelClick}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveDisabled}>
              {pendingInvoice && !isVip ? `Save & pay ${formatCurrency(pendingAmount)}` : 'Save changes'}
            </Button>
          </div>
          {saveDisabled && (
            <div className="text-xs text-destructive text-right">{currentInvalidMessage}</div>
          )}
        </SheetFooter>

        {/* v26 — decrease overlay, single "Expire at renewal" mode (At Renewal tab only) */}
        <Dialog open={overlayOpen} onOpenChange={setOverlayOpen}>
          <DialogContent className="max-w-lg bg-amber-50 dark:bg-amber-950/30 border-primary">
            <DialogHeader>
              <DialogTitle>Reduce seats at renewal</DialogTitle>
              <DialogDescription className="text-sm">
                Select the {overlayRequired} user{overlayRequired === 1 ? '' : 's'} whose access will end at renewal on {renewalDateLabel}.
              </DialogDescription>
            </DialogHeader>

            <div className="border rounded-md overflow-hidden bg-background">
              <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
                <div>User</div>
                <div className="text-center w-28">Expire at renewal</div>
              </div>
              <div className="divide-y max-h-[240px] overflow-y-auto">
                {overlayUsers.map(rec => (
                  <div key={rec.user.id} className="grid grid-cols-[1fr_auto] gap-3 items-center px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {userInitials(rec.user)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{rec.user.firstName} {rec.user.lastName}</div>
                        <div className="text-xs text-muted-foreground truncate">{rec.user.email}</div>
                      </div>
                    </div>
                    <div className="text-center w-28">
                      <Checkbox checked={overlaySelected.has(rec.user.id)} onCheckedChange={() => toggleOverlayUser(rec.user.id)}
                        aria-label={`Expire ${rec.user.email} at renewal`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`text-sm font-medium ${overlayMatched ? 'text-success' : 'text-destructive'}`}>
              {overlaySelected.size} of {overlayRequired} required selections
            </div>
            <div className="text-xs text-muted-foreground">
              Selected users keep access through the current cycle — this takes effect on your renewal date.
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOverlayOpen(false)}>
                <ArrowLeft className="h-4 w-4 mr-1" />Back
              </Button>
              <Button onClick={handleOverlayConfirm} disabled={!overlayMatched}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Simple reduce confirmation (At Renewal tab, no users affected) */}
        <Dialog open={reduceConfirmOpen} onOpenChange={setReduceConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reduce renewal seat count?</DialogTitle>
              <DialogDescription>
                Reduce renewal seat count from {renewalCount} to {renewalStepperInput}? No users are affected.
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
  const { acceptQuote } = useApp();
  const { toast } = useToast();
  const [poNumber, setPoNumber] = useState('');

  useEffect(() => {
    if (open) {
      setPoNumber(quote?.poNumber || '');
    }
  }, [open, quote?.poNumber]);

  if (!quote) return null;

  const handleConfirm = () => {
    const result = acceptQuote(quote.id, { poNumber: poNumber || undefined });
    if (!result) {
      toast({ title: 'Unable to accept quote', description: 'This quote has expired.', variant: 'destructive' });
      return;
    }
    toast({ title: `Quote ${quote.quoteNumber} accepted.` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accept Quote - {quote.quoteNumber}</DialogTitle>
          <DialogDescription>
            Accepting will mark this quote as Accepted. Our team will follow up with the invoice and
            subscription setup separately.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="po">PO Number (optional)</Label>
          <Input
            id="po"
            className="mt-1.5"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="e.g. PO-2026-0421"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm}>Accept Quote</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
const QUOTE_DETAILS_STATUS_CLASS: Record<Quote['status'], string> = {
  requested: 'bg-warning/10 text-warning border-warning/30',
  active: 'bg-warning/10 text-warning border-warning/30',
  accepted: 'bg-success/10 text-success border-success/30',
  declined: 'text-muted-foreground border-muted-foreground/40',
  expired: 'bg-warning/10 text-warning border-warning/30',
};
const QUOTE_DETAILS_STATUS_LABEL: Record<Quote['status'], string> = {
  requested: 'Requested', active: 'Pending', accepted: 'Accepted', declined: 'Declined', expired: 'Expired',
};

export const QuoteDetailsDrawer = ({
  open, onOpenChange, quote, canAccept, onAccept, onDecline,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quote: Quote | null;
  canAccept: boolean;
  onAccept: (q: Quote) => void;
  onDecline: (q: Quote) => void;
}) => {
  const { currentUser } = useApp();
  const { toast } = useToast();
  if (!quote) return null;

  const tax = Math.round(quote.amount * 0.07 * 100) / 100;
  const total = Math.round((quote.amount + tax) * 100) / 100;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Quote Details</SheetTitle>
          <SheetDescription>View detailed information about the quote including line items and totals.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          <div className="border-b">
            <span className="inline-block border-b-2 border-primary pb-2 text-sm font-semibold text-primary">
              Quotation
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Quote Information</h4>
              <div className="text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Quote #:</span><span className="font-medium">{quote.quoteNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Title:</span><span className="font-medium">-</span></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className={QUOTE_DETAILS_STATUS_CLASS[quote.status]}>{QUOTE_DETAILS_STATUS_LABEL[quote.status]}</Badge>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created:</span><span className="font-medium">{new Date(quote.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expiry:</span><span className="font-medium">{new Date(quote.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Contact Information</h4>
              <div className="text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Contact:</span><span className="font-medium">{currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="font-medium">{currentUser?.email || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Site:</span><span className="font-medium">Main</span></div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Line Items</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.lineItems.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {l.productName}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-center">{l.licenseCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(l.unitPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(l.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4 space-y-1.5 text-sm border-t">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>{formatCurrency(quote.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax:</span><span>{formatCurrency(tax)}</span></div>
                <div className="flex justify-between font-semibold pt-1.5 border-t"><span>Total:</span><span>{formatCurrency(total)}</span></div>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            variant="outline"
            onClick={() => toast({ title: 'Print preview coming soon', description: quote.quoteNumber })}
          >
            <Printer className="h-4 w-4 mr-2" />Print Preview
          </Button>
          {quote.status === 'active' && canAccept && (
            <>
              <Button variant="destructive" onClick={() => onDecline(quote)}>Decline</Button>
              <Button onClick={() => onAccept(quote)}>
                <Check className="h-4 w-4 mr-2" />Accept
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

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
  const { createQuote, notify, getCompanySubscriptions } = useApp();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [reason, setReason] = useState<QuoteRequestReason | ''>('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [addrCityState, setAddrCityState] = useState('');
  const [addrPostal, setAddrPostal] = useState('');

  // DataNet auto-attaches to any purchased product, so it's only quote-able
  // while the company doesn't already have it.
  const alreadyHasDataNet = getCompanySubscriptions()
    .some(s => s.status === 'active' && s.products.some(p => p.name === 'DataNet'));
  const quotableProducts = PRODUCT_CATALOG.filter(p => p.name !== 'DataNet' || !alreadyHasDataNet);

  useEffect(() => {
    if (open) {
      setSelected({}); setNote(''); setContactNotes(''); setReason('');
      setAddr1(''); setAddr2(''); setAddrCityState(''); setAddrPostal('');
    }
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
    const contactAddress = [addr1, addr2, addrCityState, addrPostal]
      .map(s => s.trim()).filter(Boolean).join(', ');
    createQuote({
      lineItems,
      note: note.trim(),
      status: 'requested',
      requestReason: reason || undefined,
      contactNotes: contactNotes.trim() || undefined,
      contactAddress: contactAddress || undefined,
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
              {quotableProducts.map(p => {
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
            {Object.keys(selected).length > 0 && (
              <div className="flex items-center justify-between text-sm border-t pt-2">
                <span className="font-medium">
                  {Object.keys(selected).length} PRODUCT{Object.keys(selected).length === 1 ? '' : 'S'} SELECTED
                </span>
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {formatCurrency(Object.entries(selected).reduce((sum, [name, qty]) => {
                      const cat = PRODUCT_CATALOG.find(p => p.name === name);
                      const count = name === 'DataNet' ? 1 : qty;
                      return sum + (cat?.defaultPrice ?? 0) * count;
                    }, 0))}
                  </span> Estimated per year · Sales will confirm final pricing
                </span>
              </div>
            )}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="qrnote">Notes (optional)</Label>
              <Textarea
                id="qrnote"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                placeholder="Describe what product, license count, or change you are expecting."
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">{note.length}/500</p>
            </div>
            <div>
              <Label htmlFor="qr-contact-notes">Contact notes (Optional)</Label>
              <Textarea
                id="qr-contact-notes"
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value.slice(0, 500))}
                placeholder="Preferred contact time, timezone, etc."
                maxLength={500}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contact address (optional — falls back to your site address)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="Address Line 1" value={addr1} onChange={(e) => setAddr1(e.target.value)} />
              <Input placeholder="Address Line 2" value={addr2} onChange={(e) => setAddr2(e.target.value)} />
              <Input placeholder="City / State" value={addrCityState} onChange={(e) => setAddrCityState(e.target.value)} />
              <Input placeholder="Postal Code" value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} />
            </div>
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
