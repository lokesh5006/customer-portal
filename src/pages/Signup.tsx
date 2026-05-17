import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AuthBackground } from '@/components/layout/AuthBackground';

interface FormState {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Signup = () => {
  const navigate = useNavigate();
  const { createAccount, users } = useApp();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
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
    if (!form.firstName.trim()) next.firstName = 'First Name is required';
    if (!form.lastName.trim()) next.lastName = 'Last Name is required';
    if (!form.email.trim()) next.email = 'Email Address is required';
    else if (!EMAIL_REGEX.test(form.email.trim())) next.email = 'Enter a valid email address';
    else if (users.some(u => u.email.toLowerCase() === form.email.trim().toLowerCase())) {
      next.email = 'An account with this email already exists';
    }
    if (!form.password) next.password = 'Password is required';
    else if (form.password.length < 6) next.password = 'Password must be at least 6 characters';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 400));

    createAccount({
      companyName: form.companyName.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
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
      <p className="text-xs text-red-600 mt-1">{errors[key]}</p>
    ) : null;

  const inputClass = (key: keyof FormState) =>
    `h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-500 ${
      errors[key] ? 'border-red-400 focus-visible:ring-red-400' : ''
    }`;

  return (
    <AuthBackground>
      <div className="w-full max-w-lg animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10">
          <div className="text-center mb-6">
            <img
              src="/leimberg-logo.png"
              alt="Leimberg, LeClair & Lackner, Inc."
              className="h-10 mx-auto mb-3"
            />
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-500">
              CREATE YOUR ACCOUNT TO GET STARTED
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="companyName" className="text-slate-700 text-sm font-medium">
                Company Name
              </Label>
              <Input
                id="companyName"
                placeholder="Acme Corporation"
                value={form.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                className={`mt-1.5 ${inputClass('companyName')}`}
                aria-invalid={!!errors.companyName}
              />
              {fieldError('companyName')}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-slate-700 text-sm font-medium">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={form.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  className={`mt-1.5 ${inputClass('firstName')}`}
                  aria-invalid={!!errors.firstName}
                />
                {fieldError('firstName')}
              </div>
              <div>
                <Label htmlFor="lastName" className="text-slate-700 text-sm font-medium">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={form.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  className={`mt-1.5 ${inputClass('lastName')}`}
                  aria-invalid={!!errors.lastName}
                />
                {fieldError('lastName')}
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-slate-700 text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={`mt-1.5 ${inputClass('email')}`}
                aria-invalid={!!errors.email}
                autoComplete="email"
              />
              {fieldError('email')}
            </div>

            <div>
              <Label htmlFor="password" className="text-slate-700 text-sm font-medium">
                Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className={`pr-10 ${inputClass('password')}`}
                  aria-invalid={!!errors.password}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium mt-2"
            >
              {isSubmitting ? 'Creating account...' : 'Create an Account'}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white text-xs font-semibold tracking-[0.2em] text-slate-400">
                ALREADY USER
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/login')}
            className="w-full h-11 border-blue-600 text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-medium"
          >
            Sign In
          </Button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-blue-100/90">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Secure enterprise login</span>
        </div>
      </div>
    </AuthBackground>
  );
};
