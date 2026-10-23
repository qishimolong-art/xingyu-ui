import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');
const purchaseInSelectModalSource = readFileSync(
  join(currentDir, 'purchase-in-select-modal.vue'),
  'utf8',
);
const purchaseInItemSelectModalSource = readFileSync(
  join(currentDir, 'purchase-in-item-select-modal.vue'),
  'utf8',
);
const indexSource = readFileSync(join(currentDir, '../index.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/purchase/priceadjust/index.ts'),
  'utf8',
);
const confirmHandler = formSource.slice(
  formSource.indexOf('async onConfirm() {'),
  formSource.indexOf(
    'async onOpenChange(',
    formSource.indexOf('async onConfirm() {'),
  ),
);
const closeHandler = formSource.slice(
  formSource.indexOf('async onBeforeClose() {'),
  formSource.indexOf(
    'async onConfirm() {',
    formSource.indexOf('async onBeforeClose() {'),
  ),
);
const draftHandler = formSource.slice(
  formSource.indexOf('async function savePurchasePriceAdjustDraft('),
  formSource.indexOf('async function handleGenerateDraft()'),
);

describe('purchase price adjust draft lifecycle', () => {
  it('explicit cancel skips automatic draft persistence', () => {
    expect(closeHandler).toContain('async onCancel() {');
    expect(closeHandler).toContain('skipDraftOnClose = true;');
    expect(closeHandler).toContain('await modalApi.close();');
  });

  it('other closes create or update exactly one draft', () => {
    expect(closeHandler).toContain('return savePurchasePriceAdjustDraft();');
    expect(draftHandler).toContain(
      'await createPurchasePriceAdjustDraft(data);',
    );
    expect(draftHandler).toContain('hasValidPurchaseDraftItems(data.items');
    expect(draftHandler).toContain('requireNewPrice: true');
    expect(draftHandler).toContain("message.warning('未选择明细，不生成草稿')");
    expect(draftHandler).toContain(
      'await updatePurchasePriceAdjustDraft(data);',
    );
    expect(draftHandler).toContain('if (draftSaving) return false;');
    expect(draftHandler).toContain('draftSaved = true;');
    expect(draftHandler).toContain('return false;');
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

  it('confirm uses transactional create/update-and-submit endpoints', () => {
    const createSubmitIndex = confirmHandler.indexOf(
      'await createAndSubmitPurchasePriceAdjust(data);',
    );
    const updateSubmitIndex = confirmHandler.indexOf(
      'await updateAndSubmitPurchasePriceAdjust(data);',
    );
    const closeIndex = confirmHandler.indexOf('await modalApi.close();');
    expect(createSubmitIndex).toBeGreaterThan(-1);
    expect(updateSubmitIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(
      Math.max(createSubmitIndex, updateSubmitIndex),
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:purchase-price-adjust:update-status'])",
    );
    expect(formSource).toContain(
      "formType.value === 'create' || isEditingDraft.value ? '确认提交' : '确定'",
    );
  });

  it('submits changed remote item rows instead of a stale parent snapshot', () => {
    expect(formSource).toContain(
      'async function buildMergedRemoteItemsForSubmit()',
    );
    expect(formSource).toContain(
      'const currentItems = getItemFormInstance()?.getItems?.();',
    );
    expect(formSource).toContain(
      'const currentItems = await buildMergedRemoteItemsForSubmit();',
    );
    expect(formSource).toContain("operation: 'update' as const");
    expect(formSource).toContain("operation: 'insert' as const");
    expect(formSource).toContain("operation: 'delete' as const");
    expect(itemFormSource).toContain('function getItems()');
    expect(itemFormSource).toContain('defineExpose({');
    expect(itemFormSource).toContain('getItems,');
    expect(itemFormSource).toContain('reloadItemsFromProps,');
    expect(itemFormSource).toMatch(
      /defineExpose\(\{[^}]*\bvalidate\b[^}]*\}\)/u,
    );
  });

  it('uses paged price-adjust items with the unified compact pager contract', () => {
    expect(apiSource).toContain('includeItems?: boolean');
    expect(apiSource).toContain('/erp/purchase-price-adjust/item-page');
    expect(formSource).toContain('const DEFAULT_ITEM_PAGE_SIZE = 10;');
    expect(formSource).toContain(':item-pagination="itemPageState"');
    expect(formSource).toContain(
      '@page-change="loadPurchasePriceAdjustItemPage"',
    );
    expect(itemFormSource).toContain(
      "const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];",
    );
    expect(itemFormSource).toContain('height: ITEM_TABLE_HEIGHT');
    expect(itemFormSource).toContain('font-size: 11px;');
    expect(itemFormSource).toContain('box-sizing: border-box;');
  });

  it('keeps the item grid option data synchronized with refreshed rows', () => {
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

  it('keeps purchase-in selection modal data synchronized before row-selection rerenders', () => {
    expect(purchaseInSelectModalSource).toContain(
      'gridApi.setGridOptions({ data: dataSource.value });',
    );
    expect(purchaseInSelectModalSource).toContain(
      'await gridApi.grid.reloadData(dataSource.value);',
    );
    expect(purchaseInItemSelectModalSource).toContain(
      'gridApi.setGridOptions({ data: dataSource.value });',
    );
    expect(purchaseInItemSelectModalSource).toContain(
      'await gridApi.grid.reloadData(dataSource.value);',
    );
  });

  it('filters invoiced purchase-in rows from price-adjust selection flows', () => {
    expect(purchaseInSelectModalSource).toContain(
      'const availableList = (list || []).filter((row) => !row.hasInvoice);',
    );
    expect(purchaseInItemSelectModalSource).toContain(
      'getApprovedPurchaseInItemPage({',
    );
    expect(purchaseInItemSelectModalSource).toContain('excludeInvoiced: true');
    expect(purchaseInItemSelectModalSource).toContain('excludeAdjusted: true');
    expect(purchaseInItemSelectModalSource).toContain(
      'productKeyword: productKeyword.value || undefined',
    );
    expect(purchaseInSelectModalSource).toContain(
      '已完成采购票据开具的入库单不会显示',
    );
    expect(purchaseInItemSelectModalSource).toContain(
      '已完成采购票据开具的入库明细不会显示',
    );
    expect(formSource).toContain(
      'const uninvoicedRows = rows.filter(({ inRow }) => !inRow.hasInvoice);',
    );
    expect(formSource).toContain('loadSelectedPurchaseInAdjustItems(');
    expect(formSource).toContain('inIds,');
    expect(formSource).toContain('excludeInvoiced: true,');
  });

  it('detail mode can submit persisted drafts directly', () => {
    expect(formSource).toContain('canSubmitDraftFromDetail');
    expect(formSource).toContain('handleSubmitDraftFromDetail');
    expect(formSource).toContain('await submitPurchasePriceAdjust(id);');
    expect(formSource).toContain('提交后将进入待审批状态');
    expect(formSource).toContain('!detailLoading.value');
    expect(formSource).toContain('!detailLoadError.value');
  });

  it('detail edit follows the list editable status and switches in place', () => {
    const editHandler = formSource.slice(
      formSource.indexOf('async function handleEditFromDetail()'),
      formSource.indexOf('async function switchDetailToEdit'),
    );
    expect(formSource).toContain('const canEditFromDetail = computed(');
    expect(formSource).toContain(
      'formData.value.status === 0 || formData.value.status === 10',
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:purchase-price-adjust:update'])",
    );
    expect(editHandler).toContain(
      'await switchDetailToEdit({ ...formData.value });',
    );
    expect(editHandler).not.toContain('modalApi.close');
    expect(editHandler).not.toContain("emit('edit'");
    expect(formSource).toContain('async function switchDetailToEdit(');
    expect(formSource).toContain('includeItems: false');
    expect(formSource).toContain(
      'await loadPurchasePriceAdjustItemPage({ pageNo: 1 });',
    );
    expect(formSource).toContain('v-if="canEditFromDetail"');
    expect(indexSource).toContain('<FormModal');
    expect(indexSource).toContain('@edit="handleEdit"');
    expect(indexSource).toContain('@print="handlePrint"');
    expect(indexSource).toContain('@success="handleRefresh"');
  });

  it('hydrates supplier data when entering edit from detail', () => {
    expect(indexSource).toContain(
      "formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open()",
    );
    expect(formSource).toContain(
      'initialData?: ErpPurchasePriceAdjustApi.PurchasePriceAdjust',
    );
    expect(formSource).toContain('hydratePurchaseSupplierFromFallback(');
    expect(formSource).toContain('data.initialData');
    expect(formSource).toContain('isInitializing = Boolean(data?.id)');
    expect(formSource).toContain('await nextTick();');
  });

  it('draft rows have text, tooltip, highlight and legend', () => {
    expect(indexSource).toContain("'purchase-price-adjust-draft-row'");
    expect(indexSource).toContain(
      '草稿：关闭新增或草稿编辑页面时自动保存，尚未正式提交',
    );
    expect(indexSource).toContain('浅蓝色行表示未正式提交的草稿');
  });

  it('uses separate draft and transactional formal-submit routes', () => {
    expect(apiSource).toContain('/erp/purchase-price-adjust/create-draft');
    expect(apiSource).toContain('/erp/purchase-price-adjust/update-draft');
    expect(apiSource).toContain('/erp/purchase-price-adjust/create-and-submit');
    expect(apiSource).toContain('/erp/purchase-price-adjust/update-and-submit');
  });
});
