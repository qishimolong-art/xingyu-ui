import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const saleRoot = join(import.meta.dirname);
const webRoot = join(saleRoot, '../../..');

function readSaleFile(path: string) {
  return readFileSync(join(saleRoot, path), 'utf8');
}

function readWebFile(path: string) {
  return readFileSync(join(webRoot, path), 'utf8');
}

function detailBranch(source: string) {
  const start = source.indexOf('async function loadDetailData(');
  expect(start).toBeGreaterThanOrEqual(0);
  const tail = source.slice(start);
  const nextModal = tail.indexOf('const [Modal, modalApi]');
  return nextModal >= 0 ? tail.slice(0, nextModal) : tail;
}

describe('sale customer price level permission flow', () => {
  it('keeps customer price level in the shared field-permission cache key and watcher', () => {
    const source = readWebFile('composables/useFieldPermission.ts');

    expect(source).toContain('customerPriceLevel?: number | string | null');
    expect(source).toContain('customerPriceLevel=${customerPriceLevel}');
    expect(source).toContain('unref(options.customerPriceLevel)');
    expect(source).toContain('getCurrentUserHiddenFields(');
  });

  it('passes customer price level into every sale document field-permission loader', () => {
    const customerApiSource = readWebFile('api/erp/sale/customer/index.ts');

    expect(customerApiSource).toContain('getCustomerSalePriceLevel');
    expect(customerApiSource).toContain('/erp/customer/sale-price-level');

    [
      'quote/modules/form.vue',
      'cart/modules/form.vue',
      'order/modules/form.vue',
      'out/modules/form.vue',
      'return/modules/form.vue',
      'priceadjust/modules/form.vue',
    ].forEach((path) => {
      const source = readSaleFile(path);

      expect(source).toContain('currentCustomerPriceLevel');
      expect(source).toContain(
        '{ customerPriceLevel: currentCustomerPriceLevel }',
      );
      expect(source).toContain('async function loadCustomerPriceLevel');
      expect(source).toContain('getCustomerSalePriceLevel');
      expect(source).not.toContain('await getCustomer(customerId)');
    });
  });

  it('hydrates detail customer context before or during detail permission refresh', () => {
    const cartDetail = detailBranch(readSaleFile('cart/modules/form.vue'));
    expect(cartDetail).toContain(
      'await loadCustomerPriceLevel(formData.value?.customerId);',
    );
    expect(cartDetail).toContain(
      'await loadHiddenFields(undefined, true, currentCustomerPriceLevel.value);',
    );

    const outSource = readSaleFile('out/modules/form.vue');
    expect(
      outSource.indexOf('await loadCustomerPriceLevel(sourceData.customerId);'),
    ).toBeLessThan(outSource.indexOf('await loadHiddenFields();'));

    const quoteSource = readSaleFile('quote/modules/form.vue');
    expect(detailBranch(quoteSource)).toContain(
      'await loadCustomerPriceLevel(formData.value.customerId);',
    );

    const orderSource = readSaleFile('order/modules/form.vue');
    expect(orderSource).toContain(
      'formData.value = await getSaleOrder(data.id, {',
    );
    expect(orderSource).toContain(
      'await loadCustomerPriceLevel(formData.value.customerId);',
    );

    const returnSource = readSaleFile('return/modules/form.vue');
    expect(returnSource).toContain('await getSaleReturn(data.id, {');
    expect(returnSource).toContain('void loadCustomerPriceLevel(customerId);');

    expect(
      detailBranch(readSaleFile('priceadjust/modules/form.vue')),
    ).toContain('currentCustomerId.value = formData.value.customerId;');
  });

  it('reloads item columns when hidden fields change after customer price level resolves', () => {
    [
      'quote/modules/item-form.vue',
      'cart/modules/item-form.vue',
      'order/modules/item-form.vue',
      'return/modules/item-form.vue',
      'priceadjust/modules/item-form.vue',
    ].forEach((path) => {
      const moduleName = path.slice(0, path.indexOf('/'));
      const source = `${readSaleFile(path)}\n${readSaleFile(`${moduleName}/data.ts`)}`;

      expect(source).toContain('props.hiddenFields');
      expect(source).toContain('reloadColumn');
      expect(source).toContain('isSalePriceItemHidden');
    });
  });
});
