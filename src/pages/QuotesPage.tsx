import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ListingPageHeader, SearchFilterCard, FilterField, DataTable, DataTableColumn, PaginationControls,
} from '@/components/listing';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { FileSignature, Eye, Download, Check } from 'lucide-react';

interface Quote {
  id: string;
  product: string;
  createdDate: string;
  expirationDate: string;
  amount: number;
  status: 'pending' | 'accepted' | 'expired' | 'declined';
  subscriptionName: string;
}

export const QuotesPage = () => {
  const { currentCompany, getCompanySubscriptions, hasAccess } = useApp();
  const { toast } = useToast();
  const subs = getCompanySubscriptions();
  const canAccept = hasAccess(['owner', 'billing']);

  // Build realistic sample quotes from real subscriptions
  const initialQuotes: Quote[] = subs.flatMap((s, i) => s.products.map((p, j) => ({
    id: `Q-2026-${String(i * 10 + j + 1).padStart(3, '0')}`,
    product: p.name,
    createdDate: '2026-03-20',
    expirationDate: '2026-05-20',
    amount: p.licenseCount * (p.pricePerLicense || 199),
    status: (j === 0 ? 'pending' : 'accepted') as Quote['status'],
    subscriptionName: s.name,
  })));

  // Add a couple of extra demo quotes
  const sampleExtras: Quote[] = [
    { id: 'Q-2026-100', product: 'NumberCruncher', createdDate: '2026-02-10', expirationDate: '2026-04-10', amount: 8725, status: 'expired', subscriptionName: '2026 Annual Plan' },
    { id: 'Q-2026-101', product: 'QuickView Desktop', createdDate: '2026-04-01', expirationDate: '2026-06-01', amount: 1990, status: 'pending', subscriptionName: 'QuickView Quarterly' },
  ];

  const [quotes, setQuotes] = useState<Quote[]>([...initialQuotes, ...sampleExtras]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = quotes.filter(q => {
    const matchesSearch = q.id.toLowerCase().includes(searchQuery.toLowerCase()) || q.product.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const statusColor = (s: Quote['status']) => {
    switch (s) {
      case 'pending': return 'status-invited';
      case 'accepted': return 'status-active';
      case 'expired': return 'status-inactive';
      case 'declined': return 'status-overdue';
    }
  };

  const handleAccept = (q: Quote) => {
    setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, status: 'accepted' } : x));
    toast({ title: 'Quote accepted', description: `${q.id} has been accepted. An invoice will be generated shortly.` });
  };

  const columns: DataTableColumn<Quote>[] = [
    { key: 'id', header: 'Quote #', render: q => <span className="font-medium">{q.id}</span> },
    { key: 'product', header: 'Product', render: q => <div><div className="text-sm">{q.product}</div><div className="text-xs text-muted-foreground">{q.subscriptionName}</div></div> },
    { key: 'created', header: 'Created', render: q => new Date(q.createdDate).toLocaleDateString() },
    { key: 'expires', header: 'Expires', render: q => new Date(q.expirationDate).toLocaleDateString() },
    { key: 'amount', header: 'Amount', render: q => <span className="font-medium">${q.amount.toLocaleString()}</span> },
    { key: 'status', header: 'Status', render: q => <Badge variant="outline" className={statusColor(q.status)}>{q.status}</Badge> },
    {
      key: 'actions', header: 'Actions', className: 'text-right',
      render: q => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Quote viewed', description: q.id })}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Downloading PDF', description: q.id })}><Download className="h-4 w-4" /></Button>
          {q.status === 'pending' && canAccept && (
            <Button size="sm" variant="outline" onClick={() => handleAccept(q)}><Check className="h-4 w-4 mr-1" />Accept</Button>
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
          description={`Review and accept renewal and add-on quotes for ${currentCompany?.name}`}
        />

        <SearchFilterCard
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search by quote # or product..."
          onReset={() => { setSearchQuery(''); setStatusFilter('all'); setCurrentPage(1); }}
          filters={
            <FilterField label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'accepted', label: 'Accepted' },
                { value: 'expired', label: 'Expired' },
                { value: 'declined', label: 'Declined' },
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
      </div>
    </MainLayout>
  );
};

export default QuotesPage;
