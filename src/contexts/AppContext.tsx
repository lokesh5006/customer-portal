import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Types
export type UserRole = 'owner' | 'billing' | 'admin' | 'standard';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: UserRole[];
  status: 'active' | 'invited' | 'inactive';
  lastLogin: string | null;
  createdAt: string;
  companyId: string;
  phone?: string;
  jobTitle?: string;
}

export interface Company {
  id: string;
  name: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  companyId: string;
  product: string;
  term: 'annual';
  status: 'active' | 'cancelled' | 'pending';
  renewalDate: string;
  purchasedSeats: number;
  pricePerSeat: number;
}

export interface License {
  userId: string;
  productId: string;
  assignedAt: string;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
  amount: number;
  balance: number;
  lineItems: { description: string; quantity: number; unitPrice: number; total: number }[];
}

export interface SupportTicket {
  id: string;
  companyId: string;
  userId: string;
  category: string;
  subject: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  createdAt: string;
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  currentUser: User | null;
  currentCompany: Company | null;
  
  // Role switching for demo
  demoRoles: UserRole[];
  billingHasAdminAccess: boolean;
  
  // Proxy session
  isProxySession: boolean;
  proxiedUser: User | null;
  originalUser: User | null;
  
  // Data
  companies: Company[];
  users: User[];
  subscriptions: Subscription[];
  licenses: License[];
  invoices: Invoice[];
  supportTickets: SupportTicket[];
  
  // Wizard state
  wizardData: {
    companyName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    selectedProduct: string;
    selectedTerm: 'annual';
    selectedSeats: number;
    termsAccepted: boolean;
  };
}

interface AppContextType extends AppState {
  // Auth actions
  login: (email: string, password: string) => boolean;
  logout: () => void;
  selectCompany: (companyId: string) => void;
  
  // Demo role switching
  setDemoRoles: (roles: UserRole[]) => void;
  setBillingHasAdminAccess: (value: boolean) => void;
  
  // Proxy
  startProxySession: (userId: string) => void;
  endProxySession: () => void;
  
  // User management
  addUser: (user: Omit<User, 'id' | 'createdAt' | 'companyId'>) => User;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deactivateUser: (userId: string) => void;
  reactivateUser: (userId: string) => void;
  changeUserRoles: (userId: string, roles: UserRole[]) => boolean;
  
  // Subscription management
  updateSubscriptionSeats: (subscriptionId: string, newSeats: number) => void;
  
  // License management
  assignLicense: (userId: string, productId: string) => boolean;
  unassignLicense: (userId: string, productId: string) => void;
  bulkUnassignLicenses: (userIds: string[], productId: string) => void;
  getAssignedLicenseCount: (productId: string) => number;
  
  // Wizard
  updateWizardData: (data: Partial<AppState['wizardData']>) => void;
  completeSignup: () => void;
  
  // Tickets
  createTicket: (ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'status' | 'companyId' | 'userId'>) => SupportTicket;
  
  // Helpers
  getEffectiveRoles: () => UserRole[];
  hasAccess: (requiredRoles: UserRole[]) => boolean;
  getUserCompanies: (userId: string) => Company[];
  getCompanyUsers: () => User[];
  getCompanySubscriptions: () => Subscription[];
  getCompanyInvoices: () => Invoice[];
  getCompanyTickets: () => SupportTicket[];
}

// Initial mock data
const initialCompanies: Company[] = [
  { id: 'company-1', name: 'ABC Accounting', createdAt: '2023-01-15' },
  { id: 'company-2', name: 'XYZ Consulting', createdAt: '2023-06-20' },
];

