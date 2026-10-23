import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useGridColumns, useGridFormSchema } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const detailSource = readFileSync(
  join(currentDir, 'modules/detail-modal.vue'),
  'utf8',
);

describe('stock out bill sales-cart UI contract', () => {
  it('keeps only the operation column fixed and exposes the bill link', () => {
    const columns = useGridColumns() || [];
    expect(columns.every((column) => !column.fixed)).toBe(true);
    expect(columns.some((column) => column.field === 'actions')).toBe(false);
    expect(columns.find((column) => column.field === 'no')?.slots).toEqual({
      default: 'no',
    });
    expect(indexSource).toContain('class="stock-out-bill-number-link"');
  });

  it('uses compact select searches and preserves list operations', () => {
    const schema = useGridFormSchema();
    const warehouse = schema.find((field) => field.fieldName === 'warehouseId');
    const creator = schema.find((field) => field.fieldName === 'creator');
    const auditor = schema.find((field) => field.fieldName === 'auditor');
    const status = schema.find((field) => field.fieldName === 'status');

    expect(status?.component).toBe('Select');
    expect(status?.componentProps).toMatchObject({
      popupClassName:
        'stock-out-bill-search-select-dropdown erp-candidate-focus-popup',
    });
    expect(warehouse?.componentProps).toMatchObject({
      popupClassName:
        'stock-out-bill-search-select-dropdown erp-candidate-focus-popup',
      pageSize: 10,
    });
    expect(warehouse?.component).toBe('ErpLazyPageSelect');
    expect(creator?.component).toBe('ErpLazyPageSelect');
    expect(auditor?.component).toBe('ErpLazyPageSelect');
    expect(indexSource).toContain("auth: ['erp:stock-out-bill:export']");
    expect(indexSource).toContain(
      "hasAccessByCodes(['erp:stock-out-bill:query'])",
    );
    expect(indexSource).not.toContain("auth: ['erp:stock-out-bill:pick']");
    expect(indexSource).not.toContain('handlePick');
    expect(indexSource).toContain('STOCK_OUT_BILL_HISTORY_NOTICE');
  });

  it('provides fullscreen paged detail, item totals and audit information', () => {
    expect(detailSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(detailSource).toContain('<HistoricalStockBillItems');
    expect(detailSource).toContain('getStockOutBillItemPage');
    expect(detailSource).not.toContain('cacheCurrentPickCounts');
    expect(detailSource).not.toContain('pickStockOutBill');
    expect(detailSource).toContain(':show-confirm-button="false"');
    expect(detailSource).toContain('class="stock-out-bill-item-pager"');
    expect(detailSource).toContain('class="stock-out-bill-document-summary"');
    expect(detailSource).toContain('<ErpAuditInfo');
    expect(detailSource).toContain('detailLoading.value = false');
    expect(detailSource).toContain(
      "detailLoadError.value = '出仓单加载失败，请关闭后重试'",
    );
    expect(detailSource).toContain('++detailLoadSequence');
    expect(detailSource).toMatch(
      /if \(sequence === detailLoadSequence\) \{[\s\S]*?detailLoading\.value = false;[\s\S]*?modalApi\.unlock\(\);/,
    );
  });

  it('uses the same compact detail grid as inbound history', () => {
    expect(detailSource).toContain('<HistoricalStockBillItems');
    const shared = readFileSync(
      join(currentDir, '..', 'components', 'HistoricalStockBillItems.vue'),
      'utf8',
    );
    expect(shared).toContain('font-size: 11px');
    expect(shared).toContain('StockItemDetailActions');
  });
});
