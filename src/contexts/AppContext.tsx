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

export interface SubscriptionProduct {
  id: string;
  name: string;
  licenseCount: number;
  /** Original purchased license count — current seat count cannot go below this */
  purchasedLicenseCount?: number;
  pricePerLicense: number;
  status: 'active' | 'pending' | 'expired';
  /** Additional seats waiting on payment (Pay on Receipt) */
  pendingLicenseCount?: number;
}

export type PaymentMethod = 'pay_immediately' | 'pay_on_receipt' | 'pay_on_terms';
export type PaymentTerms = 'Net 15' | 'Net 30' | 'Net 45';

export interface CompanyBillingConfig {
  companyId: string;
  paymentEligibility: 'pay_on_receipt' | 'pay_on_terms';
  payOnTermsEnabled: boolean;
  terms?: PaymentTerms;
  defaultBillingMethod: PaymentMethod;
}

export interface Subscription {
  id: string;
  companyId: string;
  name: string;
  planType: string;
  billingFrequency: 'annual' | 'monthly';
  status: 'active' | 'cancelled' | 'pending' | 'expired' | 'overdue' | 'suspended' | 'pending_payment';
  startDate: string;
  renewalDate: string;
  baseFee?: number;          // Base subscription fee (e.g. $1,000)
  perSeatCost?: number;      // Default per-seat cost (e.g. $10)
  products: SubscriptionProduct[];
  /** Pending seat reductions scheduled for next renewal cycle: prodId -> new seat count */
  pendingChanges?: Record<string, number>;
}

export interface License {
  userId: string;
  subscriptionId: string;
  productId: string;
  assignedAt: string;
}

export interface InvoiceLineItem {
  product: string;
  quantity: number;
  unitPrice: number;
  proration?: number;
  total: number;
}

export type InvoiceType = 'Initial Invoice' | 'Renewal Invoice' | 'Adjustment Invoice';

export type InvoiceSource = 'Checkout' | 'Quote Acceptance' | 'License Change' | 'Renewal';

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue' | 'unpaid' | 'awaiting_payment' | 'payment_terms_applied';
  amount: number;
  balance: number;
  subscriptionId: string;
  subscriptionName: string;
  invoiceType?: InvoiceType;
  lineItems: InvoiceLineItem[];
  poNumber?: string;
  paymentMethod?: PaymentMethod;
  source?: InvoiceSource;
  quoteNumber?: string;
  /** Pending product license change to be applied when invoice is paid */
  pendingLicenseChange?: { subscriptionId: string; productId: string; newCount: number };
  /** Activates subscription from pending_payment when invoice is paid */
  activatesSubscription?: boolean;
}

export interface QuoteLineItem {
  productName: string;
  licenseCount: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  id: string;
  companyId: string;
  quoteNumber: string;
  createdDate: string;
  expiryDate: string;
  status: 'active' | 'accepted' | 'declined' | 'expired';
  amount: number;
  note: string;
  lineItems: QuoteLineItem[];
  poNumber?: string;
  paymentMethod?: PaymentMethod;
  declineReason?: string;
  invoiceId?: string;
}

export interface QuoteRequest {
  id: string;
  companyId: string;
  createdDate: string;
  status: 'submitted' | 'in_review' | 'closed';
  products: { productName: string; desiredLicenseCount: number }[];
  note: string;
}

export interface SupportTicket {
  id: string;
  companyId: string;
  userId: string;
  category: string;
  subject: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority?: 'high' | 'medium' | 'low';
  createdAt: string;
}

interface AppState {
  isAuthenticated: boolean;
  currentUser: User | null;
  currentCompany: Company | null;
  demoRoles: UserRole[];
  billingHasAdminAccess: boolean;
  isProxySession: boolean;
  proxiedUser: User | null;
  originalUser: User | null;
  companies: Company[];
  users: User[];
  subscriptions: Subscription[];
  licenses: License[];
  invoices: Invoice[];
  quotes: Quote[];
  quoteRequests: QuoteRequest[];
  supportTickets: SupportTicket[];
  wizardData: {
    companyName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    selectedSubscriptionPlan: string;
    selectedProducts: { productName: string; licenseCount: number; pricePerLicense: number }[];
    termsAccepted: boolean;
  };
}

