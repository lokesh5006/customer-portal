import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { InvoiceBillTo } from '@/contexts/AppContext';
import { billToLines } from '@/lib/billTo';

/** v19 — "Bill to" display: name, `Attn: …` (only when set), then the address lines. */
export const BillToBlock = ({ billTo }: { billTo: InvoiceBillTo }) => (
  <div>
    {billToLines(billTo).map((line, i) => (
      <p key={i} className={i === 0 ? 'font-medium' : undefined}>{line}</p>
    ))}
  </div>
);

/** v19 — note shown above the read-only billing block of a billed-through (SHI-style) firm. */
export const BilledThroughNote = ({ parentName }: { parentName: string }) => (
  <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
      Invoices for this firm are billed through {parentName}. Contact Leimberg to change this.
    </AlertDescription>
  </Alert>
);
