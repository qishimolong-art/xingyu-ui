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
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/return/index.ts'),
  'utf8',
);
const transferOutModalSource = readFileSync(
  join(currentDir, 'modules/sale-return-transfer-out-form.vue'),
  'utf8',
);
const purchaseReturnModalSource = readFileSync(
  join(currentDir, 'modules/sale-return-purchase-return-form.vue'),
  'utf8',
);
const returnableItemSelectModalSource = readFileSync(
  join(currentDir, 'modules/sale-returnable-item-select-modal.vue'),
  'utf8',
);
const saleOutApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/out/index.ts'),
  'utf8',
);
const draftSaveHandler = formSource.slice(
  formSource.indexOf('async function saveSaleReturnDraft('),
  formSource.indexOf(
    'async function handleGenerateDraft()',
    formSource.indexOf('async function saveSaleReturnDraft('),
  ),
);
const detailEditHandler = formSource.slice(
  formSource.indexOf('async function handleEditFromDetail()'),
  formSource.indexOf(
    'const [Modal, modalApi]',
    formSource.indexOf('async function handleEditFromDetail()'),
  ),
);
const sourceSaleOutHandler = formSource.slice(
  formSource.indexOf('async function handleUpdateSaleOut'),
  formSource.indexOf(
    'function handleSelectReturnableItems',
    formSource.indexOf('async function handleUpdateSaleOut'),
  ),
);
const prependFooterTemplate = formSource.slice(
  formSource.lastIndexOf('<template', formSource.indexOf('#prepend-footer>')),
  formSource.indexOf('</template>', formSource.indexOf('#prepend-footer>')),
);
const centerFooterTemplate = formSource.slice(
  formSource.lastIndexOf('<template', formSource.indexOf('#center-footer>')),
  formSource.indexOf('</template>', formSource.indexOf('#center-footer>')),
);

