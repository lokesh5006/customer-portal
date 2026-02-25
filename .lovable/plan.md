

# Multi-Subscription & Multi-Product Model -- Implementation Plan

This is a major structural overhaul of the entire prototype. The current model assumes one subscription = one product. The new model introduces: Customer → Multiple Subscriptions → Multiple Products per Subscription → Licenses per Product.

---

## Phase 1: Data Model Refactor (AppContext.tsx)

### New Type Definitions

Replace the flat `Subscription` type with a nested structure:

```text
SubscriptionProduct {
  id: string
  name: string
  licenseCount: number
  pricePerLicense: number
  status: 'active' | 'pending' | 'expired'
}

Subscription {
  id: string
  companyId: string
  name: string              // e.g. "2026 Annual Plan"
  planType: string          // e.g. "Annual", "Add-on", "Promo"
  billingFrequency: 'annual' | 'monthly'
  status: 'active' | 'cancelled' | 'pending' | 'expired'
  startDate: string
  renewalDate: string
  products: SubscriptionProduct[]
}
```

Update `License` to reference `subscriptionId` + `productId`:
```text
License {
  userId: string
  subscriptionId: string
  productId: string
  assignedAt: string
}
```

Update `Invoice` to include `subscriptionId` and product-level line items:
```text
Invoice {
  ...existing fields
  subscriptionId: string
  subscriptionName: string
  lineItems: { product: string; quantity: number; unitPrice: number; proration?: number; total: number }[]
}
```

Update `wizardData` to support multi-product selection:
```text
wizardData {
  ...existing fields
  selectedSubscriptionPlan: string
  selectedProducts: { productName: string; licenseCount: number }[]
}
```

### New Sample Data

**Subscription 1** (company-1): "2026 Annual Plan"
- NumberCruncher Web: 10 licenses, $249/seat
- Desktop Add-on: 5 licenses, $149/seat

**Subscription 2** (company-1): "Tax Add-on Plan"
- Rate Module: 3 licenses, $99/seat

**Subscription** (company-2): "2026 Annual Plan"
- NumberCruncher Web: 8 licenses, $249/seat

Licenses distributed across users accordingly. Invoices updated with subscriptionId and product-level line items.

### Updated Context Methods

- `getAssignedLicenseCount(subscriptionId, productId)` -- now requires both params
- `assignLicense(userId, subscriptionId, productId)` -- updated signature
- `unassignLicense(userId, subscriptionId, productId)` -- updated signature
- `bulkUnassignLicenses(userIds, subscriptionId, productId)` -- updated signature
- `updateProductLicenseCount(subscriptionId, productId, newCount)` -- replaces updateSubscriptionSeats
- `getUserAssignedProducts(userId)` -- returns `{subscriptionId, subscriptionName, productId, productName}[]`
- New: `addSubscription(subscription)`, `addProductToSubscription(subscriptionId, product)`

---

## Phase 2: Dashboard Changes (6 files)

### A. New: SubscriptionOverviewWidget
Replace `SubscriptionSummaryWidget` with an expandable card per subscription. Each card shows subscription name, status, billing cycle, renewal date, product count, total licenses. Expandable section shows a product table with columns: Product Name | Purchased | Assigned | Available | Status. CTAs: Manage Subscription, Manage Licenses, View Invoice.

### B. Update: BillingStatusWidget / PaymentHistoryWidget
Group invoices by subscription. Add "Subscription Name" and "Products Included" columns.

### C. New: LicenseUtilizationSummaryWidget
Replace `LicenseUtilizationWidget` with a table view: Subscription | Product | Total | Assigned | Available.

### D. Update: QuickActionsWidget
Replace buttons with: Buy New Subscription, Add Product to Existing Subscription, Increase Licenses, Pay Invoice.

### E. Update: AssignedProductsWidget (standard users)
Show products assigned to current user grouped by subscription.

### F. Update: Dashboard.tsx layout
Restructure widget grid for all role dashboards to use new widgets.

---

## Phase 3: Subscription Page Overhaul

### Listing Page
New columns: Subscription Name | Start Date | Renewal Date | Status | Total Products | Total Licenses | Actions.

Actions dropdown: View Details, Add Product, Increase License (per product), Reduce License (per product), Cancel Subscription (owner only).

