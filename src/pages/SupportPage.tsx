import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Plus, Search, HelpCircle } from 'lucide-react';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority?: string;
  createdAt: string;
}

export const SupportPage = () => {
  const { getCompanyTickets, createTicket } = useApp();
  const { toast } = useToast();
  const tickets = getCompanyTickets();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [createdFrom, setCreatedFrom] = useState<Date>();
  const [createdTo, setCreatedTo] = useState<Date>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newTicket, setNewTicket] = useState<{ category: string; subject: string; description: string; priority: 'high' | 'medium' | 'low' }>({ category: '', subject: '', description: '', priority: 'medium' });

  // Filter tickets
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status.toLowerCase() === statusFilter;
    const matchesPriority = priorityFilter === 'all' || (t.priority || 'medium') === priorityFilter;

    let matchesCreated = true;
    if (createdFrom) {
      matchesCreated = new Date(t.createdAt) >= createdFrom;
    }
    if (createdTo && matchesCreated) {
      matchesCreated = new Date(t.createdAt) <= createdTo;
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesCreated;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTickets.length / pageSize);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setCreatedFrom(undefined);
    setCreatedTo(undefined);
    setCurrentPage(1);
  };

  const handleCreate = () => {
    if (!newTicket.category || !newTicket.subject || !newTicket.description) {
      toast({ title: 'Error', description: 'Please fill all fields', variant: 'destructive' });
      return;
    }
    const ticket = createTicket(newTicket);
    toast({ title: 'Ticket Created', description: `Ticket ID: ${ticket.id}` });
    setCreateOpen(false);
    setNewTicket({ category: '', subject: '', description: '', priority: 'medium' });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'status-invited';
      case 'in progress': return 'status-active';
      case 'closed': return 'status-inactive';
      default: return '';
    }
  };

  const columns: DataTableColumn<Ticket>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (t) => <span className="font-mono text-sm">{t.id}</span>,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (t) => <span className="font-medium">{t.subject}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      render: (t) => t.category,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (t) => (
        <Badge variant="outline" className={
          t.priority === 'high' ? 'border-destructive text-destructive' :
          t.priority === 'low' ? 'border-muted-foreground text-muted-foreground' : ''
        }>
          {t.priority || 'Medium'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <Badge variant="outline" className={getStatusColor(t.status)}>
          {t.status}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (t) => new Date(t.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <ListingPageHeader
          title="Support"
          description="Get help and manage support tickets"
          showCompanyContext={false}
          primaryAction={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Ticket
            </Button>
          }
        />

        {/* Knowledge Base Search */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Search Knowledge Base</CardTitle></CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search for help articles..." className="pl-9" />
            </div>
          </CardContent>
        </Card>

        {/* Search & Filters */}
        <SearchFilterCard
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search by ticket ID or subject..."
          onReset={resetFilters}
          filters={
            <>
              <FilterField
                label="Status"
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'open', label: 'Open' },
                  { value: 'in progress', label: 'In Progress' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />
              <FilterField
                label="Priority"
                value={priorityFilter}
                onChange={(v) => { setPriorityFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Priority' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
              />
              <FilterField
                label="Created"
                type="dateRange"
                dateFromValue={createdFrom}
                dateToValue={createdTo}
                onDateFromChange={(d) => { setCreatedFrom(d); setCurrentPage(1); }}
                onDateToChange={(d) => { setCreatedTo(d); setCurrentPage(1); }}
              />
            </>
          }
        />

        {/* Data Table */}
        <div>
          <DataTable
            columns={columns}
            data={paginatedTickets}
            keyExtractor={(t) => t.id}
            emptyMessage="No tickets yet. Create one to get started."
            emptyIcon={<HelpCircle className="h-12 w-12 text-muted-foreground" />}
          />
          <Card className="rounded-t-none border-t-0">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalRecords={filteredTickets.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </Card>
        </div>
      </div>

      {/* Create Ticket Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newTicket.category} onValueChange={v => setNewTicket({...newTicket, category: v})}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Technical">Technical</SelectItem>
                  <SelectItem value="Billing">Billing</SelectItem>
                  <SelectItem value="Account">Account</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={newTicket.priority} onValueChange={(v: 'high' | 'medium' | 'low') => setNewTicket({...newTicket, priority: v})}>
                <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={newTicket.subject} onChange={e => setNewTicket({...newTicket, subject: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};
