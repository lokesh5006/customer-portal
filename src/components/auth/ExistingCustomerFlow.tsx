import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, FlaskConical, MailCheck } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useDirectory } from '@/hooks/useDirectory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SUPPORT_HREF } from '@/lib/support';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'email' | 'sent' | 'password' | 'success';

/**
 * v20 — "I'm an existing customer and need portal access". The customer is already in the
 * CRM but has no login: verify the email, set a password, and link the login to the
 * existing firm + contact record. No company is created.
 *
 * The "sent" step shows the same neutral message for every email so the screen never
 * reveals which addresses are on file.
 */
export const ExistingCustomerFlow = ({ onBack }: { onBack: () => void }) => {
  const navigate = useNavigate();
  const { activateContactLogin } = useApp();
  const directory = useDirectory();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Prototype only: lets the demoer "click" the verification email link.
  const hasPendingContact = step === 'sent' && !!directory.findContactByEmail(email);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setEmailError('Email Address is required');
    if (!EMAIL_REGEX.test(email.trim())) return setEmailError('Enter a valid email address');
    setEmailError('');
    setStep('sent');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Same password rule as the Create an Account form.
    if (!password) return setPasswordError('Password is required');
    if (password.length < 6) return setPasswordError('Password must be at least 6 characters');
    setPasswordError('');
    if (activateContactLogin(email)) setStep('success');
  };

  if (step === 'email') {
    return (
      <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Get portal access</h2>
          <p className="text-sm text-muted-foreground">Enter the email address Leimberg has on file for you.</p>
        </div>
        <div>
          <Label htmlFor="existing-email" className="text-sm font-medium">Email Address</Label>
          <Input
            id="existing-email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
            className={`mt-1.5 h-11 bg-muted/40 ${emailError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            aria-invalid={!!emailError}
            autoComplete="email"
            autoFocus
          />
          {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
        </div>
        <Button type="submit" className="w-full h-11 font-medium">Continue</Button>
        <button
          type="button"
          onClick={onBack}
          className="block mx-auto text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          Back
        </button>
      </form>
    );
  }

  if (step === 'sent') {
    return (
      <div className="space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
            <MailCheck className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            Check your email. If this address is on file, we've sent a link to verify it and set up your login.
          </p>
          <p className="text-sm">
            <a href={SUPPORT_HREF} className="font-medium text-primary hover:underline">
              Didn't get it? Contact support
            </a>
          </p>
        </div>
        {hasPendingContact && (
          <div className="rounded-md border border-dashed border-muted-foreground/40 p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Prototype only
            </p>
            <Button type="button" variant="secondary" className="w-full gap-2" onClick={() => setStep('password')}>
              <FlaskConical className="h-4 w-4" />
              Prototype only: open the verification link
            </Button>
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="block mx-auto text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (step === 'password') {
    return (
      <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Create your password</h2>
          <p className="text-sm text-muted-foreground">{email.trim()}</p>
        </div>
        <div>
          <Label htmlFor="existing-password" className="text-sm font-medium">Password</Label>
          <div className="relative mt-1.5">
            <Input
              id="existing-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
              className={`pr-10 h-11 bg-muted/40 ${passwordError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              aria-invalid={!!passwordError}
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {passwordError && <p className="text-xs text-destructive mt-1">{passwordError}</p>}
        </div>
        <Button type="submit" className="w-full h-11 font-medium">Create password</Button>
      </form>
    );
  }

  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto h-11 w-11 rounded-full bg-success/10 flex items-center justify-center">
        <CheckCircle2 className="h-5 w-5 text-success" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Your login is ready</h2>
        <p className="text-sm text-muted-foreground">Your login is now linked to your company record.</p>
      </div>
      <Button
        type="button"
        className="w-full h-11 font-medium"
        onClick={() => navigate('/login', { state: { email: email.trim() } })}
      >
        Continue to sign in
      </Button>
    </div>
  );
};