describe('sale return draft lifecycle contract', () => {
  it('separates explicit cancel, auto-save and formal draft submission', () => {
    expect(formSource).toContain('async onBeforeClose()');
    expect(formSource).toContain('async onCancel()');
    expect(formSource).toContain('skipDraftOnClose = true');
    expect(formSource).toContain(
      'return saveSaleReturnDraft(isCreatingDraft);',
    );
    expect(draftSaveHandler).toContain('createSaleReturnDraft(data)');
    expect(draftSaveHandler).toContain('updateSaleReturnDraft(data)');
    expect(draftSaveHandler).toContain(
      '!hasValidSaleDraftItems(data.items ?? [], {',
    );
    expect(draftSaveHandler).toContain(
      "message.warning('未选择明细，不生成草稿');",
    );
    expect(formSource).toContain('await submitSaleReturn(editingReturnId)');
    expect(
      formSource.indexOf('await updateSaleReturnDraft(data)'),
    ).toBeLessThan(
      formSource.lastIndexOf('await submitSaleReturn(editingReturnId)'),
    );
    expect(formSource).toContain('getItemFormInstance()?.getDraftItems?.() ??');
    expect(itemFormSource).toContain('function buildDraftItems()');
    expect(itemFormSource).toContain('getDraftItems: buildDraftItems');
  });

  it('locks loading before hydrating an existing draft and exposes detail submit', () => {
    expect(formSource).toContain('modalApi.lock()');
    expect(formSource).toContain('const sequence = ++formLoadSequence');
    expect(formSource).toContain('v-if="canSubmitDraft"');
    expect(formSource).toContain('提交后将进入待审批状态');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:sale-return:update-status'])",
    );
  });

  it('allows explicit draft save on create and draft edit pages', () => {
    expect(formSource).toContain(
      "() => formType.value === 'create' || isEditingDraft.value",
    );
    expect(formSource).toContain(
      "isEditingDraft.value ? '保存草稿' : '生成草稿'",
    );
    expect(centerFooterTemplate).toContain('v-if="canGenerateDraft"');
    expect(centerFooterTemplate).toContain('generateDraftButtonText');
    expect(centerFooterTemplate).toContain('@click="handleGenerateDraft"');
    expect(prependFooterTemplate).not.toContain('handleGenerateDraft');
    expect(draftSaveHandler).toContain('草稿生成成功');
    expect(draftSaveHandler).toContain('草稿保存成功');
    expect(draftSaveHandler).toContain('skipDraftOnClose = true;');
    expect(draftSaveHandler).toContain('await modalApi.close();');
  });

  it('adds a direct-return inline stock row with the detail-layer Insert shortcut', () => {
    expect(itemFormSource).toContain('isCreateShortcutKey(event)');
    expect(itemFormSource).toContain('canUseInlineStockSelector.value');
    expect(itemFormSource).toContain('void handleAddBlankItemRow();');
    expect(itemFormSource).toContain('isShortcutOverlayTarget(event.target)');
    expect(formSource).not.toContain('handleSaleReturnCreateShortcut');
    expect(formSource).not.toContain('SaleStockProductSelectModal');
    expect(itemFormSource).toContain('ErpInlineStockSelect');
    expect(itemFormSource).not.toContain('StockSelectionReviewModal');
    expect(itemFormSource).not.toContain(':before-confirm=');
    expect(formSource).not.toContain('isStockSelectionReviewOpen?.()');
    expect(itemFormSource).toContain('count: 1');
    expect(itemFormSource).toContain('productPrice: pickProductPrice(stock)');
    expect(formSource).toContain('const replacedBlankCreateKey');
    expect(formSource.indexOf('replacedBlankCreateKey &&')).toBeLessThan(
      formSource.indexOf('else if (firstRemainingAddedKey)'),
    );
    expect(itemFormSource).toContain('getSaleStockPage');
    expect(itemFormSource).toContain('canUseInlineStockSelector');
    expect(itemFormSource).toContain(
      "window.addEventListener('keydown', handleShortcut, true)",
    );
    expect(itemFormSource).toContain(
      "window.removeEventListener('keydown', handleShortcut, true)",
    );
  });

  it('keeps direct-return detail batch delete beside the add-row button', () => {
    const toolbar = itemFormSource.slice(
      itemFormSource.indexOf('<template #toolbar-tools>'),
      itemFormSource.indexOf(
        '<template #warehouseId=',
        itemFormSource.indexOf('<template #toolbar-tools>'),
      ),
    );

    expect(itemFormSource).toContain('const canShowItemSelection = computed(');
    expect(itemFormSource).toContain(
      'const selectedDeleteItemRows = computed(',
    );
    expect(itemFormSource).toContain('function handleBatchDeleteItems()');
    expect(itemFormSource).toContain('function canSelectItemRow(');
    expect(toolbar).toContain('canUseInlineStockSelector');
    expect(toolbar).toContain('handleAddBlankItemRow');
    expect(toolbar).toContain('handleBatchDeleteItems');
    expect(toolbar).toContain('批量删除');
    expect(toolbar.indexOf('handleAddBlankItemRow')).toBeLessThan(
      toolbar.indexOf('handleBatchDeleteItems'),
    );
    expect(toolbar.indexOf('handleBatchDeleteItems')).toBeLessThan(
      toolbar.indexOf('handleOpenBatchUpdateItems'),
    );
  });

  it('keeps the import action beside the item grid tools', () => {
    const toolbar = itemFormSource.slice(
      itemFormSource.indexOf('<template #toolbar-tools>'),
      itemFormSource.indexOf(
        '<template #warehouseId=',
        itemFormSource.indexOf('<template #toolbar-tools>'),
      ),
    );
    const toolbarSlot = formSource.slice(
      formSource.indexOf('<template #toolbar>'),
      formSource.indexOf(
        '</ItemForm>',
        formSource.indexOf('<template #toolbar>'),
      ),
    );

    expect(formSource).not.toContain(
      'class="sale-return-detail-section__tools"',
    );
    expect(toolbarSlot).toContain("formType !== 'detail'");
    expect(toolbarSlot).toContain('handleImport');
    expect(toolbarSlot).toContain('导入明细');
    expect(toolbar).toContain('<slot name="toolbar"></slot>');
    expect(toolbar.indexOf('handleOpenBatchUpdateItems')).toBeLessThan(
      toolbar.indexOf('<slot name="toolbar"></slot>'),
    );
  });

  it('supports detail-page edit with customer and item hydration fallback', () => {
    expect(formSource).toContain('const canEditFromDetail = computed(');
    expect(formSource).toContain(
      '[0, 10].includes(Number(formData.value?.status))',
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:sale-return:update'])",
    );
    expect(prependFooterTemplate).toContain('v-if="canEditFromDetail"');
    expect(prependFooterTemplate).toContain('@click="handleEditFromDetail"');
    expect(detailEditHandler).toContain('!canEditFromDetail.value');
    expect(formSource).toContain('withCurrentSaleFormSelectOptions(');
    expect(formSource).toContain('hydrateSaleCustomerFromFallback(');
    expect(listSource).toContain(
      "formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();",
    );
  });

  it('hydrates the source sale-out customer option instead of showing its raw id', () => {
    expect(formSource).toContain('withSaleCustomerFromSource(');
    expect(sourceSaleOutHandler).toContain(
      'await refreshSaleReturnFormSchema(formData.value);',
    );
    expect(
      sourceSaleOutHandler.indexOf('withSaleCustomerFromSource('),
    ).toBeLessThan(sourceSaleOutHandler.indexOf('await formApi.setValues('));
  });

  it('opens paged returnable item selection after choosing a source sale-out', () => {
    expect(formSource).toContain('SaleReturnableItemSelectModal');
    expect(formSource).toContain('const returnableItemSelectRef');
    expect(formSource).toContain('items: [],');
    expect(formSource).toContain(
      'options: { fillReturnableItems?: boolean; openItemSelector?: boolean }',
    );
    expect(formSource).toContain('if (options.openItemSelector ?? true)');
    expect(formSource).toContain('returnableItemSelectRef.value?.open(out);');
    expect(formSource).toContain('function handleSelectReturnableItems(');
    expect(formSource).toContain('recordRemoteItemChanges(items);');
    expect(formSource).not.toContain('loadAllSaleOutItems(');

    expect(returnableItemSelectModalSource).toContain(
      'getReturnableItemPageByOutId({',
    );
    expect(returnableItemSelectModalSource).toContain('pageSize: 20');
    expect(returnableItemSelectModalSource).toContain(
      'productKeyword: productKeyword.value || undefined',
    );
    expect(returnableItemSelectModalSource).toContain('selectedMap');
    expect(returnableItemSelectModalSource).toContain('countMap');
    expect(saleOutApiSource).toContain('/erp/sale-out/returnable-item-page');
  });

  it('keeps source-bound and stock-return locations read-only', () => {
    expect(formSource).toMatch(
      /:stock-location-readonly="\s*\[10, 20\]\.includes\(Number\(formData\?\.returnMode\)\)\s*"/,
    );
    expect(itemFormSource).toContain(
      "!['warehouseId', 'deptId'].includes(field)",
    );
    expect(itemFormSource).toContain(
      'v-if="!disabled && !warehouseReadonly && !stockLocationReadonly"',
    );
    expect(itemFormSource).toContain(
      'v-if="!disabled && !stockLocationReadonly"',
    );
  });

  it('auto-fills all returnable sale rows for whole sale return from source sale-out', () => {
    expect(formSource).toContain('getReturnableItemsByOutId');
    expect(formSource).toContain('fillReturnableItems?: boolean');
    expect(formSource).toContain('if (options.fillReturnableItems)');
    expect(formSource).toContain('await getReturnableItemsByOutId(out.id)');
    expect(formSource).toContain('count: Number(itemRow.returnableCount || 0)');
    expect(formSource).toContain(
      'fillReturnableItems: data.fillReturnableItems',
    );
    expect(saleOutApiSource).toContain('/erp/sale-out/returnable-items');
  });

  it('fills preselected returnable sale rows without reopening item selection', () => {
    expect(formSource).toContain('type SelectedReturnableRows = Array<{');
    expect(formSource).toContain(
      'selectedReturnableRows?: SelectedReturnableRows',
    );
    expect(formSource).toContain('!data.selectedReturnableRows?.length &&');
    expect(formSource).toContain('!data.fillReturnableItems');
    expect(formSource).toContain('if (data.selectedReturnableRows?.length)');
    expect(formSource).toContain(
      'handleSelectReturnableItems(\n                data.selectedReturnableRows,',
    );
  });

  it('refreshes item rows immediately after server batch update reloads detail data', () => {
    const reloadHandler = formSource.slice(
      formSource.indexOf('async function reloadSaleReturnDetail()'),
      formSource.indexOf(
        'function normalizeLoadedSaleReturn',
        formSource.indexOf('async function reloadSaleReturnDetail()'),
      ),
    );
    const successHandler = itemFormSource.slice(
      itemFormSource.indexOf('async function handleBatchUpdateItemsSuccess'),
      itemFormSource.indexOf(
        'function getItemRowKey',
        itemFormSource.indexOf('async function handleBatchUpdateItemsSuccess'),
      ),
    );

    expect(reloadHandler).toContain(
      'buildSaleDocumentDetailFormValues(formData.value, formType.value)',
    );
    expect(reloadHandler).toContain('await nextTick();');
    expect(reloadHandler).toContain(
      'await getItemFormInstance()?.reloadItemsFromProps?.();',
    );
    expect(formSource).toContain('function getItemFormInstance()');
    expect(successHandler).toContain(
      'await applyLocalBatchUpdateItems(payload, {',
    );
    expect(successHandler).toContain('showMessage: false');
    expect(successHandler).toContain('validateDuplicate: false');
    expect(itemFormSource).toContain(
      'await syncItemsFromProps(props.items, { force: true });',
    );
    expect(itemFormSource).toContain('reloadItemsFromProps,');
    expect(itemFormSource).toContain('validate,');
  });

  it('exposes department-only batch update when the detail department field is allowed', () => {
    const deptPermissionBlock = itemFormSource.slice(
      itemFormSource.indexOf('const canBatchEditDept = computed('),
      itemFormSource.indexOf(
        'const canUseServerBatchUpdate = computed(',
        itemFormSource.indexOf('const canBatchEditDept = computed('),
      ),
    );

    expect(deptPermissionBlock).toContain(
      "!isFieldHidden(props.hiddenFields, 'item_deptId')",
    );
    expect(deptPermissionBlock).not.toContain('item_warehouseDeptName');
    expect(itemFormSource).toContain('const batchUpdateButtonText = computed(');
    expect(itemFormSource).toContain("'批量修改部门'");
    expect(itemFormSource).toContain('{{ batchUpdateButtonText }}');
  });

  it('keeps modal footer spacing delegated to Vben Modal', () => {
    expect(prependFooterTemplate).not.toContain('class="mr-2"');
    expect(centerFooterTemplate).not.toContain('class="mr-2"');
  });

  it('shows an accessible draft row state and all dedicated API routes', () => {
    expect(listSource).toContain("'sale-return-draft-row'");
    expect(listSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(listSource).toContain('草稿：页面关闭时自动保存，尚未正式提交');
    expect(apiSource).toContain('/erp/sale-return/create-draft');
    expect(apiSource).toContain('/erp/sale-return/update-draft');
    expect(apiSource).toContain('/erp/sale-return/submit');
  });

  it('shows approved sale-return transfer actions only with dedicated permissions', () => {
    expect(formSource).toContain('const canCreateTransferOut = computed(');
    expect(formSource).toContain('const canCreatePurchaseReturn = computed(');
    expect(formSource).toContain('Number(formData.value?.status) === 20');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:sale-return:transfer-out'])",
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:sale-return:purchase-return'])",
    );
    expect(prependFooterTemplate).toContain('v-if="canCreateTransferOut"');
    expect(prependFooterTemplate).toContain('v-if="canCreatePurchaseReturn"');
    expect(prependFooterTemplate).toContain('转调拨');
    expect(prependFooterTemplate).toContain('转采购退货');
    expect(apiSource).toContain('/erp/sale-return/transfer-outable-items');
    expect(apiSource).toContain('/erp/sale-return/transfer-outable-item-page');
    expect(apiSource).toContain('/erp/sale-return/create-transfer-out');
    expect(apiSource).toContain('/erp/sale-return/purchase-returnable-items');
    expect(apiSource).toContain(
      '/erp/sale-return/purchase-returnable-item-page',
    );
    expect(apiSource).toContain('/erp/sale-return/create-purchase-return');
  });

  it('keeps transfer-out bulk values separate from row overrides', () => {
    expect(transferOutModalSource).toContain('batchForm');
    expect(transferOutModalSource).toContain('批量调出部门');
    expect(transferOutModalSource).toContain('批量调出仓库');
    expect(transferOutModalSource).toContain('批量调入部门');
    expect(transferOutModalSource).toContain('批量调入仓库');
    expect(transferOutModalSource).toContain('applyBatchValues');
    expect(transferOutModalSource).toContain('handleFromDeptChange(record)');
    expect(transferOutModalSource).toContain('handleToDeptChange(record)');
    expect(transferOutModalSource).toContain(
      'getSaleReturnTransferOutableItemPage',
    );
    expect(transferOutModalSource).toContain('rowCache');
    expect(transferOutModalSource).toContain('<Pagination');
    expect(transferOutModalSource).toContain('transferCount');
    expect(transferOutModalSource).toContain('调拨出库草稿生成成功');
  });

  it('defaults purchase-return row price from sale return and keeps it editable', () => {
    expect(purchaseReturnModalSource).toContain('供应商');
    expect(purchaseReturnModalSource).toContain('采购退货主表部门');
    expect(purchaseReturnModalSource).toContain('returnTime');
    expect(purchaseReturnModalSource).toContain(
      'getSaleReturnPurchaseReturnableItemPage',
    );
    expect(purchaseReturnModalSource).toContain('rowCache');
    expect(purchaseReturnModalSource).toContain('<Pagination');
    expect(purchaseReturnModalSource).toContain(
      'productPrice: cached?.productPrice ?? item.productPrice',
    );
    expect(purchaseReturnModalSource).toContain(
      'v-model:value="record.productPrice"',
    );
    expect(purchaseReturnModalSource).toContain('purchaseReturnCount');
    expect(purchaseReturnModalSource).toContain('采购退货草稿生成成功');
    expect(purchaseReturnModalSource).toContain(
      'getPurchaseReturnSupplierDeptSimplePage',
    );
    expect(purchaseReturnModalSource).toContain(
      'getPurchaseReturnSupplierDeptSimpleList',
    );
    expect(purchaseReturnModalSource).toContain(
      'should-fetch="(params) => Boolean(params.supplierId)"',
    );
    expect(purchaseReturnModalSource).toContain(
      '当前部门不在该供应商可用部门范围内，已清空',
    );
  });

  it('shows an edit action only before order confirmation in the fixed operation column', () => {
    expect(listSource).toContain(
      'function isDraftReturn(row: ErpSaleReturnApi.SaleReturn)',
    );
    expect(listSource).toContain(
      'function isEditableReturn(row: ErpSaleReturnApi.SaleReturn)',
    );
    expect(listSource).toContain(
      'return [0, 10].includes(Number(row.status));',
    );
    expect(listSource).toContain("label: '编辑'");
    expect(listSource).toContain("auth: ['erp:sale-return:update']");
    expect(listSource).toContain('ifShow: () => isEditableReturn(row)');
    expect(listSource).toContain('onClick: handleEdit.bind(null, row)');
  });
});
