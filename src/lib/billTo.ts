import type { Company, CompanyAddress, Invoice, InvoiceBillTo } from '@/contexts/AppContext';

/**
 * v19 — when false, the Bill-to name and Attention fields are read-only for every firm
 * (bill-to labels then come only from the CRM). Billed-through firms are always read-only.
 */
export const ALLOW_FIRM_EDIT_BILL_TO = true;

export const BILL_TO_NAME_MAX = 120;
export const BILL_TO_ATTENTION_MAX = 80;

export const validateBillTo = (name: string, attention: string) => ({
  name: name.trim().length > BILL_TO_NAME_MAX
    ? `Bill-to name must be ${BILL_TO_NAME_MAX} characters or fewer`
    : null,
  attention: attention.trim().length > BILL_TO_ATTENTION_MAX
    ? `Attention must be ${BILL_TO_ATTENTION_MAX} characters or fewer`
    : null,
});

const fromAddress = (name: string, addr?: CompanyAddress): InvoiceBillTo => ({
  name: addr?.billToName?.trim() || name,
  attention: addr?.billToAttention?.trim() || undefined,
  line1: addr?.line1,
  line2: addr?.line2,
  city: addr?.city,
  state: addr?.state,
  postalCode: addr?.postalCode,
  country: addr?.country,
});

/** The firm's current bill-to: the parent's details for a billed-through firm, else its own. */
export const companyBillTo = (company: Company): InvoiceBillTo =>
  company.billedThrough
    ? fromAddress(company.billedThrough.name, company.billedThrough.address)
    : fromAddress(company.name, company.address);

/** Invoices keep their own snapshot; older invoices without one fall back to the firm's current details. */
export const invoiceBillTo = (invoice: Invoice, company: Company | null | undefined): InvoiceBillTo | null =>
  invoice.billTo ?? (company ? companyBillTo(company) : null);

/** Stamps a bill-to snapshot on a newly created invoice (no-op if it already has one). */
export const withBillTo = (invoice: Invoice, companies: Company[]): Invoice => {
  if (invoice.billTo) return invoice;
  const company = companies.find(c => c.id === invoice.companyId);
  return company ? { ...invoice, billTo: companyBillTo(company) } : invoice;
};

/** Address lines only: lines 1/2, "City, State ZIP", Country. */
export const addressLines = (b: Omit<InvoiceBillTo, 'name'>): string[] =>
  [
    b.line1,
    b.line2,
    [b.city, [b.state, b.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    b.country,
  ].filter((s): s is string => !!s && !!s.trim());

/** Full "Bill to" block: name, `Attn: …` (only when present), then the address lines. */
export const billToLines = (b: InvoiceBillTo): string[] => [
  b.name,
  ...(b.attention ? [`Attn: ${b.attention}`] : []),
  ...addressLines(b),
];
