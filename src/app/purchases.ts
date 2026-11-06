import type { PurchaseResult, PurchaseService } from '../core/store';

/** Dev/web mock: purchase always succeeds after a short delay. */
export class MockPurchases implements PurchaseService {
  private owned = false;
  async init() {}
  async getPrice() { return '$3.99'; }
  async buy(): Promise<PurchaseResult> { await new Promise((r) => setTimeout(r, 600)); this.owned = true; return 'purchased'; }
  async restore() { return this.owned; }
  async hasEntitlement() { return this.owned; }
}

let svc: PurchaseService | null = null;
export function getPurchases(): PurchaseService {
  if (!svc) svc = new MockPurchases();
  return svc;
}
