// Bulk Import validation + parsing (US-SP07-USR-001).
// Kept separate from the dialog UI so the rules are unit-testable.
import * as XLSX from 'xlsx';
import { Role } from '@/contexts/AppContext';

export const MAX_IMPORT_ROWS = 500;
export const MAX_PREVIEW_ROWS = 100;

// Roles a bulk-imported user may be assigned. Account Owner is protected and
// intentionally excluded.
const ROLE_IMPORT_MAP: Record<string, Role> = {
  'registered contact': 'registered_contact',
  'license admin': 'license_admin',
  'billing admin': 'billing_admin',
};
export const IMPORTABLE_ROLE_LABELS = ['Registered Contact', 'License Admin', 'Billing Admin'];

export interface ParsedRow {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  phone?: string;
  roles: Role[];
  rolesRaw: string;
  dataNetEmailOptIn: boolean;
  status: 'active' | 'inactive';
}

export interface ValidatedRow {
  rowNumber: number; // 1-based data row index (header excluded)
  parsed: ParsedRow;
  errors: string[];
  valid: boolean;
}

export interface ParseResult {
  rows: ValidatedRow[];
  fileError?: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
}

export interface ExistingDirectory {
  emails: Set<string>;     // lowercased existing company emails
  usernames: Set<string>;  // lowercased existing company usernames
}

const REQUIRED_COLUMNS: Array<{ key: keyof ColumnMap; label: string }> = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'username', label: 'Username' },
  { key: 'role', label: 'Role' },
];

interface ColumnMap {
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  role?: string;
  phone?: string;
  dataNet?: string;
  status?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Map a parsed header row to canonical column keys.
function buildColumnMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  headers.forEach(h => {
    const n = norm(h);
    if (['firstname', 'first'].includes(n)) map.firstName = h;
    else if (['lastname', 'last'].includes(n)) map.lastName = h;
    else if (['email', 'emailaddress'].includes(n)) map.email = h;
    else if (['username', 'user'].includes(n)) map.username = h;
    else if (['role', 'roles'].includes(n)) map.role = h;
    else if (['phone', 'phonenumber'].includes(n)) map.phone = h;
    else if (['datanetemailoptin', 'datanetoptin', 'datanetemail', 'datanet'].includes(n)) map.dataNet = h;
    else if (['status'].includes(n)) map.status = h;
  });
  return map;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9._-]+$/;

function parseBool(value: string | undefined, dflt: boolean): boolean {
  if (value === undefined || value === '') return dflt;
  const v = value.trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(v)) return true;
  if (['false', 'no', 'n', '0'].includes(v)) return false;
  return dflt;
}

function parseRoles(raw: string): { roles: Role[]; error?: string } {
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return { roles: [], error: 'Role is required' };
  const roles: Role[] = [];
  for (const part of parts) {
    const key = norm(part);
    if (key === 'accountowner') return { roles: [], error: 'Account Owner cannot be assigned via import' };
    const mapped = ROLE_IMPORT_MAP[part.trim().toLowerCase()];
    if (!mapped) return { roles: [], error: `Unknown role "${part}"` };
    if (!roles.includes(mapped)) roles.push(mapped);
  }
  return { roles };
}

