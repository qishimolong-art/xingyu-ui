import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');
const indexSource = readFileSync(join(currentDir, '../index.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, '../data.ts'), 'utf8');
const confirmHandler = formSource.slice(
  formSource.indexOf('async onConfirm() {'),
  formSource.indexOf(
    'async onOpenChange(',
    formSource.indexOf('async onConfirm() {'),
  ),
);
const beforeCloseHandler = formSource.slice(
  formSource.indexOf('async onBeforeClose() {'),
  formSource.indexOf(
    'async onConfirm() {',
    formSource.indexOf('async onBeforeClose() {'),
  ),
);
const draftSaveHandler = formSource.slice(
  formSource.indexOf('async function saveSaleQuoteDraft('),
  formSource.indexOf(
    'async function handleGenerateDraft()',
    formSource.indexOf('async function saveSaleQuoteDraft('),
  ),
);
const detailEditHandler = formSource.slice(
  formSource.indexOf('async function handleEditFromDetail()'),
  formSource.indexOf(
    'async function loadDetailData(',
    formSource.indexOf('async function handleEditFromDetail()'),
  ),
);
const prependFooterTemplate = formSource.slice(
  formSource.indexOf('<template v-if="!reportViewOnly" #prepend-footer>'),
  formSource.indexOf(
    '<ConvertCartModal',
    formSource.indexOf('<template v-if="!reportViewOnly" #prepend-footer>'),
  ),
);
const centerFooterTemplate = formSource.slice(
  formSource.indexOf('<template v-if="!reportViewOnly" #center-footer>'),
  formSource.indexOf(
    '</template>',
    formSource.indexOf('<template v-if="!reportViewOnly" #center-footer>'),
  ),
);

describe('sale quote draft lifecycle', () => {
  it('saves create and edit drafts on non-cancel close', () => {
    expect(beforeCloseHandler).toContain(
      'return saveSaleQuoteDraft(isCreatingDraft);',
    );
    expect(draftSaveHandler).toContain('await createSaleQuoteDraft(data);');
    expect(draftSaveHandler).toContain('await updateSaleQuoteDraft(data);');
    expect(draftSaveHandler).toContain(
      'await buildCurrentSaleQuotePayload({ draft: true });',
    );
    expect(draftSaveHandler).toContain(
      "!hasValidSaleDraftItems(data.items ?? [], { priceMode: 'none' })",
    );
    expect(draftSaveHandler).toContain(
      "message.warning('未选择明细，不生成草稿');",
    );
    expect(draftSaveHandler).toContain('草稿修改已自动保存');
    expect(draftSaveHandler).toContain('return false;');
    expect(formSource).toContain('itemFormInstance?.getDraftItems?.()');
  });

  it('does not save a draft for explicit cancel', () => {
    expect(beforeCloseHandler).toContain('async onCancel() {');
    expect(beforeCloseHandler).toContain('skipDraftOnClose = true;');
    expect(beforeCloseHandler).toContain('await modalApi.close();');
  });

  it('updates a draft before formally submitting it', () => {
    const updateIndex = confirmHandler.indexOf(
      'await updateSaleQuoteDraft(data);',
    );
    const submitIndex = confirmHandler.indexOf(
      'await submitSaleQuote(editingQuoteId);',
    );
    const closeIndex = confirmHandler.indexOf('await modalApi.close();');
    expect(updateIndex).toBeGreaterThan(-1);
    expect(submitIndex).toBeGreaterThan(updateIndex);
    expect(closeIndex).toBeGreaterThan(submitIndex);
    expect(formSource).toContain('formData.value?.status === 0');
    expect(formSource).toContain("hasAccessByCodes(['erp:sale-quote:create'])");
    expect(formSource).toContain("isEditingDraft.value ? '确认提交' : '确定'");
  });

  it('allows a draft opened in detail mode to be submitted', () => {
    expect(formSource).toContain("formType.value === 'detail'");
    expect(formSource).toContain('formData.value?.status === 0');
    expect(formSource).toContain("hasAccessByCodes(['erp:sale-quote:create'])");
    expect(formSource).toContain('v-if="showSubmitDraftBtn"');
    expect(formSource).toContain('@click="handleSubmitDraft"');
    expect(formSource).toContain('await submitSaleQuote(quoteId);');
    expect(formSource).toContain(
      '提交后将进入待下订状态，不能再按草稿方式修改。',
    );
  });

  it('allows explicit draft save on create and draft edit pages without duplicate close save', () => {
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
    expect(draftSaveHandler).toContain('options.explicit');
    expect(draftSaveHandler).toContain('skipDraftOnClose = true;');
    expect(draftSaveHandler).toContain(
      'message.success(\n      options.explicit',
    );
    expect(draftSaveHandler).toContain('草稿生成成功');
    expect(draftSaveHandler).toContain('草稿保存成功');
    expect(draftSaveHandler).toContain('await modalApi.close();');
  });

  it('supports detail-page edit with customer and item hydration fallback', () => {
    expect(formSource).toContain('const canEditFromDetail = computed(');
    expect(formSource).toContain("hasAccessByCodes(['erp:sale-quote:update'])");
    expect(prependFooterTemplate).toContain('v-if="canEditFromDetail"');
    expect(prependFooterTemplate).toContain('@click="handleEditFromDetail"');
    expect(detailEditHandler).toContain('!canEditFromDetail.value');
    expect(formSource).toContain('withCurrentSaleFormSelectOptions(');
    expect(formSource).toContain('hydrateSaleCustomerFromFallback(');
    expect(formSource).toContain('const isHydratingFormValues = ref(false);');
    expect(indexSource).toContain(
      "formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();",
    );
  });

  it('keeps modal footer spacing delegated to Vben Modal', () => {
    expect(prependFooterTemplate).not.toContain('class="mr-2"');
    expect(centerFooterTemplate).not.toContain('class="mr-2"');
  });

  it('locks before edit hydration and ignores stale responses', () => {
    const openHandler = formSource.slice(
      formSource.indexOf('async onOpenChange('),
    );
    const lockIndex = openHandler.indexOf('modalApi.lock();');
    const loadIndex = openHandler.indexOf('await loadHiddenFields();');
    expect(lockIndex).toBeGreaterThan(-1);
    expect(loadIndex).toBeGreaterThan(lockIndex);
    expect(openHandler).toContain('if (sequence !== formLoadSequence) return;');
    expect(openHandler).toContain(
      'await getItemFormInstance()?.waitForItemsReady?.();',
    );
  });

  it('refreshes item rows immediately after server batch update reloads detail data', () => {
    const reloadHandler = formSource.slice(
      formSource.indexOf('async function reloadSaleQuoteDetail()'),
      formSource.indexOf(
        'function getItemFormInstance()',
        formSource.indexOf('async function reloadSaleQuoteDetail()'),
      ),
    );
    const successHandler = itemFormSource.slice(
      itemFormSource.indexOf('async function handleBatchAdjustPriceSuccess'),
      itemFormSource.indexOf(
        'function isSelectedBatchItemRow',
        itemFormSource.indexOf('async function handleBatchAdjustPriceSuccess'),
      ),
    );

    expect(reloadHandler).toContain(
      'buildSaleDocumentDetailFormValues(formData.value, formType.value)',
    );
    expect(reloadHandler).toContain('await nextTick();');
    expect(reloadHandler).toContain(
      'await getItemFormInstance()?.reloadItemsFromProps?.();',
    );
    expect(successHandler).toContain(
      'await applyLocalBatchUpdateItems(payload)',
    );
    expect(itemFormSource).toContain(
      'await syncItemsFromProps(props.items, { force: true });',
    );
    expect(itemFormSource).toContain('reloadItemsFromProps,');
    expect(itemFormSource).toContain('waitForItemsReady,');
  });

  it('preserves customer values while only replacing department options', () => {
    expect(formSource).toContain(
      'const preservedValues =\n      (await formApi.getValues())',
    );
    expect(formSource).toContain("fieldName: 'deptId'");
    expect(formSource).toContain('...preservedValues,');
    expect(formSource).toContain('customerId,');
    expect(formSource).not.toContain(
      'saleDeptOptions.value = buildDeptTree(list || []);\n    await refreshFormSchema();',
    );
  });

  it('renders draft status with color and text cues', () => {
    expect(formSource).toContain("0: { className: 'is-draft', label: '草稿' }");
    expect(formSource).toContain(
      "10: { className: 'is-info', label: '待下订' }",
    );
    expect(dataSource).toContain("title: '下订状态'");
    expect(dataSource).toContain("title: '出库状态'");
    expect(indexSource).toContain("'sale-quote-draft-row'");
    expect(indexSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(indexSource).toContain('.sale-quote-draft-row.row--hover');
  });

  it('shows an edit action for drafts in the fixed operation column', () => {
    expect(indexSource).toContain(
      'function isDraftQuote(row: ErpSaleQuoteApi.SaleQuote)',
    );
    expect(indexSource).toContain("label: '编辑'");
    expect(indexSource).toContain("auth: ['erp:sale-quote:update']");
    expect(indexSource).toContain('ifShow: () => isDraftQuote(row)');
    expect(indexSource).toContain('onClick: handleEdit.bind(null, row)');
  });

  it('keeps detail opening explicit instead of binding it to ordinary cells', () => {
    expect(indexSource).not.toContain('function handleCellClick');
    expect(indexSource).not.toContain('cellClick: handleCellClick');
    expect(indexSource).not.toContain('const linkColumnFields');
    expect(indexSource).not.toContain('const rowActionColumnFields');
    expect(indexSource).toContain('@click.stop="handleDetail(row)"');
    expect(indexSource).toContain('onClick: handleEdit.bind(null, row)');
    expect(indexSource).toContain('onClick: handleConvertCart.bind(null, row)');
    expect(indexSource).toContain('onClick: handleRowExport.bind(null, row)');
    expect(indexSource).toContain('confirm: () => handleDelete([row.id!])');
    expect(indexSource).toContain('@click="handlePrint(row)"');
    expect(indexSource).toContain("label: '继续选购'");
  });
});