interface AppContextType extends AppState {
  login: (email: string, password: string) => boolean;
  logout: () => void;
  selectCompany: (companyId: string) => void;
  setDemoRoles: (roles: UserRole[]) => void;
  setBillingHasAdminAccess: (value: boolean) => void;
  startProxySession: (userId: string) => void;
  endProxySession: () => void;
  addUser: (user: Omit<User, 'id' | 'createdAt' | 'companyId'>) => User;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deactivateUser: (userId: string) => void;
  reactivateUser: (userId: string) => void;
  changeUserRoles: (userId: string, roles: UserRole[]) => boolean;
  updateProductLicenseCount: (subscriptionId: string, productId: string, newCount: number) => void;
  assignLicense: (userId: string, subscriptionId: string, productId: string) => boolean;
  unassignLicense: (userId: string, subscriptionId: string, productId: string) => void;
  bulkUnassignLicenses: (userIds: string[], subscriptionId: string, productId: string) => void;
  getAssignedLicenseCount: (subscriptionId: string, productId: string) => number;
  getUserAssignedProducts: (userId: string) => { subscriptionId: string; subscriptionName: string; productId: string; productName: string }[];
  addSubscription: (subscription: Subscription) => void;
  addProductToSubscription: (subscriptionId: string, product: SubscriptionProduct) => void;
  updateWizardData: (data: Partial<AppState['wizardData']>) => void;
  completeSignup: () => void;
  createTicket: (ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'status' | 'companyId' | 'userId'>) => SupportTicket;
  getEffectiveRoles: () => UserRole[];
  hasAccess: (requiredRoles: UserRole[]) => boolean;
  getUserCompanies: (userId: string) => Company[];
  getCompanyUsers: () => User[];
  getCompanySubscriptions: () => Subscription[];
  getCompanyInvoices: () => Invoice[];
  getCompanyTickets: () => SupportTicket[];
  getCompanyQuotes: () => Quote[];
  getCompanyQuoteRequests: () => QuoteRequest[];
  createQuote: (input: { lineItems: QuoteLineItem[]; note: string }) => Quote;
  acceptQuote: (quoteId: string, input: { poNumber?: string; paymentMethod: 'pay_on_receipt' | 'pay_on_terms' }) => { quote: Quote; invoice: Invoice } | null;
  declineQuote: (quoteId: string, reason?: string) => void;
  addQuoteRequest: (input: { products: { productName: string; desiredLicenseCount: number }[]; note: string }) => QuoteRequest;
}

// Product catalog for reference
export const PRODUCT_CATALOG = [
  { name: 'NumberCruncher', defaultPrice: 349, description: 'Accounting application — Desktop & Web access included', type: 'hybrid' as const, latestVersion: '4.2', hasInstaller: true },
  { name: 'QuickView Desktop', defaultPrice: 199, description: 'Fast reporting and analytics desktop app', type: 'desktop' as const, latestVersion: '2.1', hasInstaller: true },
  { name: 'DataNet', defaultPrice: 0, description: 'Industry data network and alerts', type: 'service' as const, latestVersion: '', hasInstaller: false },
  { name: 'Rate Module', defaultPrice: 99, description: 'Tax rate lookup module', type: 'addon' as const, latestVersion: '1.5', hasInstaller: false },
  { name: 'Audit Module', defaultPrice: 199, description: 'Audit trail and compliance module', type: 'addon' as const, latestVersion: '1.2', hasInstaller: false },
];

// Initial mock data
const initialCompanies: Company[] = [
  { id: 'company-1', name: 'ABC Accounting', createdAt: '2023-01-15' },
  { id: 'company-2', name: 'XYZ Consulting', createdAt: '2023-06-20' },
];

