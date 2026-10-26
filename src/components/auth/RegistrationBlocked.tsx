import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SUPPORT_HREF } from '@/lib/support';

/**
 * v20 — new-customer duplicate checks. Copy is client-approved; it must never name or
 * describe the matching firm.
 */
export type RegistrationBlockReason = 'name' | 'address' | 'email';

const EXISTING_OR_SUPPORT =
  'If your company is already a Leimberg customer, register as an existing customer. Otherwise, please contact support.';

export const REGISTRATION_BLOCK_COPY: Record<RegistrationBlockReason, { title: string; body: string }> = {
  name: { title: 'A company with this name already exists', body: EXISTING_OR_SUPPORT },
  address: { title: 'A company is already registered at this address', body: EXISTING_OR_SUPPORT },
  email: {
    title: 'This email address is already linked to a customer account',
    body: 'You can sign in, register as an existing customer, use a different email address, or contact support.',
  },
};

interface ActionsProps {
  reason: RegistrationBlockReason;
  onRegisterExisting: () => void;
  onSignIn?: () => void;
}

export const RegistrationBlockedActions = ({ reason, onRegisterExisting, onSignIn }: ActionsProps) => (
  <div className="flex flex-col gap-2">
    {reason === 'email' && onSignIn && (
      <Button type="button" onClick={onSignIn} className="w-full h-11 font-medium">
        Sign in
      </Button>
    )}
    <Button
      type="button"
      variant={reason === 'email' ? 'outline' : 'default'}
      onClick={onRegisterExisting}
      className="w-full h-11 font-medium"
    >
      Register as an existing customer
    </Button>
    <Button asChild type="button" variant="outline" className="w-full h-11 font-medium">
      <a href={SUPPORT_HREF}>Contact support</a>
    </Button>
  </div>
);

interface NoticeProps extends ActionsProps {
  onBack: () => void;
}

/** Full-card blocked screen used on the Create an Account page. */
export const RegistrationBlockedNotice = ({ reason, onBack, ...actions }: NoticeProps) => {
  const copy = REGISTRATION_BLOCK_COPY[reason];
  return (
    <div className="space-y-5" role="alert">
      <div className="text-center space-y-2">
        <div className="mx-auto h-11 w-11 rounded-full bg-warning/10 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{copy.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
      </div>
      <RegistrationBlockedActions reason={reason} {...actions} />
      <button
        type="button"
        onClick={onBack}
        className="block mx-auto text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
      >
        Back to the form
      </button>
    </div>
  );
};
