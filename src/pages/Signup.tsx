import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ChevronRight, Eye, EyeOff, ShieldCheck, UserPlus } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AuthBackground } from '@/components/layout/AuthBackground';
import { useDirectory } from '@/hooks/useDirectory';
import { RegistrationBlockedNotice, RegistrationBlockReason } from '@/components/auth/RegistrationBlocked';
import { ExistingCustomerFlow } from '@/components/auth/ExistingCustomerFlow';

const DOMAIN_SUFFIX = '.uat.portal.leimberg.com';

interface FormState {
  companyName: string;
  companyDomain: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** v20 — Create an Account starts with a choice; `?path=existing|new` skips it. */
type SignupPath = 'choose' | 'existing' | 'new';

const PATH_OPTIONS: Array<{ path: Exclude<SignupPath, 'choose'>; title: string; helper: string; icon: typeof Building2 }> = [
  {
    path: 'existing',
    title: "I'm an existing customer and need portal access",
    helper: "Your company is already a Leimberg customer but you don't have a login yet.",
    icon: Building2,
  },
  {
    path: 'new',
    title: "I'm a new customer and want to create an account",
    helper: 'Your company is not a Leimberg customer yet.',
    icon: UserPlus,
  },
];

export const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createAccount, users } = useApp();
  const directory = useDirectory();
  const { toast } = useToast();

  const initialPath = searchParams.get('path');
  const [path, setPath] = useState<SignupPath>(
    initialPath === 'existing' || initialPath === 'new' ? initialPath : 'choose',
  );
  const [choice, setChoice] = useState<Exclude<SignupPath, 'choose'> | null>(null);
  const [blocked, setBlocked] = useState<RegistrationBlockReason | null>(null);

  const switchToExisting = () => {
    setBlocked(null);
    setPath('existing');
  };

  const [form, setForm] = useState<FormState>({
    companyName: '',
    companyDomain: '',
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.companyName.trim()) next.companyName = 'Company Name is required';
    if (!form.companyDomain.trim()) next.companyDomain = 'Company Domain is required';
    else if (!/^[a-z0-9-]+$/i.test(form.companyDomain.trim())) next.companyDomain = 'Use letters, numbers, and hyphens only';
    if (!form.firstName.trim()) next.firstName = 'First Name is required';
    if (!form.lastName.trim()) next.lastName = 'Last Name is required';
    if (!form.username.trim()) next.username = 'Username is required';
    else if (users.some(u => u.username.toLowerCase() === form.username.trim().toLowerCase())) {
      next.username = 'This username is already taken';
    }
    if (!form.email.trim()) next.email = 'Email Address is required';
    else if (!EMAIL_REGEX.test(form.email.trim())) next.email = 'Enter a valid email address';
    // v20 — "email already on file" moved to the straddling check in handleSubmit, which
    // honours allowStraddlingException.
    if (!form.password) next.password = 'Password is required';
    else if (form.password.length < 6) next.password = 'Password must be at least 6 characters';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // v20 — duplicate-company and straddling-email checks (rules in src/lib/directory.ts).
    // The address is entered later, at checkout, and is checked there.
    const email = form.email.trim();
    if (directory.findCompanyByName(form.companyName)) return setBlocked('name');
    if (directory.findFirmsByEmail(email).length > 0 && !directory.hasStraddlingException(email)) {
      return setBlocked('email');
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 400));

    createAccount({
      companyName: form.companyName.trim(),
      companyDomain: form.companyDomain.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password,
    });

    toast({
      title: 'Account created',
      description: 'Choose your subscription to get started.',
    });

    setIsSubmitting(false);
    navigate('/checkout');
  };

  const fieldError = (key: keyof FormState) =>
    errors[key] ? (
      <p className="text-xs text-destructive mt-1">{errors[key]}</p>
    ) : null;

  const inputClass = (key: keyof FormState) =>
    `mt-1.5 h-11 bg-muted/40 ${errors[key] ? 'border-destructive focus-visible:ring-destructive' : ''}`;

  return (
    <AuthBackground>
      <div className="w-full max-w-lg animate-fade-in">
        <div className="bg-card border rounded-2xl shadow-2xl p-8 sm:p-10">
          <div className="text-center mb-6">
            <img
              src="/leimberg-logo.png"
              alt="Leimberg, LeClair & Lackner, Inc."
              className="h-10 mx-auto mb-3"
            />
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">
              CREATE YOUR ACCOUNT TO GET STARTED
            </p>
          </div>

          {path === 'choose' && (
            <div className="space-y-4">
              <div role="radiogroup" aria-label="Account type" className="space-y-3">
                {PATH_OPTIONS.map(opt => {
                  const selected = choice === opt.path;
                  return (
                    <button
                      key={opt.path}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setChoice(opt.path)}
                      className={`w-full text-left rounded-lg border p-4 flex items-start gap-3 transition-colors ${
                        selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50 hover:bg-muted/40'
                      }`}
                    >
                      <div className="h-9 w-9 shrink-0 rounded-md bg-primary/10 flex items-center justify-center">
                        <opt.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{opt.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.helper}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button
                type="button"
                disabled={!choice}
                onClick={() => choice && setPath(choice)}
                className="w-full h-11 font-medium gap-1"
              >
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {path === 'existing' && <ExistingCustomerFlow onBack={() => setPath('choose')} />}

          {path === 'new' && blocked && (
            <RegistrationBlockedNotice
              reason={blocked}
              onBack={() => setBlocked(null)}
              onRegisterExisting={switchToExisting}
              onSignIn={() => navigate('/login')}
            />
          )}

          {path === 'new' && !blocked && (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="companyName" className="text-sm font-medium">
                Company Name
              </Label>
              <Input
                id="companyName"
                placeholder="Acme Corporation"
                value={form.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                className={inputClass('companyName')}
                aria-invalid={!!errors.companyName}
              />
              {fieldError('companyName')}
            </div>

            <div>
              <Label htmlFor="companyDomain" className="text-sm font-medium">
                Company Domain
              </Label>
              <div className="mt-1.5 flex items-stretch gap-2">
                <Input
                  id="companyDomain"
                  placeholder="e.g. acmelaw"
                  value={form.companyDomain}
                  onChange={(e) => updateField('companyDomain', e.target.value)}
                  className={`h-11 bg-muted/40 flex-1 ${errors.companyDomain ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  aria-invalid={!!errors.companyDomain}
                />
                <div className="h-11 shrink-0 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground whitespace-nowrap">
                  {DOMAIN_SUFFIX}
                </div>
              </div>
              {fieldError('companyDomain')}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-sm font-medium">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={form.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  className={inputClass('firstName')}
                  aria-invalid={!!errors.firstName}
                />
                {fieldError('firstName')}
              </div>
              <div>
                <Label htmlFor="lastName" className="text-sm font-medium">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={form.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  className={inputClass('lastName')}
                  aria-invalid={!!errors.lastName}
                />
                {fieldError('lastName')}
              </div>
            </div>

            <div>
              <Label htmlFor="username" className="text-sm font-medium">
                Username
              </Label>
              <Input
                id="username"
                placeholder="e.g. johndoe"
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
                className={inputClass('username')}
                aria-invalid={!!errors.username}
                autoComplete="username"
              />
              {fieldError('username')}
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={inputClass('email')}
                aria-invalid={!!errors.email}
                autoComplete="email"
              />
              {fieldError('email')}
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone Number (Optional)
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g. +1 555 0100"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className={inputClass('phone')}
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className={`pr-10 h-11 bg-muted/40 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  aria-invalid={!!errors.password}
                  autoComplete="new-password"
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
              {fieldError('password')}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 font-medium mt-2"
            >
              {isSubmitting ? 'Creating account...' : 'Create an Account'}
            </Button>
            <button
              type="button"
              onClick={() => setPath('choose')}
              className="block mx-auto text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Back
            </button>
          </form>
          )}

          {!(path === 'new' && blocked) && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-card text-xs font-semibold tracking-[0.2em] text-muted-foreground">
                    ALREADY A USER?
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/login')}
                className="w-full h-11 font-medium"
              >
                Sign In
              </Button>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-white/80">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Secure enterprise login</span>
        </div>
      </div>
    </AuthBackground>
  );
};
