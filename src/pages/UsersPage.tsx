import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, UserRole, User } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ListingPageHeader,
  SearchFilterCard,
  FilterField,
  DataTable,
  DataTableColumn,
  PaginationControls,
} from '@/components/listing';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, MoreHorizontal, Download, Eye, Edit, KeyRound, Mail, UserX, UserCheck, ExternalLink,
} from 'lucide-react';

const roleLabels: Record<UserRole, string> = {
  owner: 'Account Owner', billing: 'Billing User', admin: 'Firm Admin', standard: 'Standard User',
};
const roleColors: Record<UserRole, string> = {
  owner: 'badge-owner', billing: 'badge-billing', admin: 'badge-admin', standard: 'badge-standard',
};
const statusColors: Record<string, string> = {
  active: 'status-active', invited: 'status-invited', inactive: 'status-inactive',
};

export const UsersPage = () => {
  const navigate = useNavigate();
  const {
    currentCompany, getCompanyUsers, addUser, deactivateUser, reactivateUser,
    changeUserRoles, hasAccess, startProxySession, getUserAssignedProducts,
  } = useApp();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [lastLoginFilter, setLastLoginFilter] = useState<string>('all');
  const [createdFrom, setCreatedFrom] = useState<Date>();
  const [createdTo, setCreatedTo] = useState<Date>();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [viewUserOpen, setViewUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [changeRolesOpen, setChangeRolesOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', roles: ['standard'] as UserRole[], phone: '', jobTitle: '', sendInvite: true });
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [dataNetPrefs, setDataNetPrefs] = useState<Record<string, boolean>>({});

  const users = getCompanyUsers();
  const isOwner = hasAccess(['owner']);
  const isAdmin = hasAccess(['admin']);
  const canProxy = hasAccess(['billing', 'admin']);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter as UserRole);
    let matchesLastLogin = true;
    if (lastLoginFilter === 'never') { matchesLastLogin = !user.lastLogin; }
    else if (lastLoginFilter !== 'all') {
      const days = parseInt(lastLoginFilter);
      if (user.lastLogin) {
        const daysAgo = Math.floor((Date.now() - new Date(user.lastLogin).getTime()) / (1000 * 60 * 60 * 24));
        matchesLastLogin = daysAgo <= days;
      } else { matchesLastLogin = false; }
    }
    let matchesCreated = true;
    if (createdFrom) matchesCreated = new Date(user.createdAt) >= createdFrom;
    if (createdTo && matchesCreated) matchesCreated = new Date(user.createdAt) <= createdTo;
    return matchesSearch && matchesStatus && matchesRole && matchesLastLogin && matchesCreated;
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => { setSearchQuery(''); setStatusFilter('all'); setRoleFilter('all'); setLastLoginFilter('all'); setCreatedFrom(undefined); setCreatedTo(undefined); setCurrentPage(1); };

  const handleAddUser = () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email) { toast({ title: 'Validation Error', description: 'Please fill in all required fields.', variant: 'destructive' }); return; }
    const user = addUser({ firstName: newUser.firstName, lastName: newUser.lastName, email: newUser.email, roles: newUser.roles, status: 'invited', lastLogin: null, phone: newUser.phone, jobTitle: newUser.jobTitle });
    toast({ title: 'User Created', description: newUser.sendInvite ? `User created and invitation sent to ${user.email}` : `User created. No invitation sent.` });
    setAddUserOpen(false);
    setNewUser({ firstName: '', lastName: '', email: '', roles: ['standard'], phone: '', jobTitle: '', sendInvite: true });
  };

  const handleChangeRoles = () => {
    if (!selectedUser) return;
    if (selectedRoles.length === 0) { toast({ title: 'Validation Error', description: 'At least one role must be selected.', variant: 'destructive' }); return; }
    const success = changeUserRoles(selectedUser.id, selectedRoles);
    if (!success) { toast({ title: 'Cannot Remove Role', description: 'Cannot remove the last Account Owner.', variant: 'destructive' }); return; }
    toast({ title: 'Roles Updated', description: `Roles updated for ${selectedUser.firstName} ${selectedUser.lastName}` });
    setChangeRolesOpen(false); setSelectedUser(null);
  };

  const handleDeactivate = () => { if (!selectedUser) return; deactivateUser(selectedUser.id); toast({ title: 'User Deactivated', description: `${selectedUser.firstName} ${selectedUser.lastName} has been deactivated.` }); setDeactivateOpen(false); setSelectedUser(null); };
  const handleReactivate = () => { if (!selectedUser) return; reactivateUser(selectedUser.id); toast({ title: 'User Reactivated', description: `${selectedUser.firstName} ${selectedUser.lastName} has been reactivated.` }); setReactivateOpen(false); setSelectedUser(null); };

  const handleProxyLogin = (user: User) => {
    if (user.status === 'inactive') { toast({ title: 'Cannot Proxy', description: 'Cannot proxy login to an inactive user.', variant: 'destructive' }); return; }
    startProxySession(user.id);
    toast({ title: 'Proxy Session Started', description: `You are now viewing as ${user.firstName} ${user.lastName}` });
    navigate('/dashboard');
  };

  const openChangeRoles = (user: User) => { setSelectedUser(user); setSelectedRoles([...user.roles]); setChangeRolesOpen(true); };
  const toggleRole = (role: UserRole) => { setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]); };
  const toggleNewUserRole = (role: UserRole) => {
    if (newUser.roles.includes(role)) { if (newUser.roles.length > 1) setNewUser({ ...newUser, roles: newUser.roles.filter(r => r !== role) }); }
    else { setNewUser({ ...newUser, roles: [...newUser.roles, role] }); }
  };
  const canAssignRole = (role: UserRole): boolean => { if (isOwner) return true; if (isAdmin) return role === 'standard' || role === 'admin'; return false; };

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name', header: 'Name',
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>
          </div>
          <div>
            <p className="font-medium">{user.firstName} {user.lastName}</p>
            {user.jobTitle && <p className="text-xs text-muted-foreground">{user.jobTitle}</p>}
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (user) => <span className="text-muted-foreground">{user.email}</span> },
    {
      key: 'roles', header: 'Roles',
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.map(role => <Badge key={role} variant="outline" className={`text-xs ${roleColors[role]}`}>{roleLabels[role]}</Badge>)}
        </div>
      ),
    },
    {
      key: 'products', header: 'Product Access',
      render: (user) => {
        const products = getUserAssignedProducts(user.id);
        if (products.length === 0) return <span className="text-muted-foreground text-xs">None</span>;
        const unique = Array.from(new Set(products.map(p => p.productName)));
        return (
          <div className="flex flex-wrap gap-1">
            {unique.map(name => (
              <Badge key={name} variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">{name}</Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'datanet', header: 'DataNet Emails',
      render: (user) => {
        const checked = dataNetPrefs[user.id] !== false; // default to checked
        return (
          <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Switch
                    checked={checked}
                    onCheckedChange={(v) => setDataNetPrefs(prev => ({ ...prev, [user.id]: v }))}
                    disabled={user.status === 'inactive'}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Controls whether this user receives DataNet email updates.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
    {
      key: 'status', header: 'Status',
      render: (user) => <Badge variant="outline" className={statusColors[user.status]}>{user.status}</Badge>,
    },
    {
      key: 'actions', header: '', className: 'w-[50px] text-right',
      render: (user) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedUser(user); setViewUserOpen(true); }}><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedUser(user); setEditUserOpen(true); }}><Edit className="h-4 w-4 mr-2" />Edit User</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openChangeRoles(user)}><KeyRound className="h-4 w-4 mr-2" />Change Roles</DropdownMenuItem>
            <DropdownMenuItem><Mail className="h-4 w-4 mr-2" />Reset Password</DropdownMenuItem>
            {user.status === 'invited' && <DropdownMenuItem><Mail className="h-4 w-4 mr-2" />Resend Invite</DropdownMenuItem>}
            <DropdownMenuSeparator />
            {canProxy && <DropdownMenuItem onClick={() => handleProxyLogin(user)} disabled={user.status === 'inactive'}><ExternalLink className="h-4 w-4 mr-2" />Proxy Login</DropdownMenuItem>}
            <DropdownMenuSeparator />
            {user.status === 'active' || user.status === 'invited' ? (
              <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedUser(user); setDeactivateOpen(true); }}><UserX className="h-4 w-4 mr-2" />Deactivate</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => { setSelectedUser(user); setReactivateOpen(true); }}><UserCheck className="h-4 w-4 mr-2" />Reactivate</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'active').length;
  const inactiveUsers = users.filter(u => u.status === 'inactive').length;
  const pendingUsers = users.filter(u => u.status === 'invited').length;

  const summaryCards = [
    { label: 'Total Users', value: totalUsers, icon: 'users', color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Active Users', value: activeUsers, icon: 'check', color: 'text-success', bg: 'bg-success/10' },
    { label: 'Inactive Users', value: inactiveUsers, icon: 'x', color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Pending Invitations', value: pendingUsers, icon: 'mail', color: 'text-warning', bg: 'bg-warning/10' },
  ] as const;

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader title="Users" description="Manage users, access, roles, and communication preferences."
          primaryAction={<Button onClick={() => setAddUserOpen(true)}><Plus className="h-4 w-4 mr-2" />Add User</Button>}
          secondaryAction={<Button variant="outline"><Download className="h-4 w-4 mr-2" />Export CSV</Button>}
        />

        <div className="grid gap-4 md:grid-cols-4">
          {summaryCards.map(s => {
            const Icon = s.icon === 'users' ? UserCheck : s.icon === 'check' ? UserCheck : s.icon === 'x' ? UserX : Mail;
            return (
              <Card key={s.label}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <SearchFilterCard searchValue={searchQuery} onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search by name or email..." onReset={resetFilters}
          filters={
            <>
              <FilterField label="Role" value={roleFilter} onChange={(v) => { setRoleFilter(v); setCurrentPage(1); }}
                options={[{ value: 'all', label: 'All Roles' }, { value: 'owner', label: 'Account Owner' }, { value: 'billing', label: 'Billing User' }, { value: 'admin', label: 'Firm Admin' }, { value: 'standard', label: 'Standard User' }]} />
              <FilterField label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
                options={[{ value: 'all', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'invited', label: 'Invited' }, { value: 'inactive', label: 'Inactive' }]} />
              <FilterField label="Last Login" value={lastLoginFilter} onChange={(v) => { setLastLoginFilter(v); setCurrentPage(1); }}
                options={[{ value: 'all', label: 'All Time' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: 'never', label: 'Never' }]} />
              <FilterField label="Created" type="dateRange" dateFromValue={createdFrom} dateToValue={createdTo}
                onDateFromChange={(d) => { setCreatedFrom(d); setCurrentPage(1); }} onDateToChange={(d) => { setCreatedTo(d); setCurrentPage(1); }} />
            </>
          }
        />

        <div>
          <DataTable columns={columns} data={paginatedUsers} keyExtractor={(user) => user.id} emptyMessage="No users found." />
          <Card className="rounded-t-none border-t-0">
            <PaginationControls currentPage={currentPage} totalPages={totalPages} pageSize={pageSize}
              totalRecords={filteredUsers.length} onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
          </Card>
        </div>
      </div>

      {/* Add User Modal */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add User</DialogTitle><DialogDescription>Create a new user and optionally send an invitation.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>First Name *</Label><Input value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} placeholder="John" /></div>
              <div className="space-y-2"><Label>Last Name *</Label><Input value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} placeholder="Doe" /></div>
            </div>
            <div className="space-y-2"><Label>Email *</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@company.com" /></div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['owner', 'billing', 'admin', 'standard'] as UserRole[]).map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox id={`role-${role}`} checked={newUser.roles.includes(role)} onCheckedChange={() => toggleNewUserRole(role)} disabled={!canAssignRole(role)} />
                    <Label htmlFor={`role-${role}`} className="text-sm font-normal">{roleLabels[role]}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="sendInvite" checked={newUser.sendInvite} onCheckedChange={(checked) => setNewUser({ ...newUser, sendInvite: checked as boolean })} />
              <Label htmlFor="sendInvite" className="text-sm font-normal">Send invitation email now</Label>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddUserOpen(false)}>Cancel</Button><Button onClick={handleAddUser}>Create User</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Modal */}
      <Dialog open={viewUserOpen} onOpenChange={setViewUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>User Details</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-medium text-primary">{selectedUser.firstName.charAt(0)}{selectedUser.lastName.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.firstName} {selectedUser.lastName}</h3>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Status</p><Badge variant="outline" className={statusColors[selectedUser.status]}>{selectedUser.status}</Badge></div>
                <div><p className="text-sm text-muted-foreground">Roles</p><div className="flex flex-wrap gap-1 mt-1">{selectedUser.roles.map(role => <Badge key={role} variant="outline" className={roleColors[role]}>{roleLabels[role]}</Badge>)}</div></div>
                <div><p className="text-sm text-muted-foreground">Last Login</p><p className="font-medium">{selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Never'}</p></div>
                <div><p className="text-sm text-muted-foreground">Created</p><p className="font-medium">{new Date(selectedUser.createdAt).toLocaleString()}</p></div>
              </div>
              {/* Product License Assignment */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Products Assigned</h4>
                {(() => {
                  const products = getUserAssignedProducts(selectedUser.id);
                  if (products.length === 0) return <p className="text-sm text-muted-foreground">No products assigned.</p>;
                  const grouped = products.reduce<Record<string, string[]>>((acc, p) => {
                    if (!acc[p.subscriptionName]) acc[p.subscriptionName] = [];
                    acc[p.subscriptionName].push(p.productName);
                    return acc;
                  }, {});
                  return (
                    <div className="space-y-2">
                      {Object.entries(grouped).map(([subName, prods]) => (
                        <div key={subName} className="p-2 bg-muted/50 rounded-md">
                          <div className="text-xs text-muted-foreground mb-1">{subName}</div>
                          <div className="flex flex-wrap gap-1">
                            {prods.map(p => <Badge key={p} variant="outline">{p}</Badge>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setViewUserOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          {selectedUser && <div className="space-y-4"><p className="text-muted-foreground">Editing {selectedUser.firstName} {selectedUser.lastName}</p></div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast({ title: 'User Updated', description: 'User details have been saved.' }); setEditUserOpen(false); }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Roles Modal */}
      <Dialog open={changeRolesOpen} onOpenChange={setChangeRolesOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Roles</DialogTitle><DialogDescription>Update roles for {selectedUser?.firstName} {selectedUser?.lastName}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            {(['owner', 'billing', 'admin', 'standard'] as UserRole[]).map((role) => (
              <div key={role} className="flex items-center space-x-2">
                <Checkbox id={`change-role-${role}`} checked={selectedRoles.includes(role)} onCheckedChange={() => toggleRole(role)} disabled={!canAssignRole(role)} />
                <Label htmlFor={`change-role-${role}`}>{roleLabels[role]}</Label>
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setChangeRolesOpen(false)}>Cancel</Button><Button onClick={handleChangeRoles}>Save Roles</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Modal */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deactivate User</DialogTitle><DialogDescription>Are you sure you want to deactivate {selectedUser?.firstName} {selectedUser?.lastName}?</DialogDescription></DialogHeader>
          <div className="text-sm text-muted-foreground"><p>This will:</p><ul className="list-disc list-inside mt-2 space-y-1"><li>Remove portal access immediately</li><li>Unassign all licenses</li></ul></div>
          <DialogFooter><Button variant="outline" onClick={() => setDeactivateOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDeactivate}>Deactivate</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate Modal */}
      <Dialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reactivate User</DialogTitle><DialogDescription>Reactivate {selectedUser?.firstName} {selectedUser?.lastName}?</DialogDescription></DialogHeader>
          <p className="text-sm text-muted-foreground">The user will regain portal access. Licenses are not automatically reassigned.</p>
          <DialogFooter><Button variant="outline" onClick={() => setReactivateOpen(false)}>Cancel</Button><Button onClick={handleReactivate}>Reactivate</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
