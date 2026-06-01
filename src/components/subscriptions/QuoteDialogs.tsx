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
  useApp, Subscription, SubscriptionProduct, Quote, PaymentMethod, QuoteRequestReason,
  PRODUCT_CATALOG, License, SavedPaymentMethod,
} from '@/contexts/AppContext';
import { calculateProratedAdd } from '@/lib/proration';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';
import { Plus, Minus, Info, ArrowUp, ArrowDown, ArrowLeft, RotateCcw, AlertCircle, CreditCard, Landmark } from 'lucide-react';

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
 * Manage Seats Drawer (Manage Licenses)
 * ========================================================== */
type RemovalChoice = 'remove_now' | 'expire_end_of_year';

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
    scheduleLicenseDecrease,
    getCompanyConfig,
    getAvailablePaymentMethods,
    getDeactivatedLicenses,
    reactivateLicense,
    licenses,
    users,
    can,
  } = useApp();
  const { toast } = useToast();

  // Manage Licenses drawer role gates (per discovery Q12):
  //   - Account Owner + Billing Admin: change counts, expire/renew toggle, reactivate.
  //   - License Admin: assign/unassign only.
  //   - Registered Contact: no entry point — defensive guard below.
  const canManageCounts = can('manage_seats_count');
  const canReactivate = can('reactivate_license');

  const purchased = product?.purchasedLicenseCount ?? product?.licenseCount ?? 0;
  const currentSeats = product?.licenseCount ?? 0;
  const perSeatCost = product?.pricePerLicense ?? 0;
  const assignedCount = subscription && product
    ? getAssignedLicenseCount(subscription.id, product.id)
    : 0;

  const cfg = getCompanyConfig(subscription?.companyId);
  const available = getAvailablePaymentMethods(subscription?.companyId);
  const defaultMethod: PaymentMethod = available.includes('pay_on_terms') ? 'pay_on_terms' : 'pay_on_receipt';

  // input: live stepper/typing value. newSeats: committed-via-Apply value (shown in summary).
  const [inputSeats, setInputSeats] = useState(currentSeats);
  const [newSeats, setNewSeats] = useState(currentSeats);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultMethod);

  // Decrease-below-assigned overlay state
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayConfirmed, setOverlayConfirmed] = useState(false);
  const [userChoices, setUserChoices] = useState<Record<string, RemovalChoice>>({});

  // Reactivation target — set when user clicks "Reactivate" on a previously-held license
  const [reactivateTarget, setReactivateTarget] = useState<{
    license: License;
    subscription: Subscription;
    product: SubscriptionProduct;
  } | null>(null);

  // Deactivated licenses scoped to THIS drawer's subscription + product (Q7).
  const deactivatedEntries = useMemo(() => {
    if (!subscription || !product) return [];
    return getDeactivatedLicenses(subscription.companyId).filter(e =>
      e.subscription.id === subscription.id && e.product.id === product.id
    );
  }, [getDeactivatedLicenses, subscription, product]);

  useEffect(() => {
    if (!open) return;
    setInputSeats(currentSeats);
    setNewSeats(currentSeats);
    setPaymentMethod(defaultMethod);
    setOverlayOpen(false);
    setOverlayConfirmed(false);
    setUserChoices({});
  }, [open, currentSeats, product?.id, defaultMethod]);

  // Currently-assigned users for this product (used for overlay + assigned-users list).
  const assignedUsers = useMemoAssignedUsers(licenses, users, subscription?.id, product?.id);

  // Show every active company user in the drawer's user list — badge reflects current license state.
  const companyUsersForList = useMemoCompanyUsers(users, subscription?.companyId);
  const assignedUserIdSet = new Set(assignedUsers.map(u => u.id));

  const delta = newSeats - currentSeats;
  const priceChangeYear = delta * perSeatCost;
  const reductionCount = Math.max(0, assignedCount - newSeats);
  const decreaseBelowAssigned = newSeats < assignedCount;

  // Apply is disabled when the input equals current seats (nothing to apply).
  const applyDisabled = inputSeats === currentSeats || inputSeats < purchased;

  const selectedCount = Object.keys(userChoices).length;
  const overlayMatched = selectedCount === reductionCount;

  const handleApply = () => {
    if (applyDisabled) return;
    const next = Math.max(purchased, inputSeats);
    setNewSeats(next);
    setOverlayConfirmed(false);
    if (next < assignedCount) {
      // Reset choices for a fresh overlay session
      setUserChoices({});
      setOverlayOpen(true);
    }
  };

  const toggleChoice = (userId: string, choice: RemovalChoice) => {
    setUserChoices(prev => {
      const next = { ...prev };
      if (next[userId] === choice) delete next[userId];
      else next[userId] = choice;
      return next;
    });
  };

  const handleOverlayConfirm = () => {
    if (!overlayMatched) return;
    setOverlayOpen(false);
    setOverlayConfirmed(true);
  };

  const handleOverlayBack = () => {
    setOverlayOpen(false);
    // overlayConfirmed remains false → Save stays disabled.
    // newSeats and inputSeats remain at the attempted value so user can re-Apply.
  };

  const handleSaveIncrease = () => {
    if (!subscription || !product) return;
    requestLicenseChange(subscription.id, product.id, newSeats, paymentMethod);
    if (paymentMethod === 'pay_immediately') {
      toast({ title: 'Payment successful', description: 'Paid license count updated.' });
      onOpenChange(false);
      return;
    }
    if (paymentMethod === 'pay_on_terms') {
      toast({ title: 'Paid license count updated under approved payment terms.' });
      onOpenChange(false);
      return;
    }
    toast({
      title: 'Invoice generated for license change',
      description: 'Pay your invoice to apply the change to your paid licenses.',
    });
    onOpenChange(false);
    navigate('/invoices');
  };

  const handleSaveDecrease = () => {
    if (!subscription || !product) return;
    const removeNowIds = Object.entries(userChoices)
      .filter(([, c]) => c === 'remove_now')
      .map(([uid]) => uid);
    const expireIds = Object.entries(userChoices)
      .filter(([, c]) => c === 'expire_end_of_year')
      .map(([uid]) => uid);
    scheduleLicenseDecrease(subscription.id, product.id, newSeats, removeNowIds, expireIds);
    const effDate = new Date(subscription.renewalDate).toLocaleDateString();
    toast({
      title: 'Paid license reduction scheduled',
      description: `Changes take effect on ${effDate}. Selected users were updated.`,
    });
    onOpenChange(false);
  };

  const handleSave = () => {
    if (!subscription || !product) return;
    if (delta === 0) return;
    if (delta > 0) {
      handleSaveIncrease();
      return;
    }
    if (newSeats >= assignedCount) {
      // Decrease but no overlay required — schedule with no user picks.
      scheduleLicenseDecrease(subscription.id, product.id, newSeats, [], []);
      const effDate = new Date(subscription.renewalDate).toLocaleDateString();
      toast({
        title: 'Paid license reduction scheduled',
        description: `Changes take effect on ${effDate}.`,
      });
      onOpenChange(false);
      return;
    }
    handleSaveDecrease();
  };

  const requiresPayment = delta > 0;
  const saveDisabled =
    delta === 0 ||
    inputSeats !== newSeats ||  // user changed input again after Apply but hasn't re-applied
    (decreaseBelowAssigned && !overlayConfirmed);

  // Summary deltas
  const seatDeltaLabel =
    delta > 0 ? `+${delta} seats` :
    delta < 0 ? `${delta} seats` :
    '+0 seats';
  const priceChangeLabel =
    priceChangeYear === 0 ? '$0.00/year' :
    `${priceChangeYear > 0 ? '+' : '−'}${formatCurrency(Math.abs(priceChangeYear))}/year`;

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
          <div className="p-6 space-y-5">
            <SheetHeader className="space-y-1">
              <SheetTitle className="text-xl">Manage seats</SheetTitle>
              <SheetDescription>
                <span className="font-normal">{product.name}</span>{' '}
                <span className="text-muted-foreground">· {subscription.planType}</span>
              </SheetDescription>
            </SheetHeader>

            {/* Purple summary card — uses canonical labels per discovery Q9 */}
            <div className="rounded-lg bg-primary text-primary-foreground p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="opacity-90">Current paid licenses</span>
                <span className="font-semibold">{currentSeats}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="opacity-90">Paid licenses at next renewal</span>
                <span className="font-semibold">{newSeats}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="opacity-90">Currently assigned</span>
                <span className="font-semibold">{assignedCount}</span>
              </div>
              <div className="border-t border-primary-foreground/20 my-2" />
              <div className="flex items-center justify-between">
                <span className="opacity-90">Change</span>
                <span className="font-semibold inline-flex items-center gap-1">
                  {delta > 0 && <ArrowUp className="h-3.5 w-3.5" />}
                  {delta < 0 && <ArrowDown className="h-3.5 w-3.5" />}
                  {seatDeltaLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="opacity-90">Price change</span>
                <span className="font-semibold">{priceChangeLabel}</span>
              </div>
              <div className="text-xs opacity-80 pt-1">
                per seat cost +{formatCurrency(perSeatCost)}/year
              </div>
            </div>

            {/* Seat editor — Q12: only AO + BA can change paid license counts */}
            {canManageCounts ? (
              <div>
                <div className="text-center text-sm font-medium mb-2">Update paid licenses at next renewal</div>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={inputSeats <= purchased}
                    onClick={() => setInputSeats(s => Math.max(purchased, s - 1))}
                    aria-label="Decrease paid licenses"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={purchased}
                    value={inputSeats}
                    onChange={(e) => setInputSeats(Math.max(purchased, parseInt(e.target.value) || purchased))}
                    className="w-20 text-center text-lg font-semibold"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setInputSeats(s => s + 1)}
                    aria-label="Increase paid licenses"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleApply}
                    disabled={applyDisabled}
                    className={applyDisabled ? 'bg-success/40 hover:bg-success/40 text-white' : 'bg-success hover:bg-success/90 text-white'}
                  >
                    Apply
                  </Button>
                </div>
                {inputSeats <= purchased && inputSeats < currentSeats && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Paid licenses at next renewal cannot be lower than the purchased license count ({purchased}).
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                Changing the paid license count requires Account Owner or Billing Admin. You can still assign or unassign users in existing seats below.
              </div>
            )}

            {/* Payment method picker — only on an applied increase */}
            {requiresPayment && (
              <div>
                <Label className="text-sm">Payment Method</Label>
                <div className="mt-2">
                  <PaymentMethodPicker
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    available={available}
                    terms={cfg.terms}
                  />
                </div>
              </div>
            )}

            {/* Previously held licenses — Q7. Visible only to AO + BA (Q6) and scoped
                 to the drawer's subscription/product. */}
            {canReactivate && (
              <section className="border-t pt-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-sm font-semibold">Previously held licenses</h3>
                  <p className="text-xs text-muted-foreground text-right max-w-xs">
                    Reactivate to add a seat back. You'll be charged a prorated maintenance fee for the remainder of the current year. The license itself is already owned.
                  </p>
                </div>
                {deactivatedEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No previously held licenses available to reactivate for {product.name}.</p>
                ) : (
                  <ul className="space-y-2">
                    {deactivatedEntries.map(entry => {
                      const key = `${entry.license.subscriptionId}-${entry.license.productId}-${entry.license.assignedAt}`;
                      return (
                        <li key={key} className="flex items-center justify-between p-3 rounded-md border bg-muted/30 gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{entry.product.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Assigned {new Date(entry.license.assignedAt).toLocaleDateString()} · Deactivated {entry.license.deactivatedAt ? new Date(entry.license.deactivatedAt).toLocaleDateString() : '—'}
                              {entry.license.deactivatedReason && (
                                <span className="block truncate">{entry.license.deactivatedReason}</span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReactivateTarget(entry)}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />Reactivate
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {/* Assigned users list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Assigned users</span>
                <span className="text-xs text-muted-foreground">
                  {assignedCount} of {newSeats} paid licenses assigned
                </span>
              </div>
              <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
                {companyUsersForList.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">No users in this company.</div>
                ) : (
                  companyUsersForList.map(u => {
                    const isAssigned = assignedUserIdSet.has(u.id);
                    const initials = `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || u.email[0].toUpperCase();
                    return (
                      <div key={u.id} className="flex items-center gap-3 p-2.5">
                        <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[11px] font-semibold shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{u.firstName} {u.lastName}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                        </div>
                        <Badge variant="outline" className={isAssigned
                          ? 'bg-success/10 text-success border-success/30'
                          : 'text-muted-foreground border-muted-foreground/30'}>
                          {isAssigned ? 'Assigned' : 'Unassigned'}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <SheetFooter className="gap-2 px-6 pb-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveDisabled}>Save changes</Button>
          </SheetFooter>

          {/* Reactivation dialog (Q7) — fires from "Previously held licenses" section */}
          <ReactivateLicenseDialog
            target={reactivateTarget}
            onOpenChange={(open) => !open && setReactivateTarget(null)}
          />

          {/* Decrease-below-assigned overlay */}
          {overlayOpen && (
            <div
              className={`absolute inset-0 z-10 overflow-y-auto p-6 ${overlayMatched ? 'bg-success/10' : 'bg-destructive/5'}`}
            >
              <div className="rounded-lg bg-card border shadow-md p-4 space-y-4">
                <div>
                  <h3 className="text-base font-semibold mb-1">Choose users to remove</h3>
                  <p className="text-sm text-muted-foreground">
                    The paid licenses you have already paid for will last through the year. Please select the{' '}
                    <span className="font-semibold text-foreground">{reductionCount}</span> users you would
                    like to remove now or at the end of the year.
                  </p>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 bg-muted/40 text-xs font-medium">
                    <div>User</div>
                    <div className="text-center w-24">Remove now</div>
                    <div className="text-center w-32">Expire end of year</div>
                  </div>
                  <div className="divide-y max-h-64 overflow-y-auto">
                    {assignedUsers.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground text-center">No assigned users.</div>
                    ) : (
                      assignedUsers.map(u => {
                        const choice = userChoices[u.id];
                        return (
                          <div key={u.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{u.firstName} {u.lastName}</div>
                              <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                            </div>
                            <div className="text-center w-24">
                              <Checkbox
                                checked={choice === 'remove_now'}
                                onCheckedChange={() => toggleChoice(u.id, 'remove_now')}
                                aria-label={`Remove ${u.email} now`}
                              />
                            </div>
                            <div className="text-center w-32">
                              <Checkbox
                                checked={choice === 'expire_end_of_year'}
                                onCheckedChange={() => toggleChoice(u.id, 'expire_end_of_year')}
                                aria-label={`Expire ${u.email} end of year`}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className={`text-sm font-medium ${overlayMatched ? 'text-success' : 'text-destructive'}`}>
                  {selectedCount} of {reductionCount} required removals selected
                </div>

                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="outline" onClick={handleOverlayBack}>
                    <ArrowLeft className="h-4 w-4 mr-1" />Back
                  </Button>
                  <Button onClick={handleOverlayConfirm} disabled={!overlayMatched}>
                    Confirm
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
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
