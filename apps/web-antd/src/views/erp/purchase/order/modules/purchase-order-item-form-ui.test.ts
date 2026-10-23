import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const batchUpdateItemsSource = readFileSync(
  join(currentDir, 'batch-update-items-form.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/purchase/order/index.ts'),
  'utf8',
);
const purchaseHistoryApiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/purchase/history/index.ts'),
  'utf8',
);
const dataSource = readFileSync(join(currentDir, '../data.ts'), 'utf8');
const priceReferenceOverlaySource = readFileSync(
  join(currentDir, '../../components/PurchaseItemPriceReferenceOverlay.vue'),
  'utf8',
);
const commonPriceReferenceOverlaySource = readFileSync(
  join(currentDir, '../../../components/ItemPriceReferenceOverlay.vue'),
  'utf8',
);
const priceReferenceUtilsSource = readFileSync(
  join(currentDir, '../../../utils/price-reference.ts'),
  'utf8',
);
const itemPieceCountSource = readFileSync(
  join(currentDir, '../../utils/item-piece-count.ts'),
  'utf8',
);

describe('purchase order item form UI', () => {
  it('uses the unified purchase-in and purchase-return history page for Space', () => {
    expect(itemFormSource).toContain('getPurchaseHistoryPage');
    expect(itemFormSource).not.toContain('getPurchaseInPage');
    expect(itemFormSource).toContain("dataIndex: 'documentType'");
    expect(itemFormSource).toContain("dataIndex: 'documentNo'");
    expect(itemFormSource).toContain("title: '单号'");
    expect(itemFormSource).toContain("dataIndex: 'businessTime'");
    expect(itemFormSource).toContain('record.rowKey || record.id');
    expect(itemFormSource).toContain(
      "record.documentTypeCode === 'PURCHASE_RETURN'",
    );
    expect(itemFormSource).toContain('openPurchaseReturnDetail(record)');
    expect(itemFormSource).toContain('<PurchaseReturnDetailModal');
    expect(purchaseHistoryApiSource).toContain("'/erp/purchase-history/page'");
  });

  it('adds inline stock directly with the default quantity and purchase price', () => {
    expect(itemFormSource).not.toContain('StockSelectionReviewModal');
    expect(itemFormSource).not.toContain('handleBeforeInlineStockConfirm');
    expect(itemFormSource).not.toContain(':before-confirm=');
    expect(itemFormSource).not.toContain('isStockSelectionReviewOpen');
    expect(formSource).not.toContain('isStockSelectionReviewOpen() ||');
    expect(itemFormSource).toContain('productPrice: p.lastPurchasePrice ?? 0');
    expect(itemFormSource).toContain('count: 1');
  });

  it('keeps the add row toolbar button text at 12px', () => {
    expect(itemFormSource).toMatch(/>\s*新增行\s*<\/Button>/);
    expect(itemFormSource).toContain('purchase-order-item-toolbar');
    expect(itemFormSource).toContain(
      "slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' }",
    );
    expect(itemFormSource).toContain(
      ':deep(.purchase-order-item-toolbar .ant-btn span)',
    );
    expect(itemFormSource).toContain(
      '.purchase-order-item-toolbar :deep(.ant-btn)',
    );
    expect(itemFormSource).toContain('font-size: 12px;');
    expect(itemFormSource).toContain('isCreateShortcutKey(event)');
    expect(itemFormSource).toContain('void handleAddBlankItemRow();');
  });

  it('shows the readonly last purchase price in the detail grid', () => {
    expect(dataSource).toContain("field: 'lastPurchasePrice'");
    expect(dataSource).toContain("title: '最后采购价'");
    expect(itemFormSource).toContain('lastPurchasePrice: p.lastPurchasePrice');
    expect(itemFormSource).toMatch(
      /productPurchasePrice:\s*p\.purchasePrice \?\? p\.productPurchasePrice/,
    );
    expect(itemFormSource).toContain('salePrice: p.salePrice');
    expect(itemFormSource).toContain('lastSalePrice: p.lastSalePrice');
    expect(itemFormSource).toContain('backupPrice1: p.backupPrice1');
    expect(formSource).toContain(
      'lastPurchasePrice: item.lastPurchasePrice ?? product.lastPurchasePrice',
    );
    expect(formSource).toMatch(
      /productPurchasePrice:\s*item\.productPurchasePrice \?\? product\.purchasePrice/,
    );
    expect(formSource).toContain('lastPurchasePrice: undefined');
    expect(formSource).toContain('productPurchasePrice: undefined');
    expect(apiSource).toContain('productPurchasePrice?: number');
    expect(apiSource).toContain('salePrice?: number');
    expect(apiSource).toContain('lastSalePrice?: number');
    expect(apiSource).toContain('sharePrice?: number');
  });

  it('masks purchase price fields in order detail when price permission is hidden', () => {
    expect(dataSource).toContain('MASKED_PRICE_ITEM_FIELDS');
    expect(dataSource).toContain("'productPrice'");
    expect(dataSource).toContain("'productPurchasePrice'");
    expect(dataSource).toContain("'salePrice'");
    expect(dataSource).toContain("'lastSalePrice'");
    expect(dataSource).toContain("'lastPurchasePrice'");
    expect(dataSource).toContain("'backupPrice1'");
    expect(dataSource).toContain("'wholesalePrice'");
    expect(dataSource).toContain("'sharePrice'");
    expect(dataSource).toContain("'totalProductPrice'");
    expect(dataSource).toContain(
      "isPurchaseOrderPriceItemHidden(hiddenFields, 'lastPurchasePrice')",
    );
    expect(dataSource).toContain(": 'formatPurchaseDecimal6'");
    expect(dataSource).toContain("() => '****'");
    expect(dataSource).toContain(
      'getColumnPermissionHiddenFields(hiddenFields)',
    );
    expect(itemFormSource).toContain('isPriceItemHidden');
    expect(itemFormSource).toContain(
      'v-if="disabled && isPriceItemHidden(\'productPrice\')"',
    );
    expect(itemFormSource).toContain('****');
  });

  it('loads unmasked data for edit and copy while keeping detail masked', () => {
    expect(apiSource).toContain('interface GetPurchaseOrderOptions');
    expect(apiSource).toContain('params.mask = options.mask');
    expect(apiSource).toContain('includeItems?: boolean');
    expect(apiSource).toContain('params.includeItems = options.includeItems');
    expect(apiSource).toContain('interface PurchaseOrderItemPageParam');
    expect(apiSource).toContain('function getPurchaseOrderItemPage');
    expect(apiSource).toContain("'/erp/purchase-order/item-page'");
    expect(formSource).toContain('function getPurchaseOrderLoadOptions()');
    expect(formSource).toContain(
      'return { includeItems: !isRemoteItemPaging.value, mask: isDetailMode.value };',
    );
    expect(formSource).toContain(
      'await getPurchaseOrder(formData.value.id, getPurchaseOrderLoadOptions())',
    );
    expect(formSource).toContain('includeItems: false');
    expect(formSource).toContain("mask: data.type === 'detail'");
  });

  it('supports paged purchase detail rows locally and remotely', () => {
    expect(itemFormSource).toContain('Pagination,');
    expect(itemFormSource).toContain('remotePaging?: boolean');
    expect(itemFormSource).toContain('const DEFAULT_ITEM_PAGE_SIZE = 10;');
    expect(itemFormSource).toContain(
      "const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];",
    );
    expect(itemFormSource).toContain('const ITEM_TABLE_VISIBLE_ROWS = 10;');
    expect(itemFormSource).toContain('height: ITEM_TABLE_HEIGHT');
    expect(itemFormSource).toContain('pageSize: DEFAULT_ITEM_PAGE_SIZE');
    expect(itemFormSource).toContain(
      'const effectiveItemPagination = computed',
    );
    expect(itemFormSource).toContain('const showItemPager = computed');
    expect(itemFormSource).toContain('async function handleItemPageChange');
    expect(itemFormSource).toContain("emit('pageChange'");
    expect(itemFormSource).toContain('props.remotePaging');
    expect(itemFormSource).toContain('purchase-order-item-pager');
    expect(itemFormSource).toContain('font-size: 11px;');
    expect(itemFormSource).toContain(
      '.purchase-order-item-pager\n  :deep(.ant-pagination-options-size-changer .ant-select-selector)',
    );
    expect(itemFormSource).toContain('min-height: 24px;');
    expect(formSource).toContain('const itemPageState = ref({');
    expect(formSource).toContain('const DEFAULT_ITEM_PAGE_SIZE = 10;');
    expect(formSource).toContain('async function loadPurchaseOrderItemPage');
    expect(formSource).toContain(
      'async function buildMergedRemoteItemsForSubmit',
    );
    expect(formSource).toContain('async function loadAllPurchaseOrderItems');
    expect(formSource).toContain(
      'const sourceItems = await loadAllPurchaseOrderItems(formData.value.id,',
    );
    expect(formSource).toContain('!remoteItemDeletes.has(item.id)');
    expect(formSource).toContain('remoteItemEdits.get(item.id)');
    expect(formSource).toContain(':remote-paging="isRemoteItemPaging"');
    expect(formSource).toContain('@page-change="handleItemPageChange"');
    expect(formSource).toContain("item.operation !== 'delete'");
    expect(formSource).toContain('buildCurrentPurchaseOrderPayload(allItems)');
  });

  it('recalculates item detail column widths from the current visible page', () => {
    expect(itemFormSource).toContain(
      'rows: ErpPurchaseOrderApi.PurchaseOrderItem[] = displayTableData.value',
    );
    expect(itemFormSource).toContain('editable: !props.disabled');
    expect(itemFormSource).toContain(
      "field === 'deptId' ? !isItemDeptReadonly(row) : true",
    );
    expect(itemFormSource).toContain('trailingFlexibleColumnMinWidth: 150');
    expect(itemFormSource).toContain('fit: true');
    expect(itemFormSource).toContain('async function refreshItemColumns');
    expect(itemFormSource).toContain(
      'const columns = buildItemColumns(displayData);',
    );
    expect(itemFormSource).toContain(
      'await gridApi.grid.reloadColumn(columns);',
    );
    expect(itemFormSource).toContain('void nextTick(refreshItemColumns)');
    expect(itemFormSource).toContain('await refreshItemColumns();');
    expect(itemFormSource).not.toContain('text-overflow: ellipsis;');
  });

  it('validates merged remote rows with count when countText is absent', () => {
    const validateValueIndex = itemFormSource.indexOf(
      'function getCountValidateValue',
    );
    const validateIndex = itemFormSource.indexOf('function validate(');

    expect(validateValueIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeGreaterThan(validateValueIndex);
    expect(itemFormSource).toContain(
      "Object.prototype.hasOwnProperty.call(item as any, 'countText')",
    );
    expect(itemFormSource).toContain(
      'const parsed = parsePurchaseOrderCountText(getCountValidateValue(item));',
    );
  });

  it('shows product unit, weight, and package quantity in purchase detail rows', () => {
    expect(dataSource).toContain("field: 'productUnitName'");
    expect(dataSource).toContain("title: '单位'");
    expect(dataSource).toContain("field: 'weight'");
    expect(dataSource).toContain("title: '重量'");
    expect(dataSource).toContain("formatter: 'formatPurchaseDecimal6'");
    expect(dataSource).toContain("field: 'packageQty'");
    expect(dataSource).toContain("title: '包装数'");
    expect(dataSource).toContain("field: 'pieceCount'");
    expect(dataSource).toContain("title: '件数'");
    expect(dataSource).toContain('purchaseItemPieceCountColumnFormatter');
    expect(apiSource).toContain('weight?: number');
    expect(apiSource).toContain('packageQty?: number');
    expect(apiSource).toContain('pieceCount?: number | string');
    expect(itemPieceCountSource).toContain(
      'purchaseDecimalDivide(count, packageQty)',
    );
    expect(itemPieceCountSource).toContain("return '-'");
    expect(itemFormSource).toContain(
      'row.weight = product.weight ?? row.weight',
    );
    expect(itemFormSource).toContain(
      'row.packageQty = product.packageQty ?? row.packageQty',
    );
    expect(itemFormSource).toContain('weight: p.weight');
    expect(itemFormSource).toContain('packageQty: p.packageQty');
  });

  it('allows optional batch number for purchase detail rows with batch management enabled', () => {
    expect(dataSource).toContain("title: '批次号'");
    expect(itemFormSource).toContain("title: '批次号'");
    expect(itemFormSource).toContain('请输入批次号');
    expect(itemFormSource).not.toContain(`第 \${i + 1} 行：请输入批次号`);
    expect(itemFormSource).toContain(
      ':disabled="!isBatchNoEnabled(row.batchNoEnabled)"',
    );
    expect(formSource).toContain(
      'batchNoEnabled: item.batchNoEnabled ?? product.batchNoEnabled',
    );
  });

  it('keeps active-row shortcuts while W toggles row-aligned current-page price reference', () => {
    expect(itemFormSource).toContain('purchase-order-item-row--active');
    expect(itemFormSource).toContain('purchase-order-item-shortcut-hint');
    expect(itemFormSource).toContain('点击明细行后');
    expect(itemFormSource).toContain('<kbd>Space</kbd><b>采购历史</b>');
    expect(itemFormSource).toContain('<kbd>Shift</kbd><b>采购订单历史</b>');
    expect(itemFormSource).toContain('<kbd>S</kbd><b>销售历史</b>');
    expect(itemFormSource).toContain('<kbd>Q</kbd><b>报价订单历史</b>');
    expect(itemFormSource).toContain('<kbd>F</kbd><b>修改商品</b>');
    expect(itemFormSource).toContain(
      'purchase-order-item-shortcut-hint__divider',
    );
    expect(itemFormSource).toContain('当前页');
    expect(itemFormSource).toContain('<kbd>W</kbd><b>全部价格</b>');
    expect(itemFormSource).toContain('priceReferenceOpen');
    expect(itemFormSource).toContain('togglePriceReferenceOverlay');
    expect(itemFormSource).toContain(
      'priceReferenceOpen.value = !priceReferenceOpen.value',
    );
    expect(itemFormSource).toContain('isPurchasePriceReferenceShortcut(event)');
    expect(itemFormSource).toContain('ref="itemTableWrapRef"');
    expect(itemFormSource).toContain('PurchaseItemPriceReferenceOverlay');
    expect(itemFormSource).toContain(':rows="displayTableData"');
    expect(itemFormSource).toContain('ITEM_TABLE_ROW_HEIGHT');
    expect(priceReferenceOverlaySource).toContain('ItemPriceReferenceOverlay');
    expect(commonPriceReferenceOverlaySource).toContain(
      'class="erp-price-reference-overlay"',
    );
    expect(commonPriceReferenceOverlaySource).toContain(
      'aria-label="当前页配件价格"',
    );
    expect(commonPriceReferenceOverlaySource).toContain(
      'erp-price-reference__head-table',
    );
    expect(commonPriceReferenceOverlaySource).toContain(
      'erp-price-reference__body-table',
    );
    expect(commonPriceReferenceOverlaySource).toContain('<colgroup>');
    expect(priceReferenceUtilsSource).toContain("shortLabel: '最后采购价'");
    expect(priceReferenceUtilsSource).toContain('width: 86');
    expect(priceReferenceUtilsSource).not.toContain("shortLabel: '末采'");
    expect(commonPriceReferenceOverlaySource).toContain('scope="col"');
    expect(commonPriceReferenceOverlaySource).toContain('table-layout: fixed');
    expect(commonPriceReferenceOverlaySource).not.toContain('价格遮罩');
    expect(commonPriceReferenceOverlaySource).toContain('rowsStyle');
    expect(commonPriceReferenceOverlaySource).toContain(
      "'--erp-price-reference-row-height'",
    );
    expect(commonPriceReferenceOverlaySource).toContain('translate3d(0, -');
    expect(commonPriceReferenceOverlaySource).toContain(
      'function getBodyWrapper',
    );
    expect(commonPriceReferenceOverlaySource).toContain(
      '.vxe-table--main-wrapper .vxe-table--body-wrapper',
    );
    expect(commonPriceReferenceOverlaySource).toContain(
      "bodyWrapper.addEventListener('scroll', handleBodyScroll",
    );
    expect(commonPriceReferenceOverlaySource).toContain('ResizeObserver');
    expect(commonPriceReferenceOverlaySource).toContain('detachBodyScroll');
    expect(commonPriceReferenceOverlaySource).toContain('field.shortLabel');
    expect(commonPriceReferenceOverlaySource).toContain(
      '当前页暂无可显示价格的配件',
    );
    expect(commonPriceReferenceOverlaySource).not.toContain(
      '@click="priceReferenceOpen = false"',
    );
    expect(commonPriceReferenceOverlaySource).not.toContain('__close');
    expect(commonPriceReferenceOverlaySource).not.toContain('__title');
    expect(commonPriceReferenceOverlaySource).not.toMatch(
      /field\.label.*formatReferenceValue\(row, field\)/,
    );
    expect(itemFormSource).not.toMatch(/\bconst\s+priceReferenceRow\s*=/);
    expect(itemFormSource).not.toContain('<Drawer');
    expect(itemFormSource).not.toContain('placement="right"');
    expect(itemFormSource).not.toContain(
      'purchase-order-price-reference__list',
    );
    expect(commonPriceReferenceOverlaySource).toContain(
      'PRICE_REFERENCE_FIELDS',
    );
    expect(commonPriceReferenceOverlaySource).toContain('PRICE_REFERENCE_MASK');
    expect(commonPriceReferenceOverlaySource).toContain(
      'formatReferenceValue(row, field)',
    );
    expect(commonPriceReferenceOverlaySource).toContain(
      'useFieldPermission(PRODUCT_PRICE_PERMISSION_MODULE)',
    );
    expect(itemFormSource).toContain('inlineStockSelectorOpen.value');
    expect(itemFormSource).toContain(
      "window.addEventListener('keydown', handleShortcut, true)",
    );
    expect(itemFormSource).toContain(
      "window.removeEventListener('keydown', handleShortcut, true)",
    );
    expect(itemFormSource).toContain(
      "void openPurchaseOrderHistory('history')",
    );
    expect(itemFormSource).toContain("void openPurchaseOrderHistory('order')");
    expect(itemFormSource).toContain(
      'function handleShortcutKeyup(event: KeyboardEvent)',
    );
    expect(itemFormSource).toContain(
      'function isOrderHistoryShiftKey(event: KeyboardEvent)',
    );
    expect(itemFormSource).not.toContain(
      "if (event.key === 'Enter') {\n    event.preventDefault();\n    void openPurchaseOrderHistory('order');",
    );
    expect(itemFormSource).toContain("if (key === 'f')");
    expect(itemFormSource).toContain("if (key === 's')");
    expect(itemFormSource).toContain("if (key === 'q')");
    expect(itemFormSource).toContain("openSaleShortcutHistory('history')");
    expect(itemFormSource).toContain("openSaleShortcutHistory('order')");
  });

  it('uses text decimal inputs and normalizes purchase quantity and price on blur', () => {
    expect(itemFormSource).not.toContain('<InputNumber');
    expect(itemFormSource).toContain('inputmode="decimal"');
    expect(itemFormSource).toContain('parsePurchaseOrderCountText');
    expect(itemFormSource).toContain('parsePurchaseOrderPriceText');
    expect(itemFormSource).toContain('function getPriceValidateValue');
    expect(itemFormSource).toContain('getPriceValidateValue(item)');
    expect(itemFormSource).toContain('@blur="handleCountBlur(row)"');
    expect(itemFormSource).toContain('@blur="handlePriceChange(row)"');
    expect(itemFormSource).toContain("formatPurchaseDecimal(row.count, '-')");
    expect(itemFormSource).toContain(
      "formatPurchaseDecimal(row.productPrice, '-')",
    );
    expect(itemFormSource).toContain('delete rest.priceText;');
  });

  it('refreshes remote detail data but preserves editable in-memory rows', () => {
    expect(itemFormSource).toContain(
      'if (props.remotePaging && props.disabled)',
    );
    expect(itemFormSource).toContain("emit('refreshPage');");
    expect(itemFormSource).toContain('await refreshItemGrid();');
  });

  it('prioritizes Insert add-product shortcut before editable target filtering', () => {
    const createShortcutIndex = itemFormSource.indexOf(
      'if (!props.disabled && isCreateShortcutKey(event))',
    );
    const editableGuardIndex = itemFormSource.indexOf(
      'if (isEditableTarget(event.target))',
      createShortcutIndex,
    );

    expect(createShortcutIndex).toBeGreaterThan(-1);
    expect(editableGuardIndex).toBeGreaterThan(createShortcutIndex);
    expect(itemFormSource).toContain('priceReferenceOpen.value ||');
    expect(itemFormSource).toContain('isShortcutOverlayTarget(event.target)');
    expect(itemFormSource).toContain('function isShortcutOverlayTarget');
    expect(itemFormSource).toContain(
      '.ant-select-dropdown, .ant-picker-dropdown, .ant-popover',
    );
  });

  it('keeps product edit permission checks without document department blocking', () => {
    expect(itemFormSource).toContain(
      "hasAccessByCodes(['erp:product:update'])",
    );
    expect(itemFormSource).toContain(
      "productFormModalApi.setData({ type: 'edit', id: row.productId }).open()",
    );
    expect(itemFormSource).not.toContain('该商品不属于当前单据部门，不能修改');
    expect(itemFormSource).not.toContain('props.deptId !== row.deptId');
  });

  it('renders selected item department as readonly while keeping empty rows editable', () => {
    expect(itemFormSource).toContain('function isItemDeptReadonly');
    expect(itemFormSource).toContain(
      'return props.disabled || Boolean(row?.productId)',
    );
    expect(itemFormSource).toContain('function getReadonlyDeptName');
    expect(itemFormSource).toContain(
      'findDeptName(deptOptions.value, row.deptId)',
    );
    expect(itemFormSource).toContain('v-if="isItemDeptReadonly(row)"');
    expect(itemFormSource).toContain(
      'class="purchase-order-item-readonly-cell"',
    );
    expect(itemFormSource).toContain('{{ getReadonlyDeptName(row) }}');
    expect(itemFormSource).toContain('v-else');
    expect(itemFormSource).toContain('v-model:value="row.deptId"');
    expect(itemFormSource).toContain(
      'deptId: p.deptId ?? resolveWarehouseDeptId(p.warehouseId)',
    );
    expect(itemFormSource).toContain(
      'row.deptId = resolveWarehouseDeptId(row.warehouseId)',
    );
  });

  it('does not mount lazy warehouse selects in readonly detail rows', () => {
    expect(itemFormSource).toContain('function getReadonlyWarehouseName');
    expect(itemFormSource).toContain('row.warehouseNameLabel');
    expect(itemFormSource).toContain(
      '<span v-if="disabled" class="purchase-order-item-readonly-cell">',
    );
    expect(itemFormSource).toContain('{{ getReadonlyWarehouseName(row) }}');
    expect(itemFormSource).toMatch(/<ErpLazyPageSelect\s+v-else/);
    expect(itemFormSource).toContain('function getOptionKey');
    expect(itemFormSource).toContain('function isSameSelectOption');
    expect(itemFormSource).toContain(
      'return changed ? [...map.values()] : oldOptions || [];',
    );
  });

  it('supports detail batch update for item warehouse and department', () => {
    expect(formSource).toContain('canEnableItemBatchEdit');
    expect(formSource).toContain(':enable-batch-edit="canEnableItemBatchEdit"');
    expect(formSource).toContain(':order-id="formData?.id"');
    expect(formSource).toContain(
      '@batch-update-success="reloadPurchaseOrderDetail"',
    );
    expect(itemFormSource).toContain('BatchUpdateItemsForm');
    expect(itemFormSource).toContain('canShowBatchUpdateItems');
    expect(itemFormSource).toContain("['erp:purchase-order:update']");
    expect(itemFormSource).toContain("['erp:purchase-order:create']");
    expect(itemFormSource).toContain(
      'hasAccessByCodes(batchUpdateAccessCodes.value)',
    );
    expect(itemFormSource).toContain(
      "isFieldHidden(props.hiddenFields, 'item_warehouseId')",
    );
    expect(itemFormSource).toContain(
      "isFieldHidden(props.hiddenFields, 'item_deptId')",
    );
    expect(itemFormSource).toContain("type: 'checkbox'");
    expect(itemFormSource).toContain('canBatchUpdateItemRow(row)');
    expect(itemFormSource).toContain('Boolean(row?.productId)');
    expect(itemFormSource).toContain('Number(row?.inCount || 0) <= 0');
    expect(itemFormSource).toContain('Number(row?.returnCount || 0) <= 0');
    expect(itemFormSource).toContain(
      "mode: canUseServerBatchUpdate.value ? 'server' : 'local'",
    );
    expect(itemFormSource).toContain('applyLocalBatchUpdateItems');
    expect(itemFormSource).toContain('validateDuplicate?: boolean');
    expect(itemFormSource).toContain('validateDuplicate: false');
    expect(itemFormSource).toContain('async function reloadItemsFromProps()');
    expect(itemFormSource).toContain('hasDuplicateBatchUpdatedItems');
    expect(itemFormSource).toContain('批量修改后存在产品、仓库、赠品标识重复');
    expect(itemFormSource).toContain('批量修改仓库/部门');
    expect(batchUpdateItemsSource).toContain('batchUpdatePurchaseOrderItems');
    expect(batchUpdateItemsSource).toContain(
      'getPurchaseOrderWarehouseDeptSimplePage',
    );
    expect(batchUpdateItemsSource).toContain('warehouseDeptRequestSeq');
    expect(batchUpdateItemsSource).toContain('warehouseDeptTotal');
    expect(batchUpdateItemsSource).toContain('pageSize: 10');
    expect(batchUpdateItemsSource).toContain(
      "type BatchUpdateMode = 'local' | 'server'",
    );
    expect(batchUpdateItemsSource).toContain("mode.value === 'server'");
    expect(batchUpdateItemsSource).toContain("emit('success',");
    expect(batchUpdateItemsSource).toContain('warehouseDeptTotal.value > 1');
    expect(batchUpdateItemsSource).toContain(
      "isFieldHidden(hiddenFields.value, 'item_warehouseId')",
    );
    expect(batchUpdateItemsSource).toContain(
      "isFieldHidden(hiddenFields.value, 'item_deptId')",
    );
    expect(apiSource).toContain('PurchaseOrderItemBatchUpdate');
    expect(apiSource).toContain("'/erp/purchase-order/batch-update-items'");
    expect(apiSource).toContain(
      "'/erp/purchase-order/warehouse-dept-simple-page'",
    );
  });

  it('shows add row before batch delete and batch update in the toolbar', () => {
    const toolbarTools = itemFormSource.slice(
      itemFormSource.indexOf('<template #toolbar-tools>'),
      itemFormSource.indexOf('<template #inStatus'),
    );

    expect(
      toolbarTools.indexOf('handleAddBlankItemRow'),
    ).toBeGreaterThanOrEqual(0);
    expect(
      toolbarTools.indexOf('handleBatchDeleteItems'),
    ).toBeGreaterThanOrEqual(0);
    expect(
      toolbarTools.indexOf('handleOpenBatchUpdateItems'),
    ).toBeGreaterThanOrEqual(0);
    expect(toolbarTools.indexOf('handleAddBlankItemRow')).toBeLessThan(
      toolbarTools.indexOf('handleBatchDeleteItems'),
    );
    expect(toolbarTools.indexOf('handleBatchDeleteItems')).toBeLessThan(
      toolbarTools.indexOf('handleOpenBatchUpdateItems'),
    );
    expect(toolbarTools).toMatch(/>\s*新增行\s*<\/Button>/);
    expect(toolbarTools).toContain('批量删除');
  });

  it('uses inline stock selection to replace the target purchase order item', () => {
    const insertBlock = itemFormSource.slice(
      itemFormSource.indexOf(
        'function buildReplacementPurchaseOrderItemFromStock',
      ),
      itemFormSource.indexOf('async function handleWarehouseChange'),
    );

    expect(itemFormSource).toContain('PurchaseInlineStockSelect');
    expect(itemFormSource).toContain('data-purchase-inline-stock-select-input');
    expect(itemFormSource).toContain('function handleAddBlankItemRow()');
    expect(itemFormSource).toContain('focusProductNameInput(row)');
    expect(insertBlock).toContain('row.id = targetRow.id');
    expect(insertBlock).toContain('row.seq = targetRow.seq ?? row.seq');
    expect(insertBlock).toContain(
      '(row as any).orderId = (targetRow as any).orderId',
    );
    expect(insertBlock).toContain('row.inCount = targetRow.inCount');
    expect(insertBlock).toContain('row.returnCount = targetRow.returnCount');
    expect(insertBlock).toContain(
      'const [firstStock, ...additionalStocks] = selectedProducts',
    );
    expect(insertBlock).toContain(
      'tableData.value.splice(targetIndex, 1, replacementRow)',
    );
    expect(insertBlock).toContain('buildPurchaseOrderItemFromStock(stock)');
    expect(insertBlock).not.toContain('applyReviewedValues');
    expect(insertBlock).not.toContain('reviewedItems');
  });

  it('syncs purchase detail rows without mutating parent props or double-reloading the grid', () => {
    expect(itemFormSource).toContain('row.seq = row.id ?? nextItemSeq++;');
    expect(itemFormSource).toContain(
      'const displayTableData = ref<ErpPurchaseOrderApi.PurchaseOrderItem[]>([]);',
    );
    expect(itemFormSource).toContain(
      'const normalizedItems = normalizePurchaseOrderGiftItems(items);',
    );
    expect(itemFormSource).toContain('ensureRowsIdentity(normalizedItems);');
    expect(itemFormSource).toContain(
      'normalizedItems.forEach((item) => initRow(item));',
    );
    expect(itemFormSource).toContain('tableData.value = normalizedItems;');
    expect(itemFormSource).toContain(
      'await refreshItemGrid({ reloadData: false });',
    );
    expect(itemFormSource).toContain(':rows="displayTableData"');
    expect(itemFormSource).toContain('gridApi.setLoading(Boolean(loading));');
    expect(itemFormSource).toContain('{ immediate: true },');
    expect(itemFormSource).not.toContain('ensureRowsSeq(items);');
    expect(itemFormSource).not.toContain(
      'items.forEach((item) => initRow(item));',
    );
    expect(itemFormSource).not.toContain('data: tableData.value,');
    expect(itemFormSource).not.toContain(':rows="getDisplayTableData()"');
    expect(itemFormSource).not.toContain(
      'gridApi.setGridOptions({ loading });',
    );
    expect(formSource).not.toContain(
      'await getItemFormInstance()?.reloadItemsFromProps?.();',
    );
  });

  it('keeps grid option data synchronized before row-selection rerenders', () => {
    expect(itemFormSource).toContain(
      'const displayData = getDisplayTableData();',
    );
    expect(itemFormSource).toContain('displayTableData.value = displayData;');
    expect(itemFormSource).toContain('gridApi.setGridOptions({');
    expect(itemFormSource).toContain('columns,');
    expect(itemFormSource).toContain('data: displayData');
    expect(itemFormSource).toContain(
      'await gridApi.grid.reloadColumn(columns);',
    );
    expect(itemFormSource).toContain('gridApi.setLoading(false);');
    expect(itemFormSource).toContain('if (!reloadData) {');
    expect(itemFormSource).toContain(
      'await gridApi.grid.reloadData(displayData);',
    );
    expect(itemFormSource.indexOf('gridApi.setGridOptions({')).toBeLessThan(
      itemFormSource.indexOf('await gridApi.grid.reloadData(displayData);'),
    );
  });

  it('hydrates current warehouse and department labels for lazy item selects', () => {
    expect(itemFormSource).toContain('getWarehouse,');
    expect(itemFormSource).toContain("from '#/api/system/dept'");
    expect(itemFormSource).toContain('let itemSelectLabelHydrateSequence = 0;');
    expect(itemFormSource).toContain('function isMissingDisplayName');
    expect(itemFormSource).toContain(
      'function hydrateMissingCurrentSelectLabels',
    );
    expect(itemFormSource).toContain('getPurchaseWarehouseSimplePage({');
    expect(itemFormSource).toContain('getWarehouse(id).catch(() => undefined)');
    expect(itemFormSource).toContain('getDept(id).catch(() => undefined)');
    expect(itemFormSource).toContain(
      "const CURRENT_SELECT_LABEL_PLACEHOLDER = '加载中...';",
    );
    expect(itemFormSource).toContain('function isResolvedSelectOption');
    expect(itemFormSource).toContain('(oldOptions || []).filter((item) =>');
    expect(itemFormSource).toContain(
      '.filter((item) => isResolvedSelectOption(item))',
    );
    expect(itemFormSource).toContain(
      'value === CURRENT_SELECT_LABEL_PLACEHOLDER',
    );
    expect(itemFormSource).toContain("existed?.name ||\n    '-'");
    expect(itemFormSource).not.toContain(
      'name: row.warehouseName || row.warehouseNameLabel || row.warehouseId',
    );
    expect(itemFormSource).not.toContain(
      'name: row.deptName || row.warehouseDeptName || row.deptId',
    );
    expect(itemFormSource).toContain(
      'void hydrateMissingCurrentSelectLabels(tableData.value);',
    );
  });

  it('focuses the first newly added detail count input after stock selection', () => {
    expect(itemFormSource).toContain(
      'const PURCHASE_ORDER_ITEM_COUNT_INPUT_SELECTOR =',
    );
    expect(itemFormSource).toContain(
      '\'input[data-purchase-order-count-input="true"]\'',
    );
    expect(itemFormSource).toContain('function focusItemCountInput(row:');
    expect(itemFormSource).toContain('focusEditableInputByRowKey');
    expect(itemFormSource).toContain('createErpItemRowFocusController');
    expect(itemFormSource).toContain('PurchaseInlineStockSelect');
    expect(itemFormSource).toContain('handleInlineStockSelected(row, stocks)');
    expect(itemFormSource).toContain(
      "itemRowFocusController.focus(activeRow, 'count')",
    );
    expect(itemFormSource).toContain('data-purchase-order-count-input="true"');
    expect(itemFormSource).toContain(
      ':data-erp-item-row-key="getItemRowKey(row)"',
    );
    expect(itemFormSource).toContain('@focus="setActiveItemRow(row)"');
  });

  it('restores row-level focus after remotely appending purchase order items', () => {
    expect(itemFormSource).toContain("emit('append-items', [row], 'product');");
    expect(itemFormSource).toContain("emit('append-items', rows, 'count');");
    expect(itemFormSource).toContain(
      "emit('append-items', additionalRows, 'count', replacementRow);",
    );
    expect(itemFormSource).toContain('function focusItemRow(');
    expect(itemFormSource).toContain('focusItemRow,');
    expect(formSource).toContain("focusField: ErpItemRowFocusField = 'count',");
    expect(formSource).toContain('focusItem ??= item;');
    expect(formSource).toContain(
      'preferredFocusItem?: ErpPurchaseOrderApi.PurchaseOrderItem',
    );
    expect(formSource).toContain('pageNo: previousPage.pageNo');
    expect(formSource).toContain('preferredFocusItem,\n          focusField,');
    expect(formSource).toContain(
      'await getItemFormInstance()?.focusItemRow?.(focusItem, focusField);',
    );
  });

  it('requests purchase order submit when Enter reaches the last detail input', () => {
    expect(itemFormSource).toContain("'requestSubmit'");
    expect(itemFormSource).toContain(
      'function handleItemInputPressEnter(event: KeyboardEvent)',
    );
    expect(itemFormSource).toContain(
      'const enterFocusResult = focusNextInputOnEnter(event);',
    );
    expect(itemFormSource).toContain(
      "if (enterFocusResult === 'last-input') {",
    );
    expect(itemFormSource).toContain("emit('requestSubmit', event);");
    expect(itemFormSource).toContain(
      '@press-enter="handleItemInputPressEnter"',
    );
    expect(itemFormSource).not.toContain(
      '@press-enter="focusNextInputOnEnter"',
    );
    expect(formSource).toContain(
      '@request-submit="handleLastInputEnterConfirm"',
    );
  });
});
