import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { formatCurrency } from '@/lib/format';
import { calculateProratedAdd } from '@/lib/proration';

// Types
export type Role = 'account_owner' | 'billing_admin' | 'license_admin' | 'registered_contact';
// Backward-compat alias — existing imports of UserRole continue to compile.
export type UserRole = Role;

export const ROLE_LABELS: Record<Role, string> = {
  account_owner: 'Account Owner',
  billing_admin: 'Billing Admin',
  license_admin: 'License Admin',
  registered_contact: 'Registered Contact',
};

export const ROLE_BADGE_CLASS: Record<Role, string> = {
  account_owner: 'badge-owner',
  billing_admin: 'badge-billing',
  license_admin: 'badge-admin',
  registered_contact: 'badge-standard',
};

export type Permission =
  | 'users.add'
  | 'users.edit'
  | 'users.assign_roles'
  | 'users.deactivate'
  | 'users.impersonate'
  | 'subscriptions.purchase'
  | 'subscriptions.modify_seats'
  | 'subscriptions.cancel'
  | 'licenses.assign'
  | 'billing.view'
  | 'billing.pay'
  | 'billing.manage_methods'
  | 'support.view_all_tickets'
  // Manage Licenses drawer action gates (per discovery Q12)
  | 'manage_seats_count'
  | 'manage_user_assignment'
  | 'manage_seat_renewal_status'
  | 'reactivate_license'
  // Billing details editing (v15 — subscription detail page)
  | 'edit_billing_details'
  // Owner-only capabilities (per discovery Q13)
  | 'owner_only_actions';

export type LicenseType = 'paid' | 'it_assistant' | 'trial';

export const LICENSE_TYPE_BADGE: Record<LicenseType, { label: string; className: string }> = {
  paid: { label: 'User License', className: 'bg-success/10 text-success border-success/20' },
  it_assistant: { label: 'IT Assistant', className: 'bg-info/10 text-info border-info/20' },
  trial: { label: 'Trial', className: 'bg-warning/10 text-warning border-warning/20' },
};

export type NotificationType =
  // Billing & Payment
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.approaching_due'
  | 'invoice.overdue'
  // Subscription
  | 'subscription.renewal_upcoming'
  | 'subscription.renewed'
  | 'subscription.suspended'
  | 'subscription.reactivated'
  // Quote
  | 'quote.received'
  | 'quote.expiring_soon'
  | 'quote.accepted'
  | 'quote.declined'
  // License & User
  | 'license.assigned_to_me'
  | 'license.unassigned_from_me'
  | 'license.trial_expiring'
  | 'user.invited'
  | 'user.accepted_invitation'
  // Product
  | 'product.new_version'
  | 'datanet.monthly_update'
  | 'maintenance.scheduled'
  // Account
  | 'account.role_changed'
  | 'account.password_changed'
  | 'account.new_login'
  // Admin team — internal notifications (per discovery Q4)
  | 'admin.po_entered_on_invoice';

export type NotificationCategoryKey =
  | 'billing'
  | 'subscription'
  | 'quote'
  | 'license_user'
  | 'product'
  | 'account';

export interface NotificationChannelPrefs {
  email: boolean;
  inApp: boolean;
}

export interface NotificationCatalogEntry {
  type: NotificationType;
  category: NotificationCategoryKey;
  label: string;
  description: string;
  /** Empty array means all roles. */
  rolesAllowed: Role[];
}

export const NOTIFICATION_CATALOG: NotificationCatalogEntry[] = [
  // Billing & Payment
  { type: 'invoice.created', category: 'billing', label: 'Invoice created', description: 'A new invoice is ready for your review.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'invoice.paid', category: 'billing', label: 'Payment received', description: 'Confirmation when a payment is processed successfully.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'invoice.payment_failed', category: 'billing', label: 'Payment failed', description: 'Your payment did not go through.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'invoice.approaching_due', category: 'billing', label: 'Invoice approaching due date', description: 'Reminder three days before an invoice is due.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'invoice.overdue', category: 'billing', label: 'Invoice overdue', description: 'Notification when an invoice passes its due date.', rolesAllowed: ['account_owner', 'billing_admin'] },
  // Subscription
  { type: 'subscription.renewal_upcoming', category: 'subscription', label: 'Subscription renewal coming', description: 'Heads-up 30 days before your subscription renews.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'subscription.renewed', category: 'subscription', label: 'Subscription renewed', description: 'Confirmation when a renewal has been processed.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'subscription.suspended', category: 'subscription', label: 'Subscription suspended', description: 'When your subscription has been suspended due to unpaid renewal.', rolesAllowed: ['account_owner', 'billing_admin', 'license_admin'] },
  { type: 'subscription.reactivated', category: 'subscription', label: 'Subscription reactivated', description: 'When access is restored after payment.', rolesAllowed: ['account_owner', 'billing_admin', 'license_admin'] },
  // Quote
  { type: 'quote.received', category: 'quote', label: 'New quote received', description: 'When your sales contact issues a new quote.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'quote.expiring_soon', category: 'quote', label: 'Quote expiring soon', description: 'Reminder three days before a quote expires.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'quote.accepted', category: 'quote', label: 'Quote accepted', description: 'Confirmation when you accept a quote.', rolesAllowed: ['account_owner', 'billing_admin'] },
  { type: 'quote.declined', category: 'quote', label: 'Quote declined', description: 'Confirmation when you decline a quote.', rolesAllowed: ['account_owner', 'billing_admin'] },
  // License & User
  { type: 'license.assigned_to_me', category: 'license_user', label: 'License assigned to me', description: 'When an administrator assigns you a product license.', rolesAllowed: [] },
  { type: 'license.unassigned_from_me', category: 'license_user', label: 'License unassigned from me', description: 'When a license is removed from your account.', rolesAllowed: [] },
  { type: 'license.trial_expiring', category: 'license_user', label: 'Trial license expiring', description: 'Seven days before your trial license expires.', rolesAllowed: [] },
  { type: 'user.invited', category: 'license_user', label: 'New user invited', description: 'When a new user is invited to your organization.', rolesAllowed: ['account_owner', 'license_admin'] },
  { type: 'user.accepted_invitation', category: 'license_user', label: 'User accepted invitation', description: 'When an invited user logs in for the first time.', rolesAllowed: ['account_owner', 'license_admin'] },
  // Product
  { type: 'product.new_version', category: 'product', label: 'New product version available', description: 'When a new version of a product you use is released.', rolesAllowed: [] },
  { type: 'datanet.monthly_update', category: 'product', label: 'DataNet monthly update', description: 'When the latest DataNet bulletin is published.', rolesAllowed: [] },
  { type: 'maintenance.scheduled', category: 'product', label: 'Maintenance window scheduled', description: 'When scheduled portal or product maintenance is announced.', rolesAllowed: [] },
  // Account
  { type: 'account.role_changed', category: 'account', label: 'Role changed', description: 'When your role on this account is changed.', rolesAllowed: [] },
  { type: 'account.password_changed', category: 'account', label: 'Password changed', description: 'When your password is changed.', rolesAllowed: [] },
  { type: 'account.new_login', category: 'account', label: 'New login from unrecognized device', description: 'Security notification when your account is accessed from a new device.', rolesAllowed: [] },
  // Admin team (internal). rolesAllowed gates customer-side preference UI; this type
  // is emitted directly to AO of the customer's company + any seeded Leimberg admin.
  { type: 'admin.po_entered_on_invoice', category: 'account', label: 'PO entered on mid-cycle invoice', description: 'A customer entered a PO when paying a mid-cycle license-change invoice.', rolesAllowed: ['account_owner'] },
];

export const NOTIFICATION_CATEGORIES: Array<{ key: NotificationCategoryKey; label: string }> = [
  { key: 'billing', label: 'Billing & Payment' },
  { key: 'subscription', label: 'Subscription' },
  { key: 'quote', label: 'Quotes' },
  { key: 'license_user', label: 'Licenses & Users' },
  { key: 'product', label: 'Products & Services' },
  { key: 'account', label: 'Account & Security' },
];

export const getDefaultNotificationPrefs = (): Record<NotificationType, NotificationChannelPrefs> => {
  const prefs = {} as Record<NotificationType, NotificationChannelPrefs>;
  NOTIFICATION_CATALOG.forEach(entry => {
    prefs[entry.type] = { email: true, inApp: true };
  });
  return prefs;
};

export interface Notification {
  id: string;
  /** Recipient — only this user sees it in the bell feed. */
  userId: string;
  companyId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  linkLabel?: string;
  createdAt: string;
  readAt: string | null;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  roles: Role[];
  status: 'active' | 'invited' | 'inactive';
  lastLogin: string | null;
  createdAt: string;
  companyId: string;
  phone?: string;
  jobTitle?: string;
  /** Default true. Controls receipt of DataNet monthly email digests. */
  dataNetEmailOptIn?: boolean;
  /** Per-user notification channel preferences. Optional — default to all-on. */
  notificationPrefs?: Record<NotificationType, NotificationChannelPrefs>;
}

export interface CompanyAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Company {
  id: string;
  name: string;
  createdAt: string;
  /** Whether the company's active subscriptions auto-renew. Defaults to true. */
  autoRenewal?: boolean;
  /** Billing address (v15 — editable from the subscription detail page). */
  address?: CompanyAddress;
  /** User IDs that serve as billing contacts for this company. */
  billingContactUserIds?: string[];
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
  /** Scheduled seat reduction: new (lower) seat count that activates on the renewal date */
  scheduledLicenseCount?: number;
  /** Effective date for the scheduled seat reduction (typically the subscription renewalDate) */
  scheduledEffectiveDate?: string;
  /** Users marked "Expire end of year" — their licenses drop when the scheduled change activates */
  scheduledUnassignedUserIds?: string[];
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
  /** Defaults to 'paid' ("User License") when omitted. Set by backend/admin. */
  licenseType?: LicenseType;
  /** Only for licenseType === 'trial'. */
  trialExpiresAt?: string;
  /** ISO date the license was deactivated (released, not just unassigned). */
  deactivatedAt?: string;
  /** Optional human-readable reason for deactivation. */
  deactivatedReason?: string;
}

/** Catalog product config — list price, maintenance split (admin-configurable). */
export interface CatalogProduct {
  name: string;
  /** Annual list price per seat (total = license + maintenance). */
  pricePerSeatPerYear: number;
  /** Annual maintenance portion per seat. Default seed = 30% of total. */
  maintenancePerSeatPerYear: number;
}

export interface InvoiceLineItem {
  product: string;
  quantity: number;
  unitPrice: number;
  proration?: number;
  total: number;
}

export type InvoiceType = 'Initial Invoice' | 'Renewal Invoice' | 'Adjustment Invoice';

export type InvoiceSource =
  | 'checkout'
  | 'quote_acceptance'
  | 'license_change'
  | 'renewal'
  | 'license_reactivation';

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue' | 'unpaid' | 'awaiting_payment' | 'payment_terms_applied' | 'upcoming';
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
  /** Pending quote line-item application to be applied when invoice is paid. */
  pendingQuoteApplication?: { quoteId: string; subscriptionId: string };
  /** Activates subscription from pending_payment when invoice is paid */
  activatesSubscription?: boolean;
  /** Optional human-friendly description for tabular display */
  description?: string;
  /** Optional pre-tax amount */
  subtotal?: number;
  /** Optional tax amount */
  tax?: number;
  /** Optional canonical total (mirrors amount when present) */
  totalAmount?: number;
  /** ISO timestamp the invoice was marked paid, if any */
  paidAt?: string | null;
}

export interface QuoteLineItem {
  productName: string;
  licenseCount: number;
  unitPrice: number;
  total: number;
}

export type QuoteRequestReason =
  | 'Adding seats to a current product'
  | 'Adding a new product'
  | 'Other';

export interface Quote {
  id: string;
  companyId: string;
  quoteNumber: string;
  createdDate: string;
  expiryDate: string;
  status: 'requested' | 'active' | 'accepted' | 'declined' | 'expired';
  amount: number;
  note: string;
  lineItems: QuoteLineItem[];
  poNumber?: string;
  paymentMethod?: PaymentMethod;
  declineReason?: string;
  invoiceId?: string;
  recipients?: string[];
  /** Optional reason captured when the customer submits a quote request. */
  requestReason?: QuoteRequestReason;
  /** ISO timestamp when sales formally responded (requested -> active). */
  formallyQuotedAt?: string;
  /** ISO timestamp when the customer accepted the quote. */
  acceptedAt?: string;
}

export interface QuoteRequest {
  id: string;
  companyId: string;
  createdDate: string;
  status: 'submitted' | 'in_review' | 'closed';
  products: { productName: string; desiredLicenseCount: number }[];
  note: string;
}