/** Parse a File's bytes (xlsx) or CSV text into a validated result. */
export function parseImportData(
  data: ArrayBuffer,
  existing: ExistingDirectory,
): ParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: 'array' });
  } catch {
    return { rows: [], fileError: 'Could not read the file. Please upload a valid .xlsx or .csv file.', totalRows: 0, validCount: 0, invalidCount: 0 };
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], fileError: 'The file has no sheets.', totalRows: 0, validCount: 0, invalidCount: 0 };
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  if (matrix.length === 0) {
    return { rows: [], fileError: 'The file is empty.', totalRows: 0, validCount: 0, invalidCount: 0 };
  }

  const headers = (matrix[0] || []).map(h => String(h).trim());
  const colMap = buildColumnMap(headers);

  const missing = REQUIRED_COLUMNS.filter(c => !colMap[c.key]).map(c => c.label);
  if (missing.length > 0) {
    return { rows: [], fileError: `Missing required column(s): ${missing.join(', ')}.`, totalRows: 0, validCount: 0, invalidCount: 0 };
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length === 0) {
    return { rows: [], fileError: 'The file has no data rows.', totalRows: 0, validCount: 0, invalidCount: 0 };
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return { rows: [], fileError: `Too many rows (${dataRows.length}). The maximum is ${MAX_IMPORT_ROWS}.`, totalRows: dataRows.length, validCount: 0, invalidCount: 0 };
  }

  const headerIndex = (label: string | undefined) => label ? headers.indexOf(label) : -1;
  const idx = {
    firstName: headerIndex(colMap.firstName),
    lastName: headerIndex(colMap.lastName),
    email: headerIndex(colMap.email),
    username: headerIndex(colMap.username),
    role: headerIndex(colMap.role),
    phone: headerIndex(colMap.phone),
    dataNet: headerIndex(colMap.dataNet),
    status: headerIndex(colMap.status),
  };
  const cell = (row: string[], i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '');

  // Track duplicates within the file.
  const seenEmails = new Map<string, number>();
  const seenUsernames = new Map<string, number>();

  const rows: ValidatedRow[] = dataRows.map((row, i) => {
    const firstName = cell(row, idx.firstName);
    const lastName = cell(row, idx.lastName);
    const email = cell(row, idx.email);
    const username = cell(row, idx.username);
    const phone = cell(row, idx.phone);
    const rolesRaw = cell(row, idx.role);
    const dataNet = parseBool(cell(row, idx.dataNet), true);
    const statusRaw = cell(row, idx.status).toLowerCase();
    const status: 'active' | 'inactive' = statusRaw === 'inactive' ? 'inactive' : 'active';

    const errors: string[] = [];

    if (!firstName) errors.push('First name is required');
    else if (firstName.length > 50) errors.push('First name exceeds 50 characters');
    if (!lastName) errors.push('Last name is required');
    else if (lastName.length > 50) errors.push('Last name exceeds 50 characters');

    const emailLc = email.toLowerCase();
    if (!email) errors.push('Email is required');
    else if (!EMAIL_RE.test(email)) errors.push('Email is not a valid format');
    else if (existing.emails.has(emailLc)) errors.push('Email already exists in company');
    else if (seenEmails.has(emailLc)) errors.push(`Duplicate email in file (row ${seenEmails.get(emailLc)})`);

    const usernameLc = username.toLowerCase();
    if (!username) errors.push('Username is required');
    else if (!USERNAME_RE.test(username)) errors.push('Username contains invalid characters');
    else if (username.length > 50) errors.push('Username exceeds 50 characters');
    else if (existing.usernames.has(usernameLc)) errors.push('Username already exists in company');
    else if (seenUsernames.has(usernameLc)) errors.push(`Duplicate username in file (row ${seenUsernames.get(usernameLc)})`);

    const { roles, error: roleError } = parseRoles(rolesRaw);
    if (roleError) errors.push(roleError);

    if (phone && (phone.length < 7 || phone.length > 20)) errors.push('Phone must be 7–20 characters');

    if (emailLc && !seenEmails.has(emailLc)) seenEmails.set(emailLc, i + 1);
    if (usernameLc && !seenUsernames.has(usernameLc)) seenUsernames.set(usernameLc, i + 1);

    return {
      rowNumber: i + 1,
      parsed: { firstName, lastName, email, username, phone: phone || undefined, roles, rolesRaw, dataNetEmailOptIn: dataNet, status },
      errors,
      valid: errors.length === 0,
    };
  });

  const validCount = rows.filter(r => r.valid).length;
  return { rows, totalRows: rows.length, validCount, invalidCount: rows.length - validCount };
}

const TEMPLATE_HEADERS = ['First Name', 'Last Name', 'Email', 'Username', 'Phone', 'Role', 'DataNet Email Opt-In', 'Status'];
const TEMPLATE_SAMPLE = [
  ['Alex', 'Carter', 'alex.carter@example.com', 'alexcarter', '555-0100', 'Registered Contact', 'true', 'active'],
  ['Jordan', 'Lee', 'jordan.lee@example.com', 'jordanlee', '555-0101', 'License Admin', 'true', 'active'],
  ['Taylor', 'Reyes', 'taylor.reyes@example.com', 'taylorreyes', '', 'Billing Admin, Registered Contact', 'false', 'active'],
];

/** Build a sample template workbook and return it as a Blob for download. */
export function buildTemplateBlob(format: 'xlsx' | 'csv'): Blob {
  const aoa = [TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
