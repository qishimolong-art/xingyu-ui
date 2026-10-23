import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const modalSource = readFileSync(
  join(currentDir, 'sale-batch-adjust-price-form.vue'),
  'utf8',
);

describe('sale batch adjust price modal', () => {
  it('loads selectable price levels filtered by current user price permissions', () => {
    expect(modalSource).toContain("getBaseDataSimpleList('price_level')");
    expect(modalSource).toContain("getCurrentUserHiddenFields('erp_product')");
    expect(modalSource).toContain('mapVisibleSelectablePriceLevelOptions');
    expect(modalSource).toContain('const priceLevelOptions = ref');
    expect(modalSource).toContain('loadPriceLevelOptions');
    expect(modalSource).toContain('价格体系');
    expect(modalSource).not.toContain('getPriceSystemSimpleList');
    expect(modalSource).not.toContain('data?.customerPriceLevel');
  });

  it('snapshots selected values before closing and submits only price fields', () => {
    const confirmHandler = modalSource.slice(
      modalSource.indexOf('async onConfirm() {'),
      modalSource.indexOf(
        'async onOpenChange(',
        modalSource.indexOf('async onConfirm() {'),
      ),
    );

    expect(confirmHandler).toContain(
      'const currentItemIds = [...itemIds.value];',
    );
    expect(confirmHandler).toContain(
      'const currentDocumentId = documentId.value;',
    );
    expect(confirmHandler).toContain(
      'const currentPriceLevel = normalizePriceLevel(priceLevel.value);',
    );
    expect(confirmHandler.indexOf('const currentPriceLevel')).toBeLessThan(
      confirmHandler.indexOf('await modalApi.close();'),
    );
    expect(confirmHandler).toContain("message.warning('请选择价格体系');");
    expect(confirmHandler).toContain('itemIds: currentItemIds,');
    expect(confirmHandler).toContain('documentId: currentDocumentId,');
    expect(confirmHandler).toContain('priceLevel: currentPriceLevel,');
    expect(confirmHandler).not.toContain('warehouseId');
    expect(confirmHandler).not.toContain('deptId');
  });
});