const initialUsers: User[] = [
  // ABC Accounting users
  { id: 'user-1', firstName: 'John', lastName: 'Smith', email: 'john.smith@abcaccounting.com', roles: ['owner'], status: 'active', lastLogin: '2024-01-20', createdAt: '2023-01-15', companyId: 'company-1', jobTitle: 'CEO' },
  { id: 'user-2', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@abcaccounting.com', roles: ['billing'], status: 'active', lastLogin: '2024-01-19', createdAt: '2023-02-10', companyId: 'company-1', jobTitle: 'CFO' },
  { id: 'user-3', firstName: 'Mike', lastName: 'Williams', email: 'mike.williams@abcaccounting.com', roles: ['admin'], status: 'active', lastLogin: '2024-01-18', createdAt: '2023-03-05', companyId: 'company-1', jobTitle: 'IT Manager' },
  { id: 'user-4', firstName: 'Emily', lastName: 'Brown', email: 'emily.brown@abcaccounting.com', roles: ['billing', 'admin'], status: 'active', lastLogin: '2024-01-17', createdAt: '2023-04-12', companyId: 'company-1', jobTitle: 'Operations Manager' },
  { id: 'user-5', firstName: 'David', lastName: 'Davis', email: 'david.davis@abcaccounting.com', roles: ['standard'], status: 'active', lastLogin: '2024-01-15', createdAt: '2023-05-20', companyId: 'company-1', jobTitle: 'Accountant' },
  { id: 'user-6', firstName: 'Lisa', lastName: 'Miller', email: 'lisa.miller@abcaccounting.com', roles: ['standard'], status: 'active', lastLogin: '2024-01-10', createdAt: '2023-06-01', companyId: 'company-1', jobTitle: 'Senior Accountant' },
  { id: 'user-7', firstName: 'James', lastName: 'Wilson', email: 'james.wilson@abcaccounting.com', roles: ['standard'], status: 'invited', lastLogin: null, createdAt: '2024-01-10', companyId: 'company-1', jobTitle: 'Junior Accountant' },
  { id: 'user-8', firstName: 'Jennifer', lastName: 'Taylor', email: 'jennifer.taylor@abcaccounting.com', roles: ['standard'], status: 'active', lastLogin: '2023-12-01', createdAt: '2023-07-15', companyId: 'company-1', jobTitle: 'Tax Specialist' },
  { id: 'user-9', firstName: 'Robert', lastName: 'Anderson', email: 'robert.anderson@abcaccounting.com', roles: ['admin', 'standard'], status: 'inactive', lastLogin: '2023-10-15', createdAt: '2023-08-01', companyId: 'company-1', jobTitle: 'Former Manager' },
  { id: 'user-10', firstName: 'Amanda', lastName: 'Thomas', email: 'amanda.thomas@abcaccounting.com', roles: ['standard'], status: 'active', lastLogin: '2024-01-19', createdAt: '2023-09-10', companyId: 'company-1', jobTitle: 'Bookkeeper' },
  { id: 'user-11', firstName: 'Chris', lastName: 'Martinez', email: 'chris.martinez@abcaccounting.com', roles: ['standard'], status: 'active', lastLogin: '2024-01-16', createdAt: '2023-10-05', companyId: 'company-1', jobTitle: 'Financial Analyst' },
  { id: 'user-12', firstName: 'Nicole', lastName: 'Garcia', email: 'nicole.garcia@abcaccounting.com', roles: ['standard'], status: 'active', lastLogin: null, createdAt: '2023-11-20', companyId: 'company-1', jobTitle: 'Intern' },
  { id: 'user-13', firstName: 'Kevin', lastName: 'Lee', email: 'kevin.lee@abcaccounting.com', roles: ['standard'], status: 'active', lastLogin: '2024-01-05', createdAt: '2023-12-01', companyId: 'company-1', jobTitle: 'Auditor' },
  
  // XYZ Consulting users
  { id: 'user-20', firstName: 'Michael', lastName: 'Chen', email: 'michael.chen@xyzconsulting.com', roles: ['owner'], status: 'active', lastLogin: '2024-01-20', createdAt: '2023-06-20', companyId: 'company-2', jobTitle: 'Managing Partner' },
  { id: 'user-21', firstName: 'Jessica', lastName: 'Wong', email: 'jessica.wong@xyzconsulting.com', roles: ['billing'], status: 'active', lastLogin: '2024-01-18', createdAt: '2023-07-01', companyId: 'company-2', jobTitle: 'Finance Director' },
  { id: 'user-22', firstName: 'Daniel', lastName: 'Kim', email: 'daniel.kim@xyzconsulting.com', roles: ['admin'], status: 'active', lastLogin: '2024-01-17', createdAt: '2023-07-15', companyId: 'company-2', jobTitle: 'IT Director' },
  { id: 'user-23', firstName: 'Rachel', lastName: 'Park', email: 'rachel.park@xyzconsulting.com', roles: ['standard'], status: 'active', lastLogin: '2024-01-16', createdAt: '2023-08-01', companyId: 'company-2', jobTitle: 'Consultant' },
  { id: 'user-24', firstName: 'Steven', lastName: 'Liu', email: 'steven.liu@xyzconsulting.com', roles: ['standard'], status: 'active', lastLogin: '2024-01-15', createdAt: '2023-08-20', companyId: 'company-2', jobTitle: 'Senior Consultant' },
  { id: 'user-25', firstName: 'Laura', lastName: 'Huang', email: 'laura.huang@xyzconsulting.com', roles: ['standard'], status: 'invited', lastLogin: null, createdAt: '2024-01-15', companyId: 'company-2', jobTitle: 'Associate' },
];

const initialSubscriptions: Subscription[] = [
  { id: 'sub-1', companyId: 'company-1', product: 'NumberCruncher Desktop', term: 'annual', status: 'active', renewalDate: '2024-12-31', purchasedSeats: 15, pricePerSeat: 299 },
  { id: 'sub-2', companyId: 'company-2', product: 'NumberCruncher Desktop', term: 'annual', status: 'active', renewalDate: '2024-12-31', purchasedSeats: 10, pricePerSeat: 299 },
];

const initialLicenses: License[] = [
  // ABC Accounting - 13 licenses assigned (for demo of reduction flow)
  { userId: 'user-1', productId: 'NumberCruncher Desktop', assignedAt: '2023-01-15' },
  { userId: 'user-2', productId: 'NumberCruncher Desktop', assignedAt: '2023-02-10' },
  { userId: 'user-3', productId: 'NumberCruncher Desktop', assignedAt: '2023-03-05' },
  { userId: 'user-4', productId: 'NumberCruncher Desktop', assignedAt: '2023-04-12' },
  { userId: 'user-5', productId: 'NumberCruncher Desktop', assignedAt: '2023-05-20' },
  { userId: 'user-6', productId: 'NumberCruncher Desktop', assignedAt: '2023-06-01' },
  { userId: 'user-8', productId: 'NumberCruncher Desktop', assignedAt: '2023-07-15' },
  { userId: 'user-10', productId: 'NumberCruncher Desktop', assignedAt: '2023-09-10' },
  { userId: 'user-11', productId: 'NumberCruncher Desktop', assignedAt: '2023-10-05' },
  { userId: 'user-12', productId: 'NumberCruncher Desktop', assignedAt: '2023-11-20' },
  { userId: 'user-13', productId: 'NumberCruncher Desktop', assignedAt: '2023-12-01' },
  // XYZ - 4 licenses assigned
  { userId: 'user-20', productId: 'NumberCruncher Desktop', assignedAt: '2023-06-20' },
  { userId: 'user-21', productId: 'NumberCruncher Desktop', assignedAt: '2023-07-01' },
  { userId: 'user-22', productId: 'NumberCruncher Desktop', assignedAt: '2023-07-15' },
  { userId: 'user-23', productId: 'NumberCruncher Desktop', assignedAt: '2023-08-01' },
];

const initialInvoices: Invoice[] = [
  { 
    id: 'inv-1', 
    companyId: 'company-1', 
    invoiceNumber: 'INV-2024-001', 
    date: '2024-01-01', 
    dueDate: '2024-01-31', 
    status: 'paid', 
    amount: 4485, 
    balance: 0,
    lineItems: [{ description: 'NumberCruncher Desktop - 15 seats (Annual)', quantity: 15, unitPrice: 299, total: 4485 }]
  },
  { 
    id: 'inv-2', 
    companyId: 'company-1', 
    invoiceNumber: 'INV-2023-012', 
    date: '2023-12-01', 
    dueDate: '2023-12-31', 
    status: 'paid', 
    amount: 2990, 
    balance: 0,
    lineItems: [{ description: 'NumberCruncher Desktop - 10 seats (Annual)', quantity: 10, unitPrice: 299, total: 2990 }]
  },
  { 
    id: 'inv-3', 
    companyId: 'company-1', 
    invoiceNumber: 'INV-2023-006', 
    date: '2023-06-01', 
    dueDate: '2023-06-30', 
    status: 'overdue', 
    amount: 500, 
    balance: 500,
    lineItems: [{ description: 'Additional Support Services', quantity: 1, unitPrice: 500, total: 500 }]
  },
  { 
    id: 'inv-4', 
    companyId: 'company-2', 
    invoiceNumber: 'INV-2024-002', 
    date: '2024-01-01', 
    dueDate: '2024-01-31', 
    status: 'pending', 
    amount: 2990, 
    balance: 2990,
    lineItems: [{ description: 'NumberCruncher Desktop - 10 seats (Annual)', quantity: 10, unitPrice: 299, total: 2990 }]
  },
];

const initialTickets: SupportTicket[] = [
  { id: 'ticket-1', companyId: 'company-1', userId: 'user-5', category: 'Technical', subject: 'Installation issue on Windows 11', description: 'Cannot complete installation', status: 'resolved', createdAt: '2024-01-15' },
  { id: 'ticket-2', companyId: 'company-1', userId: 'user-6', category: 'Billing', subject: 'Invoice clarification', description: 'Need breakdown of charges', status: 'closed', createdAt: '2024-01-10' },
];

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>({
    isAuthenticated: false,
    currentUser: null,
    currentCompany: null,
    demoRoles: ['owner'],
    billingHasAdminAccess: false,
    isProxySession: false,
    proxiedUser: null,
    originalUser: null,
    companies: initialCompanies,
    users: initialUsers,
    subscriptions: initialSubscriptions,
    licenses: initialLicenses,
    invoices: initialInvoices,
    supportTickets: initialTickets,
    wizardData: {
      companyName: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      selectedProduct: '',
      selectedTerm: 'annual',
      selectedSeats: 1,
      termsAccepted: false,
    },
  });

  const login = useCallback((email: string, _password: string): boolean => {
    const user = state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user && user.status !== 'inactive') {
      const company = state.companies.find(c => c.id === user.companyId);
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        currentUser: user,
        currentCompany: company || null,
        demoRoles: user.roles,
      }));
      return true;
    }
    return false;
  }, [state.users, state.companies]);

  const logout = useCallback(() => {
    setState(prev => ({
      ...prev,
      isAuthenticated: false,
      currentUser: null,
      currentCompany: null,
      demoRoles: ['owner'],
      isProxySession: false,
      proxiedUser: null,
      originalUser: null,
    }));
  }, []);

  const selectCompany = useCallback((companyId: string) => {
    const company = state.companies.find(c => c.id === companyId);
    if (company) {
      setState(prev => ({ ...prev, currentCompany: company }));
    }
  }, [state.companies]);

  const setDemoRoles = useCallback((roles: UserRole[]) => {
    setState(prev => ({ ...prev, demoRoles: roles }));
  }, []);

  const setBillingHasAdminAccess = useCallback((value: boolean) => {
    setState(prev => ({ ...prev, billingHasAdminAccess: value }));
  }, []);

  const startProxySession = useCallback((userId: string) => {
    const user = state.users.find(u => u.id === userId);
    if (user) {
      setState(prev => ({
        ...prev,
        isProxySession: true,
        proxiedUser: user,
        originalUser: prev.currentUser,
        demoRoles: user.roles,
      }));
    }
  }, [state.users]);

  const endProxySession = useCallback(() => {
    setState(prev => ({
      ...prev,
      isProxySession: false,
      proxiedUser: null,
      demoRoles: prev.originalUser?.roles || ['owner'],
      originalUser: null,
    }));
  }, []);

  const addUser = useCallback((userData: Omit<User, 'id' | 'createdAt' | 'companyId'>): User => {
    const newUser: User = {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      companyId: state.currentCompany?.id || 'company-1',
    };
    setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
    return newUser;
  }, [state.currentCompany]);

  const updateUser = useCallback((userId: string, updates: Partial<User>) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, ...updates } : u),
    }));
  }, []);

  const deactivateUser = useCallback((userId: string) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, status: 'inactive' } : u),
      licenses: prev.licenses.filter(l => l.userId !== userId),
    }));
  }, []);

  const reactivateUser = useCallback((userId: string) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, status: 'active' } : u),
    }));
  }, []);

  const changeUserRoles = useCallback((userId: string, roles: UserRole[]): boolean => {
    const user = state.users.find(u => u.id === userId);
    if (!user) return false;
    
    // Check if removing last owner
    if (user.roles.includes('owner') && !roles.includes('owner')) {
      const otherOwners = state.users.filter(u => 
        u.id !== userId && 
        u.companyId === user.companyId && 
        u.roles.includes('owner') &&
        u.status !== 'inactive'
      );
      if (otherOwners.length === 0) {
        return false;
      }
    }
    
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, roles } : u),
    }));
    return true;
  }, [state.users]);

  const updateSubscriptionSeats = useCallback((subscriptionId: string, newSeats: number) => {
    setState(prev => ({
      ...prev,
      subscriptions: prev.subscriptions.map(s => 
        s.id === subscriptionId ? { ...s, purchasedSeats: newSeats } : s
      ),
    }));
  }, []);

  const assignLicense = useCallback((userId: string, productId: string): boolean => {
    const subscription = state.subscriptions.find(s => 
      s.companyId === state.currentCompany?.id && s.product === productId
    );
    if (!subscription) return false;
    
    const assignedCount = state.licenses.filter(l => {
      const user = state.users.find(u => u.id === l.userId);
      return user?.companyId === state.currentCompany?.id && l.productId === productId;
    }).length;
    
    if (assignedCount >= subscription.purchasedSeats) return false;
    
    setState(prev => ({
      ...prev,
      licenses: [...prev.licenses, { userId, productId, assignedAt: new Date().toISOString().split('T')[0] }],
    }));
    return true;
  }, [state.subscriptions, state.licenses, state.users, state.currentCompany]);

  const unassignLicense = useCallback((userId: string, productId: string) => {
    setState(prev => ({
      ...prev,
      licenses: prev.licenses.filter(l => !(l.userId === userId && l.productId === productId)),
    }));
  }, []);

  const bulkUnassignLicenses = useCallback((userIds: string[], productId: string) => {
    setState(prev => ({
      ...prev,
      licenses: prev.licenses.filter(l => !(userIds.includes(l.userId) && l.productId === productId)),
    }));
  }, []);

  const getAssignedLicenseCount = useCallback((productId: string): number => {
    return state.licenses.filter(l => {
      const user = state.users.find(u => u.id === l.userId);
      return user?.companyId === state.currentCompany?.id && l.productId === productId;
    }).length;
  }, [state.licenses, state.users, state.currentCompany]);

  const updateWizardData = useCallback((data: Partial<AppState['wizardData']>) => {
    setState(prev => ({
      ...prev,
      wizardData: { ...prev.wizardData, ...data },
    }));
  }, []);

  const completeSignup = useCallback(() => {
    const { companyName, firstName, lastName, email, selectedProduct, selectedSeats } = state.wizardData;
    
    const newCompanyId = `company-${Date.now()}`;
    const newCompany: Company = {
      id: newCompanyId,
      name: companyName,
      createdAt: new Date().toISOString().split('T')[0],
    };
    
    const newUserId = `user-${Date.now()}`;
    const newUser: User = {
      id: newUserId,
      firstName,
      lastName,
      email,
      roles: ['owner'],
      status: 'active',
      lastLogin: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
      companyId: newCompanyId,
    };
    
    const newSubscription: Subscription = {
      id: `sub-${Date.now()}`,
      companyId: newCompanyId,
      product: selectedProduct,
      term: 'annual',
      status: 'active',
      renewalDate: '2024-12-31',
      purchasedSeats: selectedSeats,
      pricePerSeat: 299,
    };
    
    const newLicense: License = {
      userId: newUserId,
      productId: selectedProduct,
      assignedAt: new Date().toISOString().split('T')[0],
    };
    
    setState(prev => ({
      ...prev,
      companies: [...prev.companies, newCompany],
      users: [...prev.users, newUser],
      subscriptions: [...prev.subscriptions, newSubscription],
      licenses: [...prev.licenses, newLicense],
      isAuthenticated: true,
      currentUser: newUser,
      currentCompany: newCompany,
      demoRoles: ['owner'],
    }));
  }, [state.wizardData]);

  const createTicket = useCallback((ticketData: Omit<SupportTicket, 'id' | 'createdAt' | 'status' | 'companyId' | 'userId'>): SupportTicket => {
    const newTicket: SupportTicket = {
      ...ticketData,
      id: `ticket-${Date.now()}`,
      companyId: state.currentCompany?.id || 'company-1',
      userId: state.currentUser?.id || 'user-1',
      status: 'open',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setState(prev => ({ ...prev, supportTickets: [...prev.supportTickets, newTicket] }));
    return newTicket;
  }, [state.currentCompany, state.currentUser]);

  const getEffectiveRoles = useCallback((): UserRole[] => {
    const roles = [...state.demoRoles];
    if (state.billingHasAdminAccess && roles.includes('billing') && !roles.includes('admin')) {
      roles.push('admin');
    }
    return roles;
  }, [state.demoRoles, state.billingHasAdminAccess]);

  const hasAccess = useCallback((requiredRoles: UserRole[]): boolean => {
    const effectiveRoles = getEffectiveRoles();
    return requiredRoles.some(role => effectiveRoles.includes(role));
  }, [getEffectiveRoles]);

  const getUserCompanies = useCallback((userId: string): Company[] => {
    const user = state.users.find(u => u.id === userId);
    if (!user) return [];
    return state.companies.filter(c => c.id === user.companyId);
  }, [state.users, state.companies]);

  const getCompanyUsers = useCallback((): User[] => {
    return state.users.filter(u => u.companyId === state.currentCompany?.id);
  }, [state.users, state.currentCompany]);

  const getCompanySubscriptions = useCallback((): Subscription[] => {
    return state.subscriptions.filter(s => s.companyId === state.currentCompany?.id);
  }, [state.subscriptions, state.currentCompany]);

  const getCompanyInvoices = useCallback((): Invoice[] => {
    return state.invoices.filter(i => i.companyId === state.currentCompany?.id);
  }, [state.invoices, state.currentCompany]);

  const getCompanyTickets = useCallback((): SupportTicket[] => {
    return state.supportTickets.filter(t => t.companyId === state.currentCompany?.id);
  }, [state.supportTickets, state.currentCompany]);

  return (
    <AppContext.Provider value={{
      ...state,
      login,
      logout,
      selectCompany,
      setDemoRoles,
      setBillingHasAdminAccess,
      startProxySession,
      endProxySession,
      addUser,
      updateUser,
      deactivateUser,
      reactivateUser,
      changeUserRoles,
      updateSubscriptionSeats,
      assignLicense,
      unassignLicense,
      bulkUnassignLicenses,
      getAssignedLicenseCount,
      updateWizardData,
      completeSignup,
      createTicket,
      getEffectiveRoles,
      hasAccess,
      getUserCompanies,
      getCompanyUsers,
      getCompanySubscriptions,
      getCompanyInvoices,
      getCompanyTickets,
    }}>
      {children}
    </AppContext.Provider>
  );
};
