import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, '../data.ts'), 'utf8');
const pieceCountSource = readFileSync(
  join(currentDir, '../../utils/item-piece-count.ts'),
  'utf8',
);

describe('sale order item form shortcuts and sale prices', () => {
  it('adds active-row shortcuts with visible hints', () => {
    expect(itemFormSource).toContain('sale-order-item-row--active');
    expect(itemFormSource).toContain('sale-order-item-shortcut-hint');
    expect(itemFormSource).toContain(
      "slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' }",
    );
    expect(itemFormSource).toContain('isCreateShortcutKey(event)');
    expect(itemFormSource).toContain('void handleAddBlankItemRow();');
    expect(itemFormSource).toContain('ErpInlineStockSelect');
    expect(itemFormSource).toContain('getSaleStockPage');
    expect(itemFormSource).toContain('data-erp-inline-stock-select-input');
    expect(itemFormSource).toContain('<kbd>Insert</kbd><b>新增行</b>');
    expect(itemFormSource).toContain('<kbd>Space</kbd><b>销售历史</b>');
    expect(itemFormSource).toContain('<kbd>Shift</kbd><b>报价订单历史</b>');
    expect(itemFormSource).toContain('<kbd>F</kbd><b>修改商品</b>');
    expect(itemFormSource).toContain("void openSaleShortcutHistory('history')");
    expect(itemFormSource).toContain("void openSaleShortcutHistory('order')");
    expect(itemFormSource).toContain('pendingQuoteOrderHistoryShift');
    expect(itemFormSource).toContain('function isQuoteOrderHistoryShiftKey');
    expect(itemFormSource).toContain(
      'function handleShortcutKeyup(event: KeyboardEvent)',
    );
    expect(itemFormSource).not.toContain(
      "if (event.key === 'Enter') {\n    event.preventDefault();\n    void openSaleShortcutHistory('order');",
    );
    expect(itemFormSource).toContain("if (key === 'f')");
    expect(itemFormSource).toContain(
      "window.addEventListener('keydown', handleShortcut, true)",
    );
    expect(itemFormSource).toContain(
      "window.addEventListener('keyup', handleShortcutKeyup, true)",
    );
    expect(itemFormSource).toContain(
      "window.removeEventListener('keydown', handleShortcut, true)",
    );
    expect(itemFormSource).toContain(
      "window.removeEventListener('keyup', handleShortcutKeyup, true)",
    );
  });

  it('activates shortcuts before async field loading and keeps W available in details', () => {
    const mountedSource = itemFormSource.slice(
      itemFormSource.indexOf('onMounted(async () => {'),
      itemFormSource.indexOf('onActivated(() => {'),
    );
    const shortcutSource = itemFormSource.slice(
      itemFormSource.indexOf('function handleShortcut(event: KeyboardEvent)'),
      itemFormSource.indexOf(
        'function handleShortcutKeyup(event: KeyboardEvent)',
      ),
    );
    const keyupSource = itemFormSource.slice(
      itemFormSource.indexOf(
        'function handleShortcutKeyup(event: KeyboardEvent)',
      ),
      itemFormSource.indexOf('function pickProductPrice('),
    );

    expect(mountedSource.indexOf('syncShortcutListening();')).toBeLessThan(
      mountedSource.indexOf('await loadOrderPriceCustomFieldNames();'),
    );
    expect(itemFormSource).toContain('props.shortcutActive');
    expect(itemFormSource).toContain('isSaleShortcutOwnerActive');
    expect(shortcutSource).toContain(
      "void openSaleShortcutHistory('history');\n    return;\n  }\n  if (props.disabled)",
    );
    expect(keyupSource).not.toContain('props.disabled');
    expect(formSource).toContain(':shortcut-active="isSaleOrderFormOpen"');
  });

  it('keeps batch delete in the detail toolbar after the add-row button', () => {
    const toolbar = itemFormSource.slice(
      itemFormSource.indexOf('<template #toolbar-tools>'),
      itemFormSource.indexOf(
        '<template #productId=',
        itemFormSource.indexOf('<template #toolbar-tools>'),
      ),
    );

    expect(itemFormSource).toContain('const canShowItemSelection = computed(');
    expect(itemFormSource).toContain(
      'const selectedDeleteItemRows = computed(',
    );
    expect(itemFormSource).toContain('function handleBatchDeleteItems()');
    expect(itemFormSource).toContain('function canSelectItemRow(');
    expect(toolbar).toContain('handleAddBlankItemRow');
    expect(toolbar).toContain('handleBatchDeleteItems');
    expect(toolbar).toContain('批量删除');
    expect(toolbar.indexOf('handleAddBlankItemRow')).toBeLessThan(
      toolbar.indexOf('handleBatchDeleteItems'),
    );
    expect(toolbar).not.toContain('handleOpenBatchUpdateItems');
  });

  it('prioritizes Insert add-product shortcut before editable target filtering', () => {
    const createShortcutIndex = itemFormSource.indexOf(
      'if (!props.disabled && isCreateShortcutKey(event))',
    );
    const editableTargetIndex = itemFormSource.indexOf(
      'isEditableEnterTarget(event.target)',
      createShortcutIndex,
    );
    const spaceHistoryIndex = itemFormSource.indexOf(
      "if (event.key === ' ' || event.code === 'Space')",
      createShortcutIndex,
    );
    const createShortcutBlock = itemFormSource.slice(
      createShortcutIndex,
      editableTargetIndex,
    );

    expect(createShortcutIndex).toBeGreaterThan(-1);
    expect(editableTargetIndex).toBeGreaterThan(createShortcutIndex);
    expect(spaceHistoryIndex).toBeGreaterThan(editableTargetIndex);
    expect(itemFormSource).toContain('function isStockSelectOpen()');
    expect(itemFormSource).toContain('function isShortcutOverlayTarget(');
    expect(itemFormSource).toContain('function isVisibleShortcutOverlay(');
    expect(itemFormSource).toContain('window.getComputedStyle(overlay)');
    expect(itemFormSource).toContain(
      'document.querySelectorAll(SHORTCUT_OVERLAY_SELECTOR)',
    );
    expect(itemFormSource).not.toContain(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-picker-dropdown:not(.ant-picker-dropdown-hidden), .ant-popover:not(.ant-popover-hidden)',
    );
    expect(createShortcutBlock).toContain('isStockSelectOpen()');
    expect(createShortcutBlock).toContain('isShortcutDialogOpen()');
    expect(createShortcutBlock).toContain(
      'isShortcutOverlayTarget(event.target)',
    );
    expect(createShortcutBlock).toContain('void handleAddBlankItemRow();');
  });

  it('passes customer price level into the item form and stock selector', () => {
    expect(formSource).toContain('currentCustomerPriceLevel');
    expect(formSource).toContain('loadCustomerPriceLevel(values.customerId)');
    expect(formSource).toContain(
      ':customer-price-level="currentCustomerPriceLevel"',
    );
    expect(formSource).toContain('isHydratingFormValues');
    expect(formSource).toContain(
      ':suspend-price-auto-refresh="isHydratingFormValues"',
    );
    expect(formSource).toContain('if (isHydratingFormValues.value) return;');
    expect(itemFormSource).toContain('customerPriceLevel?: number');
    expect(itemFormSource).toContain('suspendPriceAutoRefresh?: boolean');
    expect(itemFormSource).toContain('suspendPriceAutoRefresh: false');
    expect(itemFormSource).toContain('if (props.suspendPriceAutoRefresh)');
    expect(itemFormSource).toContain(
      ':customer-price-level="customerPriceLevel"',
    );
    expect(itemFormSource).toContain('pickCustomerLevelPrice');
    expect(itemFormSource).toContain('loadOrderPriceCustomFieldNames');
    expect(itemFormSource).toContain('salePrice = pickProductPrice');
    expect(itemFormSource).toContain('lastSalePrice: p.lastSalePrice');
  });

  it('adds inline and full-modal stock selections directly with default values', () => {
    expect(itemFormSource).not.toContain('StockSelectionReviewModal');
    expect(itemFormSource).not.toContain(':before-confirm=');
    expect(itemFormSource).not.toContain('applyReviewedStockValues');
    expect(itemFormSource).toContain('count: 1');
    expect(itemFormSource).toContain('productPrice: salePrice');
    expect(itemFormSource).toContain('void insertStockProducts(products);');
    expect(itemFormSource).toContain('targetRow,');
  });

  it('keeps replacement-row focus ahead of appended rows and preserves Enter scroll', () => {
    expect(formSource).toContain('const replacedBlankCreateKey');
    expect(formSource.indexOf('replacedBlankCreateKey &&')).toBeLessThan(
      formSource.indexOf('else if (firstRemainingAddedKey)'),
    );
    expect(formSource).toContain(
      "await focusRemoteItemByKey(replacedBlankCreateKey, 'count');",
    );
    const rowChange = itemFormSource.slice(
      itemFormSource.indexOf('function handleRowChange'),
      itemFormSource.indexOf('/** 处理赠品变更 */'),
    );
    expect(rowChange).toContain('if (activeItemSort.value)');
    expect(rowChange).not.toContain('void refreshItemGrid();');
  });

  it('shows sale price and last sale price columns', () => {
    expect(dataSource).toContain("field: 'salePrice'");
    expect(dataSource).toContain("title: '售价'");
    expect(dataSource).toContain("field: 'lastSalePrice'");
    expect(dataSource).toContain("title: '最后一次销售价'");
  });

  it('shows piece count as a read-only virtual column', () => {
    expect(dataSource).toContain("field: 'packageQty'");
    expect(dataSource).toContain("field: 'pieceCount'");
    expect(dataSource).toContain("title: '件数'");
    expect(dataSource).toContain('saleItemPieceCountColumnFormatter');
    expect(pieceCountSource).toContain('count / packageQty');
    expect(pieceCountSource).toContain("return '-'");
  });

  it('keeps sale order batch selection available in stock modal and item rows', () => {
    expect(dataSource).toContain("field: 'batchNo'");
    expect(dataSource).toContain("slots: { default: 'batchNo' }");
    expect(itemFormSource).toContain('getAvailableBatchNoList');
    expect(itemFormSource).toContain('batchNoOptionsMap');
    expect(itemFormSource).toContain('mergeCurrentBatchNoOption');
    expect(itemFormSource).toContain('availableCount: row.stockCount');
    expect(itemFormSource).toContain(
      'normalizeBatchNoValue(item.value) === currentBatchNo',
    );
    expect(itemFormSource).toContain(
      'const batchNo = normalizeBatchNoValue(p.batchNo) || undefined',
    );
    expect(itemFormSource).toContain(
      'const batchNoEnabled = isBatchNoEnabled(p.batchNoEnabled) || !!batchNo',
    );
    expect(itemFormSource).not.toContain('handleOpenBatchUpdateItems');
    expect(itemFormSource).toContain('<template #batchNo="{ row }">');
    expect(itemFormSource).toContain(':options="getBatchNoOptions(row)"');
    expect(itemFormSource).toContain('@change="handleBatchNoChange(row)"');
    expect(itemFormSource).toContain('show-batch-no');
  });
});
