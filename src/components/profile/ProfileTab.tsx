import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme/ThemeProvider';

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
  } = useApp();
  const { resolvedTheme, setTheme } = useTheme();
  const { toast } = useToast();

  const canEditCompanyName = getEffectiveRoles().includes('account_owner');

  const [firstName, setFirstName] = useState(currentUser?.firstName ?? '');
  const [lastName, setLastName] = useState(currentUser?.lastName ?? '');
  const [username, setUsername] = useState(currentUser?.username ?? '');
  const [companyName, setCompanyName] = useState(currentCompany?.name ?? '');

  // Snapshot of last-saved values — used to detect unmodified state and for auto-sync gate.
  const lastSavedFirstNameRef = useRef(currentUser?.firstName ?? '');
  const lastSavedLastNameRef = useRef(currentUser?.lastName ?? '');
  const lastSavedUsernameRef = useRef(currentUser?.username ?? '');
  const lastSavedCompanyNameRef = useRef(currentCompany?.name ?? '');

  // Once user manually edits username, stop auto-syncing for the session.
  const usernameManuallyEditedRef = useRef(false);

  // Re-sync state when currentUser/currentCompany changes (e.g. after switching demo user).
  useEffect(() => {
    setFirstName(currentUser?.firstName ?? '');
    setLastName(currentUser?.lastName ?? '');
    setUsername(currentUser?.username ?? '');
    setCompanyName(currentCompany?.name ?? '');
    lastSavedFirstNameRef.current = currentUser?.firstName ?? '';
    lastSavedLastNameRef.current = currentUser?.lastName ?? '';
    lastSavedUsernameRef.current = currentUser?.username ?? '';
    lastSavedCompanyNameRef.current = currentCompany?.name ?? '';
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

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!firstName.trim()) errors.push('First name is required');
    if (!lastName.trim()) errors.push('Last name is required');
    if (usernameError) errors.push(usernameError);
    if (canEditCompanyName && !companyName.trim()) errors.push('Customer / Company Name is required');
    return errors;
  }, [firstName, lastName, usernameError, companyName, canEditCompanyName]);

  const isDirty =
    firstName !== lastSavedFirstNameRef.current ||
    lastName !== lastSavedLastNameRef.current ||
    username !== lastSavedUsernameRef.current ||
    (canEditCompanyName && companyName !== lastSavedCompanyNameRef.current);

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
      });
    }
    if (canEditCompanyName && currentCompany && companyName.trim() !== currentCompany.name) {
      updateCompany(currentCompany.id, { name: companyName.trim() });
    }
    lastSavedFirstNameRef.current = firstName.trim();
    lastSavedLastNameRef.current = lastName.trim();
    lastSavedUsernameRef.current = username.trim();
    lastSavedCompanyNameRef.current = companyName.trim();
    toast({ title: 'Profile updated' });
    onClose();
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
    </div>
  );
}