const initialUsers: User[] = [
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
  { id: 'user-20', firstName: 'Michael', lastName: 'Chen', email: 'michael.chen@xyzconsulting.com', roles: ['owner'], status: 'active', lastLogin: '2024-01-20', createdAt: '2023-06-20', companyId: 'company-2', jobTitle: 'Managing Partner' },
  { id: 'user-21', firstName: 'Jessica', lastName: 'Wong', email: 'jessica.wong@xyzconsulting.com', roles: ['billing'], status: 'active', lastLogin: '2024-01-18', createdAt: '2023-07-01', companyId: 'company-2', jobTitle: 'Finance Director' },
  { id: 'user-22', firstName: 'Daniel', lastName: 'Kim', email: 'daniel.kim@xyzconsulting.com', roles: ['admin'], status: 'active', lastLogin: '2024-01-17', createdAt: '2023-07-15', companyId: 'company-2', jobTitle: 'IT Director' },
  { id: 'user-23', firstName: 'Rachel', lastName: 'Park', email: 'rachel.park@xyzconsulting.com', roles: ['standard'], status: 'active', lastLogin: '2024-01-16', createdAt: '2023-08-01', companyId: 'company-2', jobTitle: 'Consultant' },
  { id: 'user-24', firstName: 'Steven', lastName: 'Liu', email: 'steven.liu@xyzconsulting.com', roles: ['standard'], status: 'active', lastLogin: '2024-01-15', createdAt: '2023-08-20', companyId: 'company-2', jobTitle: 'Senior Consultant' },
  { id: 'user-25', firstName: 'Laura', lastName: 'Huang', email: 'laura.huang@xyzconsulting.com', roles: ['standard'], status: 'invited', lastLogin: null, createdAt: '2024-01-15', companyId: 'company-2', jobTitle: 'Associate' },
];

const initialSubscriptions: Subscription[] = [
  {
    id: 'sub-1',
    companyId: 'company-1',
    name: 'Annual Plan',
    planType: 'Annual',
    billingFrequency: 'annual',
    status: 'overdue', // Demo scenario: overdue renewal
    startDate: '2026-01-01',
    renewalDate: '2026-12-31',
    baseFee: 1000,
    perSeatCost: 10,
    products: [
      { id: 'prod-web', name: 'NumberCruncher Web', licenseCount: 20, purchasedLicenseCount: 20, pricePerLicense: 10, status: 'active' },
      { id: 'prod-desktop', name: 'NumberCruncher Desktop', licenseCount: 12, purchasedLicenseCount: 10, pricePerLicense: 10, status: 'active' },
    ],
  },
  {
    id: 'sub-3',
    companyId: 'company-2',
    name: 'Annual Plan',
    planType: 'Annual',
    billingFrequency: 'annual',
    status: 'active',
    startDate: '2026-01-01',
    renewalDate: '2026-12-31',
    baseFee: 1000,
    perSeatCost: 10,
    products: [
      { id: 'prod-web-2', name: 'NumberCruncher Web', licenseCount: 8, purchasedLicenseCount: 8, pricePerLicense: 10, status: 'active' },
      { id: 'prod-desktop-2', name: 'NumberCruncher Desktop', licenseCount: 8, purchasedLicenseCount: 8, pricePerLicense: 10, status: 'active' },
    ],
  },
];

const initialLicenses: License[] = [
  // ABC - NumberCruncher Web (prod-web): 14 assigned of 20
  ...['user-1','user-2','user-3','user-4','user-5','user-6','user-8','user-10','user-11','user-12','user-13','user-7','user-9','user-20']
    .filter((_,i) => i < 14)
    .map(uid => ({ userId: uid, subscriptionId: 'sub-1', productId: 'prod-web', assignedAt: '2026-01-15' })),
  // ABC - NumberCruncher Desktop (prod-desktop): 8 assigned of 12
  ...['user-1','user-2','user-3','user-4','user-5','user-6','user-8','user-10']
    .map(uid => ({ userId: uid, subscriptionId: 'sub-1', productId: 'prod-desktop', assignedAt: '2026-01-15' })),
  // XYZ - 4 assigned of 8
  ...['user-20','user-21','user-22','user-23']
    .map(uid => ({ userId: uid, subscriptionId: 'sub-3', productId: 'prod-web-2', assignedAt: '2026-01-15' })),
  ...['user-20','user-22','user-23']
    .map(uid => ({ userId: uid, subscriptionId: 'sub-3', productId: 'prod-desktop-2', assignedAt: '2026-01-15' })),
];

