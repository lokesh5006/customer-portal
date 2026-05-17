import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';

const SESSION_DISMISS_KEY = 'leimberg.trialBanner.dismissed';

export const TrialBanner = () => {
  const { getCurrentUserTrialLicenses } = useApp();
  const [dismissed, setDismissed] = useState(
    typeof window !== 'undefined' && sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'
  );

  if (dismissed) return null;
  const trials = getCurrentUserTrialLicenses();
  if (trials.length === 0) return null;

  const next = trials.reduce((min, t) =>
    new Date(t.expiresAt) < new Date(min.expiresAt) ? t : min
  );
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(next.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="border-b border-warning/30 bg-warning/10 px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium">
              Your trial for {next.productName} expires in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}.
            </p>
            <p className="text-xs text-muted-foreground">
              Contact your administrator to convert to a paid license.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default TrialBanner;