export interface SavedPaymentMethod {
  id: string;
  userId: string;
  companyId: string;
  type: 'card' | 'ach';
  // Card fields
  cardBrand?: 'Visa' | 'Mastercard' | 'Amex' | 'Discover';
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  // ACH fields
  bankName?: string;
  accountLast4?: string;
  routingLast4?: string;
  // Common
  holderName: string;
  isPrimary: boolean;
  createdAt: string;
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

export interface DataNetUpdate {
  id: string;
  year: number;
  month: number;
  monthName: string;
  title: string;
  summary: string;
  body: string;
  publishedAt: string;
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
  companyConfigs: CompanyBillingConfig[];
  savedPaymentMethods: SavedPaymentMethod[];
  dataNetUpdates: DataNetUpdate[];
  notifications: Notification[];
  /** Editable product catalog — admin tool maintains the maintenance split per product. */
  catalogProducts: CatalogProduct[];
  /** Pricing Calculation Mode toggle (per discovery Q1 fallback). */
  useLegacyProration: boolean;
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
  updateCompany: (companyId: string, updates: Partial<Company>) => void;
  updateCompanyBillingDetails: (input: {
    companyId: string;
    name: string;
    address?: CompanyAddress;
    contactUserIds: string[];
  }) => void;
  setAutoRenewal: (companyId: string, value: boolean) => void;
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
  renameSubscription: (subscriptionId: string, newName: string) => void;
  updateWizardData: (data: Partial<AppState['wizardData']>) => void;
  completeSignup: () => void;
  createAccount: (input: { companyName: string; firstName: string; lastName: string; email: string; password: string }) => { user: User; company: Company };
  createTicket: (ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'status' | 'companyId' | 'userId'>) => SupportTicket;
  getEffectiveRoles: () => Role[];
  hasAccess: (requiredRoles: Role[]) => boolean;
  can: (perm: Permission) => boolean;
  isReadOnlyMode: () => boolean;
  isSuspendedMode: () => boolean;
  forceSuspendCurrentSubscription: () => boolean;
  restoreActiveSubscription: () => boolean;
  getCurrentUserTrialLicenses: () => { licenseId: string; productName: string; expiresAt: string }[];
  isUsernameTaken: (username: string, companyId: string, excludeUserId?: string) => boolean;
  getUserCompanies: (userId: string) => Company[];
  getCompanyUsers: () => User[];
  getCompanySubscriptions: () => Subscription[];
  getCompanyInvoices: () => Invoice[];
  getCompanyTickets: () => SupportTicket[];
  getCompanyQuotes: () => Quote[];
  getCompanyQuoteRequests: () => QuoteRequest[];
  createQuote: (input: {
    lineItems: QuoteLineItem[];
    note: string;
    recipients?: string[];
    status?: Quote['status'];
    requestReason?: QuoteRequestReason;
  }) => Quote;
  cancelQuoteRequest: (quoteId: string) => void;
  approvePendingQuoteRequests: () => number;
  hasPaidInvoice: () => boolean;
  hasSentQuote: () => boolean;
  hasDeclinedQuote: () => boolean;
  isFirstTimeCustomer: () => boolean;
  acceptQuote: (quoteId: string, input: { poNumber?: string; paymentMethod: PaymentMethod }) => { quote: Quote; invoice: Invoice; subscription?: Subscription } | null;
  declineQuote: (quoteId: string, reason?: string) => void;
  addQuoteRequest: (input: { products: { productName: string; desiredLicenseCount: number }[]; note: string }) => QuoteRequest;
  getCompanyConfig: (companyId?: string) => CompanyBillingConfig;
  updateCompanyConfig: (companyId: string, updates: Partial<CompanyBillingConfig>) => void;
  getAvailablePaymentMethods: (companyId?: string) => PaymentMethod[];
  requestLicenseChange: (subscriptionId: string, productId: string, newCount: number, paymentMethod: PaymentMethod) => { invoice?: Invoice; applied: boolean; pending: boolean };
  /**
   * Schedule a seat decrease that takes effect on the subscription's renewal date.
   * - removeNowUserIds: licenses unassigned immediately (seat stays paid through the term).
   * - expireEndOfYearUserIds: keep assignment now; drop on renewal when the schedule activates.
   * The current paid licenseCount is NOT reduced.
   */
  scheduleLicenseDecrease: (
    subscriptionId: string,
    productId: string,
    newCount: number,
    removeNowUserIds: string[],
    expireEndOfYearUserIds: string[],
  ) => void;
  /**
   * Apply a paid-license reduction (v14 Manage Licenses rework, Section C3/C4).
   * - removeNowUserIds: license deactivated immediately (becomes a "previously held"
   *   license) and the current paid count drops by one per user.
   * - expireEndOfCycleUserIds: user keeps access now; license is flagged to drop on
   *   the renewal date. Current paid count is unchanged; renewal count drops.
   * newCurrentCount / newRenewalCount are the resulting paid counts (computed by the
   * caller) so empty-seat releases (no users affected) are handled uniformly.
   */
  applyLicenseReduction: (input: {
    subscriptionId: string;
    productId: string;
    newCurrentCount: number;
    newRenewalCount: number;
    removeNowUserIds: string[];
    expireEndOfCycleUserIds: string[];
  }) => void;
  markInvoicePaid: (invoiceId: string) => void;
  /** Persist an optional PO number on an existing invoice (per discovery Q3). */
  setInvoicePoNumber: (invoiceId: string, poNumber: string | undefined) => void;
  checkoutPurchase: (input: { lineItems: QuoteLineItem[]; paymentMethod: PaymentMethod; poNumber?: string }) => Invoice;
  renewSubscription: (
    subscriptionId: string,
    newLicenseCounts?: Record<string, number>,
    totalAmount?: number,
    invoiceId?: string,
  ) => Invoice | null;
  getCompanyPaymentMethods: (companyId?: string) => SavedPaymentMethod[];
  getUserPaymentMethods: (userId?: string) => SavedPaymentMethod[];
  addPaymentMethod: (m: Omit<SavedPaymentMethod, 'id' | 'createdAt'>) => SavedPaymentMethod;
  removePaymentMethod: (id: string) => void;
  setPrimaryPaymentMethod: (id: string) => void;
  forceGenerateRenewalInvoices: () => number;
  getDataNetUpdates: () => DataNetUpdate[];
  // Notifications
  notify: (input: { userId?: string; type: NotificationType; title: string; message: string; link?: string; linkLabel?: string }) => void;
  getUserNotifications: (userId?: string) => Notification[];
  getUnreadNotificationCount: (userId?: string) => number;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: (userId?: string) => void;
  getUserNotificationPrefs: (userId?: string) => Record<NotificationType, NotificationChannelPrefs>;
  updateUserNotificationPrefs: (userId: string, type: NotificationType, channel: 'email' | 'inApp', value: boolean) => void;
  resetUserNotificationPrefs: (userId: string) => void;
  // Catalog config (admin tool — discovery Q5)
  getCatalogProduct: (name: string) => CatalogProduct | undefined;
  updateCatalogProductMaintenance: (name: string, maintenancePerSeatPerYear: number) => void;
  setUseLegacyProration: (value: boolean) => void;
  // Previously-held license reactivation (discovery Q6 + Q7)
  getDeactivatedLicenses: (companyId?: string) => Array<{
    license: License;
    subscription: Subscription;
    product: SubscriptionProduct;
  }>;
  reactivateLicense: (input: {
    subscriptionId: string;
    productId: string;
    licenseAssignedAt: string;
    paymentMethodId?: string;
  }) => { invoice: Invoice } | null;
}

// Product catalog for reference. Each entry carries the total list price AND the
// maintenance portion (per discovery Q1). Maintenance defaults are ~30% of total
// rounded to the nearest dollar; admins can override per product at runtime.
export const PRODUCT_CATALOG = [
  { name: 'NumberCruncher Desktop', defaultPrice: 349, maintenancePerSeatPerYear: 105, description: 'Desktop tax and accounting application', type: 'desktop' as const, latestVersion: '4.2', hasInstaller: true },
  { name: 'NumberCruncher Web', defaultPrice: 349, maintenancePerSeatPerYear: 105, description: 'Browser-based NumberCruncher access', type: 'web' as const, latestVersion: '4.2', hasInstaller: false },
  { name: 'QuickView Desktop', defaultPrice: 199, maintenancePerSeatPerYear: 60, description: 'Desktop reporting and analytics app', type: 'desktop' as const, latestVersion: '2.1', hasInstaller: true },
  { name: 'DataNet', defaultPrice: 29, maintenancePerSeatPerYear: 9, description: 'Industry data network and alerts', type: 'service' as const, latestVersion: '1.0', hasInstaller: false },
];

const initialCatalogProducts: CatalogProduct[] = PRODUCT_CATALOG.map(p => ({
  name: p.name,
  pricePerSeatPerYear: p.defaultPrice,
  maintenancePerSeatPerYear: p.maintenancePerSeatPerYear,
}));

// ============================================================
// Seed date helpers — keep dates realistic relative to "today"
// so the demo data doesn't go stale over time.
// ============================================================
const _DAY_MS = 1000 * 60 * 60 * 24;
const _seedToday = new Date();
const _isoDaysAgo = (n: number): string =>
  new Date(_seedToday.getTime() - n * _DAY_MS).toISOString().split('T')[0];
const _isoDaysAhead = (n: number): string =>
  new Date(_seedToday.getTime() + n * _DAY_MS).toISOString().split('T')[0];
const _isoHoursAgoFull = (n: number): string =>
  new Date(_seedToday.getTime() - n * 60 * 60 * 1000).toISOString();
const _isoDaysAgoFull = (n: number): string =>
  new Date(_seedToday.getTime() - n * _DAY_MS).toISOString();

// Initial mock data
// Apply a quote's line items to an existing subscription as a mid-cycle change:
// existing products get their seat counts increased; products not yet on the
// subscription get added. DataNet is auto-included and has no seat math, so it
// is ignored here.
function applyQuoteToSubscription(sub: Subscription, quote: Quote): Subscription {
  const updated = [...sub.products];
  quote.lineItems.forEach(line => {
    if (line.productName === 'DataNet') return;
    const idx = updated.findIndex(p => p.name === line.productName);
    if (idx >= 0) {
      const current = updated[idx];
      const purchased = current.purchasedLicenseCount ?? current.licenseCount;
      updated[idx] = {
        ...current,
        licenseCount: current.licenseCount + line.licenseCount,
        purchasedLicenseCount: purchased + line.licenseCount,
      };
    } else {
      updated.push({
        id: `prod-${sub.id}-${line.productName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name: line.productName,
        licenseCount: line.licenseCount,
        purchasedLicenseCount: line.licenseCount,
        pricePerLicense: line.unitPrice,
        status: 'active',
      });
    }
  });
  return { ...sub, products: updated };
}

function parseDisplayNameFromEmail(email: string): { firstName: string; lastName: string } {
  const localPart = email.split('@')[0] || 'demo';
  const parts = localPart.split(/[._\-\s+]/).filter(Boolean);
  const titleCase = (s: string): string => {
    if (!s) return '';
    const stripped = s.replace(/\d+$/, '');
    const word = stripped || s;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  };
  if (parts.length === 0) return { firstName: 'Demo', lastName: 'User' };
  if (parts.length === 1) return { firstName: titleCase(parts[0]), lastName: 'User' };
  return {
    firstName: titleCase(parts[0]),
    lastName: titleCase(parts.slice(1).join(' ')),
  };
}

const initialCompanies: Company[] = [
  {
    id: 'company-1', name: 'ABC Accounting', createdAt: '2023-01-15', autoRenewal: true,
    address: { line1: '500 Madison Avenue', line2: 'Suite 1200', city: 'New York', state: 'NY', postalCode: '10022', country: 'United States' },
    billingContactUserIds: ['user-2'],
  },
  {
    id: 'company-2', name: 'XYZ Consulting', createdAt: '2023-06-20', autoRenewal: true,
    address: { line1: '88 Market Street', city: 'San Francisco', state: 'CA', postalCode: '94105', country: 'United States' },
    billingContactUserIds: ['user-21'],
  },
];

const initialUsers: User[] = [
  { id: 'user-1', firstName: 'John', lastName: 'Smith', email: 'john.smith@abcaccounting.com', username: 'johnsmith', roles: ['account_owner'], status: 'active', lastLogin: '2024-01-20', createdAt: '2023-01-15', companyId: 'company-1', jobTitle: 'CEO', dataNetEmailOptIn: true },
  { id: 'user-2', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@abcaccounting.com', username: 'sarahjohnson', roles: ['billing_admin'], status: 'active', lastLogin: '2024-01-19', createdAt: '2023-02-10', companyId: 'company-1', jobTitle: 'CFO', dataNetEmailOptIn: true },
  { id: 'user-3', firstName: 'Mike', lastName: 'Williams', email: 'mike.williams@abcaccounting.com', username: 'mikewilliams', roles: ['license_admin'], status: 'active', lastLogin: '2024-01-18', createdAt: '2023-03-05', companyId: 'company-1', jobTitle: 'IT Manager', dataNetEmailOptIn: true },
  { id: 'user-4', firstName: 'Emily', lastName: 'Brown', email: 'emily.brown@abcaccounting.com', username: 'emilybrown', roles: ['billing_admin', 'license_admin'], status: 'active', lastLogin: '2024-01-17', createdAt: '2023-04-12', companyId: 'company-1', jobTitle: 'Operations Manager', dataNetEmailOptIn: true },
  { id: 'user-5', firstName: 'David', lastName: 'Davis', email: 'david.davis@abcaccounting.com', username: 'daviddavis', roles: ['registered_contact'], status: 'active', lastLogin: '2024-01-15', createdAt: '2023-05-20', companyId: 'company-1', jobTitle: 'Accountant', dataNetEmailOptIn: true },
  { id: 'user-6', firstName: 'Lisa', lastName: 'Miller', email: 'lisa.miller@abcaccounting.com', username: 'lisamiller', roles: ['registered_contact'], status: 'active', lastLogin: '2024-01-10', createdAt: '2023-06-01', companyId: 'company-1', jobTitle: 'Senior Accountant', dataNetEmailOptIn: true },
  { id: 'user-7', firstName: 'James', lastName: 'Wilson', email: 'james.wilson@abcaccounting.com', username: 'jameswilson', roles: ['registered_contact'], status: 'invited', lastLogin: null, createdAt: '2024-01-10', companyId: 'company-1', jobTitle: 'Junior Accountant', dataNetEmailOptIn: true },
  { id: 'user-8', firstName: 'Jennifer', lastName: 'Taylor', email: 'jennifer.taylor@abcaccounting.com', username: 'jennifertaylor', roles: ['registered_contact'], status: 'active', lastLogin: '2023-12-01', createdAt: '2023-07-15', companyId: 'company-1', jobTitle: 'Tax Specialist', dataNetEmailOptIn: true },
  { id: 'user-9', firstName: 'Robert', lastName: 'Anderson', email: 'robert.anderson@abcaccounting.com', username: 'robertanderson', roles: ['license_admin', 'registered_contact'], status: 'inactive', lastLogin: '2023-10-15', createdAt: '2023-08-01', companyId: 'company-1', jobTitle: 'Former Manager', dataNetEmailOptIn: false },
  { id: 'user-10', firstName: 'Amanda', lastName: 'Thomas', email: 'amanda.thomas@abcaccounting.com', username: 'amandathomas', roles: ['registered_contact'], status: 'active', lastLogin: '2024-01-19', createdAt: '2023-09-10', companyId: 'company-1', jobTitle: 'Bookkeeper', dataNetEmailOptIn: true },
  { id: 'user-11', firstName: 'Chris', lastName: 'Martinez', email: 'chris.martinez@abcaccounting.com', username: 'chrismartinez', roles: ['registered_contact'], status: 'active', lastLogin: '2024-01-16', createdAt: '2023-10-05', companyId: 'company-1', jobTitle: 'Financial Analyst', dataNetEmailOptIn: true },
  { id: 'user-12', firstName: 'Nicole', lastName: 'Garcia', email: 'nicole.garcia@abcaccounting.com', username: 'nicolegarcia', roles: ['registered_contact'], status: 'active', lastLogin: null, createdAt: '2023-11-20', companyId: 'company-1', jobTitle: 'Intern', dataNetEmailOptIn: true },
  { id: 'user-13', firstName: 'Kevin', lastName: 'Lee', email: 'kevin.lee@abcaccounting.com', username: 'kevinlee', roles: ['registered_contact'], status: 'active', lastLogin: '2024-01-05', createdAt: '2023-12-01', companyId: 'company-1', jobTitle: 'Auditor', dataNetEmailOptIn: true },
  { id: 'user-20', firstName: 'Michael', lastName: 'Chen', email: 'michael.chen@xyzconsulting.com', username: 'michaelchen', roles: ['account_owner'], status: 'active', lastLogin: '2024-01-20', createdAt: '2023-06-20', companyId: 'company-2', jobTitle: 'Managing Partner', dataNetEmailOptIn: true },
  { id: 'user-21', firstName: 'Jessica', lastName: 'Wong', email: 'jessica.wong@xyzconsulting.com', username: 'jessicawong', roles: ['billing_admin'], status: 'active', lastLogin: '2024-01-18', createdAt: '2023-07-01', companyId: 'company-2', jobTitle: 'Finance Director', dataNetEmailOptIn: true },
  { id: 'user-22', firstName: 'Daniel', lastName: 'Kim', email: 'daniel.kim@xyzconsulting.com', username: 'danielkim', roles: ['license_admin'], status: 'active', lastLogin: '2024-01-17', createdAt: '2023-07-15', companyId: 'company-2', jobTitle: 'IT Director', dataNetEmailOptIn: true },
  { id: 'user-23', firstName: 'Rachel', lastName: 'Park', email: 'rachel.park@xyzconsulting.com', username: 'rachelpark', roles: ['registered_contact'], status: 'active', lastLogin: '2024-01-16', createdAt: '2023-08-01', companyId: 'company-2', jobTitle: 'Consultant', dataNetEmailOptIn: true },
  { id: 'user-24', firstName: 'Steven', lastName: 'Liu', email: 'steven.liu@xyzconsulting.com', username: 'stevenliu', roles: ['registered_contact'], status: 'active', lastLogin: '2024-01-15', createdAt: '2023-08-20', companyId: 'company-2', jobTitle: 'Senior Consultant', dataNetEmailOptIn: true },
  { id: 'user-25', firstName: 'Laura', lastName: 'Huang', email: 'laura.huang@xyzconsulting.com', username: 'laurahuang', roles: ['registered_contact'], status: 'invited', lastLogin: null, createdAt: '2024-01-15', companyId: 'company-2', jobTitle: 'Associate', dataNetEmailOptIn: true },
];

// v14 reset (Section A2): exactly ONE active subscription per company.
//   ABC  → NumberCruncher Desktop (5 seats) + NumberCruncher Web (3 seats).
//          DataNet is included automatically and has no separate seat management.
//          Renewal ~200 days out so mid-cycle proration math is interesting to demo.
//   XYZ  → NumberCruncher Desktop (10 seats) only. Renewal ~150 days out.
const initialSubscriptions: Subscription[] = [
  {
    id: 'sub-1',
    companyId: 'company-1',
    name: 'Annual Plan',
    planType: 'Annual',
    billingFrequency: 'annual',
    status: 'active',
    startDate: _isoDaysAgo(165),
    renewalDate: _isoDaysAhead(200),
    baseFee: 1000,
    perSeatCost: 10,
    products: [
      { id: 'prod-desktop', name: 'NumberCruncher Desktop', licenseCount: 5, purchasedLicenseCount: 5, pricePerLicense: 10, status: 'active' },
      { id: 'prod-web', name: 'NumberCruncher Web', licenseCount: 3, purchasedLicenseCount: 3, pricePerLicense: 10, status: 'active' },
    ],
  },
  {
    id: 'sub-3',
    companyId: 'company-2',
    name: 'Annual Plan',
    planType: 'Annual',
    billingFrequency: 'annual',
    status: 'active',
    startDate: _isoDaysAgo(215),
    renewalDate: _isoDaysAhead(150),
    baseFee: 1000,
    perSeatCost: 10,
    products: [
      { id: 'prod-desktop-2', name: 'NumberCruncher Desktop', licenseCount: 10, purchasedLicenseCount: 10, pricePerLicense: 10, status: 'active' },
    ],
  },
];

// v14 reset (Section A3): ZERO deactivated licenses on first load. The
// "Previously held licenses" scenario is created live during the demo by
// decreasing seats with the "Remove now" option.
const initialLicenses: License[] = [
  // ABC — NumberCruncher Desktop (prod-desktop): all 5 paid seats assigned. This is
  // the product the demo decreases from 5 → 3, so every seat is filled to trigger
  // the per-user removal prompt. John Smith + Sarah Johnson are the removable pair.
  { userId: 'user-1', subscriptionId: 'sub-1', productId: 'prod-desktop', assignedAt: _isoDaysAgo(150), licenseType: 'paid' },
  { userId: 'user-2', subscriptionId: 'sub-1', productId: 'prod-desktop', assignedAt: _isoDaysAgo(150), licenseType: 'paid' },
  { userId: 'user-3', subscriptionId: 'sub-1', productId: 'prod-desktop', assignedAt: _isoDaysAgo(150), licenseType: 'paid' },
  { userId: 'user-4', subscriptionId: 'sub-1', productId: 'prod-desktop', assignedAt: _isoDaysAgo(150), licenseType: 'paid' },
  { userId: 'user-5', subscriptionId: 'sub-1', productId: 'prod-desktop', assignedAt: _isoDaysAgo(150), licenseType: 'paid' },
  // ABC — NumberCruncher Web (prod-web): 2 of 3 paid seats assigned (one open slot
  // to demo inline "Assign user").
  { userId: 'user-1', subscriptionId: 'sub-1', productId: 'prod-web', assignedAt: _isoDaysAgo(150), licenseType: 'paid' },
  { userId: 'user-6', subscriptionId: 'sub-1', productId: 'prod-web', assignedAt: _isoDaysAgo(150), licenseType: 'paid' },
  // XYZ — NumberCruncher Desktop (prod-desktop-2): 5 of 10 paid seats assigned.
  ...['user-20','user-21','user-22','user-23','user-24']
    .map(uid => ({ userId: uid, subscriptionId: 'sub-3', productId: 'prod-desktop-2', assignedAt: _isoDaysAgo(150), licenseType: 'paid' as LicenseType })),
];

// ============================================================
// Demo seed invoices — one example per scenario for both ABC and XYZ.
// All dates are calculated relative to "today" so the demo stays fresh.
// ============================================================
const initialInvoices: Invoice[] = [
  // ============ ABC ACCOUNTING (Pay on Receipt) ============
  // inv-abc-001 — Initial subscription purchase, paid (history baseline)
  {
    id: 'inv-abc-001',
    companyId: 'company-1',
    invoiceNumber: 'INV-ABC-001',
    date: _isoDaysAgo(300),
    dueDate: _isoDaysAgo(270),
    status: 'paid',
    amount: 1391,
    balance: 0,
    subscriptionId: 'sub-1',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Initial Invoice',
    source: 'checkout',
    paymentMethod: 'pay_on_receipt',
    paidAt: _isoDaysAgo(260),
    description: 'Initial subscription purchase',
    subtotal: 1300,
    tax: 91,
    totalAmount: 1391,
    lineItems: [
      { product: 'Base Subscription Fee', quantity: 1, unitPrice: 1000, total: 1000 },
      { product: 'NumberCruncher Web Seats', quantity: 20, unitPrice: 10, total: 200 },
      { product: 'NumberCruncher Desktop Seats', quantity: 10, unitPrice: 10, total: 100 },
    ],
  },
  // inv-abc-002 — License adjustment +2 seats, paid
  {
    id: 'inv-abc-002',
    companyId: 'company-1',
    invoiceNumber: 'INV-ABC-002',
    date: _isoDaysAgo(60),
    dueDate: _isoDaysAgo(30),
    status: 'paid',
    amount: 21.40,
    balance: 0,
    subscriptionId: 'sub-1',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Adjustment Invoice',
    source: 'license_change',
    paymentMethod: 'pay_on_receipt',
    paidAt: _isoDaysAgo(25),
    description: 'License adjustment — added 2 seats',
    subtotal: 20,
    tax: 1.40,
    totalAmount: 21.40,
    lineItems: [
      { product: 'Additional NumberCruncher Desktop Seats', quantity: 2, unitPrice: 10, total: 20 },
    ],
  },
  // inv-abc-003 — License adjustment +5 seats, awaiting payment (Pay Now CTA target)
  {
    id: 'inv-abc-003',
    companyId: 'company-1',
    invoiceNumber: 'INV-ABC-003',
    date: _isoDaysAgo(5),
    dueDate: _isoDaysAhead(25),
    status: 'awaiting_payment',
    amount: 53.50,
    balance: 53.50,
    subscriptionId: 'sub-1',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Adjustment Invoice',
    source: 'license_change',
    paymentMethod: 'pay_on_receipt',
    paidAt: null,
    description: 'License adjustment — added 5 seats',
    subtotal: 50,
    tax: 3.50,
    totalAmount: 53.50,
    lineItems: [
      { product: 'Additional NumberCruncher Web Seats', quantity: 5, unitPrice: 10, total: 50 },
    ],
  },
  // inv-abc-004 — Upcoming annual renewal preview (Renew CTA target)
  // invoiceNumber contains "2026" so the runtime renewal generator's dedup check picks it up.
  {
    id: 'inv-abc-004',
    companyId: 'company-1',
    invoiceNumber: 'INV-RNW-2026-ABC',
    date: _isoDaysAhead(5),
    dueDate: _isoDaysAhead(25),
    status: 'upcoming',
    amount: 1412.40,
    balance: 1412.40,
    subscriptionId: 'sub-1',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Renewal Invoice',
    source: 'renewal',
    paymentMethod: 'pay_on_receipt',
    paidAt: null,
    description: 'Annual renewal — 2027',
    subtotal: 1320,
    tax: 92.40,
    totalAmount: 1412.40,
    lineItems: [
      { product: 'Base Subscription Fee', quantity: 1, unitPrice: 1000, total: 1000 },
      { product: 'NumberCruncher Web Seats', quantity: 20, unitPrice: 10, total: 200 },
      { product: 'NumberCruncher Desktop Seats', quantity: 12, unitPrice: 10, total: 120 },
    ],
  },
  // inv-abc-005 — Initial purchase for the Team Expansion add-on subscription, paid
  {
    id: 'inv-abc-005',
    companyId: 'company-1',
    invoiceNumber: 'INV-ABC-005',
    date: _isoDaysAgo(180),
    dueDate: _isoDaysAgo(150),
    status: 'paid',
    amount: 1867.15,
    balance: 0,
    subscriptionId: 'sub-abc-addon',
    subscriptionName: 'NumberCruncher Web — Team Expansion',
    invoiceType: 'Initial Invoice',
    source: 'checkout',
    paymentMethod: 'pay_immediately',
    paidAt: _isoDaysAgo(145),
    description: 'Initial purchase — NumberCruncher Web Team Expansion',
    subtotal: 1745,
    tax: 122.15,
    totalAmount: 1867.15,
    lineItems: [
      { product: 'NumberCruncher Web Seats', quantity: 5, unitPrice: 349, total: 1745 },
    ],
  },
  // inv-abc-006 — Overdue license adjustment (dunning UX). Source = license_change so
  // the auto-suspension hook does NOT fire (it only watches renewal-source invoices).
  {
    id: 'inv-abc-006',
    companyId: 'company-1',
    invoiceNumber: 'INV-ABC-006',
    date: _isoDaysAgo(90),
    dueDate: _isoDaysAgo(60),
    status: 'overdue',
    amount: 32.10,
    balance: 32.10,
    subscriptionId: 'sub-1',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Adjustment Invoice',
    source: 'license_change',
    paymentMethod: 'pay_on_receipt',
    paidAt: null,
    description: 'License adjustment — past due',
    subtotal: 30,
    tax: 2.10,
    totalAmount: 32.10,
    lineItems: [
      { product: 'Additional NumberCruncher Web Seats', quantity: 3, unitPrice: 10, total: 30 },
    ],
  },

  // ============ XYZ CONSULTING (Pay on Terms — Net 30) ============
  // inv-xyz-001 — Initial purchase under Net 30, terms applied, subscription active
  {
    id: 'inv-xyz-001',
    companyId: 'company-2',
    invoiceNumber: 'INV-XYZ-001',
    date: _isoDaysAgo(200),
    dueDate: _isoDaysAgo(170),
    status: 'payment_terms_applied',
    amount: 1241.20,
    balance: 0,
    subscriptionId: 'sub-3',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Initial Invoice',
    source: 'checkout',
    paymentMethod: 'pay_on_terms',
    paidAt: null,
    description: 'Initial subscription purchase',
    subtotal: 1160,
    tax: 81.20,
    totalAmount: 1241.20,
    lineItems: [
      { product: 'Base Subscription Fee', quantity: 1, unitPrice: 1000, total: 1000 },
      { product: 'NumberCruncher Web Seats', quantity: 8, unitPrice: 10, total: 80 },
      { product: 'NumberCruncher Desktop Seats', quantity: 8, unitPrice: 10, total: 80 },
    ],
  },
  // inv-xyz-002 — Prior-year paid checkout invoice (long history)
  {
    id: 'inv-xyz-002',
    companyId: 'company-2',
    invoiceNumber: 'INV-XYZ-002',
    date: _isoDaysAgo(560),
    dueDate: _isoDaysAgo(530),
    status: 'paid',
    amount: 1241.20,
    balance: 0,
    subscriptionId: 'sub-3',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Initial Invoice',
    source: 'checkout',
    paymentMethod: 'pay_on_terms',
    paidAt: _isoDaysAgo(525),
    description: 'Prior year subscription',
    subtotal: 1160,
    tax: 81.20,
    totalAmount: 1241.20,
    lineItems: [
      { product: 'Base Subscription Fee', quantity: 1, unitPrice: 1000, total: 1000 },
      { product: 'NumberCruncher Web Seats', quantity: 8, unitPrice: 10, total: 80 },
      { product: 'NumberCruncher Desktop Seats', quantity: 8, unitPrice: 10, total: 80 },
    ],
  },
  // inv-xyz-003 — Auto-renewal under Net 30.
  // invoiceNumber contains "2026" so the runtime renewal generator's dedup check picks it up.
  {
    id: 'inv-xyz-003',
    companyId: 'company-2',
    invoiceNumber: 'INV-RNW-2026-XYZ',
    date: _isoDaysAhead(10),
    dueDate: _isoDaysAhead(40),
    status: 'payment_terms_applied',
    amount: 1241.20,
    balance: 0,
    subscriptionId: 'sub-3',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Renewal Invoice',
    source: 'renewal',
    paymentMethod: 'pay_on_terms',
    paidAt: null,
    description: 'Annual renewal — 2027',
    subtotal: 1160,
    tax: 81.20,
    totalAmount: 1241.20,
    lineItems: [
      { product: 'Base Subscription Fee', quantity: 1, unitPrice: 1000, total: 1000 },
      { product: 'NumberCruncher Web Seats', quantity: 8, unitPrice: 10, total: 80 },
      { product: 'NumberCruncher Desktop Seats', quantity: 8, unitPrice: 10, total: 80 },
    ],
  },
  // inv-xyz-004 — Accepted quote conversion with PO carry-through
  {
    id: 'inv-xyz-004',
    companyId: 'company-2',
    invoiceNumber: 'INV-XYZ-004',
    date: _isoDaysAgo(45),
    dueDate: _isoDaysAgo(15),
    status: 'paid',
    amount: 638.79,
    balance: 0,
    subscriptionId: 'sub-3',
    subscriptionName: 'Annual Plan',
    invoiceType: 'Adjustment Invoice',
    source: 'quote_acceptance',
    paymentMethod: 'pay_on_terms',
    paidAt: _isoDaysAgo(10),
    description: 'Quote QU-XYZ-002 — Accepted with PO',
    poNumber: 'PO-2025-XYZ-014',
    quoteNumber: 'QU-XYZ-002',
    subtotal: 597,
    tax: 41.79,
    totalAmount: 638.79,
    lineItems: [
      { product: 'QuickView Desktop Seats', quantity: 3, unitPrice: 199, total: 597 },
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

// ============================================================
// Demo seed quotes — one example per lifecycle state for both ABC and XYZ.
// All dates are calculated relative to "today" so the demo stays fresh.
// ============================================================
const initialQuotes: Quote[] = [
  // ============ ABC ACCOUNTING ============
  // quote-abc-001 — Active, freshly created, full 30-day window
  {
    id: 'quote-abc-001', companyId: 'company-1', quoteNumber: 'Q-ABC-001',
    createdDate: _isoDaysAgo(0), expiryDate: _isoDaysAhead(30),
    status: 'active', amount: 1745,
    note: 'Quote for additional NumberCruncher Web seats — team expansion.',
    lineItems: [
      { productName: 'NumberCruncher Web', licenseCount: 5, unitPrice: 349, total: 1745 },
    ],
  },
  // quote-abc-002 — Active, expiring soon (2 days) — drives the urgency/Clock icon
  {
    id: 'quote-abc-002', companyId: 'company-1', quoteNumber: 'Q-ABC-002',
    createdDate: _isoDaysAgo(28), expiryDate: _isoDaysAhead(2),
    status: 'active', amount: 1445,
    note: 'Multi-product quote — NumberCruncher Desktop + QuickView Desktop.',
    lineItems: [
      { productName: 'NumberCruncher Desktop', licenseCount: 3, unitPrice: 349, total: 1047 },
      { productName: 'QuickView Desktop', licenseCount: 2, unitPrice: 199, total: 398 },
    ],
  },
  // quote-abc-003 — Declined WITH reason (action menu shows View Decline Reason)
  {
    id: 'quote-abc-003', companyId: 'company-1', quoteNumber: 'Q-ABC-003',
    createdDate: _isoDaysAgo(10), expiryDate: _isoDaysAhead(20),
    status: 'declined', amount: 3490,
    note: 'Expansion quote for NumberCruncher Web.',
    declineReason: 'Evaluating budget for Q3 — will revisit.',
    lineItems: [
      { productName: 'NumberCruncher Web', licenseCount: 10, unitPrice: 349, total: 3490 },
    ],
  },
  // quote-abc-004 — Declined WITHOUT reason (action menu omits View Decline Reason)
  {
    id: 'quote-abc-004', companyId: 'company-1', quoteNumber: 'Q-ABC-004',
    createdDate: _isoDaysAgo(15), expiryDate: _isoDaysAhead(15),
    status: 'declined', amount: 995,
    note: 'QuickView Desktop expansion.',
    lineItems: [
      { productName: 'QuickView Desktop', licenseCount: 5, unitPrice: 199, total: 995 },
    ],
  },
  // quote-abc-005 — Accepted with PO, historical
  {
    id: 'quote-abc-005', companyId: 'company-1', quoteNumber: 'Q-ABC-005',
    createdDate: _isoDaysAgo(60), expiryDate: _isoDaysAgo(30),
    status: 'accepted', amount: 1396,
    note: 'NumberCruncher Desktop expansion — PO at accept.',
    poNumber: 'PO-2025-ABC-009',
    lineItems: [
      { productName: 'NumberCruncher Desktop', licenseCount: 4, unitPrice: 349, total: 1396 },
    ],
  },
  // quote-abc-006 — Expired (past expiry without action)
  {
    id: 'quote-abc-006', companyId: 'company-1', quoteNumber: 'Q-ABC-006',
    createdDate: _isoDaysAgo(45), expiryDate: _isoDaysAgo(15),
    status: 'expired', amount: 2792,
    note: 'NumberCruncher Web expansion quote.',
    lineItems: [
      { productName: 'NumberCruncher Web', licenseCount: 8, unitPrice: 349, total: 2792 },
    ],
  },
  // quote-abc-007 — Requested by customer, awaiting formal sales response.
  {
    id: 'quote-abc-007', companyId: 'company-1', quoteNumber: 'QU-1007',
    createdDate: _isoDaysAgo(2), expiryDate: _isoDaysAhead(30),
    status: 'requested', amount: 1047,
    requestReason: 'Adding seats to a current product',
    note: 'Need 3 additional NumberCruncher Web seats for our new hires.',
    lineItems: [
      { productName: 'NumberCruncher Web', licenseCount: 3, unitPrice: 349, total: 1047 },
    ],
  },

  // ============ XYZ CONSULTING ============
  // quote-xyz-001 — Active, multi-product
  {
    id: 'quote-xyz-001', companyId: 'company-2', quoteNumber: 'QU-XYZ-001',
    createdDate: _isoDaysAgo(5), expiryDate: _isoDaysAhead(25),
    status: 'active', amount: 2123,
    note: 'NumberCruncher Desktop expansion + DataNet add-on.',
    lineItems: [
      { productName: 'NumberCruncher Desktop', licenseCount: 6, unitPrice: 349, total: 2094 },
      { productName: 'DataNet', licenseCount: 1, unitPrice: 29, total: 29 },
    ],
  },
  // quote-xyz-002 — Accepted with PO, ties to inv-xyz-004 (PO carry-through demo)
  {
    id: 'quote-xyz-002', companyId: 'company-2', quoteNumber: 'QU-XYZ-002',
    createdDate: _isoDaysAgo(50), expiryDate: _isoDaysAgo(20),
    status: 'accepted', amount: 597,
    note: 'QuickView Desktop seats — accepted with PO.',
    poNumber: 'PO-2025-XYZ-014',
    invoiceId: 'inv-xyz-004',
    lineItems: [
      { productName: 'QuickView Desktop', licenseCount: 3, unitPrice: 199, total: 597 },
    ],
  },
];

const initialQuoteRequests: QuoteRequest[] = [];

const initialCompanyConfigs: CompanyBillingConfig[] = [
  // ABC — Pay on Receipt only
  { companyId: 'company-1', paymentEligibility: 'pay_on_receipt', payOnTermsEnabled: false, defaultBillingMethod: 'pay_on_receipt' },
  // XYZ — Pay on Terms enabled (Net 30)
  { companyId: 'company-2', paymentEligibility: 'pay_on_terms', payOnTermsEnabled: true, terms: 'Net 30', defaultBillingMethod: 'pay_on_terms' },
];

const initialDataNetUpdates: DataNetUpdate[] = [
  {
    id: 'dn-2026-04', year: 2026, month: 4, monthName: 'April',
    title: 'Spring filing season recap',
    summary: 'A review of the 2026 spring filing season — extensions, e-file volume, and IRS guidance changes that affected returns this cycle.',
    body: `The spring 2026 filing season closed out with record e-file volume across most state agencies, though several jurisdictions extended deadlines in response to localized weather disruption. Practitioners reported steady processing turnaround from the IRS, with average refund issuance holding near the historical 21-day target.\n\nNew guidance issued mid-season clarified the treatment of digital-asset reporting on Form 8949 and adjusted withholding tables for several wage brackets. Firms that updated client engagement letters before March generally avoided the rework that hit late-filing populations.\n\nLooking ahead to summer planning season, advisors should expect continued attention to digital-asset reconciliation, multi-state apportionment for remote workers, and the upcoming sunset provisions in the 2017 act. We will continue to surface relevant guidance through DataNet as it is released.`,
    publishedAt: '2026-04-15',
  },
  {
    id: 'dn-2026-03', year: 2026, month: 3, monthName: 'March',
    title: 'March compliance bulletin',
    summary: 'Quarter-end compliance updates: estimated tax adjustments, Form 1099-K thresholds, and state nexus changes for service businesses.',
    body: `March brought a wave of state-level compliance updates affecting service-based and remote-employer clients. Several states finalized economic-nexus thresholds for income tax purposes that mirror existing sales-tax rules, increasing the registration burden on professional-services firms with distributed teams.\n\nThe revised Form 1099-K reporting threshold remains in flux at the federal level, but practitioners should continue to obtain transaction-level detail from clients using third-party payment platforms. We have updated our practitioner checklist in the DataNet resource library to reflect the current guidance.\n\nFirst-quarter estimated tax payments are due April 15 for most taxpayers. Confirm that any prior-year safe-harbor calculations have been refreshed for clients with material income changes since the 2025 return.`,
    publishedAt: '2026-03-12',
  },
  {
    id: 'dn-2026-02', year: 2026, month: 2, monthName: 'February',
    title: 'Tax season mid-point review',
    summary: 'Mid-season trends across practitioners: average return complexity, common e-file rejection causes, and IRS service-level updates.',
    body: `As we cross the mid-point of the 2026 filing season, practitioner-reported data shows return complexity continuing to trend upward, driven by digital-asset activity and the proliferation of pass-through entity election filings. Average preparation time per individual return is up modestly year over year.\n\nThe most common e-file rejection causes this season remain SSN/ITIN mismatches and prior-year AGI authentication failures. Firms using identity-protection PINs for at-risk clients have reported substantially lower rejection rates than last year.\n\nIRS phone wait times are tracking better than the 2025 season, but Practitioner Priority Service callbacks remain inconsistent. Continue to favor written correspondence and e-Services portal interactions for substantive matters.`,
    publishedAt: '2026-02-20',
  },
  {
    id: 'dn-2026-01', year: 2026, month: 1, monthName: 'January',
    title: 'New year regulatory roundup',
    summary: 'New-year overview of regulatory changes effective January 2026, plus a forward look at agency rulemaking expected this year.',
    body: `Several federal and state regulatory changes took effect January 1, 2026, including inflation-indexed adjustments to retirement plan contribution limits, standard deduction amounts, and gift/estate exclusion thresholds. The full schedule has been added to the DataNet reference library.\n\nOn the rulemaking horizon, watch for additional Treasury guidance on the digital-asset broker reporting rules, expected updates to the foreign tax credit regulations, and several state initiatives addressing remote-worker income sourcing.\n\nThis is also the appropriate time to refresh internal training on the practitioner conduct standards under Circular 230, particularly with respect to the diligence and reliance provisions that have drawn increased OPR attention.`,
    publishedAt: '2026-01-08',
  },
  {
    id: 'dn-2025-12', year: 2025, month: 12, monthName: 'December',
    title: 'Year-end planning checklist',
    summary: 'A consolidated year-end checklist covering individual, business, and trust-and-estate planning items for the December close.',
    body: `Year-end is the natural moment to revisit harvest-loss opportunities, charitable bunching strategies, and Roth conversion modeling for clients with unusual income patterns this year. The DataNet planning library now includes refreshed worksheets for each scenario.\n\nFor business clients, confirm that any planned equipment purchases qualify under the current Section 179 and bonus depreciation rules, and verify that retirement plan contributions are scheduled before the relevant funding deadlines. S-corporation officer compensation should be reviewed against reasonable-compensation benchmarks before payroll closes for the year.\n\nTrust and estate clients with material 2025 distributions should receive a written distribution summary before January 31 to support beneficiary reporting. Coordinate with the trustees of any irrevocable trusts on the 65-day election timing.`,
    publishedAt: '2025-12-03',
  },
  {
    id: 'dn-2025-11', year: 2025, month: 11, monthName: 'November',
    title: 'November regulatory update',
    summary: 'Recent IRS notices, proposed rulemakings, and state-level guidance issued in October and early November.',
    body: `The IRS issued several practitioner-facing notices in late October addressing pass-through entity tax elections, foreign information reporting, and the timing of partnership audit adjustments. Practitioners with affected clients should review the underlying notices directly; summaries are in the DataNet library.\n\nA notable proposed rulemaking on the digital-asset cost-basis reporting rules opened a 60-day comment period. Firms with material digital-asset exposure should consider participating either directly or through their professional associations.\n\nState-level guidance has continued to evolve on the pass-through entity tax workarounds; check the residency-specific resources for any clients with multi-state operations.`,
    publishedAt: '2025-11-04',
  },
  {
    id: 'dn-2025-10', year: 2025, month: 10, monthName: 'October',
    title: 'Q3 industry outlook',
    summary: 'Third-quarter outlook covering practitioner sentiment, hiring trends, technology adoption, and regulatory enforcement priorities.',
    body: `Practitioner sentiment surveys conducted during the third quarter reflect cautious optimism: most firms expect modest revenue growth into 2026, though concerns about staffing capacity and software cost inflation persist. Mid-sized firms in particular are signaling continued investment in workflow automation.\n\nHiring across the profession remains tight at the senior-staff and manager levels. Firms reporting the highest retention typically emphasize structured advancement timelines and explicit hybrid-work policies.\n\nOn the regulatory front, OPR has signaled continued attention to e-file authorization compliance and identity-verification controls. Firms should refresh internal documentation of their information-security plans under the Safeguards Rule.`,
    publishedAt: '2025-10-09',
  },
  {
    id: 'dn-2025-09', year: 2025, month: 9, monthName: 'September',
    title: 'September compliance brief',
    summary: 'End-of-extension filing season recap, plus practitioner notes on the September 15 partnership and S-corp deadline.',
    body: `The September 15 deadline for extended partnership and S-corporation returns passed without major systemic disruption, though several state portals experienced congestion in the final 24 hours. Practitioners are encouraged to schedule extension-season filings to clear at least 72 hours before the deadline.\n\nFirm-level data suggests a modest decline in late-filing penalty assessments year over year, attributable in part to the improved e-file acknowledgment cadence. Continue to retain acknowledgment receipts for at least seven years.\n\nThe individual extension deadline of October 15 is the next major milestone. Confirm that any extension-related estimated-payment shortfalls have been documented in client files to support potential penalty-abatement requests.`,
    publishedAt: '2025-09-18',
  },
  {
    id: 'dn-2025-08', year: 2025, month: 8, monthName: 'August',
    title: 'Summer planning advisory',
    summary: 'Summer planning topics including projected-tax modeling, mid-year payroll reviews, and entity-restructuring considerations.',
    body: `Summer is the natural window for projected-tax modeling on clients with materially changed circumstances since the spring filing. Use the refreshed projection worksheets in the DataNet library to surface estimated-payment adjustments before the September deadline.\n\nMid-year payroll reviews — including worker-classification audits, fringe-benefit confirmation, and retirement-plan contribution pacing — pay outsized dividends if started before Labor Day. Clients with new state-jurisdiction exposure since January should review nexus footprint accordingly.\n\nFinally, summer is a strong time for entity-restructuring conversations: S-election timing, accountable-plan adoption, and partnership/PEO transitions all benefit from the longer planning runway available before year-end.`,
    publishedAt: '2025-08-12',
  },
];

const initialSavedPaymentMethods: SavedPaymentMethod[] = [
  {
    id: 'pm-abc-card-1', userId: 'user-1', companyId: 'company-1', type: 'card',
    cardBrand: 'Visa', cardLast4: '4242', cardExpMonth: 12, cardExpYear: 2026,
    holderName: 'John Smith', isPrimary: true, createdAt: '2026-01-01',
  },
  {
    id: 'pm-abc-ach-1', userId: 'user-2', companyId: 'company-1', type: 'ach',
    bankName: 'Chase', accountLast4: '6789', routingLast4: '1111',
    holderName: 'ABC Accounting', isPrimary: true, createdAt: '2026-01-02',
  },
  {
    id: 'pm-xyz-card-1', userId: 'user-20', companyId: 'company-2', type: 'card',
    cardBrand: 'Mastercard', cardLast4: '5454', cardExpMonth: 6, cardExpYear: 2027,
    holderName: 'Michael Chen', isPrimary: true, createdAt: '2026-01-03',
  },
];


// ============================================================
// Seed notifications — give first-load demo users a non-empty bell.
// ============================================================
const initialNotifications: Notification[] = [
  // ABC — John Smith
  {
    id: 'notif-abc-1', userId: 'user-1', companyId: 'company-1',
    type: 'quote.received',
    title: 'New quote received',
    message: 'Quote Q-ABC-001 for additional NumberCruncher Web seats is ready for review.',
    link: '/quotes', linkLabel: 'View quote',
    createdAt: _isoHoursAgoFull(5), readAt: null,
  },
  {
    id: 'notif-abc-2', userId: 'user-1', companyId: 'company-1',
    type: 'subscription.renewal_upcoming',
    title: 'Subscription renewal coming',
    message: 'Your Annual Plan renews soon. Renewal invoice INV-RNW-2026-ABC is ready.',
    link: '/invoices', linkLabel: 'View invoice',
    createdAt: _isoDaysAgoFull(1), readAt: null,
  },
  {
    id: 'notif-abc-3', userId: 'user-1', companyId: 'company-1',
    type: 'invoice.paid',
    title: 'Payment received',
    message: 'Your payment for invoice INV-ABC-002 has been processed.',
    link: '/invoices', linkLabel: 'View invoice',
    createdAt: _isoDaysAgoFull(3), readAt: _isoDaysAgoFull(2),
  },
  {
    id: 'notif-abc-4', userId: 'user-1', companyId: 'company-1',
    type: 'user.accepted_invitation',
    title: 'User accepted invitation',
    message: 'Amanda Thomas has logged in for the first time.',
    link: '/users', linkLabel: 'View users',
    createdAt: _isoDaysAgoFull(7), readAt: _isoDaysAgoFull(6),
  },
  // XYZ — Michael Chen
  {
    id: 'notif-xyz-1', userId: 'user-20', companyId: 'company-2',
    type: 'subscription.renewal_upcoming',
    title: 'Subscription renewal coming',
    message: 'Your Annual Plan renews soon. Renewal invoice INV-RNW-2026-XYZ is ready.',
    link: '/invoices', linkLabel: 'View invoice',
    createdAt: _isoDaysAgoFull(5), readAt: null,
  },
  {
    id: 'notif-xyz-2', userId: 'user-20', companyId: 'company-2',
    type: 'quote.accepted',
    title: 'Quote accepted',
    message: 'Quote QU-XYZ-002 has been accepted. Invoice generated.',
    link: '/invoices', linkLabel: 'View invoice',
    createdAt: _isoDaysAgoFull(2), readAt: _isoDaysAgoFull(1),
  },
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
    demoRoles: ['account_owner'],
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
    companyConfigs: initialCompanyConfigs,
    savedPaymentMethods: initialSavedPaymentMethods,
    dataNetUpdates: initialDataNetUpdates,
    notifications: initialNotifications,
    catalogProducts: initialCatalogProducts,
    useLegacyProration: false,
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

  // ============================================================
  // Notifications — write helpers (declared early so event-emitting
  // methods below can reference notify() in their closures)
  // ============================================================
  const notify = useCallback((input: { userId?: string; type: NotificationType; title: string; message: string; link?: string; linkLabel?: string }) => {
    setState(prev => {
      const targetId = input.userId || prev.currentUser?.id;
      if (!targetId) return prev;
      const user = prev.users.find(u => u.id === targetId);
      if (!user) return prev;
      const defaults = getDefaultNotificationPrefs();
      const prefs = { ...defaults, ...(user.notificationPrefs || {}) };
      if (!prefs[input.type]?.inApp) return prev;
      const notification: Notification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: targetId,
        companyId: user.companyId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        linkLabel: input.linkLabel,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      return { ...prev, notifications: [notification, ...prev.notifications] };
    });
  }, []);

  const getUserNotificationPrefs = useCallback((userId?: string): Record<NotificationType, NotificationChannelPrefs> => {
    const id = userId || state.currentUser?.id;
    const defaults = getDefaultNotificationPrefs();
    if (!id) return defaults;
    const user = state.users.find(u => u.id === id);
    if (!user?.notificationPrefs) return defaults;
    return { ...defaults, ...user.notificationPrefs };
  }, [state.users, state.currentUser]);

  const updateUserNotificationPrefs = useCallback((userId: string, type: NotificationType, channel: 'email' | 'inApp', value: boolean) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => {
        if (u.id !== userId) return u;
        const current = u.notificationPrefs || getDefaultNotificationPrefs();
        return {
          ...u,
          notificationPrefs: {
            ...current,
            [type]: { ...current[type], [channel]: value },
          },
        };
      }),
      currentUser: prev.currentUser?.id === userId
        ? (() => {
            const current = prev.currentUser?.notificationPrefs || getDefaultNotificationPrefs();
            return {
              ...prev.currentUser!,
              notificationPrefs: {
                ...current,
                [type]: { ...current[type], [channel]: value },
              },
            };
          })()
        : prev.currentUser,
    }));
  }, []);

  const resetUserNotificationPrefs = useCallback((userId: string) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, notificationPrefs: getDefaultNotificationPrefs() } : u),
      currentUser: prev.currentUser?.id === userId
        ? { ...prev.currentUser, notificationPrefs: getDefaultNotificationPrefs() }
        : prev.currentUser,
    }));
  }, []);

  const login = useCallback((email: string, _password: string): boolean => {
    if (!email.trim()) return false;
    const normalized = email.trim().toLowerCase();
    const existing = state.users.find(u => u.email.toLowerCase() === normalized);

    if (existing) {
      if (existing.status === 'inactive') return false;
      const company = state.companies.find(c => c.id === existing.companyId);
      const todayISO = new Date().toISOString().split('T')[0];
      const wasInvited = existing.status === 'invited';
      // Invited users transition to active on first successful login.
      const flipped: User = wasInvited
        ? { ...existing, status: 'active' as const, lastLogin: todayISO }
        : { ...existing, lastLogin: todayISO };
      setState(prev => ({
        ...prev,
        users: prev.users.map(u => u.id === flipped.id ? flipped : u),
        isAuthenticated: true,
        currentUser: flipped,
        currentCompany: company || null,
        demoRoles: flipped.roles,
      }));
      if (wasInvited) {
        const admins = state.users.filter(u =>
          u.companyId === flipped.companyId &&
          u.status === 'active' &&
          u.id !== flipped.id &&
          (u.roles.includes('account_owner') || u.roles.includes('license_admin'))
        );
        admins.forEach(admin => {
          notify({
            userId: admin.id,
            type: 'user.accepted_invitation',
            title: 'User accepted invitation',
            message: `${flipped.firstName} ${flipped.lastName} has logged in for the first time.`,
            link: '/users',
            linkLabel: 'View users',
          });
        });
      }
      return true;
    }

    // Unknown email — auto-join the seeded ABC Accounting demo company.
    // Keeps the prototype feeling populated for first-time demo viewers.
    const abcCompany = state.companies.find(c => c.id === 'company-1');
    if (!abcCompany) return false;

    const { firstName, lastName } = parseDisplayNameFromEmail(normalized);
    const baseUsername =
      `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    let generatedUsername = baseUsername;
    const inCompany = state.users.filter(u => u.companyId === abcCompany.id);
    if (inCompany.some(u => u.username?.toLowerCase() === baseUsername)) {
      let i = 1;
      while (inCompany.some(u => u.username?.toLowerCase() === `${baseUsername}${i}`)) i++;
      generatedUsername = `${baseUsername}${i}`;
    }
    const todayISO = new Date().toISOString().split('T')[0];
    const newUser: User = {
      id: `user-demo-${Date.now()}`,
      firstName,
      lastName,
      email: normalized,
      username: generatedUsername,
      roles: ['account_owner'],
      status: 'active',
      lastLogin: todayISO,
      createdAt: todayISO,
      companyId: abcCompany.id,
      dataNetEmailOptIn: true,
    };
    setState(prev => ({
      ...prev,
      users: [...prev.users, newUser],
      isAuthenticated: true,
      currentUser: newUser,
      currentCompany: abcCompany,
      demoRoles: ['account_owner'],
    }));
    return true;
  }, [state.users, state.companies, notify]);

  const logout = useCallback(() => {
    setState(prev => ({
      ...prev,
      isAuthenticated: false,
      currentUser: null,
      currentCompany: null,
      demoRoles: ['account_owner'],
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

  const updateCompany = useCallback((companyId: string, updates: Partial<Company>) => {
    setState(prev => ({
      ...prev,
      companies: prev.companies.map(c => c.id === companyId ? { ...c, ...updates } : c),
      currentCompany: prev.currentCompany?.id === companyId
        ? { ...prev.currentCompany, ...updates }
        : prev.currentCompany,
    }));
  }, []);

  const updateCompanyBillingDetails = useCallback((input: {
    companyId: string;
    name: string;
    address?: CompanyAddress;
    contactUserIds: string[];
  }) => {
    setState(prev => {
      const apply = (c: Company): Company => ({
        ...c,
        name: input.name.trim() || c.name,
        address: input.address,
        billingContactUserIds: input.contactUserIds,
      });
      return {
        ...prev,
        companies: prev.companies.map(c => c.id === input.companyId ? apply(c) : c),
        currentCompany: prev.currentCompany?.id === input.companyId ? apply(prev.currentCompany) : prev.currentCompany,
      };
    });
  }, []);

  const setAutoRenewal = useCallback((companyId: string, value: boolean) => {
    setState(prev => ({
      ...prev,
      companies: prev.companies.map(c => c.id === companyId ? { ...c, autoRenewal: value } : c),
      currentCompany: prev.currentCompany?.id === companyId
        ? { ...prev.currentCompany, autoRenewal: value }
        : prev.currentCompany,
    }));
  }, []);

  const setDemoRoles = useCallback((roles: Role[]) => {
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
      demoRoles: prev.originalUser?.roles || ['account_owner'],
      originalUser: null,
    }));
  }, []);

  const addUser = useCallback((userData: Omit<User, 'id' | 'createdAt' | 'companyId'>): User => {
    const companyId = state.currentCompany?.id || 'company-1';
    // Auto-generate username when not supplied; ensure uniqueness within company.
    let username = userData.username?.trim();
    if (!username) {
      const base = `${userData.firstName}${userData.lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
      username = base;
      const inCompany = state.users.filter(u => u.companyId === companyId);
      if (inCompany.some(u => u.username?.toLowerCase() === base)) {
        let i = 1;
        while (inCompany.some(u => u.username?.toLowerCase() === `${base}${i}`)) i++;
        username = `${base}${i}`;
      }
    }
    const newUser: User = {
      ...userData,
      username,
      // New users are invited by default — they activate on first login.
      status: 'invited',
      lastLogin: null,
      dataNetEmailOptIn: userData.dataNetEmailOptIn ?? true,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      companyId,
    };
    setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
    // Notify all admins (account_owner + license_admin) of the invitation.
    const admins = state.users.filter(u =>
      u.companyId === companyId &&
      u.status === 'active' &&
      (u.roles.includes('account_owner') || u.roles.includes('license_admin'))
    );
    admins.forEach(admin => {
      notify({
        userId: admin.id,
        type: 'user.invited',
        title: 'New user invited',
        message: `${newUser.firstName} ${newUser.lastName} has been invited to your organization.`,
        link: '/users',
        linkLabel: 'View users',
      });
    });
    return newUser;
  }, [state.currentCompany, state.users, notify]);

  const updateUser = useCallback((userId: string, updates: Partial<User>) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, ...updates } : u),
    }));
  }, []);

  const deactivateUser = useCallback((userId: string) => {
    setState(prev => {
      const target = prev.users.find(u => u.id === userId);
      if (!target) return prev;
      // Block deactivating the last active Account Owner.
      if (target.roles.includes('account_owner')) {
        const otherActiveOwners = prev.users.filter(u =>
          u.id !== userId &&
          u.companyId === target.companyId &&
          u.roles.includes('account_owner') &&
          u.status !== 'inactive'
        );
        if (otherActiveOwners.length === 0) return prev;
      }
      return {
        ...prev,
        users: prev.users.map(u => u.id === userId ? { ...u, status: 'inactive' } : u),
        licenses: prev.licenses.filter(l => l.userId !== userId),
      };
    });
  }, []);

  const reactivateUser = useCallback((userId: string) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, status: 'active' } : u),
    }));
  }, []);

  const changeUserRoles = useCallback((userId: string, roles: Role[]): boolean => {
    const user = state.users.find(u => u.id === userId);
    if (!user) return false;
    if (user.roles.includes('account_owner') && !roles.includes('account_owner')) {
      const otherOwners = state.users.filter(u =>
        u.id !== userId &&
        u.companyId === user.companyId &&
        u.roles.includes('account_owner') &&
        u.status !== 'inactive'
      );
      if (otherOwners.length === 0) return false;
    }
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, roles } : u),
    }));
    notify({
      userId,
      type: 'account.role_changed',
      title: 'Your role was updated',
      message: `Your role on this account was changed.`,
      link: '/dashboard',
    });
    return true;
  }, [state.users, notify]);

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
    // Count only live, user-assigned licenses. Deactivated ("previously held")
    // licenses carry an empty userId + deactivatedAt and must not inflate the count.
    return state.licenses.filter(l =>
      l.subscriptionId === subscriptionId &&
      l.productId === productId &&
      !!l.userId &&
      !l.deactivatedAt
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

  const renameSubscription = useCallback((subscriptionId: string, newName: string) => {
    setState(prev => ({
      ...prev,
      subscriptions: prev.subscriptions.map(s =>
        s.id === subscriptionId ? { ...s, name: newName } : s
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
    const { companyName, firstName, lastName, email } = state.wizardData;

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
      username: `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '') || `user${Date.now()}`,
      roles: ['account_owner'],
      status: 'active',
      lastLogin: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
      companyId: newCompanyId,
      dataNetEmailOptIn: true,
    };

    // Brand-new signups land in the portal without any subscription, invoice,
    // or licenses — they must go through Checkout to actually purchase.
    setState(prev => ({
      ...prev,
      companies: [...prev.companies, newCompany],
      users: [...prev.users, newUser],
      isAuthenticated: true,
      currentUser: newUser,
      currentCompany: newCompany,
      demoRoles: ['account_owner'],
    }));
  }, [state.wizardData]);

  const createAccount = useCallback((input: { companyName: string; firstName: string; lastName: string; email: string; password: string }) => {
    const newCompanyId = `company-${Date.now()}`;
    const newCompany: Company = {
      id: newCompanyId,
      name: input.companyName,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const newUserId = `user-${Date.now()}`;
    const newUser: User = {
      id: newUserId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      username: `${input.firstName}${input.lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '') || `user${Date.now()}`,
      roles: ['account_owner'],
      status: 'active',
      lastLogin: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
      companyId: newCompanyId,
      dataNetEmailOptIn: true,
    };

    setState(prev => ({
      ...prev,
      companies: [...prev.companies, newCompany],
      users: [...prev.users, newUser],
      isAuthenticated: true,
      currentUser: newUser,
      currentCompany: newCompany,
      demoRoles: ['account_owner'],
      wizardData: {
        ...prev.wizardData,
        companyName: input.companyName,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        password: input.password,
      },
    }));

    return { user: newUser, company: newCompany };
  }, []);

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

  const getEffectiveRoles = useCallback((): Role[] => {
    const roles = [...state.demoRoles];
    if (state.billingHasAdminAccess && roles.includes('billing_admin') && !roles.includes('license_admin')) {
      roles.push('license_admin');
    }
    return roles;
  }, [state.demoRoles, state.billingHasAdminAccess]);

  const hasAccess = useCallback((requiredRoles: Role[]): boolean => {
    const effectiveRoles = getEffectiveRoles();
    return requiredRoles.some(role => effectiveRoles.includes(role));
  }, [getEffectiveRoles]);

  const can = useCallback((perm: Permission): boolean => {
    const roles = getEffectiveRoles();
    const has = (r: Role) => roles.includes(r);
    // owner_only_actions is intentionally NOT auto-granted to AO via the early return —
    // handled below explicitly so the rule is colocated with other Manage-Licenses gates.
    if (perm === 'owner_only_actions') return has('account_owner');
    if (has('account_owner')) return true;
    switch (perm) {
      case 'users.add':
      case 'users.edit':
        return has('license_admin');
      case 'users.assign_roles':
        return has('license_admin');
      case 'users.deactivate':
        return has('license_admin');
      case 'users.impersonate':
        return has('license_admin');
      case 'subscriptions.purchase':
      case 'subscriptions.modify_seats':
      case 'subscriptions.cancel':
        return has('billing_admin');
      case 'licenses.assign':
        return has('license_admin');
      case 'billing.view':
      case 'billing.pay':
      case 'billing.manage_methods':
        return has('billing_admin');
      case 'support.view_all_tickets':
        return has('billing_admin') || has('license_admin');
      // Manage Licenses drawer gates (per discovery Q12)
      case 'manage_seats_count':
      case 'manage_seat_renewal_status':
      case 'reactivate_license':
      case 'edit_billing_details':
        return has('billing_admin');
      case 'manage_user_assignment':
        return has('billing_admin') || has('license_admin');
      default:
        return false;
    }
  }, [getEffectiveRoles]);

  const isReadOnlyMode = useCallback((): boolean => {
    const companyId = state.currentCompany?.id;
    if (!companyId) return false;
    return state.subscriptions.some(
      s => s.companyId === companyId && (s.status === 'pending_payment' || s.status === 'suspended')
    );
  }, [state.subscriptions, state.currentCompany]);

  const isSuspendedMode = useCallback((): boolean => {
    const companyId = state.currentCompany?.id;
    if (!companyId) return false;
    return state.subscriptions.some(
      s => s.companyId === companyId && s.status === 'suspended'
    );
  }, [state.subscriptions, state.currentCompany]);

  const forceSuspendCurrentSubscription = useCallback((): boolean => {
    const companyId = state.currentCompany?.id;
    if (!companyId) return false;
    let success = false;
    setState(prev => {
      const target = prev.subscriptions.find(s => s.companyId === companyId && s.status === 'active');
      if (!target) return prev;

      const existingUnpaidRenewal = prev.invoices.find(
        i => i.subscriptionId === target.id && i.source === 'renewal' && i.status !== 'paid'
      );

      let invoices = prev.invoices;
      if (!existingUnpaidRenewal) {
        const today = new Date();
        const baseFee = target.baseFee ?? 1000;
        const perSeat = target.perSeatCost ?? 10;
        const subtotal = baseFee + target.products.reduce(
          (acc, p) => acc + (p.pricePerLicense || perSeat) * p.licenseCount, 0
        );
        const tax = Math.round(subtotal * 0.07 * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;
        const periodKey = `${new Date(target.renewalDate).getFullYear()}`;
        const synthetic: Invoice = {
          id: `inv-suspend-${target.id}-${Date.now()}`,
          companyId: target.companyId,
          invoiceNumber: `INV-RNW-${periodKey}-${target.id.slice(-3)}`,
          subscriptionId: target.id,
          subscriptionName: target.name,
          date: today.toISOString().split('T')[0],
          dueDate: today.toISOString().split('T')[0],
          amount: total,
          subtotal,
          tax,
          totalAmount: total,
          balance: total,
          status: 'overdue',
          source: 'renewal',
          invoiceType: 'Renewal Invoice',
          description: `Annual renewal — ${periodKey}`,
          paidAt: null,
          lineItems: [
            { product: 'Base Subscription Fee', quantity: 1, unitPrice: baseFee, total: baseFee },
            ...target.products.map(p => ({
              product: `${p.name} Seats`,
              quantity: p.licenseCount,
              unitPrice: p.pricePerLicense || perSeat,
              total: (p.pricePerLicense || perSeat) * p.licenseCount,
            })),
          ],
        };
        invoices = [synthetic, ...invoices];
      }

      success = true;
      return {
        ...prev,
        invoices,
        subscriptions: prev.subscriptions.map(s =>
          s.id === target.id ? { ...s, status: 'suspended' as const } : s
        ),
      };
    });
    return success;
  }, [state.currentCompany]);

  const restoreActiveSubscription = useCallback((): boolean => {
    const companyId = state.currentCompany?.id;
    if (!companyId) return false;
    setState(prev => ({
      ...prev,
      subscriptions: prev.subscriptions.map(s => {
        if (s.companyId !== companyId || s.status !== 'suspended') return s;
        const nextRenewal = new Date(
          new Date(s.renewalDate).getTime() + 365 * 86400000
        ).toISOString().split('T')[0];
        return { ...s, status: 'active' as const, renewalDate: nextRenewal };
      }),
    }));
    return true;
  }, [state.currentCompany]);

  const getCurrentUserTrialLicenses = useCallback(() => {
    const userId = state.currentUser?.id;
    if (!userId) return [];
    const now = Date.now();
    return state.licenses
      .filter(l => l.userId === userId && l.licenseType === 'trial' && l.trialExpiresAt)
      .map(l => {
        const sub = state.subscriptions.find(s => s.id === l.subscriptionId);
        const product = sub?.products.find(p => p.id === l.productId);
        return {
          licenseId: `${l.userId}-${l.subscriptionId}-${l.productId}`,
          productName: product?.name || 'Unknown product',
          expiresAt: l.trialExpiresAt!,
        };
      })
      .filter(t => new Date(t.expiresAt).getTime() > now);
  }, [state.licenses, state.currentUser, state.subscriptions]);

  const isUsernameTaken = useCallback((username: string, companyId: string, excludeUserId?: string): boolean => {
    const normalized = username.trim().toLowerCase();
    return state.users.some(u =>
      u.companyId === companyId &&
      u.username?.toLowerCase() === normalized &&
      u.id !== excludeUserId
    );
  }, [state.users]);

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
    // Only auto-expire 'active' quotes. 'requested' quotes wait for sales response indefinitely.
    return state.quotes
      .filter(q => q.companyId === state.currentCompany?.id)
      .map(q => (q.status === 'active' && new Date(q.expiryDate) < today ? { ...q, status: 'expired' as const } : q));
  }, [state.quotes, state.currentCompany]);

  const getCompanyQuoteRequests = useCallback((): QuoteRequest[] => {
    return state.quoteRequests.filter(r => r.companyId === state.currentCompany?.id);
  }, [state.quoteRequests, state.currentCompany]);

  const hasPaidInvoice = useCallback((): boolean => {
    const companyId = state.currentCompany?.id;
    if (!companyId) return false;
    return state.invoices.some(i => i.companyId === companyId && i.status === 'paid');
  }, [state.invoices, state.currentCompany]);

  const hasSentQuote = useCallback((): boolean => {
    const companyId = state.currentCompany?.id;
    if (!companyId) return false;
    return state.quotes.some(q => q.companyId === companyId);
  }, [state.quotes, state.currentCompany]);

  const hasDeclinedQuote = useCallback((): boolean => {
    const companyId = state.currentCompany?.id;
    if (!companyId) return false;
    return state.quotes.some(q => q.companyId === companyId && q.status === 'declined');
  }, [state.quotes, state.currentCompany]);

  const isFirstTimeCustomer = useCallback((): boolean => {
    return !hasPaidInvoice();
  }, [hasPaidInvoice]);

  const createQuote = useCallback((input: {
    lineItems: QuoteLineItem[];
    note: string;
    recipients?: string[];
    status?: Quote['status'];
    requestReason?: QuoteRequestReason;
  }): Quote => {
    const created = new Date();
    const expires = new Date(created.getTime() + 30 * 86400000);
    const amount = input.lineItems.reduce((a, li) => a + li.total, 0);
    const newQuote: Quote = {
      id: `quote-${Date.now()}`,
      companyId: state.currentCompany?.id || 'company-1',
      quoteNumber: `Q-${String(1000 + Math.floor(Math.random() * 9000))}`,
      createdDate: created.toISOString().split('T')[0],
      expiryDate: expires.toISOString().split('T')[0],
      status: input.status || 'active',
      amount,
      note: input.note || '',
      lineItems: input.lineItems,
      recipients: input.recipients && input.recipients.length > 0 ? input.recipients : undefined,
      requestReason: input.requestReason,
    };
    setState(prev => ({ ...prev, quotes: [newQuote, ...prev.quotes] }));
    return newQuote;
  }, [state.currentCompany]);

  const acceptQuote = useCallback((quoteId: string, input: { poNumber?: string; paymentMethod: PaymentMethod }) => {
    const quote = state.quotes.find(q => q.id === quoteId);
    if (!quote) return null;
    if (quote.status !== 'active') return null;
    if (new Date(quote.expiryDate) < new Date()) return null;

    const today = new Date();
    const due = new Date(today.getTime() + 30 * 86400000);
    const todayStr = today.toISOString().split('T')[0];
    const status: Invoice['status'] =
      input.paymentMethod === 'pay_immediately' ? 'paid' :
      input.paymentMethod === 'pay_on_terms' ? 'payment_terms_applied' : 'awaiting_payment';

    // Mid-cycle: target the company's primary active Annual subscription.
    // Falls back to any active subscription if no Annual one exists.
    const targetSub =
      state.subscriptions.find(s => s.companyId === quote.companyId && s.status === 'active' && s.planType === 'Annual') ||
      state.subscriptions.find(s => s.companyId === quote.companyId && s.status === 'active') ||
      null;

    // Apply seat increases / new products immediately for pay_immediately
    // (payment already happened at /pay before acceptQuote runs) and for
    // pay_on_terms (seats provisioned on credit). For pay_on_receipt, defer
    // until the invoice is paid via markInvoicePaid.
    const applyImmediately =
      input.paymentMethod === 'pay_immediately' || input.paymentMethod === 'pay_on_terms';

    const baseId = Date.now();
    const invoiceId = `inv-${baseId}`;
    const invoice: Invoice = {
      id: invoiceId,
      companyId: quote.companyId,
      invoiceNumber: `INV-${String(2000 + Math.floor(Math.random() * 9000))}`,
      date: todayStr,
      dueDate: due.toISOString().split('T')[0],
      status,
      amount: quote.amount,
      balance: input.paymentMethod === 'pay_immediately' ? 0 : quote.amount,
      subscriptionId: targetSub?.id || '',
      subscriptionName: targetSub?.name || 'Annual Plan',
      invoiceType: 'Adjustment Invoice',
      source: 'quote_acceptance',
      quoteNumber: quote.quoteNumber,
      poNumber: input.poNumber,
      paymentMethod: input.paymentMethod,
      lineItems: quote.lineItems.map(l => ({
        product: l.productName,
        quantity: l.licenseCount,
        unitPrice: l.unitPrice,
        total: l.total,
      })),
      // Pay-on-receipt defers seat application until the invoice is paid.
      pendingQuoteApplication:
        !applyImmediately && targetSub
          ? { quoteId: quote.id, subscriptionId: targetSub.id }
          : undefined,
    };
    const updatedQuote: Quote = {
      ...quote,
      status: 'accepted',
      poNumber: input.poNumber,
      paymentMethod: input.paymentMethod,
      invoiceId: invoice.id,
      acceptedAt: today.toISOString(),
    };

    setState(prev => ({
      ...prev,
      quotes: prev.quotes.map(q => q.id === quoteId ? updatedQuote : q),
      invoices: [invoice, ...prev.invoices],
      subscriptions: applyImmediately && targetSub
        ? prev.subscriptions.map(s => s.id === targetSub.id ? applyQuoteToSubscription(s, quote) : s)
        : prev.subscriptions,
    }));
    notify({
      type: 'quote.accepted',
      title: 'Quote accepted',
      message: `Quote ${quote.quoteNumber} for ${formatCurrency(quote.amount)} has been accepted. Invoice generated.`,
      link: '/invoices',
      linkLabel: 'View invoice',
    });
    return { quote: updatedQuote, invoice, subscription: targetSub || undefined };
  }, [state.quotes, state.subscriptions, notify]);

  const declineQuote = useCallback((quoteId: string, reason?: string) => {
    const quote = state.quotes.find(q => q.id === quoteId);
    setState(prev => ({
      ...prev,
      quotes: prev.quotes.map(q => q.id === quoteId ? { ...q, status: 'declined', declineReason: reason } : q),
    }));
    if (quote) {
      notify({
        type: 'quote.declined',
        title: 'Quote declined',
        message: `Quote ${quote.quoteNumber} has been declined.`,
        link: '/quotes',
        linkLabel: 'View quotes',
      });
    }
  }, [state.quotes, notify]);

  const cancelQuoteRequest = useCallback((quoteId: string) => {
    setState(prev => {
      const quote = prev.quotes.find(q => q.id === quoteId);
      if (!quote || quote.status !== 'requested') return prev;
      return { ...prev, quotes: prev.quotes.filter(q => q.id !== quoteId) };
    });
  }, []);

  const approvePendingQuoteRequests = useCallback((): number => {
    let approved: Quote[] = [];
    setState(prev => {
      const pending = prev.quotes.filter(q => q.status === 'requested');
      if (pending.length === 0) {
        approved = [];
        return prev;
      }
      const now = new Date();
      const expiry = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0];
      approved = pending.map(q => ({
        ...q,
        status: 'active' as const,
        expiryDate: expiry,
        formallyQuotedAt: now.toISOString(),
      }));
      const byId = new Map(approved.map(q => [q.id, q]));
      return {
        ...prev,
        quotes: prev.quotes.map(q => byId.get(q.id) || q),
      };
    });
    approved.forEach(quote => {
      const owner = state.users.find(u =>
        u.companyId === quote.companyId &&
        u.roles.includes('account_owner') &&
        u.status === 'active'
      );
      notify({
        userId: owner?.id,
        type: 'quote.received',
        title: 'Formal quote ready',
        message: `Quote ${quote.quoteNumber} for ${formatCurrency(quote.amount)} is ready to review.`,
        link: '/quotes',
        linkLabel: 'Review quote',
      });
    });
    return approved.length;
  }, [state.users, notify]);

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

  const getCompanyConfig = useCallback((companyId?: string): CompanyBillingConfig => {
    const cid = companyId || state.currentCompany?.id || 'company-1';
    return state.companyConfigs.find(c => c.companyId === cid) || {
      companyId: cid, paymentEligibility: 'pay_on_receipt', payOnTermsEnabled: false, defaultBillingMethod: 'pay_on_receipt',
    };
  }, [state.companyConfigs, state.currentCompany]);

  const updateCompanyConfig = useCallback((companyId: string, updates: Partial<CompanyBillingConfig>) => {
    setState(prev => {
      const exists = prev.companyConfigs.some(c => c.companyId === companyId);
      const next = exists
        ? prev.companyConfigs.map(c => c.companyId === companyId ? { ...c, ...updates } : c)
        : [...prev.companyConfigs, { companyId, paymentEligibility: 'pay_on_receipt', payOnTermsEnabled: false, defaultBillingMethod: 'pay_on_receipt', ...updates } as CompanyBillingConfig];
      return { ...prev, companyConfigs: next };
    });
  }, []);

  const getAvailablePaymentMethods = useCallback((companyId?: string): PaymentMethod[] => {
    const cfg = getCompanyConfig(companyId);
    if (cfg.payOnTermsEnabled) {
      return ['pay_immediately', 'pay_on_terms'];
    }
    return ['pay_immediately', 'pay_on_receipt'];
  }, [getCompanyConfig]);

  const requestLicenseChange = useCallback((subscriptionId: string, productId: string, newCount: number, paymentMethod: PaymentMethod) => {
    const sub = state.subscriptions.find(s => s.id === subscriptionId);
    const prod = sub?.products.find(p => p.id === productId);
    if (!sub || !prod) return { applied: false, pending: false };
    const currentCount = prod.licenseCount;
    const delta = newCount - currentCount;

    // Decrease — no payment, just save
    if (delta <= 0) {
      setState(prev => ({
        ...prev,
        subscriptions: prev.subscriptions.map(s => s.id === subscriptionId ? {
          ...s, products: s.products.map(p => p.id === productId ? { ...p, licenseCount: newCount } : p),
        } : s),
      }));
      return { applied: true, pending: false };
    }

    // Increase — generate invoice using the license/maintenance proration model
    // (per discovery Q1). Fall back to legacy flat proration when the admin toggle is on.
    const today = new Date();
    const catalog = state.catalogProducts.find(c => c.name === prod.name);
    const totalPerSeat = catalog?.pricePerSeatPerYear ?? prod.pricePerLicense;
    const maintenancePerSeat = catalog?.maintenancePerSeatPerYear ?? 0;
    const proration = calculateProratedAdd({
      product: {
        pricePerSeatPerYear: totalPerSeat,
        maintenancePerSeatPerYear: maintenancePerSeat,
      },
      seats: delta,
      addDate: today,
      renewalDate: new Date(sub.renewalDate),
      useLegacyProration: state.useLegacyProration,
    });
    const cost = proration.totalCharge;
    const status: Invoice['status'] =
      paymentMethod === 'pay_immediately' ? 'paid' :
      paymentMethod === 'pay_on_terms' ? 'payment_terms_applied' : 'awaiting_payment';
    const applyImmediately = paymentMethod === 'pay_immediately' || paymentMethod === 'pay_on_terms';

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      companyId: sub.companyId,
      invoiceNumber: `INV-${String(3000 + Math.floor(Math.random() * 9000))}`,
      date: today.toISOString().split('T')[0],
      dueDate: new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0],
      status,
      amount: cost,
      balance: paymentMethod === 'pay_immediately' ? 0 : cost,
      subscriptionId: sub.id,
      subscriptionName: sub.name,
      invoiceType: 'Adjustment Invoice',
      source: 'license_change',
      paymentMethod,
      // Customer-facing line item shows ONE total (license + prorated maintenance combined).
      lineItems: [{ product: `Additional ${prod.name} Seats`, quantity: delta, unitPrice: Math.round((cost / Math.max(delta, 1)) * 100) / 100, total: cost }],
      pendingLicenseChange: applyImmediately ? undefined : { subscriptionId, productId, newCount },
    };

    setState(prev => ({
      ...prev,
      invoices: [invoice, ...prev.invoices],
      subscriptions: prev.subscriptions.map(s => s.id === subscriptionId ? {
        ...s,
        products: s.products.map(p => p.id === productId ? {
          ...p,
          licenseCount: applyImmediately ? newCount : p.licenseCount,
          pendingLicenseCount: applyImmediately ? p.pendingLicenseCount : (p.pendingLicenseCount || 0) + delta,
        } : p),
      } : s),
    }));
    return { invoice, applied: applyImmediately, pending: !applyImmediately };
  }, [state.subscriptions, state.catalogProducts, state.useLegacyProration]);

  const scheduleLicenseDecrease = useCallback((
    subscriptionId: string,
    productId: string,
    newCount: number,
    removeNowUserIds: string[],
    expireEndOfYearUserIds: string[],
  ) => {
    setState(prev => {
      const sub = prev.subscriptions.find(s => s.id === subscriptionId);
      if (!sub) return prev;
      // Unassign "remove now" users immediately — seat remains paid for the term.
      const licenses = prev.licenses.filter(l => !(
        l.subscriptionId === subscriptionId &&
        l.productId === productId &&
        removeNowUserIds.includes(l.userId)
      ));
      const subscriptions = prev.subscriptions.map(s => s.id !== subscriptionId ? s : {
        ...s,
        products: s.products.map(p => p.id !== productId ? p : {
          ...p,
          // licenseCount is intentionally NOT reduced — change activates on the renewal date.
          scheduledLicenseCount: newCount,
          scheduledEffectiveDate: sub.renewalDate,
          scheduledUnassignedUserIds: expireEndOfYearUserIds.slice(),
        }),
      });
      return { ...prev, licenses, subscriptions };
    });
  }, []);

  const applyLicenseReduction = useCallback((input: {
    subscriptionId: string;
    productId: string;
    newCurrentCount: number;
    newRenewalCount: number;
    removeNowUserIds: string[];
    expireEndOfCycleUserIds: string[];
  }) => {
    const nowIso = new Date().toISOString().split('T')[0];
    const removeNowSet = new Set(input.removeNowUserIds);
    setState(prev => {
      const sub = prev.subscriptions.find(s => s.id === input.subscriptionId);
      if (!sub) return prev;
      // "Remove now" → deactivate the live license in place: clear the assignment,
      // stamp deactivatedAt/reason so it surfaces under "Previously held licenses".
      const licenses = prev.licenses.map(l => {
        if (l.subscriptionId !== input.subscriptionId || l.productId !== input.productId) return l;
        if (l.userId && removeNowSet.has(l.userId) && !l.deactivatedAt) {
          return { ...l, userId: '', deactivatedAt: nowIso, deactivatedReason: 'Seat reduced by admin' };
        }
        return l;
      });
      const subscriptions = prev.subscriptions.map(s => {
        if (s.id !== input.subscriptionId) return s;
        return {
          ...s,
          products: s.products.map(p => {
            if (p.id !== input.productId) return p;
            const scheduled = input.newRenewalCount < input.newCurrentCount;
            return {
              ...p,
              licenseCount: input.newCurrentCount,
              purchasedLicenseCount: Math.min(p.purchasedLicenseCount ?? p.licenseCount, input.newCurrentCount),
              scheduledLicenseCount: scheduled ? input.newRenewalCount : undefined,
              scheduledEffectiveDate: scheduled ? s.renewalDate : undefined,
              scheduledUnassignedUserIds: scheduled ? input.expireEndOfCycleUserIds.slice() : undefined,
            };
          }),
        };
      });
      return { ...prev, licenses, subscriptions };
    });
  }, []);

  const setInvoicePoNumber = useCallback((invoiceId: string, poNumber: string | undefined) => {
    setState(prev => ({
      ...prev,
      invoices: prev.invoices.map(i =>
        i.id === invoiceId ? { ...i, poNumber: poNumber && poNumber.trim() ? poNumber.trim() : undefined } : i
      ),
    }));
  }, []);

  const markInvoicePaid = useCallback((invoiceId: string) => {
    let paidInvoice: Invoice | undefined;
    let reactivatedSub: Subscription | undefined;
    setState(prev => {
      const inv = prev.invoices.find(i => i.id === invoiceId);
      if (!inv) return prev;
      paidInvoice = inv;
      let subscriptions = prev.subscriptions;
      // Apply pending license change if any
      if (inv.pendingLicenseChange) {
        const { subscriptionId, productId, newCount } = inv.pendingLicenseChange;
        subscriptions = subscriptions.map(s => s.id === subscriptionId ? {
          ...s, products: s.products.map(p => {
            if (p.id !== productId) return p;
            const delta = newCount - p.licenseCount;
            const remainingPending = Math.max(0, (p.pendingLicenseCount || 0) - delta);
            return { ...p, licenseCount: newCount, pendingLicenseCount: remainingPending };
          }),
        } : s);
      }
      // Apply pending quote line items if the invoice carries one
      if (inv.pendingQuoteApplication) {
        const { quoteId, subscriptionId } = inv.pendingQuoteApplication;
        const quote = prev.quotes.find(q => q.id === quoteId);
        if (quote) {
          subscriptions = subscriptions.map(s =>
            s.id === subscriptionId ? applyQuoteToSubscription(s, quote) : s
          );
        }
      }
      // Activate pending_payment subscription if linked
      if (inv.activatesSubscription) {
        subscriptions = subscriptions.map(s => s.id === inv.subscriptionId && s.status === 'pending_payment' ? { ...s, status: 'active' } : s);
      }
      // Reactivate suspended subscription when its renewal invoice is paid; extend renewalDate by 365 days
      if (inv.source === 'renewal') {
        subscriptions = subscriptions.map(s => {
          if (s.id !== inv.subscriptionId || s.status !== 'suspended') return s;
          const nextRenewal = new Date(
            new Date(s.renewalDate).getTime() + 365 * 86400000
          ).toISOString().split('T')[0];
          reactivatedSub = { ...s, status: 'active' as const, renewalDate: nextRenewal };
          return reactivatedSub;
        });
      }
      return {
        ...prev,
        invoices: prev.invoices.map(i => i.id === invoiceId ? { ...i, status: 'paid', balance: 0 } : i),
        subscriptions,
      };
    });
    if (paidInvoice) {
      notify({
        type: 'invoice.paid',
        title: 'Payment received',
        message: `Your payment of ${formatCurrency(paidInvoice.totalAmount ?? paidInvoice.amount)} for invoice ${paidInvoice.invoiceNumber} has been processed.`,
        link: '/invoices',
        linkLabel: 'View invoice',
      });
    }
    if (reactivatedSub) {
      notify({
        type: 'subscription.reactivated',
        title: 'Subscription reactivated',
        message: `Access to ${reactivatedSub.name} has been restored.`,
        link: '/subscriptions',
        linkLabel: 'View subscriptions',
      });
    }
  }, [notify]);

  const checkoutPurchase = useCallback((input: { lineItems: QuoteLineItem[]; paymentMethod: PaymentMethod; poNumber?: string }): Invoice => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const renewalStr = new Date(today.getTime() + 365 * 86400000).toISOString().split('T')[0];
    const amount = input.lineItems.reduce((a, l) => a + l.total, 0);
    const companyId = state.currentCompany?.id || 'company-1';

    const baseId = Date.now();
    const subId = `sub-${baseId}`;
    const products: SubscriptionProduct[] = input.lineItems.map((l, i) => ({
      id: `prod-${baseId}-${i}`,
      name: l.productName,
      licenseCount: l.licenseCount,
      purchasedLicenseCount: l.licenseCount,
      pricePerLicense: l.unitPrice,
      status: 'active' as const,
    }));

    // Pay-on-receipt → pending until paid. Pay immediately/on-terms → active right away.
    const subStatus: Subscription['status'] =
      input.paymentMethod === 'pay_on_receipt' ? 'pending_payment' : 'active';

    const newSubscription: Subscription = {
      id: subId,
      companyId,
      name: 'Annual Plan',
      planType: 'Annual',
      billingFrequency: 'annual',
      status: subStatus,
      startDate: todayStr,
      renewalDate: renewalStr,
      baseFee: 1000,
      perSeatCost: 10,
      products,
    };

    // Per spec: NO licenses are auto-created at purchase regardless of payment method.
    // The Account Owner must assign explicitly from User Edit / Manage Licenses.

    const status: Invoice['status'] =
      input.paymentMethod === 'pay_immediately' ? 'paid' :
      input.paymentMethod === 'pay_on_terms' ? 'payment_terms_applied' : 'awaiting_payment';

    const invoice: Invoice = {
      id: `inv-${baseId}`,
      companyId,
      invoiceNumber: `INV-${String(4000 + Math.floor(Math.random() * 9000))}`,
      date: todayStr,
      dueDate: new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0],
      status,
      amount,
      balance: input.paymentMethod === 'pay_immediately' ? 0 : amount,
      subscriptionId: subId,
      subscriptionName: 'Annual Plan',
      invoiceType: 'Initial Invoice',
      source: 'checkout',
      paymentMethod: input.paymentMethod,
      poNumber: input.poNumber,
      activatesSubscription: input.paymentMethod === 'pay_on_receipt',
      lineItems: input.lineItems.map(l => ({ product: l.productName, quantity: l.licenseCount, unitPrice: l.unitPrice, total: l.total })),
    };

    setState(prev => ({
      ...prev,
      subscriptions: [...prev.subscriptions, newSubscription],
      invoices: [invoice, ...prev.invoices],
    }));
    notify({
      type: 'invoice.created',
      title: 'New invoice ready',
      message: `Invoice ${invoice.invoiceNumber} for ${formatCurrency(invoice.amount)} is awaiting review.`,
      link: '/invoices',
      linkLabel: 'View invoice',
    });
    if (input.paymentMethod === 'pay_immediately') {
      notify({
        type: 'invoice.paid',
        title: 'Payment received',
        message: `Your payment of ${formatCurrency(invoice.amount)} has been processed.`,
        link: '/invoices',
        linkLabel: 'View invoice',
      });
    }
    return invoice;
  }, [state.currentCompany, notify]);

  const renewSubscription = useCallback((
    subscriptionId: string,
    newLicenseCounts?: Record<string, number>,
    totalAmountIn?: number,
    invoiceId?: string,
  ): Invoice | null => {
    const sub = state.subscriptions.find(s => s.id === subscriptionId);
    if (!sub) return null;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const baseFee = sub.baseFee ?? 1000;
    const perSeat = sub.perSeatCost ?? 10;

    // Updated products reflect any seat changes requested at renewal time
    const updatedProducts = sub.products.map(p => {
      const c = newLicenseCounts?.[p.id] ?? p.licenseCount;
      return { ...p, licenseCount: c };
    });
    const seatCharges = updatedProducts.reduce((a, p) => a + p.licenseCount * (p.pricePerLicense || perSeat), 0);
    const computedAmount = baseFee + seatCharges;
    const amount = totalAmountIn ?? computedAmount;
    const nextRenewal = new Date(
      new Date(sub.renewalDate).getTime() + 365 * 86400000
    ).toISOString().split('T')[0];

    let resultingInvoice: Invoice | null = null;
    setState(prev => {
      let invoices = prev.invoices;
      const existing = invoiceId ? invoices.find(i => i.id === invoiceId) : undefined;
      if (existing) {
        invoices = invoices.map(i => i.id === invoiceId
          ? { ...i, status: 'paid' as const, balance: 0, paidAt: today.toISOString(), paymentMethod: 'pay_immediately' as PaymentMethod }
          : i);
        resultingInvoice = invoices.find(i => i.id === invoiceId) || null;
      } else {
        const invoice: Invoice = {
          id: `inv-${Date.now()}`,
          companyId: sub.companyId,
          invoiceNumber: `INV-${String(5000 + Math.floor(Math.random() * 9000))}`,
          date: todayStr,
          dueDate: nextRenewal,
          status: 'paid',
          amount,
          balance: 0,
          subscriptionId: sub.id,
          subscriptionName: sub.name,
          invoiceType: 'Renewal Invoice',
          source: 'renewal',
          description: `Annual renewal — ${new Date(nextRenewal).getFullYear()}`,
          paymentMethod: 'pay_immediately',
          subtotal: computedAmount,
          tax: 0,
          totalAmount: amount,
          paidAt: today.toISOString(),
          lineItems: [
            { product: 'Base Subscription Fee', quantity: 1, unitPrice: baseFee, total: baseFee },
            ...updatedProducts.map(p => ({
              product: `${p.name} Seats`,
              quantity: p.licenseCount,
              unitPrice: p.pricePerLicense || perSeat,
              total: p.licenseCount * (p.pricePerLicense || perSeat),
            })),
          ],
        };
        invoices = [invoice, ...invoices];
        resultingInvoice = invoice;
      }
      return {
        ...prev,
        subscriptions: prev.subscriptions.map(s =>
          s.id === subscriptionId
            ? { ...s, status: 'active' as const, renewalDate: nextRenewal, products: updatedProducts }
            : s
        ),
        invoices,
      };
    });
    return resultingInvoice;
  }, [state.subscriptions]);

  // ============================================================
  // Saved Payment Methods
  // ============================================================
  const getCompanyPaymentMethods = useCallback((companyId?: string): SavedPaymentMethod[] => {
    const cid = companyId || state.currentCompany?.id;
    if (!cid) return [];
    return state.savedPaymentMethods.filter(m => m.companyId === cid);
  }, [state.savedPaymentMethods, state.currentCompany]);

  const getUserPaymentMethods = useCallback((_userId?: string): SavedPaymentMethod[] => {
    // Methods are company-scoped in this demo — all users in a company share them.
    return getCompanyPaymentMethods();
  }, [getCompanyPaymentMethods]);

  const addPaymentMethod = useCallback((m: Omit<SavedPaymentMethod, 'id' | 'createdAt'>): SavedPaymentMethod => {
    const newMethod: SavedPaymentMethod = {
      ...m,
      id: `pm-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setState(prev => {
      let next = prev.savedPaymentMethods;
      if (newMethod.isPrimary) {
        next = next.map(x => (x.companyId === newMethod.companyId && x.type === newMethod.type)
          ? { ...x, isPrimary: false }
          : x);
      }
      return { ...prev, savedPaymentMethods: [...next, newMethod] };
    });
    return newMethod;
  }, []);

  const removePaymentMethod = useCallback((id: string) => {
    setState(prev => {
      const target = prev.savedPaymentMethods.find(m => m.id === id);
      if (!target) return prev;
      const sameTypeForCompany = prev.savedPaymentMethods.filter(m =>
        m.companyId === target.companyId && m.type === target.type
      );
      if (sameTypeForCompany.length <= 1) return prev; // cannot remove only one
      let next = prev.savedPaymentMethods.filter(m => m.id !== id);
      // If removed was primary, promote next by creation date
      if (target.isPrimary) {
        const candidates = next
          .filter(m => m.companyId === target.companyId && m.type === target.type)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const promote = candidates[0];
        if (promote) {
          next = next.map(m => m.id === promote.id ? { ...m, isPrimary: true } : m);
        }
      }
      return { ...prev, savedPaymentMethods: next };
    });
  }, []);

  const setPrimaryPaymentMethod = useCallback((id: string) => {
    setState(prev => {
      const target = prev.savedPaymentMethods.find(m => m.id === id);
      if (!target) return prev;
      return {
        ...prev,
        savedPaymentMethods: prev.savedPaymentMethods.map(m => {
          if (m.companyId !== target.companyId || m.type !== target.type) return m;
          return { ...m, isPrimary: m.id === id };
        }),
      };
    });
  }, []);

  // ============================================================
  // Renewal invoice generator
  // ============================================================
  const _generateRenewalInvoices = useCallback((windowDays: number): number => {
    const today = new Date();
    const windowEnd = new Date(today.getTime() + windowDays * 86400000);
    let created = 0;
    const renewalNotices: Array<{ ownerId: string; subName: string; invoiceNumber: string }> = [];
    setState(prev => {
      const newInvoices: Invoice[] = [];
      prev.subscriptions.forEach(sub => {
        if (sub.status !== 'active') return;
        const renewal = new Date(sub.renewalDate);
        if (renewal <= today || renewal > windowEnd) return;
        const periodKey = `${renewal.getFullYear()}`;
        const alreadyExists = prev.invoices.some(inv =>
          inv.subscriptionId === sub.id &&
          inv.source === 'renewal' &&
          (inv.description?.includes(periodKey) || inv.invoiceNumber.includes(periodKey))
        );
        if (alreadyExists) return;
        const config = prev.companyConfigs.find(c => c.companyId === sub.companyId);
        const status: Invoice['status'] = config?.payOnTermsEnabled ? 'payment_terms_applied' : 'upcoming';
        const baseFee = sub.baseFee ?? 1000;
        const perSeat = sub.perSeatCost ?? 10;
        const subtotal = baseFee + sub.products.reduce(
          (acc, p) => acc + (p.pricePerLicense || perSeat) * p.licenseCount, 0
        );
        const tax = Math.round(subtotal * 0.07 * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;
        const invoiceNumber = `INV-RNW-${periodKey}-${sub.id.slice(-3)}`;
        newInvoices.push({
          id: `inv-renewal-${sub.id}-${periodKey}`,
          invoiceNumber,
          companyId: sub.companyId,
          subscriptionId: sub.id,
          subscriptionName: sub.name,
          date: new Date(renewal.getTime() - 30 * 86400000).toISOString().split('T')[0],
          dueDate: sub.renewalDate,
          amount: total,
          subtotal,
          tax,
          totalAmount: total,
          balance: status === 'payment_terms_applied' ? 0 : total,
          status,
          source: 'renewal',
          invoiceType: 'Renewal Invoice',
          description: `Annual renewal — ${periodKey}`,
          paidAt: null,
          lineItems: [
            { product: 'Base Subscription Fee', quantity: 1, unitPrice: baseFee, total: baseFee },
            ...sub.products.map(p => ({
              product: `${p.name} Seats`,
              quantity: p.licenseCount,
              unitPrice: p.pricePerLicense || perSeat,
              total: (p.pricePerLicense || perSeat) * p.licenseCount,
            })),
          ],
        });
        // Pick an account_owner of the company to notify (first active one)
        const owner = prev.users.find(u =>
          u.companyId === sub.companyId &&
          u.status === 'active' &&
          u.roles.includes('account_owner')
        );
        if (owner) {
          renewalNotices.push({ ownerId: owner.id, subName: sub.name, invoiceNumber });
        }
      });
      if (newInvoices.length === 0) return prev;
      created = newInvoices.length;
      return { ...prev, invoices: [...newInvoices, ...prev.invoices] };
    });
    renewalNotices.forEach(({ ownerId, subName, invoiceNumber }) => {
      notify({
        userId: ownerId,
        type: 'subscription.renewal_upcoming',
        title: 'Subscription renewal coming',
        message: `Your ${subName} renews in approximately 30 days. Renewal invoice ${invoiceNumber} is ready.`,
        link: '/invoices',
        linkLabel: 'View invoice',
      });
    });
    return created;
  }, [notify]);

  const forceGenerateRenewalInvoices = useCallback((): number => {
    return _generateRenewalInvoices(365);
  }, [_generateRenewalInvoices]);

  const getDataNetUpdates = useCallback((): DataNetUpdate[] => {
    return [...state.dataNetUpdates].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [state.dataNetUpdates]);

  // ============================================================
  // Notifications — read helpers (write helpers defined near top so
  // event-emitting methods above can call notify())
  // ============================================================
  const getUserNotifications = useCallback((userId?: string): Notification[] => {
    const id = userId || state.currentUser?.id;
    if (!id) return [];
    return state.notifications
      .filter(n => n.userId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.notifications, state.currentUser]);

  const getUnreadNotificationCount = useCallback((userId?: string): number => {
    const id = userId || state.currentUser?.id;
    if (!id) return 0;
    return state.notifications.filter(n => n.userId === id && !n.readAt).length;
  }, [state.notifications, state.currentUser]);

  const markNotificationRead = useCallback((notificationId: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === notificationId && !n.readAt
          ? { ...n, readAt: new Date().toISOString() }
          : n
      ),
    }));
  }, []);

  const markAllNotificationsRead = useCallback((userId?: string) => {
    setState(prev => {
      const id = userId || prev.currentUser?.id;
      if (!id) return prev;
      const stamp = new Date().toISOString();
      return {
        ...prev,
        notifications: prev.notifications.map(n =>
          n.userId === id && !n.readAt ? { ...n, readAt: stamp } : n
        ),
      };
    });
  }, []);

  // ============================================================
  // Catalog config (per discovery Q5) — maintenance per product + global mode toggle
  // ============================================================
  const getCatalogProduct = useCallback((name: string): CatalogProduct | undefined => {
    return state.catalogProducts.find(p => p.name === name);
  }, [state.catalogProducts]);

  const updateCatalogProductMaintenance = useCallback((name: string, maintenancePerSeatPerYear: number) => {
    setState(prev => ({
      ...prev,
      catalogProducts: prev.catalogProducts.map(p =>
        p.name === name ? { ...p, maintenancePerSeatPerYear } : p
      ),
    }));
  }, []);

  const setUseLegacyProration = useCallback((value: boolean) => {
    setState(prev => ({ ...prev, useLegacyProration: value }));
  }, []);

  // ============================================================
  // Previously-held license reactivation (per discovery Q6 + Q7)
  // ============================================================
  const getDeactivatedLicenses = useCallback((companyId?: string) => {
    const cid = companyId || state.currentCompany?.id;
    if (!cid) return [];
    const subsById = new Map(state.subscriptions.map(s => [s.id, s] as const));
    return state.licenses
      .filter(l => !!l.deactivatedAt)
      .map(license => {
        const subscription = subsById.get(license.subscriptionId);
        const product = subscription?.products.find(p => p.id === license.productId);
        if (!subscription || subscription.companyId !== cid || !product) return null;
        return { license, subscription, product };
      })
      .filter((x): x is { license: License; subscription: Subscription; product: SubscriptionProduct } => x !== null);
  }, [state.licenses, state.subscriptions, state.currentCompany]);

  const reactivateLicense = useCallback((input: {
    subscriptionId: string;
    productId: string;
    licenseAssignedAt: string;
    paymentMethodId?: string;
  }): { invoice: Invoice } | null => {
    const sub = state.subscriptions.find(s => s.id === input.subscriptionId);
    const prod = sub?.products.find(p => p.id === input.productId);
    if (!sub || !prod) return null;
    const target = state.licenses.find(l =>
      l.subscriptionId === input.subscriptionId &&
      l.productId === input.productId &&
      l.assignedAt === input.licenseAssignedAt &&
      !!l.deactivatedAt
    );
    if (!target) return null;

    const today = new Date();
    const catalog = state.catalogProducts.find(c => c.name === prod.name);
    const maintenancePerSeat = catalog?.maintenancePerSeatPerYear ?? 0;
    const totalPerSeat = catalog?.pricePerSeatPerYear ?? prod.pricePerLicense;
    // Reactivation charges ONLY the prorated maintenance portion — the license is
    // already owned. In legacy proration mode the helper returns the full prorated
    // total directly; in the new mode we want just the maintenance portion (license
    // is excluded). We achieve "maintenance-only" by constructing an effective
    // product where total = maintenance — then license portion = 0.
    const proration = calculateProratedAdd({
      product: {
        pricePerSeatPerYear: maintenancePerSeat,
        maintenancePerSeatPerYear: maintenancePerSeat,
      },
      seats: 1,
      addDate: today,
      renewalDate: new Date(sub.renewalDate),
      useLegacyProration: state.useLegacyProration,
    });
    void totalPerSeat;
    const subtotal = proration.totalCharge;
    const tax = Math.round(subtotal * 0.07 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      companyId: sub.companyId,
      invoiceNumber: `INV-RA-${String(7000 + Math.floor(Math.random() * 9000))}`,
      date: today.toISOString().split('T')[0],
      dueDate: today.toISOString().split('T')[0],
      status: 'paid',
      amount: total,
      subtotal,
      tax,
      totalAmount: total,
      balance: 0,
      subscriptionId: sub.id,
      subscriptionName: sub.name,
      invoiceType: 'Adjustment Invoice',
      source: 'license_reactivation',
      paymentMethod: 'pay_immediately',
      paidAt: today.toISOString(),
      description: `License reactivation — ${prod.name}`,
      lineItems: [{
        product: `${prod.name} Reactivation (1 seat)`,
        quantity: 1,
        unitPrice: subtotal,
        total: subtotal,
      }],
    };
    // paymentMethodId is accepted for forward compatibility; the demo settles
    // reactivation invoices as paid-immediately and does not persist the method.
    void input.paymentMethodId;

    setState(prev => ({
      ...prev,
      // Clear the deactivation on this specific license record (matched by assignedAt key).
      licenses: prev.licenses.map(l => {
        if (l.subscriptionId !== input.subscriptionId) return l;
        if (l.productId !== input.productId) return l;
        if (l.assignedAt !== input.licenseAssignedAt) return l;
        if (!l.deactivatedAt) return l;
        const { deactivatedAt: _da, deactivatedReason: _dr, ...rest } = l;
        void _da; void _dr;
        return { ...rest, userId: '' };
      }),
      // Increase the seat count on the subscription's product by 1.
      subscriptions: prev.subscriptions.map(s => s.id === sub.id ? {
        ...s,
        products: s.products.map(p => p.id === prod.id ? {
          ...p,
          licenseCount: p.licenseCount + 1,
          purchasedLicenseCount: (p.purchasedLicenseCount ?? p.licenseCount) + 1,
        } : p),
      } : s),
      invoices: [invoice, ...prev.invoices],
    }));
    return { invoice };
  }, [state.subscriptions, state.licenses, state.catalogProducts, state.useLegacyProration]);

  // Run once on provider mount — simulates a backend cron that emits 30-day-ahead renewal invoices.
  useEffect(() => {
    _generateRenewalInvoices(30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Activate any scheduled seat reductions whose effective date has passed.
  // Lowers licenseCount, drops the deferred ("expire end of year") license assignments,
  // and clears the scheduled-change fields on the product.
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    setState(prev => {
      const toUnassign: { subscriptionId: string; productId: string; userIds: string[] }[] = [];
      let mutated = false;
      const subscriptions = prev.subscriptions.map(sub => {
        const products = sub.products.map(p => {
          if (p.scheduledLicenseCount === undefined || !p.scheduledEffectiveDate) return p;
          if (p.scheduledEffectiveDate > todayStr) return p;
          mutated = true;
          const expireIds = p.scheduledUnassignedUserIds || [];
          if (expireIds.length) {
            toUnassign.push({ subscriptionId: sub.id, productId: p.id, userIds: expireIds });
          }
          return {
            ...p,
            licenseCount: p.scheduledLicenseCount,
            scheduledLicenseCount: undefined,
            scheduledEffectiveDate: undefined,
            scheduledUnassignedUserIds: undefined,
          };
        });
        return products === sub.products ? sub : { ...sub, products };
      });
      if (!mutated) return prev;
      const licenses = prev.licenses.filter(l => !toUnassign.some(t =>
        t.subscriptionId === l.subscriptionId &&
        t.productId === l.productId &&
        t.userIds.includes(l.userId)
      ));
      return { ...prev, subscriptions, licenses };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-escalate active subscriptions to suspended when their renewal date has passed,
  // an unpaid renewal invoice exists, and the company is NOT on Pay-on-Terms.
  useEffect(() => {
    const today = new Date();
    const suspensionNotices: Array<{ ownerId: string; subName: string }> = [];
    setState(prev => {
      let mutated = false;
      const nextSubs = prev.subscriptions.map(sub => {
        if (sub.status !== 'active') return sub;
        const renewal = new Date(sub.renewalDate);
        if (renewal > today) return sub;
        const cfg = prev.companyConfigs.find(c => c.companyId === sub.companyId);
        if (cfg?.payOnTermsEnabled) return sub;
        const unpaidRenewal = prev.invoices.find(
          i => i.subscriptionId === sub.id && i.source === 'renewal' && i.status !== 'paid'
        );
        if (!unpaidRenewal) return sub;
        const owner = prev.users.find(u =>
          u.companyId === sub.companyId &&
          u.status === 'active' &&
          u.roles.includes('account_owner')
        );
        if (owner) suspensionNotices.push({ ownerId: owner.id, subName: sub.name });
        mutated = true;
        return { ...sub, status: 'suspended' as const };
      });
      if (!mutated) return prev;
      return { ...prev, subscriptions: nextSubs };
    });
    suspensionNotices.forEach(({ ownerId, subName }) => {
      notify({
        userId: ownerId,
        type: 'subscription.suspended',
        title: 'Subscription suspended',
        message: `Your ${subName} has been suspended due to an unpaid renewal invoice. Pay to restore access.`,
        link: '/invoices',
        linkLabel: 'View invoices',
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppContext.Provider value={{
      ...state,
      login,
      logout,
      selectCompany,
      updateCompany,
      updateCompanyBillingDetails,
      setAutoRenewal,
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
      renameSubscription,
      updateWizardData,
      completeSignup,
      createAccount,
      createTicket,
      getEffectiveRoles,
      hasAccess,
      can,
      isReadOnlyMode,
      isSuspendedMode,
      forceSuspendCurrentSubscription,
      restoreActiveSubscription,
      getCurrentUserTrialLicenses,
      isUsernameTaken,
      getUserCompanies,
      getCompanyUsers,
      getCompanySubscriptions,
      getCompanyInvoices,
      getCompanyTickets,
      getCompanyQuotes,
      getCompanyQuoteRequests,
      createQuote,
      cancelQuoteRequest,
      approvePendingQuoteRequests,
      acceptQuote,
      declineQuote,
      addQuoteRequest,
      getCompanyConfig,
      updateCompanyConfig,
      getAvailablePaymentMethods,
      requestLicenseChange,
      scheduleLicenseDecrease,
      applyLicenseReduction,
      markInvoicePaid,
      setInvoicePoNumber,
      checkoutPurchase,
      renewSubscription,
      getCompanyPaymentMethods,
      getUserPaymentMethods,
      addPaymentMethod,
      removePaymentMethod,
      setPrimaryPaymentMethod,
      forceGenerateRenewalInvoices,
      getDataNetUpdates,
      hasPaidInvoice,
      hasSentQuote,
      hasDeclinedQuote,
      isFirstTimeCustomer,
      notify,
      getUserNotifications,
      getUnreadNotificationCount,
      markNotificationRead,
      markAllNotificationsRead,
      getUserNotificationPrefs,
      updateUserNotificationPrefs,
      resetUserNotificationPrefs,
      getCatalogProduct,
      updateCatalogProductMaintenance,
      setUseLegacyProration,
      getDeactivatedLicenses,
      reactivateLicense,
    }}>
      {children}
    </AppContext.Provider>
  );
};
