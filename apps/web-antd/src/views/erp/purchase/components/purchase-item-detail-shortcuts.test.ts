import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { purchaseStockColumns } from './purchase-stock-columns';

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(
  join(currentDir, 'PurchaseItemDetailShortcuts.vue'),
  'utf8',
);
const purchaseInItemSource = readFileSync(
  join(currentDir, '../in/modules/item-form.vue'),
  'utf8',
);
const inlineStockSelectSource = readFileSync(
  join(currentDir, 'PurchaseInlineStockSelect.vue'),
  'utf8',
);
const purchaseInDataSource = readFileSync(
  join(currentDir, '../in/data.ts'),
  'utf8',
);
const purchaseInApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/in/index.ts'),
  'utf8',
);
const purchaseHistoryApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/history/index.ts'),
  'utf8',
);
const stockApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/stock/stock/index.ts'),
  'utf8',
);
const purchaseReturnItemSource = readFileSync(
  join(currentDir, '../return/modules/item-form.vue'),
  'utf8',
);
const purchaseReturnFormSource = readFileSync(
  join(currentDir, '../return/modules/form.vue'),
  'utf8',
);
const purchaseReturnDataSource = readFileSync(
  join(currentDir, '../return/data.ts'),
  'utf8',
);
const purchaseReturnApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/return/index.ts'),
  'utf8',
);

