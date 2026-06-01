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
  useApp, Subscription, SubscriptionProduct, Quote, PaymentMethod, QuoteRequestReason,
  PRODUCT_CATALOG, License, SavedPaymentMethod,
} from '@/contexts/AppContext';
import { calculateProratedAdd } from '@/lib/proration';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';
import { Plus, Minus, Info, ArrowLeft, RotateCcw, AlertCircle, CreditCard, Landmark, UserPlus, UserMinus, Search, Check } from 'lucide-react';

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
 * Manage Licenses Drawer (v14 rework — Section C)
 *
 * Two count fields:
 *   • "Current paid licenses"        → increase = add seats now (payment). Decrease
 *                                       down to the assigned count releases empty seats.
 *   • "Paid licenses at next renewal" → decrease below the assigned count triggers the
 *                                       per-user removal prompt (remove now / end of cycle).
 * Plus inline assign/unassign, available-seat pickers, and a "Previously held
 * licenses" section that renders ONLY when deactivated licenses exist.
 * ========================================================== */
type RemovalWhen = 'remove_now' | 'expire_end_of_cycle';

// Hoisted to module scope so the number inputs don't remount (and lose focus)
// on every parent re-render.
const SeatStepper = ({
  label, value, onChange, min, disabled,
}: { label: string; value: number; onChange: (n: number) => void; min: number; disabled?: boolean }) => (
  <div className="flex-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="mt-1 flex items-center gap-1.5">
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Decrease ${label}`}>
        <Minus className="h-4 w-4" />
      </Button>
      <Input type="number" min={min} value={value} disabled={disabled}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || min))}
        className="h-9 text-center font-semibold" />
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={disabled}
        onClick={() => onChange(value + 1)} aria-label={`Increase ${label}`}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

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
    getAssignedLicenseCount,
    requestLicenseChange,
    applyLicenseReduction,
    getCompanyConfig,
    getAvailablePaymentMethods,
    getDeactivatedLicenses,
    getCatalogProduct,
    useLegacyProration,
    assignLicense,
    unassignLicense,
    licenses,
    users,
    can,
  } = useApp();
  const { toast } = useToast();

  // Role gates (per discovery Q12):
  //   - Account Owner + Billing Admin: change counts + reactivate.
  //   - License Admin: assign/unassign only (count fields disabled).
  const canManageCounts = can('manage_seats_count');
  const canReactivate = can('reactivate_license');
  const canAssign = can('manage_user_assignment');

  const currentSeats = product?.licenseCount ?? 0;
  const scheduledRenewalSeats = product?.scheduledLicenseCount ?? currentSeats;
  const assignedCount = subscription && product
    ? getAssignedLicenseCount(subscription.id, product.id)
    : 0;

  const cfg = getCompanyConfig(subscription?.companyId);
  const available = getAvailablePaymentMethods(subscription?.companyId);
  const defaultMethod: PaymentMethod = available.includes('pay_on_terms') ? 'pay_on_terms' : 'pay_on_receipt';

  const [currentInput, setCurrentInput] = useState(currentSeats);
  const [renewalInput, setRenewalInput] = useState(scheduledRenewalSeats);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultMethod);

  // Per-user removal prompt overlay state
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [choices, setChoices] = useState<Record<string, RemovalWhen>>({});

  // Reactivation target
  const [reactivateTarget, setReactivateTarget] = useState<{
    license: License;
    subscription: Subscription;
    product: SubscriptionProduct;
  } | null>(null);

  // Inline "assign user" picker
  const [assignSearch, setAssignSearch] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);

  const deactivatedEntries = useMemo(() => {
    if (!subscription || !product) return [];
    return getDeactivatedLicenses(subscription.companyId).filter(e =>
      e.subscription.id === subscription.id && e.product.id === product.id
    );
  }, [getDeactivatedLicenses, subscription, product]);

  useEffect(() => {
    if (!open) return;
    setCurrentInput(currentSeats);
    setRenewalInput(scheduledRenewalSeats);
    setPaymentMethod(defaultMethod);
    setOverlayOpen(false);
    setChoices({});
    setAssignSearch('');
    setAssignOpen(false);
  }, [open, currentSeats, scheduledRenewalSeats, product?.id, defaultMethod]);

  const assignedUsers = useMemoAssignedUsers(licenses, users, subscription?.id, product?.id);
  const companyUsers = useMemoCompanyUsers(users, subscription?.companyId);
  const assignedUserIdSet = new Set(assignedUsers.map(u => u.id));
  const assignableUsers = companyUsers.filter(u => !assignedUserIdSet.has(u.id));
  const filteredAssignable = assignSearch.trim()
    ? assignableUsers.filter(u =>
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(assignSearch.trim().toLowerCase()))
    : assignableUsers;

  const emptySlots = Math.max(0, currentSeats - assignedCount);

  // --- Pricing preview (catalog license/maintenance model) ---
  const isIncrease = currentInput > currentSeats;
  const addSeats = Math.max(0, currentInput - currentSeats);
  const isReduction = renewalInput < currentSeats || currentInput < currentSeats;
  const catalog = product ? getCatalogProduct(product.name) : undefined;
  const proration = useMemo(() => {
    if (!isIncrease || !subscription || !product) return null;
    return calculateProratedAdd({
      product: {
        pricePerSeatPerYear: catalog?.pricePerSeatPerYear ?? product.pricePerLicense,
        maintenancePerSeatPerYear: catalog?.maintenancePerSeatPerYear ?? 0,
      },
      seats: addSeats,
      addDate: new Date(),
      renewalDate: new Date(subscription.renewalDate),
      useLegacyProration,
    });
  }, [isIncrease, addSeats, catalog, subscription, product, useLegacyProration]);

  // Reduction prompt: how many assigned users can't keep a renewal-time seat.
  const renewalExcess = Math.max(0, assignedCount - renewalInput);
  const needsPrompt = renewalExcess > 0;
  const selectedCount = Object.keys(choices).length;
  const promptMatched = selectedCount === renewalExcess;

  const toggleChoice = (userId: string, when: RemovalWhen) => {
    setChoices(prev => {
      const next = { ...prev };
      if (next[userId] === when) delete next[userId];
      else next[userId] = when;
      return next;
    });
  };

  const handleAssign = (userId: string) => {
    if (!subscription || !product) return;
    const ok = assignLicense(userId, subscription.id, product.id);
    if (ok) {
      const u = users.find(x => x.id === userId);
      toast({ title: 'User assigned', description: `${u?.firstName} ${u?.lastName} now has a ${product.name} license.` });
      setAssignOpen(false);
      setAssignSearch('');
    } else {
      toast({ title: 'No available seats', description: 'Increase the paid license count first.', variant: 'destructive' });
    }
  };

  const handleUnassign = (userId: string) => {
    if (!subscription || !product) return;
    unassignLicense(userId, subscription.id, product.id);
    const u = users.find(x => x.id === userId);
    toast({
      title: `Unassigned ${u?.firstName} ${u?.lastName} from ${product.name}`,
      description: 'License remains paid — assign it to someone else.',
    });
  };

  const handleApply = () => {
    if (!subscription || !product) return;

    // 1) Increase current paid licenses → payment flow.
    if (isIncrease) {
      const result = requestLicenseChange(subscription.id, product.id, currentInput, paymentMethod);
      void result;
      if (paymentMethod === 'pay_immediately') {
        toast({ title: 'Payment successful', description: `Added ${addSeats} ${product.name} seat(s).` });
        onOpenChange(false);
      } else if (paymentMethod === 'pay_on_terms') {
        toast({ title: 'Seats added under approved payment terms.' });
        onOpenChange(false);
      } else {
        toast({ title: 'Invoice generated for license change', description: 'Pay your invoice to apply the new seats.' });
        onOpenChange(false);
        navigate('/invoices');
      }
      return;
    }

    // 2) Reduction below assigned → open per-user removal prompt.
    if (needsPrompt) {
      setChoices({});
      setOverlayOpen(true);
      return;
    }

    // 3) Plain reduction with no assigned users affected (release empty seats).
    const newCurrent = Math.min(currentInput, currentSeats);
    const newRenewal = Math.min(renewalInput, newCurrent);
    if (newCurrent === currentSeats && newRenewal === scheduledRenewalSeats) return; // nothing to do
    applyLicenseReduction({
      subscriptionId: subscription.id,
      productId: product.id,
      newCurrentCount: newCurrent,
      newRenewalCount: newRenewal,
      removeNowUserIds: [],
      expireEndOfCycleUserIds: [],
    });
    toast({ title: 'Paid licenses updated', description: 'No refund is issued for released seats.' });
    onOpenChange(false);
  };

  const handlePromptApply = () => {
    if (!subscription || !product || !promptMatched) return;
    const removeNowIds = Object.entries(choices).filter(([, w]) => w === 'remove_now').map(([uid]) => uid);
    const expireIds = Object.entries(choices).filter(([, w]) => w === 'expire_end_of_cycle').map(([uid]) => uid);
    const newCurrent = Math.max(0, currentSeats - removeNowIds.length);
    const newRenewal = renewalInput;
    applyLicenseReduction({
      subscriptionId: subscription.id,
      productId: product.id,
      newCurrentCount: newCurrent,
      newRenewalCount: newRenewal,
      removeNowUserIds: removeNowIds,
      expireEndOfCycleUserIds: expireIds,
    });
    toast({
      title: 'Licenses reduced',
      description: `${removeNowIds.length} user(s) removed now, ${expireIds.length} will expire at renewal.`,
    });
    onOpenChange(false);
  };

  const hasPendingChange = isIncrease || isReduction;

  if (!subscription || !product) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="relative">
          <div className="p-5 space-y-5">
            <SheetHeader className="space-y-1">
              <SheetTitle className="text-lg">{product.name}</SheetTitle>
              <SheetDescription>Manage Licenses · {subscription.planType}</SheetDescription>
            </SheetHeader>

            {/* Counts */}
            <div>
              <div className="flex items-center gap-3">
                <SeatStepper label="Current paid licenses" value={currentInput} min={assignedCount}
                  onChange={setCurrentInput} disabled={!canManageCounts} />
                <SeatStepper label="Paid licenses at next renewal" value={renewalInput} min={0}
                  onChange={setRenewalInput} disabled={!canManageCounts} />
              </div>
              {!canManageCounts && (
                <p className="text-xs text-muted-foreground mt-2">
                  Changing the paid license count requires Account Owner or Billing Admin. You can still assign or unassign users below.
                </p>
              )}
            </div>

            {/* Pricing preview */}
            {canManageCounts && hasPendingChange && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1.5">
                {isIncrease && proration ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Adding seats</span><span>{addSeats}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">License charge</span><span>{formatCurrency(proration.licenseCharge)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Prorated maintenance ({proration.daysRemaining}/365 days)</span><span>{formatCurrency(proration.maintenanceChargeProrated)}</span></div>
                    <div className="flex justify-between border-t pt-1.5 font-semibold"><span>Charge today</span><span>{formatCurrency(proration.totalCharge)}</span></div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Refund for reduced seats</span>
                    <span className="font-semibold">$0.00 — no refund issued</span>
                  </div>
                )}
              </div>
            )}

            {/* Payment method — only on increase */}
            {canManageCounts && isIncrease && (
              <div>
                <Label className="text-sm">Payment Method</Label>
                <div className="mt-2">
                  <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} available={available} terms={cfg.terms} />
                </div>
              </div>
            )}

            {canManageCounts && hasPendingChange && (
              <Button className="w-full" onClick={handleApply}>
                {isIncrease ? 'Review & apply increase' : 'Apply changes'}
              </Button>
            )}

            {/* Assigned users */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Assigned users</span>
                <span className="text-xs text-muted-foreground">{assignedCount} of {currentSeats} seats</span>
              </div>
              <div className="border rounded-md divide-y">
                {assignedUsers.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">No users assigned yet.</div>
                ) : (
                  assignedUsers.map(u => {
                    const initials = `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || u.email[0].toUpperCase();
                    return (
                      <div key={u.id} className="flex items-center gap-3 p-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">{initials}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{u.firstName} {u.lastName}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                        </div>
                        {canAssign && (
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive h-8"
                            onClick={() => handleUnassign(u.id)}>
                            <UserMinus className="h-3.5 w-3.5 mr-1" />Remove
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Available (empty) seats */}
                {emptySlots > 0 && canAssign && (
                  <div className="p-2.5 flex items-center justify-between bg-muted/20">
                    <span className="text-xs text-muted-foreground">{emptySlots} available seat{emptySlots > 1 ? 's' : ''}</span>
                    <Popover open={assignOpen} onOpenChange={(o) => { setAssignOpen(o); if (!o) setAssignSearch(''); }}>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8"><UserPlus className="h-3.5 w-3.5 mr-1" />Assign user</Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-72 p-0">
                        <div className="p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)}
                              placeholder="Search users…" className="h-8 pl-7 text-sm" autoFocus />
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto py-1">
                          {filteredAssignable.length === 0 ? (
                            <div className="px-3 py-4 text-xs text-muted-foreground text-center">No users available to assign.</div>
                          ) : filteredAssignable.map(u => (
                            <button key={u.id} type="button" onClick={() => handleAssign(u.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/60">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm truncate">{u.firstName} {u.lastName}</div>
                                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                              </div>
                              <Check className="h-3.5 w-3.5 text-muted-foreground opacity-0" />
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </div>

            {/* Previously held licenses — render ONLY when entries exist (Section C6) */}
            {canReactivate && deactivatedEntries.length > 0 && (
              <section className="border-t pt-4">
                <h3 className="text-sm font-semibold">Previously held licenses</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Reactivate to add a seat back. You'll be charged a prorated maintenance fee for the remainder of this year.
                </p>
                <ul className="space-y-2">
                  {deactivatedEntries.map((entry, idx) => {
                    const key = `${entry.license.subscriptionId}-${entry.license.productId}-${entry.license.assignedAt}-${idx}`;
                    return (
                      <li key={key} className="flex items-center justify-between p-3 rounded-md border bg-muted/30 gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{entry.product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Deactivated {entry.license.deactivatedAt ? new Date(entry.license.deactivatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            {entry.license.deactivatedReason && <span> · {entry.license.deactivatedReason}</span>}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setReactivateTarget(entry)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />Reactivate
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>

          <SheetFooter className="gap-2 px-5 pb-5">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </SheetFooter>

          <ReactivateLicenseDialog
            target={reactivateTarget}
            onOpenChange={(o) => !o && setReactivateTarget(null)}
          />
        </div>

        {/* Per-user removal prompt */}
        <Dialog open={overlayOpen} onOpenChange={setOverlayOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Reduce licenses</DialogTitle>
              <DialogDescription>
                You're reducing licenses at renewal to {renewalInput}. You currently have {assignedCount} users assigned.
                Choose what to do with the {renewalExcess} excess user{renewalExcess > 1 ? 's' : ''}.
              </DialogDescription>
            </DialogHeader>

            <div className="border rounded-md overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 bg-muted/40 text-xs font-medium">
                <div>User</div>
                <div className="text-center w-24">Remove now</div>
                <div className="text-center w-32">Remove at end of cycle</div>
              </div>
              <div className="divide-y max-h-72 overflow-y-auto">
                {assignedUsers.map(u => {
                  const when = choices[u.id];
                  return (
                    <div key={u.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <div className="text-center w-24">
                        <Checkbox checked={when === 'remove_now'} onCheckedChange={() => toggleChoice(u.id, 'remove_now')}
                          aria-label={`Remove ${u.email} now`} />
                      </div>
                      <div className="text-center w-32">
                        <Checkbox checked={when === 'expire_end_of_cycle'} onCheckedChange={() => toggleChoice(u.id, 'expire_end_of_cycle')}
                          aria-label={`Remove ${u.email} at end of cycle`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`text-sm font-medium ${promptMatched ? 'text-success' : 'text-destructive'}`}>
              {selectedCount} of {renewalExcess} required selections made. The rest keep their license.
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOverlayOpen(false)}>
                <ArrowLeft className="h-4 w-4 mr-1" />Cancel
              </Button>
              <Button onClick={handlePromptApply} disabled={!promptMatched}>Apply Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
