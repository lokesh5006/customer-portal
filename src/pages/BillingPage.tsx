import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { FileText, Eye, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export const BillingPage = () => {
  const { getCompanyInvoices, currentCompany } = useApp();
  const { toast } = useToast();
  const invoices = getCompanyInvoices();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handlePay = (invoice: any) => {
    toast({ title: 'Payment initiated', description: `Processing payment for ${invoice.invoiceNumber}` });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-muted-foreground">Invoices for {currentCompany?.name}</p>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>{new Date(inv.date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`status-${inv.status}`}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell>${inv.amount.toLocaleString()}</TableCell>
                    <TableCell>${inv.balance.toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(inv); setDetailsOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {inv.balance > 0 && (
                        <Button size="sm" variant="outline" onClick={() => handlePay(inv)}>
                          <CreditCard className="h-4 w-4 mr-1" /> Pay
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invoice {selectedInvoice?.invoiceNumber}</DialogTitle></DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              {selectedInvoice.lineItems.map((item: any, i: number) => (
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
    </MainLayout>
  );
};
