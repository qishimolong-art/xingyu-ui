import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);
const batchUpdateItemsSource = readFileSync(
  join(currentDir, 'modules/batch-update-items-form.vue'),
  'utf8',
);
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/in/index.ts'),
  'utf8',
);
const currentSelectedCountPlaceholder = ['$', '{currentSelectedCount}'].join(
  '',
);
const selectedCountPlaceholder = ['$', '{selectedCount}'].join('');

describe('purchase in draft lifecycle contract', () => {
  it('separates cancel, close auto-save and transactional formal submission', () => {
    expect(formSource).toContain('async onBeforeClose()');
    expect(formSource).toContain('return savePurchaseInDraft();');
    expect(formSource).toContain('async onCancel()');
    expect(formSource).toContain('skipDraftOnClose = true');
    expect(formSource).toContain('hasValidPurchaseDraftItems(data.items)');
    expect(formSource).toContain("message.warning('未选择明细，不生成草稿')");
    expect(formSource).toContain('createPurchaseInDraft(data)');
    expect(formSource).toContain('updatePurchaseInDraft(data)');
    expect(formSource).toContain('updateAndSubmitPurchaseInDraft(data)');
  });

  it('supports explicit draft creation and draft-edit saving without duplicate auto-save', () => {
    const centerFooterTemplate = formSource.slice(
      formSource.lastIndexOf('<template', formSource.indexOf('#center-footer')),
      formSource.lastIndexOf(
        '<template',
        formSource.indexOf('#prepend-footer'),
      ),
    );
    const prependFooterTemplate = formSource.slice(
      formSource.lastIndexOf(
        '<template',
        formSource.indexOf('#prepend-footer'),
      ),
      formSource.indexOf('<div\n      class="purchase-document-form"'),
    );

    expect(formSource).toContain(
      "formType.value === 'create' || isEditingDraft.value",
    );
    expect(formSource).toContain(
      "isEditingDraft.value ? '保存草稿' : '生成草稿'",
    );
    expect(formSource).toContain('async function savePurchaseInDraft(');
    expect(formSource).toContain('async function handleGenerateDraft()');
    expect(formSource).toContain('v-if="canGenerateDraft"');
    expect(centerFooterTemplate).toContain('v-if="canGenerateDraft"');
    expect(centerFooterTemplate).toContain('generateDraftButtonText');
    expect(prependFooterTemplate).not.toContain('handleGenerateDraft');
    expect(formSource).toContain('closeOnSuccess: true');
    expect(formSource).toContain('stayOpenWhenEmpty: true');
    expect(formSource).toContain(
      "successMessage: isEditingDraft.value ? '草稿保存成功' : '草稿生成成功'",
    );
    expect(formSource).not.toContain('mr-2');
  });

  it('submits the current item grid rows instead of a stale parent snapshot', () => {
    expect(formSource).toContain(
      'async function buildMergedRemoteItemsForSubmit',
    );
    expect(formSource).toContain('function hasPurchaseInItemsForSubmit()');
    expect(formSource).toContain("message.error('请先添加入库明细')");
    expect(formSource).toContain(
      'await buildCurrentPurchaseInPayload(submitItems)',
    );
    expect(formSource).toContain(
      'items: (currentItems ?? values.items ?? []).map((item: any) => ({',
    );
    expect(itemFormSource).toContain('function getItems()');
    expect(itemFormSource).toContain("throw new Error('请先添加入库明细')");
    expect(formSource).toContain('requireItems: !isRemoteItemPaging.value');
    expect(itemFormSource).toContain('defineExpose({');
    expect(itemFormSource).toContain('focusFirstItemCountInput');
    expect(itemFormSource).toContain('getItems');
    expect(itemFormSource).toContain('reloadItemsFromProps');
    expect(itemFormSource).toContain('validate');
  });

  it('allocates self-pay freight display cost by item count', () => {
    const costDisplayBlock = itemFormSource.slice(
      itemFormSource.indexOf('function applyPurchaseCostDisplay()'),
      itemFormSource.indexOf('function buildItemColumns('),
    );

    expect(costDisplayBlock).toContain(
      'const positiveCountItems = tableData.value.filter',
    );
    expect(costDisplayBlock).toContain('(item) => Number(item.count || 0) > 0');
    expect(costDisplayBlock).toContain(
      'const totalCount = positiveCountItems.reduce',
    );
    expect(costDisplayBlock).toContain(
      'roundAmount((totalFreight * count) / totalCount)',
    );
    expect(costDisplayBlock).not.toContain('productTotal');
    expect(costDisplayBlock).not.toContain('totalFreight * lineAmount');
  });

  it('submits only changed remote items with operation markers', () => {
    const remoteSubmitBuilder = formSource.slice(
      formSource.indexOf('function buildRemoteItemChangeSetForSubmit()'),
      formSource.indexOf('function buildItemsForValidation()'),
    );
    const mergedSubmitBuilder = formSource.slice(
      formSource.indexOf('async function buildMergedRemoteItemsForSubmit()'),
      formSource.indexOf('function getMaskedSummaryValue'),
    );

    expect(apiSource).toContain("operation?: 'delete' | 'insert' | 'update'");
    expect(formSource).toContain('const remoteItemOriginals = new Map');
    expect(formSource).toContain('function isSameRemoteItem(');
    expect(remoteSubmitBuilder).toContain("operation: 'update' as const");
    expect(remoteSubmitBuilder).toContain("operation: 'insert' as const");
    expect(remoteSubmitBuilder).toContain("operation: 'delete' as const");
    expect(mergedSubmitBuilder).toContain(
      'return buildRemoteItemChangeSetForSubmit();',
    );
    expect(mergedSubmitBuilder).not.toContain('loadAllPurchaseInItems');
  });

  it('replaces the current purchase in item when selecting stock from an existing row', () => {
    const insertBlock = itemFormSource.slice(
      itemFormSource.indexOf(
        'function buildReplacementPurchaseInItemFromStock',
      ),
      itemFormSource.indexOf('function handleInlineStockSelected('),
    );

    expect(itemFormSource).toContain(
      'function buildReplacementPurchaseInItemFromStock',
    );
    expect(insertBlock).toContain('row.id = targetRow.id');
    expect(insertBlock).toContain('row.seq = targetRow.seq ?? row.seq');
    expect(insertBlock).toContain(
      '(row as any).inId = (targetRow as any).inId',
    );
    expect(insertBlock).not.toContain(
      'row.orderItemId = targetRow.orderItemId',
    );
    expect(insertBlock).toContain(
      'const [firstStock, ...additionalStocks] = selected',
    );
    expect(insertBlock).toContain(
      'tableData.value.splice(targetIndex, 1, replacementRow)',
    );
    expect(insertBlock).toContain('buildPurchaseInItemFromStock(stock)');
    expect(insertBlock).not.toContain('applyReviewedValues');
    expect(insertBlock).not.toContain('reviewedItems');
    expect(insertBlock).not.toContain('&& !options.targetRow?.productId');
  });

  it('normalizes remote item defaults before dirty comparison', () => {
    const compareBlock = formSource.slice(
      formSource.indexOf('function normalizeRemoteItemForCompare('),
      formSource.indexOf('function rememberRemoteItemOriginals('),
    );

    expect(compareBlock).toContain('function stringifyRemoteItemForCompare(');
    expect(compareBlock).toContain(
      "value === undefined || value === null || value === ''",
    );
    expect(compareBlock).toContain('Object.keys(rest)');
    expect(compareBlock).toContain('.toSorted()');
    expect(compareBlock).toContain('rest.gift &&');
    expect(compareBlock).toContain(
      '(rest.productPrice === undefined || rest.productPrice === null)',
    );
    expect(compareBlock).toContain('stringifyRemoteItemForCompare(current)');
    expect(compareBlock).toContain('stringifyRemoteItemForCompare(original)');
  });

  it('keeps remote item change caches across page switches', () => {
    const pageChangeBlock = formSource.slice(
      formSource.indexOf('async function handleItemPageChange('),
      formSource.indexOf('function handleUpdateSummary('),
    );
    const loadPageBlock = formSource.slice(
      formSource.indexOf('async function loadPurchaseInItemPage('),
      formSource.indexOf('async function loadAllPurchaseInItems('),
    );

    expect(pageChangeBlock).toContain('await loadPurchaseInItemPage(payload);');
    expect(pageChangeBlock).not.toContain('resetRemoteItemState');
    expect(loadPageBlock).toContain(
      'excludedItemIds: Array.from(remoteItemDeletes)',
    );
    expect(loadPageBlock).toContain('remoteItemCreates.size');
    expect(loadPageBlock).toContain(
      'rememberRemoteItemOriginals(result.list ?? [])',
    );
    expect(loadPageBlock).toContain('applyRemoteItemCache(result.list ?? [])');
  });

  it('locks hydration and exposes detail submission only through the computed guard', () => {
    expect(formSource).toContain('modalApi.lock()');
    expect(formSource).toContain('const sequence = ++detailLoadSequence');
    expect(formSource).toContain('v-if="canSubmitDraft"');
    expect(formSource).toContain('提交后将进入待审核状态');
    expect(formSource).toContain('!detailLoading.value');
    expect(formSource).toContain('!detailLoadError.value');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:purchase-in:update-status'])",
    );
  });

  it('detail edit follows the list editable status and switches in place', () => {
    const editHandler = formSource.slice(
      formSource.indexOf('async function handleEditFromDetail()'),
      formSource.indexOf('async function switchDetailToEdit'),
    );
    expect(formSource).toContain('const canEditFromDetail = computed(');
    expect(formSource).toContain(
      'formData.value?.status !== PURCHASE_IN_STATUS.APPROVE',
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:purchase-in:update'])",
    );
    expect(editHandler).toContain(
      'await switchDetailToEdit({ ...formData.value });',
    );
    expect(editHandler).not.toContain('modalApi.close');
    expect(editHandler).not.toContain("emit('edit'");
    expect(formSource).toContain('async function switchDetailToEdit(');
    expect(formSource).toContain('includeItems: false');
    expect(formSource).toContain(
      'await loadPurchaseInItemPage({ pageNo: 1 });',
    );
    expect(formSource).toContain('v-if="canEditFromDetail"');
    expect(listSource).toContain('<FormModal');
    expect(listSource).toContain('@edit="handleEdit"');
    expect(listSource).toContain('@print="handlePrint"');
    expect(listSource).toContain('@success="handleRefresh(true)"');
  });

  it('splits purchase return detail actions into whole and partial return flows', () => {
    const footerBlock = formSource.slice(
      formSource.lastIndexOf(
        '<template',
        formSource.indexOf('#prepend-footer'),
      ),
      formSource.indexOf('<div\n      class="purchase-document-form"'),
    );

    expect(formSource).toContain('PurchaseReturnableItemSelectModal');
    expect(formSource).toContain('const returnableItemSelectRef');
    expect(formSource).toContain('async function handleOpenPurchaseReturn()');
    expect(formSource).toContain('fillReturnableItems: true');
    expect(formSource).toContain('function handleOpenPartialPurchaseReturn()');
    expect(formSource).toContain(
      'function handleSelectPartialReturnableItems(',
    );
    expect(formSource).toContain(
      'returnableItemSelectRef.value?.open(formData.value);',
    );
    expect(formSource).toContain('selectedReturnableRows: rows');
    expect(formSource).toContain(
      '@select="handleSelectPartialReturnableItems"',
    );
    expect(footerBlock).toContain('整单退货');
    expect(footerBlock).toContain('部分退货');
    expect(footerBlock).not.toContain('采购退货');
  });

  it('hydrates supplier data when entering edit from detail', () => {
    expect(listSource).toContain(
      "formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open()",
    );
    expect(formSource).toContain('initialData?: ErpPurchaseInApi.PurchaseIn');
    expect(formSource).toContain('async function buildPermissionSchema');
    expect(formSource).toContain(
      'schema: await buildPermissionSchema(type, supplierData)',
    );
    expect(formSource).toContain(
      'schema: await buildPermissionSchema(formType.value, formData.value)',
    );
    expect(formSource).toContain('hydratePurchaseSupplierFromFallback(');
    expect(formSource).toContain('data.initialData');
    expect(formSource).toContain('let isHydratingFormValues = false');
    expect(formSource).toContain('if (isHydratingFormValues) return;');
  });

  it('shows an accessible draft state and dedicated routes', () => {
    expect(listSource).toContain("'purchase-in-draft-row'");
    expect(listSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(listSource).toContain('草稿：页面关闭时自动保存，尚未正式提交');
    expect(apiSource).toContain('/erp/purchase-in/create-draft');
    expect(apiSource).toContain('/erp/purchase-in/update-draft');
    expect(apiSource).toContain('/erp/purchase-in/update-and-submit');
    expect(apiSource).toContain('/erp/purchase-in/submit');
  });

  it('opens unfinished purchase in records for editing when continuing purchase', () => {
    const continueBuyAction = listSource.slice(
      listSource.indexOf('<template #continueBuyAction'),
      listSource.indexOf('<template #actions'),
    );

    expect(listSource).not.toContain('function handleContinueBuy');
    expect(continueBuyAction).toContain('onClick: handleEdit.bind(null, row)');
    expect(continueBuyAction).toContain('ifShow: () => row.status !== 20');
    expect(continueBuyAction).toContain("['erp:purchase-in:update']");
    expect(continueBuyAction).not.toContain("['erp:purchase-in:create']");
  });

  it('supports detail batch update for item warehouse and department', () => {
    expect(formSource).toContain('const canBatchUpdateItems = computed(');
    expect(formSource).toContain(':enable-batch-edit="canBatchUpdateItems"');
    expect(formSource).toContain(':in-id="formData?.id"');
    expect(formSource).toContain(
      '@batch-update-success="handleLinkedBusinessSuccess"',
    );
    expect(formSource).toContain(
      'await loadPurchaseInItemPage({ pageNo: itemPageState.value.pageNo });',
    );
    expect(itemFormSource).toContain('BatchUpdateItemsForm');
    expect(itemFormSource).toContain('canShowBatchUpdateItems');
    expect(itemFormSource).toContain("['erp:purchase-in:update']");
    expect(itemFormSource).toContain("['erp:purchase-in:create']");
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
    expect(itemFormSource).toContain('Number(row?.returnCount || 0) <= 0');
    expect(itemFormSource).toContain('!row?.hasInvoice');
    expect(itemFormSource).toContain('!row?.hasStockInBill');
    expect(itemFormSource).toContain('!row?.adjusted');
    expect(itemFormSource).toContain('selectedBatchItemCount');
    expect(itemFormSource).toContain(
      "mode: canUseServerBatchUpdate.value ? 'server' : 'local'",
    );
    expect(itemFormSource).toContain('applyLocalBatchUpdateItems');
    expect(itemFormSource).toContain('validateDuplicate?: boolean');
    expect(itemFormSource).toContain('validateDuplicate: false');
    expect(itemFormSource).toContain('async function reloadItemsFromProps()');
    expect(itemFormSource).toContain('hasDuplicateBatchUpdatedItems');
    expect(itemFormSource).toContain('批量修改仓库/部门');
    expect(batchUpdateItemsSource).toContain('batchUpdatePurchaseInItems');
    expect(batchUpdateItemsSource).toContain(
      'getPurchaseInWarehouseDeptSimplePage',
    );
    expect(batchUpdateItemsSource).toContain('getPurchaseInDeptSimplePage');
    expect(batchUpdateItemsSource).toContain('loadDeptSimplePage');
    expect(batchUpdateItemsSource).toContain(
      "type BatchUpdateMode = 'local' | 'server'",
    );
    expect(batchUpdateItemsSource).toContain('const currentMode = mode.value');
    expect(batchUpdateItemsSource).toContain(
      'const currentSelectedCount = selectedCount.value',
    );
    expect(batchUpdateItemsSource).toContain("currentMode === 'server'");
    expect(batchUpdateItemsSource).toContain("emit('success',");
    expect(batchUpdateItemsSource).toContain('mode: currentMode');
    expect(batchUpdateItemsSource).toContain(
      `message.success(\`已批量更新 ${currentSelectedCountPlaceholder} 条入库明细\`)`,
    );
    expect(batchUpdateItemsSource.replace(/\s+/g, ' ')).toContain(
      'warehouseId: canEditWarehouse.value ? formData.value.warehouseId : undefined',
    );
    expect(batchUpdateItemsSource).toContain('getSingleWarehouseDeptId()');
    expect(batchUpdateItemsSource).toContain('warehouseDeptTotal.value > 1');
    expect(batchUpdateItemsSource).toContain(
      "isFieldHidden(hiddenFields.value, 'item_warehouseId')",
    );
    expect(batchUpdateItemsSource).toContain(
      "isFieldHidden(hiddenFields.value, 'item_deptId')",
    );
    expect(apiSource).toContain('PurchaseInItemBatchUpdate');
    expect(apiSource).toContain('PurchaseInItemPageParam');
    expect(apiSource).toContain("'/erp/purchase-in/batch-update-items'");
    expect(apiSource).toContain("'/erp/purchase-in/item-page'");
    expect(apiSource).toContain(
      "'/erp/purchase-in/warehouse-dept-simple-list'",
    );
  });

  it('supports current-page batch deleting purchase in items through change tracking', () => {
    expect(itemFormSource).toContain('const canShowItemSelection = computed(');
    expect(itemFormSource).toContain(
      'const selectedDeleteItemRows = computed(',
    );
    expect(itemFormSource).toContain('function handleBatchDeleteItems()');
    expect(itemFormSource).toContain(
      "message.warning('请先勾选要删除的入库明细')",
    );
    expect(itemFormSource).toContain(
      `确认删除选中的 ${selectedCountPlaceholder} 条入库明细吗？`,
    );
    expect(itemFormSource).toContain(
      `message.success(\`已删除 ${selectedCountPlaceholder} 条入库明细\`)`,
    );
    expect(itemFormSource).toContain('v-if="!disabled"');
    expect(itemFormSource).toContain('批量删除');
    expect(itemFormSource).toContain('deleteItemRows(rows)');
    expect(itemFormSource).toContain('emitItemsUpdate(false)');
    expect(itemFormSource).toContain('clearBatchItemSelection();');
    expect(itemFormSource).toContain('canSelectItemRow(row)');
    expect(formSource).toContain('remoteItemDeletes.add(item.id)');
    expect(formSource).toContain("operation: 'delete' as const");
  });

  it('shows the add-row action before batch delete in the purchase in item toolbar', () => {
    const toolbarTools = itemFormSource.slice(
      itemFormSource.indexOf('<template #toolbar-tools>'),
      itemFormSource.indexOf('<template #warehouseId'),
    );

    expect(
      toolbarTools.indexOf('handleAddBlankItemRow'),
    ).toBeGreaterThanOrEqual(0);
    expect(
      toolbarTools.indexOf('handleBatchDeleteItems'),
    ).toBeGreaterThanOrEqual(0);
    expect(toolbarTools.indexOf('handleAddBlankItemRow')).toBeLessThan(
      toolbarTools.indexOf('handleBatchDeleteItems'),
    );
    expect(toolbarTools).toMatch(/>\s*新增行\s*<\/Button>/);
  });

  it('uses local and remote item pagination without recalculating remote summaries', () => {
    expect(itemFormSource).toContain('type PurchaseInItemPagination');
    expect(itemFormSource).toContain('const DEFAULT_ITEM_PAGE_SIZE = 10;');
    expect(itemFormSource).toContain('pageSize: DEFAULT_ITEM_PAGE_SIZE');
    expect(itemFormSource).toContain('const ITEM_TABLE_VISIBLE_ROWS = 10;');
    expect(itemFormSource).toContain('height: ITEM_TABLE_HEIGHT');
    expect(itemFormSource).toContain('props.remotePaging');
    expect(itemFormSource).toContain("emit('page-change'");
    expect(itemFormSource).toContain(
      'if (props.remotePaging) {\n      return;\n    }',
    );
    expect(itemFormSource).toContain(
      "const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];",
    );
    expect(itemFormSource).toContain(
      ':page-size-options="ITEM_PAGE_SIZE_OPTIONS"',
    );
    expect(itemFormSource).toContain(
      '.purchase-in-item-pager :deep(.ant-pagination)',
    );
    expect(itemFormSource).toContain('font-size: 11px;');
    expect(itemFormSource).toContain(
      ':deep(.ant-pagination-options-size-changer .ant-select-selector)',
    );
    expect(itemFormSource).toContain('min-height: 24px;');
  });

  it('restores row-level focus after remotely appending purchase in items', () => {
    const appendBlock = formSource.slice(
      formSource.indexOf('async function handleAppendItems('),
      formSource.indexOf('async function handleItemPageChange'),
    );

    expect(itemFormSource).toContain("emit('append-items', [row], 'product');");
    expect(itemFormSource).toContain("emit('append-items', newRows, 'count');");
    expect(itemFormSource).toContain(
      "emit('append-items', additionalRows, 'count', replacementRow);",
    );
    expect(itemFormSource).toContain('function focusItemRow(');
    expect(itemFormSource).toContain('focusItemRow,');
    expect(appendBlock).toContain(
      "focusField: ErpItemRowFocusField = 'count',",
    );
    expect(appendBlock).toContain('focusItem ??= item;');
    expect(appendBlock).toContain(
      'preferredFocusItem?: ErpPurchaseInApi.PurchaseInItem',
    );
    expect(appendBlock).toContain('pageNo: previousPage.pageNo');
    expect(appendBlock).toContain('preferredFocusItem,');
    expect(appendBlock).toContain(
      'await getItemFormInstance()?.focusItemRow?.(focusItem, focusField);',
    );
    expect(appendBlock).not.toContain('focusFirstItemCountInput');
  });

  it('keeps ordinary Enter edits on the current purchase in row', () => {
    const rowChangeBlock = itemFormSource.slice(
      itemFormSource.indexOf('function handleRowChange(row: any)'),
      itemFormSource.indexOf('function handleWholeQtyChange'),
    );

    expect(rowChangeBlock).toContain('emitItemsUpdate(index !== -1);');
    expect(rowChangeBlock).toContain('if (activeItemSort.value)');
    expect(rowChangeBlock).not.toContain('reloadData: false');
  });

  it('keeps the item grid option data synchronized before row-selection rerenders', () => {
    expect(itemFormSource).toContain(
      'const displayData = getDisplayTableData();',
    );
    expect(itemFormSource).toContain(
      'gridApi.setGridOptions({ columns, data: displayData });',
    );
    expect(itemFormSource).toContain(
      'await gridApi.grid.reloadData(displayData);',
    );
    expect(
      itemFormSource.indexOf(
        'gridApi.setGridOptions({ columns, data: displayData });',
      ),
    ).toBeLessThan(
      itemFormSource.indexOf('await gridApi.grid.reloadData(displayData);'),
    );
  });
});
