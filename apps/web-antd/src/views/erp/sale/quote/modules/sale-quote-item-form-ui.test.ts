import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const stockModalSource = readFileSync(
  join(currentDir, '../../../components/StockProductSelectModal.vue'),
  'utf8',
);
const saleStockModalSource = readFileSync(
  join(currentDir, '../../components/SaleStockProductSelectModal.vue'),
  'utf8',
);

describe('sale quote item form shortcuts', () => {
  it('lets the last visible business column fill remaining table width', () => {
    expect(itemFormSource).toContain('trailingFlexibleColumnMinWidth: 150');
    expect(itemFormSource).toContain('fit: true');
    expect(itemFormSource).not.toContain('fit: false');
    expect(itemFormSource).toContain('getCellContentExtraWidth:');
    expect(itemFormSource).toContain(
      "field === 'productId' && isCrossDeptWarehouse(row) ? 60 : 0",
    );
  });

  it('supports Insert create and active-row sale quote shortcuts', () => {
    expect(itemFormSource).toContain('sale-quote-item-row--active');
    expect(itemFormSource).toContain('sale-quote-item-shortcut-hint');
    expect(itemFormSource).toContain(
      "slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' }",
    );
    expect(itemFormSource).toContain('isCreateShortcutKey(event)');
    expect(itemFormSource).toContain('void handleAddBlankItemRow();');
    expect(itemFormSource).toContain('ErpInlineStockSelect');
    expect(itemFormSource).toContain('getSaleStockPage');
    expect(itemFormSource).toContain('data-erp-inline-stock-select-input');
    expect(itemFormSource).toContain('<kbd>Insert</kbd><b>新增行</b>');
    expect(itemFormSource).toContain('isStockSelectOpen()');
    expect(itemFormSource).toContain(
      'productSelectRef.value?.isOpen?.() === true',
    );
    expect(itemFormSource).toContain('<kbd>Space</kbd><b>销售历史</b>');
    expect(itemFormSource).toContain('<kbd>Shift</kbd><b>报价订单历史</b>');
    expect(itemFormSource).toContain('<kbd>P</kbd><b>采购订单历史</b>');
    expect(itemFormSource).toContain('<kbd>I</kbd><b>采购入库记录</b>');
    expect(itemFormSource).toContain('<kbd>F</kbd><b>修改商品</b>');
    expect(itemFormSource).toContain(
      '<span v-if="canViewPurchaseOrderHistory"',
    );
    expect(itemFormSource).toContain('<span v-if="canViewPurchaseInHistory"');
    expect(itemFormSource).toContain('<span v-if="canEditProduct">');
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
    expect(itemFormSource).toContain(
      "if (key === 'p' && canViewPurchaseOrderHistory.value)",
    );
    expect(itemFormSource).toContain("openPurchaseShortcutHistory('order')");
    expect(itemFormSource).toContain(
      "if (key === 'i' && canViewPurchaseInHistory.value)",
    );
    expect(itemFormSource).toContain("openPurchaseShortcutHistory('in')");
    expect(itemFormSource).toContain(
      "if (key === 'f' && canEditProduct.value)",
    );
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
    expect(itemFormSource).not.toContain("key === 'w'");
    expect(itemFormSource).not.toContain("key === 'q'");
  });

  it('activates shortcuts before async field loading and keeps read-only shortcuts in details', () => {
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
    expect(shortcutSource).toContain("void openSaleShortcutHistory('history')");
    expect(shortcutSource).not.toContain('if (props.disabled)');
    expect(shortcutSource).toContain("openPurchaseShortcutHistory('order')");
    expect(shortcutSource).toContain("openPurchaseShortcutHistory('in')");
    expect(keyupSource).not.toContain('props.disabled');
    expect(formSource).toContain(':shortcut-active="isSaleQuoteFormOpen"');
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
    expect(toolbar.indexOf('handleBatchDeleteItems')).toBeLessThan(
      toolbar.indexOf('handleOpenBatchAdjustPrice'),
    );
  });

  it('reuses the existing stock shortcut history modal from quote item rows', () => {
    expect(stockModalSource).toContain('openShortcutHistory');
    expect(stockModalSource).toContain('defineExpose({');
    expect(saleStockModalSource).toContain('openShortcutHistory');
    expect(saleStockModalSource).toContain('isOpen');
    expect(saleStockModalSource).toContain('isShortcutDialogOpen');
  });

  it('shows customer-level sale price and last sale price in quote item selection', () => {
    expect(itemFormSource).toContain('customerPriceLevel?: number');
    expect(itemFormSource).toContain('suspendPriceAutoRefresh?: boolean');
    expect(itemFormSource).toContain('suspendPriceAutoRefresh: false');
    expect(itemFormSource).toContain('if (props.suspendPriceAutoRefresh)');
    expect(formSource).toContain(
      ':suspend-price-auto-refresh="isHydratingFormValues"',
    );
    expect(itemFormSource).toContain('const salePrice = pickProductPrice');
    expect(stockModalSource).toContain("field: 'lastSalePrice'");
    expect(stockModalSource).toContain('pickCustomerLevelSalePrice');
    expect(saleStockModalSource).toContain('customerPriceLevel?: number');
  });

  it('formats editable money to two decimals and compactly displays other numbers', () => {
    expect(itemFormSource).toContain('formatSaleDecimal(row.count)');
    expect(itemFormSource).toContain(
      'formatSaleAmount(row.productPrice)',
    );
    expect(itemFormSource).toContain(
      '@update:value="row.countTextDirty = true"',
    );
    expect(itemFormSource).toContain(
      '@update:value="row.productPriceTextDirty = true"',
    );
    expect(itemFormSource).toContain('resolveCountInputValue(row)');
    expect(itemFormSource).toContain('resolveProductPriceInputValue(row)');
    expect(itemFormSource).toContain('if (!row.countTextDirty)');
    expect(itemFormSource).toContain('if (!row.productPriceTextDirty)');
  });

  it('adds both quote stock entry points directly and keeps zero-price validation', () => {
    expect(itemFormSource).not.toContain('StockSelectionReviewModal');
    expect(itemFormSource).not.toContain(':before-confirm=');
    expect(itemFormSource).not.toContain('applyReviewedStockValues');
    expect(itemFormSource).toContain('count: 1');
    expect(itemFormSource).toContain('productPrice: salePrice');
    expect(itemFormSource).toContain('void insertStockProducts(products);');
    expect(itemFormSource).not.toContain('产品单价不能为空且必须大于 0');
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
      itemFormSource.indexOf('function handleGiftFlagChange'),
    );
    expect(rowChange).toContain('if (activeItemSort.value)');
    expect(rowChange).not.toContain('void refreshItemGrid();');
  });

  it('reassigns the flexible trailing column after column settings change', () => {
    expect(itemFormSource).toContain(
      'applySaleDocumentItemColumnCustomization',
    );
    expect(itemFormSource).toContain('custom: handleItemColumnCustom');
    expect(itemFormSource).toContain('settleVxeColumnCustomization');
    expect(itemFormSource).toContain(
      "type === 'reset' ? buildItemColumns() : buildCustomizedItemColumns()",
    );
    expect(itemFormSource).toContain('buildCustomizedItemColumns(displayData)');
  });

  it('uses text-style decimal inputs and keeps operation actions distinct', () => {
    expect(itemFormSource).toContain('inputmode="decimal"');
    expect(itemFormSource).toContain('autocomplete="off"');
    expect(itemFormSource).toContain('icon: ACTION_ICON.DELETE');
    expect(itemFormSource).toContain('custom: true');
    expect(itemFormSource).toContain('refresh: true');
    expect(itemFormSource).toContain('zoom: true');
  });

  it('keeps batch price and delete actions without warehouse/dept editing', () => {
    const toolbar = itemFormSource.slice(
      itemFormSource.indexOf('<template #toolbar-tools>'),
      itemFormSource.indexOf(
        '<template #productId=',
        itemFormSource.indexOf('<template #toolbar-tools>'),
      ),
    );

    expect(itemFormSource).toContain('SaleBatchAdjustPriceForm');
    expect(itemFormSource).toContain(
      'const canShowBatchAdjustPrice = computed(',
    );
    expect(toolbar).not.toContain('handleOpenBatchUpdateItems');
    expect(toolbar).not.toContain('批量修改仓库/部门');
    expect(toolbar).toContain('handleOpenBatchAdjustPrice');
    expect(toolbar).toContain('批量调整价格');
    expect(toolbar.indexOf('批量删除')).toBeLessThan(
      toolbar.indexOf('批量调整价格'),
    );
  });

  it('uses price-level batch payload for quote server updates and local recalculation', () => {
    const serverHandler = itemFormSource.slice(
      itemFormSource.indexOf('async function handleBatchAdjustPriceSuccess'),
      itemFormSource.indexOf(
        'function isSelectedBatchItemRow',
        itemFormSource.indexOf('async function handleBatchAdjustPriceSuccess'),
      ),
    );
    const localBuilder = itemFormSource.slice(
      itemFormSource.indexOf('function buildBatchUpdatedItems'),
      itemFormSource.indexOf(
        'function hasDuplicateBatchUpdatedItems',
        itemFormSource.indexOf('function buildBatchUpdatedItems'),
      ),
    );

    expect(serverHandler).toContain('batchUpdateSaleQuoteItems({');
    expect(serverHandler).toContain('priceLevel: payload.priceLevel');
    expect(itemFormSource).not.toContain('getPriceSystemProductPriceMap');
    expect(localBuilder).not.toContain('priceSystemPriceMap');
    expect(localBuilder).not.toContain('payload.priceSystemId');
    expect(localBuilder).toContain('payload.priceLevel');
    expect(localBuilder).toContain(
      'row.productPrice = row.giftFlag ? 0 : salePrice;',
    );
  });

  it('shows batch numbers when opening the sale quote stock selector', () => {
    expect(itemFormSource).toContain('show-batch-no');
    expect(itemFormSource).toContain('mergeCurrentBatchNoOption');
    expect(itemFormSource).toContain('availableCount: row.stockCount');
    expect(itemFormSource).toContain(
      'const batchNo = normalizeBatchNoValue(p.batchNo) || undefined',
    );
    expect(itemFormSource).toContain(
      'const batchNoEnabled = isBatchNoEnabled(p.batchNoEnabled) || !!batchNo',
    );
    expect(itemFormSource).toContain(
      'normalizeBatchNoValue(item.value) === currentBatchNo',
    );
    expect(itemFormSource).toContain(
      '产品、仓库、批次、赠品标识重复，请合并后再提交',
    );
  });
});
