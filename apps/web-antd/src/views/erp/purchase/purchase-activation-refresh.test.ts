import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

const purchasePages = [
  {
    apiCall: 'getPurchaseOrderPage',
    maskClass: 'purchase-order-activation-mask',
    name: 'purchase order',
    path: 'order/index.vue',
    refreshFunction: 'refreshActivatedPurchaseOrderPage',
  },
  {
    apiCall: 'getPurchaseInPage',
    maskClass: 'purchase-in-activation-mask',
    name: 'purchase in',
    path: 'in/index.vue',
    refreshFunction: 'refreshActivatedPurchaseInPage',
  },
  {
    apiCall: 'getPurchaseReturnPage',
    maskClass: 'purchase-return-activation-mask',
    name: 'purchase return',
    path: 'return/index.vue',
    refreshFunction: 'refreshActivatedPurchaseReturnPage',
  },
  {
    apiCall: 'getPurchaseInvoicePage',
    maskClass: 'purchase-invoice-activation-mask',
    name: 'purchase invoice',
    path: 'invoice/index.vue',
    refreshFunction: 'refreshActivatedPurchaseInvoicePage',
  },
  {
    apiCall: 'getPurchasePriceAdjustPage',
    maskClass: 'purchase-price-adjust-activation-mask',
    name: 'purchase price adjust',
    path: 'priceadjust/index.vue',
    refreshFunction: 'refreshActivatedPurchasePriceAdjustPage',
  },
  {
    apiCall: 'getStockInBillPage',
    maskClass: 'stock-in-bill-activation-mask',
    name: 'stock in bill',
    path: 'inbill/index.vue',
    refreshFunction: 'refreshActivatedStockInBillPage',
  },
  {
    apiCall: 'getSupplierPage',
    maskClass: 'supplier-activation-mask',
    name: 'supplier',
    path: 'supplier/index.vue',
    refreshFunction: 'refreshActivatedSupplierPage',
  },
  {
    apiCall: 'getProductPage',
    maskClass: 'parts-price-adjust-activation-mask',
    name: 'parts price adjust',
    path: 'price-adjust/index.vue',
    refreshFunction: 'refreshActivatedPartsPriceAdjustPage',
  },
];

function readPurchasePage(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

describe('purchase activation refresh', () => {
  it.each(purchasePages)(
    'keeps $name data visible while refreshing on tab activation',
    ({ apiCall, maskClass, path, refreshFunction }) => {
      const source = readPurchasePage(path);
      const refreshStart = source.indexOf(
        `async function ${refreshFunction}()`,
      );
      const activatedStart = source.indexOf('onActivated(() =>', refreshStart);
      const refreshSource = source.slice(refreshStart, activatedStart);

      expect(source).toContain('onActivated(() =>');
      expect(source).toContain('let activatedOnce = false;');
      expect(source).toContain('let activationRefreshVersion = 0;');
      expect(source).toContain(
        'const activationRefreshMaskVisible = ref(false);',
      );
      expect(source).toContain(`class="${maskClass}"`);
      expect(source).toContain('<Spin size="small" />');
      expect(source).toContain('v-if="activationRefreshMaskVisible"');

      expect(refreshStart).toBeGreaterThan(-1);
      expect(refreshSource).toContain(
        'activationRefreshMaskVisible.value = true;',
      );
      expect(refreshSource).toContain('await nextTick();');
      expect(refreshSource).toContain('await waitForFrame();');
      expect(refreshSource).toContain(apiCall);
      expect(refreshSource).toContain('await gridApi.grid?.loadData?.(rows);');
      expect(refreshSource).not.toContain('gridApi.query()');
    },
  );
});
