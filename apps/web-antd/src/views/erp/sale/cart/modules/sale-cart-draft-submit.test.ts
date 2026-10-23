import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');
const indexSource = readFileSync(join(currentDir, '..', 'index.vue'), 'utf8');
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
  formSource.indexOf('async function saveSaleCartDraft('),
  formSource.indexOf(
    'async function handleGenerateDraft()',
    formSource.indexOf('async function saveSaleCartDraft('),
  ),
);
const generateDraftHandler = formSource.slice(
  formSource.indexOf('async function handleGenerateDraft()'),
  formSource.indexOf(
    'function handleSubmitDraftFromDetail()',
    formSource.indexOf('async function handleGenerateDraft()'),
  ),
);
const detailSubmitHandler = formSource.slice(
  formSource.indexOf('function handleSubmitDraftFromDetail()'),
  formSource.indexOf(
    'async function handleEditFromDetail()',
    formSource.indexOf('function handleSubmitDraftFromDetail()'),
  ),
);
const billingConfirmHandler = formSource.slice(
  formSource.indexOf('async function handleBillingConfirm()'),
  formSource.indexOf(
    'async function handleCancelFirstApprove()',
    formSource.indexOf('async function handleBillingConfirm()'),
  ),
);
const detailEditHandler = formSource.slice(
  formSource.indexOf('async function handleEditFromDetail()'),
  formSource.indexOf(
    'const [Modal, modalApi] = useVbenModal',
    formSource.indexOf('async function handleEditFromDetail()'),
  ),
);
const prependFooterTemplate = formSource.slice(
  formSource.indexOf('<template #prepend-footer>'),
  formSource.indexOf(
    '</template>',
    formSource.indexOf('<template #prepend-footer>'),
  ),
);
const centerFooterTemplate = formSource.slice(
  formSource.indexOf('<template #center-footer>'),
  formSource.indexOf(
    '</template>',
    formSource.indexOf('<template #center-footer>'),
  ),
);

