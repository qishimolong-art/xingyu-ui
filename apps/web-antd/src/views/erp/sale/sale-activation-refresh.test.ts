import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

const salePages = [
  {
    apiCall: 'getSaleCartPage',
    maskClass: 'sale-cart-activation-mask',
    name: 'sale cart',
    path: 'cart/index.vue',
    refreshFunction: 'refreshActivatedSaleCartPage',
  },
  {
    apiCall: 'getSaleOrderPage',
    maskClass: 'sale-order-activation-mask',
    name: 'sale order',
    path: 'order/index.vue',
    refreshFunction: 'refreshActivatedSaleOrderPage',
  },
  {
    apiCall: 'getSaleOutPage',
    maskClass: 'sale-out-activation-mask',
    name: 'sale out',
    path: 'out/index.vue',
    refreshFunction: 'refreshActivatedSaleOutPage',
  },
  {
    apiCall: 'getSaleReturnPage',
    maskClass: 'sale-return-activation-mask',
    name: 'sale return',
    path: 'return/index.vue',
    refreshFunction: 'refreshActivatedSaleReturnPage',
  },
  {
    apiCall: 'getSaleQuotePage',
    maskClass: 'sale-quote-activation-mask',
    name: 'sale quote',
    path: 'quote/index.vue',
    refreshFunction: 'refreshActivatedSaleQuotePage',
  },
  {
    apiCall: 'getSalePriceAdjustPage',
    maskClass: 'sale-price-adjust-activation-mask',
    name: 'sale price adjust',
    path: 'priceadjust/index.vue',
    refreshFunction: 'refreshActivatedSalePriceAdjustPage',
  },
  {
    apiCall: 'getCustomerPage',
    maskClass: 'customer-activation-mask',
    name: 'customer',
    path: 'customer/index.vue',
    refreshFunction: 'refreshActivatedCustomerPage',
  },
  {
    apiCall: 'getSaleConfigPage',
    maskClass: 'sale-config-activation-mask',
    name: 'sale config',
    path: 'config/index.vue',
    refreshFunction: 'refreshActivatedSaleConfigPage',
  },
];

function readSalePage(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

describe('sale activation refresh', () => {
  it.each(salePages)(
    'keeps $name data visible while refreshing on tab activation',
    ({ apiCall, maskClass, path, refreshFunction }) => {
      const source = readSalePage(path);
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
      expect(activatedStart).toBeGreaterThan(refreshStart);
      expect(refreshSource).toContain(
        'activationRefreshMaskVisible.value = true;',
      );
      expect(refreshSource).toContain('await nextTick();');
      expect(refreshSource.match(/await waitForFrame\(\);/g)?.length).toBe(2);
      expect(refreshSource).toContain(apiCall);
      expect(refreshSource).toContain('await gridApi.grid?.loadData?.(rows);');
      expect(refreshSource).not.toContain('gridApi.query()');
    },
  );

  it('preserves page-specific row transforms during activation refresh', () => {
    const priceAdjustSource = readSalePage('priceadjust/index.vue');
    const customerSource = readSalePage('customer/index.vue');
    const configSource = readSalePage('config/index.vue');

    expect(priceAdjustSource).toContain('normalizePriceAdjustListRow');
    expect(customerSource).toContain('mapCustomerDisplayFields(item)');
    expect(configSource).toContain('configType: activeConfigType.value');
  });

  it('keeps sale config grid stretched to the page content height', () => {
    const configSource = readSalePage('config/index.vue');

    expect(configSource).toContain("gridClass: 'sale-config-vxe-grid'");
    expect(configSource).toContain("height: '100%'");
    expect(configSource).toContain(
      '.sale-config-grid-shell :deep(.sale-config-vxe-grid)',
    );
    expect(configSource).toContain('height: 100% !important;');
  });
});
