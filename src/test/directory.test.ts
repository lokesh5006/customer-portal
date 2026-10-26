import { describe, expect, it } from 'vitest';
import type { Company, User } from '@/contexts/AppContext';
import {
  findCompanyByAddress, findCompanyByName, normalizeCompanyName, wouldStraddle,
} from '@/lib/directory';

const companies: Company[] = [
  { id: 'c1', name: 'Smith & Jones LLP', createdAt: '', address: { line1: '200 Park Avenue', city: 'New York', state: 'NY', postalCode: '10166' } },
  { id: 'c2', name: 'Other Firm', createdAt: '' },
];
const user = (id: string, email: string, companyId: string): User => ({
  id, email, companyId, firstName: '', lastName: '', username: '', roles: [], status: 'active', lastLogin: null, createdAt: '',
});
const data = {
  companies,
  users: [user('u1', 'a@x.com', 'c1'), user('u2', 'b@x.com', 'c1'), user('u3', 'b@x.com', 'c2')],
  loginIdentities: [{ email: 'b@x.com', allowStraddlingException: true }],
};

describe('directory', () => {
  it('normalizes company names', () => {
    expect(normalizeCompanyName('Smith and Jones, L.L.P.')).toBe(normalizeCompanyName('Smith & Jones LLP'));
    expect(findCompanyByName(data, 'smith and jones, l.l.p.')?.id).toBe('c1');
    expect(findCompanyByName(data, 'Smith Jones')).toBeUndefined();
  });

  it('matches addresses after normalization, excluding the caller firm', () => {
    const addr = { line1: '200 Park Ave.', city: 'new york', state: 'ny', postalCode: '10166-0001' };
    expect(findCompanyByAddress(data, addr)?.id).toBe('c1');
    expect(findCompanyByAddress(data, addr, 'c1')).toBeUndefined();
    expect(findCompanyByAddress(data, { ...addr, postalCode: '10167' })).toBeUndefined();
  });

  it('blocks a second firm unless the login has the exception', () => {
    expect(wouldStraddle(data, 'A@x.com', 'c2')).toBe(true);
    expect(wouldStraddle(data, 'a@x.com', 'c1')).toBe(false);
    expect(wouldStraddle(data, 'b@x.com', 'c3')).toBe(false);
  });
});
