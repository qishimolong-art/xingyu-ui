import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormSchema, useGridColumns } from './data';
import {
  normalizeReceivableMiscDateTimeForPicker,
  normalizeReceivableMiscFormValues,
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

describe('receivable misc page design contract', () => {
  it('normalizes detail timestamps for the date picker', () => {
    const timestamp = new Date(2026, 8, 18, 11, 33, 5).getTime();
    expect(
      normalizeReceivableMiscDateTimeForPicker([2026, 9, 18, 11, 33, 5]),
    ).toBe('2026-09-18 11:33:05');
    expect(
      normalizeReceivableMiscDateTimeForPicker('2026-09-18T11:33:05'),
    ).toBe('2026-09-18 11:33:05');
    expect(normalizeReceivableMiscDateTimeForPicker(String(timestamp))).toBe(
      normalizeReceivableMiscDateTimeForPicker(timestamp),
    );
    expect(
      normalizeReceivableMiscFormValues({
        bizTime: [2026, 9, 18, 11, 33, 5] as unknown as string,
      }).bizTime,
    ).toBe('2026-09-18 11:33:05');
    expect(
      normalizeReceivableMiscDateTimeForPicker([2026, 13, 18, 11, 33, 5]),
    ).toBeUndefined();
    expect(normalizeReceivableMiscDateTimeForPicker(undefined)).toBeUndefined();
  });

  it('keeps the document form scoped to the approved misc fields', () => {
    const schema = useFormSchema('create');
    expect(schema.map((item) => item.fieldName)).toEqual([
      'id',
      'no',
      'bizTime',
      'customerId',
      'accountId',
      'deptId',
      'amount',
      'remark',
      'fileUrl',
    ]);
    expect(getComponentProps(schema, 'bizTime')?.disabled).toBe(true);
    expect(schema.find((item) => item.fieldName === 'customerId')?.rules).toBe(
      'required',
    );
    expect(
      schema.find((item) => item.fieldName === 'customerId')?.component,
    ).toBe('CustomerLazySelect');
    expect(getComponentProps(schema, 'customerId')?.api).toBeUndefined();
    expect(getComponentProps(schema, 'customerId')?.pageSize).toBe(10);
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
    expect(indexSource).toContain("auth: ['erp:receivable-misc:create']");
    expect(indexSource).toContain("auth: ['erp:receivable-misc:import']");
    expect(indexSource).toContain("auth: ['erp:receivable-misc:export']");
    expect(indexSource).toContain(
      "auth: ['erp:receivable-misc:print-template']",
    );
    expect(indexSource).toContain("auth: ['erp:receivable-misc:update']");
    expect(indexSource).toContain(
      "auth: ['erp:receivable-misc:update-status']",
    );
    expect(indexSource).not.toContain("auth: ['erp:receivable-other");
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
    expect(indexSource).toContain('class="receivable-misc-grid"');
    expect(indexSource).toContain(
      ':deep(.receivable-misc-grid .vxe-table--render-default)',
    );
    expect(indexSource).toContain('font-size: 12px;');
    expect(indexSource).toContain('height: 28px;');
  });

  it('shows the expected list columns', () => {
    expect(useGridColumns()?.map((item) => item.field || item.title)).toEqual([
      undefined,
      'no',
      'bizTime',
      'customerName',
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
    ).toBe('已收金额');
    expect(
      useGridColumns()?.find((item) => item.field === 'balanceAmount')?.title,
    ).toBe('剩余金额');
    expect(useGridColumns()?.at(-1)?.width).toBe(126);
    expect(indexSource).not.toContain('其他应收按独立往来闭环改造');
    expect(indexSource).not.toContain('当前对象范围先按客户接入');
    expect(indexSource).not.toContain('转收款仅为收款单创建入口');
    expect(indexSource).not.toContain('不能据此形成正式未结余额');
    expect(indexSource).not.toContain('<Alert');
  });

  it('opens detail only from the number link', () => {
    expect(indexSource).not.toContain("label: '明细'");
    expect(indexSource).not.toMatch(/cellClick:\s*\(/);
    expect(indexSource).toContain('@click.stop="handleDetail(row)"');
  });

  it('uses the payment-document style full-width modal layout', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true });');
    expect(formSource).toContain(
      'class="!w-full receivable-misc-document-modal"',
    );
    expect(formSource).toContain('bordered');
    expect(formSource).toContain('content-class="p-0"');
    expect(formSource).toContain('class="misc-document-status"');
    expect(formSource).toContain('class="misc-document-view"');
    expect(formSource).toContain(
      "wrapperClass: 'receivable-misc-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain('class="misc-document-section__header"');
    expect(formSource).toContain('class="misc-document-section__title"');
    expect(formSource).toContain('class="misc-document-settlement"');
    expect(formSource).toContain('class="misc-document-summary"');
    expect(formSource).not.toContain('class="misc-document-title"');
    expect(formSource).toContain(
      '.misc-document-edit-form :deep(.ant-select-single .ant-select-selector)',
    );
    expect(formSource).toContain(
      ':deep(.ant-select-single .ant-select-selection-search-input)',
    );
    expect(formSource).toContain(
      '.finance-document-form-readonly-text.ant-input-affix-wrapper',
    );
    expect(formSource).toContain('height: 32px !important;');
    expect(formSource).toContain(
      '.misc-document-settlement :deep(.ant-table-cell)',
    );
    expect(formSource).toContain(
      '.misc-document-settlement :deep(.ant-table-cell > *)',
    );
    expect(formSource).toContain(
      '.misc-document-settlement :deep(.ant-pagination-item)',
    );
    expect(formSource).toContain('font-size: 12px !important;');
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
    expect(onOpenChangeSource).toContain('getReceivableMisc(modalData.id),');
    expect(formSource).toContain('其他应收详情加载失败，请关闭后重试');
  });

  it('keeps the form mounted while detail values are loading', () => {
    expect(formSource).toContain('v-show="!detailLoading && !detailLoadError"');
    expect(formSource).not.toContain(
      '<section v-else ref="basicFormRef" class="misc-document-section">',
    );
    expect(onOpenChangeSource).toContain('await formApi.setValues(');
    expect(onOpenChangeSource).toContain(
      'normalizeReceivableMiscFormValues(detail || {})',
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

  it('renders detail mode through the disabled document form with summary and audit information', () => {
    expect(formSource).toContain('buildFinanceDocumentDetailFormValues');
    expect(formSource).toContain('<Form');
    expect(formSource).toContain('class="misc-document-edit-form"');
    expect(formSource).toContain(
      ':class="{ \'misc-document-edit-form--editable\': !isDetail }"',
    );
    expect(formSource).toContain('基础信息');
    expect(formSource).toContain('单据合计');
    expect(formSource).toContain('来源信息');
    expect(formSource).toContain('审计信息');
    expect(formSource).toContain(
      '<ErpAuditInfo title="" :record="formData" />',
    );
    expect(formSource).toContain("label: '原金额'");
    expect(formSource).toContain("label: '已收金额'");
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
    expect(prependFooterTemplate).toContain('转收款');
    expect(prependFooterTemplate).toContain('审核');
    expect(prependFooterTemplate).not.toContain('class="mr-2"');
    expect(formSource).toContain('<template #cancelText>');
    expect(formSource).toContain("{{ isDetail ? '关闭' : '取消' }}");
  });

  it('opens receipt form from approved misc detail only', () => {
    expect(formSource).toContain('const canTransferToReceivable = computed');
    expect(formSource).toContain('Number(formData.value.status) === 20');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:finance-receipt:create'])",
    );
    expect(formSource).toContain('!detailLoading.value');
    expect(formSource).toContain('!detailLoadError.value');
    expect(formSource).toContain('!formData.value.generatedOffset');
    expect(formSource).toContain('financeCompare(getTransferAvailableAmount(), 0) !== 0');
    expect(formSource).toContain(
      'const canShowSettledTransferState = computed',
    );
    expect(formSource).toContain('handleTransferToReceivable');
    expect(formSource).toContain('settlement/receipt/modules/form.vue');
    expect(formSource).toContain('amount: getTransferAvailableAmount(),');
    expect(formSource).toContain('已结清');
    expect(formSource).toContain(
      '<ReceiptModal v-if="shouldRenderReceipt" @success="refreshSettlement" />',
    );
  });
});
