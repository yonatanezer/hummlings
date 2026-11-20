export type PurchaseResult = 'purchased' | 'pending' | 'cancelled' | 'failed';

/** Store access sits behind this interface; the mock is used in dev/web, the real one in preview/production builds. */
export interface PurchaseService {
  init(): Promise<void>;
  /** Localised price string from the store, or null when unavailable (offline). */
  getPrice(): Promise<string | null>;
  buy(): Promise<PurchaseResult>;
  /** Returns true when the unlock entitlement was found. */
  restore(): Promise<boolean>;
  /** True if the store currently reports the entitlement (used at launch to re-lock refunded purchases). Null = cannot tell (offline). */
  hasEntitlement(): Promise<boolean | null>;
}