const initialInvoices: Invoice[] = [
  // INV-1001 Initial Invoice — Paid
  {
    id: 'inv-1001',
    companyId: 'company-1',
    invoiceNumber: 'INV-1001',
    date: '2026-01-01',
    dueDate: '2026-01-31',
    status: 'paid',
    amount: 1200,
    balance: 0,
    subscriptionId: 'sub-1',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Initial Invoice',
    lineItems: [
      { product: 'Base Subscription Fee', quantity: 1, unitPrice: 1000, total: 1000 },
      { product: 'NC Web + NC Desktop Seats', quantity: 20, unitPrice: 10, total: 200 },
    ],
  },
  // INV-1002 Renewal Invoice — Overdue
  {
    id: 'inv-1002',
    companyId: 'company-1',
    invoiceNumber: 'INV-1002',
    date: '2026-12-01',
    dueDate: '2026-12-31',
    status: 'overdue',
    amount: 1200,
    balance: 1200,
    subscriptionId: 'sub-1',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Renewal Invoice',
    lineItems: [
      { product: 'Base Subscription Fee', quantity: 1, unitPrice: 1000, total: 1000 },
      { product: 'NC Web + NC Desktop Seats', quantity: 20, unitPrice: 10, total: 200 },
    ],
  },
  // INV-1003 Adjustment Invoice — Unpaid
  {
    id: 'inv-1003',
    companyId: 'company-1',
    invoiceNumber: 'INV-1003',
    date: '2026-06-01',
    dueDate: '2026-06-30',
    status: 'unpaid',
    amount: 50,
    balance: 50,
    subscriptionId: 'sub-1',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Adjustment Invoice',
    lineItems: [
      { product: 'Additional NC Web Seats', quantity: 5, unitPrice: 10, total: 50 },
    ],
  },
  // XYZ Initial Invoice
  {
    id: 'inv-2001',
    companyId: 'company-2',
    invoiceNumber: 'INV-2001',
    date: '2026-01-01',
    dueDate: '2026-01-31',
    status: 'paid',
    amount: 1080,
    balance: 0,
    subscriptionId: 'sub-3',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Initial Invoice',
    lineItems: [
      { product: 'Base Subscription Fee', quantity: 1, unitPrice: 1000, total: 1000 },
      { product: 'NC Web + NC Desktop Seats', quantity: 8, unitPrice: 10, total: 80 },
    ],
  },
];

const initialTickets: SupportTicket[] = [
  { id: 'ticket-1', companyId: 'company-1', userId: 'user-5', category: 'Technical', subject: 'Installation issue on Windows 11', description: 'Cannot complete installation', status: 'resolved', createdAt: '2024-01-15' },
  { id: 'ticket-2', companyId: 'company-1', userId: 'user-6', category: 'Billing', subject: 'Invoice clarification', description: 'Need breakdown of charges', status: 'closed', createdAt: '2024-01-10' },
  { id: 'ticket-3', companyId: 'company-1', userId: 'user-1', category: 'Account', subject: 'Adding more users to account', description: 'Need to add 5 more users', status: 'open', createdAt: '2024-01-18' },
  { id: 'ticket-4', companyId: 'company-1', userId: 'user-3', category: 'Technical', subject: 'License activation failed', description: 'Getting error code 500 on activation', status: 'in-progress', createdAt: '2024-01-19' },
  { id: 'ticket-5', companyId: 'company-2', userId: 'user-20', category: 'Technical', subject: 'Report export not working', description: 'PDF export fails for large reports', status: 'open', createdAt: '2024-01-20' },
  { id: 'ticket-6', companyId: 'company-2', userId: 'user-23', category: 'Feature Request', subject: 'Dark mode support', description: 'Would like dark mode option', status: 'closed', createdAt: '2024-01-08' },
];

