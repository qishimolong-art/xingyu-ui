import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(
  join(currentDir, 'purchase-in-to-sale-cart-form.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/purchase/in/index.ts'),
  'utf8',
);
const whitespaceFreeFormSource = formSource.replace(/\s+/g, '');

describe('purchase in to sale cart form', () => {
  it('formats the editable conversion quantity without meaningless trailing zeros', () => {
    expect(formSource).toContain(
      "import { formatPurchaseInCountInput } from './purchase-in-count-input';",
    );
    expect(formSource).toContain(':formatter="formatPurchaseInCountInput"');
    expect(formSource).toContain(':precision="3"');
    expect(formSource).toContain(':max="record.saleCartableCount"');
  });

  it('formats the source inbound timestamp as a common date time', () => {
    expect(formSource).toContain('formatDateTime,');
    expect(formSource).toContain(
      "{{ formatDateTime(sourcePurchaseIn?.inTime) || '-' }}",
    );
    expect(formSource).not.toContain("{{ sourcePurchaseIn?.inTime || '-' }}");
  });

  it('loads price level options filtered by current user price permissions', () => {
    expect(formSource).toContain("getBaseDataSimpleList('price_level')");
    expect(formSource).toContain(
      "getCurrentUserHiddenFields('erp_product', deptId.value)",
    );
    expect(formSource).toContain('mapVisibleSelectablePriceLevelOptions');
    expect(formSource).toContain('const priceLevelOptions = ref');
    expect(formSource).toContain('loadOrderPriceCustomFieldNames');
    expect(formSource).toContain('价格体系');
    expect(formSource).toContain('v-model:value="selectedPriceLevel"');
    expect(formSource).not.toContain('getPriceSystemSimpleList');
  });

  it('defaults the modal price level from the selected customer', () => {
    expect(formSource).toContain('function resolveCustomerPriceLevel');
    expect(formSource).toContain(
      'customerPriceLevel.value = await resolveCustomerPriceLevel(value);',
    );
    expect(formSource).toContain('cachedCustomer?.priceLevel !== undefined');
    expect(formSource).toContain('getCustomerSalePriceLevel(value)');
  });

  it('manually selected price level overrides cached rows', () => {
    expect(formSource).toContain('function handlePriceLevelChange');
    expect(formSource).toContain('selectedPriceLevel.value = typeof value ===');
    expect(formSource).toContain('applyPriceLevelToRows();');
    expect(formSource).toContain(
      'selectedPriceLevel.value ?? customerPriceLevel.value',
    );
    expect(formSource).not.toContain('getPriceSystemProductPriceMap');
    expect(formSource).toContain('pickCustomerLevelPrice');
  });

  it('keeps gift rows at zero and refills price when gift is cancelled', () => {
    expect(formSource).toContain(':disabled="record.giftFlag"');
    expect(whitespaceFreeFormSource).toContain(
      '@change="record.productPrice=record.giftFlag?0:pickCurrentProductPrice(record)"',
    );
  });

  it('submits final product prices without persisting the temporary price level', () => {
    expect(formSource).toContain(
      'productPrice: row.giftFlag ? 0 : normalizeCount(row.productPrice)',
    );
    expect(formSource).not.toContain('priceLevel: currentPriceLevel');
    expect(formSource).not.toContain('priceSystemId: currentPriceSystemId');
  });

  it('uses the paged sale-cartable endpoint instead of loading all rows', () => {
    expect(formSource).toContain(
      'getPurchaseIn(sourceId, { includeItems: false })',
    );
    expect(formSource).toContain('getPurchaseInSaleCartableItemPage');
    expect(apiSource).toContain("'/erp/purchase-in/sale-cartable-item-page'");
    expect(apiSource).toContain('minPrice?: number;');
    expect(apiSource).toContain('sharePrice?: number;');
    expect(apiSource).toContain('customFields?: Record<string, any>;');
    expect(formSource).not.toContain('getPurchaseInSaleCartableItems');
  });

  it('defaults to ten rows per page and exposes the agreed page-size choices', () => {
    expect(formSource).toContain('const DEFAULT_ITEM_PAGE_SIZE = 10');
    expect(formSource).toContain(
      "const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100']",
    );
    expect(formSource).toContain(':page-size-options="ITEM_PAGE_SIZE_OPTIONS"');
  });

  it('does not auto-select rows after loading a page', () => {
    expect(formSource).toContain('selectedRowKeys.value = [];');
    expect(formSource).not.toContain(
      'selectedRowKeys.value = rows.value.map(getRowKey)',
    );
  });

  it('keeps selected and edited rows in a cross-page cache', () => {
    expect(formSource).toContain(
      'const rowCache = ref<Map<string, SaleCartRow>>(new Map())',
    );
    expect(formSource).toContain('rowCache.value.set(key, row);');
    expect(formSource).toContain('rowCache.value.get(String(key))');
    expect(formSource).toContain('preserveSelectedRowKeys: true');
  });
});
