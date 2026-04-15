import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, Subscription, SubscriptionProduct, Invoice } from '@/contexts/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  ListingPageHeader,
  DataTable,
  DataTableColumn,
  PaginationControls,
} from '@/components/listing';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard,
  Eye,
  Check,
  Calendar,
  Building2,
  Edit,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const {
    currentCompany,
    getCompanySubscriptions,
    getCompanyInvoices,
    getAssignedLicenseCount,
    hasAccess,
  } = useApp();
  const { toast } = useToast();

  const subscriptions = getCompanySubscriptions();
  const invoices = getCompanyInvoices();
  const canModify = hasAccess(['owner', 'billing']);

  const [selectedSubIndex, setSelectedSubIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [editBillingOpen, setEditBillingOpen] = useState(false);

  const currentSub = subscriptions[selectedSubIndex] || null;
  const subInvoices = invoices.filter(i => currentSub && i.subscriptionId === currentSub.id);

  // Quotes sample data
  const quotes = currentSub ? [
    {
      id: 'Q-2026-001',
      date: '2026-03-20',
      description: `Renewal Quote – ${currentSub.name}`,
      amount: currentSub.products.reduce((a, p) => a + p.licenseCount * p.pricePerLicense, 0),
      status: 'pending',
    },
  ] : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'status-active';
      case 'pending': return 'status-pending';
      case 'overdue': return 'status-overdue';
      case 'active': return 'status-active';
      default: return '';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="Subscriptions"
          description={`Manage subscriptions for ${currentCompany?.name}`}
        />

        {subscriptions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Subscriptions</h3>
              <p className="text-muted-foreground mb-4">You don't have any active subscriptions yet.</p>
              <Button onClick={() => navigate('/signup')}>Get Started</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-4">
            {/* Subscription Selector - left side */}
            {subscriptions.length > 1 && (
              <div className="flex flex-col gap-2 shrink-0">
                {subscriptions.map((sub, idx) => (
                  <Button
                    key={sub.id}
                    variant={selectedSubIndex === idx ? 'default' : 'outline'}
                    className="justify-start text-left h-auto py-3 px-4"
                    onClick={() => { setSelectedSubIndex(idx); setActiveTab('overview'); }}
                  >
                    <div>
                      <div className="font-medium text-sm">{sub.name}</div>
                      <div className="text-xs opacity-80">{sub.planType}</div>
                    </div>
                  </Button>
                ))}
              </div>
            )}

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {currentSub && (
                <Card>
                  <CardContent className="p-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <div className="border-b px-4 pt-4">
                        <TabsList>
                          <TabsTrigger value="overview">Overview</TabsTrigger>
                          <TabsTrigger value="invoices">Invoices</TabsTrigger>
                          <TabsTrigger value="quotes">Quotes</TabsTrigger>
                        </TabsList>
                      </div>

                      {/* OVERVIEW TAB */}
                      <TabsContent value="overview" className="p-6 space-y-6">
                        {/* Sub Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Subscription</p>
                            <p className="font-semibold">{currentSub.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Plan Type</p>
                            <p className="font-medium">{currentSub.planType}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Billing</p>
                            <p className="font-medium capitalize">{currentSub.billingFrequency}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Renewal Date</p>
                            <p className="font-medium">{new Date(currentSub.renewalDate).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <div>
                          <Badge variant="outline" className={getStatusColor(currentSub.status)}>
                            {currentSub.status}
                          </Badge>
                        </div>

                        {/* Products table */}
                        <div>
                          <h4 className="font-semibold mb-3">Products</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-center">Seats</TableHead>
                                <TableHead className="text-center">Assigned</TableHead>
                                <TableHead className="text-center">Available</TableHead>
                                <TableHead className="text-right">Price/Seat</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {currentSub.products.map(prod => {
                                const assigned = getAssignedLicenseCount(currentSub.id, prod.id);
                                return (
                                  <TableRow key={prod.id}>
                                    <TableCell className="font-medium">{prod.name}</TableCell>
                                    <TableCell className="text-center">{prod.licenseCount}</TableCell>
                                    <TableCell className="text-center">{assigned}</TableCell>
                                    <TableCell className="text-center">{prod.licenseCount - assigned}</TableCell>
                                    <TableCell className="text-right">${prod.pricePerLicense.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">${(prod.licenseCount * prod.pricePerLicense).toLocaleString()}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Payment Method */}
                        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">You last paid by <strong>Credit Card</strong>.</span>
                          </div>
                        </div>

                        {/* Renewal Options */}
                        <div>
                          <h4 className="font-semibold mb-2">Renewal Options</h4>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {['Direct ACH', 'Credit Card', 'ACH e-Check', 'Paper Check', 'Invoice Only (Net 30)'].map(opt => (
                              <div
                                key={opt}
                                className={cn(
                                  'p-3 rounded-md border text-center text-sm cursor-pointer hover:border-primary/50 transition-colors',
                                  opt === 'Credit Card' ? 'border-primary bg-primary/5 font-medium' : ''
                                )}
                              >
                                {opt}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Billing Details */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">Billing Details</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditBillingOpen(true)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Company</p>
                              <p className="font-medium">{currentCompany?.name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Address</p>
                              <p className="font-medium">123 Main St, Suite 400<br />New York, NY 10001</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Company Contact</p>
                              <p className="font-medium">John Smith</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="font-medium">billing@abcaccounting.com</p>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      {/* INVOICES TAB */}
                      <TabsContent value="invoices" className="p-6">
                        {subInvoices.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">No invoices for this subscription.</div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subInvoices.map(inv => (
                                <TableRow key={inv.id}>
                                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                                  <TableCell>{new Date(inv.date).toLocaleDateString()}</TableCell>
                                  <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={getStatusColor(inv.status)}>{inv.status}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right">${inv.amount.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">${inv.balance.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="sm">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {inv.balance > 0 && (
                                      <Button variant="outline" size="sm" className="ml-1" onClick={() => navigate('/billing')}>
                                        Pay
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </TabsContent>

                      {/* QUOTES TAB */}
                      <TabsContent value="quotes" className="p-6">
                        {quotes.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">No quotes available.</div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Quote #</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {quotes.map(q => (
                                <TableRow key={q.id}>
                                  <TableCell className="font-medium">{q.id}</TableCell>
                                  <TableCell>{new Date(q.date).toLocaleDateString()}</TableCell>
                                  <TableCell>{q.description}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={getStatusColor(q.status)}>{q.status}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right">${q.amount.toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Billing Details Modal */}
      <Dialog open={editBillingOpen} onOpenChange={setEditBillingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Billing Details</DialogTitle>
            <DialogDescription>Update your billing contact information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input defaultValue={currentCompany?.name} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input defaultValue="123 Main St, Suite 400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input defaultValue="New York" />
              </div>
              <div className="space-y-2">
                <Label>State / ZIP</Label>
                <Input defaultValue="NY 10001" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input defaultValue="John Smith" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input defaultValue="billing@abcaccounting.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBillingOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast({ title: 'Billing details saved' }); setEditBillingOpen(false); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