### Subscription Detail Modal → Full Detail View
Show subscription info section + Products table: Product Name | License Count | Assigned | Available | Price/License | Total Price | Actions (Increase, Reduce, View Assigned Users per product).

### New: Add Product Modal
Select from available products catalog, set license count, confirm.

---

## Phase 4: License Page Overhaul

### Structure Change
Replace flat user list with expandable subscription → product hierarchy.

Top level: subscription cards (collapsible). Inside each: product rows. Clicking a product shows user assignment table with toggle switches.

Summary cards update dynamically based on selected subscription + product.

### Filters
Add: Subscription filter, Product filter (in addition to existing).

---

## Phase 5: Users Page Changes

### New Column: Products Assigned
Show hierarchical display: "2026 Annual → NumberCruncher Web, Desktop Add-on".

### User Detail Modal Update
Add "Product License Assignment" section showing subscription → product → checkbox structure. Disable checkbox + tooltip when license limit reached.

---

## Phase 6: Billing/Invoice Page Changes

### Invoice List
Add columns: Subscription Name, Products Included.

### Invoice Detail Modal
Show subscription name at top. Line items table: Product | Quantity | Unit Price | Proration | Total.

---

## Phase 7: Signup Wizard Overhaul

### Updated Steps
1. Company Setup (unchanged)
2. Select Subscription Plan (new: choose plan type)
3. Select Products (new: multi-select from product catalog with checkboxes)
4. License Quantity per Product (new: quantity selector per selected product)
5. Review Summary (updated: show subscription → products → licenses hierarchy)
6. Payment (unchanged logic)
7. Invite Users (unchanged)
8. Assign Licenses per Product (updated: show product-level assignment)

### completeSignup() Update
Create subscription with nested products, create licenses per product, create invoice with product line items.

---

## Phase 8: License Reduction Page Update

### Updated Flow
Receives `subscriptionId` + `productId` (not just product name). Shows users assigned to that specific product under that subscription. Same unassign flow but scoped to subscription + product.

---

## Phase 9: Role-Based Visibility Updates

All new UI elements respect existing role checks:
- **Owner**: Full access to create subscriptions, add products, change billing
- **Billing**: Can modify subscriptions, cannot assign licenses
- **Admin**: Can assign product licenses, cannot change billing
- **Standard**: Can only see their assigned products, no subscription structure visibility

---

## Phase 10: Filter Updates Across All Listing Pages

Add Subscription and Product filter dropdowns to:
- Subscriptions page (already has status)
- Licenses page
- Users page
- Billing page

---

## Files to Create
- `src/components/dashboard/SubscriptionOverviewWidget.tsx` (new)
- `src/components/dashboard/LicenseUtilizationSummaryWidget.tsx` (new)
- `src/components/dashboard/OutstandingInvoicesWidget.tsx` (new)

## Files to Modify (major changes)
- `src/contexts/AppContext.tsx` -- complete data model refactor
- `src/pages/Dashboard.tsx` -- new widget layout
- `src/pages/SubscriptionsPage.tsx` -- full overhaul
- `src/pages/LicensesPage.tsx` -- full overhaul
- `src/pages/UsersPage.tsx` -- add products assigned column + detail section
- `src/pages/BillingPage.tsx` -- add subscription/product columns + detail update
- `src/pages/SignupWizard.tsx` -- multi-product selection flow
- `src/pages/LicenseReductionPage.tsx` -- scope to subscription + product
- `src/components/dashboard/QuickActionsWidget.tsx` -- new action buttons
- `src/components/dashboard/AssignedProductsWidget.tsx` -- grouped by subscription
- `src/components/dashboard/MyTicketsWidget.tsx` -- minor updates
- `src/components/dashboard/PaymentHistoryWidget.tsx` -- add subscription grouping

## Files to Delete
- `src/components/dashboard/SubscriptionSummaryWidget.tsx` (replaced)
- `src/components/dashboard/LicenseUtilizationWidget.tsx` (replaced)

---

## Implementation Order

Due to the size of this change, implementation will proceed in this order:
1. AppContext data model + sample data (foundation for everything)
2. Dashboard widgets (most visible, validates data model)
3. Subscriptions page
4. Licenses page
5. Users page
6. Billing page
7. Signup wizard
8. License reduction page

Each phase will be implemented to compile and render correctly before moving to the next.

