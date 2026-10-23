import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

const STATIC_LIST_PAGES = [
  ['销售订单', 'order/index.vue', 'erp-sale-order-list-v2'],
  ['销售报价', 'quote/index.vue', 'erp-sale-quote-list-v2'],
  ['销售单', 'out/index.vue', 'erp-sale-out-list-v2'],
  ['销售退货', 'return/index.vue', 'erp-sale-return-list-v2'],
  ['销售调价', 'priceadjust/index.vue', 'erp-sale-price-adjust-list-v2'],
  ['销售拣货', 'pick/index.vue', 'erp-sale-pick-list-v2'],
  ['销售送货', 'delivery/index.vue', 'erp-sale-delivery-list-v2'],
  ['客户', 'customer/index.vue', 'erp-sale-customer-list-v2'],
  ['销售配置', 'config/index.vue', 'erp-sale-config-list-v1'],
  [
    '报价明细报表',
    'report/modules/sale-quote-detail-report-table.vue',
    'erp-sale-quote-detail-report-list-v1',
  ],
  [
    '出库明细报表',
    'report/modules/sale-out-detail-report-table.vue',
    'erp-sale-out-detail-report-list-v1',
  ],
] as const;

const ACTION_COLUMN_SOURCE_PATHS = [
  'order/data.ts',
  'quote/data.ts',
  'out/data.ts',
  'return/data.ts',
  'priceadjust/data.ts',
  'customer/data.ts',
  'config/data.ts',
] as const;

const PICK_DELIVERY_REPORT_IDS = ['pick', 'delivery'].map(
  (mode) => `erp-sale-${mode}-detail-report-list`,
);

function readSaleFile(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

function expectColumnStorage(source: string) {
  expect(source).toMatch(
    /customConfig:\s*\{[\s\S]*?storage:\s*\{\s*fixed:\s*true,\s*resizable:\s*true,\s*sort:\s*true,\s*visible:\s*true,?\s*\}/,
  );
}

describe('sale list column settings storage', () => {
  it.each(STATIC_LIST_PAGES)(
    '%s keeps a stable grid id and persists all column settings',
    (_name, path, gridId) => {
      const source = readSaleFile(path);

      expect(source).toContain(`id: '${gridId}'`);
      expectColumnStorage(source);
    },
  );

  it('uses distinct stable storage ids for all 13 sales list pages', () => {
    const ids = [
      ...STATIC_LIST_PAGES.map(([, , gridId]) => gridId),
      ...PICK_DELIVERY_REPORT_IDS,
    ];

    expect(ids).toHaveLength(13);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('isolates pick and delivery detail report settings by mode', () => {
    const source = readSaleFile(
      'report/modules/pick-delivery-readonly-table.vue',
    );

    expect(source).toMatch(
      /id: `erp-sale-\$\{props\.mode\}-detail-report-list`/,
    );
    expect(PICK_DELIVERY_REPORT_IDS).toEqual([
      'erp-sale-pick-detail-report-list',
      'erp-sale-delivery-detail-report-list',
    ]);
    expectColumnStorage(source);
  });

  it.each(ACTION_COLUMN_SOURCE_PATHS)(
    '%s gives the operation column a stable field required by VXE storage',
    (path) => {
      const source = readSaleFile(path);

      expect(source).toMatch(
        /field: 'actions',\s+title: '操作',[\s\S]*?slots: \{ default: 'actions' \}/,
      );
    },
  );
});
