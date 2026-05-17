import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, AlertTriangle, Bell } from 'lucide-react';
import { useApp, Role, ROLE_LABELS, ROLE_BADGE_CLASS, User as AppUser } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ProfileSettingsDrawer } from '@/components/profile/ProfileSettingsDrawer';
import { PROFILE_DRAWER_EVENT, openProfileDrawer, ProfileDrawerTab } from '@/lib/profileDrawer';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';

const roleLabels = ROLE_LABELS;
const roleColors = ROLE_BADGE_CLASS;

const getInitials = (user: AppUser | null | undefined): string => {
  if (!user) return '??';
  const first = (user.firstName || '').trim().charAt(0).toUpperCase();
  const last = (user.lastName || '').trim().charAt(0).toUpperCase();
  if (first || last) return `${first}${last}`;
  return (user.email || '').slice(0, 2).toUpperCase();
};

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    currentUser,
    logout,
    demoRoles,
    setDemoRoles,
    billingHasAdminAccess,
    setBillingHasAdminAccess,
    isProxySession,
    proxiedUser,
    endProxySession,
    getUserNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp();

  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [profileDrawerTab, setProfileDrawerTab] = useState<ProfileDrawerTab>('profile');
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tab?: ProfileDrawerTab } | undefined;
      if (detail?.tab) setProfileDrawerTab(detail.tab);
      else setProfileDrawerTab('profile');
      setProfileDrawerOpen(true);
    };
    window.addEventListener(PROFILE_DRAWER_EVENT, handler);
    return () => window.removeEventListener(PROFILE_DRAWER_EVENT, handler);
  }, []);

  const demoMode = useMemo(() => {
    if (searchParams.get('demo') === '1') {
      sessionStorage.setItem('leimberg.demoMode', '1');
      return true;
    }
    return sessionStorage.getItem('leimberg.demoMode') === '1';
  }, [searchParams]);

  const notifications = useMemo(() => getUserNotifications(), [getUserNotifications]);
  const unreadCount = useMemo(() => getUnreadNotificationCount(), [getUnreadNotificationCount]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const openProfileSettings = () => {
    setProfileDrawerTab('profile');
    setProfileDrawerOpen(true);
  };

  const checkPageAccess = (newRoles: Role[]) => {
    const pageAccess: Record<string, Role[]> = {
      '/dashboard': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
      '/users': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
      '/users-contacts': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
      '/subscriptions': ['account_owner', 'billing_admin', 'license_admin'],
      '/billing': ['account_owner', 'billing_admin'],
      '/invoices': ['account_owner', 'billing_admin'],
      '/quotes': ['account_owner', 'billing_admin'],
      '/downloads': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
      '/news': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
      '/support': ['account_owner', 'billing_admin', 'license_admin', 'registered_contact'],
      '/admin': ['account_owner', 'license_admin'],
    };

    const currentPath = location.pathname;
    const requiredRoles = pageAccess[currentPath] || [];

    let effectiveRoles = [...newRoles];
    if (billingHasAdminAccess && newRoles.includes('billing_admin') && !newRoles.includes('license_admin')) {
      effectiveRoles.push('license_admin');
    }

    const hasPageAccess = requiredRoles.some(role => effectiveRoles.includes(role));

    if (!hasPageAccess && currentPath !== '/dashboard') {
      navigate('/dashboard');
    }
  };

  const displayUser = isProxySession ? proxiedUser : currentUser;

  return (
    <>
      {/* Proxy Session Banner — only visible during a proxy session AND in demo mode */}
      {demoMode && isProxySession && proxiedUser && (
        <div className="proxy-banner px-4 py-2 flex items-center justify-between bg-warning/10 border-b border-warning/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-foreground">
              Proxy session: You are viewing as{' '}
              <strong>{proxiedUser.firstName} {proxiedUser.lastName}</strong>
              {' '}(Roles: {proxiedUser.roles.map(r => roleLabels[r]).join(', ')})
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={endProxySession}
            className="border-warning/50 text-warning hover:bg-warning/10"
          >
            End Proxy
          </Button>
        </div>
      )}

      <header className="h-16 border-b bg-background flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center">
            <img
              src="/leimberg-logo.png"
              alt="Leimberg, LeClair & Lackner, Inc."
              className="h-7 dark:brightness-0 dark:invert"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Role Demo dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-9">
                <span className="text-xs text-muted-foreground mr-1">Demo:</span>
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Role</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <span>Demo Role Switcher</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Switch roles to preview different user experiences. Demo only.
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(['account_owner', 'billing_admin', 'license_admin', 'registered_contact'] as Role[]).map(role => (
                <DropdownMenuCheckboxItem
                  key={role}
                  checked={demoRoles.includes(role)}
                  onCheckedChange={() => {
                    const newRoles = demoRoles.includes(role)
                      ? demoRoles.filter(r => r !== role)
                      : [...demoRoles, role];
                    if (newRoles.length > 0) {
                      setDemoRoles(newRoles);
                      checkPageAccess(newRoles);
                    }
                  }}
                >
                  <Badge variant="outline" className={`mr-2 ${roleColors[role]}`}>
                    {roleLabels[role]}
                  </Badge>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <div className="px-2 py-2 flex items-center justify-between">
                <Label htmlFor="billing-admin" className="text-xs text-muted-foreground">
                  Billing + Admin Access
                </Label>
                <Switch
                  id="billing-admin"
                  checked={billingHasAdminAccess}
                  onCheckedChange={(checked) => {
                    setBillingHasAdminAccess(checked);
                  }}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Current Roles Display */}
          <div className="hidden md:flex items-center gap-1">
            {demoRoles.slice(0, 2).map(role => (
              <Badge key={role} variant="outline" className={roleColors[role]}>
                {roleLabels[role]}
              </Badge>
            ))}
            {demoRoles.length > 2 && (
              <Badge variant="outline" className="badge-standard">
                +{demoRoles.length - 2}
              </Badge>
            )}
          </div>

          {/* Notification Bell */}
          <Popover open={bellOpen} onOpenChange={setBellOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border-2 border-background" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0">
              <NotificationPanel
                notifications={notifications}
                onItemClick={(n) => {
                  markNotificationRead(n.id);
                  setBellOpen(false);
                  if (n.link) navigate(n.link);
                }}
                onMarkAllRead={() => markAllNotificationsRead()}
                onSettingsClick={() => {
                  setBellOpen(false);
                  openProfileDrawer('notifications');
                }}
              />
            </PopoverContent>
          </Popover>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 px-2 gap-2" aria-label="Open user menu">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {getInitials(displayUser)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm font-medium">
                  {displayUser?.firstName} {displayUser?.lastName}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {getInitials(displayUser)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <p className="text-sm font-medium truncate">
                      {displayUser?.firstName} {displayUser?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {displayUser?.email}
                    </p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openProfileSettings}>
                <Settings className="h-4 w-4 mr-2" />
                Settings / Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ProfileSettingsDrawer
        open={profileDrawerOpen}
        onOpenChange={setProfileDrawerOpen}
        initialTab={profileDrawerTab}
      />
    </>
  );
};