describe('sale cart draft confirmation', () => {
  it('updates an edited draft before formally submitting it', () => {
    const updateIndex = confirmHandler.indexOf('await updateSaleCart(data);');
    const submitIndex = confirmHandler.indexOf(
      'await submitSaleCart(editingCartId!);',
    );
    const closeIndex = confirmHandler.indexOf('await modalApi.close();');

    expect(formSource).toContain('submitSaleCart,');
    expect(confirmHandler).toContain(
      'const shouldSubmitDraft = isEditingDraft.value;',
    );
    expect(confirmHandler).toContain(
      'const editingCartId = formData.value?.id;',
    );
    expect(confirmHandler).toContain('if (!isCreate && !editingCartId) {');
    expect(updateIndex).toBeGreaterThan(-1);
    expect(submitIndex).toBeGreaterThan(updateIndex);
    expect(closeIndex).toBeGreaterThan(submitIndex);
  });

  it('does not submit an existing record unless its original status is draft', () => {
    expect(formSource).toContain(
      "() => formType.value === 'edit' && formData.value?.status === 10",
    );
    expect(confirmHandler).toContain('if (shouldSubmitDraft) {');
    expect(confirmHandler).toContain(
      "message.success($t('ui.actionMessage.operationSuccess'));",
    );
  });

  it('requires submit permission and labels the draft action explicitly', () => {
    expect(formSource).toContain("hasAccessByCodes(['erp:sale-cart:submit'])");
    expect(formSource).toContain("isEditingDraft.value ? '确认提交' : '确定'");
    expect(formSource).toContain(':show-confirm-button="canConfirmForm"');
    expect(formSource).toContain(':confirm-text="confirmText"');
  });

  it('allows explicitly saving drafts from the center footer', () => {
    expect(formSource).toContain(
      "() => formType.value === 'create' || isEditingDraft.value",
    );
    expect(formSource).toContain(
      "isEditingDraft.value ? '保存草稿' : '生成草稿'",
    );
    expect(centerFooterTemplate).toContain('v-if="canGenerateDraft"');
    expect(centerFooterTemplate).toContain('{{ generateDraftButtonText }}');
    expect(centerFooterTemplate).toContain('@click="handleGenerateDraft"');
    expect(prependFooterTemplate).not.toContain('handleGenerateDraft');
    expect(formSource).toContain(':loading="draftGenerateLoading"');
    expect(formSource).toContain('生成草稿');
    expect(formSource).toContain('保存草稿');
    expect(formSource).toContain('@click="handleGenerateDraft"');
    expect(generateDraftHandler).toContain('!canGenerateDraft.value');
    expect(generateDraftHandler).toContain('closeWhenEmpty: false');
    expect(generateDraftHandler).toContain('草稿生成成功');
    expect(generateDraftHandler).toContain('草稿保存成功');
    expect(generateDraftHandler).toContain('skipDraftOnClose = true;');
    expect(generateDraftHandler).toContain('await modalApi.close();');
  });

  it('submits a draft directly from the detail footer', () => {
    expect(formSource).toContain('const canSubmitDraftFromDetail = computed(');
    expect(formSource).toContain("formType.value === 'detail'");
    expect(formSource).toContain('formData.value?.status === 10');
    expect(formSource).toContain("hasAccessByCodes(['erp:sale-cart:submit'])");
    expect(formSource).toContain('v-if="canSubmitDraftFromDetail"');
    expect(formSource).toContain('@click="handleSubmitDraftFromDetail"');
    expect(detailSubmitHandler).toContain('const cartId = formData.value.id;');
    expect(detailSubmitHandler).toContain(
      "content: '提交后将进入待开单确认状态，确认前仍可编辑。'",
    );
    expect(detailSubmitHandler).toContain('await submitSaleCart(cartId);');
    expect(detailSubmitHandler).toContain(
      'message.success(buildSaleCartSubmitSuccessMessage(result), 6);',
    );
    expect(detailSubmitHandler).toContain('await modalApi.close();');
    expect(detailSubmitHandler).toContain("emit('success');");
  });

  it('allows editing eligible records from the detail footer', () => {
    expect(formSource).toContain(
      "const emit = defineEmits(['success', 'edit', 'editBasic']);",
    );
    expect(formSource).toContain('const canEditFromDetail = computed(');
    expect(formSource).toContain('cart?.status === 15');
    expect(formSource).toContain(
      '(cart?.status === 20 && !cart.billingConfirmTime)',
    );
    expect(formSource).toContain("hasAccessByCodes(['erp:sale-cart:update'])");
    expect(formSource).toContain('v-if="canEditFromDetail"');
    expect(formSource).toContain('@click="handleEditFromDetail"');
    expect(detailEditHandler).toContain('!canEditFromDetail.value');
    expect(detailEditHandler).toContain(
      'await switchDetailToEdit({ ...formData.value });',
    );
    expect(formSource).toContain('async function switchDetailToEdit(');
    expect(formSource).toContain('hydrateSaleCustomerFromFallback(');
    expect(formSource).toContain('const isHydratingFormValues = ref(false)');
    expect(formSource).toContain('if (isHydratingFormValues.value) return;');
    expect(detailEditHandler).not.toContain("emit('edit', data);");
    expect(indexSource).toContain('@edit="handleEdit"');
    expect(indexSource).toContain(
      "formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();",
    );
  });

  it('exposes billing confirmation only for status 15 with its own permission', () => {
    expect(formSource).toContain(
      'const showBillingConfirmBtn = computed(() => {',
    );
    expect(formSource).toContain('formData.value?.status === 15');
    expect(formSource).toContain("hasAccessByCodes(['erp:sale-cart:confirm'])");
    expect(formSource).toContain('v-if="showBillingConfirmBtn"');
    expect(formSource).toContain('@click="handleBillingConfirm"');
    expect(billingConfirmHandler).toContain(
      'await confirmSaleCart(formData.value.id)',
    );
    expect(billingConfirmHandler).toContain(
      'buildSaleCartConfirmSuccessMessage(result)',
    );
    expect(indexSource).toContain("auth: ['erp:sale-cart:confirm']");
    expect(indexSource).toContain('ifShow: () => row.status === 15');
  });

  it('shows and clears billing confirmation audit fields appropriately', () => {
    expect(formSource).toContain('billingConfirmUserName');
    expect(formSource).toContain('billingConfirmTime');
    expect(formSource).toContain('开单确认人');
    expect(formSource).toContain('开单确认时间');
    expect(formSource).toContain("'billingConfirmUserId'");
    expect(formSource).toContain("'billingConfirmUserName'");
    expect(formSource).toContain("'billingConfirmTime'");
  });

  it('keeps footer action spacing controlled by the modal footer gap', () => {
    expect(centerFooterTemplate).toContain('generateDraftButtonText');
    expect(prependFooterTemplate).not.toContain('生成草稿');
    expect(prependFooterTemplate).toContain('提交');
    expect(prependFooterTemplate).toContain('编辑');
    expect(prependFooterTemplate).not.toContain('class="mr-2"');
    expect(centerFooterTemplate).not.toContain('class="mr-2"');
  });

  it('does not create or update a draft when the user explicitly cancels', () => {
    expect(beforeCloseHandler).toContain('async onCancel() {');
    expect(beforeCloseHandler).toContain('skipDraftOnClose = true;');
    expect(beforeCloseHandler).toContain('await modalApi.close();');
  });

  it('saves an existing draft when it is closed without submitting', () => {
    const createIndex = draftSaveHandler.indexOf('await createSaleCart(data);');
    const updateIndex = draftSaveHandler.indexOf(
      'await updateSaleCartDraft(data);',
    );

    expect(formSource).toContain('updateSaleCartDraft,');
    expect(beforeCloseHandler).toContain('return saveSaleCartDraft();');
    expect(draftSaveHandler).toContain(
      'const isUpdatingDraft = isEditingDraft.value && Boolean(formData.value?.id);',
    );
    expect(draftSaveHandler).toContain('if (isCreatingDraft) {');
    expect(createIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(createIndex);
    expect(draftSaveHandler).toContain('草稿修改已自动保存');
  });

  it('does not create a new draft without valid detail rows', () => {
    const guardIndex = draftSaveHandler.indexOf(
      "!hasValidSaleDraftItems(data.items ?? [], { priceMode: 'none' })",
    );
    const createIndex = draftSaveHandler.indexOf('await createSaleCart(data);');

    expect(formSource).toContain('hasValidSaleDraftItems');
    expect(draftSaveHandler).toContain(
      "message.warning('未选择明细，不生成草稿');",
    );
    expect(draftSaveHandler).toContain('draftSaved = closeWhenEmpty;');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(createIndex).toBeGreaterThan(guardIndex);
  });

  it('uses current item-form values when saving drafts', () => {
    expect(formSource).toContain(
      'const itemFormInstance = getItemFormInstance();',
    );
    expect(formSource).toContain(
      'items: itemFormInstance?.getDraftItems?.() ?? formData.value?.items ?? [],',
    );
    expect(itemFormSource).toContain('function buildDraftItems()');
    expect(itemFormSource).toContain('getDraftItems: buildDraftItems');
    expect(itemFormSource).toContain(
      'toDraftNumber(item.productPriceText ?? item.productPrice)',
    );
  });

  it('does not treat an empty remote change set as an empty sale cart', () => {
    expect(formSource).toContain('function hasSaleCartItemsForSubmit(');
    expect(formSource).toContain('return itemPageState.value.total > 0;');
    expect(confirmHandler).toContain(
      'if (!hasSaleCartItemsForSubmit(data.items ?? []))',
    );
    expect(confirmHandler).toContain(
      '{ requireItems: !isRemoteItemPaging.value }',
    );
    expect(itemFormSource).toContain(
      'options: { requireItems?: boolean } = {}',
    );
    expect(itemFormSource).toContain(
      'if ((options.requireItems ?? true) && items.length === 0)',
    );
  });
});
