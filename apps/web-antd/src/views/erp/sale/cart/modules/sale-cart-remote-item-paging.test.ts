import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/sale/cart/index.ts'),
  'utf8',
);

describe('sale cart remote edit item paging contract', () => {
  it('uses the edit-page POST request with pending deleted ids', () => {
    expect(apiSource).toContain('export function getSaleCartEditItemPage');
    expect(apiSource).toContain("'/erp/sale-cart/item-page'");
    expect(formSource).toContain('excludedItemIds: [...remoteItemDeletes]');
    expect(formSource).toContain('getSaleCartEditItemPage({');
  });

  it('composes pending creates at the document tail and clamps empty pages', () => {
    expect(formSource).toContain('composeRemoteItemPage({');
    expect(formSource).toContain('getRemoteCreatedItemNavigationPlan({');
    expect(formSource).toContain('navigationPlan.requiresPageRequest');
    expect(formSource).toContain('getRemoteCreatedItemPageNo(');
    expect(formSource).toContain('clampRemoteItemPageNo(');
  });

  it('keeps remote blank rows out of the current page until navigation is decided', () => {
    const addHandlerStart = itemFormSource.indexOf(
      'async function handleAddBlankItemRow()',
    );
    const addHandlerEnd = itemFormSource.indexOf(
      'function buildSaleCartItemFromStock',
      addHandlerStart,
    );
    const addHandler = itemFormSource.slice(addHandlerStart, addHandlerEnd);

    expect(addHandler).toContain("emit('remoteBlankRowAdded', row)");
    expect(addHandler.indexOf('if (props.remotePaging)')).toBeLessThan(
      addHandler.indexOf('tableData.value = [...tableData.value, row]'),
    );
  });

  it('keeps remote stock selections out of the current page until navigation is decided', () => {
    const insertHandlerStart = itemFormSource.indexOf(
      'async function insertStockProducts(',
    );
    const insertHandlerEnd = itemFormSource.indexOf(
      'function handleInlineStockSelected',
      insertHandlerStart,
    );
    const insertHandler = itemFormSource.slice(
      insertHandlerStart,
      insertHandlerEnd,
    );

    expect(insertHandlerEnd).toBeGreaterThan(insertHandlerStart);
    expect(insertHandler).toContain("emit('remoteStockSelectionRequested'");
    expect(insertHandler.indexOf('if (props.remotePaging)')).toBeLessThan(
      insertHandler.indexOf(
        'nextItems = [...tableData.value, ...selectedRows]',
      ),
    );
    expect(formSource).toContain('@remote-stock-selection-requested=');
    expect(formSource).toContain('handleRemoteStockSelectionRequested');
    expect(formSource).toContain('getRemoteCreatedItemsNavigationPlan({');
  });

  it('rolls back stock-selection paging state and serializes rapid selections', () => {
    expect(formSource).toContain(
      'let remoteStockSelectionQueue: Promise<void>',
    );
    expect(formSource).toContain(
      'restoreRemoteItemMap(remoteItemCreates, previousCreates)',
    );
    expect(formSource).toContain("message.error('新增明细定位失败，请重试')");
  });

  it('focuses the replaced blank row before any additional selected stock rows', () => {
    const selectionHandler = formSource.slice(
      formSource.indexOf('async function applyRemoteStockSelection'),
      formSource.indexOf('function handleRemoteStockSelectionRequested'),
    );
    const replacementFocus = selectionHandler.indexOf(
      'if (replacementStillVisible && replacementKey)',
    );
    const appendedFocus = selectionHandler.indexOf(
      'if (remainingAppendedKeys.length > 0)',
    );

    expect(replacementFocus).toBeGreaterThan(-1);
    expect(appendedFocus).toBeGreaterThan(-1);
    expect(replacementFocus).toBeLessThan(appendedFocus);
    expect(selectionHandler.slice(replacementFocus, appendedFocus)).toContain(
      "replacementKey,\n        'count',",
    );
  });

  it('deduplicates page synchronization and can focus without another grid refresh', () => {
    expect(itemFormSource).toContain('lastSyncedItemsSource === items');
    expect(itemFormSource).toContain('async function syncRemoteItems(');
    expect(formSource).toContain('{ refreshAuxiliary: false }');
    expect(formSource).toContain("localKey,\n      'product',\n      false,");
  });

  it('rolls back a failed blank-row navigation', () => {
    expect(formSource).toContain('remoteItemCreates.delete(localKey)');
    expect(formSource).toContain('itemPageState.value = previousPageState');
    expect(formSource).toContain('restoreRemoteItemSort?.(');
  });

  it('reloads after deletion and locks sorting while creates are pending', () => {
    expect(itemFormSource).toContain("emit('remoteRowsDeleted')");
    expect(formSource).toContain(
      '@remote-rows-deleted="handleRemoteRowsDeleted"',
    );
    expect(formSource).toContain(':remote-sort-locked="remoteItemSortLocked"');
    expect(itemFormSource).toContain('props.remoteSortLocked');
  });
});
