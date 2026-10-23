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
const batchUpdateItemsFormSource = readFileSync(
  join(currentDir, 'modules/batch-update-items-form.vue'),
  'utf8',
);
const returnableItemSelectModalSource = readFileSync(
  join(currentDir, 'modules/purchase-returnable-item-select-modal.vue'),
  'utf8',
);
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/return/index.ts'),
  'utf8',
);
const purchaseInApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/in/index.ts'),
  'utf8',
);
const currentSelectedCountPlaceholder = ['$', '{currentSelectedCount}'].join(
  '',
);

describe('purchase return draft lifecycle contract', () => {
  it('separates explicit cancel, auto-save, and formal draft submission', () => {
    expect(formSource).toContain('async onBeforeClose()');
    expect(formSource).toContain('return savePurchaseReturnDraft();');
    expect(formSource).toContain('async onCancel()');
    expect(formSource).toContain('skipDraftOnClose = true');
    expect(formSource).toContain('hasValidPurchaseDraftItems(data.items');
    expect(formSource).toContain(
      'requireSourceInItem: (data.returnMode ?? 10) === 10',
    );
    expect(formSource).toContain("message.warning('未选择明细，不生成草稿')");
    expect(formSource).toContain('createPurchaseReturnDraft(data)');
    expect(formSource).toContain('updatePurchaseReturnDraft(data)');
    expect(formSource).toContain('updateAndSubmitPurchaseReturnDraft(data)');
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
    expect(formSource).toContain('async function savePurchaseReturnDraft(');
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

  it('submits merged remote item rows instead of a stale parent snapshot', () => {
    expect(formSource).toContain(
      'async function buildMergedRemoteItemsForSubmit()',
    );
    expect(formSource).toContain(
      'const currentItems = getItemFormInstance()?.getItems?.();',
    );
    expect(formSource).toContain(
      'const submitItems = await buildMergedRemoteItemsForSubmit();',
    );
    expect(formSource).toContain(
      'await loadAllPurchaseReturnItems(formData.value.id',
    );
    expect(itemFormSource).toContain('function getItems()');
    expect(itemFormSource).toContain('defineExpose({');
    expect(itemFormSource).toContain('focusFirstItemCountInput');
    expect(itemFormSource).toContain('queueFocusFirstItemCountInput');
    expect(itemFormSource).toContain('getItems');
    expect(itemFormSource).toContain('reloadItemsFromProps');
    expect(itemFormSource).toContain('validate');
    expect(itemFormSource).toContain("throw new Error('请先添加退货明细')");
  });

  it('uses paged return items with the unified compact pager contract', () => {
    expect(apiSource).toContain('includeItems?: boolean');
    expect(apiSource).toContain('/erp/purchase-return/item-page');
    expect(formSource).toContain('const DEFAULT_ITEM_PAGE_SIZE = 10;');
    expect(formSource).toContain(':item-pagination="itemPageState"');
    expect(formSource).toContain('@page-change="loadPurchaseReturnItemPage"');
    expect(itemFormSource).toContain(
      "const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];",
    );
    expect(itemFormSource).toContain('height: ITEM_TABLE_HEIGHT');
    expect(itemFormSource).toContain('font-size: 11px;');
    expect(itemFormSource).toContain('box-sizing: border-box;');
  });

  it('locks before hydration and exposes permission-controlled detail submit', () => {
    const lockIndex = formSource.indexOf('modalApi.lock();');
    const applyModeIndex = formSource.indexOf(
      'await applyFormMode(data.type, data.initialData);',
    );

    expect(lockIndex).toBeGreaterThan(-1);
    expect(applyModeIndex).toBeGreaterThan(lockIndex);
    expect(formSource).toContain('v-if="canSubmitDraft"');
    expect(formSource).toContain('提交后将进入待审核状态');
    expect(formSource).toContain('!detailLoading.value');
    expect(formSource).toContain('!detailLoadError.value');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:purchase-return:update-status'])",
    );
  });

  it('detail edit follows the list editable status and switches in place', () => {
    const editHandler = formSource.slice(
      formSource.indexOf('async function handleEditFromDetail()'),
      formSource.indexOf('async function switchDetailToEdit'),
    );
    expect(formSource).toContain('const canEditFromDetail = computed(');
    expect(formSource).toContain(
      'formData.value?.status !== PURCHASE_RETURN_STATUS.APPROVE',
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:purchase-return:update'])",
    );
    expect(editHandler).toContain(
      'await switchDetailToEdit({ ...formData.value });',
    );
    expect(editHandler).not.toContain('modalApi.close');
    expect(editHandler).not.toContain("emit('edit'");
    expect(formSource).toContain('async function switchDetailToEdit(');
    expect(formSource).toContain('includeItems: false');
    expect(formSource).toContain(
      'await loadPurchaseReturnItemPage({ pageNo: 1 });',
    );
    expect(formSource).toContain('v-if="canEditFromDetail"');
    expect(listSource).toContain('<FormModal');
    expect(listSource).toContain('@edit="handleEdit"');
    expect(listSource).toContain('@print="handlePrint"');
    expect(listSource).toContain('@success="handleRefresh(true)"');
  });

  it('hydrates supplier data when entering edit from detail', () => {
    expect(listSource).toContain(
      "formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open()",
    );
    expect(formSource).toContain(
      'initialData?: ErpPurchaseReturnApi.PurchaseReturn',
    );
    expect(formSource).toContain('hydratePurchaseSupplierFromFallback(');
    expect(formSource).toContain('data.initialData');
    expect(formSource).toContain('let isHydratingFormValues = false');
    expect(formSource).toContain('if (isHydratingFormValues) return;');
  });

  it('hydrates the source purchase-in header from item rows for detail and edit', () => {
    expect(apiSource).toContain('sourceInId?: number;');
    expect(apiSource).toContain('sourceInNo?: string;');
    expect(formSource).toContain('function getSourceInFromItems(');
    expect(formSource).toContain(
      '(data.items ?? []).find((item) => item.sourceInId || item.sourceInNo)',
    );
    expect(formSource).toContain(
      'sourceInId: data.sourceInId ?? sourceIn?.sourceInId',
    );
    expect(formSource).toContain(
      'sourceInNo: data.sourceInNo ?? sourceIn?.sourceInNo',
    );
  });

  it('opens paged returnable item selection after choosing a source purchase-in', () => {
    expect(formSource).toContain('PurchaseReturnableItemSelectModal');
    expect(formSource).toContain('const returnableItemSelectRef');
    expect(formSource).toContain('includeItems: false');
    expect(formSource).toContain('items: [],');
    expect(formSource).toContain(
      'options: { fillReturnableItems?: boolean; openItemSelector?: boolean }',
    );
    expect(formSource).toContain(
      'returnableItemSelectRef.value?.open(sourcePurchaseIn);',
    );
    expect(formSource).toContain('function handleSelectReturnableItems(');
    expect(formSource).toContain(
      'toReturnItemsFromSelectedRows(rows, sourcePurchaseIn)',
    );

    expect(returnableItemSelectModalSource).toContain(
      'getReturnableItemPageByInId({',
    );
    expect(returnableItemSelectModalSource).toContain('pageSize: 20');
    expect(returnableItemSelectModalSource).toContain(
      'productKeyword: productKeyword.value || undefined',
    );
    expect(returnableItemSelectModalSource).toContain('selectedMap');
    expect(returnableItemSelectModalSource).toContain('countMap');
    expect(purchaseInApiSource).toContain(
      '/erp/purchase-in/returnable-item-page',
    );
  });

  it('auto-fills all returnable items for whole purchase return from source purchase-in', () => {
    expect(formSource).toContain('getReturnableItemsByInId');
    expect(formSource).toContain('fillReturnableItems?: boolean');
    expect(formSource).toContain('if (options.fillReturnableItems)');
    expect(formSource).toContain(
      'await getReturnableItemsByInId(sourcePurchaseIn.id)',
    );
    expect(formSource).toContain('count: Number(itemRow.returnableCount || 0)');
    expect(formSource).toContain('warehouseName: itemRow.warehouseName');
    expect(formSource).toContain('deptName: itemRow.deptName');
    expect(formSource).toContain(
      'fillReturnableItems: data.fillReturnableItems',
    );
    expect(purchaseInApiSource).toContain('/erp/purchase-in/returnable-items');
  });

  it('fills preselected returnable rows without reopening item selection', () => {
    expect(formSource).toContain('type SelectedReturnableRows = Array<{');
    expect(formSource).toContain(
      'selectedReturnableRows?: SelectedReturnableRows',
    );
    expect(formSource).toContain('!data.selectedReturnableRows?.length &&');
    expect(formSource).toContain('!data.fillReturnableItems');
    expect(formSource).toContain('if (data.selectedReturnableRows?.length)');
    expect(formSource).toContain(
      'handleSelectReturnableItems(\n              data.selectedReturnableRows,\n              sourcePurchaseIn,',
    );
  });

  it('shows accessible draft rows and uses dedicated draft routes', () => {
    expect(listSource).toContain("'purchase-return-draft-row'");
    expect(listSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(listSource).toContain('草稿：页面关闭时自动保存，尚未正式提交');
    expect(apiSource).toContain('/erp/purchase-return/create-draft');
    expect(apiSource).toContain('/erp/purchase-return/update-draft');
    expect(apiSource).toContain('/erp/purchase-return/update-and-submit');
    expect(apiSource).toContain('/erp/purchase-return/submit');
  });

  it('wires detail item batch warehouse and department update', () => {
    expect(formSource).toContain('const canBatchUpdateItems = computed');
    expect(formSource).toContain(':enable-batch-edit="canBatchUpdateItems"');
    expect(formSource).toContain(':return-id="formData?.id"');
    expect(formSource).toContain(
      '@batch-update-success="handleBatchUpdateItemsSuccess"',
    );
    expect(formSource).toContain('await reloadCurrentPurchaseReturnDetail()');
    expect(formSource).toContain(
      'await getItemFormInstance()?.reloadItemsFromProps?.();',
    );

    expect(itemFormSource).toContain("['erp:purchase-return:update']");
    expect(itemFormSource).toContain("['erp:purchase-return:create']");
    expect(itemFormSource).toContain(
      'hasAccessByCodes(batchUpdateAccessCodes.value)',
    );
    expect(itemFormSource).toContain('props.returnMode === 20');
    expect(itemFormSource).toContain("type: 'checkbox'");
    expect(itemFormSource).toContain('selectedBatchItemCount');
    expect(itemFormSource).toContain('batchUpdateButtonText');
    expect(itemFormSource).toContain(
      "slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' }",
    );
    expect(itemFormSource).toContain('<template #toolbar-buttons>');
    expect(itemFormSource).toContain('<template #toolbar-tools>');
    expect(itemFormSource).toContain('class="purchase-return-item-toolbar');
    expect(itemFormSource).toContain("? '批量修改仓库/部门' : '批量修改部门'");
    expect(itemFormSource).toContain('Boolean(row?.productId)');
    expect(itemFormSource).toContain(
      "mode: canUseServerBatchUpdate.value ? 'server' : 'local'",
    );
    expect(itemFormSource).toContain('applyLocalBatchUpdateItems');
    expect(itemFormSource).toContain('validateDuplicate?: boolean');
    expect(itemFormSource).toContain('validateDuplicate: false');
    expect(itemFormSource).toContain('async function reloadItemsFromProps()');
    expect(itemFormSource).toContain('hasDuplicateBatchUpdatedItems');

    expect(batchUpdateItemsFormSource).toContain(
      'getPurchaseReturnWarehouseDeptSimplePage',
    );
    expect(batchUpdateItemsFormSource).toContain(
      'getPurchaseReturnDeptSimplePage',
    );
    expect(batchUpdateItemsFormSource).toContain('loadDeptSimplePage');
    expect(batchUpdateItemsFormSource).toContain(
      'batchUpdatePurchaseReturnItems({',
    );
    expect(batchUpdateItemsFormSource).toContain('returnMode.value === 20');
    expect(batchUpdateItemsFormSource).toContain(
      "type BatchUpdateMode = 'local' | 'server'",
    );
    expect(batchUpdateItemsFormSource).toContain(
      'const currentMode = mode.value',
    );
    expect(batchUpdateItemsFormSource).toContain(
      'const currentSelectedCount = selectedCount.value',
    );
    expect(batchUpdateItemsFormSource).toContain("currentMode === 'server'");
    expect(batchUpdateItemsFormSource).toContain("emit('success',");
    expect(batchUpdateItemsFormSource).toContain('mode: currentMode');
    expect(batchUpdateItemsFormSource).toContain(
      `message.success(\`已批量更新 ${currentSelectedCountPlaceholder} 条退货明细\`)`,
    );
    expect(batchUpdateItemsFormSource.replace(/\s+/g, ' ')).toContain(
      'warehouseId: canEditWarehouse.value ? formData.value.warehouseId : undefined',
    );
    expect(batchUpdateItemsFormSource).toContain('getSingleWarehouseDeptId()');
    expect(batchUpdateItemsFormSource).toContain(
      'warehouseDeptTotal.value === 1',
    );
    expect(apiSource).toContain(
      '/erp/purchase-return/warehouse-dept-simple-list',
    );
    expect(apiSource).toContain('/erp/purchase-return/batch-update-items');
  });

  it('uses inline stock selection only for stock-mode purchase returns', () => {
    const insertBlock = itemFormSource.slice(
      itemFormSource.indexOf(
        'function buildReplacementPurchaseReturnItemFromStock',
      ),
      itemFormSource.indexOf('function handleCountBlur'),
    );

    expect(itemFormSource).toContain('PurchaseInlineStockSelect');
    expect(itemFormSource).toContain(
      'const canUseInlineStockSelector = computed(',
    );
    expect(itemFormSource).toContain(
      '!props.disabled && props.returnMode === 20',
    );
    expect(itemFormSource).toContain('v-if="canUseInlineStockSelector"');
    expect(itemFormSource).toContain('function handleAddBlankItemRow()');
    expect(itemFormSource).toContain('focusProductNameInput(row)');
    expect(itemFormSource).toContain('function handleBatchDeleteItems()');
    expect(itemFormSource).toContain('批量删除');
    expect(insertBlock).toContain('row.id = targetRow.id');
    expect(insertBlock).toContain('row.seq = targetRow.seq ?? row.seq');
    expect(insertBlock).toContain(
      '(row as any).returnId = (targetRow as any).returnId',
    );
    expect(insertBlock).toContain(
      'const [firstStock, ...additionalStocks] = selectedProducts',
    );
    expect(insertBlock).toContain(
      'tableData.value.splice(targetIndex, 1, replacementRow)',
    );
    expect(formSource).not.toContain('PurchaseStockProductSelectModal');
    expect(formSource).not.toContain('选择库存');
    expect(formSource).toContain('PurchaseReturnableItemSelectModal');
    expect(formSource).toContain(
      'returnableItemSelectRef.value?.open(sourcePurchaseIn)',
    );
  });

  it('restores row-level focus after remotely appending purchase return items', () => {
    const appendBlock = formSource.slice(
      formSource.indexOf('async function handleAppendItems('),
      formSource.indexOf('function handleUpdateSummary'),
    );

    expect(itemFormSource).toContain("emit('append-items', [row], 'product');");
    expect(itemFormSource).toContain("emit('append-items', rows, 'count');");
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
      'preferredFocusItem?: ErpPurchaseReturnApi.PurchaseReturnItem',
    );
    expect(appendBlock).toContain('pageNo: previousPage.pageNo');
    expect(appendBlock).toContain('preferredFocusItem,');
    expect(appendBlock).toContain(
      'await getItemFormInstance()?.focusItemRow?.(focusItem, focusField);',
    );
    expect(appendBlock).not.toContain('queueFocusFirstItemCountInput');
  });

  it('keeps ordinary Enter edits on the current purchase return row', () => {
    const rowChangeBlock = itemFormSource.slice(
      itemFormSource.indexOf('function handleRowChange(row: any)'),
      itemFormSource.indexOf('function initRow('),
    );

    expect(rowChangeBlock).toContain('emitItemsUpdate(true);');
    expect(rowChangeBlock).toContain('if (activeItemSort.value)');
    expect(rowChangeBlock).not.toContain('reloadData: false');
  });

  it('does not steal focus when ordinary item edits propagate to the parent', () => {
    const updateBlock = formSource.slice(
      formSource.indexOf('async function handleUpdateItems('),
      formSource.indexOf('async function handleAppendItems('),
    );

    expect(updateBlock).toContain('recordRemoteItemChanges(items);');
    expect(updateBlock).toContain('formApi.setValues(');
    expect(updateBlock).toContain('await loadPurchaseReturnItemPage(');
    expect(updateBlock).not.toMatch(/focus/i);
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
