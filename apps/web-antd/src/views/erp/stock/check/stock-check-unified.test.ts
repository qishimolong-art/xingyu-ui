import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  formatStockCheckDecimal,
  parseStockCheckDecimal,
} from './modules/stock-check-decimal';
import { fitStockCheckColumns } from './stock-check-columns';

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

describe('stock-check decimal business rules', () => {
  it.each([
    ['actualCount', '0', 0],
    ['actualCount', '001.250', 1.25],
    ['count', '-12.125', -12.125],
    ['count', '0', 0],
    ['productPrice', '0.00', 0],
    ['totalPrice', '12.50', 12.5],
    ['count', '0.123456', 0.123_456],
    ['productPrice', '10.111111', 10.111_111],
  ] as const)('accepts %s %s', (field, text, value) => {
    expect(parseStockCheckDecimal(text, field)).toBe(String(value));
  });
  it.each([
    ['actualCount', '-1'],
    ['count', '-'],
    ['productPrice', '-0.01'],
    ['totalPrice', '1e2'],
    ['count', 'abc'],
    ['actualCount', ''],
    ['count', '.'],
    ['count', 'Infinity'],
  ] as const)('rejects invalid %s %s at commit', (field, text) => {
    expect(() => parseStockCheckDecimal(text, field)).toThrow();
  });
  it('formats signed counts naturally and monetary zero with two digits', () => {
    expect(formatStockCheckDecimal(-1.25, 'count')).toBe('-1.25');
    expect(formatStockCheckDecimal(0, 'actualCount')).toBe('0');
    expect(formatStockCheckDecimal(0, 'productPrice')).toBe('0');
    expect(formatStockCheckDecimal(12.5, 'totalPrice')).toBe('12.5');
  });
});

describe('stock-check actual visible-column layout', () => {
  const columns = [
    { type: 'seq', width: 48 },
    { field: 'productId', width: 180 },
    { field: 'totalPrice', width: 100 },
    { field: 'remark', width: 150 },
    { field: 'actions', title: '操作', width: 80, fixed: 'right' as const },
  ];
  it.each([1280, 1920, 2560])(
    'fills width %s without stretching operations',
    (width) => {
      const fitted = fitStockCheckColumns(columns, [], width);
      expect(
        fitted.reduce(
          (sum, column) => sum + Number(column.width ?? column.minWidth ?? 0),
          0,
        ),
      ).toBe(width);
      expect(fitted.find((column) => column.field === 'actions')).toMatchObject(
        { width: 80, fixed: 'right' },
      );
    },
  );
  it('uses the last visible business column after persisted order and visibility restore', () => {
    const saved = [
      columns[2]!,
      columns[1]!,
      { ...columns[3], visible: false },
      { ...columns[4], fixed: 'left', visible: false },
      columns[0]!,
    ];
    const fitted = fitStockCheckColumns(columns, saved, 1920);
    expect(fitted.find((column) => column.field === 'productId')?.width).toBe(
      1692,
    );
    expect(fitted.find((column) => column.field === 'actions')).toMatchObject({
      fixed: 'right',
      visible: true,
    });
  });
  it('respects narrow-screen minimums, saved widths, and permission-filtered columns', () => {
    const fitted = fitStockCheckColumns(
      columns.filter((column) => column.field !== 'totalPrice'),
      [{ ...columns[1], resizeWidth: 300 }],
      350,
    );
    expect(fitted.some((column) => column.field === 'totalPrice')).toBe(false);
    expect(fitted.find((column) => column.field === 'productId')?.width).toBe(
      300,
    );
    expect(
      fitted.reduce(
        (sum, column) => sum + Number(column.width ?? column.minWidth ?? 0),
        0,
      ),
    ).toBeGreaterThan(350);
  });
  it('never restores a detail operation column', () => {
    const detail = columns.filter((column) => column.field !== 'actions');
    expect(
      fitStockCheckColumns(detail, columns, 1920).some(
        (column) => column.field === 'actions',
      ),
    ).toBe(false);
  });
});

describe('stock-check integration boundaries', () => {
  it('preserves incremental saves and validates input before building payloads', () => {
    const form = source('./modules/form.vue');
    expect(form).toContain('buildIncrementalRemoteItems(');
    expect(form).toContain('flushDecimalInputs?.()');
    expect(form).toContain('await enqueueRemoteItemOperation(() => undefined)');
    expect(form).toContain(
      "includeItems: !['detail', 'edit'].includes(data.type)",
    );
  });
  it('does not reload sorted rows for normal field edits', () => {
    const item = source('./modules/item-form.vue');
    const emit = item.slice(
      item.indexOf('function emitItemsUpdate('),
      item.indexOf('function fillWarehouseSnapshot'),
    );
    expect(emit).not.toContain('refreshItemGrid');
    expect(item).toContain('event.shiftKey');
    expect(item).toContain('isPurchaseShortcutOwnerActive');
    expect(item).toContain(
      "removeEventListener('keyup', handleHistoryKeyup, true)",
    );
  });
  it('keeps whole-order imports in the list and selectable exports in their own modal', () => {
    const list = source('./index.vue');
    const item = source('./modules/item-form.vue');
    expect(list).toContain('getStockCheckExportFields');
    expect(list).toContain("fields: fields.join(',')");
    expect(list).not.toContain('queueFocusStockKeywordSearchInput');
    expect(item).not.toContain('ImportForm');
    expect(list).toContain('hasOpenDialogOverlay()');
  });
});
