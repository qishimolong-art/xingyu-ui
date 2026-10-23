import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');
const saleOutItemSelectModalSource = readFileSync(
  join(currentDir, 'sale-out-item-select-modal.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/sale/priceadjust/index.ts'),
  'utf8',
);
const indexSource = readFileSync(join(currentDir, '../index.vue'), 'utf8');
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
const draftSaveHandler = formSource.slice(
  formSource.indexOf('async function saveSalePriceAdjustDraft('),
  formSource.indexOf(
    'async function handleGenerateDraft()',
    formSource.indexOf('async function saveSalePriceAdjustDraft('),
  ),
);
const detailEditHandler = formSource.slice(
  formSource.indexOf('async function handleEditFromDetail()'),
  formSource.indexOf(
    'function handleSubmitDraftFromDetail()',
    formSource.indexOf('async function handleEditFromDetail()'),
  ),
);
const basicFocusHandler = formSource.slice(
  formSource.indexOf('function canFocusBasicForm()'),
  formSource.indexOf(
    'function handleEditRemark()',
    formSource.indexOf('function canFocusBasicForm()'),
  ),
);
const selectItemsHandler = formSource.slice(
  formSource.indexOf('async function handleItemsSelected('),
  formSource.indexOf(
    'async function applySourceSaleOut',
    formSource.indexOf('async function handleItemsSelected('),
  ),
);
const sourceSaleOutHandler = formSource.slice(
  formSource.indexOf('async function applySourceSaleOut'),
  formSource.indexOf(
    'function normalizeLoadedPriceAdjust',
    formSource.indexOf('async function applySourceSaleOut'),
  ),
);
const itemEnterHandler = itemFormSource.slice(
  itemFormSource.indexOf('function handleItemInputPressEnter'),
  itemFormSource.indexOf(
    'defineExpose({',
    itemFormSource.indexOf('function handleItemInputPressEnter'),
  ),
);
const newPriceChangeHandler = itemFormSource.slice(
  itemFormSource.indexOf('function handleNewPriceChange'),
  itemFormSource.indexOf(
    'function handleFieldChange',
    itemFormSource.indexOf('function handleNewPriceChange'),
  ),
);
const fieldChangeHandler = itemFormSource.slice(
  itemFormSource.indexOf('function handleFieldChange'),
  itemFormSource.indexOf(
    'function handleDelete',
    itemFormSource.indexOf('function handleFieldChange'),
  ),
);
const prependFooterTemplate = formSource.slice(
  formSource.indexOf('<template v-if="!reportViewOnly" #prepend-footer>'),
  formSource.indexOf('</Modal>'),
);
const centerFooterTemplate = formSource.slice(
  formSource.indexOf('<template v-if="!reportViewOnly" #center-footer>'),
  formSource.indexOf('<template v-if="!reportViewOnly" #prepend-footer>'),
);

