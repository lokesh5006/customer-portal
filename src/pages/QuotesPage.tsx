import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ListingPageHeader, SearchFilterCard, FilterField, DataTable, DataTableColumn, PaginationControls,
} from '@/components/listing';
import { useApp, Quote } from '@/contexts/AppContext';
import { FileSignature, Eye, Check, X, RefreshCw, Plus, MessageSquare } from 'lucide-react';
import {
  AcceptQuoteDialog, DeclineQuoteDialog, ViewNoteDialog, RequestQuoteDialog,
} from '@/components/subscriptions/QuoteDialogs';

export const QuotesPage = () => {
  const navigate = useNavigate();
  const { currentCompany, getCompanyQuotes, getCompanyQuoteRequests, getCompanySubscriptions, hasAccess } = useApp();
  const quotes = getCompanyQuotes();
  const quoteRequests = getCompanyQuoteRequests();
  const canAccept = hasAccess(['owner', 'billing']);
  const hasActiveSubscription = getCompanySubscriptions().some(s => ['active', 'overdue', 'pending_payment'].includes(s.status));

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [acceptQuote, setAcceptQuote] = useState<Quote | null>(null);
  const [declineQuote, setDeclineQuote] = useState<Quote | null>(null);
  const [noteQuote, setNoteQuote] = useState<Quote | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  const filtered = quotes.filter(q => {
    const matchesSearch = q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.lineItems.some(l => l.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const statusColor = (s: Quote['status']) => {
    switch (s) {
      case 'active': return 'status-active';
      case 'accepted': return 'status-active';
      case 'declined': return 'status-overdue';
      case 'expired': return 'status-inactive';
    }
  };

  const columns: DataTableColumn<Quote>[] = [
    { key: 'id', header: 'Quote #', render: q => <span className="font-medium">{q.quoteNumber}</span> },
    { key: 'product', header: 'Product(s)', render: q => <div className="text-sm">{q.lineItems.map(l => l.productName).join(', ')}</div> },
    { key: 'lic', header: 'Licenses', className: 'text-center', render: q => q.lineItems.reduce((a, l) => a + l.licenseCount, 0) },
    { key: 'created', header: 'Created', render: q => new Date(q.createdDate).toLocaleDateString() },
    { key: 'expires', header: 'Expires', render: q => new Date(q.expiryDate).toLocaleDateString() },
    { key: 'amount', header: 'Amount', className: 'text-right', render: q => <span className="font-medium">${q.amount.toLocaleString()}</span> },
    { key: 'status', header: 'Status', render: q => <Badge variant="outline" className={statusColor(q.status)}>{q.status}</Badge> },
    {
      key: 'note', header: 'Note',
      render: q => q.note ? (
        <button className="text-xs text-primary hover:underline text-left" onClick={() => setNoteQuote(q)}>
          {q.note.length > 30 ? q.note.slice(0, 30) + '…' : q.note}
        </button>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'actions', header: 'Actions', className: 'text-right',
      render: q => (
        <div className="flex justify-end gap-1 items-center">
          {q.status === 'active' && canAccept && (
            <>
              <Button size="sm" variant="outline" onClick={() => setAcceptQuote(q)}><Check className="h-3 w-3 mr-1" />Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => setDeclineQuote(q)}><X className="h-3 w-3 mr-1" />Decline</Button>
            </>
          )}
          {q.status === 'expired' && (
            <span className="text-xs text-muted-foreground" title="This quote has expired. Please generate a new quote.">Expired</span>
          )}
          {q.status === 'declined' && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/checkout?fromQuote=${q.quoteNumber}&product=${encodeURIComponent(q.lineItems[0]?.productName || '')}&licenses=${q.lineItems[0]?.licenseCount || 1}&note=${encodeURIComponent(q.note || '')}`)}>
              <RefreshCw className="h-3 w-3 mr-1" />Regenerate Quote
            </Button>
          )}
          {q.status === 'accepted' && (
            <Button size="sm" variant="ghost" onClick={() => navigate('/invoices')}><Eye className="h-3 w-3 mr-1" />View Invoice</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="Quotes"
          description={`Review, accept, or decline quotes for ${currentCompany?.name}`}
          actions={
            hasActiveSubscription ? (
              <Button onClick={() => setRequestOpen(true)}>
                <MessageSquare className="h-4 w-4 mr-1" />Request a Quote
              </Button>
            ) : (
              <Button onClick={() => navigate('/checkout')}>
                <Plus className="h-4 w-4 mr-1" />New Quote
              </Button>
            )
          }
        />

        {hasActiveSubscription && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            You already have an active subscription. To modify or add products/licenses, please request a quote.
          </div>
        )}

        <SearchFilterCard
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search by quote # or product..."
          onReset={() => { setSearchQuery(''); setStatusFilter('all'); setCurrentPage(1); }}
          filters={
            <FilterField label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'accepted', label: 'Accepted' },
                { value: 'declined', label: 'Declined' },
                { value: 'expired', label: 'Expired' },
              ]}
            />
          }
        />

        <div>
          <DataTable columns={columns} data={paginated} keyExtractor={q => q.id}
            emptyMessage="No quotes available." emptyIcon={<FileSignature className="h-12 w-12 text-muted-foreground" />}
          />
          <Card className="rounded-t-none border-t-0">
            <PaginationControls
              currentPage={currentPage} totalPages={totalPages} pageSize={pageSize}
              totalRecords={filtered.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
            />
          </Card>
        </div>

        {quoteRequests.length > 0 && (
          <Card className="p-4 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" />Quote Requests</h4>
            <div className="space-y-2">
              {quoteRequests.map(r => (
                <div key={r.id} className="border rounded-md p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{r.products.map(p => `${p.productName} (${p.desiredLicenseCount})`).join(', ')}</div>
                    <Badge variant="outline" className="status-invited">{r.status.replace('_', ' ')}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(r.createdDate).toLocaleDateString()}</div>
                  <div className="text-xs mt-1">{r.note}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <AcceptQuoteDialog open={!!acceptQuote} onOpenChange={(v) => !v && setAcceptQuote(null)} quote={acceptQuote} />
      <DeclineQuoteDialog open={!!declineQuote} onOpenChange={(v) => !v && setDeclineQuote(null)} quote={declineQuote} />
      <ViewNoteDialog open={!!noteQuote} onOpenChange={(v) => !v && setNoteQuote(null)} quote={noteQuote} />
      <RequestQuoteDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </MainLayout>
  );
};

export default QuotesPage;