describe('purchase item detail shortcuts', () => {
  it('uses the unified approved purchase-in and return history page', () => {
    expect(componentSource).toContain('getPurchaseHistoryPage');
    expect(componentSource).not.toContain('getPurchaseInPage');
    expect(componentSource).toContain("dataIndex: 'documentType'");
    expect(componentSource).toContain("dataIndex: 'documentNo'");
    expect(componentSource).toContain("title: '单号'");
    expect(componentSource).toContain("dataIndex: 'businessTime'");
    expect(componentSource).toContain('record.rowKey || record.id');
    expect(componentSource).toContain(
      "record.documentTypeCode === 'PURCHASE_RETURN'",
    );
    expect(componentSource).toContain('openPurchaseReturnDetail(record)');
    expect(componentSource).toContain('closeHistoryBeforeDetailNavigation');
    expect(componentSource).toContain('<PurchaseReturnDetailModal');
    expect(purchaseHistoryApiSource).toContain("'/erp/purchase-history/page'");
    expect(purchaseHistoryApiSource).toContain(
      "'PURCHASE_IN' | 'PURCHASE_RETURN'",
    );
    expect(purchaseHistoryApiSource).toContain(
      'documentTypeCode?: DocumentType;',
    );
    expect(componentSource).toContain(
      "type PurchaseHistoryMode = 'history' | 'in' | 'order'",
    );
    expect(componentSource).toContain(
      "{ documentTypeCode: 'PURCHASE_IN' as const }",
    );
    expect(componentSource).toContain("return '采购入库记录';");
  });

  it('adds purchase inbound and return stock directly without a review modal', () => {
    expect(inlineStockSelectSource).not.toContain('beforeConfirm');
    expect(inlineStockSelectSource).not.toContain('confirming');
    expect(inlineStockSelectSource).toContain(
      "emit('select', rows, props.row);",
    );
    for (const source of [purchaseInItemSource, purchaseReturnItemSource]) {
      expect(source).not.toContain('StockSelectionReviewModal');
      expect(source).not.toContain('handleBeforeInlineStockConfirm');
      expect(source).not.toContain(':before-confirm=');
      expect(source).not.toContain('isStockSelectionReviewOpen');
      expect(source).toContain('count: 1');
    }
    expect(purchaseReturnItemSource).toContain(
      'product.lastPurchasePrice ?? product.currentPrice ?? 0',
    );
    expect(purchaseInItemSource).toContain(
      'p.lastPurchasePrice ?? p.currentPrice ?? 0',
    );
  });

  it('provides Insert plus purchase, sale, quote and product shortcuts from detail item tables', () => {
    const keydownShortcutSource = componentSource.slice(
      componentSource.indexOf('function handleShortcut(event: KeyboardEvent)'),
      componentSource.indexOf('function handleShortcutKeyup'),
    );
    const createShortcutIndex = keydownShortcutSource.indexOf(
      'if (props.createEnabled && isCreateShortcutKey(event))',
    );
    const ignoreTargetIndex = keydownShortcutSource.indexOf(
      'if (shouldIgnoreShortcutTarget(event))',
    );
    const historyShortcutIndex = keydownShortcutSource.indexOf(
      'purchaseHistoryShortcutController.handleKeydown(event)',
    );
    const createShortcutBlock = keydownShortcutSource.slice(
      createShortcutIndex,
      ignoreTargetIndex,
    );

    expect(componentSource).toContain('isCreateShortcutKey(event)');
    expect(componentSource).toContain("emit('create')");
    expect(createShortcutIndex).toBeGreaterThan(-1);
    expect(ignoreTargetIndex).toBeGreaterThan(createShortcutIndex);
    expect(historyShortcutIndex).toBeGreaterThan(ignoreTargetIndex);
    expect(componentSource).toContain('function isShortcutOverlayTarget');
    expect(createShortcutBlock).toContain('isShortcutDialogOpen()');
    expect(createShortcutBlock).toContain(
      'isShortcutOverlayTarget(event.target)',
    );
    expect(createShortcutBlock.indexOf('isShortcutDialogOpen()')).toBeLessThan(
      createShortcutBlock.indexOf('event.preventDefault()'),
    );
    expect(componentSource).toContain(
      'createPurchaseHistoryShortcutController',
    );
    expect(componentSource).toContain(
      "onHistory: () => void openPurchaseHistory('history')",
    );
    expect(componentSource).toContain(
      "onOrderHistory: () => void openPurchaseHistory('order')",
    );
    expect(componentSource).toContain(
      'function handleShortcutKeyup(event: KeyboardEvent)',
    );
    expect(componentSource).toContain('handleShortcutKeyup,');
    expect(componentSource).toContain('resetPendingShortcutState');
    expect(componentSource).toContain('historyEnabled?: boolean;');
    expect(componentSource).toContain('productEditEnabled?: boolean;');
    expect(componentSource).not.toContain("if (event.key === 'Enter')");
    expect(componentSource).toContain(
      "if (props.productEditEnabled && key === 'f')",
    );
    expect(componentSource).toContain('function isCheckableControlTarget');
    expect(componentSource).toContain(
      "['checkbox', 'radio'].includes(input.type)",
    );
    expect(componentSource).toContain('function shouldIgnoreShortcutTarget');
    expect(componentSource).toContain(
      "if (key === 'f' && isCheckableControlTarget(event.target))",
    );
    expect(componentSource).toContain('shouldIgnoreShortcutTarget(event)');
    expect(componentSource).toContain('props.isStockSelectorOpen?.() === true');
    expect(componentSource).not.toContain(
      '.ant-select-dropdown, .ant-picker-dropdown, .ant-popover, .ant-modal',
    );
    expect(componentSource).not.toContain("if (key === 'w')");
    expect(componentSource).toContain(
      "if (props.saleHistoryEnabled && key === 's')",
    );
    expect(componentSource).toContain(
      "if (props.saleHistoryEnabled && key === 'q')",
    );
    expect(componentSource).toContain('openSaleShortcutHistory');
    expect(componentSource).toContain('<SaleStockProductSelectModal');
  });

  it('keeps product edit permission checks without document department blocking', () => {
    const purchaseInShortcutUsage = purchaseInItemSource.slice(
      purchaseInItemSource.indexOf('<PurchaseItemDetailShortcuts'),
      purchaseInItemSource.indexOf(
        '@product-updated="handleShortcutProductUpdated"',
        purchaseInItemSource.indexOf('<PurchaseItemDetailShortcuts'),
      ),
    );
    const purchaseReturnShortcutUsage = purchaseReturnItemSource.slice(
      purchaseReturnItemSource.indexOf('<PurchaseItemDetailShortcuts'),
      purchaseReturnItemSource.indexOf(
        '@product-updated="handleShortcutProductUpdated"',
        purchaseReturnItemSource.indexOf('<PurchaseItemDetailShortcuts'),
      ),
    );

    expect(componentSource).toContain(
      "hasAccessByCodes(['erp:product:update'])",
    );
    expect(componentSource).toContain(
      "productFormModalApi.setData({ type: 'edit', id: row.productId }).open()",
    );
    expect(componentSource).not.toContain('该商品不属于当前单据部门，不能修改');
    expect(componentSource).not.toContain('props.deptId !== row.deptId');
    expect(purchaseInShortcutUsage).toContain(':dept-id="props.deptId"');
    expect(purchaseInShortcutUsage).toContain(':sale-history-enabled="true"');
    expect(purchaseReturnShortcutUsage).not.toContain(
      ':dept-id="props.deptId"',
    );
  });

  it('enables the shortcut hint, active row, and last purchase price in purchase-in items', () => {
    expect(purchaseInItemSource).toContain('PurchaseItemDetailShortcuts');
    expect(purchaseInItemSource).toContain(
      "window.addEventListener('keydown', handleShortcut, true)",
    );
    expect(purchaseInItemSource).toContain(
      "window.addEventListener('keyup', handleShortcutKeyup, true)",
    );
    expect(purchaseInItemSource).toContain(
      "window.removeEventListener('keydown', handleShortcut, true)",
    );
    expect(purchaseInItemSource).toContain(
      "window.removeEventListener('keyup', handleShortcutKeyup, true)",
    );
    expect(purchaseInItemSource).toContain(
      '<span><kbd>Shift</kbd><b>采购订单历史</b></span>',
    );
    expect(purchaseInItemSource).toContain(
      '<span><kbd>S</kbd><b>销售历史</b></span>',
    );
    expect(purchaseInItemSource).toContain(
      '<span><kbd>Q</kbd><b>报价订单历史</b></span>',
    );
    expect(purchaseInItemSource).not.toContain(
      '<span><kbd>Enter</kbd><b>采购订单历史</b></span>',
    );
    expect(purchaseInItemSource).toContain(':create-enabled="!props.disabled"');
    expect(purchaseInItemSource).toContain('@create="handleAddBlankItemRow"');
    expect(purchaseInItemSource).toContain('function handleAddBlankItemRow()');
    expect(purchaseInItemSource).toContain('PurchaseInlineStockSelect');
    expect(inlineStockSelectSource).toContain(
      'data-purchase-inline-stock-select-input="true"',
    );
    expect(inlineStockSelectSource).toContain(
      ':data-purchase-inline-stock-row-key="inputRowKey"',
    );
    expect(purchaseInItemSource).toMatch(
      /\[data-purchase-inline-stock-row-key="\$\{escapeAttrValue\(rowKey\)\}"\]/,
    );
    expect(purchaseInItemSource).not.toContain(
      'data-purchase-in-product-row-key',
    );
    expect(inlineStockSelectSource).toContain(
      '.purchase-inline-stock-select-input.ant-input-affix-wrapper',
    );
    expect(inlineStockSelectSource).toContain('height: 32px;');
    expect(inlineStockSelectSource).toContain('min-height: 32px;');
    expect(inlineStockSelectSource).toContain('height: 30px;');
    expect(inlineStockSelectSource).toContain('line-height: 30px;');
    expect(inlineStockSelectSource).toContain('font-size: 11px;');
    expect(inlineStockSelectSource).toContain(
      ':global(.purchase-inline-stock-select-input.ant-input-affix-wrapper)',
    );
    expect(inlineStockSelectSource).toMatch(
      /:global\(\s*\.purchase-inline-stock-select-input\.ant-input-affix-wrapper\s+\.ant-input::placeholder\s*\)/,
    );
    expect(purchaseInItemSource).toContain('focusProductNameInput(row)');
    expect(inlineStockSelectSource).toContain('getPurchaseStockPage({');
    expect(inlineStockSelectSource).toContain(
      'productCodeNameKeyword: keyword || undefined',
    );
    expect(inlineStockSelectSource).toContain('showBatchNo: true');
    expect(purchaseStockColumns).toContainEqual(
      expect.objectContaining({
        field: 'mainImage',
        title: '图片',
        kind: 'image',
      }),
    );
    expect(inlineStockSelectSource).toContain('hasStockImage(stock)');
    expect(inlineStockSelectSource).toContain('handleImageError');
    expect(inlineStockSelectSource).toContain(
      'purchase-inline-stock-select-thumb',
    );
    expect(inlineStockSelectSource).toContain(
      'purchase-inline-stock-image-preview',
    );
    expect(inlineStockSelectSource).toContain(
      'purchase-inline-stock-select-no-image',
    );
    expect(purchaseInItemSource).toContain(
      'purchase-document-item-shortcut-hint',
    );
    expect(purchaseInItemSource).toContain(
      'purchase-document-item-row--active',
    );
    expect(purchaseInItemSource).toContain('rowClassName: getItemRowClassName');
    expect(purchaseInItemSource).toContain('inlineStockSelectorOpen.value');
    expect(purchaseInItemSource).toContain(
      'lastPurchasePrice: p.lastPurchasePrice',
    );
    expect(purchaseInDataSource).toContain("field: 'lastPurchasePrice'");
    expect(purchaseInDataSource).toContain("title: '最后采购价'");
    expect(purchaseInApiSource).toContain('lastPurchasePrice?: number;');
    expect(stockApiSource).toContain('mainImage?: string;');
  });

  it('enables the shortcut hint, active row, and last purchase price in purchase-return items', () => {
    expect(purchaseReturnItemSource).toContain('PurchaseItemDetailShortcuts');
    expect(purchaseReturnItemSource).toContain(
      "window.addEventListener('keydown', handleShortcut, true)",
    );
    expect(purchaseReturnItemSource).toContain(
      "window.addEventListener('keyup', handleShortcutKeyup, true)",
    );
    expect(purchaseReturnItemSource).toContain(
      "window.removeEventListener('keydown', handleShortcut, true)",
    );
    expect(purchaseReturnItemSource).toContain(
      "window.removeEventListener('keyup', handleShortcutKeyup, true)",
    );
    expect(purchaseReturnItemSource).toContain(
      '<span><kbd>Shift</kbd><b>采购订单历史</b></span>',
    );
    expect(purchaseReturnItemSource).not.toContain(
      '<span><kbd>Enter</kbd><b>采购订单历史</b></span>',
    );
    expect(purchaseReturnItemSource).toContain(
      ':create-enabled="canUseInlineStockSelector"',
    );
    expect(purchaseReturnItemSource).toContain(
      '@create="handleAddBlankItemRow"',
    );
    expect(purchaseReturnItemSource).toContain('PurchaseInlineStockSelect');
    expect(purchaseReturnItemSource).toContain(
      'purchase-document-item-shortcut-hint',
    );
    expect(purchaseReturnItemSource).toContain(
      'purchase-document-item-row--active',
    );
    expect(purchaseReturnItemSource).toContain(
      'rowClassName: getItemRowClassName',
    );
    expect(purchaseReturnItemSource).toContain(
      ':is-stock-selector-open="() => inlineStockSelectorOpen"',
    );
    expect(purchaseReturnFormSource).not.toContain(
      'function isProductSelectorOpen',
    );
    expect(purchaseReturnFormSource).not.toContain(
      ':is-stock-selector-open="isProductSelectorOpen"',
    );
    expect(purchaseReturnItemSource).toContain(
      'lastPurchasePrice: product.lastPurchasePrice',
    );
    expect(purchaseReturnDataSource).toContain("field: 'lastPurchasePrice'");
    expect(purchaseReturnDataSource).toContain("title: '最后采购价'");
    expect(purchaseReturnApiSource).toContain('lastPurchasePrice?: number;');
  });
});
