import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AuthBackground } from '@/components/layout/AuthBackground';
import { useDirectory } from '@/hooks/useDirectory';
import { SUPPORT_EMAIL } from '@/lib/support';

const DEMO_EMAIL = 'john.smith@abcaccounting.com';

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useApp();
  const directory = useDirectory();
  const { toast } = useToast();

  // Prefilled after the existing-customer registration success screen.
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    // v20 — an email linked to two or more firms: chooser with the exception, else blocked.
    if (directory.findFirmsByEmail(email).length > 1) {
      setIsLoading(false);
      navigate(directory.hasStraddlingException(email) ? '/choose-account' : '/sign-in-blocked', {
        state: { email: email.trim() },
      });
      return;
    }
    const success = login(email, password);
    setIsLoading(false);
    if (success) {
      navigate('/dashboard');
    } else {
      setError('Invalid email or password. Please try again.');
    }
  };

  // Fast path for demoers — signs in as the seeded ABC Accounting Account Owner.
  const handleDemoLogin = () => {
    const success = login(DEMO_EMAIL, 'demo');
    if (success) {
      toast({ title: 'Welcome back!', description: 'Signed in as John Smith (ABC Accounting)' });
      navigate('/dashboard');
    }
  };

  const handleForgotPassword = () => {
    toast({
      title: 'Password reset',
      description: `Password reset is not yet available in this build. Please contact ${SUPPORT_EMAIL} for assistance.`,
    });
  };

  return (
    <AuthBackground>
      <div className="w-full max-w-[440px] animate-fade-in">
        <div className="bg-card border rounded-xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <img
              src="/leimberg-logo.png"
              alt="Leimberg, LeClair & Lackner, Inc."
              className="h-9 mx-auto mb-4"
            />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Sign in to your account
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-10 pr-10"
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
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full h-10 font-medium">
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-card text-xs text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleDemoLogin}
            className="w-full h-10 font-medium gap-2"
          >
            <Zap className="h-4 w-4" />
            Demo login
          </Button>
        </div>

        <p className="mt-5 text-center text-sm text-white/80">
          New customer?{' '}
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="font-medium text-white hover:underline"
          >
            Create account
          </button>
        </p>
      </div>
    </AuthBackground>
  );
};
