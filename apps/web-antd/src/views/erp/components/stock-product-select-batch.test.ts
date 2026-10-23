import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const modalSource = readFileSync(
  join(currentDir, 'StockProductSelectModal.vue'),
  'utf8',
);
const cartItemSource = readFileSync(
  join(currentDir, '../sale/cart/modules/item-form.vue'),
  'utf8',
);
const quoteItemSource = readFileSync(
  join(currentDir, '../sale/quote/modules/item-form.vue'),
  'utf8',
);
const transferOutItemSource = readFileSync(
  join(currentDir, '../stock/transfer-out/modules/item-form.vue'),
  'utf8',
);
const transferOutDataSource = readFileSync(
  join(currentDir, '../stock/transfer-out/data.ts'),
  'utf8',
);

describe('sale stock selection batch contract', () => {
  it('requests batch rows and uses their unique row key when enabled', () => {
    expect(modalSource).toContain(
      'showBatchNo: props.showBatchNo || undefined',
    );
    expect(modalSource).toContain(
      "keyField: props.showBatchNo ? 'rowKey' : 'id'",
    );
    expect(modalSource).toContain("field: 'batchNo'");
    expect(modalSource).toContain("row.batchNo || '未指定批次'");
  });

  it('keeps sale entry points on normal stock paging by default', () => {
    expect(modalSource).not.toContain('<Switch');
    expect(cartItemSource).not.toContain(':show-batch-no="true"');
    expect(quoteItemSource).not.toContain(':show-batch-no="true"');
    expect(transferOutItemSource).not.toContain(':show-batch-no="true"');
    expect(cartItemSource).toContain('batchNo: p.batchNo');
    expect(quoteItemSource).toContain('batchNo: p.batchNo');
    expect(transferOutItemSource).toContain('getAvailableBatchNoList');
    expect(transferOutItemSource).toContain("bizType: 'stock'");
    expect(transferOutDataSource).toContain("field: 'batchNo'");
  });
});
