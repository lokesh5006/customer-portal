import type { Company, LoginIdentity, User } from '@/contexts/AppContext';

/**
 * v20 — Directory service: the one place that answers "who is linked to which firm" and
 * "does this company already exist". Today every function reads the in-memory mock data;
 * swap the bodies for CRM lookups later without touching the screens that call them
 * (they go through useDirectory()).
 *
 * A "firm" is the top-level customer (Company.id). Sites under one firm are never
 * different firms; parent/child customers with different ids are.
 */
export interface DirectoryData {
  users: User[];
  companies: Company[];
  loginIdentities: LoginIdentity[];
}

export interface AddressInput {
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// ============================================================
// DUPLICATE-CHECK RULES — PLACEHOLDERS pending client confirmation.
// Exact match after normalization only; no fuzzy matching.
// ============================================================

/** Trailing words dropped from a company name before comparing. */
const COMPANY_NAME_SUFFIXES = new Set([
  'inc', 'llc', 'llp', 'ltd', 'corp', 'corporation', 'co', 'company', 'pc', 'pllc',
]);

/**
 * Company name: lowercase, "&" = "and", remove punctuation, collapse spaces, then drop
 * trailing suffixes (so "Smith and Jones, L.L.P." == "Smith & Jones LLP").
 */
export const normalizeCompanyName = (name: string): string => {
  const words = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.']/g, '')            // L.L.P. -> llp, O'Neil -> oneil
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && COMPANY_NAME_SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(' ');
};

/** Street words standardized before comparing ("#" is treated as "suite"). */
const STREET_WORD_MAP: Record<string, string> = {
  street: 'st',
  avenue: 'ave',
  road: 'rd',
  suite: 'ste',
};

const normalizeAddressPart = (value: string): string =>
  value
    .toLowerCase()
    .replace(/#/g, ' ste ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => STREET_WORD_MAP[w] ?? w)
    .join(' ');

/**
 * Physical address key: line 1, city, state and the first 5 ZIP digits, each normalized.
 * Returns null when any part is missing (an incomplete address never matches).
 */
export const normalizeAddress = (addr: AddressInput | undefined): string | null => {
  if (!addr) return null;
  const line1 = normalizeAddressPart(addr.line1 ?? '');
  const city = normalizeAddressPart(addr.city ?? '');
  const state = normalizeAddressPart(addr.state ?? '');
  const zip = (addr.postalCode ?? '').replace(/\D/g, '').slice(0, 5);
  if (!line1 || !city || !state || !zip) return null;
  return [line1, city, state, zip].join('|');
};

// ============================================================
// Lookups
// ============================================================

/** Firms (top-level customers) that have a user or contact record with this email. */
export const findFirmsByEmail = (data: DirectoryData, email: string): Company[] => {
  const target = normalizeEmail(email);
  if (!target) return [];
  const firmIds = new Set(
    data.users.filter(u => normalizeEmail(u.email) === target).map(u => u.companyId),
  );
  return data.companies.filter(c => firmIds.has(c.id));
};

/** A CRM contact with this email that has no portal login yet, if any. */
export const findContactByEmail = (data: DirectoryData, email: string): User | undefined => {
  const target = normalizeEmail(email);
  if (!target) return undefined;
  return data.users.find(u => normalizeEmail(u.email) === target && u.hasPortalLogin === false);
};

export const findCompanyByName = (data: DirectoryData, name: string): Company | undefined => {
  const target = normalizeCompanyName(name);
  if (!target) return undefined;
  return data.companies.find(c => normalizeCompanyName(c.name) === target);
};

/** `excludeFirmId` skips the caller's own firm (a firm never duplicates itself). */
export const findCompanyByAddress = (
  data: DirectoryData,
  address: AddressInput,
  excludeFirmId?: string,
): Company | undefined => {
  const target = normalizeAddress(address);
  if (!target) return undefined;
  return data.companies.find(c => c.id !== excludeFirmId && normalizeAddress(c.address) === target);
};

/** The "Allowed Straddling Exception" flag for this email's login identity. Default false. */
export const hasStraddlingException = (data: DirectoryData, email: string): boolean => {
  const target = normalizeEmail(email);
  return data.loginIdentities.some(i => normalizeEmail(i.email) === target && i.allowStraddlingException);
};

/** Inline error on contact add/edit when wouldStraddle() is true. Never names the other firm. */
export const STRADDLE_EMAIL_ERROR =
  'This email address is already associated with another customer. Use a different email address or contact support.';

/** True when linking this email to `firmId` would link it to a second firm without the exception. */
export const wouldStraddle = (data: DirectoryData, email: string, firmId: string): boolean => {
  const linkedElsewhere = findFirmsByEmail(data, email).some(f => f.id !== firmId);
  return linkedElsewhere && !hasStraddlingException(data, email);
};
