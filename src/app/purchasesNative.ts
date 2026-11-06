import { ErrorCode, finishTransaction, getAvailablePurchases, fetchProducts, initConnection, purchaseErrorListener, purchaseUpdatedListener, requestPurchase } from 'expo-iap';
import type { PurchaseResult, PurchaseService } from '../core/store';
import { TUNING } from '../core/tuning';

const SKU = TUNING.unlockProductId;

/** Real store implementation (App Store / Google Play) on expo-iap. Non-consumable `hummlings.unlock_all`. */
export class StorePurchases implements PurchaseService {
  private connected = false;
  async init(): Promise<void> {
    if (this.connected) return;
    try { await initConnection(); this.connected = true; } catch { this.connected = false; }
  }
  async getPrice(): Promise<string | null> {
    try {
      await this.init();
      const products = await fetchProducts({ skus: [SKU], type: 'in-app' });
      const p = products?.[0];
      return p ? p.displayPrice : null;
    } catch { return null; }
  }
  buy(): Promise<PurchaseResult> {
    return new Promise<PurchaseResult>((resolve) => {
      let done = false;
      const finish = (r: PurchaseResult) => { if (done) return; done = true; u.remove(); e.remove(); resolve(r); };
      const u = purchaseUpdatedListener((purchase) => {
        if (purchase.productId !== SKU) return;
        void finishTransaction({ purchase, isConsumable: false }).finally(() => finish('purchased'));
      });
      const e = purchaseErrorListener((err) => finish(err.code === ErrorCode.UserCancelled ? 'cancelled' : err.code === ErrorCode.Pending ? 'pending' : 'failed'));
      void this.init().then(() => requestPurchase({ type: 'in-app', request: { apple: { sku: SKU }, google: { skus: [SKU] } } })).catch(() => finish('failed'));
    });
  }
  async restore(): Promise<boolean> {
    try { await this.init(); return (await getAvailablePurchases()).some((p) => p.productId === SKU); } catch { return false; }
  }
  /** Null when the store cannot be reached: the cached entitlement then stays (works offline once purchased). */
  async hasEntitlement(): Promise<boolean | null> {
    try {
      await this.init();
      if (!this.connected) return null;
      return (await getAvailablePurchases()).some((p) => p.productId === SKU);
    } catch { return null; }
  }
}
