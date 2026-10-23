import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readStockSource(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

function expectOrder(source: string, startNeedle: string, steps: string[]) {
  const startIndex = source.indexOf(startNeedle);
  expect(startIndex).toBeGreaterThanOrEqual(0);

  let previousIndex = startIndex;
  for (const step of steps) {
    const nextIndex = source.indexOf(step, previousIndex);
    expect(nextIndex).toBeGreaterThan(previousIndex);
    previousIndex = nextIndex;
  }
}

describe('stock item grids reload data after column recalculation', () => {
  it.each([
    [
      'stock in',
      'in/modules/item-form.vue',
      '() => [props.disabled, props.enableBatchEdit, props.inId]',
      'await itemColumns.reload();',
    ],
    [
      'stock out',
      'out/modules/item-form.vue',
      '() => [props.disabled, props.enableBatchEdit, props.outId]',
      'await itemColumns.reload();',
    ],
    [
      'transfer out',
      'transfer-out/modules/item-form.vue',
      '() => [props.disabled, props.enableBatchEdit, props.documentId]',
      'await itemColumns.reload();',
    ],
    [
      'stock check',
      'check/modules/item-form.vue',
      '() => [props.disabled, props.enableBatchEdit, props.checkId]',
      'await gridApi.grid.reloadColumn(buildItemColumns());',
    ],
  ])(
    '%s keeps rows visible when detail/edit mode columns change',
    (_, path, watcher, columnReload) => {
      const source = readStockSource(path);

      expectOrder(source, watcher, [columnReload, 'await refreshItemGrid();']);
    },
  );

  it.each([
    ['stock in', 'in/modules/item-form.vue', 'await itemColumns.reload();'],
    ['stock out', 'out/modules/item-form.vue', 'await itemColumns.reload();'],
    [
      'transfer out',
      'transfer-out/modules/item-form.vue',
      'await itemColumns.reload();',
    ],
    [
      'stock check',
      'check/modules/item-form.vue',
      'await gridApi.grid.reloadColumn(buildItemColumns());',
    ],
  ])(
    '%s loads incoming detail items after rebuilding columns',
    (_, path, columnReload) => {
      const source = readStockSource(path);

      expect(source).toContain('() => props.items');
      const syncStart = source.includes('async function syncItemsFromProps(')
        ? 'async function syncItemsFromProps('
        : '() => props.items';
      if (syncStart === 'async function syncItemsFromProps(') {
        expect(source).toContain('await syncItemsFromProps(items);');
      }
      expectOrder(source, syncStart, [
        columnReload,
        'await refreshItemGrid();',
      ]);
    },
  );

  it.each([
    [
      'stock in',
      'in/modules/item-form.vue',
      '() => props.hiddenFields',
      'await itemColumns.reload();',
    ],
    [
      'stock out',
      'out/modules/item-form.vue',
      '() => props.hiddenFields',
      'await itemColumns.reload();',
    ],
    [
      'transfer out',
      'transfer-out/modules/item-form.vue',
      '() => props.hiddenFields',
      'await itemColumns.reload();',
    ],
    [
      'stock check',
      'check/modules/item-form.vue',
      '() => [props.hiddenFields, props.checkType, props.disabled]',
      'buildItemColumns(hiddenFields as string[])',
    ],
  ])(
    '%s restores rows after hidden-field columns change',
    (_, path, watcher, columnCall) => {
      const source = readStockSource(path);

      expectOrder(source, watcher, [columnCall, 'await refreshItemGrid();']);
    },
  );

  it.each([
    ['stock in', 'in/modules/item-form.vue'],
    ['stock out', 'out/modules/item-form.vue'],
  ])(
    '%s keeps adaptive gridOptions data in sync before local loadData',
    (_, path) => {
      const source = readStockSource(path);

      expectOrder(source, 'async function refreshItemGrid()', [
        'const rows = getDisplayedItems();',
        'gridApi.setGridOptions({ data: rows, fit: false });',
        'await itemColumns.reload();',
        'await gridApi.grid.loadData(rows);',
      ]);
    },
  );

  it('warehouse move keeps fixed-width gridOptions data in sync before local loadData', () => {
    const source = readStockSource('warehouse-move/modules/item-form.vue');

    expectOrder(source, 'async function refreshItemGrid()', [
      'const displayData = getDisplayedItems();',
      'gridApi.setGridOptions({ data: displayData, fit: false });',
      'await itemColumns.reload();',
      'await gridApi.grid.loadData(displayData);',
    ]);
  });

  it('stock check keeps adaptive gridOptions data in sync before local loadData', () => {
    const source = readStockSource('check/modules/item-form.vue');

    expectOrder(source, 'async function refreshItemGrid()', [
      'const displayData = getDisplayedItems();',
      'gridApi.setGridOptions({ data: displayData });',
      'await itemColumns.reload();',
      'await gridApi.grid.loadData(displayData);',
    ]);
  });

  it('transfer out keeps adaptive gridOptions data in sync before local loadData', () => {
    const source = readStockSource('transfer-out/modules/item-form.vue');

    expectOrder(source, 'async function refreshItemGrid()', [
      'const displayData = getDisplayedItems();',
      'gridApi.setGridOptions({ data: displayData, fit: false });',
      'await itemColumns.reload();',
      'await gridApi.grid.loadData(displayData);',
    ]);
  });

  it('stock move restores rows after hidden-field columns change', () => {
    const source = readStockSource('move/modules/item-form.vue');

    expectOrder(source, '() => props.hiddenFields', [
      'await gridApi.grid.reloadColumn(',
      'await refreshItemGrid();',
    ]);
  });

  it('stock move keeps gridOptions data in sync before reloadData', () => {
    const source = readStockSource('move/modules/item-form.vue');

    expectOrder(source, 'async function refreshItemGrid()', [
      'const displayData = getDisplayedItems();',
      'const columns = buildItemColumns(',
      'gridApi.setGridOptions({ columns, data: displayData, fit: false });',
      'await gridApi.grid.reloadData(displayData);',
    ]);
  });

  it('transfer in detail keeps gridOptions data in sync before reloadData', () => {
    const source = readStockSource('transfer-in/modules/form.vue');

    expectOrder(source, 'async function refreshItemGrid()', [
      'const displayData = getDisplayedItems();',
      'gridApi.setGridOptions({ data: displayData, fit: false });',
      'await itemColumns.reload();',
      'await gridApi.grid.loadData(displayData);',
    ]);
  });
});
