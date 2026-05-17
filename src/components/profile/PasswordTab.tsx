import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

const checkRule = (password: string, rule: 'length' | 'uppercase' | 'number' | 'special'): boolean => {
  switch (rule) {
    case 'length': return password.length >= 8;
    case 'uppercase': return /[A-Z]/.test(password);
    case 'number': return /[0-9]/.test(password);
    case 'special': return /[^A-Za-z0-9]/.test(password);
  }
};

interface RequirementRowProps {
  met: boolean;
  text: string;
}

const RequirementRow = ({ met, text }: RequirementRowProps) => (
  <div className={cn('flex items-center gap-2 text-xs', met ? 'text-success' : 'text-muted-foreground')}>
    {met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
    <span>{text}</span>
  </div>
);

export function PasswordTab() {
  const { toast } = useToast();
  const { notify } = useApp();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const rules = useMemo(() => ({
    length: checkRule(newPassword, 'length'),
    uppercase: checkRule(newPassword, 'uppercase'),
    number: checkRule(newPassword, 'number'),
    special: checkRule(newPassword, 'special'),
  }), [newPassword]);

  const allRulesMet = rules.length && rules.uppercase && rules.number && rules.special;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && allRulesMet && passwordsMatch;

  const handleSubmit = () => {
    if (!currentPassword.trim()) {
      toast({ title: 'Please enter your current password', variant: 'destructive' });
      return;
    }
    if (!allRulesMet) {
      toast({ title: 'New password does not meet all requirements', variant: 'destructive' });
      return;
    }
    if (!passwordsMatch) {
      toast({ title: 'New password and confirmation do not match', variant: 'destructive' });
      return;
    }
    toast({
      title: 'Password updated',
      description: 'Use the new password for your next login.',
    });
    notify({
      type: 'account.password_changed',
      title: 'Password changed',
      message: 'Your password has been updated successfully.',
    });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="space-y-2">
        <Label htmlFor="current-password">Current Password</Label>
        <Input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <div className="space-y-1 pt-1">
          <RequirementRow met={rules.length} text="At least 8 characters" />
          <RequirementRow met={rules.uppercase} text="At least one uppercase letter" />
          <RequirementRow met={rules.number} text="At least one number" />
          <RequirementRow met={rules.special} text="At least one special character" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm New Password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
        />
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p className="text-xs text-destructive">Passwords do not match</p>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
        Update Password
      </Button>
    </div>
  );
}
