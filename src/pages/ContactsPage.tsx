import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  ListingPageHeader, SearchFilterCard, FilterField, DataTable, DataTableColumn, PaginationControls,
} from '@/components/listing';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import {
  Contact as ContactIcon, Plus, MoreHorizontal, Eye, Edit, Star, UserX, Users as UsersIcon,
  Briefcase, Wrench, Phone, Mail, MapPin, FileText, CreditCard, Receipt,
} from 'lucide-react';

type ContactType = 'Billing' | 'Support' | 'Executive' | 'Renewal Contact' | 'Technical Contact';
type ContactStatus = 'active' | 'inactive';

interface PortalContact {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  address: string;
  companyRole: string;
  contactType: ContactType;
  status: ContactStatus;
  isPrimaryBilling?: boolean;
  notes?: string;
  linkedSubscriptions: string[];
  linkedInvoices: string[];
  preferences: { email: boolean; sms: boolean; phone: boolean };
}

const seedContacts: PortalContact[] = [
  { id: 'c-1', name: 'Sarah Johnson', title: 'Chief Financial Officer', email: 'sarah.johnson@abcaccounting.com', phone: '(212) 555-0101', address: '123 Main St, Suite 400, New York, NY 10001', companyRole: 'Finance Leadership', contactType: 'Billing', status: 'active', isPrimaryBilling: true, notes: 'Primary billing contact for all renewals.', linkedSubscriptions: ['2026 Annual Plan', 'QuickView Quarterly'], linkedInvoices: ['INV-2026-001', 'INV-2026-002'], preferences: { email: true, sms: false, phone: true } },
  { id: 'c-2', name: 'John Smith', title: 'Chief Executive Officer', email: 'john.smith@abcaccounting.com', phone: '(212) 555-0102', address: '123 Main St, Suite 400, New York, NY 10001', companyRole: 'Executive Leadership', contactType: 'Executive', status: 'active', notes: 'Account owner. Copy on all major changes.', linkedSubscriptions: ['2026 Annual Plan'], linkedInvoices: [], preferences: { email: true, sms: false, phone: false } },
  { id: 'c-3', name: 'Mike Williams', title: 'IT Manager', email: 'mike.williams@abcaccounting.com', phone: '(212) 555-0103', address: '123 Main St, Suite 400, New York, NY 10001', companyRole: 'Technology', contactType: 'Technical Contact', status: 'active', notes: 'Handles installations and DataNet routing.', linkedSubscriptions: ['2026 Annual Plan', 'QuickView Quarterly'], linkedInvoices: [], preferences: { email: true, sms: true, phone: true } },
  { id: 'c-4', name: 'Emily Brown', title: 'Operations Manager', email: 'emily.brown@abcaccounting.com', phone: '(212) 555-0104', address: '123 Main St, Suite 400, New York, NY 10001', companyRole: 'Operations', contactType: 'Renewal Contact', status: 'active', notes: 'Reviews renewal quotes prior to approval.', linkedSubscriptions: ['QuickView Quarterly'], linkedInvoices: ['INV-2026-002'], preferences: { email: true, sms: false, phone: false } },
  { id: 'c-5', name: 'Robert Anderson', title: 'Support Liaison', email: 'robert.anderson@abcaccounting.com', phone: '(212) 555-0105', address: '123 Main St, Suite 400, New York, NY 10001', companyRole: 'Customer Success', contactType: 'Support', status: 'active', notes: 'Coordinates internal escalations to NumberCruncher support.', linkedSubscriptions: ['2026 Annual Plan'], linkedInvoices: [], preferences: { email: true, sms: true, phone: true } },
  { id: 'c-6', name: 'Lisa Miller', title: 'Senior Accountant', email: 'lisa.miller@abcaccounting.com', phone: '(212) 555-0106', address: '123 Main St, Suite 400, New York, NY 10001', companyRole: 'Accounting', contactType: 'Support', status: 'inactive', notes: 'On extended leave through Q1 2026.', linkedSubscriptions: [], linkedInvoices: [], preferences: { email: false, sms: false, phone: false } },
  { id: 'c-7', name: 'Daniel Kim', title: 'Procurement Specialist', email: 'daniel.kim@abcaccounting.com', phone: '(212) 555-0107', address: '123 Main St, Suite 400, New York, NY 10001', companyRole: 'Procurement', contactType: 'Billing', status: 'active', notes: 'Receives invoice copies for AP routing.', linkedSubscriptions: ['2026 Annual Plan'], linkedInvoices: ['INV-2026-003'], preferences: { email: true, sms: false, phone: false } },
];

const contactTypeColor: Record<ContactType, string> = {
  'Billing': 'bg-primary/10 text-primary border-primary/20',
  'Support': 'bg-info/10 text-info border-info/20',
  'Executive': 'bg-purple-100 text-purple-700 border-purple-200',
  'Renewal Contact': 'bg-warning/10 text-warning border-warning/20',
  'Technical Contact': 'bg-success/10 text-success border-success/20',
};

