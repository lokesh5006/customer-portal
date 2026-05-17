import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp, User } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, AlertTriangle, Search, Check, CreditCard } from 'lucide-react';

export const LicenseReductionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getCompanyUsers, licenses, bulkUnassignLicenses, updateProductLicenseCount } = useApp();
  const { toast } = useToast();

  const state = location.state as {
    subscriptionId: string;
    productId: string;
    productName: string;
    newLicenseCount: number;
    currentLicenses: number;
    assignedCount: number;
    subscriptionName: string;
  } | null;

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('lastLogin');

  if (!state) {
    navigate('/subscriptions');
    return null;
  }

  const { subscriptionId, productId, productName, newLicenseCount, currentLicenses, assignedCount, subscriptionName } = state;
  const usersToUnassign = assignedCount - newLicenseCount;

  const users = getCompanyUsers();
  const assignedUsers = users.filter(u =>
    licenses.some(l => l.userId === u.id && l.subscriptionId === subscriptionId && l.productId === productId)
  );

  const filteredUsers = assignedUsers
    .filter(u =>
      u.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'lastLogin') {
        if (!a.lastLogin) return -1;
        if (!b.lastLogin) return 1;
        return new Date(a.lastLogin).getTime() - new Date(b.lastLogin).getTime();
      }
      return a.firstName.localeCompare(b.firstName);
    });

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleAutoSelect = () => {
    const sorted = [...assignedUsers].sort((a, b) => {
      if (!a.lastLogin) return -1;
      if (!b.lastLogin) return 1;
      return new Date(a.lastLogin).getTime() - new Date(b.lastLogin).getTime();
    });
    setSelectedUserIds(sorted.slice(0, usersToUnassign).map(u => u.id));
  };

  const handleConfirmRemoval = () => {
    bulkUnassignLicenses(selectedUserIds, subscriptionId, productId);
    setConfirmOpen(false);
    setPaymentOpen(true);
  };

  const handlePayment = async () => {
    setPaymentStatus('processing');
    await new Promise(resolve => setTimeout(resolve, 1500));
    setPaymentStatus('success');
    updateProductLicenseCount(subscriptionId, productId, newLicenseCount);
    toast({ title: 'Subscription updated', description: `License count for ${productName} reduced to ${newLicenseCount}.` });
    setTimeout(() => navigate('/licenses'), 1500);
  };

  const isCriticalUser = (user: User) =>
    user.roles.includes('account_owner') || user.roles.includes('billing_admin') || user.roles.includes('license_admin');

  return (
    <MainLayout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/subscriptions')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Subscriptions
        </Button>

        <div>
          <h1 className="text-2xl font-bold">Select Users to Remove Access</h1>
          <p className="text-muted-foreground">
            Reducing licenses for <strong>{productName}</strong> under <strong>{subscriptionName}</strong>.
            You have {assignedCount} users assigned, but your new plan allows only {newLicenseCount}.
            Please select {usersToUnassign} user(s) to remove access.
          </p>
        </div>

        <Card className="bg-muted/50">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex gap-6 text-sm">
              <div><span className="text-muted-foreground">Product:</span> <strong>{productName}</strong></div>
              <div><span className="text-muted-foreground">Current:</span> <strong>{currentLicenses}</strong></div>
              <div><span className="text-muted-foreground">New:</span> <strong>{newLicenseCount}</strong></div>
              <div><span className="text-muted-foreground">Assigned:</span> <strong>{assignedCount}</strong></div>
            </div>
            <div className="text-lg font-semibold">
              Users to Unassign: <span className={selectedUserIds.length === usersToUnassign ? 'text-success' : 'text-destructive'}>{selectedUserIds.length} / {usersToUnassign}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lastLogin">Oldest Login First</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleAutoSelect}>Auto-select users</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.id} className={selectedUserIds.includes(user.id) ? 'bg-destructive/5' : ''}>
                    <TableCell><Checkbox checked={selectedUserIds.includes(user.id)} onCheckedChange={() => toggleUser(user.id)} /></TableCell>
                    <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {user.roles.map(r => <Badge key={r} variant="outline" className="mr-1 text-xs">{r}</Badge>)}
                      {isCriticalUser(user) && selectedUserIds.includes(user.id) && (
                        <Badge variant="outline" className="ml-1 text-warning border-warning text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Critical</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.lastLogin || 'Never'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-destructive">Will lose access</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedUserIds.length !== usersToUnassign && (
          <p className="text-sm text-destructive">Select exactly {usersToUnassign} user(s) to continue.</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate('/subscriptions')}>Cancel</Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={selectedUserIds.length !== usersToUnassign}>Confirm Removal</Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm License Removal</DialogTitle>
            <DialogDescription>The selected {selectedUserIds.length} user(s) will lose access to {productName}. This takes effect immediately.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Go Back</Button>
            <Button variant="destructive" onClick={handleConfirmRemoval}>Confirm & Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader><DialogTitle>{paymentStatus === 'success' ? 'Reduction Complete' : 'Finalize Reduction'}</DialogTitle></DialogHeader>
          {paymentStatus === 'success' ? (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"><Check className="h-8 w-8 text-success" /></div>
              <p className="font-medium">License count for {productName} reduced to {newLicenseCount}.</p>
              <p className="text-muted-foreground text-sm">Redirecting...</p>
            </div>
          ) : paymentStatus === 'processing' ? (
            <div className="text-center py-6"><CreditCard className="h-8 w-8 text-primary mx-auto mb-4 animate-pulse" /><p>Processing...</p></div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm">Old: {currentLicenses} → New: {newLicenseCount}</p>
                <p className="text-sm text-muted-foreground">Effective: On Renewal Date</p>
              </div>
              <Button className="w-full" onClick={handlePayment}>Confirm Seat Reduction</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
