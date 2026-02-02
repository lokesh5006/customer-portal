import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp, User } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Key,
  Search,
  AlertTriangle,
  Check,
  Users,
  ArrowRight,
  Info,
  ArrowLeft,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const roleLabels: Record<string, string> = {
  owner: 'Account Owner',
  billing: 'Billing User',
  admin: 'Firm Admin',
  standard: 'Standard User',
};

export const LicensesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentCompany,
    getCompanySubscriptions,
    getCompanyUsers,
    getAssignedLicenseCount,
    assignLicense,
    unassignLicense,
    licenses,
    hasAccess,
  } = useApp();
  const { toast } = useToast();

  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [limitReachedOpen, setLimitReachedOpen] = useState(false);

  const subscriptions = getCompanySubscriptions();
  const users = getCompanyUsers();

  useEffect(() => {
    if (subscriptions.length > 0 && !selectedProduct) {
      setSelectedProduct(subscriptions[0].product);
    }
  }, [subscriptions, selectedProduct]);

  const currentSubscription = subscriptions.find(s => s.product === selectedProduct);
  const purchasedSeats = currentSubscription?.purchasedSeats || 0;
  const assignedSeats = getAssignedLicenseCount(selectedProduct);
  const availableSeats = purchasedSeats - assignedSeats;

  const isAssigned = (userId: string): boolean => {
    return licenses.some(l => l.userId === userId && l.productId === selectedProduct);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const userAssigned = isAssigned(user.id);
    const matchesAssigned = 
      assignedFilter === 'all' || 
      (assignedFilter === 'assigned' && userAssigned) ||
      (assignedFilter === 'not-assigned' && !userAssigned);
    
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesAssigned && matchesStatus;
  });

  const handleToggleLicense = (user: User) => {
    if (isAssigned(user.id)) {
      unassignLicense(user.id, selectedProduct);
      toast({
        title: 'License Unassigned',
        description: `License removed from ${user.firstName} ${user.lastName}`,
      });
    } else {
      if (availableSeats <= 0) {
        setLimitReachedOpen(true);
        return;
      }
      const success = assignLicense(user.id, selectedProduct);
      if (success) {
        toast({
          title: 'License Assigned',
          description: `License assigned to ${user.firstName} ${user.lastName}`,
        });
      }
    }
  };

  const canModify = hasAccess(['owner', 'billing']);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Licenses</h1>
            <p className="text-muted-foreground">
              Manage license assignments for {currentCompany?.name}
            </p>
          </div>
        </div>

        {/* Product Selection */}
        {subscriptions.length > 1 && (
          <div className="flex gap-2">
            {subscriptions.map(sub => (
              <Button
                key={sub.id}
                variant={selectedProduct === sub.product ? 'default' : 'outline'}
                onClick={() => setSelectedProduct(sub.product)}
              >
                {sub.product}
              </Button>
            ))}
          </div>
        )}

        {/* License Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Purchased Seats</p>
                  <p className="text-2xl font-bold">{purchasedSeats}</p>
                </div>
                <Key className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned Seats</p>
                  <p className="text-2xl font-bold">{assignedSeats}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className={cn(availableSeats === 0 && 'border-warning')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold">{availableSeats}</p>
                </div>
                {availableSeats === 0 ? (
                  <AlertTriangle className="h-8 w-8 text-warning" />
                ) : (
                  <Check className="h-8 w-8 text-success" />
                )}
              </div>
            </CardContent>
          </Card>
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
              <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="not-assigned">Not Assigned</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
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
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">License Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No users found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => {
                    const assigned = isAssigned(user.id);
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                              </span>
                            </div>
                            <span className="font-medium">
                              {user.firstName} {user.lastName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map(role => (
                              <Badge key={role} variant="outline" className="text-xs">
                                {roleLabels[role]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={user.status === 'active' ? 'status-active' : 'status-inactive'}
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={assigned}
                            onCheckedChange={() => handleToggleLicense(user)}
                            disabled={user.status === 'inactive'}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* License Limit Reached Modal */}
      <Dialog open={limitReachedOpen} onOpenChange={setLimitReachedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              License Limit Reached
            </DialogTitle>
            <DialogDescription>
              You have reached your license limit ({purchasedSeats}/{purchasedSeats}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To assign more licenses, you need to either:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Unassign licenses from other users</li>
              <li>Add more licenses to your subscription</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitReachedOpen(false)}>
              Close
            </Button>
            {canModify && (
              <Button onClick={() => {
                setLimitReachedOpen(false);
                navigate('/subscriptions');
              }}>
                Add More Licenses
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