export const ContactsPage = () => {
  const { currentCompany, hasAccess } = useApp();
  const { toast } = useToast();
  const canModify = hasAccess(['owner', 'billing', 'admin']);

  const [contacts, setContacts] = useState<PortalContact[]>(seedContacts);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selected, setSelected] = useState<PortalContact | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<PortalContact>>({});

  const summary = {
    total: contacts.length,
    billing: contacts.filter(c => c.contactType === 'Billing').length,
    support: contacts.filter(c => c.contactType === 'Support').length,
    executive: contacts.filter(c => c.contactType === 'Executive').length,
  };

  const filtered = contacts.filter(c => {
    const matchesSearch = [c.name, c.email, c.title].some(v => v.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || c.contactType === typeFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openPanel = (c: PortalContact) => { setSelected(c); setPanelOpen(true); };
  const openEdit = (c: PortalContact) => { setSelected(c); setDraft({ ...c }); setEditOpen(true); };
  const handleSave = () => {
    if (!selected) return;
    setContacts(prev => prev.map(c => c.id === selected.id ? { ...c, ...draft } as PortalContact : c));
    toast({ title: 'Contact updated', description: `${draft.name || selected.name} has been updated.` });
    setEditOpen(false);
  };
  const handleAdd = () => {
    if (!draft.name || !draft.email) {
      toast({ title: 'Missing fields', description: 'Name and email are required.', variant: 'destructive' });
      return;
    }
    const newContact: PortalContact = {
      id: `c-${Date.now()}`,
      name: draft.name!,
      title: draft.title || '',
      email: draft.email!,
      phone: draft.phone || '',
      address: draft.address || '',
      companyRole: draft.companyRole || '',
      contactType: (draft.contactType as ContactType) || 'Support',
      status: 'active',
      notes: draft.notes,
      linkedSubscriptions: [],
      linkedInvoices: [],
      preferences: { email: true, sms: false, phone: false },
    };
    setContacts(prev => [newContact, ...prev]);
    toast({ title: 'Contact added', description: `${newContact.name} has been added.` });
    setAddOpen(false);
    setDraft({});
  };
  const setPrimaryBilling = (c: PortalContact) => {
    setContacts(prev => prev.map(x => ({ ...x, isPrimaryBilling: x.id === c.id })));
    toast({ title: 'Primary billing set', description: `${c.name} is now the primary billing contact.` });
  };
  const disableContact = (c: PortalContact) => {
    setContacts(prev => prev.map(x => x.id === c.id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x));
    toast({ title: c.status === 'active' ? 'Contact disabled' : 'Contact enabled' });
  };

  const columns: DataTableColumn<PortalContact>[] = [
    {
      key: 'name', header: 'Name',
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">{c.name.split(' ').map(n => n[0]).join('').slice(0,2)}</span>
          </div>
          <div className="min-w-0">
            <button
              className="font-medium hover:text-primary text-left truncate"
              onClick={() => openPanel(c)}
            >
              {c.name}
              {c.isPrimaryBilling && <Star className="inline-block h-3 w-3 ml-1 text-warning fill-warning" />}
            </button>
            <p className="text-xs text-muted-foreground truncate">{c.companyRole}</p>
          </div>
        </div>
      ),
    },
    { key: 'title', header: 'Title', render: (c) => <span className="text-sm">{c.title}</span> },
    { key: 'email', header: 'Email', render: (c) => <span className="text-muted-foreground text-sm">{c.email}</span> },
    { key: 'phone', header: 'Phone', render: (c) => <span className="text-sm">{c.phone}</span> },
    {
      key: 'type', header: 'Contact Type',
      render: (c) => <Badge variant="outline" className={contactTypeColor[c.contactType]}>{c.contactType}</Badge>,
    },
    {
      key: 'status', header: 'Status',
      render: (c) => <Badge variant="outline" className={c.status === 'active' ? 'status-active' : 'status-inactive'}>{c.status}</Badge>,
    },
    {
      key: 'actions', header: '', className: 'w-[50px] text-right',
      render: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openPanel(c)}><Eye className="h-4 w-4 mr-2" />View Contact</DropdownMenuItem>
            {canModify && <DropdownMenuItem onClick={() => openEdit(c)}><Edit className="h-4 w-4 mr-2" />Edit Contact</DropdownMenuItem>}
            {canModify && !c.isPrimaryBilling && <DropdownMenuItem onClick={() => setPrimaryBilling(c)}><Star className="h-4 w-4 mr-2" />Set as Primary Billing</DropdownMenuItem>}
            <DropdownMenuSeparator />
            {canModify && (
              <DropdownMenuItem className="text-destructive" onClick={() => disableContact(c)}>
                <UserX className="h-4 w-4 mr-2" />{c.status === 'active' ? 'Disable Contact' : 'Enable Contact'}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const summaryCards = [
    { label: 'Total Contacts', value: summary.total, icon: UsersIcon, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Billing Contacts', value: summary.billing, icon: CreditCard, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Support Contacts', value: summary.support, icon: Wrench, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Executive Contacts', value: summary.executive, icon: Briefcase, color: 'text-purple-700', bg: 'bg-purple-100' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="Contacts"
          description="Manage billing, support, and company contacts."
          primaryAction={canModify && (
            <Button onClick={() => { setDraft({ contactType: 'Support' }); setAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Contact
            </Button>
          )}
        />

        <div className="grid gap-4 md:grid-cols-4">
          {summaryCards.map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <SearchFilterCard
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          searchPlaceholder="Search by name, email, or title..."
          onReset={() => { setSearchQuery(''); setTypeFilter('all'); setStatusFilter('all'); setCurrentPage(1); }}
          filters={
            <>
              <FilterField label="Contact Type" value={typeFilter} onChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'Billing', label: 'Billing' },
                  { value: 'Support', label: 'Support' },
                  { value: 'Executive', label: 'Executive' },
                  { value: 'Renewal Contact', label: 'Renewal Contact' },
                  { value: 'Technical Contact', label: 'Technical Contact' },
                ]}
              />
              <FilterField label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
                options={[{ value: 'all', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
              />
            </>
          }
        />

        <div>
          <DataTable columns={columns} data={paginated} keyExtractor={c => c.id}
            emptyMessage="No contacts found." emptyIcon={<ContactIcon className="h-12 w-12 text-muted-foreground" />}
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

      {/* Side Panel - Contact Detail */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.name}
                  {selected.isPrimaryBilling && <Star className="h-4 w-4 text-warning fill-warning" />}
                </SheetTitle>
                <SheetDescription>{selected.title}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={contactTypeColor[selected.contactType]}>{selected.contactType}</Badge>
                  <Badge variant="outline" className={selected.status === 'active' ? 'status-active' : 'status-inactive'}>{selected.status}</Badge>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2"><Mail className="h-4 w-4 text-muted-foreground mt-0.5" /><span>{selected.email}</span></div>
                  <div className="flex items-start gap-2"><Phone className="h-4 w-4 text-muted-foreground mt-0.5" /><span>{selected.phone}</span></div>
                  <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /><span>{selected.address}</span></div>
                </div>

                {selected.notes && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Notes</h4>
                    <p className="text-sm text-muted-foreground bg-muted/40 rounded-md p-3">{selected.notes}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" />Linked Subscriptions</h4>
                  {selected.linkedSubscriptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No linked subscriptions.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selected.linkedSubscriptions.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Receipt className="h-4 w-4" />Linked Invoices</h4>
                  {selected.linkedInvoices.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No linked invoices.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selected.linkedInvoices.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Communication Preferences</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Badge variant="outline" className={selected.preferences.email ? 'status-active' : 'status-inactive'}>Email {selected.preferences.email ? 'On' : 'Off'}</Badge>
                    <Badge variant="outline" className={selected.preferences.sms ? 'status-active' : 'status-inactive'}>SMS {selected.preferences.sms ? 'On' : 'Off'}</Badge>
                    <Badge variant="outline" className={selected.preferences.phone ? 'status-active' : 'status-inactive'}>Phone {selected.preferences.phone ? 'On' : 'Off'}</Badge>
                  </div>
                </div>

                {canModify && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" className="flex-1" onClick={() => { setPanelOpen(false); openEdit(selected); }}>
                      <Edit className="h-4 w-4 mr-2" />Edit
                    </Button>
                    {!selected.isPrimaryBilling && (
                      <Button variant="outline" className="flex-1" onClick={() => setPrimaryBilling(selected)}>
                        <Star className="h-4 w-4 mr-2" />Set Primary
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Contact Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>Update contact information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Title</Label><Input value={draft.title || ''} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input value={draft.email || ''} onChange={e => setDraft({ ...draft, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={draft.phone || ''} onChange={e => setDraft({ ...draft, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={draft.notes || ''} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Create a new company contact.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Title</Label><Input value={draft.title || ''} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email *</Label><Input value={draft.email || ''} onChange={e => setDraft({ ...draft, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={draft.phone || ''} onChange={e => setDraft({ ...draft, phone: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Contact Type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.contactType || 'Support'}
                onChange={e => setDraft({ ...draft, contactType: e.target.value as ContactType })}
              >
                {(['Billing','Support','Executive','Renewal Contact','Technical Contact'] as ContactType[]).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Add Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default ContactsPage;
