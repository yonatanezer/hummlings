import { Platform } from 'react-native';
import type { PurchaseResult, PurchaseService } from '../core/store';

/** Dev/web mock: purchase always succeeds after a short delay. */
export class MockPurchases implements PurchaseService {
  private owned = false;
  async init() {}
  async getPrice() { return '$3.99'; }
  async buy(): Promise<PurchaseResult> { await new Promise((r) => setTimeout(r, 600)); this.owned = true; return 'purchased'; }
  async restore() { return this.owned; }
  async hasEntitlement() { return null; } // mock cannot tell: keep the cached value
}

let svc: PurchaseService | null = null;
export function getPurchases(): PurchaseService {
  if (!svc) {
    if (Platform.OS === 'web' || __DEV__) svc = new MockPurchases(); // dev builds use the mock store
    else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- native module loaded only in release builds
      const { StorePurchases } = require('./purchasesNative') as typeof import('./purchasesNative');
      svc = new StorePurchases();
    }
  }
  return svc;
}
