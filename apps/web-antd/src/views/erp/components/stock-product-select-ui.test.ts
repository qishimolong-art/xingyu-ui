import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  defaultColumns,
  normalizeColumns,
} from '../composables/useInlineColumnSettings';
import { purchaseStockColumns } from '../purchase/components/purchase-stock-columns';
import { inlineStockColumns } from './inline-stock-columns';
import {
  formatStockSelectionCount,
  formatStockSelectionPrice,
  getStockSelectionRowClassName,
  isStockSelectionReadonly,
  normalizeSaleHistoryCount,
  STOCK_SELECTION_DISTRIBUTION_ROW_CLASS,
} from './stock-product-select-ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const modalSource = readFileSync(
  join(currentDir, 'StockProductSelectModal.vue'),
  'utf8',
);
const inlineStockSelectSource = readFileSync(
  join(currentDir, 'ErpInlineStockSelect.vue'),
  'utf8',
);
const inlineStockColumnsSource = readFileSync(
  join(currentDir, 'inline-stock-columns.ts'),
  'utf8',
);
const purchaseInlineStockSelectSource = readFileSync(
  join(currentDir, '../purchase/components/PurchaseInlineStockSelect.vue'),
  'utf8',
);
const stockCheckItemSource = readFileSync(
  join(currentDir, '../stock/check/modules/item-form.vue'),
  'utf8',
);
const stockCheckFormSource = readFileSync(
  join(currentDir, '../stock/check/modules/form.vue'),
  'utf8',
);
const stockOutItemSource = readFileSync(
  join(currentDir, '../stock/out/modules/item-form.vue'),
  'utf8',
);
const stockOutFormSource = readFileSync(
  join(currentDir, '../stock/out/modules/form.vue'),
  'utf8',
);
const stockTransferOutItemSource = readFileSync(
  join(currentDir, '../stock/transfer-out/modules/item-form.vue'),
  'utf8',
);
const stockTransferOutFormSource = readFileSync(
  join(currentDir, '../stock/transfer-out/modules/form.vue'),
  'utf8',
);
const stockInItemSource = readFileSync(
  join(currentDir, '../stock/in/modules/item-form.vue'),
  'utf8',
);
const stockMoveItemSource = readFileSync(
  join(currentDir, '../stock/move/modules/item-form.vue'),
  'utf8',
);
const warehouseMoveItemSource = readFileSync(
  join(currentDir, '../stock/warehouse-move/modules/item-form.vue'),
  'utf8',
);
const warehouseMoveSelectSource = readFileSync(
  join(currentDir, '../stock/warehouse-move/modules/stock-select-modal.vue'),
  'utf8',
);
const purchaseSelectSource = readFileSync(
  join(
    currentDir,
    '../purchase/components/PurchaseStockProductSelectModal.vue',
  ),
  'utf8',
);
const saleSelectSource = readFileSync(
  join(currentDir, '../sale/components/SaleStockProductSelectModal.vue'),
  'utf8',
);
const saleOrderItemSource = readFileSync(
  join(currentDir, '../sale/order/modules/item-form.vue'),
  'utf8',
);
const saleOrderFormSource = readFileSync(
  join(currentDir, '../sale/order/modules/form.vue'),
  'utf8',
);
const saleCartItemSource = readFileSync(
  join(currentDir, '../sale/cart/modules/item-form.vue'),
  'utf8',
);
const saleCartFormSource = readFileSync(
  join(currentDir, '../sale/cart/modules/form.vue'),
  'utf8',
);
const saleQuoteItemSource = readFileSync(
  join(currentDir, '../sale/quote/modules/item-form.vue'),
  'utf8',
);
const saleQuoteFormSource = readFileSync(
  join(currentDir, '../sale/quote/modules/form.vue'),
  'utf8',
);
const saleReturnItemSource = readFileSync(
  join(currentDir, '../sale/return/modules/item-form.vue'),
  'utf8',
);
const saleReturnFormSource = readFileSync(
  join(currentDir, '../sale/return/modules/form.vue'),
  'utf8',
);
const purchaseOrderItemSource = readFileSync(
  join(currentDir, '../purchase/order/modules/item-form.vue'),
  'utf8',
);
const purchaseOrderFormSource = readFileSync(
  join(currentDir, '../purchase/order/modules/form.vue'),
  'utf8',
);
const purchaseInItemSource = readFileSync(
  join(currentDir, '../purchase/in/modules/item-form.vue'),
  'utf8',
);
const purchaseInFormSource = readFileSync(
  join(currentDir, '../purchase/in/modules/form.vue'),
  'utf8',
);
const purchaseReturnItemSource = readFileSync(
  join(currentDir, '../purchase/return/modules/item-form.vue'),
  'utf8',
);
const purchaseReturnFormSource = readFileSync(
  join(currentDir, '../purchase/return/modules/form.vue'),
  'utf8',
);