describe('sale price adjust draft lifecycle', () => {
  it('skips auto-save for explicit cancel', () => {
    expect(closeHandler).toContain('async onCancel() {');
    expect(closeHandler).toContain('skipDraftOnClose = true;');
    expect(closeHandler).toContain('await modalApi.close();');
  });

  it('creates a draft on other create-page closes and updates the same draft', () => {
    expect(closeHandler).toContain(
      'return saveSalePriceAdjustDraft(isCreatingDraft);',
    );
    const createIndex = draftSaveHandler.indexOf(
      'await createSalePriceAdjustDraft(data);',
    );
    const updateIndex = draftSaveHandler.indexOf(
      'await updateSalePriceAdjustDraft(data);',
    );
    expect(createIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(createIndex);
    expect(draftSaveHandler).toContain('if (draftSaving) {');
    expect(draftSaveHandler).toContain('draftSaved = true;');
    expect(draftSaveHandler).toContain(
      '!hasValidSaleDraftItems(data.items ?? [], {',
    );
    expect(draftSaveHandler).toContain(
      "message.warning('未选择明细，不生成草稿');",
    );
    expect(formSource).toContain('itemFormInstance?.getDraftItems?.() ??');
    expect(itemFormSource).toContain('function buildDraftItems()');
    expect(itemFormSource).toContain('getDraftItems: buildDraftItems');
  });

  it('updates a draft before submitting and closes only after submission', () => {
    const updateIndex = confirmHandler.indexOf(
      'await updateSalePriceAdjustDraft(data);',
    );
    const submitIndex = confirmHandler.indexOf(
      'await submitSalePriceAdjust(formData.value.id!);',
    );
    const closeIndex = confirmHandler.indexOf('await modalApi.close();');
    expect(updateIndex).toBeGreaterThan(-1);
    expect(submitIndex).toBeGreaterThan(updateIndex);
    expect(closeIndex).toBeGreaterThan(submitIndex);
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:sale-price-adjust:update-status'])",
    );
    expect(formSource).toContain("isEditingDraft.value ? '确认提交' : '确定'");
  });

  it('supports direct persisted-draft submission from read-only detail', () => {
    expect(formSource).toContain('canSubmitDraftFromDetail');
    expect(formSource).toContain('handleSubmitDraftFromDetail');
    expect(formSource).toContain('await submitSalePriceAdjust(id);');
    expect(formSource).toContain('提交后将进入未审核状态');
  });

  it('allows explicit draft save on create and draft edit pages', () => {
    expect(formSource).toContain(
      "formType.value === 'create' || isEditingDraft.value",
    );
    expect(formSource).toContain('!detailEditLoading.value');
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

  it('opens sale-out item selection with the detail-layer Insert shortcut', () => {
    expect(itemFormSource).toContain('isCreateShortcutKey(event)');
    expect(itemFormSource).toContain("emit('request-add-items')");
    expect(itemFormSource).toContain('isShortcutDialogOpen()');
    expect(formSource).toContain('@request-add-items="handleAddItems"');
    expect(formSource).not.toContain('handleSalePriceAdjustCreateShortcut');
  });

  it('uses paged sale-out item selection for manual price adjust rows', () => {
    expect(apiSource).toContain('/erp/sale-price-adjust/adjustable-item-page');
    expect(saleOutItemSelectModalSource).toContain('getAdjustableItemPage({');
    expect(saleOutItemSelectModalSource).toContain('excludeAdjusted: true');
    expect(saleOutItemSelectModalSource).toContain(
      'productKeyword: productKeyword.value || undefined',
    );
    expect(saleOutItemSelectModalSource).toContain('pageSize: 20');
    expect(saleOutItemSelectModalSource).toContain('selectedMap');
    expect(saleOutItemSelectModalSource).not.toContain(
      'getAdjustableItemsByCustomerId(',
    );
  });

  it('supports detail-page edit with customer and item hydration fallback', () => {
    expect(formSource).toContain('const canEditFromDetail = computed(');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:sale-price-adjust:update'])",
    );
    expect(prependFooterTemplate).toContain('v-if="canEditFromDetail"');
    expect(prependFooterTemplate).toContain('@click="handleEditFromDetail"');
    expect(detailEditHandler).toContain('!canEditFromDetail.value');
    expect(formSource).toContain('withCurrentSaleFormSelectOptions(');
    expect(formSource).toContain('hydrateSaleCustomerFromFallback(');
    expect(formSource).toContain('let isHydratingFormValues = false;');
    expect(indexSource).toContain(
      "formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();",
    );
  });

  it('hydrates the source sale-out customer option instead of showing its raw id', () => {
    expect(formSource).toContain('withSaleCustomerFromSource(');
    expect(sourceSaleOutHandler).toContain(
      'await refreshPriceAdjustFormSchema(formData.value);',
    );
    expect(
      sourceSaleOutHandler.indexOf('withSaleCustomerFromSource('),
    ).toBeLessThan(sourceSaleOutHandler.indexOf('await formApi.setValues('));
  });

  it('keeps modal footer spacing delegated to Vben Modal', () => {
    expect(prependFooterTemplate).not.toContain('class="mr-2"');
    expect(centerFooterTemplate).not.toContain('class="mr-2"');
  });

  it('does not reload the item grid after ordinary cell edits unless sorted', () => {
    expect(newPriceChangeHandler).toContain('emitItemsUpdate(true);');
    expect(newPriceChangeHandler).toContain(
      'if (activeItemSort.value) {\n    void nextTick(refreshItemGrid);\n  }',
    );
    expect(fieldChangeHandler).toContain('emitItemsUpdate(true);');
    expect(fieldChangeHandler).toContain(
      'if (activeItemSort.value) {\n      void nextTick(refreshItemGrid);\n    }',
    );
  });

  it('shows draft status, row highlight, tooltip, and legend', () => {
    expect(indexSource).toContain("'sale-price-adjust-draft-row'");
    expect(indexSource).toContain('草稿：关闭页面或草稿编辑页时自动保存');
    expect(indexSource).toContain('浅蓝色行表示未正式提交的草稿');
  });

  it('focuses the first editable basic control and routes header Enter through confirm', () => {
    expect(formSource).toContain('focusFirstEditableFormControl');
    expect(formSource).toContain('focusNextEditableFormControlOnEnter');
    expect(formSource).toContain('queueAfterEditableControlRender');
    expect(formSource).toContain(
      'const basicFormRef = ref<HTMLElement | null>(null)',
    );
    expect(formSource).toContain('ref="basicFormRef"');
    expect(formSource).toContain('@keydown.capture="handleBasicFormEnter"');

    expect(basicFocusHandler).toContain('canConfirmForm.value');
    expect(basicFocusHandler).toContain('!detailLoading.value');
    expect(basicFocusHandler).toContain('!detailLoadError.value');
    expect(basicFocusHandler).toContain('!selectModalOpen.value');
    expect(basicFocusHandler).toContain('focusFirstEditableFormControl(scope)');
    expect(basicFocusHandler).toContain(
      'focusNextEditableFormControlOnEnter(event, scope, {',
    );
    expect(basicFocusHandler).toContain(
      'onLastControlEnter: handleLastInputEnterConfirm',
    );
    expect(basicFocusHandler).toContain('void modalApi.onConfirm();');
  });

  it('queues basic focus after create, edit, and detail-copy render completion', () => {
    expect(formSource).toContain('let formFocusSequence = 0;');
    expect(formSource).toContain('formFocusSequence += 1;');
    expect(formSource).toContain('formFocusSequence = sequence;');
    expect(formSource).toContain(
      'void queueFocusFirstBasicFormControl(sequence);',
    );
    expect(formSource).toContain('const sequence = ++formFocusSequence;');
    expect(detailEditHandler).toContain(
      'await switchDetailToEdit(formData.value);',
    );
  });

  it('submits from the last editable detail input and keeps middle Enter focus traversal', () => {
    expect(itemFormSource).toContain("'request-submit'");
    expect(itemEnterHandler).toContain('focusNextInputOnEnter(event)');
    expect(itemEnterHandler).toContain("enterFocusResult === 'last-input'");
    expect(itemEnterHandler).toContain("emit('request-submit', event)");
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

  it('focuses the newly added adjustment price input without returning to row one', () => {
    expect(itemFormSource).toContain('querySelectorAll<HTMLInputElement>');
    expect(itemFormSource).toContain(
      "'.sale-price-adjust-item-new-price-input input'",
    );
    expect(itemFormSource).toContain(
      'class="sale-price-adjust-item-new-price-input w-full"',
    );
    expect(itemFormSource).toContain('queueFocusNewlyAddedPriceInput');
    expect(itemFormSource).toContain(
      'queueAfterEditableControlRender(focusNewlyAddedPriceInput)',
    );
    expect(selectItemsHandler).toContain('if (newItems.length > 0) {');
    expect(selectItemsHandler).toContain(
      'getItemFormInstance()?.queueFocusNewlyAddedPriceInput?.();',
    );
  });
});
