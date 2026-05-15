import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ListingPageHeader, SearchFilterCard, FilterField, DataTable, DataTableColumn, PaginationControls,
} from '@/components/listing';
import { useApp, Invoice } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { FileText, Eye, CreditCard, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RenewalFlyout } from '@/components/billing/RenewalFlyout';

export const BillingPage = () => {
  const { getCompanyInvoices, getCompanySubscriptions, currentCompany, markInvoicePaid } = useApp();
  const { toast } = useToast();
  const invoices = getCompanyInvoices();
  const subs = getCompanySubscriptions();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('all');
  const [invoiceDateFrom, setInvoiceDateFrom] = useState<Date>();
  const [invoiceDateTo, setInvoiceDateTo] = useState<Date>();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [renewalOpen, setRenewalOpen] = useState(false);

  const subscriptionNames = [...new Set(invoices.map(i => i.subscriptionName))];

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.subscriptionName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status.toLowerCase() === statusFilter;
    const matchesSub = subscriptionFilter === 'all' || inv.subscriptionName === subscriptionFilter;
    let matchesDate = true;
    if (invoiceDateFrom) matchesDate = new Date(inv.date) >= invoiceDateFrom;
    if (invoiceDateTo && matchesDate) matchesDate = new Date(inv.date) <= invoiceDateTo;
    return matchesSearch && matchesStatus && matchesSub && matchesDate;
  });

  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => { setSearchQuery(''); setStatusFilter('all'); setSubscriptionFilter('all'); setInvoiceDateFrom(undefined); setInvoiceDateTo(undefined); setCurrentPage(1); };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return 'status-active';
      case 'pending':
      case 'awaiting_payment': return 'status-invited';
      case 'payment_terms_applied': return 'status-active';
      case 'overdue':
      case 'unpaid': return 'status-inactive';
      default: return '';
    }
  };

  const formatStatus = (s: string) => s.replace(/_/g, ' ');
  const formatMethod = (m?: string) => m ? m.replace(/_/g, ' ') : '—';

  const handleMarkPaid = (inv: Invoice) => {
    markInvoicePaid(inv.id);
    toast({ title: 'Payment received.', description: 'Subscription / license changes activated.' });
  };

  const columns: DataTableColumn<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', render: (inv) => <span className="font-medium">{inv.invoiceNumber}</span> },
    { key: 'source', header: 'Source', render: (inv) => <span className="text-xs">{inv.source || (inv.invoiceType === 'Renewal Invoice' ? 'Renewal' : inv.invoiceType === 'Initial Invoice' ? 'Checkout' : '—')}</span> },
    { key: 'quoteNumber', header: 'Quote #', render: (inv) => <span className="text-xs">{inv.quoteNumber || '—'}</span> },
    { key: 'products', header: 'Products', render: (inv) => <div className="text-xs text-muted-foreground">{inv.lineItems.map(li => li.product).join(', ')}</div> },
    { key: 'po', header: 'PO #', render: (inv) => <span className="text-xs">{inv.poNumber || '—'}</span> },
    { key: 'method', header: 'Method', render: (inv) => <span className="text-xs capitalize">{formatMethod(inv.paymentMethod)}</span> },
    { key: 'date', header: 'Date', render: (inv) => new Date(inv.date).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (inv) => <Badge variant="outline" className={getStatusColor(inv.status)}>{formatStatus(inv.status)}</Badge> },
    { key: 'amount', header: 'Amount', render: (inv) => `$${inv.amount.toLocaleString()}` },
    {
      key: 'actions', header: 'Actions', className: 'text-right',
      render: (inv) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(inv); setDetailsOpen(true); }}><Eye className="h-4 w-4" /></Button>
          {inv.status === 'awaiting_payment' && (
            <Button size="sm" variant="outline" onClick={() => handleMarkPaid(inv)}>
              <CreditCard className="h-3 w-3 mr-1" />Mark as Paid
            </Button>
          )}
          {(inv.status === 'overdue' || inv.status === 'unpaid' || inv.status === 'pending') && (
            <Button size="sm" variant="outline" onClick={() => {
              setSelectedInvoice(inv);
              if (inv.invoiceType === 'Renewal Invoice' || inv.invoiceType === 'Initial Invoice') setRenewalOpen(true);
              else setPaymentOpen(true);
            }}><CreditCard className="h-4 w-4 mr-1" />Pay Now</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader title="Billing" description={`Invoices for ${currentCompany?.name}`}
          secondaryAction={<Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>} />

        <SearchFilterCard searchValue={searchQuery} onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search by invoice number or subscription..."
          onReset={resetFilters}
          filters={
            <>
              <FilterField label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'awaiting_payment', label: 'Awaiting Payment' },
                  { value: 'payment_terms_applied', label: 'Payment Terms Applied' },
                  { value: 'overdue', label: 'Overdue' },
                  { value: 'unpaid', label: 'Unpaid' },
                ]} />
              <FilterField label="Subscription" value={subscriptionFilter} onChange={(v) => { setSubscriptionFilter(v); setCurrentPage(1); }}
                options={[{ value: 'all', label: 'All Subscriptions' }, ...subscriptionNames.map(n => ({ value: n, label: n }))]} />
              <FilterField label="Invoice Date" type="dateRange" dateFromValue={invoiceDateFrom} dateToValue={invoiceDateTo}
                onDateFromChange={(d) => { setInvoiceDateFrom(d); setCurrentPage(1); }} onDateToChange={(d) => { setInvoiceDateTo(d); setCurrentPage(1); }} />
            </>
          }
        />

        <div>
          <DataTable columns={columns} data={paginatedInvoices} keyExtractor={(inv) => inv.id} emptyMessage="No invoices found."
            emptyIcon={<FileText className="h-12 w-12 text-muted-foreground" />} />
          <Card className="rounded-t-none border-t-0">
            <PaginationControls currentPage={currentPage} totalPages={totalPages} pageSize={pageSize}
              totalRecords={filteredInvoices.length} onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
          </Card>
        </div>
      </div>

      {/* Invoice Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Invoice {selectedInvoice?.invoiceNumber}</DialogTitle></DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Subscription:</span> <span className="font-medium">{selectedInvoice.subscriptionName}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={getStatusColor(selectedInvoice.status)}>{selectedInvoice.status}</Badge></div>
                <div><span className="text-muted-foreground">Date:</span> {new Date(selectedInvoice.date).toLocaleDateString()}</div>
                <div><span className="text-muted-foreground">Due:</span> {new Date(selectedInvoice.dueDate).toLocaleDateString()}</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedInvoice.lineItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.product}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">${item.unitPrice.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${item.total.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Total</span><span>${selectedInvoice.amount.toLocaleString()}</span>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setDetailsOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay Invoice {selectedInvoice?.invoiceNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between font-medium text-lg"><span>Amount Due</span><span className="text-primary">${selectedInvoice?.balance.toLocaleString()}</span></div>
            </div>
            <div className="space-y-2"><Label>Card Number</Label><Input placeholder="4242 4242 4242 4242" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Expiry</Label><Input placeholder="MM/YY" /></div>
              <div className="space-y-2"><Label>CVC</Label><Input placeholder="123" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast({ title: 'Payment initiated', description: `Processing payment for ${selectedInvoice?.invoiceNumber}` }); setPaymentOpen(false); }}>
              <CreditCard className="h-4 w-4 mr-2" />Pay Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RenewalFlyout
        open={renewalOpen}
        onOpenChange={setRenewalOpen}
        subscription={subs.find(s => s.id === selectedInvoice?.subscriptionId) || subs[0] || null}
        renewalPeriod="Jan 1, 2027 → Dec 31, 2027"
      />
    </MainLayout>
  );
};
