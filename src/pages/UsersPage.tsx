import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, UserRole, User } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  MoreHorizontal,
  UserPlus,
  Download,
  Eye,
  Edit,
  KeyRound,
  Mail,
  UserX,
  UserCheck,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

const roleLabels: Record<UserRole, string> = {
  owner: 'Account Owner',
  billing: 'Billing User',
  admin: 'Firm Admin',
  standard: 'Standard User',
};

const roleColors: Record<UserRole, string> = {
  owner: 'badge-owner',
  billing: 'badge-billing',
  admin: 'badge-admin',
  standard: 'badge-standard',
};

const statusColors: Record<string, string> = {
  active: 'status-active',
  invited: 'status-invited',
  inactive: 'status-inactive',
};

export const UsersPage = () => {
  const navigate = useNavigate();
  const {
    currentCompany,
    getCompanyUsers,
    addUser,
    updateUser,
    deactivateUser,
    reactivateUser,
    changeUserRoles,
    hasAccess,
    startProxySession,
    demoRoles,
  } = useApp();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [lastLoginFilter, setLastLoginFilter] = useState<string>('all');
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [viewUserOpen, setViewUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [changeRolesOpen, setChangeRolesOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Add user form
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    roles: ['standard'] as UserRole[],
    phone: '',
    jobTitle: '',
    sendInvite: true,
  });

  // Change roles form
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);

  const users = getCompanyUsers();
  const isOwner = hasAccess(['owner']);
  const isAdmin = hasAccess(['admin']);
  const canProxy = hasAccess(['billing', 'admin']);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter as UserRole);
    
    let matchesLastLogin = true;
    if (lastLoginFilter === 'never') {
      matchesLastLogin = !user.lastLogin;
    } else if (lastLoginFilter !== 'all') {
      const days = parseInt(lastLoginFilter);
      if (user.lastLogin) {
        const lastLoginDate = new Date(user.lastLogin);
        const daysAgo = Math.floor((Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));
        matchesLastLogin = daysAgo <= days;
      } else {
        matchesLastLogin = false;
      }
    }
    
    return matchesSearch && matchesStatus && matchesRole && matchesLastLogin;
  });

  const handleAddUser = () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const user = addUser({
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      roles: newUser.roles,
      status: 'invited',
      lastLogin: null,
      phone: newUser.phone,
      jobTitle: newUser.jobTitle,
    });

    toast({
      title: 'User Created',
      description: newUser.sendInvite 
        ? `User created and invitation sent to ${user.email}`
        : `User created. No invitation sent.`,
    });

    setAddUserOpen(false);
    setNewUser({
      firstName: '',
      lastName: '',
      email: '',
      roles: ['standard'],
      phone: '',
      jobTitle: '',
      sendInvite: true,
    });
  };

  const handleChangeRoles = () => {
    if (!selectedUser) return;
    
    if (selectedRoles.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one role must be selected.',
        variant: 'destructive',
      });
      return;
    }

    const success = changeUserRoles(selectedUser.id, selectedRoles);
    
    if (!success) {
      toast({
        title: 'Cannot Remove Role',
        description: 'Cannot remove the last Account Owner from the company.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Roles Updated',
      description: `Roles updated for ${selectedUser.firstName} ${selectedUser.lastName}`,
    });

    setChangeRolesOpen(false);
    setSelectedUser(null);
  };

  const handleDeactivate = () => {
    if (!selectedUser) return;
    
    deactivateUser(selectedUser.id);
    
    toast({
      title: 'User Deactivated',
      description: `${selectedUser.firstName} ${selectedUser.lastName} has been deactivated and their licenses unassigned.`,
    });

    setDeactivateOpen(false);
    setSelectedUser(null);
  };

  const handleReactivate = () => {
    if (!selectedUser) return;
    
    reactivateUser(selectedUser.id);
    
    toast({
      title: 'User Reactivated',
      description: `${selectedUser.firstName} ${selectedUser.lastName} has been reactivated. Licenses are not automatically reassigned.`,
    });

    setReactivateOpen(false);
    setSelectedUser(null);
  };

  const handleProxyLogin = (user: User) => {
    if (user.status === 'inactive') {
      toast({
        title: 'Cannot Proxy',
        description: 'Cannot proxy login to an inactive user.',
        variant: 'destructive',
      });
      return;
    }

    startProxySession(user.id);
    toast({
      title: 'Proxy Session Started',
      description: `You are now viewing as ${user.firstName} ${user.lastName}`,
    });
    navigate('/dashboard');
  };

  const openChangeRoles = (user: User) => {
    setSelectedUser(user);
    setSelectedRoles([...user.roles]);
    setChangeRolesOpen(true);
  };

  const toggleRole = (role: UserRole) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const toggleNewUserRole = (role: UserRole) => {
    if (newUser.roles.includes(role)) {
      if (newUser.roles.length > 1) {
        setNewUser({ ...newUser, roles: newUser.roles.filter(r => r !== role) });
      }
    } else {
      setNewUser({ ...newUser, roles: [...newUser.roles, role] });
    }
  };

  // Check which roles current user can assign
  const canAssignRole = (role: UserRole): boolean => {
    if (isOwner) return true;
    if (isAdmin) return role === 'standard' || role === 'admin';
    return false;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-muted-foreground">
              Manage users for {currentCompany?.name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => setAddUserOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="owner">Account Owner</SelectItem>
                  <SelectItem value="billing">Billing User</SelectItem>
                  <SelectItem value="admin">Firm Admin</SelectItem>
                  <SelectItem value="standard">Standard User</SelectItem>
                </SelectContent>
              </Select>
              <Select value={lastLoginFilter} onValueChange={setLastLoginFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Last Login" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="never">Never logged in</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No users found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.slice(0, pageSize).map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{user.firstName} {user.lastName}</p>
                            {user.jobTitle && (
                              <p className="text-xs text-muted-foreground">{user.jobTitle}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map(role => (
                            <Badge 
                              key={role} 
                              variant="outline" 
                              className={`text-xs ${roleColors[role]}`}
                            >
                              {roleLabels[role]}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[user.status]}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.lastLogin 
                          ? new Date(user.lastLogin).toLocaleDateString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(user);
                              setViewUserOpen(true);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(user);
                              setEditUserOpen(true);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openChangeRoles(user)}>
                              <KeyRound className="h-4 w-4 mr-2" />
                              Change Roles
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            {user.status === 'invited' && (
                              <DropdownMenuItem>
                                <Mail className="h-4 w-4 mr-2" />
                                Resend Invite
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {canProxy && (
                              <DropdownMenuItem 
                                onClick={() => handleProxyLogin(user)}
                                disabled={user.status === 'inactive'}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Proxy Login
                                {user.status === 'inactive' && (
                                  <span className="text-xs text-muted-foreground ml-2">(Inactive)</span>
                                )}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {user.status === 'active' || user.status === 'invited' ? (
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setDeactivateOpen(true);
                                }}
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                className="text-success"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setReactivateOpen(true);
                                }}
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Reactivate
                              </DropdownMenuItem>
                            )}
                            {isOwner && (
                              <DropdownMenuItem className="text-destructive">
                                <UserX className="h-4 w-4 mr-2" />
                                Remove from Company
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min(pageSize, filteredUsers.length)} of {filteredUsers.length} users
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(parseInt(v))}>
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Add a new user to {currentCompany?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="space-y-2">
                {(['standard', 'admin', 'billing', 'owner'] as UserRole[]).map(role => (
                  <div key={role} className="flex items-center gap-2">
                    <Checkbox
                      id={`new-${role}`}
                      checked={newUser.roles.includes(role)}
                      onCheckedChange={() => toggleNewUserRole(role)}
                      disabled={!canAssignRole(role)}
                    />
                    <Label htmlFor={`new-${role}`} className="font-normal">
                      {roleLabels[role]}
                      {!canAssignRole(role) && (
                        <span className="text-xs text-muted-foreground ml-2">(Owner only)</span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title (optional)</Label>
              <Input
                id="jobTitle"
                value={newUser.jobTitle}
                onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="sendInvite"
                checked={newUser.sendInvite}
                onCheckedChange={(checked) => setNewUser({ ...newUser, sendInvite: checked as boolean })}
              />
              <Label htmlFor="sendInvite" className="font-normal">
                Send invitation email now
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Modal */}
      <Dialog open={viewUserOpen} onOpenChange={setViewUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-semibold text-primary">
                    {selectedUser.firstName.charAt(0)}{selectedUser.lastName.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h3>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline" className={statusColors[selectedUser.status]}>
                    {selectedUser.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Roles</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedUser.roles.map(role => (
                      <Badge key={role} variant="outline" className={roleColors[role]}>
                        {roleLabels[role]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Login</p>
                  <p className="font-medium">
                    {selectedUser.lastLogin 
                      ? new Date(selectedUser.lastLogin).toLocaleDateString()
                      : 'Never'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {selectedUser.jobTitle && (
                  <div>
                    <p className="text-sm text-muted-foreground">Job Title</p>
                    <p className="font-medium">{selectedUser.jobTitle}</p>
                  </div>
                )}
                {selectedUser.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedUser.phone}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewUserOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Roles Modal */}
      <Dialog open={changeRolesOpen} onOpenChange={setChangeRolesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Roles</DialogTitle>
            <DialogDescription>
              Update roles for {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(['standard', 'admin', 'billing', 'owner'] as UserRole[]).map(role => {
              const isCurrentRole = selectedUser?.roles.includes(role);
              const isCritical = role === 'owner' || role === 'billing' || role === 'admin';
              const isOnlyOwner = role === 'owner' && 
                selectedUser?.roles.includes('owner') && 
                selectedRoles.includes('owner') === false;
              
              return (
                <div key={role} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`role-${role}`}
                      checked={selectedRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                      disabled={!canAssignRole(role)}
                    />
                    <Label htmlFor={`role-${role}`} className="font-normal">
                      {roleLabels[role]}
                    </Label>
                  </div>
                  {isCritical && isCurrentRole && !selectedRoles.includes(role) && (
                    <Badge variant="outline" className="text-warning border-warning">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Critical
                    </Badge>
                  )}
                </div>
              );
            })}
            
            {selectedRoles.length === 0 && (
              <p className="text-sm text-destructive">At least one role must be selected.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRolesOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeRoles} disabled={selectedRoles.length === 0}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Modal */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {selectedUser?.firstName} {selectedUser?.lastName}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm">
                <strong>Warning:</strong> This user will lose portal access immediately.
                Assigned licenses will be automatically unassigned.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeactivate}>
              Deactivate User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate Modal */}
      <Dialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactivate User</DialogTitle>
            <DialogDescription>
              Reactivate {selectedUser?.firstName} {selectedUser?.lastName}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm">
                This user will regain portal access. 
                <strong> Licenses are not automatically reassigned</strong> and must be assigned manually.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReactivate}>
              Reactivate User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
