// Proration math for license / maintenance pricing model.
//
// Pricing model (per discovery Q1):
// - Each catalog product has a TOTAL price and a MAINTENANCE portion.
// - License portion = total − maintenance (perpetual; charged in full on add).
// - Maintenance portion is the annual service fee (prorated by day on add).
// - Renewal charges the maintenance portion only (license already owned).
//
// The customer-facing UI shows ONE total per line item; the split is internal.

const DAYS_IN_YEAR = 365;

export interface CatalogProductLike {
  /** Total price per seat per year (license + maintenance). */
  pricePerSeatPerYear: number;
  /** Maintenance portion per seat per year. */
  maintenancePerSeatPerYear: number;
}

export interface ProratedAddCharge {
  seats: number;
  daysRemaining: number;
  /** FULL license portion × seats (no proration). Zero in legacy mode. */
  licenseCharge: number;
  /** (days/365) × maintenance × seats. Zero in legacy mode. */
  maintenanceChargeProrated: number;
  /** Customer-facing total per line item. */
  totalCharge: number;
}

export function calculateProratedAdd(input: {
  product: CatalogProductLike;
  seats: number;
  addDate: Date;
  renewalDate: Date;
  /** Falls back to flat proration on the TOTAL price. */
  useLegacyProration?: boolean;
}): ProratedAddCharge {
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (input.renewalDate.getTime() - input.addDate.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  if (input.useLegacyProration) {
    const totalPerSeat = input.product.pricePerSeatPerYear;
    const prorated = (daysRemaining / DAYS_IN_YEAR) * totalPerSeat * input.seats;
    return {
      seats: input.seats,
      daysRemaining,
      licenseCharge: 0,
      maintenanceChargeProrated: 0,
      totalCharge: Math.round(prorated * 100) / 100,
    };
  }

  const totalPerSeat = input.product.pricePerSeatPerYear;
  const maintenancePerSeat = input.product.maintenancePerSeatPerYear;
  const licensePerSeat = totalPerSeat - maintenancePerSeat;
  const licenseCharge = licensePerSeat * input.seats;
  const maintenanceChargeProrated =
    (daysRemaining / DAYS_IN_YEAR) * maintenancePerSeat * input.seats;
  return {
    seats: input.seats,
    daysRemaining,
    licenseCharge: Math.round(licenseCharge * 100) / 100,
    maintenanceChargeProrated: Math.round(maintenanceChargeProrated * 100) / 100,
    totalCharge:
      Math.round((licenseCharge + maintenanceChargeProrated) * 100) / 100,
  };
}

export function calculateRenewalCharge(input: {
  product: CatalogProductLike;
  seats: number;
}): number {
  return (
    Math.round(input.product.maintenancePerSeatPerYear * input.seats * 100) / 100
  );
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(
    0,
    Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)),
  );
}
