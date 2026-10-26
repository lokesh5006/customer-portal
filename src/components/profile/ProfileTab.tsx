import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BillToBlock, BilledThroughNote } from '@/components/billing/BillToBlock';
import { ALLOW_FIRM_EDIT_BILL_TO, companyBillTo, validateBillTo } from '@/lib/billTo';

const DOMAIN_SUFFIX = '.uat.portal.leimberg.com';

interface ProfileTabProps {
  onClose: () => void;
}

const generateUsername = (first: string, last: string): string => {
  const base = `${first}${last}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  return base || '';
};

export function ProfileTab({ onClose }: ProfileTabProps) {
  const {
    currentUser,
    currentCompany,
    updateUser,
    updateCompany,
    isUsernameTaken,
    getEffectiveRoles,
    getCompanyUsers,
    transferOwnership,
    deleteCompanyAccount,
  } = useApp();
  const { resolvedTheme, setTheme } = useTheme();
  const { toast } = useToast();

  const effectiveRoles = getEffectiveRoles();
  const isAccountOwner = effectiveRoles.includes('account_owner');
  const isBillingAdmin = effectiveRoles.includes('billing_admin');
  const canEditCompanyName = isAccountOwner;
  const canEditBillingDetails = isAccountOwner || isBillingAdmin;
  // v19 — billed-through (SHI-style) firms: billing comes from the parent and is read-only.
  const billedThrough = currentCompany?.billedThrough;
  const canEditBillTo = ALLOW_FIRM_EDIT_BILL_TO;

  const [firstName, setFirstName] = useState(currentUser?.firstName ?? '');
  const [lastName, setLastName] = useState(currentUser?.lastName ?? '');
  const [username, setUsername] = useState(currentUser?.username ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [companyName, setCompanyName] = useState(currentCompany?.name ?? '');

  // Billing Details — separate section, own local draft state.
  const [billingEmail, setBillingEmail] = useState(currentCompany?.billingEmail ?? '');
  const [billToName, setBillToName] = useState(currentCompany?.address?.billToName ?? '');
  const [billToAttention, setBillToAttention] = useState(currentCompany?.address?.billToAttention ?? '');
  const [addressLine1, setAddressLine1] = useState(currentCompany?.address?.line1 ?? '');
  const [addressLine2, setAddressLine2] = useState(currentCompany?.address?.line2 ?? '');
  const [country, setCountry] = useState(currentCompany?.address?.country ?? '');
  const [region, setRegion] = useState(currentCompany?.address?.state ?? '');
  const [postalCode, setPostalCode] = useState(currentCompany?.address?.postalCode ?? '');

  // Company Domain — saved immediately via its own Update button, not the main Save Changes.
  const [domainDraft, setDomainDraft] = useState(currentCompany?.domain ?? '');

  const [mainContactId, setMainContactId] = useState(currentCompany?.mainContactUserId ?? '');
  const [transferTargetId, setTransferTargetId] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Snapshot of last-saved values — used to detect unmodified state and for auto-sync gate.
  const lastSavedFirstNameRef = useRef(currentUser?.firstName ?? '');
  const lastSavedLastNameRef = useRef(currentUser?.lastName ?? '');
  const lastSavedUsernameRef = useRef(currentUser?.username ?? '');
  const lastSavedPhoneRef = useRef(currentUser?.phone ?? '');
  const lastSavedCompanyNameRef = useRef(currentCompany?.name ?? '');
  const lastSavedBillingRef = useRef({
    billingEmail: currentCompany?.billingEmail ?? '',
    billToName: currentCompany?.address?.billToName ?? '',
    billToAttention: currentCompany?.address?.billToAttention ?? '',
    addressLine1: currentCompany?.address?.line1 ?? '',
    addressLine2: currentCompany?.address?.line2 ?? '',
    country: currentCompany?.address?.country ?? '',
    region: currentCompany?.address?.state ?? '',
    postalCode: currentCompany?.address?.postalCode ?? '',
  });

  // Once user manually edits username, stop auto-syncing for the session.
  const usernameManuallyEditedRef = useRef(false);

  const companyUsers = getCompanyUsers().filter(u => u.status === 'active');
  const transferCandidates = companyUsers.filter(u => u.id !== currentUser?.id);

  // Re-sync state when currentUser/currentCompany changes (e.g. after switching demo user).
  useEffect(() => {
    setFirstName(currentUser?.firstName ?? '');
    setLastName(currentUser?.lastName ?? '');
    setUsername(currentUser?.username ?? '');
    setPhone(currentUser?.phone ?? '');
    setCompanyName(currentCompany?.name ?? '');
    setDomainDraft(currentCompany?.domain ?? '');
    setMainContactId(currentCompany?.mainContactUserId ?? '');
    setBillingEmail(currentCompany?.billingEmail ?? '');
    setBillToName(currentCompany?.address?.billToName ?? '');
    setBillToAttention(currentCompany?.address?.billToAttention ?? '');
    setAddressLine1(currentCompany?.address?.line1 ?? '');
    setAddressLine2(currentCompany?.address?.line2 ?? '');
    setCountry(currentCompany?.address?.country ?? '');
    setRegion(currentCompany?.address?.state ?? '');
    setPostalCode(currentCompany?.address?.postalCode ?? '');
    lastSavedFirstNameRef.current = currentUser?.firstName ?? '';
    lastSavedLastNameRef.current = currentUser?.lastName ?? '';
    lastSavedUsernameRef.current = currentUser?.username ?? '';
    lastSavedPhoneRef.current = currentUser?.phone ?? '';
    lastSavedCompanyNameRef.current = currentCompany?.name ?? '';
    lastSavedBillingRef.current = {
      billingEmail: currentCompany?.billingEmail ?? '',
      billToName: currentCompany?.address?.billToName ?? '',
      billToAttention: currentCompany?.address?.billToAttention ?? '',
      addressLine1: currentCompany?.address?.line1 ?? '',
      addressLine2: currentCompany?.address?.line2 ?? '',
      country: currentCompany?.address?.country ?? '',
      region: currentCompany?.address?.state ?? '',
      postalCode: currentCompany?.address?.postalCode ?? '',
    };
    usernameManuallyEditedRef.current = false;
  }, [currentUser?.id, currentCompany?.id]);

  // Auto-sync username when first/last change AND user has not manually edited it.
  useEffect(() => {
    if (usernameManuallyEditedRef.current) return;
    // Only auto-sync if the current username still matches the saved one.
    if (username !== lastSavedUsernameRef.current) return;
    const suggested = generateUsername(firstName, lastName);
    if (suggested && suggested !== username) {
      setUsername(suggested);
    }
    // We intentionally don't include username in deps to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName]);

  const handleUsernameChange = (val: string) => {
    usernameManuallyEditedRef.current = true;
    setUsername(val);
  };

  const usernameError = useMemo(() => {
    if (!username.trim()) return 'Username is required';
    if (currentUser && currentCompany &&
      isUsernameTaken(username.trim(), currentCompany.id, currentUser.id)) {
      return 'Username is already in use';
    }
    return null;
  }, [username, currentUser, currentCompany, isUsernameTaken]);

  const billToErrors = validateBillTo(billToName, billToAttention);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!firstName.trim()) errors.push('First name is required');
    if (!lastName.trim()) errors.push('Last name is required');
    if (usernameError) errors.push(usernameError);
    if (canEditCompanyName && !companyName.trim()) errors.push('Customer / Company Name is required');
    if (billToErrors.name) errors.push(billToErrors.name);
    if (billToErrors.attention) errors.push(billToErrors.attention);
    return errors;
  }, [firstName, lastName, usernameError, companyName, canEditCompanyName, billToErrors.name, billToErrors.attention]);

  const billingDirty = canEditBillingDetails && !billedThrough && (
    billingEmail !== lastSavedBillingRef.current.billingEmail ||
    billToName !== lastSavedBillingRef.current.billToName ||
    billToAttention !== lastSavedBillingRef.current.billToAttention ||
    addressLine1 !== lastSavedBillingRef.current.addressLine1 ||
    addressLine2 !== lastSavedBillingRef.current.addressLine2 ||
    country !== lastSavedBillingRef.current.country ||
    region !== lastSavedBillingRef.current.region ||
    postalCode !== lastSavedBillingRef.current.postalCode
  );

  const isDirty =
    firstName !== lastSavedFirstNameRef.current ||
    lastName !== lastSavedLastNameRef.current ||
    username !== lastSavedUsernameRef.current ||
    phone !== lastSavedPhoneRef.current ||
    (canEditCompanyName && companyName !== lastSavedCompanyNameRef.current) ||
    billingDirty;

  const saveDisabled = !isDirty || validationErrors.length > 0;

  const handleSave = () => {
    if (validationErrors.length > 0) {
      toast({ title: validationErrors[0], variant: 'destructive' });
      return;
    }
    if (currentUser) {
      updateUser(currentUser.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        phone: phone.trim() || undefined,
      });
    }
    if (currentCompany) {
      const companyUpdates: Record<string, unknown> = {};
      if (canEditCompanyName && companyName.trim() !== currentCompany.name) {
        companyUpdates.name = companyName.trim();
      }
      if (billingDirty) {
        companyUpdates.billingEmail = billingEmail.trim() || undefined;
        companyUpdates.address = {
          ...currentCompany.address,
          billToName: billToName.trim() || undefined,
          billToAttention: billToAttention.trim() || undefined,
          line1: addressLine1.trim() || undefined,
          line2: addressLine2.trim() || undefined,
          country: country.trim() || undefined,
          state: region.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
        };
      }
      if (Object.keys(companyUpdates).length > 0) {
        updateCompany(currentCompany.id, companyUpdates);
      }
    }
    lastSavedFirstNameRef.current = firstName.trim();
    lastSavedLastNameRef.current = lastName.trim();
    lastSavedUsernameRef.current = username.trim();
    lastSavedPhoneRef.current = phone.trim();
    lastSavedCompanyNameRef.current = companyName.trim();
    lastSavedBillingRef.current = { billingEmail, billToName, billToAttention, addressLine1, addressLine2, country, region, postalCode };
    toast({ title: 'Profile updated' });
    onClose();
  };

  const handleUpdateDomain = () => {
    if (!currentCompany) return;
    const clean = domainDraft.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
    setDomainDraft(clean);
    updateCompany(currentCompany.id, { domain: clean || undefined });
    toast({ title: 'Company domain updated' });
  };

  const handleToggleFirmMfa = (checked: boolean) => {
    if (!currentCompany) return;
    updateCompany(currentCompany.id, { mfaEnabledForFirm: checked });
    toast({
      title: checked ? 'MFA enabled for your firm' : 'MFA disabled for your firm',
      description: checked
        ? 'Every user in your firm will be required to use multi-factor authentication.'
        : 'Users are no longer required to use multi-factor authentication.',
    });
  };

  const handleConfigureOwnMfa = () => {
    if (!currentUser) return;
    const next = !currentUser.mfaConfigured;
    updateUser(currentUser.id, { mfaConfigured: next });
    toast({
      title: next ? 'MFA configured for your account' : 'MFA removed from your account',
    });
  };

  const handleMainContactChange = (userId: string) => {
    if (!currentCompany) return;
    setMainContactId(userId);
    updateCompany(currentCompany.id, { mainContactUserId: userId });
    toast({ title: 'Main contact updated' });
  };

  const handleTransferOwnership = () => {
    if (!transferTargetId) {
      toast({ title: 'Select a user to transfer ownership to', variant: 'destructive' });
      return;
    }
    const target = transferCandidates.find(u => u.id === transferTargetId);
    const ok = transferOwnership(transferTargetId);
    if (!ok) {
      toast({ title: 'Unable to transfer ownership', variant: 'destructive' });
      return;
    }
    toast({ title: `Ownership transferred to ${target?.firstName} ${target?.lastName}. You are now a Billing Admin.` });
    onClose();
  };

  const handleDeleteAccount = () => {
    setDeleteConfirmOpen(false);
    deleteCompanyAccount();
  };

  const darkModeOn = resolvedTheme === 'dark';

  return (
    <div className="space-y-8 pb-6">
      {/* Organization Profile */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold">Organization Profile</h3>
        <div className="space-y-2">
          <Label htmlFor="company-name">Customer / Company Name</Label>
          <Input
            id="company-name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={!canEditCompanyName}
            className={canEditCompanyName ? '' : 'opacity-70 cursor-not-allowed'}
          />
          <p className="text-xs text-muted-foreground">
            This is how the customer name shows on invoices, statements, etc.
            {!canEditCompanyName && ' Only Account Owners can edit this.'}
          </p>
        </div>

        {isAccountOwner && (
          <div className="space-y-2">
            <Label htmlFor="company-domain">Company Domain</Label>
            <div className="flex items-stretch gap-2">
              <Input
                id="company-domain"
                value={domainDraft}
                onChange={(e) => setDomainDraft(e.target.value)}
                className="flex-1"
              />
              <div className="shrink-0 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground whitespace-nowrap">
                {DOMAIN_SUFFIX}
              </div>
              <Button type="button" onClick={handleUpdateDomain} className="shrink-0">Update</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This is your company&apos;s unique address. Only lowercase letters and numbers, up to 15 characters.
            </p>
          </div>
        )}

        {isAccountOwner && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="enable-mfa"
              checked={!!currentCompany?.mfaEnabledForFirm}
              onCheckedChange={(v) => handleToggleFirmMfa(!!v)}
            />
            <Label htmlFor="enable-mfa" className="text-sm font-normal cursor-pointer">Enable MFA</Label>
          </div>
        )}

        <div className="flex items-center justify-between rounded-md border p-3 gap-4">
          <div>
            <p className="text-sm font-medium">Multi Factor Authentication (MFA)</p>
            <p className="text-xs text-muted-foreground">Set up an authenticator app for two-factor authentication.</p>
          </div>
          <Button type="button" variant="outline" className="shrink-0" onClick={handleConfigureOwnMfa}>
            {currentUser?.mfaConfigured ? 'Remove' : 'Configure'}
          </Button>
        </div>
      </section>

      {/* Personal Information */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold">Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="first-name">First Name</Label>
            <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last Name</Label>
            <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            aria-invalid={!!usernameError}
          />
          {usernameError && (
            <p className="text-xs text-destructive">{usernameError}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +1 555 0100" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={currentUser?.email ?? ''}
            disabled
            className="opacity-70 cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">
            Email address cannot be changed. Contact your administrator if you need to update it.
          </p>
        </div>
      </section>

      {/* Billing Details — Account Owner and Billing Admin only */}
      {canEditBillingDetails && (
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Billing Details</h3>
          {billedThrough && currentCompany ? (
            <>
              <BilledThroughNote parentName={billedThrough.name} />
              <div className="space-y-2">
                <Label>Bill To</Label>
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <BillToBlock billTo={companyBillTo(currentCompany)} />
                </div>
              </div>
            </>
          ) : (
          <>
          <div className="space-y-2">
            <Label htmlFor="billing-email">Billing Email</Label>
            <Input id="billing-email" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} />
            <p className="text-xs text-muted-foreground">This email will be used for billing communications in HaloPSA.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bill-to-name">Bill-to Name <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="bill-to-name"
              value={billToName}
              placeholder={currentCompany?.name}
              onChange={(e) => setBillToName(e.target.value)}
              disabled={!canEditBillTo}
              className={canEditBillTo ? '' : 'opacity-70 cursor-not-allowed'}
              aria-invalid={!!billToErrors.name}
            />
            {billToErrors.name && <p className="text-xs text-destructive">{billToErrors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bill-to-attention">Attention <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="bill-to-attention"
              value={billToAttention}
              onChange={(e) => setBillToAttention(e.target.value)}
              disabled={!canEditBillTo}
              className={canEditBillTo ? '' : 'opacity-70 cursor-not-allowed'}
              aria-invalid={!!billToErrors.attention}
            />
            {billToErrors.attention && <p className="text-xs text-destructive">{billToErrors.attention}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-1">Address Line 1</Label>
            <Input id="address-1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-2">Address Line 2</Label>
            <Input id="address-2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region/State</Label>
            <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal">Postal Code</Label>
            <Input id="postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </div>
          </>
          )}
        </section>
      )}

      {/* Main Contact — settable by Account Owner and Billing Admin */}
      {canEditBillingDetails && (
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Main Contact</h3>
          <div className="space-y-2">
            <Label htmlFor="main-contact">Main Contact</Label>
            <Select value={mainContactId} onValueChange={handleMainContactChange}>
              <SelectTrigger id="main-contact">
                <SelectValue placeholder="Select main contact" />
              </SelectTrigger>
              <SelectContent>
                {companyUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>
      )}

      {/* Transfer Ownership — Account Owner only */}
      {isAccountOwner && (
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Transfer Ownership</h3>
          <p className="text-sm text-muted-foreground">
            Transfer account ownership to another user. You will be assigned the Billing Admin role.
          </p>
          <div className="flex gap-2">
            <Select value={transferTargetId} onValueChange={setTransferTargetId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select new owner" />
              </SelectTrigger>
              <SelectContent>
                {transferCandidates.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="shrink-0" onClick={handleTransferOwnership}>
              Transfer Ownership
            </Button>
          </div>
        </section>
      )}

      {/* Delete Your Account — Account Owner only */}
      {isAccountOwner && (
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Delete your Account</h3>
          <p className="text-sm text-muted-foreground">
            You can delete your Account at any time. If you change your mind, you might not be able
            to recover it after permanent deletion. This deletes the entire firm and logs out and
            deletes all users&apos; accounts.
          </p>
          <Button type="button" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmOpen(true)}>
            Delete account
          </Button>
        </section>
      )}

      {/* Appearance */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold">Appearance</h3>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-sm font-medium">Dark Mode</p>
            <p className="text-xs text-muted-foreground">Use dark theme across the application</p>
          </div>
          <Switch
            checked={darkModeOn}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            aria-label="Toggle dark mode"
          />
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saveDisabled}>
          Save Changes
        </Button>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {currentCompany?.name || 'your firm'} and logs out and deletes every
              user&apos;s account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAccount}
            >
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
