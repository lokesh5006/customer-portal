import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ListingPageHeader,
  SearchFilterCard,
  FilterField,
  DataTable,
  DataTableColumn,
  PaginationControls,
} from '@/components/listing';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { FileText, Eye, CreditCard, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: string;
  amount: number;
  balance: number;
  lineItems: { description: string; total: number }[];
}

export const BillingPage = () => {
  const { getCompanyInvoices, currentCompany } = useApp();
  const { toast } = useToast();
  const invoices = getCompanyInvoices();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [invoiceDateFrom, setInvoiceDateFrom] = useState<Date>();
  const [invoiceDateTo, setInvoiceDateTo] = useState<Date>();
  const [dueDateFrom, setDueDateFrom] = useState<Date>();
  const [dueDateTo, setDueDateTo] = useState<Date>();
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status.toLowerCase() === statusFilter;

    let matchesInvoiceDate = true;
    if (invoiceDateFrom) {
      matchesInvoiceDate = new Date(inv.date) >= invoiceDateFrom;
    }
    if (invoiceDateTo && matchesInvoiceDate) {
      matchesInvoiceDate = new Date(inv.date) <= invoiceDateTo;
    }

    let matchesDueDate = true;
    if (dueDateFrom) {
      matchesDueDate = new Date(inv.dueDate) >= dueDateFrom;
    }
    if (dueDateTo && matchesDueDate) {
      matchesDueDate = new Date(inv.dueDate) <= dueDateTo;
    }

    let matchesAmount = true;
    if (amountMin) {
      matchesAmount = inv.amount >= parseFloat(amountMin);
    }
    if (amountMax && matchesAmount) {
      matchesAmount = inv.amount <= parseFloat(amountMax);
    }

    return matchesSearch && matchesStatus && matchesInvoiceDate && matchesDueDate && matchesAmount;
  });

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setInvoiceDateFrom(undefined);
    setInvoiceDateTo(undefined);
    setDueDateFrom(undefined);
    setDueDateTo(undefined);
    setAmountMin('');
    setAmountMax('');
    setCurrentPage(1);
  };

  const handlePay = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentOpen(true);
  };

  const processPayment = () => {
    toast({ title: 'Payment initiated', description: `Processing payment for ${selectedInvoice?.invoiceNumber}` });
    setPaymentOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return 'status-active';
      case 'unpaid': return 'status-invited';
      case 'overdue': return 'status-inactive';
      default: return '';
    }
  };

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: (inv) => <span className="font-medium">{inv.invoiceNumber}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (inv) => new Date(inv.date).toLocaleDateString(),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (inv) => new Date(inv.dueDate).toLocaleDateString(),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inv) => (
        <Badge variant="outline" className={getStatusColor(inv.status)}>
          {inv.status}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (inv) => `$${inv.amount.toLocaleString()}`,
    },
    {
      key: 'balance',
      header: 'Balance',
      render: (inv) => `$${inv.balance.toLocaleString()}`,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (inv) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(inv); setDetailsOpen(true); }}>
            <Eye className="h-4 w-4" />
          </Button>
          {inv.balance > 0 && (
            <Button size="sm" variant="outline" onClick={() => handlePay(inv)}>
              <CreditCard className="h-4 w-4 mr-1" /> Pay
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <ListingPageHeader
          title="Billing"
          description={`Invoices for ${currentCompany?.name}`}
          secondaryAction={
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          }
        />

        {/* Search & Filters */}
        <SearchFilterCard
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search by invoice number..."
          onReset={resetFilters}
          filters={
            <>
              <FilterField
                label="Status"
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'unpaid', label: 'Unpaid' },
                  { value: 'overdue', label: 'Overdue' },
                ]}
              />
              <FilterField
                label="Invoice Date"
                type="dateRange"
                dateFromValue={invoiceDateFrom}
                dateToValue={invoiceDateTo}
                onDateFromChange={(d) => { setInvoiceDateFrom(d); setCurrentPage(1); }}
                onDateToChange={(d) => { setInvoiceDateTo(d); setCurrentPage(1); }}
              />
              <FilterField
                label="Due Date"
                type="dateRange"
                dateFromValue={dueDateFrom}
                dateToValue={dueDateTo}
                onDateFromChange={(d) => { setDueDateFrom(d); setCurrentPage(1); }}
                onDateToChange={(d) => { setDueDateTo(d); setCurrentPage(1); }}
              />
              <div className="flex gap-2 items-end">
                <FilterField
                  label="Amount Min"
                  type="input"
                  value={amountMin}
                  onChange={(v) => { setAmountMin(v); setCurrentPage(1); }}
                  placeholder="$0"
                  className="w-24"
                />
                <FilterField
                  label="Amount Max"
                  type="input"
                  value={amountMax}
                  onChange={(v) => { setAmountMax(v); setCurrentPage(1); }}
                  placeholder="$999,999"
                  className="w-24"
                />
              </div>
            </>
          }
        />

        {/* Data Table */}
        <div>
          <DataTable
            columns={columns}
            data={paginatedInvoices}
            keyExtractor={(inv) => inv.id}
            emptyMessage="No invoices found matching your criteria."
            emptyIcon={<FileText className="h-12 w-12 text-muted-foreground" />}
          />
          <Card className="rounded-t-none border-t-0">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalRecords={filteredInvoices.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </Card>
        </div>
      </div>

      {/* Invoice Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invoice {selectedInvoice?.invoiceNumber}</DialogTitle></DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              {selectedInvoice.lineItems.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.description}</span>
                  <span>${item.total.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Total</span>
                <span>${selectedInvoice.amount.toLocaleString()}</span>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setDetailsOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Invoice {selectedInvoice?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between font-medium text-lg">
                <span>Amount Due</span>
                <span className="text-primary">${selectedInvoice?.balance.toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Card Number</Label>
              <Input placeholder="4242 4242 4242 4242" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expiry</Label>
                <Input placeholder="MM/YY" />
              </div>
              <div className="space-y-2">
                <Label>CVC</Label>
                <Input placeholder="123" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={processPayment}>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
