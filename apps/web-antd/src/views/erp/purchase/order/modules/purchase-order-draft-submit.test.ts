import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const listSource = readFileSync(join(currentDir, '../index.vue'), 'utf8');
const keyboardSource = readFileSync(
  join(currentDir, '../../../utils/keyboard.ts'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/purchase/order/index.ts'),
  'utf8',
);

describe('采购订单草稿生命周期', () => {
  it('明确取消跳过草稿保存，其他关闭创建或更新草稿', () => {
    const closeGuard = formSource.slice(
      formSource.indexOf('async onBeforeClose() {'),
      formSource.indexOf('async onConfirm() {'),
    );
    const draftHandler = formSource.slice(
      formSource.indexOf('async function savePurchaseOrderDraft('),
      formSource.indexOf('async function handleGenerateDraft()'),
    );
    expect(closeGuard).toContain('return savePurchaseOrderDraft();');
    expect(draftHandler).toContain('await createPurchaseOrderDraft(data);');
    expect(draftHandler).toContain('await updatePurchaseOrderDraft(data);');
    expect(draftHandler).toContain(
      'hasValidPurchaseOrderDraftItems(data.items)',
    );
    expect(draftHandler).toContain("message.warning('未选择明细，不生成草稿')");
    expect(
      draftHandler.indexOf('hasValidPurchaseOrderDraftItems(data.items)'),
    ).toBeLessThan(
      draftHandler.indexOf('await createPurchaseOrderDraft(data);'),
    );
    expect(draftHandler).toContain('draftSaving');
    expect(draftHandler).toContain('return false;');
    expect(closeGuard).toContain('async onCancel() {');
    expect(closeGuard).toContain('skipDraftOnClose = true;');
  });

  it('新增页可以显式生成草稿，草稿编辑页可以显式保存草稿且不会在关闭时重复自动保存', () => {
    const generateHandler = formSource.slice(
      formSource.indexOf('async function handleGenerateDraft()'),
      formSource.indexOf('const [Modal, modalApi] = useVbenModal({'),
    );
    const centerFooterTemplate = formSource.slice(
      formSource.indexOf('<template v-if="!reportViewOnly" #center-footer>'),
      formSource.indexOf(
        '</template>',
        formSource.indexOf('<template v-if="!reportViewOnly" #center-footer>'),
      ),
    );
    const prependFooterTemplate = formSource.slice(
      formSource.indexOf('<template v-if="!reportViewOnly" #prepend-footer>'),
      formSource.indexOf(
        '</template>',
        formSource.indexOf('<template v-if="!reportViewOnly" #prepend-footer>'),
      ),
    );
    expect(formSource).toContain(
      "formType.value === 'create' || isEditingDraft.value",
    );
    expect(formSource).toContain(
      "isEditingDraft.value ? '保存草稿' : '生成草稿'",
    );
    expect(formSource).toContain(
      '<template v-if="!reportViewOnly" #center-footer>',
    );
    expect(formSource).toContain('v-if="canGenerateDraft"');
    expect(centerFooterTemplate).toContain('v-if="canGenerateDraft"');
    expect(centerFooterTemplate).toContain('{{ generateDraftButtonText }}');
    expect(prependFooterTemplate).not.toContain('生成草稿');
    expect(prependFooterTemplate).not.toContain('保存草稿');
    expect(generateHandler).toContain('await savePurchaseOrderDraft({');
    expect(generateHandler).toContain('closeOnSuccess: true');
    expect(generateHandler).toContain('stayOpenWhenEmpty: true');
    expect(generateHandler).toContain(
      "successMessage: isEditingDraft.value ? '草稿保存成功' : '草稿生成成功'",
    );
    expect(formSource).toContain('skipDraftOnClose = true;');
    expect(formSource).not.toContain('mr-2');
  });

  it('报表详情模式隐藏采购订单业务动作和批量编辑', () => {
    expect(formSource).toContain('const reportViewOnly = useReportViewOnly();');
    expect(formSource).toContain(
      '<template v-if="!reportViewOnly" #prepend-footer>',
    );
    expect(formSource).toContain('!reportViewOnly &&');
  });

  it('uses the shared confirm handler for button and keyboard submit', () => {
    const confirmHandler = formSource.slice(
      formSource.indexOf('async function handleConfirmPurchaseOrderForm()'),
      formSource.indexOf('function handleWindowEnterConfirm'),
    );
    expect(confirmHandler).toContain(
      'await createAndSubmitPurchaseOrder(data);',
    );
    expect(confirmHandler).toContain(
      'await updateAndSubmitPurchaseOrder(data);',
    );
    expect(confirmHandler.indexOf('skipDraftOnClose = true;')).toBeLessThan(
      confirmHandler.indexOf('await modalApi.close();'),
    );
    expect(confirmHandler).toContain(
      'if (!canConfirmForm.value || confirmingForm)',
    );
    expect(confirmHandler).toContain('confirmingForm = true;');
    expect(confirmHandler).toContain('confirmingForm = false;');
    expect(formSource).toContain(
      'async onConfirm() {\n    await handleConfirmPurchaseOrderForm();\n  },',
    );
    expect(formSource).toContain(
      '@request-submit="handleLastInputEnterConfirm"',
    );
  });

  it('submits from the last header control while preserving Enter focus traversal', () => {
    const lastInputHandler = formSource.slice(
      formSource.indexOf('function handleLastInputEnterConfirm'),
      formSource.indexOf('const [Form, formApi] = useVbenForm({'),
    );
    expect(formSource).toContain('focusFirstEditableFormControl');
    expect(formSource).toContain('focusNextEditableFormControlOnEnter');
    expect(formSource).toContain(
      '@keydown.capture="handlePurchaseOrderBasicFormEnter"',
    );
    expect(formSource).toContain('ref="purchaseOrderBasicFormRef"');
    expect(formSource).toContain(
      'onLastControlEnter: handleLastInputEnterConfirm',
    );
    expect(formSource).not.toContain('attachPurchaseInputEnterFocus');
    expect(keyboardSource).toContain(
      'export function focusNextEditableFormControlOnEnter',
    );
    expect(keyboardSource).toContain('options.onLastControlEnter?.(event)');
    expect(lastInputHandler).not.toContain('event.defaultPrevented');
    expect(lastInputHandler).toContain('event.shiftKey');
    expect(lastInputHandler).toContain('!canConfirmForm.value');
    expect(lastInputHandler).toContain('confirmingForm');
    expect(lastInputHandler).toContain('event.preventDefault();');
    expect(lastInputHandler).toContain(
      'void handleConfirmPurchaseOrderForm();',
    );
  });

  it('queues first editable control focus after editable purchase order forms open', () => {
    const focusHandler = formSource.slice(
      formSource.indexOf('function canFocusPurchaseOrderBasicForm'),
      formSource.indexOf('const [Form, formApi] = useVbenForm({'),
    );

    expect(focusHandler).toContain('isPurchaseOrderFormOpen.value');
    expect(focusHandler).toContain('!isDetailMode.value');
    expect(focusHandler).toContain('!detailLoading.value');
    expect(focusHandler).toContain('!detailLoadError.value');
    expect(focusHandler).toContain('focusFirstEditableFormControl(scope)');
    expect(focusHandler).toContain('window.requestAnimationFrame');
    expect(focusHandler).toContain('sequence !== detailLoadSequence');
    expect(formSource).toContain(
      'await queueFocusFirstPurchaseOrderFormControl(sequence);',
    );
    expect(formSource).toContain('async function buildPermissionSchema');
    expect(formSource).toContain(
      "await applyFieldConfig(baseSchema, 'purchase_order')",
    );
    expect(formSource).toContain('return preparePurchaseDocumentFormSchema(');
    expect(formSource).toContain(
      'schema: await buildPermissionSchema(formType.value, data.initialData)',
    );
    expect(formSource).toContain(
      'schema: await buildPermissionSchema(formType.value, formData.value)',
    );
    expect(formSource).toContain(
      "schema: await buildPermissionSchema('edit', formData.value)",
    );
  });

  it('supports Enter confirmation from non-editable modal targets only', () => {
    const enterHandler = formSource.slice(
      formSource.indexOf('function handleWindowEnterConfirm'),
      formSource.indexOf('const [Modal, modalApi] = useVbenModal({'),
    );
    expect(formSource).toContain('shouldConfirmOnEnter,');
    expect(formSource).toContain(
      "window.addEventListener('keydown', handleWindowEnterConfirm, true)",
    );
    expect(formSource).toContain(
      "window.removeEventListener('keydown', handleWindowEnterConfirm, true)",
    );
    expect(enterHandler).toContain(
      'shouldConfirmOnEnter(event, isPurchaseOrderFormOpen.value)',
    );
    expect(enterHandler).toContain('event.shiftKey');
    expect(enterHandler).toContain('!isPurchaseOrderFormTarget(event.target)');
    expect(enterHandler).toContain('!canConfirmForm.value');
    expect(enterHandler).toContain('confirmingForm');
    expect(enterHandler).toContain('event.preventDefault();');
    expect(enterHandler).toContain('void handleConfirmPurchaseOrderForm();');
    expect(enterHandler).toContain(
      "!!target.closest('.purchase-document-modal')",
    );
    expect(formSource).toContain('isPurchaseOrderFormOpen.value = isOpen;');
    expect(formSource).toContain('confirmingForm = false;');
  });
  it('草稿详情提交受状态和权限控制，并有二次确认', () => {
    expect(formSource).toContain(
      'formData.value?.status === PURCHASE_ORDER_STATUS.DRAFT',
    );
    expect(formSource).toContain('!detailLoading.value');
    expect(formSource).toContain('!detailLoadError.value');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:purchase-order:update-status'])",
    );
    expect(formSource).toContain("title: '确认提交采购订单？'");
    expect(formSource).toContain(
      'await submitPurchaseOrder(formData.value!.id!)',
    );
  });

  it('详情页可编辑单据在当前弹窗内切换到编辑', () => {
    const editHandler = formSource.slice(
      formSource.indexOf('async function handleEditFromDetail()'),
      formSource.indexOf('async function switchDetailToEdit'),
    );
    expect(formSource).toContain('const canEditFromDetail = computed(');
    expect(formSource).toContain(
      'formData.value?.status !== PURCHASE_ORDER_STATUS.APPROVE',
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:purchase-order:update'])",
    );
    expect(editHandler).toContain(
      'await switchDetailToEdit({ ...formData.value });',
    );
    expect(editHandler).not.toContain('modalApi.close');
    expect(editHandler).not.toContain("emit('edit'");
    expect(formSource).toContain('async function switchDetailToEdit(');
    expect(formSource).toContain('await getPurchaseOrder(initialData.id, {');
    expect(formSource).toContain('includeItems: false');
    expect(formSource).toContain('mask: false');
    expect(formSource).toContain(
      'await loadPurchaseOrderItemPage({ pageNo: 1 });',
    );
    expect(formSource).toContain('v-if="canEditFromDetail"');
    expect(listSource).toContain('<FormModal');
    expect(listSource).toContain('@edit="handleEdit"');
    expect(listSource).toContain('@print="handlePrint"');
    expect(listSource).toContain('@success="handleRefresh"');
  });

  it('详情页进入编辑时保留供应商回填数据', () => {
    expect(listSource).toContain(
      "formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open()",
    );
    expect(formSource).toContain(
      'initialData?: ErpPurchaseOrderApi.PurchaseOrder',
    );
    expect(formSource).toContain('hydratePurchaseSupplierFromFallback(');
    expect(formSource).toContain('data.initialData');
    expect(formSource).toContain('let isHydratingFormValues = false');
    expect(formSource).toContain('if (isHydratingFormValues) return;');
  });

  it('复制采购订单时使用复制草稿重建当前值选项', () => {
    const copyHandler = formSource.slice(
      formSource.indexOf('async function handleCopy()'),
      formSource.indexOf('/** 导入弹窗 */'),
    );

    expect(formSource).toContain(
      'schema: await buildPermissionSchema(formType.value, draft)',
    );
    expect(copyHandler).toContain('await applyCreateDefaults({');
    expect(copyHandler).toContain('deptId: draft.deptId');
    expect(copyHandler).toContain('purchaser: draft.purchaser');
    expect(copyHandler).toContain('clearInvalidDept: false');
    expect(copyHandler).toContain(
      'schema: await buildPermissionSchema(formType.value, formData.value)',
    );
  });

  it('列表通过文本、提示、整行高亮和图例标识草稿', () => {
    expect(listSource).toContain("'purchase-order-draft-row'");
    expect(listSource).toContain('purchase-order-draft-status');
    expect(listSource).toContain('尚未正式提交');
    expect(listSource).toContain('浅蓝色行表示未正式提交的草稿');
  });

  it('前端 API 使用独立草稿和正式提交路由', () => {
    expect(apiSource).toContain('/erp/purchase-order/create-draft');
    expect(apiSource).toContain('/erp/purchase-order/update-draft');
    expect(apiSource).toContain('/erp/purchase-order/create-and-submit');
    expect(apiSource).toContain('/erp/purchase-order/update-and-submit');
    expect(apiSource).toContain('/erp/purchase-order/submit');
  });
});
