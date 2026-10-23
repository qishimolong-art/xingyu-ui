import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormSchema, useGridColumns } from './data';
import {
  normalizePayableMiscDateTimeForPicker,
  normalizePayableMiscFormValues,
} from './ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
function getSlotTemplate(slotName: string) {
  const slotIndex = formSource.indexOf(`#${slotName}`);
  const startIndex = formSource.lastIndexOf('<template', slotIndex);
  return formSource.slice(
    startIndex,
    formSource.indexOf('</template>', startIndex),
  );
}

const centerFooterTemplate = getSlotTemplate('center-footer');
const prependFooterTemplate = getSlotTemplate('prepend-footer');
const onOpenChangeSource = formSource.slice(
  formSource.indexOf('async onOpenChange(isOpen: boolean)'),
  formSource.indexOf('</script>'),
);

function getComponentProps(
  schema: ReturnType<typeof useFormSchema>,
  fieldName: string,
) {
  return schema.find((item) => item.fieldName === fieldName)?.componentProps as
    | Record<string, any>
    | undefined;
}

describe('payable misc page design contract', () => {
  it('normalizes detail timestamps for the date picker', () => {
    const timestamp = new Date(2026, 8, 22, 22, 14, 11).getTime();
    expect(
      normalizePayableMiscDateTimeForPicker([2026, 9, 22, 22, 14, 11]),
    ).toBe('2026-09-22 22:14:11');
    expect(normalizePayableMiscDateTimeForPicker('2026-09-22T22:14:11')).toBe(
      '2026-09-22 22:14:11',
    );
    expect(normalizePayableMiscDateTimeForPicker(String(timestamp))).toBe(
      normalizePayableMiscDateTimeForPicker(timestamp),
    );
    expect(
      normalizePayableMiscFormValues({
        bizTime: [2026, 9, 22, 22, 14, 11] as unknown as string,
      }).bizTime,
    ).toBe('2026-09-22 22:14:11');
    expect(
      normalizePayableMiscDateTimeForPicker([2026, 13, 22, 22, 14, 11]),
    ).toBeUndefined();
    expect(normalizePayableMiscDateTimeForPicker(undefined)).toBeUndefined();
  });

  it('keeps the document form scoped to the approved misc fields', () => {
    const schema = useFormSchema('create');
    expect(schema.map((item) => item.fieldName)).toEqual([
      'id',
      'no',
      'bizTime',
      'supplierId',
      'accountId',
      'deptId',
      'amount',
      'remark',
      'fileUrl',
    ]);
    expect(getComponentProps(schema, 'bizTime')?.disabled).toBe(true);
    expect(schema.find((item) => item.fieldName === 'supplierId')?.rules).toBe(
      'required',
    );
    expect(
      schema.find((item) => item.fieldName === 'supplierId')?.component,
    ).toBe('SupplierLazySelect');
    expect(getComponentProps(schema, 'supplierId')?.api).toBeUndefined();
    expect(getComponentProps(schema, 'supplierId')?.pageSize).toBe(10);
    expect(schema.find((item) => item.fieldName === 'accountId')?.rules).toBe(
      'required',
    );
    expect(schema.find((item) => item.fieldName === 'deptId')?.rules).toBe(
      'required',
    );
    expect(getComponentProps(schema, 'accountId')?.pageSize).toBe(10);
    expect(getComponentProps(schema, 'deptId')?.pageSize).toBe(10);
  });

  it('allows negative non-zero amounts and keeps attachment upload available', () => {
    const schema = useFormSchema('create');
    const amountRule = schema.find((item) => item.fieldName === 'amount')
      ?.rules as any;
    expect(amountRule.safeParse(0).success).toBe(false);
    expect(amountRule.safeParse(-0.01).success).toBe(true);
    expect(amountRule.safeParse(0.01).success).toBe(true);
    expect(schema.find((item) => item.fieldName === 'fileUrl')?.component).toBe(
      'FileUpload',
    );
  });

  it('uses new misc permissions and avoids old adjustment permissions', () => {
    expect(indexSource).toContain("auth: ['erp:payable-misc:create']");
    expect(indexSource).toContain("auth: ['erp:payable-misc:import']");
    expect(indexSource).toContain("auth: ['erp:payable-misc:export']");
    expect(indexSource).toContain("auth: ['erp:payable-misc:print-template']");
    expect(indexSource).toContain("auth: ['erp:payable-misc:update']");
    expect(indexSource).toContain("auth: ['erp:payable-misc:update-status']");
    expect(indexSource).not.toContain('erp:payable-other');
  });

  it('shows quote-order style toolbar actions and compact list typography', () => {
    expect(indexSource).toContain("label: '导入'");
    expect(indexSource).toContain("label: '导出'");
    expect(indexSource).toContain("label: '打印模板'");
    expect(indexSource).toContain("label: '批量删除'");
    expect(indexSource).toContain('ImportFormModal');
    expect(indexSource).toContain('PrintTemplateDesignModal');
    expect(indexSource).toContain('PrintTemplateSelector');
    expect(indexSource).toContain('checkboxAll');
    expect(indexSource).toContain('checkboxChange');
    expect(indexSource).toContain('class="payable-misc-grid"');
    expect(indexSource).toContain(
      ':deep(.payable-misc-grid .vxe-table--render-default)',
    );
    expect(indexSource).toContain('font-size: 12px;');
    expect(indexSource).toContain('height: 28px;');
  });

  it('shows the expected list columns', () => {
    expect(useGridColumns()?.map((item) => item.field || item.title)).toEqual([
      undefined,
      'no',
      'bizTime',
      'supplierName',
      'accountName',
      'deptName',
      'handlerName',
      'amount',
      'settledAmount',
      'balanceAmount',
      'status',
      'remark',
      'fileUrl',
      'creatorName',
      'createTime',
      'auditorName',
      'auditTime',
      '操作',
    ]);
    expect(
      useGridColumns()?.find((item) => item.field === 'amount')?.title,
    ).toBe('原金额');
    expect(
      useGridColumns()?.find((item) => item.field === 'settledAmount')?.title,
    ).toBe('已付金额');
    expect(
      useGridColumns()?.find((item) => item.field === 'balanceAmount')?.title,
    ).toBe('剩余金额');
    expect(useGridColumns()?.at(-1)?.width).toBe(126);
    expect(indexSource).not.toContain('其他应付按独立往来闭环改造');
    expect(indexSource).not.toContain('当前对象范围先按供应商接入');
    expect(indexSource).not.toContain('转付款仅为付款单创建入口');
    expect(indexSource).not.toContain('不能据此形成正式未结余额');
    expect(indexSource).not.toContain('<Alert');
  });

  it('opens detail only from the number link', () => {
    expect(indexSource).not.toContain("label: '明细'");
    expect(indexSource).not.toMatch(/cellClick:\s*\(/);
    expect(indexSource).toContain('@click.stop="handleDetail(row)"');
  });

  it('uses the sale-cart style full-width document modal layout', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true });');
    expect(formSource).toContain('class="!w-full payable-misc-document-modal"');
    expect(formSource).toContain('bordered');
    expect(formSource).toContain('content-class="p-0"');
    expect(formSource).toContain('class="misc-document-status"');
    expect(formSource).toContain('class="misc-document-view"');
    expect(formSource).toContain(
      "wrapperClass: 'payable-misc-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain('class="misc-document-section__header"');
    expect(formSource).toContain('class="misc-document-section__title"');
    expect(formSource).toContain('class="misc-document-settlement"');
    expect(formSource).toContain('class="misc-document-summary"');
    expect(formSource).not.toContain('class="misc-document-title"');
  });

  it('does not lock the whole modal or fill hidden form controls while opening detail', () => {
    expect(formSource).toContain('const DETAIL_REQUEST_TIMEOUT = 15_000;');
    expect(formSource).toContain('function withDetailRequestTimeout<T>');
    expect(onOpenChangeSource).not.toContain('modalApi.lock();');
    expect(onOpenChangeSource).toContain(
      "const isDetailMode = nextFormType === 'detail';",
    );
    expect(onOpenChangeSource).toContain('if (!isDetailMode) {');
    expect(onOpenChangeSource).toContain(
      'const detail = await withDetailRequestTimeout(',
    );
    expect(onOpenChangeSource).toContain('getPayableMisc(modalData.id),');
    expect(formSource).toContain('其他应付详情加载失败，请关闭后重试');
  });

  it('keeps the form mounted while detail values are loading', () => {
    expect(formSource).toContain('v-show="!detailLoading && !detailLoadError"');
    expect(formSource).not.toContain(
      '<section v-else ref="basicFormRef" class="misc-document-section">',
    );
    expect(onOpenChangeSource).toContain('await formApi.setValues(');
    expect(onOpenChangeSource).toContain(
      'normalizePayableMiscFormValues(detail || {})',
    );
    expect(formSource).toContain(
      'v-if="isDetail && !detailLoading && !detailLoadError"',
    );
  });

  it('visually separates readonly and editable fields in edit mode', () => {
    expect(formSource).toContain(
      '.misc-document-edit-form--editable :deep(.ant-input:not(:disabled))',
    );
    expect(formSource).toContain(
      '.misc-document-edit-form--editable :deep(.ant-input:disabled)',
    );
    expect(formSource).toContain(
      '.misc-document-edit-form--editable :deep(.ant-picker-disabled)',
    );
    expect(formSource).toContain(
      'background: hsl(var(--background)) !important;',
    );
    expect(formSource).toContain(
      'background: hsl(var(--muted-foreground) / 14%) !important;',
    );
    expect(formSource).toContain('cursor: not-allowed;');
  });

  it('keeps detail text fields and settlement typography compact', () => {
    expect(formSource).toContain(
      '.finance-document-form-readonly-text.ant-input-affix-wrapper',
    );
    expect(formSource).toContain('> input.ant-input');
    expect(formSource).toContain('height: 22px;');
    expect(formSource).toContain('min-height: 0;');
    expect(formSource).toContain(
      '.misc-document-settlement :deep(.ant-table-cell)',
    );
    expect(formSource).toContain(
      '.misc-document-settlement :deep(.ant-pagination-item)',
    );
  });

  it('renders detail mode through the disabled document form with summary and audit information', () => {
    expect(formSource).toContain('buildFinanceDocumentDetailFormValues');
    expect(formSource).toContain('<Form');
    expect(formSource).toContain('class="misc-document-edit-form"');
    expect(formSource).toContain(
      ':class="{ \'misc-document-edit-form--editable\': !isDetail }"',
    );
    expect(formSource).toContain(
      '@keydown.enter.capture="handleBasicFormEnter"',
    );
    expect(formSource).toContain('基础信息');
    expect(formSource).toContain('单据合计');
    expect(formSource).toContain('来源信息');
    expect(formSource).toContain('审计信息');
    expect(formSource).toContain(
      '<ErpAuditInfo title="" :record="formData" />',
    );
    expect(formSource).toContain("label: '原金额'");
    expect(formSource).toContain("label: '已付金额'");
    expect(formSource).toContain("label: '剩余金额'");
    expect(formSource).toContain("label: '来源类型'");
    expect(formSource).toContain("label: '来源单号'");
    expect(formSource).toContain("label: '冲减原单号'");
    expect(formSource).toContain("label: '系统冲减单'");
    expect(formSource).toContain('formatDetailAmount(formData.value.amount)');
    expect(formSource).not.toContain('misc-document-detail-grid');
    expect(formSource).not.toContain('misc-document-detail-field');
    expect(
      useFormSchema('detail').find((item) => item.fieldName === 'fileUrl'),
    ).toBeDefined();
  });

  it('submits account and department while defaulting department from current user', () => {
    expect(formSource).toContain('const userStore = useUserStore();');
    expect(formSource).toContain('function createDefaultFormData');
    expect(formSource).toContain('deptId: userStore.userInfo?.deptId');
    expect(formSource).toContain('accountId: values.accountId');
    expect(formSource).toContain('deptId: values.deptId');
    expect(onOpenChangeSource).toContain(
      'const defaults = createDefaultFormData();',
    );
    expect(onOpenChangeSource).toContain(
      'await formApi.setValues(defaults, false);',
    );
  });

  it('keeps footer actions aligned with the sale-cart spacing contract', () => {
    expect(formSource).toContain('const canGenerateDraft = computed');
    expect(formSource).toContain(
      "(formType.value === 'create' || isEditingDraft.value)",
    );
    expect(formSource).toContain(
      "isEditingDraft.value ? '保存草稿' : '生成草稿'",
    );
    expect(formSource).toContain('草稿生成成功');
    expect(formSource).toContain('草稿保存成功');
    expect(centerFooterTemplate).toContain('v-if="canGenerateDraft"');
    expect(centerFooterTemplate).toContain('handleSaveDraft');
    expect(centerFooterTemplate).toContain('generateDraftButtonText');
    expect(prependFooterTemplate).not.toContain('handleSaveDraft');
    expect(prependFooterTemplate).not.toContain('canGenerateDraft');
    expect(prependFooterTemplate).toContain('提交');
    expect(prependFooterTemplate).toContain('ghost');
    expect(prependFooterTemplate).toContain('编辑');
    expect(prependFooterTemplate).toContain('转付款');
    expect(prependFooterTemplate).toContain('审核');
    expect(prependFooterTemplate).not.toContain('class="mr-2"');
    expect(formSource).toContain('<template #cancelText>');
    expect(formSource).toContain("{{ isDetail ? '关闭' : '取消' }}");
  });

  it('opens payment form from approved misc detail only', () => {
    expect(formSource).toContain('const canTransferToPayable = computed');
    expect(formSource).toContain('isDetail.value &&');
    expect(formSource).toContain('!detailLoading.value &&');
    expect(formSource).toContain('!detailLoadError.value &&');
    expect(formSource).toContain('Boolean(formData.value.id) &&');
    expect(formSource).toContain('Number(formData.value.status) === 20');
    expect(formSource).toContain('!formData.value.generatedOffset');
    expect(formSource).toContain('getTransferAvailableAmount() !== 0');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:finance-payment:create'])",
    );
    expect(formSource).toContain(
      'const canShowSettledTransferState = computed',
    );
    expect(formSource).toContain('function handleTransferToPayable()');
    expect(formSource).toContain('if (!canTransferToPayable.value) return;');
    expect(formSource).toContain("type: 'create'");
    expect(formSource).toContain('settlement/payment/modules/form.vue');
    expect(formSource).toContain('amount: getTransferAvailableAmount(),');
    expect(formSource).toContain('已结清');
    expect(formSource).toContain('v-if="canTransferToPayable"');
    expect(formSource).toContain(
      '<PaymentModal v-if="shouldRenderPayment" @success="refreshSettlement" />',
    );
  });
});
