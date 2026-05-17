import { useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  useApp,
  NOTIFICATION_CATALOG,
  NOTIFICATION_CATEGORIES,
  NotificationCatalogEntry,
  NotificationType,
} from '@/contexts/AppContext';

export function NotificationsTab() {
  const {
    currentUser,
    getUserNotificationPrefs,
    updateUserNotificationPrefs,
    resetUserNotificationPrefs,
    getCurrentUserTrialLicenses,
    getEffectiveRoles,
  } = useApp();
  const { toast } = useToast();

  const prefs = getUserNotificationPrefs(currentUser?.id);
  const effectiveRoles = getEffectiveRoles();
  const hasTrialLicense = useMemo(
    () => getCurrentUserTrialLicenses().length > 0,
    [getCurrentUserTrialLicenses],
  );

  const isEntryVisible = (entry: NotificationCatalogEntry): boolean => {
    if (entry.type === 'license.trial_expiring' && !hasTrialLicense) return false;
    if (entry.rolesAllowed.length === 0) return true;
    return entry.rolesAllowed.some(r => effectiveRoles.includes(r));
  };

  const visibleByCategory = useMemo(() => {
    const map = new Map<string, NotificationCatalogEntry[]>();
    NOTIFICATION_CATEGORIES.forEach(c => map.set(c.key, []));
    NOTIFICATION_CATALOG.forEach(entry => {
      if (!isEntryVisible(entry)) return;
      map.get(entry.category)?.push(entry);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRoles.join('|'), hasTrialLicense]);

  if (!currentUser) {
    return (
      <div className="text-sm text-muted-foreground italic">
        Sign in to manage your notification preferences.
      </div>
    );
  }

  const handleToggle = (type: NotificationType, channel: 'email' | 'inApp', value: boolean) => {
    updateUserNotificationPrefs(currentUser.id, type, channel, value);
  };

  const handleReset = () => {
    resetUserNotificationPrefs(currentUser.id);
    toast({ title: 'Notification preferences reset to defaults.' });
  };

  return (
    <div className="space-y-6 pb-6">
      <p className="text-sm text-muted-foreground">
        Choose how you&apos;d like to receive updates. Email goes to your registered email
        address. In-app notifications appear in the bell icon at the top of the page.
      </p>

      <div className="grid grid-cols-[1fr,80px,80px] gap-x-4 mb-2">
        <div></div>
        <div className="text-xs font-medium text-center text-muted-foreground uppercase tracking-wide">
          Email
        </div>
        <div className="text-xs font-medium text-center text-muted-foreground uppercase tracking-wide">
          In-App
        </div>
      </div>

      {NOTIFICATION_CATEGORIES.map(category => {
        const entries = visibleByCategory.get(category.key) || [];
        if (entries.length === 0) return null;
        return (
          <section key={category.key}>
            <h3 className="text-sm font-semibold mt-6 mb-2">{category.label}</h3>
            <div>
              {entries.map(entry => (
                <div
                  key={entry.type}
                  className="grid grid-cols-[1fr,80px,80px] gap-x-4 items-center py-2 border-b border-border last:border-b-0"
                >
                  <div>
                    <div className="text-sm font-medium">{entry.label}</div>
                    <div className="text-xs text-muted-foreground">{entry.description}</div>
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={prefs[entry.type]?.email ?? true}
                      onCheckedChange={(v) => handleToggle(entry.type, 'email', v)}
                      aria-label={`${entry.label} — Email`}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={prefs[entry.type]?.inApp ?? true}
                      onCheckedChange={(v) => handleToggle(entry.type, 'inApp', v)}
                      aria-label={`${entry.label} — In-App`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="pt-4 flex justify-center">
        <Button variant="link" size="sm" onClick={handleReset} className="text-xs">
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
