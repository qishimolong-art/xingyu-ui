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
const sourceSelectSource = readFileSync(
  join(currentDir, 'modules/purchase-in-select.vue'),
  'utf8',
);
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/invoice/index.ts'),
  'utf8',
);

describe('purchase invoice draft lifecycle contract', () => {
  it('separates explicit cancel, close auto-save, and formal submission', () => {
    expect(formSource).toContain('async onBeforeClose()');
    expect(formSource).toContain('return savePurchaseInvoiceDraft();');
    expect(formSource).toContain('async onCancel()');
    expect(formSource).toContain('skipDraftOnClose = true');
    expect(formSource).toContain('hasPurchaseInvoicePayloadItems(data)');
    expect(formSource).toContain("message.warning('未选择明细，不生成草稿')");
    expect(formSource).toContain('createPurchaseInvoiceDraft(data)');
    expect(formSource).toContain('updatePurchaseInvoiceDraft(data)');
    expect(formSource).toContain('updateAndSubmitPurchaseInvoiceDraft(data)');
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
    expect(formSource).toContain('async function savePurchaseInvoiceDraft(');
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
    expect(formSource).toMatch(
      /await loadAllPurchaseInvoiceItems\(\s*formData\.value\.id/,
    );
    expect(itemFormSource).toContain('function getItems()');
    expect(itemFormSource).toContain('defineExpose({');
    expect(itemFormSource).toContain('getItems,');
    expect(itemFormSource).toContain('reloadItemsFromProps,');
    expect(itemFormSource).toMatch(
      /defineExpose\(\{[^}]*\bvalidate\b[^}]*\}\)/u,
    );
  });

  it('uses paged invoice items with the unified compact pager contract', () => {
    expect(apiSource).toContain('includeItems?: boolean');
    expect(apiSource).toContain('/erp/purchase-invoice/item-page');
    expect(apiSource).toContain('/erp/purchase-invoice/source-document-page');
    expect(apiSource).toContain('/erp/purchase-invoice/source-item-page');
    expect(formSource).toContain('const DEFAULT_ITEM_PAGE_SIZE = 10;');
    expect(formSource).toContain(':item-pagination="itemPageState"');
    expect(formSource).toContain('@page-change="loadInvoiceDisplayItemPage"');
    expect(formSource).toContain('getPurchaseInvoiceMixedSourceItemPage({');
    expect(formSource).toContain('sourceRefs: [...selectedSourceRefs.value]');
    expect(formSource).not.toContain('getPurchaseInItems');
    expect(formSource).toMatch(
      /sourceRefs:\s*selectedSourceRefs\.value\.length > 0/,
    );
    expect(formSource).toMatch(
      /excludedSourceItemKeys:\s*selectedSourceRefs\.value\.length > 0/,
    );
    expect(itemFormSource).toContain(
      "const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];",
    );
    expect(itemFormSource).toContain('height: ITEM_TABLE_HEIGHT');
    expect(itemFormSource).toContain('font-size: 11px;');
    expect(itemFormSource).toContain('box-sizing: border-box;');
  });

  it('keeps manual rows and expands all selected source pages when creating or appending', () => {
    expect(formSource).toContain('const sourceManualItems = new Map<');
    expect(formSource).toContain('rememberManualItemsBeforeSourceSelection()');
    expect(formSource).toContain(
      'rememberExistingSourceAmounts(formData.value.id)',
    );
    expect(formSource).toContain('...sourceManualItems.values()');
    expect(formSource).toContain('return buildRemoteIncrementalItems();');
    expect(formSource).toContain('const isSourceSelectionActive = computed(');
    expect(formSource).toContain('if (isSourceSelectionActive.value)');
    expect(formSource).toContain('sourceAppendBaseTotalAmount.value');
    expect(formSource).toContain(
      'existingSourceDocumentAmounts.get(sourceDocumentKey)',
    );
  });

  it('restores persisted source checks and allows cancelling or restoring a saved source', () => {
    expect(formSource).toContain('function restorePersistedSourceSelection(');
    expect(formSource).toContain(
      'persistedSourceRefs.value = normalizePurchaseInvoiceSourceRefs(sourceRefs)',
    );
    expect(formSource).toContain(
      ':persisted-source-refs="persistedSourceRefs"',
    );
    expect(sourceSelectSource).toContain(
      'const displaySelectedRowKeys = computed<Key[]>',
    );
    expect(sourceSelectSource).toContain(
      'selectedRowKeys: displaySelectedRowKeys',
    );
    expect(sourceSelectSource).toContain(
      'isExhausted(record) && !isPersistedSource(record)',
    );
    expect(sourceSelectSource).toContain(
      '!persistedRowKeySet.value.has(String(key))',
    );
    expect(sourceSelectSource).toContain("'update:persistedSourceRefs'");
    expect(formSource).toContain(
      'async function handlePersistedSourceRefsChange(',
    );
    expect(formSource).toContain(
      '@update:persisted-source-refs="handlePersistedSourceRefsChange"',
    );
    expect(formSource).toContain('persistedSourceSelectionDeleteIds.add(');
    expect(formSource).toContain('persistedSourceSelectionDeleteIds.delete(');
    expect(formSource).toContain('loadExistingInvoiceItemsOnce(');
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

  it('locks before hydration and exposes permission-controlled detail submit', () => {
    const dataIndex = formSource.indexOf(
      'const data = modalApi.getData<',
      formSource.indexOf('async onOpenChange(isOpen: boolean)'),
    );
    const lockIndex = formSource.indexOf('modalApi.lock();', dataIndex);
    const permissionLoadIndex = formSource.indexOf(
      'await loadHiddenFields();',
      dataIndex,
    );

    expect(lockIndex).toBeGreaterThan(dataIndex);
    expect(permissionLoadIndex).toBeGreaterThan(lockIndex);
    expect(formSource).toContain('v-if="canSubmitDraft"');
    expect(formSource).toContain('!detailLoading.value');
    expect(formSource).toContain('!detailLoadError.value');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:purchase-invoice:update-status'])",
    );
    expect(formSource).toContain('提交后将进入待审核状态');
  });

  it('detail edit follows the list editable status and switches in place', () => {
    const editHandler = formSource.slice(
      formSource.indexOf('async function handleEditFromDetail()'),
      formSource.indexOf('async function switchDetailToEdit'),
    );
    expect(formSource).toContain('const canEditFromDetail = computed(');
    expect(formSource).toContain(
      'formData.value?.status === PURCHASE_INVOICE_STATUS.DRAFT',
    );
    expect(formSource).toContain(
      'formData.value?.status === PURCHASE_INVOICE_STATUS.PROCESS',
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:purchase-invoice:update'])",
    );
    expect(editHandler).toContain(
      'await switchDetailToEdit({ ...formData.value });',
    );
    expect(editHandler).not.toContain('modalApi.close');
    expect(editHandler).not.toContain("emit('edit'");
    expect(formSource).toContain('async function switchDetailToEdit(');
    expect(formSource).toContain('includeItems: false');
    expect(formSource).toContain(
      'await loadPurchaseInvoiceItemPage({ pageNo: 1 });',
    );
    expect(formSource).toContain('v-if="canEditFromDetail"');
    expect(listSource).toContain('<FormModal');
    expect(listSource).toContain('@edit="handleEdit"');
    expect(listSource).toContain('@print="handlePrint"');
    expect(listSource).toContain('@success="handleRefresh"');
  });

  it('hydrates supplier data when entering edit from detail', () => {
    expect(listSource).toContain(
      "formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open()",
    );
    expect(formSource).toContain(
      'initialData?: ErpPurchaseInvoiceApi.PurchaseInvoice',
    );
    expect(formSource).toContain('hydratePurchaseSupplierFromFallback(');
    expect(formSource).toContain('data.initialData');
    expect(formSource).toContain('let isHydratingFormValues = false');
    expect(formSource).toContain('if (isHydratingFormValues) return;');
  });

  it('shows accessible draft rows and uses dedicated draft routes', () => {
    expect(listSource).toContain("'purchase-invoice-draft-row'");
    expect(listSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(listSource).toContain('草稿：页面关闭时自动保存，尚未正式提交');
    expect(dataSource).toContain("{ label: '草稿', value: 0 }");
    expect(apiSource).toContain('/erp/purchase-invoice/create-draft');
    expect(apiSource).toContain('/erp/purchase-invoice/update-draft');
    expect(apiSource).toContain('/erp/purchase-invoice/update-and-submit');
    expect(apiSource).toContain('/erp/purchase-invoice/submit');
  });
});