describe('stock product selection read-only rows', () => {
  it('uses the agreed inline stock default order and preserves saved custom order', () => {
    const expectedFields = [
      'batchNo',
      'warehouseName',
      'deptName',
      'mainImage',
      'productCode',
      'productName',
      'count',
      'availableCount',
      'lastSalePrice',
      'sharePrice',
      'retailPrice',
      'occupiedCount',
      'pendingInCount',
      'inTransitCount',
      'unitName',
      'productPurchasePrice',
      'salePrice',
      'minPrice',
      'referencePrice',
      'lastPurchasePrice',
      'grossProfitRate',
      'backupPrice1',
      'wholesalePrice',
      'brand',
      'vehicleModel',
      'originPlace',
      'standard',
      'drawingNo',
      'factoryCode',
      'shelf',
    ];
    expect(inlineStockColumns.map(({ field }) => field)).toEqual(
      expectedFields,
    );
    expect(purchaseStockColumns.map(({ field }) => field)).toEqual(
      expectedFields,
    );

    const saved = defaultColumns(inlineStockColumns).toReversed();
    expect(
      normalizeColumns(saved, inlineStockColumns).map(({ field }) => field),
    ).toEqual(saved.map(({ field }) => field));
  });

  it('sizes both inline stock popovers from the viewport without a 1280px cap', () => {
    [inlineStockSelectSource, purchaseInlineStockSelectSource].forEach(
      (source) => {
        expect(source).toContain('Math.max(0, window.innerWidth - 48)');
        expect(source).toContain('width: calc(100vw - 48px);');
        expect(source).toContain('max-width: calc(100vw - 48px);');
        expect(source).not.toContain('min(1280px, calc(100vw - 48px))');
      },
    );
  });

  it('limits inline stock input to product-code-or-name keywords and keeps full-modal search unchanged', () => {
    [inlineStockSelectSource, purchaseInlineStockSelectSource].forEach(
      (source) => {
        expect(source).toContain(
          "placeholder: '配件编码/名称（支持空格组合搜索）'",
        );
        expect(source).toContain(
          'productCodeNameKeyword: keyword || undefined',
        );
        expect(source).not.toContain(
          'productNameKeyword: keyword || undefined',
        );
        expect(source).not.toContain('productKeyword: keyword || undefined');
        expect(source).not.toContain('crossDimensionKeyword: true');
        expect(source).not.toContain('keyword: keyword || undefined');
      },
    );
    expect(modalSource).toContain('crossDimensionKeyword: true');
  });

  it('keeps product source wide and makes stock source compact', () => {
    expect(
      modalSource.match(/field: 'productName', title: '名称', width: 260/g),
    ).toHaveLength(1);
    expect(modalSource).toMatch(
      /field: 'productName'[\s\S]*title: '名称'[\s\S]*showOverflow: STOCK_SELECT_COLUMN_TOOLTIP[\s\S]*width: 180/,
    );
    expect(modalSource).toMatch(
      /field: 'warehouseName'[\s\S]*fixed: 'left'[\s\S]*showOverflow: STOCK_SELECT_COLUMN_TOOLTIP[\s\S]*title: '仓库'[\s\S]*width: 96/,
    );
    expect(modalSource).toContain(
      ':deep(.stock-product-select-grid--fullscreen .vxe-body--column)',
    );
  });

  it('only treats distributed stock as read-only when the caller opts in', () => {
    const row = { readonlyBySaleDistribution: true };

    expect(isStockSelectionReadonly(row, true)).toBe(true);
    expect(isStockSelectionReadonly(row, false)).toBe(false);
    expect(getStockSelectionRowClassName({ row }, true)).toBe(
      STOCK_SELECTION_DISTRIBUTION_ROW_CLASS,
    );
    expect(getStockSelectionRowClassName({ row: {} }, true)).toBe('');
  });

  it('gates checkbox selection and explains the highlight without color alone', () => {
    expect(modalSource).toContain('checkMethod:');
    expect(modalSource).toContain('!isReadonlySelection(row)');
    expect(modalSource).toContain('autoFixed: false');
    expect(modalSource).toContain(
      '浅蓝色行表示仅因销售仓库分配而可见（只读，不可选）',
    );
    expect(stockCheckItemSource).toContain('<ErpInlineStockSelect');
    expect(stockCheckItemSource).toContain(':stock-page-api="getStockPage"');
  });

  it('keeps inline stock department validation separate from query filtering', () => {
    expect(inlineStockSelectSource).toContain('filterByDept?: boolean;');
    expect(inlineStockSelectSource).toContain('filterByDept: true');
    expect(inlineStockSelectSource).toContain(
      'if (props.requireDept && !props.deptId)',
    );
    expect(inlineStockSelectSource).toContain(
      '...(props.filterByDept ? { deptId: props.deptId } : {})',
    );
  });
});

