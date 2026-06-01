import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp, Company } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Check } from 'lucide-react';

export const EditBillingDetailsDialog = ({
  open, onOpenChange, company,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  company: Company | null;
}) => {
  const { getCompanyUsers, updateCompanyBillingDetails } = useApp();
  const { toast } = useToast();

  const companyUsers = getCompanyUsers().filter(u => u.status !== 'inactive');

  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('United States');
  const [contactIds, setContactIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !company) return;
    setName(company.name);
    setLine1(company.address?.line1 || '');
    setLine2(company.address?.line2 || '');
    setCity(company.address?.city || '');
    setStateRegion(company.address?.state || '');
    setPostalCode(company.address?.postalCode || '');
    setCountry(company.address?.country || 'United States');
    setContactIds(company.billingContactUserIds || []);
  }, [open, company]);

  if (!company) return null;

  const toggleContact = (id: string) => {
    setContactIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: 'Company name is required', variant: 'destructive' });
      return;
    }
    updateCompanyBillingDetails({
      companyId: company.id,
      name: name.trim(),
      address: {
        line1: line1.trim() || undefined,
        line2: line2.trim() || undefined,
        city: city.trim() || undefined,
        state: stateRegion.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim() || undefined,
      },
      contactUserIds: contactIds,
    });
    toast({ title: 'Billing details updated.' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Billing Details</DialogTitle>
          <DialogDescription>Update the billing address and contacts for {company.name}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label htmlFor="bd-name" className="text-sm">Company Name</Label>
            <Input id="bd-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="bd-line1" className="text-sm">Address Line 1</Label>
            <Input id="bd-line1" value={line1} onChange={(e) => setLine1(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="bd-line2" className="text-sm">Address Line 2 <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="bd-line2" value={line2} onChange={(e) => setLine2(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bd-city" className="text-sm">City</Label>
              <Input id="bd-city" value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="bd-state" className="text-sm">State / Region</Label>
              <Input id="bd-state" value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bd-zip" className="text-sm">Postal Code</Label>
              <Input id="bd-zip" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="bd-country" className="text-sm">Country</Label>
              <Input id="bd-country" value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-sm">Company Contacts</Label>
            <p className="text-xs text-muted-foreground mb-2">Select the users who serve as billing contacts. Their emails populate the billing record.</p>
            <div className="flex flex-wrap gap-2">
              {companyUsers.map(u => {
                const selected = contactIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleContact(u.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                      selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted/60'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                    {u.firstName} {u.lastName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
