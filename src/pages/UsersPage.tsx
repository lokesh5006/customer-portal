import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useApp, Role, User, ROLE_LABELS, ROLE_BADGE_CLASS, LICENSE_TYPE_BADGE, LicenseType,
} from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ListingPageHeader, SearchFilterCard, FilterField, DataTable, DataTableColumn, PaginationControls,
} from '@/components/listing';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useReadOnlyGuard, READ_ONLY_TOOLTIP } from '@/hooks/useReadOnlyGuard';
import { BulkImportDialog } from '@/components/users/BulkImportDialog';
import {
  Plus, MoreVertical, Download, Edit, UserX, UserCheck, ExternalLink, Clock, Upload, RotateCw,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  active: 'status-active',
  invited: 'status-invited',
  inactive: 'status-inactive',
};

// Drawer mode simplified — read-only behavior comes from the readOnly flag, not a separate 'view' mode.
type DrawerMode = 'add' | 'edit';

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
};

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
};

const generateUsername = (firstName: string, lastName: string): string => {
  const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  return base || '';
};

export const UsersPage = () => {
  const navigate = useNavigate();
  const {
    getCompanyUsers, getCompanySubscriptions,
    deactivateUser, reactivateUser, hasAccess, can, startProxySession,
    licenses, updateUser, markLicensesExpiringAtRenewal, updateRenewalSeatCount,
  } = useApp();
  const { toast } = useToast();
  const { readOnly } = useReadOnlyGuard();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [createdFrom, setCreatedFrom] = useState<Date>();
  const [createdTo, setCreatedTo] = useState<Date>();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expiringOnly, setExpiringOnly] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('edit');
  const [drawerUser, setDrawerUser] = useState<User | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const allUsers = getCompanyUsers();
  const subscriptions = getCompanySubscriptions().filter(s => s.status !== 'cancelled' && s.status !== 'expired');

  // Registered Contacts see only Account Owners, Billing Admins, and License Admins.
  const isOnlyRegisteredContact = hasAccess(['registered_contact']) &&
    !hasAccess(['account_owner', 'billing_admin', 'license_admin']);
  const users = isOnlyRegisteredContact
    ? allUsers.filter(u => u.roles.some(r => r !== 'registered_contact'))
    : allUsers;

  const productsForUser = (userId: string): { name: string; licenseType: LicenseType }[] => {
    const userLicenses = licenses.filter(l => l.userId === userId);
    const seen = new Map<string, LicenseType>();
    userLicenses.forEach(l => {
      const sub = subscriptions.find(s => s.id === l.subscriptionId);
      const prod = sub?.products.find(p => p.id === l.productId);
      if (prod && prod.name !== 'DataNet') {
        // Surface the non-paid type if any exists for the same product.
        const lt = (l.licenseType || 'paid') as LicenseType;
        const existing = seen.get(prod.name);
        if (!existing || (existing === 'paid' && lt !== 'paid')) {
          seen.set(prod.name, lt);
        }
      }
    });
    return Array.from(seen, ([name, licenseType]) => ({ name, licenseType }));
  };

  // v19 Section C3 — product names the user is set to lose at the next renewal.
  const expiringProductsForUser = (userId: string): string[] => {
    const names = new Set<string>();
    licenses
      .filter(l => l.userId === userId && l.expiringAtRenewal && !l.deactivatedAt)
      .forEach(l => {
        const sub = subscriptions.find(s => s.id === l.subscriptionId);
        const prod = sub?.products.find(p => p.id === l.productId);
        if (prod && prod.name !== 'DataNet') names.add(prod.name);
      });
    return Array.from(names);
  };

  // v20 Section D — the renewal column/chip show only for AO + BA AND when the company
  // actually has at least one expiring-at-renewal license.
  const canRenewalStatus = can('manage_seat_renewal_status');
  const anyExpiringInCompany = allUsers.some(u => expiringProductsForUser(u.id).length > 0);
  const showRenewalColumn = canRenewalStatus && anyExpiringInCompany;

  // v20 Section F3 — mark ALL of a user's expiring licenses as renewing (per product:
  // clear the flag and bump that product's renewal count by the number unflagged).
  const handleMarkUserRenewing = (user: User) => {
    const userExpiring = licenses.filter(l => l.userId === user.id && l.expiringAtRenewal && !l.deactivatedAt);
    const byProduct = new Map<string, { subId: string; prodId: string; count: number }>();
    userExpiring.forEach(l => {
      const k = `${l.subscriptionId}:${l.productId}`;
      const cur = byProduct.get(k);
      if (cur) cur.count += 1;
      else byProduct.set(k, { subId: l.subscriptionId, prodId: l.productId, count: 1 });
    });
    byProduct.forEach(({ subId, prodId, count }) => {
      markLicensesExpiringAtRenewal(subId, prodId, [user.id], false);
      const sub = subscriptions.find(s => s.id === subId);
      const prod = sub?.products.find(p => p.id === prodId);
      const current = prod?.renewalSeatCount ?? prod?.licenseCount ?? 0;
      updateRenewalSeatCount(subId, prodId, current + count);
    });
    toast({
      title: `${user.firstName} ${user.lastName} will renew.`,
      description: 'Their seat(s) are kept at the next renewal.',
    });
  };

  const filteredUsers = users.filter(user => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      user.firstName.toLowerCase().includes(q) ||
      user.lastName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      (user.username || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter as Role);
    let matchesCreated = true;
    if (createdFrom) matchesCreated = new Date(user.createdAt) >= createdFrom;
    if (createdTo && matchesCreated) matchesCreated = new Date(user.createdAt) <= createdTo;
    const matchesExpiring = !expiringOnly || expiringProductsForUser(user.id).length > 0;
    return matchesSearch && matchesStatus && matchesRole && matchesCreated && matchesExpiring;
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => {
    setSearchQuery(''); setStatusFilter('all'); setRoleFilter('all');
    setCreatedFrom(undefined); setCreatedTo(undefined); setCurrentPage(1);
    setExpiringOnly(false);
  };

  const isLastActiveOwner = (user: User): boolean => {
    if (!user.roles.includes('account_owner')) return false;
    const others = allUsers.filter(u =>
      u.id !== user.id && u.roles.includes('account_owner') && u.status !== 'inactive'
    );
    return others.length === 0;
  };

  const openDrawer = (user: User | null, mode: DrawerMode) => {
    setDrawerUser(user);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  const handleProxyLogin = (user: User) => {
    if (user.status === 'inactive') {
      toast({ title: 'Cannot Proxy', description: 'Cannot proxy login to an inactive user.', variant: 'destructive' });
      return;
    }
    startProxySession(user.id);
    toast({ title: 'Proxy Session Started', description: `You are now viewing as ${user.firstName} ${user.lastName}` });
    navigate('/dashboard');
  };

  const handleDeactivate = (user: User) => {
    if (isLastActiveOwner(user)) {
      toast({ title: 'Cannot deactivate the last Account Owner.', variant: 'destructive' });
      return;
    }
    deactivateUser(user.id);
    toast({ title: 'User Deactivated', description: `${user.firstName} ${user.lastName} has been deactivated.` });
  };

  const handleReactivate = (user: User) => {
    reactivateUser(user.id);
    toast({ title: 'User Reactivated', description: `${user.firstName} ${user.lastName} has been reactivated.` });
  };

  // Inline DataNet toggle — optimistic update with Undo action in the toast.
  const handleDataNetToggle = (user: User, newValue: boolean) => {
    const oldValue = user.dataNetEmailOptIn !== false;
    updateUser(user.id, { dataNetEmailOptIn: newValue });
    toast({
      title: newValue ? 'DataNet email enabled' : 'DataNet email disabled',
      description: `For ${user.firstName} ${user.lastName}.`,
      action: (
        <ToastAction
          altText="Undo DataNet change"
          onClick={() => updateUser(user.id, { dataNetEmailOptIn: oldValue })}
        >
          Undo
        </ToastAction>
      ),
    });
  };

  const canImpersonateTarget = (target: User): boolean => {
    if (hasAccess(['account_owner'])) return true;
    if (hasAccess(['license_admin'])) {
      return target.roles.length === 1 && target.roles[0] === 'registered_contact';
    }
    return false;
  };

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name', header: 'Name',
      render: (user) => (
        <button
          onClick={() => openDrawer(user, 'edit')}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          aria-label={`Edit ${user.firstName} ${user.lastName}`}
        >
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-foreground hover:underline">{user.firstName} {user.lastName}</span>
            <span className="text-xs text-muted-foreground">@{user.username || generateUsername(user.firstName, user.lastName)}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </button>
      ),
    },
    {
      key: 'products', header: 'Product Access', className: 'min-w-[200px]',
      render: (user) => {
        const prods = productsForUser(user.id);
        if (prods.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {prods.map(p => {
              const suffix = p.licenseType === 'paid' ? '' : ` (${LICENSE_TYPE_BADGE[p.licenseType].label})`;
              return (
                <Badge key={p.name} variant="outline" className="text-xs">
                  {p.name}{suffix}
                </Badge>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'role', header: 'Role', className: 'min-w-[160px]',
      render: (user) => (
        <div className="flex flex-col gap-1">
          {user.roles.map(role => (
            <Badge key={role} variant="outline" className={`text-xs ${ROLE_BADGE_CLASS[role]}`}>
              {ROLE_LABELS[role]}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'datanet', header: 'DataNet Email', className: 'w-[140px]',
      render: (user) => {
        const enabled = user.dataNetEmailOptIn !== false;
        const switchEl = (
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => handleDataNetToggle(user, checked)}
            aria-label={`DataNet email ${enabled ? 'enabled' : 'disabled'} for ${user.firstName} ${user.lastName}`}
            disabled={readOnly}
          />
        );
        return (
          <div className="flex items-center justify-center">
            {readOnly ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>{switchEl}</span>
                </TooltipTrigger>
                <TooltipContent>{READ_ONLY_TOOLTIP}</TooltipContent>
              </Tooltip>
            ) : switchEl}
          </div>
        );
      },
    },
    {
      key: 'createdAt', header: 'Created On', className: 'w-[140px]',
      render: (user) => <span className="text-sm">{formatDate(user.createdAt)}</span>,
    },
    {
      key: 'status', header: 'Status', className: 'w-[110px]',
      render: (user) => (
        user.status === 'invited' ? (
          <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/30">
            <Clock className="h-3 w-3 mr-1" /> Invited
          </Badge>
        ) : (
          <Badge variant="outline" className={statusColors[user.status]}>{user.status}</Badge>
        )
      ),
    },
    {
      key: 'renewalStatus', header: 'Status at next renewal', className: 'min-w-[180px]',
      render: (user) => {
        const exp = expiringProductsForUser(user.id);
        if (exp.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
        const label = exp.length > 3 ? `${exp.length} products` : exp.join(', ');
        return (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Expiring — {label}
          </span>
        );
      },
    },
    {
      key: 'actions', header: '', className: 'w-[50px] text-right',
      render: (user) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open menu">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {can('users.edit') && (
              <DropdownMenuItem onClick={() => openDrawer(user, 'edit')} disabled={readOnly}>
                <Edit className="h-4 w-4 mr-2" />Edit User
              </DropdownMenuItem>
            )}
            {can('users.impersonate') && canImpersonateTarget(user) && (
              <DropdownMenuItem onClick={() => handleProxyLogin(user)} disabled={user.status === 'inactive'}>
                <ExternalLink className="h-4 w-4 mr-2" />Proxy as User
              </DropdownMenuItem>
            )}
            {/* v20 Section F3 — mark a user's expiring license(s) as renewing (AO + BA) */}
            {canRenewalStatus && expiringProductsForUser(user.id).length > 0 && (
              <DropdownMenuItem onClick={() => handleMarkUserRenewing(user)} disabled={readOnly}>
                <RotateCw className="h-4 w-4 mr-2" />
                {expiringProductsForUser(user.id).length > 1 ? 'Mark all licenses as renewing' : 'Mark license as renewing'}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {user.status === 'inactive' ? (
              can('users.deactivate') && (
                <DropdownMenuItem onClick={() => handleReactivate(user)} disabled={readOnly}>
                  <UserCheck className="h-4 w-4 mr-2" />Activate
                </DropdownMenuItem>
              )
            ) : (
              can('users.deactivate') && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleDeactivate(user)}
                  disabled={readOnly || isLastActiveOwner(user)}
                >
                  <UserX className="h-4 w-4 mr-2" />Deactivate
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Bulk Import + Add User are available to Account Owner and License Admin.
  const canManageUsers = can('users.add');

  const headerActions = (
    <div className="flex items-center gap-2">
      {canManageUsers && (
        <Button variant="outline" onClick={() => setBulkOpen(true)} disabled={readOnly}>
          <Upload className="h-4 w-4 mr-2" />Bulk Import
        </Button>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button onClick={() => openDrawer(null, 'add')} disabled={readOnly || !canManageUsers}>
              <Plus className="h-4 w-4 mr-2" />Add Contact
            </Button>
          </span>
        </TooltipTrigger>
        {readOnly && <TooltipContent>{READ_ONLY_TOOLTIP}</TooltipContent>}
      </Tooltip>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="Users & Contacts"
          description="Manage users and contacts for your company."
          showCompanyContext={false}
          primaryAction={canManageUsers ? headerActions : undefined}
        />

        <SearchFilterCard
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search by name, username, or email..."
          onReset={resetFilters}
          filters={
            <>
              <FilterField label="Role" value={roleFilter} onChange={(v) => { setRoleFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Roles' },
                  { value: 'account_owner', label: ROLE_LABELS.account_owner },
                  { value: 'billing_admin', label: ROLE_LABELS.billing_admin },
                  { value: 'license_admin', label: ROLE_LABELS.license_admin },
                  { value: 'registered_contact', label: ROLE_LABELS.registered_contact },
                ]} />
              <FilterField label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'invited', label: 'Invited' },
                  { value: 'inactive', label: 'Inactive' },
                ]} />
              <FilterField label="Created" type="dateRange" dateFromValue={createdFrom} dateToValue={createdTo}
                onDateFromChange={(d) => { setCreatedFrom(d); setCurrentPage(1); }}
                onDateToChange={(d) => { setCreatedTo(d); setCurrentPage(1); }} />
            </>
          }
        />

        {/* v19/v20 Section C3/D — expiring-at-renewal filter chip (only when column shown) */}
        {showRenewalColumn && (
          <div className="flex items-center gap-2">
            <Button
              variant={expiringOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setExpiringOnly(v => !v); setCurrentPage(1); }}
              className="gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" />
              Expiring at renewal
            </Button>
          </div>
        )}

        <div>
          <DataTable
            columns={showRenewalColumn ? columns : columns.filter(c => c.key !== 'renewalStatus')}
            data={paginatedUsers} keyExtractor={(user) => user.id} emptyMessage="No contacts found." />
          <Card className="rounded-t-none border-t-0">
            <PaginationControls currentPage={currentPage} totalPages={totalPages} pageSize={pageSize}
              totalRecords={filteredUsers.length} onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
          </Card>
        </div>
      </div>

      <UserEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        user={drawerUser}
        readOnly={readOnly}
        onSaved={() => setDrawerOpen(false)}
      />

      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </MainLayout>
  );
};

/* ============================================================
 * UserEditDrawer — Add / Edit. Read-only behavior is driven by
 * the readOnly flag (Pending Payment / Suspended), not a mode.
 * ========================================================== */
interface UserEditDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: DrawerMode;
  user: User | null;
  readOnly: boolean;
  onSaved: () => void;
}

const UserEditDrawer = ({ open, onOpenChange, mode, user, readOnly, onSaved }: UserEditDrawerProps) => {
  const {
    currentCompany, hasAccess, getCompanySubscriptions, getCompanyUsers,
    licenses, assignLicense, unassignLicense, getAssignedLicenseCount,
    markLicensesExpiringAtRenewal,
    addUser, updateUser, isUsernameTaken,
  } = useApp();
  const { toast } = useToast();

  const editorIsAccountOwner = hasAccess(['account_owner']);
  const editorIsLicenseAdmin = hasAccess(['license_admin']);
  // Q10: the expiring-seat assignment notice only shows when the EFFECTIVE role
  // is License Admin alone — AO and BA can change the renewal status themselves
  // from the Manage Licenses drawer, so the notice isn't relevant for them.
  const editorIsOnlyLicenseAdmin =
    editorIsLicenseAdmin && !hasAccess(['account_owner', 'billing_admin']);

  // Role checkboxes the editor is allowed to SEE/GRANT.
  const visibleRoles: Role[] = editorIsAccountOwner
    ? ['account_owner', 'billing_admin', 'license_admin', 'registered_contact']
    : editorIsLicenseAdmin
      ? ['registered_contact']
      : [];

  const subscriptions = getCompanySubscriptions().filter(s =>
    s.status === 'active' || s.status === 'overdue' || s.status === 'suspended' || s.status === 'pending_payment'
  );

  // -------- Form state --------
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState<Role[]>(['registered_contact']);
  // Map of `${subscriptionId}:${productId}` → checked
  const [productCheck, setProductCheck] = useState<Record<string, boolean>>({});
  const [dataNetOptIn, setDataNetOptIn] = useState(true);
  const [active, setActive] = useState(true);

  // -------- Initialize when drawer opens --------
  useEffect(() => {
    if (!open) return;
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setUsername(user.username || generateUsername(user.firstName, user.lastName));
      setUsernameTouched(true); // prevent auto-overwriting existing usernames
      setEmail(user.email);
      setPhone(user.phone || '');
      setRoles(user.roles);
      setDataNetOptIn(user.dataNetEmailOptIn !== false);
      setActive(user.status !== 'inactive');
      // Seed the product checkboxes from current license set
      const initial: Record<string, boolean> = {};
      subscriptions.forEach(sub => {
        sub.products.forEach(prod => {
          if (prod.name === 'DataNet') return;
          const key = `${sub.id}:${prod.id}`;
          initial[key] = licenses.some(l =>
            l.userId === user.id && l.subscriptionId === sub.id && l.productId === prod.id
          );
        });
      });
      setProductCheck(initial);
    } else {
      // Add mode
      setFirstName('');
      setLastName('');
      setUsername('');
      setUsernameTouched(false);
      setEmail('');
      setPhone('');
      setRoles(editorIsAccountOwner ? ['registered_contact'] : ['registered_contact']);
      setDataNetOptIn(true);
      setActive(true);
      const initial: Record<string, boolean> = {};
      subscriptions.forEach(sub => {
        sub.products.forEach(prod => {
          if (prod.name === 'DataNet') return;
          initial[`${sub.id}:${prod.id}`] = false;
        });
      });
      setProductCheck(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  // Auto-populate username from first+last name while user hasn't manually edited it
  useEffect(() => {
    if (!open) return;
    if (usernameTouched) return;
    const base = generateUsername(firstName, lastName);
    if (!base) return;
    if (!currentCompany) {
      setUsername(base);
      return;
    }
    // Find a non-conflicting variant.
    let candidate = base;
    let i = 1;
    while (isUsernameTaken(candidate, currentCompany.id, user?.id)) {
      candidate = `${base}${i}`;
      i++;
    }
    setUsername(candidate);
  }, [firstName, lastName, mode, open, usernameTouched, currentCompany, isUsernameTaken, user?.id]);

  // The form is read-only when the company is in read-only mode (Pending Payment /
  // Suspended) OR the editor has no role-grant permissions for any visible role.
  const isReadOnlyView = readOnly || visibleRoles.length === 0;
  const usernameDuplicate = useMemo(() => {
    if (!username.trim() || !currentCompany) return false;
    return isUsernameTaken(username.trim(), currentCompany.id, user?.id);
  }, [username, currentCompany, isUsernameTaken, user?.id]);

  const isLastActiveOwner = (() => {
    if (!user) return false;
    if (!user.roles.includes('account_owner')) return false;
    const others = getCompanyUsers().filter(u =>
      u.id !== user.id && u.roles.includes('account_owner') && u.status !== 'inactive'
    );
    return others.length === 0;
  })();

  const canSave = (() => {
    if (isReadOnlyView) return false;
    if (!firstName.trim() || !lastName.trim()) return false;
    if (!username.trim() || usernameDuplicate) return false;
    if (!email.trim() || !email.includes('@')) return false;
    if (roles.length === 0) return false;
    return true;
  })();

  const toggleRole = (role: Role) => {
    setRoles(prev => {
      if (prev.includes(role)) {
        // Can't unset the only role; can't remove Account Owner if it's the last owner editing self
        if (prev.length === 1) return prev;
        if (role === 'account_owner' && user && isLastActiveOwner) return prev;
        return prev.filter(r => r !== role);
      }
      return [...prev, role];
    });
  };

  // ============================================================
  // EXPIRING SEAT ASSIGNMENT — v25 going-away-seat check, applied to the
  // Users & Contacts assign path (same rule as the Manage Licenses drawer):
  //   pendingRenewalCount    = renewalSeatCount (if set) OR licenseCount
  //   currentlyAssignedCount = active assigned licenses (excl. pending-payment
  //                            and deactivated rows)
  // An assignment that pushes assigned above the renewal count fills a seat
  // that's going away at renewal → warn first, tag expiringAtRenewal on confirm.
  // ============================================================
  type ExpiringAssignItem = { subId: string; prodId: string; prodName: string; renewalDate: string };
  const [pendingExpiringAssigns, setPendingExpiringAssigns] = useState<{
    userId: string;
    userName: string;
    items: ExpiringAssignItem[];
  } | null>(null);

  const willFillExpiringSeat = (subId: string, prodId: string): boolean => {
    const sub = subscriptions.find(s => s.id === subId);
    const prod = sub?.products.find(p => p.id === prodId);
    if (!prod) return false;
    const pendingRenewalCount = prod.renewalSeatCount ?? prod.licenseCount;
    const currentlyAssignedCount = licenses.filter(l =>
      l.subscriptionId === subId &&
      l.productId === prodId &&
      !!l.userId &&
      l.status !== 'pending_payment' &&
      !l.deactivatedAt
    ).length;
    const fills = currentlyAssignedCount + 1 > pendingRenewalCount;
    // Debug log — remove after verification
    console.log('[Assign Check]', {
      source: 'UsersPage', productId: prodId, pendingRenewalCount, currentlyAssignedCount,
      willFillExpiringSeat: fills,
    });
    return fills;
  };

  // "Assign anyway" — perform the deferred assignments and tag them expiring.
  const confirmExpiringAssigns = () => {
    if (!pendingExpiringAssigns) return;
    const { userId, userName, items } = pendingExpiringAssigns;
    items.forEach(it => {
      const ok = assignLicense(userId, it.subId, it.prodId);
      if (ok) markLicensesExpiringAtRenewal(it.subId, it.prodId, [userId], true);
    });
    toast({
      title: 'Assigned to expiring seat',
      description: `${userName} is assigned to a seat that expires at renewal. They'll lose access unless the seat is marked as renewing before then.`,
    });
    setPendingExpiringAssigns(null);
    onSaved();
  };

  // Cancel — skip ONLY the expiring assignments; everything else already saved.
  const cancelExpiringAssigns = () => {
    if (!pendingExpiringAssigns) return;
    toast({
      title: 'Assignment cancelled',
      description: `${pendingExpiringAssigns.items.map(i => i.prodName).join(', ')} was not assigned. Other changes were saved.`,
    });
    setPendingExpiringAssigns(null);
    onSaved();
  };

  const handleSave = () => {
    if (!currentCompany) return;
    if (!canSave) return;

    let targetUserId: string;
    if (mode === 'add') {
      const created = addUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        roles,
        status: 'invited',
        lastLogin: null,
        dataNetEmailOptIn: dataNetOptIn,
      });
      targetUserId = created.id;
      toast({ title: 'Contact added', description: `${created.firstName} ${created.lastName} has been added.` });
    } else if (user) {
      targetUserId = user.id;
      updateUser(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        roles,
        dataNetEmailOptIn: dataNetOptIn,
        // status flip respects the active switch — invited users stay invited until they log in.
        status: active
          ? (user.status === 'invited' ? 'invited' : 'active')
          : 'inactive',
      });
      toast({ title: 'User updated', description: `${firstName} ${lastName} saved.` });
    } else {
      return;
    }

    // Diff product checkboxes against existing licenses. New assignments that
    // would fill a going-away seat are DEFERRED behind the expiring-seat warning
    // dialog; everything else commits immediately.
    const deferred: ExpiringAssignItem[] = [];
    subscriptions.forEach(sub => {
      sub.products.forEach(prod => {
        if (prod.name === 'DataNet') return;
        const key = `${sub.id}:${prod.id}`;
        const desired = !!productCheck[key];
        const existing = licenses.some(l =>
          l.userId === targetUserId && l.subscriptionId === sub.id && l.productId === prod.id
        );
        if (desired && !existing) {
          if (willFillExpiringSeat(sub.id, prod.id)) {
            deferred.push({ subId: sub.id, prodId: prod.id, prodName: prod.name, renewalDate: sub.renewalDate });
          } else {
            assignLicense(targetUserId, sub.id, prod.id);
          }
        } else if (!desired && existing) {
          unassignLicense(targetUserId, sub.id, prod.id);
        }
      });
    });

    if (deferred.length > 0) {
      // Fire the warning dialog — STOP, do not assign these yet.
      setPendingExpiringAssigns({
        userId: targetUserId,
        userName: `${firstName.trim()} ${lastName.trim()}`,
        items: deferred,
      });
      return;
    }

    onSaved();
  };

  // -------- Render --------
  // Editors with no role-grant permissions still need to be able to open the
  // drawer (it's the only entry point now that Name is a link); they just see
  // it in read-only mode via isReadOnlyView. Add mode is the exception — we
  // shouldn't allow creating a user with no grantable roles.
  if (!visibleRoles.length && mode === 'add') {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>User Details</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-6 mt-4">
          {/* Section A — Personal Information */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Personal Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="user-fn">First Name *</Label>
                <Input id="user-fn" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} disabled={isReadOnlyView} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-ln">Last Name *</Label>
                <Input id="user-ln" value={lastName}
                  onChange={(e) => setLastName(e.target.value)} disabled={isReadOnlyView} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-un">Username *</Label>
              <Input id="user-un" value={username}
                onChange={(e) => { setUsername(e.target.value); setUsernameTouched(true); }}
                disabled={isReadOnlyView}
              />
              {usernameDuplicate && (
                <p className="text-xs text-destructive">Username already exists.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-email">Email Address *</Label>
              <Input id="user-email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} disabled={isReadOnlyView} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-phone">Phone Number</Label>
              <Input id="user-phone" value={phone}
                onChange={(e) => setPhone(e.target.value)} disabled={isReadOnlyView} />
            </div>
          </section>

          {/* Section B — Account info (read-only) */}
          {mode !== 'add' && user && (
            <section className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Created on</p>
                  <p className="text-sm">{formatDate(user.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last active</p>
                  <p className="text-sm">{formatDateTime(user.lastLogin)}</p>
                </div>
              </div>
            </section>
          )}

          {/* Section C — Assign Role */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Assign Role</h3>
            <div className="grid grid-cols-2 gap-2">
              {visibleRoles.map(role => {
                const checked = roles.includes(role);
                const isAccountOwnerRow = role === 'account_owner';
                // Ownership transfer is out of scope for v7a, so Account Owner is read-only
                const disabled = isReadOnlyView || isAccountOwnerRow;
                return (
                  <Tooltip key={role}>
                    <TooltipTrigger asChild>
                      <label className={`flex items-center gap-2 border rounded-md p-2 ${disabled && !isReadOnlyView ? 'opacity-70' : ''}`}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => !disabled && toggleRole(role)}
                          disabled={disabled}
                        />
                        <span className="text-sm">{ROLE_LABELS[role]}</span>
                      </label>
                    </TooltipTrigger>
                    {isAccountOwnerRow && !isReadOnlyView && (
                      <TooltipContent>Ownership transfer coming soon.</TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </section>

          {/* Section D — Subscriptions & Products */}
          {subscriptions.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Subscriptions & Products</h3>
              <div className="space-y-3">
                {subscriptions.map(sub => (
                  <div key={sub.id} className="border rounded-md p-3 space-y-2">
                    <div className="text-sm font-medium">{sub.name}</div>
                    <div className="space-y-1">
                      {sub.products.filter(p => p.name !== 'DataNet').map(prod => {
                        const key = `${sub.id}:${prod.id}`;
                        const checked = !!productCheck[key];
                        const assigned = getAssignedLicenseCount(sub.id, prod.id);
                        const available = prod.licenseCount - assigned;
                        const alreadyHas = user
                          ? licenses.some(l => l.userId === user.id && l.subscriptionId === sub.id && l.productId === prod.id)
                          : false;
                        const noSeats = !checked && available <= 0 && !alreadyHas;
                        // Q10: a product has expiring seats when its committed renewal
                        // seat count is lower than its current count. License Admin sees an
                        // informational notice when assigning to such a product because they
                        // can't toggle the seat's renewal status themselves.
                        // (v25 — renewalSeatCount is the live field; scheduledLicenseCount is legacy.)
                        const hasExpiringSeats =
                          (prod.renewalSeatCount ?? prod.scheduledLicenseCount ?? prod.licenseCount) < prod.licenseCount;
                        const showExpiringNotice =
                          editorIsOnlyLicenseAdmin && checked && !alreadyHas && hasExpiringSeats;
                        const endOfCycleDate = new Date(sub.renewalDate).toLocaleDateString('en-US', {
                          month: 'long', day: 'numeric', year: 'numeric',
                        });
                        return (
                          <div key={key}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <label className="flex items-center justify-between gap-2 py-1">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(v) =>
                                        setProductCheck(prev => ({ ...prev, [key]: v as boolean }))
                                      }
                                      disabled={isReadOnlyView || noSeats}
                                    />
                                    <span className="text-sm">{prod.name}</span>
                                  </div>
                                  {!checked && (
                                    <span className="text-xs text-muted-foreground">
                                      {available} available
                                    </span>
                                  )}
                                </label>
                              </TooltipTrigger>
                              {noSeats && (
                                <TooltipContent>
                                  No available seats for this product. Add seats in Manage Licenses.
                                </TooltipContent>
                              )}
                            </Tooltip>
                            {showExpiringNotice && (
                              <div className="mt-1.5 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-xs text-warning">
                                <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span>
                                  This license is paid through {endOfCycleDate}. To continue this seat at renewal, your Billing Admin must mark it as renewing in Manage Licenses.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {sub.products.every(p => p.name === 'DataNet') && (
                        <p className="text-xs text-muted-foreground">DataNet is auto-included for active users.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section E — DataNet Email */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">DataNet Email</h3>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="user-dn" className="text-sm">Receive DataNet email updates</Label>
                <p className="text-xs text-muted-foreground">
                  Monthly industry data and alerts will be sent to the user's email address.
                </p>
              </div>
              <Switch id="user-dn" checked={dataNetOptIn}
                onCheckedChange={setDataNetOptIn} disabled={isReadOnlyView} />
            </div>
          </section>

          {/* Section F — Status */}
          {mode !== 'add' && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Status</h3>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="user-status" className="text-sm">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    {user?.status === 'invited'
                      ? 'User has been invited and will become Active on first login.'
                      : 'Inactive users cannot log in and lose all license assignments.'}
                  </p>
                </div>
                <Switch
                  id="user-status"
                  checked={active}
                  onCheckedChange={(v) => {
                    if (!v && isLastActiveOwner) {
                      toast({ title: 'Cannot deactivate the last Account Owner.', variant: 'destructive' });
                      return;
                    }
                    setActive(v);
                  }}
                  disabled={isReadOnlyView || isLastActiveOwner}
                />
              </div>
            </section>
          )}
        </div>

        {!isReadOnlyView && (
          <SheetFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {mode === 'add' ? 'Add Contact' : 'Save'}
            </Button>
          </SheetFooter>
        )}

        {/* Expiring Seat Assignment Warning (v25 — same rule as Manage Licenses drawer) */}
        <AlertDialog
          open={!!pendingExpiringAssigns}
          // Esc/overlay dismiss just closes the dialog (state cleared, drawer stays
          // open with checkboxes intact — re-saving re-fires the warning). The Cancel
          // and Assign-anyway buttons carry the real handlers; this stays idempotent
          // so their clicks don't double-fire through the close event.
          onOpenChange={(o) => !o && setPendingExpiringAssigns(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingExpiringAssigns && pendingExpiringAssigns.items.length > 1
                  ? 'These seats are set to expire at renewal'
                  : 'This seat is set to expire at renewal'}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                {pendingExpiringAssigns?.items.map(it => (
                  <span key={`${it.subId}:${it.prodId}`} className="block">
                    You are assigning <strong>{pendingExpiringAssigns.userName}</strong> to a seat on{' '}
                    <strong>{it.prodName}</strong> that is scheduled to be removed at the next renewal
                    ({formatDate(it.renewalDate)}).
                  </span>
                ))}
                <span className="block">
                  After renewal, this user will lose access unless you increase the renewal seat
                  count OR mark this seat as renewing before then.
                </span>
                <span className="block">Continue with the assignment?</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelExpiringAssigns}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmExpiringAssigns}>Assign anyway</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
};

export default UsersPage;
