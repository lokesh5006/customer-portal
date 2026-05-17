import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Landmark, Plus, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SavedPaymentMethod, useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const cardBrandColor = (brand?: string): string => {
  switch (brand) {
    case 'Visa': return 'text-blue-600 dark:text-blue-300';
    case 'Mastercard': return 'text-red-600 dark:text-red-300';
    case 'Amex':
    case 'Discover':
    default:
      return 'text-primary';
  }
};

const deriveBrandFromNumber = (num: string): SavedPaymentMethod['cardBrand'] => {
  const first = num.charAt(0);
  if (first === '4') return 'Visa';
  if (first === '5') return 'Mastercard';
  if (first === '3') return 'Amex';
  if (first === '6') return 'Discover';
  return 'Visa';
};

type MethodType = 'card' | 'ach';

export function PaymentTab() {
  const {
    currentUser,
    currentCompany,
    getCompanyPaymentMethods,
    addPaymentMethod,
    removePaymentMethod,
    setPrimaryPaymentMethod,
    setAutoRenewal,
  } = useApp();
  const { toast } = useToast();

  const all = getCompanyPaymentMethods();
  const cards = all.filter(m => m.type === 'card');
  const banks = all.filter(m => m.type === 'ach');

  const defaultTab: MethodType = banks.length > cards.length ? 'ach' : 'card';
  const [activeMethodTab, setActiveMethodTab] = useState<MethodType>(defaultTab);

  // Card form
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardPrimary, setCardPrimary] = useState(cards.length === 0);

  // Bank form
  const [bankHolder, setBankHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankRouting, setBankRouting] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankPrimary, setBankPrimary] = useState(banks.length === 0);

  // Keep "primary" checkbox auto-forced when the list is empty.
  useEffect(() => { if (cards.length === 0) setCardPrimary(true); }, [cards.length]);
  useEffect(() => { if (banks.length === 0) setBankPrimary(true); }, [banks.length]);

  const autoRenewal = currentCompany?.autoRenewal ?? true;

  const handleAutoRenewalToggle = (checked: boolean) => {
    if (!currentCompany) return;
    setAutoRenewal(currentCompany.id, checked);
    toast({ title: `Auto renewal ${checked ? 'enabled' : 'disabled'}.` });
  };

  const resetCardForm = () => {
    setCardName(''); setCardNumber(''); setCardMonth(''); setCardYear(''); setCardCvv('');
    setCardPrimary(cards.length === 0);
  };
  const resetBankForm = () => {
    setBankHolder(''); setBankName(''); setBankRouting(''); setBankAccount('');
    setBankPrimary(banks.length === 0);
  };

  const submitCard = () => {
    if (!cardName.trim() || cardNumber.trim().length < 4 || !cardMonth || !cardYear || cardCvv.length < 3) {
      toast({ title: 'Please complete all card fields', variant: 'destructive' });
      return;
    }
    const month = parseInt(cardMonth, 10);
    const year = 2000 + parseInt(cardYear, 10);
    if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year)) {
      toast({ title: 'Invalid expiration date', variant: 'destructive' });
      return;
    }
    if (!currentUser || !currentCompany) return;
    addPaymentMethod({
      userId: currentUser.id,
      companyId: currentCompany.id,
      type: 'card',
      cardBrand: deriveBrandFromNumber(cardNumber),
      cardLast4: cardNumber.slice(-4),
      cardExpMonth: month,
      cardExpYear: year,
      holderName: cardName.trim(),
      isPrimary: cards.length === 0 ? true : cardPrimary,
    });
    toast({ title: 'Card added' });
    resetCardForm();
  };

  const submitBank = () => {
    if (!bankHolder.trim() || !bankName.trim() || !/^\d{9}$/.test(bankRouting) || bankAccount.trim().length < 4) {
      toast({ title: 'Please complete all bank fields', variant: 'destructive' });
      return;
    }
    if (!currentUser || !currentCompany) return;
    addPaymentMethod({
      userId: currentUser.id,
      companyId: currentCompany.id,
      type: 'ach',
      bankName: bankName.trim(),
      accountLast4: bankAccount.slice(-4),
      routingLast4: bankRouting.slice(-4),
      holderName: bankHolder.trim(),
      isPrimary: banks.length === 0 ? true : bankPrimary,
    });
    toast({ title: 'Bank account added' });
    resetBankForm();
  };

  const handleRemove = (m: SavedPaymentMethod) => {
    const sameTypeCount = all.filter(x => x.type === m.type).length;
    if (sameTypeCount <= 1) {
      toast({ title: 'Cannot remove your only payment method of this type.', variant: 'destructive' });
      return;
    }
    removePaymentMethod(m.id);
    toast({ title: 'Removed' });
  };

  const handleMakePrimary = (m: SavedPaymentMethod) => {
    setPrimaryPaymentMethod(m.id);
    toast({ title: m.type === 'card' ? 'Primary card updated' : 'Primary bank updated' });
  };

  const cardList = useMemo(() => cards.slice().sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)), [cards]);
  const bankList = useMemo(() => banks.slice().sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)), [banks]);

  return (
    <div className="space-y-6 pb-6">
      {/* Auto Renewal */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Auto Renewal</h3>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-sm font-medium">Auto Renewal</p>
            <p className="text-xs text-muted-foreground">Automatically renew your subscription</p>
          </div>
          <Switch
            checked={autoRenewal}
            onCheckedChange={handleAutoRenewalToggle}
            aria-label="Toggle auto renewal"
          />
        </div>
      </section>

      {/* Method type tabs */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Payment Methods</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={activeMethodTab === 'card' ? 'default' : 'outline'}
            onClick={() => setActiveMethodTab('card')}
            className="h-10"
          >
            <CreditCard className="h-4 w-4 mr-2" />Pay by Card
          </Button>
          <Button
            type="button"
            variant={activeMethodTab === 'ach' ? 'default' : 'outline'}
            onClick={() => setActiveMethodTab('ach')}
            className="h-10"
          >
            <Landmark className="h-4 w-4 mr-2" />ACH
          </Button>
        </div>
      </section>

      {/* Saved methods + Add form */}
      {activeMethodTab === 'card' ? (
        <section className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Saved Cards</h4>
            {cardList.length === 0 ? (
              <div className="border-2 border-dashed rounded-md p-6 text-center">
                <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No saved cards yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cardList.map(m => (
                  <div key={m.id} className="flex items-center gap-3 border rounded-md p-3">
                    <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <CreditCard className={cn('h-5 w-5', cardBrandColor(m.cardBrand))} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{m.cardBrand} ending in {m.cardLast4}</div>
                      <div className="text-xs text-muted-foreground">
                        Expires {String(m.cardExpMonth).padStart(2, '0')}/{String((m.cardExpYear || 0) % 100).padStart(2, '0')}
                      </div>
                    </div>
                    {m.isPrimary ? (
                      <Badge variant="outline" className="status-active">
                        <Star className="h-3 w-3 mr-1" />Primary
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary"
                        onClick={() => handleMakePrimary(m)}
                      >
                        Make Primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemove(m)}
                      aria-label="Remove card"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new card */}
          <div className="rounded-md border border-border p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4" />Add New Card
            </h4>
            <div className="space-y-2">
              <Label htmlFor="new-card-name">Cardholder Name</Label>
              <Input
                id="new-card-name"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-card-number">Card Number</Label>
              <Input
                id="new-card-number"
                inputMode="numeric"
                maxLength={16}
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="4242 4242 4242 4242"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-card-month">MM</Label>
                <Input
                  id="new-card-month"
                  inputMode="numeric"
                  maxLength={2}
                  value={cardMonth}
                  onChange={(e) => setCardMonth(e.target.value.replace(/\D/g, ''))}
                  placeholder="12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-card-year">YY</Label>
                <Input
                  id="new-card-year"
                  inputMode="numeric"
                  maxLength={2}
                  value={cardYear}
                  onChange={(e) => setCardYear(e.target.value.replace(/\D/g, ''))}
                  placeholder="26"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-card-cvv">CVV</Label>
                <Input
                  id="new-card-cvv"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  placeholder="•••"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="new-card-primary"
                checked={cardPrimary || cards.length === 0}
                disabled={cards.length === 0}
                onCheckedChange={(v) => setCardPrimary(!!v)}
              />
              <Label htmlFor="new-card-primary" className="text-sm font-normal cursor-pointer">
                Make this my primary method
              </Label>
            </div>
            <Button onClick={submitCard} className="w-full">
              Add Payment Method
            </Button>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Saved Bank Accounts</h4>
            {bankList.length === 0 ? (
              <div className="border-2 border-dashed rounded-md p-6 text-center">
                <Landmark className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No saved bank accounts yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bankList.map(m => (
                  <div key={m.id} className="flex items-center gap-3 border rounded-md p-3">
                    <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Landmark className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{m.bankName} •••• {m.accountLast4}</div>
                      <div className="text-xs text-muted-foreground">Routing •••• {m.routingLast4}</div>
                    </div>
                    {m.isPrimary ? (
                      <Badge variant="outline" className="status-active">
                        <Star className="h-3 w-3 mr-1" />Primary
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary"
                        onClick={() => handleMakePrimary(m)}
                      >
                        Make Primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemove(m)}
                      aria-label="Remove bank account"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new bank */}
          <div className="rounded-md border border-border p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4" />Add New Bank Account
            </h4>
            <div className="space-y-2">
              <Label htmlFor="new-bank-holder">Account Holder Name</Label>
              <Input
                id="new-bank-holder"
                value={bankHolder}
                onChange={(e) => setBankHolder(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-bank-name">Bank Name</Label>
              <Input
                id="new-bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-bank-routing">Routing Number</Label>
              <Input
                id="new-bank-routing"
                inputMode="numeric"
                maxLength={9}
                value={bankRouting}
                onChange={(e) => setBankRouting(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-bank-account">Account Number</Label>
              <Input
                id="new-bank-account"
                inputMode="numeric"
                maxLength={17}
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="new-bank-primary"
                checked={bankPrimary || banks.length === 0}
                disabled={banks.length === 0}
                onCheckedChange={(v) => setBankPrimary(!!v)}
              />
              <Label htmlFor="new-bank-primary" className="text-sm font-normal cursor-pointer">
                Make this my primary method
              </Label>
            </div>
            <Button onClick={submitBank} className="w-full">
              Add Payment Method
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
