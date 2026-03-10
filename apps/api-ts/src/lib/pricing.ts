/**
 * Pricing Table v1 — Internal conversion from IDR to credits.
 *
 * User pays in IDR, system converts to credits internally.
 * Ledger remains credit-based. Pricing can change without engine changes.
 */

export interface PricingTier {
    product: string;
    label: string;
    amountIdr: number;
    credits: number;
}

/**
 * v1 pricing table. Config-driven, not hardcoded in multiple places.
 */
export const PRICING_TABLE: PricingTier[] = [
    { product: 'sd_semester', label: 'SD Semester', amountIdr: 59000, credits: 20 },
    // Future:
    // { product: 'smp_mapel_semester', label: 'SMP Mapel Semester', amountIdr: 49000, credits: 15 },
    // { product: 'sma_mapel_semester', label: 'SMA Mapel Semester', amountIdr: 59000, credits: 18 },
];

/**
 * SD full semester generation cost in credits.
 */
export const SD_FULL_SEMESTER_COST = 5;

/**
 * Administration bundle document costs (in credits).
 */
export const ATP_COST = 1;
export const PROTA_COST = 1;
export const PROMES_COST = 1;
/** Per-topic modul ajar cost within a bundle — reuses SD_FULL_SEMESTER_COST. */
export const BUNDLE_MODUL_COST = SD_FULL_SEMESTER_COST;


/**
 * Look up credits for an IDR amount.
 * Returns the matching tier or null if no exact match.
 */
export function idrToCredits(amountIdr: number): PricingTier | null {
    return PRICING_TABLE.find(t => t.amountIdr === amountIdr) || null;
}

/**
 * Get default SD semester tier.
 */
export function getDefaultTier(): PricingTier {
    return PRICING_TABLE[0];
}