const todayISO = () => new Date().toISOString().split('T')[0];
const addDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

const initialQuotes: Quote[] = [
  {
    id: 'quote-1', companyId: 'company-1', quoteNumber: 'Q-1001',
    createdDate: todayISO(), expiryDate: addDays(30), status: 'active', amount: 500,
    note: 'Need quote for additional reporting users.',
    lineItems: [{ productName: 'QuickView Desktop', licenseCount: 5, unitPrice: 100, total: 500 }],
  },
  {
    id: 'quote-2', companyId: 'company-1', quoteNumber: 'Q-1002',
    createdDate: addDays(-10), expiryDate: addDays(20), status: 'declined', amount: 87,
    note: 'Customer wanted to review pricing.',
    lineItems: [{ productName: 'DataNet', licenseCount: 3, unitPrice: 29, total: 87 }],
    declineReason: 'Pricing review pending.',
  },
  {
    id: 'quote-3', companyId: 'company-1', quoteNumber: 'Q-1003',
    createdDate: addDays(-40), expiryDate: addDays(-10), status: 'expired', amount: 100,
    note: 'Old quote request.',
    lineItems: [{ productName: 'NumberCruncher Web', licenseCount: 10, unitPrice: 10, total: 100 }],
  },
];

const initialQuoteRequests: QuoteRequest[] = [];


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
    quotes: initialQuotes,
    quoteRequests: initialQuoteRequests,
    supportTickets: initialTickets,
    wizardData: {
      companyName: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      selectedSubscriptionPlan: '',
      selectedProducts: [],
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
    if (user.roles.includes('owner') && !roles.includes('owner')) {
      const otherOwners = state.users.filter(u =>
        u.id !== userId &&
        u.companyId === user.companyId &&
        u.roles.includes('owner') &&
        u.status !== 'inactive'
      );
      if (otherOwners.length === 0) return false;
    }
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, roles } : u),
    }));
    return true;
  }, [state.users]);

  const updateProductLicenseCount = useCallback((subscriptionId: string, productId: string, newCount: number) => {
    setState(prev => ({
      ...prev,
      subscriptions: prev.subscriptions.map(s =>
        s.id === subscriptionId
          ? {
            ...s,
            products: s.products.map(p =>
              p.id === productId ? { ...p, licenseCount: newCount } : p
            ),
          }
          : s
      ),
    }));
  }, []);

  const assignLicense = useCallback((userId: string, subscriptionId: string, productId: string): boolean => {
    const subscription = state.subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) return false;
    const product = subscription.products.find(p => p.id === productId);
    if (!product) return false;

    const assignedCount = state.licenses.filter(l =>
      l.subscriptionId === subscriptionId && l.productId === productId
    ).length;

    if (assignedCount >= product.licenseCount) return false;

    setState(prev => ({
      ...prev,
      licenses: [...prev.licenses, { userId, subscriptionId, productId, assignedAt: new Date().toISOString().split('T')[0] }],
    }));
    return true;
  }, [state.subscriptions, state.licenses]);

  const unassignLicense = useCallback((userId: string, subscriptionId: string, productId: string) => {
    setState(prev => ({
      ...prev,
      licenses: prev.licenses.filter(l => !(l.userId === userId && l.subscriptionId === subscriptionId && l.productId === productId)),
    }));
  }, []);

  const bulkUnassignLicenses = useCallback((userIds: string[], subscriptionId: string, productId: string) => {
    setState(prev => ({
      ...prev,
      licenses: prev.licenses.filter(l => !(userIds.includes(l.userId) && l.subscriptionId === subscriptionId && l.productId === productId)),
    }));
  }, []);

  const getAssignedLicenseCount = useCallback((subscriptionId: string, productId: string): number => {
    return state.licenses.filter(l =>
      l.subscriptionId === subscriptionId && l.productId === productId
    ).length;
  }, [state.licenses]);

  const getUserAssignedProducts = useCallback((userId: string): { subscriptionId: string; subscriptionName: string; productId: string; productName: string }[] => {
    const userLicenses = state.licenses.filter(l => l.userId === userId);
    return userLicenses.map(l => {
      const sub = state.subscriptions.find(s => s.id === l.subscriptionId);
      const prod = sub?.products.find(p => p.id === l.productId);
      return {
        subscriptionId: l.subscriptionId,
        subscriptionName: sub?.name || '',
        productId: l.productId,
        productName: prod?.name || '',
      };
    });
  }, [state.licenses, state.subscriptions]);

  const addSubscription = useCallback((subscription: Subscription) => {
    setState(prev => ({
      ...prev,
      subscriptions: [...prev.subscriptions, subscription],
    }));
  }, []);

  const addProductToSubscription = useCallback((subscriptionId: string, product: SubscriptionProduct) => {
    setState(prev => ({
      ...prev,
      subscriptions: prev.subscriptions.map(s =>
        s.id === subscriptionId
          ? { ...s, products: [...s.products, product] }
          : s
      ),
    }));
  }, []);

  const updateWizardData = useCallback((data: Partial<AppState['wizardData']>) => {
    setState(prev => ({
      ...prev,
      wizardData: { ...prev.wizardData, ...data },
    }));
  }, []);

  const completeSignup = useCallback(() => {
    const { companyName, firstName, lastName, email, selectedSubscriptionPlan, selectedProducts } = state.wizardData;

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

    const subId = `sub-${Date.now()}`;
    const products: SubscriptionProduct[] = selectedProducts.map((p, i) => ({
      id: `prod-${Date.now()}-${i}`,
      name: p.productName,
      licenseCount: p.licenseCount,
      pricePerLicense: p.pricePerLicense,
      status: 'active' as const,
    }));

    const newSubscription: Subscription = {
      id: subId,
      companyId: newCompanyId,
      name: selectedSubscriptionPlan || 'New Plan',
      planType: 'Annual',
      billingFrequency: 'annual',
      status: 'active',
      startDate: new Date().toISOString().split('T')[0],
      renewalDate: '2026-12-31',
      products,
    };

    // Assign license for first product to owner
    const newLicenses: License[] = products.length > 0
      ? [{ userId: newUserId, subscriptionId: subId, productId: products[0].id, assignedAt: new Date().toISOString().split('T')[0] }]
      : [];

    const lineItems: InvoiceLineItem[] = products.map(p => ({
      product: p.name,
      quantity: p.licenseCount,
      unitPrice: p.pricePerLicense,
      total: p.licenseCount * p.pricePerLicense,
    }));

    const totalAmount = lineItems.reduce((a, li) => a + li.total, 0);

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      companyId: newCompanyId,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'paid',
      amount: totalAmount,
      balance: 0,
      subscriptionId: subId,
      subscriptionName: newSubscription.name,
      lineItems,
    };

    setState(prev => ({
      ...prev,
      companies: [...prev.companies, newCompany],
      users: [...prev.users, newUser],
      subscriptions: [...prev.subscriptions, newSubscription],
      licenses: [...prev.licenses, ...newLicenses],
      invoices: [...prev.invoices, newInvoice],
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

  // Auto-expire active quotes whose expiryDate is in the past
  const getCompanyQuotes = useCallback((): Quote[] => {
    const today = new Date();
    return state.quotes
      .filter(q => q.companyId === state.currentCompany?.id)
      .map(q => (q.status === 'active' && new Date(q.expiryDate) < today ? { ...q, status: 'expired' as const } : q));
  }, [state.quotes, state.currentCompany]);

  const getCompanyQuoteRequests = useCallback((): QuoteRequest[] => {
    return state.quoteRequests.filter(r => r.companyId === state.currentCompany?.id);
  }, [state.quoteRequests, state.currentCompany]);

  const createQuote = useCallback((input: { lineItems: QuoteLineItem[]; note: string }): Quote => {
    const created = new Date();
    const expires = new Date(created.getTime() + 30 * 86400000);
    const amount = input.lineItems.reduce((a, li) => a + li.total, 0);
    const newQuote: Quote = {
      id: `quote-${Date.now()}`,
      companyId: state.currentCompany?.id || 'company-1',
      quoteNumber: `Q-${String(1000 + Math.floor(Math.random() * 9000))}`,
      createdDate: created.toISOString().split('T')[0],
      expiryDate: expires.toISOString().split('T')[0],
      status: 'active',
      amount,
      note: input.note || '',
      lineItems: input.lineItems,
    };
    setState(prev => ({ ...prev, quotes: [newQuote, ...prev.quotes] }));
    return newQuote;
  }, [state.currentCompany]);

  const acceptQuote = useCallback((quoteId: string, input: { poNumber?: string; paymentMethod: 'pay_on_receipt' | 'pay_on_terms' }) => {
    const quote = state.quotes.find(q => q.id === quoteId);
    if (!quote) return null;
    if (new Date(quote.expiryDate) < new Date()) return null;

    const today = new Date();
    const due = new Date(today.getTime() + 30 * 86400000);
    const sub = state.subscriptions.find(s => s.companyId === quote.companyId);
    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      companyId: quote.companyId,
      invoiceNumber: `INV-${String(2000 + Math.floor(Math.random() * 9000))}`,
      date: today.toISOString().split('T')[0],
      dueDate: due.toISOString().split('T')[0],
      status: input.paymentMethod === 'pay_on_receipt' ? 'awaiting_payment' : 'payment_terms_applied',
      amount: quote.amount,
      balance: quote.amount,
      subscriptionId: sub?.id || '',
      subscriptionName: sub?.name || 'Annual Plan',
      invoiceType: 'Adjustment Invoice',
      poNumber: input.poNumber,
      paymentMethod: input.paymentMethod,
      lineItems: quote.lineItems.map(l => ({
        product: l.productName,
        quantity: l.licenseCount,
        unitPrice: l.unitPrice,
        total: l.total,
      })),
    };
    const updatedQuote: Quote = { ...quote, status: 'accepted', poNumber: input.poNumber, paymentMethod: input.paymentMethod, invoiceId: invoice.id };
    setState(prev => ({
      ...prev,
      quotes: prev.quotes.map(q => q.id === quoteId ? updatedQuote : q),
      invoices: [invoice, ...prev.invoices],
    }));
    return { quote: updatedQuote, invoice };
  }, [state.quotes, state.subscriptions]);

  const declineQuote = useCallback((quoteId: string, reason?: string) => {
    setState(prev => ({
      ...prev,
      quotes: prev.quotes.map(q => q.id === quoteId ? { ...q, status: 'declined', declineReason: reason } : q),
    }));
  }, []);

  const addQuoteRequest = useCallback((input: { products: { productName: string; desiredLicenseCount: number }[]; note: string }): QuoteRequest => {
    const req: QuoteRequest = {
      id: `qreq-${Date.now()}`,
      companyId: state.currentCompany?.id || 'company-1',
      createdDate: new Date().toISOString().split('T')[0],
      status: 'submitted',
      products: input.products,
      note: input.note,
    };
    setState(prev => ({ ...prev, quoteRequests: [req, ...prev.quoteRequests] }));
    return req;
  }, [state.currentCompany]);

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
      updateProductLicenseCount,
      assignLicense,
      unassignLicense,
      bulkUnassignLicenses,
      getAssignedLicenseCount,
      getUserAssignedProducts,
      addSubscription,
      addProductToSubscription,
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
      getCompanyQuotes,
      getCompanyQuoteRequests,
      createQuote,
      acceptQuote,
      declineQuote,
      addQuoteRequest,
    }}>
      {children}
    </AppContext.Provider>
  );
};
