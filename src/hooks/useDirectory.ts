import { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  AddressInput,
  findCompanyByAddress,
  findCompanyByName,
  findContactByEmail,
  findFirmsByEmail,
  hasStraddlingException,
  wouldStraddle,
} from '@/lib/directory';

/** v20 — directory service bound to the current app (mock) data. */
export const useDirectory = () => {
  const { users, companies, loginIdentities } = useApp();
  return useMemo(() => {
    const data = { users, companies, loginIdentities };
    return {
      findFirmsByEmail: (email: string) => findFirmsByEmail(data, email),
      findContactByEmail: (email: string) => findContactByEmail(data, email),
      findCompanyByName: (name: string) => findCompanyByName(data, name),
      findCompanyByAddress: (address: AddressInput, excludeFirmId?: string) =>
        findCompanyByAddress(data, address, excludeFirmId),
      hasStraddlingException: (email: string) => hasStraddlingException(data, email),
      wouldStraddle: (email: string, firmId: string) => wouldStraddle(data, email, firmId),
    };
  }, [users, companies, loginIdentities]);
};
