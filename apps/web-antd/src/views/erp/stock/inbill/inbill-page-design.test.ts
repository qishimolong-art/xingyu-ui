import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  useGridColumns as usePurchaseGridColumns,
  useGridFormSchema as usePurchaseGridFormSchema,
} from '../../purchase/inbill/data';
import { useGridColumns, useGridFormSchema } from './data';
import {
  getStockInBillProgress,
  getStockInBillRemainingCount,
  getStockInBillStatusMeta,
  normalizeStockInBillRow,
  normalizeStockInBillSearchParams,
} from './ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const stockIndexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const purchaseIndexSource = readFileSync(
  join(currentDir, '..', '..', 'purchase', 'inbill', 'index.vue'),
  'utf8',
);
const detailSource = readFileSync(
  join(currentDir, 'modules', 'detail-modal.vue'),
  'utf8',
);

describe('stock in bill page design contract', () => {
  it('keeps both menu entries aligned around the key pickup fields', () => {
    const expectedLeadingFields = [
      'checkbox',
      'seq',
      'priority',
      'no',
      'status',
      'totalCount',
      'pickedCount',
      'remainingCount',
    ];

    for (const columns of [useGridColumns(), usePurchaseGridColumns()]) {
      expect(
        columns
          ?.slice(0, expectedLeadingFields.length)
          .map((column) => String(column.field ?? column.type)),
      ).toEqual(expectedLeadingFields);
    }
    const stockColumns = useGridColumns();
    expect(
      stockColumns?.find((column) => column.field === 'no')?.slots,
    ).toEqual({ default: 'no' });
    expect(stockColumns?.some((column) => column.field === 'actions')).toBe(
      false,
    );
  });

  it('uses business selectors instead of requiring status or creator ids', () => {
    expect(
      useGridFormSchema().find((field) => field.fieldName === 'creator')
        ?.component,
    ).toBe('ErpLazyPageSelect');

    for (const [schema, expectedPopupClass] of [
      [
        useGridFormSchema(),
        'stock-in-bill-search-select-dropdown erp-candidate-focus-popup',
      ],
      [usePurchaseGridFormSchema(), 'stock-in-bill-search-select-dropdown'],
    ] as const) {
      expect(
        schema.find((field) => field.fieldName === 'status')?.component,
      ).toBe('Select');
      expect(
        schema.find((field) => field.fieldName === 'creator')?.component,
      ).toMatch(/ApiSelect|ErpLazyPageSelect/);

      const selectors = schema.filter((field) =>
        ['ApiSelect', 'ErpLazyPageSelect', 'Select'].includes(
          String(field.component),
        ),
      );
      selectors.forEach((field) => {
        expect((field.componentProps as any)?.popupClassName).toBe(
          expectedPopupClass,
        );
      });
    }
  });

  it('normalizes pickup counts, progress and search input safely', () => {
    expect(getStockInBillRemainingCount(12.5, 4.25)).toBe('8.25');
    expect(getStockInBillRemainingCount(3, 5)).toBe('0');
    expect(getStockInBillProgress(8, 2)).toBe(25);
    expect(getStockInBillProgress(0, 2)).toBe(0);
    expect(getStockInBillStatusMeta(20).label).toBe('部分提货');
    expect(getStockInBillStatusMeta(99).label).toBe('未知状态');
    expect(
      normalizeStockInBillRow({ totalCount: 10, pickedCount: 3 }),
    ).toMatchObject({ remainingCount: '7' });
    expect(
      normalizeStockInBillSearchParams({
        keyword: '  RCD  001 ',
        no: '   ',
        status: 10,
      }),
    ).toEqual({ keyword: 'RCD%001', no: undefined, status: 10 });
  });

  it('keeps list search, summaries, selection export and sticky paging visible', () => {
    for (const source of [stockIndexSource, purchaseIndexSource]) {
      expect(source).toContain('withErpKeywordSearchSchema');
      expect(source).toContain('@keydown.enter.capture="handleSearchEnter"');
      expect(source).toContain('getCheckboxRecords');
      expect(source).toContain('.vxe-grid--pager-wrapper');
    }
    expect(stockIndexSource).toContain('getStockInBillSummary');
    expect(stockIndexSource).toContain('<StockListQuerySummary');
    expect(purchaseIndexSource).toContain('getStockInBillSummary');
    expect(purchaseIndexSource).toContain('<StockListQuerySummary');
  });

  it('keeps inbound history read-only and removes the cancelled pickup actions', () => {
    expect(detailSource).toContain('<Progress');
    expect(detailSource).toContain(':editable="false"');
    expect(detailSource).toContain(':show-confirm-button="false"');
    expect(detailSource).not.toContain('pickupStockInBill');
    expect(detailSource).not.toContain('v-model:value="record.pickupCount"');
    for (const source of [stockIndexSource, purchaseIndexSource]) {
      expect(source).not.toContain('handlePickup');
      expect(source).not.toContain("auth: ['erp:stock-in-bill:pickup']");
    }
    expect(detailSource).toContain('getStockInBillStatusMeta');
    expect(detailSource).not.toContain("{{ bill?.status ?? '-' }}");
  });

  it('uses the shared readonly grid with explicit widths and current-page prices', () => {
    expect(detailSource).toContain('<HistoricalStockBillItems');
    const shared = readFileSync(
      join(currentDir, '..', 'components', 'HistoricalStockBillItems.vue'),
      'utf8',
    );
    expect(shared).toContain('useStockDocumentColumns');
    expect(shared).toContain('fit: false');
    expect(shared).toContain('font-size: 11px');
    expect(shared).toContain('ItemPriceReferenceOverlay');
  });
});