describe('stock product selection price visibility', () => {
  it('trims meaningless zeros from stock quantities', () => {
    expect(formatStockSelectionCount('3.000')).toBe('3');
    expect(formatStockSelectionCount('0.000')).toBe('0');
    expect(formatStockSelectionCount('0.500')).toBe('0.5');
    expect(formatStockSelectionCount('1.250')).toBe('1.25');
    expect(formatStockSelectionCount('-2.500')).toBe('-2.5');
  });

  it('shows sale returns as negative movements in sale history', () => {
    expect(normalizeSaleHistoryCount(3, 'sale-out')).toBe(3);
    expect(normalizeSaleHistoryCount('2.5', 'return')).toBe(-2.5);
    expect(normalizeSaleHistoryCount(-4, 'return')).toBe(-4);
    expect(normalizeSaleHistoryCount(0, 'return')).toBe(0);
    expect(normalizeSaleHistoryCount(undefined, 'return')).toBeUndefined();
  });

  it('normalizes the merged sale history count before rendering it', () => {
    expect(modalSource).toContain(
      'count: normalizeSaleHistoryCount(\n        item.count ?? row.totalCount,\n        documentType,\n      )',
    );
  });

  it('uses the explicit stock quantity slot for every stock count column', () => {
    expect(modalSource).toContain(
      '<span>{{ formatStockSelectionCount(row.count ?? 0) }}</span>',
    );
    expect(modalSource).toContain('<template #stockCount="{ row, column }">');
    expect(modalSource).toContain('getDisplayedStockCount(row, column.field)');
    expect(
      modalSource.match(/slots: \{ default: 'stockCount' \}/gu),
    ).toHaveLength(4);
    expect(modalSource).toContain(
      'formatStockSelectionCount(getHistoryCount(record) ?? 0)',
    );
    expect(modalSource).toContain(
      'formatStockSelectionCount(getInTransitCount(record))',
    );
  });

  it('formats available prices and leaves permission-hidden values empty', () => {
    const row = {
      count: 8,
      salePrice: 88,
      referencePrice: undefined,
    };

    expect(formatStockSelectionPrice({ salePrice: 20 }, 'salePrice')).toBe(
      '20.00',
    );
    expect(formatStockSelectionPrice({ salePrice: 20.5 }, 'salePrice')).toBe(
      '20.50',
    );
    expect(formatStockSelectionPrice(row, 'salePrice')).toBe('88.00');
    expect(formatStockSelectionPrice(row, 'referencePrice')).toBe('');
  });

  it('keeps prices formatted regardless of the stock department', () => {
    const row = { deptId: 31, salePrice: 1234.5 };

    expect(formatStockSelectionPrice(row, 'salePrice')).toBe('1,234.50');
  });

  it('uses price cells and keeps sale price sorting available', () => {
    expect(modalSource).toContain("slots: { default: 'stockPrice' }");
    expect(modalSource).toContain('minWidth: undefined');
    expect(modalSource).toContain(
      "const STOCK_SELECT_COLUMN_TOOLTIP = 'tooltip' as const",
    );
    expect(modalSource).toContain(
      'showHeaderOverflow: STOCK_SELECT_COLUMN_TOOLTIP',
    );
    expect(modalSource).toContain('showOverflow: STOCK_SELECT_COLUMN_TOOLTIP');
    expect(modalSource).not.toContain('enforceSaleStockPriceVisibility');
    expect(modalSource).toContain('return props.saleDeptId ?? props.deptId;');
    expect(modalSource).toContain("props.bizType === 'sale'");
    expect(modalSource).toContain('sortable: true');
  });

  it('loads effective price fields with the document business department', () => {
    expect(modalSource).toContain(
      'function getPricePermissionBusinessDeptId()',
    );
    expect(modalSource).toContain(
      "return props.bizType === 'sale' ? getSaleDeptId() : props.deptId;",
    );
    expect(modalSource).toContain(
      'businessDeptId: getPricePermissionBusinessDeptId()',
    );
  });

  it('labels the product sale price as sales price in stock selection', () => {
    expect(modalSource).not.toContain("title: '售价'");
    expect(modalSource).toContain("title: '销售价'");
  });

  it('shows all fixed and custom product prices in the sale stock context', () => {
    [
      "field: 'productPurchasePrice'",
      "field: 'salePrice'",
      "field: 'lastSalePrice'",
      "field: 'minPrice'",
      "field: 'referencePrice'",
      "field: 'retailPrice'",
      "field: 'lastPurchasePrice'",
      "field: 'grossProfitRate'",
      "field: 'backupPrice1'",
      "field: 'wholesalePrice'",
      "field: 'sharePrice'",
    ].forEach((field) => expect(modalSource).toContain(field));
    expect(modalSource).toContain('buildCustomPriceFieldColumns(');
    expect(modalSource).toContain('getProductCustomFieldConfigs()');
    expect(modalSource).toContain("props.bizType === 'sale'");
    expect(modalSource).toContain("const STOCK_PRICE_MASK = '****'");
    expect(modalSource).toContain("props.bizType === 'stock'");
    expect(modalSource).toContain('function isDocumentStockPriceMaskContext()');
    expect(modalSource).toContain(
      'function shouldRetainMaskedDocumentStockPriceColumn',
    );
    expect(modalSource).toContain(
      'function shouldMaskStockPrice(field?: string)',
    );
    expect(modalSource).toContain('return STOCK_PRICE_MASK;');
    expect(modalSource).toContain(
      'salePrice: pickCustomerLevelSalePrice(row) ?? row.salePrice',
    );
    expect(modalSource).toMatch(
      /isDocumentStockPriceMaskContext\(\)\s+\? \[\]/,
    );
    expect(saleSelectSource).toContain('biz-type="sale"');
    expect(saleSelectSource).toContain('source="stock"');
    expect(saleSelectSource).toContain(':hidden-fields="props.hiddenFields"');
  });

  it('shows the same complete price set in purchase stock selection', () => {
    expect(modalSource).toContain("props.bizType === 'purchase'");
    expect(modalSource).toContain("props.bizType === 'sale'");
    expect(modalSource).toContain("const STOCK_PRICE_MASK = '****'");
    expect(modalSource).toContain(
      'function shouldDisplayStockPriceField(fieldKey: string)',
    );
    expect(modalSource).toContain(
      'function shouldMaskStockPrice(field?: string)',
    );
    expect(modalSource).toContain('return STOCK_PRICE_MASK;');
    expect(modalSource).toContain(
      'const STOCK_PRICE_MASK_EXEMPT_FIELD_KEYS = new Set([',
    );
    expect(modalSource).toMatch(
      /STOCK_PRICE_MASK_EXEMPT_FIELD_KEYS[\s\S]*'lastSalePrice'/,
    );
    expect(modalSource).toContain(
      'if (STOCK_PRICE_MASK_EXEMPT_FIELD_KEYS.has(fieldKey))',
    );
    expect(modalSource).toContain('shouldRetainMaskedDocumentStockPriceColumn');
    expect(modalSource).toMatch(
      /isDocumentStockPriceMaskContext\(\)\s+\? \[\]/,
    );
    expect(modalSource).toContain(
      'shouldDisplayStockPriceField(config.fieldName)',
    );
    expect(purchaseSelectSource).toContain('biz-type="purchase"');
    expect(purchaseSelectSource).toContain('source="stock"');
    expect(purchaseSelectSource).toContain(
      ':hidden-fields="props.hiddenFields"',
    );
    expect(purchaseOrderItemSource).toContain(
      ':hidden-fields="props.hiddenFields"',
    );
    expect(purchaseInItemSource).toContain(
      ':hidden-fields="props.hiddenFields"',
    );
    expect(purchaseReturnFormSource).toContain(':hidden-fields="hiddenFields"');
  });

  it('shows the same complete price set in inventory stock selection', () => {
    expect(modalSource).toContain("bizType?: 'purchase' | 'sale' | 'stock'");
    expect(modalSource).toContain('function isDocumentStockPriceMaskContext()');
    expect(modalSource).toMatch(
      /props\.source === 'stock'[\s\S]*props\.bizType === 'purchase'[\s\S]*props\.bizType === 'sale'[\s\S]*props\.bizType === 'stock'/,
    );
    expect(modalSource).toContain('return STOCK_PRICE_MASK;');
    expect(modalSource).toContain('shouldRetainMaskedDocumentStockPriceColumn');
    expect(modalSource).toMatch(
      /isDocumentStockPriceMaskContext\(\)\s+\? \[\]/,
    );
    [
      stockInItemSource,
      stockOutItemSource,
      stockCheckItemSource,
      stockMoveItemSource,
      stockTransferOutItemSource,
      warehouseMoveItemSource,
    ].forEach((source) => {
      expect(source).toContain('<ErpInlineStockSelect');
      expect(source).toContain(':stock-page-api="getStockPage"');
      expect(source).toContain(
        ':stock-page-params="getInlineStockPageParams()"',
      );
      expect(source).toContain(':hidden-fields="hiddenFields"');
      expect(source).toContain("bizType: 'stock'");
    });
    expect(stockTransferOutItemSource).not.toContain('source="product"');
    [
      '图片',
      '采购价',
      '销售价',
      '最后一次销售价',
      '最低价',
      '参考价',
      '零售价',
      '最后采购入库价',
      '毛利率（%）',
      '备用价1',
      '批发价',
      '股份价',
    ].forEach((title) => {
      expect(inlineStockColumnsSource).toContain(`title: '${title}'`);
    });
  });

  it('locks purchase stock selection to the document department', () => {
    expect(modalSource).toContain('function getDefaultSearchDeptId()');
    expect(modalSource).toContain('function isStockDeptLockedByDocument()');
    expect(modalSource).toContain('function getSearchDeptId(searchParams');
    expect(modalSource).toContain("props.bizType === 'purchase'");
    expect(modalSource).toContain('return props.deptId;');
    expect(modalSource).toContain(
      'await gridApi.formApi?.setValues(initialValues)',
    );
    expect(modalSource).toContain('deptId: getSearchDeptId(searchParams)');
    expect(modalSource).toContain('allowClear: !isStockDeptLockedByDocument()');
    expect(modalSource).toContain('disabled: isStockDeptLockedByDocument()');
    expect(modalSource).toContain('请先选择采购部门，再选择库存');
  });

  it('passes the document department to warehouse selectors outside sale context', () => {
    expect(modalSource).toContain('function getWarehouseSelectParams()');
    expect(modalSource).toContain('getDefaultSearchDeptId()');
    expect(modalSource).toContain('getSaleDeptId()');
  });

  it('passes the sale department to department selectors only for sale context', () => {
    expect(modalSource).toContain('function getDeptSelectParams()');
    expect(modalSource).toContain('saleDeptId: getSaleDeptId()');
    expect(modalSource).toContain(
      'allSaleProduct: props.allSaleProduct || undefined',
    );
    expect(modalSource).toContain(
      'allSaleProductPermission: props.allSaleProduct',
    );
  });

  it('keeps purchase order shortcuts opt-in and preserves hidden price permissions', () => {
    expect(modalSource).toContain('enablePurchaseOrderShortcuts?: boolean');
    expect(modalSource).toContain('enableSaleStockShortcuts?: boolean');
    expect(modalSource).toContain('enableStockShortcuts?: boolean');
    expect(modalSource).toContain('isOpen: () => open.value');
    expect(purchaseSelectSource).toContain(
      'return selectModalRef.value?.isOpen?.() === true;',
    );
    expect(modalSource).toContain('purchaseOrderShortcutsEnabled');
    expect(modalSource).toContain('saleStockShortcutsEnabled');
    expect(modalSource).toContain('stockShortcutsEnabled');
    expect(modalSource).toContain('historySelectionShortcutsEnabled');
    expect(modalSource).toContain('selectionShortcutsEnabled');
    expect(modalSource).toContain('return isOrderHistoryShiftKey(event);');
    expect(modalSource).toContain(
      'function handleSelectionKeyup(event: KeyboardEvent)',
    );
    expect(modalSource).toContain('pendingOrderHistoryShift');
    expect(modalSource).toContain('!selectionShortcutsEnabled.value');
    expect(modalSource).toContain('<kbd>Shift</kbd');
    expect(modalSource).toContain("'报价订单历史' : '采购订单历史'");
    expect(modalSource).toContain("void openPurchaseOrderHistory('order')");
    expect(modalSource).toContain(
      "event.key === ' ' || event.code === 'Space'",
    );
    expect(modalSource).toContain("void openPurchaseOrderHistory('history')");
    expect(modalSource).toContain("key === 'f'");
    expect(modalSource).not.toContain("key === 'w'");
    expect(modalSource).not.toContain("key === 'q'");
    expect(modalSource).toContain('applySelectColumnPermission(');
    expect(modalSource).toContain('isSelectFieldHidden(String(field))');
  });

  it('removes W and Q utility shortcuts from stock selection', () => {
    expect(modalSource).not.toContain('<kbd>W</kbd>');
    expect(modalSource).not.toContain('<kbd>Q</kbd>');
    expect(modalSource).not.toContain('showAllPriceFields');
    expect(modalSource).not.toContain('allPriceShortcutLabel');
    expect(modalSource).not.toContain('stockUtilityShortcutsEnabled');
    expect(saleSelectSource).toContain('biz-type="sale"');
    expect(saleSelectSource).toContain(
      ':enable-sale-stock-shortcuts="props.enableSaleStockShortcuts"',
    );
  });

  it('captures stock shortcut keys before inactive document grids can handle them', () => {
    expect(modalSource).toContain(
      'function isSelectionShortcutKey(event: KeyboardEvent)',
    );
    expect(modalSource).toContain('event.stopImmediatePropagation();');
    expect(modalSource).toContain(
      "window.addEventListener('keydown', handleSelectionKeydown, true)",
    );
    expect(modalSource).toContain(
      "window.addEventListener('keyup', handleSelectionKeyup, true)",
    );
    expect(modalSource).toContain(
      "window.removeEventListener('keydown', handleSelectionKeydown, true)",
    );
    expect(modalSource).toContain(
      "window.removeEventListener('keyup', handleSelectionKeyup, true)",
    );
  });

  it('adds stock keyboard navigation while preserving existing shortcuts', () => {
    expect(modalSource).toContain(
      'const stockSelectionKeyboardNavigationEnabled = computed(',
    );
    expect(modalSource).toContain('stockShortcutsEnabled.value');
    expect(modalSource).toContain("props.bizType === 'purchase'");
    expect(modalSource).toContain("props.bizType === 'sale'");
    expect(modalSource).toContain("props.bizType === 'stock'");
    expect(modalSource).toContain("props.source === 'stock'");
    expect(modalSource).toContain(
      'isCurrent: stockSelectionKeyboardNavigationEnabled.value',
    );
    expect(modalSource).toContain('function setFirstCurrentPageRow()');
    expect(modalSource).toContain('function moveCurrentPageActiveRow');
    expect(modalSource).toContain(
      'const nextIndex = (currentIndex + offset + rows.length) % rows.length;',
    );
    expect(modalSource).toContain(
      'function getStockSelectionPageTarget(direction: -1 | 1)',
    );
    expect(modalSource).toContain(
      "if (typeof grid.setCurrentPage === 'function')",
    );
    expect(modalSource).toContain('await grid.setCurrentPage(targetPage);');
    expect(modalSource).toContain('pager.currentPage = targetPage;');
    expect(modalSource).toContain("await grid.commitProxy?.('query');");
    expect(modalSource).not.toContain("commitProxy?.('page'");
    expect(modalSource).toContain(
      'function isStockSelectionKeyboardShortcutKey(event: KeyboardEvent)',
    );
    expect(modalSource).toContain("event.key === 'ArrowUp'");
    expect(modalSource).toContain("event.key === 'ArrowDown'");
    expect(modalSource).toContain("event.key === 'ArrowLeft'");
    expect(modalSource).toContain("event.key === 'ArrowRight'");
    expect(modalSource).toContain("event.key === 'Insert'");
    expect(modalSource).toContain('!event.shiftKey');
    expect(modalSource).toContain(
      'function handleStockSelectionKeyboardShortcut(event: KeyboardEvent)',
    );
    expect(modalSource).toContain('return toggleActiveRowSelection();');
    expect(modalSource).toContain('shouldIgnoreSelectionShortcutTarget(event)');
    expect(modalSource).toContain('<kbd>↑ / ↓</kbd>');
    expect(modalSource).toContain('<kbd>← / →</kbd>');
    expect(modalSource).toContain('<kbd>Insert</kbd>');
    expect(modalSource).toContain('<kbd>Space</kbd');
    expect(modalSource).toContain('<kbd>Shift</kbd');
    expect(modalSource).toContain('<kbd>F</kbd>');
    expect(modalSource).toContain('v-if="historySelectionShortcutsEnabled"');
    expect(modalSource).toContain('handleEnterConfirm(event)');
  });

  it('routes enabled inventory stock forms into shared stock keyboard navigation', () => {
    for (const source of [
      stockInItemSource,
      stockOutItemSource,
      stockCheckItemSource,
      stockMoveItemSource,
      stockTransferOutItemSource,
      warehouseMoveItemSource,
    ]) {
      expect(source).toContain('<ErpInlineStockSelect');
      expect(source).toContain(':stock-page-api="getStockPage"');
      expect(source).toContain('function handleGlobalInsertShortcut');
      expect(source).toContain('void handleAddBlankItemRow();');
      expect(source).toContain('@open-change="handleInlineStockOpenChange"');
    }
    expect(stockTransferOutItemSource).not.toContain('source="product"');
    expect(inlineStockSelectSource).toContain("event.key === 'ArrowUp'");
    expect(inlineStockSelectSource).toContain("event.key === 'ArrowDown'");
    expect(inlineStockSelectSource).toContain("event.key === 'ArrowLeft'");
    expect(inlineStockSelectSource).toContain("event.key === 'ArrowRight'");
    expect(inlineStockSelectSource).toContain("event.key === 'Insert'");
    expect(inlineStockSelectSource).toContain("event.key === 'Enter'");
    expect(inlineStockSelectSource).toContain('toggleActiveSelection()');
    expect(inlineStockSelectSource).toContain('confirmSelection()');
  });

  it('keeps product-source inventory selectors out of stock keyboard navigation', () => {
    expect(stockMoveItemSource).toContain('<ErpInlineStockSelect');
    expect(stockMoveItemSource).not.toContain('source="product"');
    expect(stockMoveItemSource).not.toContain('enable-stock-shortcuts');
    expect(modalSource).toContain("props.source === 'stock'");
    expect(modalSource).toContain('stockShortcutsEnabled');
  });

  it('keeps stock shortcut hints readable in narrow layouts', () => {
    expect(modalSource).toContain("'选择库存明细 / 采购快捷键'");
    expect(modalSource).toContain('.stock-select-shortcuts__keys {');
    expect(modalSource).toContain('display: flex;');
    expect(modalSource).toContain('flex-wrap: wrap;');
    expect(modalSource).toContain('white-space: nowrap;');
    expect(modalSource).not.toContain(
      'grid-template-columns: repeat(auto-fit, minmax(0, max-content));',
    );
  });

  it('makes the keyboard current row visually obvious', () => {
    expect(modalSource).toContain('.vxe-body--row.row--current');
    expect(modalSource).toContain('background-color: #fffbe6 !important;');
    expect(modalSource).toContain('background-color: #fff1b8 !important;');
    expect(modalSource).toContain('inset 4px 0 0 #faad14');
  });

  it('submits stock selector search when pressing Enter in search inputs only', () => {
    expect(modalSource).toContain(
      'function handleSearchEnter(event: KeyboardEvent)',
    );
    expect(modalSource).toContain(
      'function isSearchInputTarget(target: EventTarget | null)',
    );
    expect(modalSource).toContain("target.closest('.vxe-grid--form-wrapper')");
    expect(modalSource).toContain("target.closest('.ant-picker, .ant-select')");
    expect(modalSource).toContain('void gridApi.formApi.submitForm();');
    expect(modalSource).toContain('@keydown.enter.capture="handleSearchEnter"');
  });

  it('focuses the search box on open and moves focus to the grid after Enter search', () => {
    expect(modalSource).toContain(
      "const STOCK_SELECT_SEARCH_INPUT_SELECTOR = '.vxe-grid--form-wrapper input'",
    );
    expect(modalSource).toContain(
      'function focusFirstStockSelectSearchInput()',
    );
    expect(modalSource).toContain('function focusStockSelectGrid()');
    expect(modalSource).toContain(
      'stockSelectionKeyboardNavigationEnabled.value',
    );
    expect(modalSource).toContain(
      'searchInput.focus({ preventScroll: true });',
    );
    expect(modalSource).toContain('searchInput.select();');
    expect(modalSource).toContain(
      "gridFocusElement.setAttribute('tabindex', '-1');",
    );
    expect(modalSource).toContain(
      'gridFocusElement.focus({ preventScroll: true });',
    );
    expect(modalSource).toMatch(
      /shouldFocusStockGridAfterQuery\s*=\s*stockSelectionKeyboardNavigationEnabled\.value;/,
    );
    expect(modalSource).toContain('shouldFocusStockGridAfterQuery ||');
    expect(modalSource).toContain('shouldFocusStockGridAfterQuery = false;');
    expect(modalSource).toMatch(
      /await resetAndQuery\(\);\s+await nextTick\(\);\s+focusFirstStockSelectSearchInput\(\);/,
    );
    expect(modalSource).toMatch(
      /setFirstCurrentPageRow\(\);\s+if \(shouldFocusGrid\) {\s+focusStockSelectGrid\(\);/,
    );
    expect(modalSource).toContain('function queueStockSelectGridFocus()');
    expect(modalSource).toContain('queueStockSelectGridFocus();');
    expect(modalSource).toContain('setActiveRow(getCurrentPageRows()[0]);');
    expect(modalSource).toContain('grid?.clearCurrentRow?.();');
  });

  it('keeps pinyin-capable keyword search in stock selection without changing shortcuts', () => {
    expect(modalSource).toContain('createErpKeywordSearchSchema');
    expect(modalSource).toContain(
      'const searchParams = normalizeSearchParams(formValues)',
    );
    expect(modalSource).toContain('...searchParams');
    expect(modalSource).toContain('crossDimensionKeyword: true');
    expect(modalSource).toContain('getStockPage');
    expect(modalSource).toContain('filterErpBusinessPartnerOption');
    expect(modalSource).toContain(
      ':filter-option="filterErpBusinessPartnerOption"',
    );
  });

  it('enables cross-dimension keywords in every stock selection modal', () => {
    [modalSource, warehouseMoveSelectSource].forEach((source) => {
      expect(source).toContain("fieldName: 'keyword'");
      expect(source).toContain('crossDimensionKeyword: true');
      expect(source).toContain('多个条件可用逗号、/ 等符号分隔');
    });
  });

  it('preserves stock keyword spaces while keeping field-specific wildcard normalization', () => {
    expect(modalSource).toContain("field === 'keyword'");
    expect(modalSource).toContain('? params[field].trim()');
    expect(modalSource).toContain(
      ": params[field].trim().replaceAll(/\\s+/g, '%')",
    );
    expect(modalSource).toContain('多个条件可用逗号、/ 等符号分隔');
    expect(modalSource).toContain("'productCode'");
    expect(modalSource).toContain("'brand'");
  });

  it('scopes document item shortcut listeners to active keep-alive pages', () => {
    [purchaseOrderItemSource, saleQuoteItemSource].forEach((source) => {
      expect(source).toContain('onActivated');
      expect(source).toContain('onDeactivated');
      expect(source).toContain('startShortcutListening()');
      expect(source).toContain('stopShortcutListening()');
      expect(source).toContain('let isShortcutListening = false');
    });
  });

  it('renders the redesigned purchase shortcut workspace with paged history panels', () => {
    expect(modalSource).toContain(
      '!w-[100vw] stock-product-select-modal--fullscreen',
    );
    expect(modalSource).toContain('当前作用产品');
    expect(modalSource).not.toContain('按 W 固定全部价格字段到右侧');
    expect(modalSource).not.toContain(
      '已选 {{ selectedRows.length }} 条库存明细，可继续检索追加选择',
    );
    expect(modalSource).toContain('pageSize: 10');
    expect(modalSource).toContain('stock-history-panel');
    expect(modalSource).toContain('DatePicker.RangePicker');
    expect(modalSource.replace(/\s+/g, ' ')).toMatch(
      /:popup-class-name="\s*candidatePopupClass\('stock-history-filter-dropdown'\)\s*"/,
    );
    expect(modalSource).toContain('getSupplierSimpleList');
    expect(modalSource).toContain('purchaseHistoryTablePagination');
    expect(modalSource).toContain('handlePurchaseHistoryTableChange');
    expect(modalSource).toContain('closeHistoryBeforeDetailNavigation');
    expect(modalSource).toContain('reopenModalOnNextFrame');
    expect(modalSource).toContain('window.requestAnimationFrame');
    expect(modalSource).toContain(':show-sorter-tooltip="false"');
    expect(modalSource).toContain(
      ':global(.stock-history-table .ant-table-column-sorter)',
    );
    expect(modalSource).toContain('sorter: true');
    expect(modalSource).toContain(
      'formatDateTimeValue(getHistoryDate(record))',
    );
    expect(modalSource).toContain('openSupplierDetail(record)');
    expect(modalSource).toContain('openPurchaseOrderDetail(record)');
    expect(modalSource).toContain('openPurchaseInDetail(record)');
    expect(modalSource).toContain('getPurchaseHistoryPage');
    expect(modalSource).not.toContain('getPurchaseInPage');
    expect(modalSource).toContain('openPurchaseReturnDetail(record)');
    expect(modalSource).toContain('openPurchaseHistoryDocumentDetail(record)');
    expect(modalSource).toContain("dataIndex: 'documentType'");
    expect(modalSource).toContain("dataIndex: 'documentNo'");
    expect(modalSource).toContain("title: '单号'");
    expect(modalSource).toContain("dataIndex: 'businessTime'");
    expect(modalSource).toContain('record.rowKey || record.id');
    expect(modalSource).toContain('<PurchaseReturnDetailModal');
    expect(modalSource).toContain('openSaleHistoryDocumentDetail(record)');
    expect(modalSource).toContain('openSaleQuoteDetail(record)');
    expect(modalSource).toContain('getSaleOutPage');
    expect(modalSource).toContain('getSaleReturnPage');
    expect(modalSource).toContain('getSaleQuotePage');
  });

  it('renders sale quote history statuses as labels instead of raw numbers', () => {
    expect(modalSource).toContain('function normalizeHistoryStatus');
    expect(modalSource).toContain('Number(status)');
    expect(modalSource).toContain("mode === 'order' ? '待审核' : '未审核'");
    expect(modalSource).toContain(
      "normalizedStatus === 30) return '部分转手推车'",
    );
    expect(modalSource).toContain(
      "normalizedStatus === 40) return '已转手推车'",
    );
    expect(modalSource).toContain(
      "normalizedStatus === 50) return '已生成销售单'",
    );
    expect(modalSource).toContain("normalizedStatus === 90) return '已取消'");
  });

  it('keeps purchase selector text at 12px and mounts child modals above the parent', () => {
    expect(modalSource).toContain(
      ':global(.stock-product-select-modal--fullscreen input::placeholder)',
    );
    expect(modalSource).toContain(
      ':global(.stock-history-filter-dropdown .ant-select-item-option-content)',
    );
    expect(modalSource).toContain('font-size: 12px;');
    expect(modalSource).not.toContain('font-size: 14px;');
    expect(modalSource).not.toContain('font-size: 11px;');
    expect(modalSource).toMatch(
      /<\/Modal>\s*<ProductFormModal @success="handleProductFormSuccess" \/>/,
    );
    expect(modalSource).toContain('const PRODUCT_EDIT_MODAL_Z_INDEX = 3000;');
    expect(modalSource).toContain('const HISTORY_MODAL_Z_INDEX = 3000;');
    expect(modalSource).toContain(':z-index="HISTORY_MODAL_Z_INDEX"');
    expect(modalSource).toMatch(
      /<\/Grid>\s*<\/Modal>\s*<Modal\s+v-model:open="purchaseHistoryOpen"/,
    );
    expect(modalSource).toMatch(
      /connectedComponent: ProductForm,[\s\S]*zIndex: PRODUCT_EDIT_MODAL_Z_INDEX,/,
    );
    expect(modalSource).toContain(
      "window.addEventListener('keydown', handleHistoryEscape, true)",
    );
    expect(modalSource).toContain('event.stopImmediatePropagation();');
    expect(modalSource).toContain('isShortcutDialogOpen() ||');
  });

  it('keeps stock price columns permission-driven after removing W and Q', () => {
    expect(modalSource).not.toContain('RIGHT_FIXED_PRICE_FIELD_KEYS');
    [
      "'backupPrice1'",
      "'referencePrice'",
      "'retailPrice'",
      "'wholesalePrice'",
      "'sharePrice'",
      "'lastPurchasePrice'",
    ].forEach((field) => expect(modalSource).toContain(field));
    expect(modalSource).not.toContain('toggleAllPriceFields');
    expect(modalSource).not.toContain('openWarehouseStock');
    expect(modalSource).not.toContain('warehouseStockSummary');
    expect(modalSource).not.toContain('warehouse-stock-row--available');
    expect(modalSource).not.toContain('warehouse-stock-row--empty');
  });

  it('preserves selected stock rows after product edits refresh the selector', () => {
    expect(modalSource).toContain('function restoreSelectedRowsByKey');
    expect(modalSource).toContain('const selectedKeys = new Set(');
    expect(modalSource).toContain('restoreSelectedRowsByKey(selectedKeys)');
  });

  it('keeps product edit permission checks while removing purchase document department blocking', () => {
    expect(modalSource).toContain('function getProductEditDocumentDeptId()');
    expect(modalSource).toContain("if (props.bizType === 'purchase')");
    expect(modalSource).toContain('return undefined;');
    expect(modalSource).toContain(
      "props.bizType === 'sale' ? getSaleDeptId() : props.deptId",
    );
    expect(modalSource).toContain("hasAccessByCodes(['erp:product:update'])");
    expect(modalSource).toContain(
      'const documentDeptId = getProductEditDocumentDeptId();',
    );
  });

  it('keeps the original enter-to-confirm behavior in stock selection', () => {
    expect(modalSource).not.toContain(
      `function handleEnterConfirm(event: KeyboardEvent) {
  if (
    !open.value ||
    selectionShortcutsEnabled.value ||`,
    );
    expect(modalSource).toContain('handleEnterConfirm(event)');
    expect(modalSource).toContain('handleSelectionShortcut(event)');
  });

  it('confirms stock selection directly without a deferred review hook', () => {
    expect(inlineStockSelectSource).not.toContain('beforeConfirm');
    expect(modalSource).not.toContain('beforeConfirm');
    expect(saleSelectSource).not.toContain('beforeConfirm');
    for (const source of [
      saleOrderItemSource,
      saleQuoteItemSource,
      saleReturnItemSource,
      saleCartItemSource,
      stockCheckItemSource,
      stockInItemSource,
      stockMoveItemSource,
      stockOutItemSource,
      stockTransferOutItemSource,
      warehouseMoveItemSource,
    ]) {
      expect(source).not.toContain('StockSelectionReviewModal');
      expect(source).not.toContain('handleBeforeInlineStockConfirm');
      expect(source).not.toContain(':before-confirm=');
    }
    expect(saleReturnItemSource).toContain('<SaleStockProductSelectModal');
    expect(saleReturnItemSource).not.toContain(
      '<SaleStockProductSelectModal\n    ref="productSelectRef"\n    @success=',
    );
  });

  it('allows F product edit when focus remains on a selected checkbox row', () => {
    expect(modalSource).toContain('function isCheckableControlTarget');
    expect(modalSource).toContain(
      "input.type === 'checkbox' || input.type === 'radio'",
    );
    expect(modalSource).toContain(
      'function shouldIgnoreSelectionShortcutTarget',
    );
    expect(modalSource).toContain(
      "if (key === 'f' && isCheckableControlTarget(event.target))",
    );
    expect(modalSource).toContain('shouldIgnoreSelectionShortcutTarget(event)');
  });

  it('provides a sale wrapper with sale-only stock, warehouse, and shortcut semantics', () => {
    expect(saleSelectSource).toContain('getSaleStockPage');
    expect(saleSelectSource).toContain('getSaleWarehouseSimplePage');
    expect(saleSelectSource).toContain('getSaleWarehouseOwnerDeptSimplePage');
    expect(saleSelectSource).toContain('allSaleProductPermission?: string');
    expect(saleSelectSource).toContain(
      'hasAccessByCodes([props.allSaleProductPermission])',
    );
    expect(saleSelectSource).toContain(
      ':all-sale-product="hasAllSaleProductPermission"',
    );
    expect(saleSelectSource).toContain(
      ':all-sale-product-permission="props.allSaleProductPermission"',
    );
    expect(saleSelectSource).toContain('biz-type="sale"');
    expect(saleSelectSource).toContain('source="stock"');
    expect(saleSelectSource).toContain(
      ':enable-sale-stock-shortcuts="props.enableSaleStockShortcuts"',
    );
    expect(saleSelectSource).toContain(':sale-dept-id="props.saleDeptId"');
    expect(saleSelectSource).toContain(
      ':customer-price-level="props.customerPriceLevel"',
    );
  });

  it('routes sale forms into shared stock keyboard navigation shortcuts', () => {
    for (const source of [
      saleOrderItemSource,
      saleCartItemSource,
      saleQuoteItemSource,
    ]) {
      expect(source).toContain('<SaleStockProductSelectModal');
      expect(source).toContain('enable-sale-stock-shortcuts');
      expect(source).toContain('<ErpInlineStockSelect');
    }
    expect(saleReturnItemSource).toContain('<ErpInlineStockSelect');
    expect(saleReturnItemSource).toContain('getSaleStockPage');
    expect(saleReturnItemSource).toContain('canUseInlineStockSelector');
    expect(saleReturnFormSource).not.toContain('<SaleStockProductSelectModal');
    expect(saleSelectSource).toContain('biz-type="sale"');
    expect(saleSelectSource).toContain('source="stock"');
    expect(saleSelectSource).toContain(
      ':enable-sale-stock-shortcuts="props.enableSaleStockShortcuts"',
    );
    expect(modalSource).toContain('saleStockShortcutsEnabled.value');
    expect(modalSource).toContain('stockSelectionKeyboardNavigationEnabled');
    expect(modalSource).toContain('<kbd>↑ / ↓</kbd>');
    expect(modalSource).toContain('<kbd>← / →</kbd>');
    expect(modalSource).toContain('<kbd>Insert</kbd>');
  });

  it('keeps purchase order keyboard entry wiring on its existing trial path', () => {
    expect(purchaseOrderFormSource).toContain('focusFirstEditableFormControl');
    expect(purchaseOrderFormSource).toContain(
      'focusNextEditableFormControlOnEnter',
    );
    expect(purchaseOrderFormSource).toContain(
      'queueFocusFirstPurchaseOrderFormControl',
    );
    expect(purchaseOrderFormSource).toContain(
      'ref="purchaseOrderBasicFormRef"',
    );
    expect(purchaseOrderFormSource).toContain(
      '@keydown.capture="handlePurchaseOrderBasicFormEnter"',
    );
    expect(purchaseOrderFormSource).toContain(
      '@request-submit="handleLastInputEnterConfirm"',
    );
    expect(purchaseOrderItemSource).toContain("'requestSubmit'");
    expect(purchaseOrderItemSource).toContain(
      'function handleItemInputPressEnter(event: KeyboardEvent)',
    );
    expect(purchaseOrderItemSource).toContain("emit('requestSubmit', event);");
    expect(purchaseOrderItemSource).toContain(
      'data-purchase-order-count-input="true"',
    );
    expect(purchaseOrderItemSource).not.toContain(
      '@press-enter="focusNextInputOnEnter"',
    );
  });

  it('extends header Enter traversal and primary confirm submit to every enabled stock-shortcut form', () => {
    const enabledStockShortcutForms = [
      purchaseInFormSource,
      purchaseReturnFormSource,
      saleOrderFormSource,
      saleCartFormSource,
      saleQuoteFormSource,
      saleReturnFormSource,
      stockOutFormSource,
      stockCheckFormSource,
      stockTransferOutFormSource,
    ];

    for (const source of enabledStockShortcutForms) {
      expect(source).toContain('focusFirstEditableFormControl');
      expect(source).toContain('focusNextEditableFormControlOnEnter');
      expect(source).toContain('queueAfterEditableControlRender');
      expect(source).toContain('const basicFormRef = ref<HTMLElement');
      expect(source).toContain(
        'function handleBasicFormEnter(event: KeyboardEvent)',
      );
      expect(source).toContain(
        'onLastControlEnter: handleLastInputEnterConfirm',
      );
      expect(source).toContain('void modalApi.onConfirm();');
      expect(source).toContain('@keydown.capture="handleBasicFormEnter"');
      expect(source).toContain('@request-submit="handleLastInputEnterConfirm"');
    }
  });

  it('submits from the last editable detail input on enabled stock-shortcut item forms', () => {
    const enabledStockShortcutItemForms = [
      purchaseInItemSource,
      purchaseReturnItemSource,
      saleOrderItemSource,
      saleCartItemSource,
      saleQuoteItemSource,
      saleReturnItemSource,
      stockOutItemSource,
      stockCheckItemSource,
      stockTransferOutItemSource,
    ];

    for (const source of enabledStockShortcutItemForms) {
      expect(source).toContain('focusNextInputOnEnter');
      expect(source).toContain('focusFirstEditableInput');
      expect(source).toContain("'request-submit'");
      expect(source).toContain(
        'function handleItemInputPressEnter(event: KeyboardEvent)',
      );
      expect(source).toContain("emit('request-submit', event);");
      expect(source).toContain('@press-enter="handleItemInputPressEnter"');
      expect(source).not.toContain('@press-enter="focusNextInputOnEnter"');
    }
  });

  it('focuses the first newly added row quantity after stock selection', () => {
    const itemFormsWithLocalStockSelection = [
      [purchaseInItemSource, 'data-purchase-in-count-input="true"'],
      [saleOrderItemSource, 'data-sale-order-count-input="true"'],
      [saleCartItemSource, 'data-sale-cart-count-input="true"'],
      [saleQuoteItemSource, 'data-sale-quote-count-input="true"'],
    ] as const;

    for (const [source, countInputFlag] of itemFormsWithLocalStockSelection) {
      expect(source).toContain(countInputFlag);
      expect(source).toContain(':data-erp-item-row-key="getItemRowKey(row)"');
      expect(source).toContain('createErpItemRowFocusController');
      expect(source).toMatch(
        /itemRowFocusController\.focus\((?:activeRow|focusRow), 'count'\)/,
      );
    }

    expect(purchaseReturnItemSource).toContain(
      'data-purchase-return-count-input="true"',
    );
    expect(purchaseReturnItemSource).toContain(
      "itemRowFocusController.focus(activeRow, 'count')",
    );
    expect(purchaseReturnFormSource).toContain(
      'await getItemFormInstance()?.focusItemRow?.(focusItem, focusField);',
    );
    expect(saleReturnItemSource).toContain(
      'data-sale-return-count-input="true"',
    );
    expect(saleReturnItemSource).toContain(
      "itemRowFocusController.focus(focusRow, 'count')",
    );
    expect(saleReturnItemSource).toContain('focusProductNameInput(row)');
  });

  it('focuses product name after adding blank inventory item rows', () => {
    for (const source of [
      stockInItemSource,
      stockOutItemSource,
      stockCheckItemSource,
      stockMoveItemSource,
      stockTransferOutItemSource,
      warehouseMoveItemSource,
    ]) {
      expect(source).toContain('function handleAddBlankItemRow');
      expect(source).toContain('focusProductNameInput');
      expect(source).toContain("itemRowFocusController.focus(row, 'product')");
      expect(source).toContain('data-erp-inline-stock-select-input="true"');
      expect(source).toContain('void handleAddBlankItemRow();');
      expect(source).toContain('新增行');
      expect(source).toContain('批量删除');
    }
  });

  it('passes customer price level into sale return product selection', () => {
    expect(saleReturnFormSource).toContain(
      ':customer-price-level="currentCustomerPriceLevel"',
    );
    expect(saleReturnItemSource).toContain('customerPriceLevel?: number');
    expect(saleReturnItemSource).toContain('pickCustomerLevelPrice');
  });

  it('sorts every stock selection by book stock descending by default', () => {
    expect(modalSource).toContain("count: 'count'");
    expect(modalSource).toContain('function getDefaultStockSortParams()');
    expect(modalSource).toContain("props.source === 'stock'");
    expect(modalSource).toContain("orderField: 'count'");
    expect(modalSource).toContain("orderDirection: 'desc' as const");
    expect(modalSource).toContain('...getDefaultStockSortParams()');
    expect(modalSource).toContain('...sortParams');

    expect(warehouseMoveSelectSource).toContain("orderField: 'count'");
    expect(warehouseMoveSelectSource).toContain("orderDirection: 'desc'");
    expect(warehouseMoveSelectSource).toContain(
      '...buildSortParams(sorts, sort)',
    );
  });

  it('adds the twelve agreed remote column filters to shared stock selectors', () => {
    const expectedFields = [
      'batchNo',
      'warehouseName',
      'deptName',
      'productCode',
      'productName',
      'brand',
      'vehicleModel',
      'originPlace',
      'standard',
      'drawingNo',
      'factoryCode',
      'shelf',
    ];
    expectedFields.forEach((field) =>
      expect(modalSource).toContain(`  '${field}',`),
    );
    expect(modalSource).toContain('filter: true');
    expect(modalSource).toMatch(/filterConfig:\s*{\s*remote: true/);
    expect(modalSource).toContain("filter: 'stockColumnFilter'");
    expect(modalSource).toContain("field === 'batchNo' && !props.showBatchNo");
    expect(warehouseMoveSelectSource).not.toContain("  'batchNo',");
    expectedFields
      .slice(1)
      .forEach((field) =>
        expect(warehouseMoveSelectSource).toContain(`  '${field}',`),
      );
  });

  it('combines multiple header filters with top search values and supports clearing', () => {
    [modalSource, warehouseMoveSelectSource].forEach((source) => {
      expect(source).toContain('activeStockColumnFilters');
      expect(source).toContain('...activeStockColumnFilters.value');
      expect(source).toContain('syncStockColumnFiltersFromForm(formValues)');
      expect(source).toContain('applyStockColumnFilter($panel, column)');
      expect(source).toContain('clearStockColumnFilter($panel, column)');
      expect(source).toContain('clearAllStockConditions');
      expect(source).toContain('清空本列');
      expect(source).toContain('清空全部');
    });
    expect(modalSource).toContain("field === 'warehouseName'");
    expect(modalSource).toContain('{ warehouseId: undefined }');
    expect(modalSource).toContain("field === 'deptName'");
    expect(modalSource).toContain('{ deptId: undefined }');
    expect(modalSource).toContain('STOCK_COLUMN_FILTER_FORM_FIELDS.has(field)');
    expect(modalSource).toContain('getProductBrandSimpleList()');
  });

  it('keeps filter input keys isolated from stock selection shortcuts', () => {
    [modalSource, warehouseMoveSelectSource].forEach((source) => {
      expect(source).toContain('@click.stop');
      expect(source).toContain('@keydown.stop');
      expect(source).toContain('@keydown.enter.stop.prevent');
      expect(source).toContain('input, textarea, select, button');
      expect(source).toContain('[contenteditable="true"]');
    });
  });

  it('sorts safe fixed columns, shows active direction, and resets on reopen', () => {
    const sharedSortMap = modalSource.slice(
      modalSource.indexOf('const STOCK_SORT_FIELD_MAP'),
      modalSource.indexOf('const STOCK_COLUMN_FILTER_FIELDS'),
    );
    const moveSortMap = warehouseMoveSelectSource.slice(
      warehouseMoveSelectSource.indexOf('const STOCK_SORT_FIELD_MAP'),
      warehouseMoveSelectSource.indexOf('const STOCK_COLUMN_FILTER_FIELDS'),
    );
    [sharedSortMap, moveSortMap].forEach((sortMap) => {
      expect(sortMap).toContain("productPurchasePrice: 'productPurchasePrice'");
      expect(sortMap).toContain("grossProfitRate: 'grossProfitRate'");
      expect(sortMap).toContain("sharePrice: 'sharePrice'");
      expect(sortMap).not.toContain('lastSalePrice');
      expect(sortMap).not.toContain('customFields__');
    });
    expect(moveSortMap).toContain("costPrice: 'costPrice'");
    expect(moveSortMap).toContain("featureCode: 'featureCode'");
    expect(moveSortMap).toContain("weight: 'weight'");
    [modalSource, warehouseMoveSelectSource].forEach((source) => {
      expect(source).toContain('resetSortState(gridApi)');
      expect(source).toContain('i.sort--active');
    });
    expect(modalSource).toContain('stock-product-select-grid--stock');
    expect(modalSource).toContain('display: inline-flex;');
  });

  it('keeps selected stock batch numbers enabled when confirming rows', () => {
    expect(modalSource).toContain('function getStockRowBatchNo');
    expect(modalSource).toContain("'batchNumber'");
    expect(modalSource).toContain("'batchCode'");
    expect(modalSource).toContain("'lotNo'");
    expect(modalSource).toContain('function isStockRowBatchNoEnabled');
    expect(modalSource).toContain('function normalizeStockPageRow');
    expect(modalSource).toContain('normalizeStockPageRow(row)');
    expect(modalSource).toContain(
      'batchNoEnabled: isStockRowBatchNoEnabled(row as Record<string, any>)',
    );
  });
});
