import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormSchema, useGridColumns } from './data';
import {
  formatOtherPayableAmount,
  getOtherPayablePageSummary,
  normalizeOtherPayableBizDate,
} from './ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);

describe('other payable page design contract', () => {
  it('normalizes string and Java LocalDate array values for the date picker', () => {
    expect(normalizeOtherPayableBizDate('2026-06-12T10:30:00')).toBe(
      '2026-06-12',
    );
    expect(normalizeOtherPayableBizDate([2026, 6, 12])).toBe('2026-06-12');
    expect(normalizeOtherPayableBizDate(undefined)).toBeUndefined();
  });

  it('summarizes current-page payables with stable financial formatting', () => {
    expect(
      getOtherPayablePageSummary([
        { payableAmount: 1250, settledAmount: 300 },
        { payableAmount: 750.5, settledAmount: 200.25 },
      ]),
    ).toEqual({
      documentCount: 2,
      outstandingAmount: 1500.25,
      payableAmount: 2000.5,
      settledAmount: 500.25,
    });
    expect(formatOtherPayableAmount(1_234_567.8)).toBe('1,234,567.80');
  });

  it('keeps the configured field order while refining scan density', () => {
    const columns = useGridColumns() || [];
    expect(columns.map((column) => column.field || column.type)).toEqual([
      'checkbox',
      'deleteAction',
      'printAction',
      'no',
      'bizTime',
      'payableAmount',
      'increasePayableAmount',
      'settledAmount',
      'sourceType',
      'sourceNo',
      'status',
      'voucherNo',
      'supplierName',
      'creatorName',
      'createTime',
      'auditorName',
      'auditTime',
      'handlerName',
      'remark',
      undefined,
    ]);
    expect(columns.slice(1, -1).map((column) => column.title)).toEqual([
      '删除',
      '打印',
      '单号',
      '日期',
      '应付金额',
      '增加应付',
      '已结金额',
      '来源类型',
      '来源单号',
      '状态',
      '凭证号',
      '供应商名称',
      '创建人',
      '创建时间',
      '审核人',
      '审核时间',
      '经手人',
      '备注',
    ]);
    expect(columns[0]?.fixed).toBeUndefined();
    expect(columns[3]?.fixed).toBeUndefined();
    expect(columns.at(-1)?.fixed).toBe('right');
    expect(columns.find((column) => column.field === 'no')?.slots).toEqual({
      default: 'otherPayableNo',
    });
  });

  it('right-aligns financial list values and emphasizes payables', () => {
    const amountColumns = useGridColumns()?.filter((column) =>
      ['increasePayableAmount', 'payableAmount', 'settledAmount'].includes(
        String(column.field),
      ),
    );
    expect(amountColumns).toHaveLength(3);
    amountColumns?.forEach((column) => {
      expect(column.align).toBe('right');
      expect(column.headerAlign).toBe('right');
    });
    expect(
      amountColumns?.find((column) => column.field === 'payableAmount')
        ?.className,
    ).toContain('other-payable-amount-cell--primary');
  });

  it('uses a compact sortable list with a subtotal and sticky page summary', () => {
    expect(indexSource).toContain('font-size: 12px');
    expect(indexSource).toContain('<FinanceListQuerySummary');
    expect(indexSource).toContain('querySummaryState.load');
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
    expect(indexSource).toContain('handleSearchEnter');
    expect(indexSource).toContain('increasePayableAmount: row.payableAmount');
    expect(indexSource).toContain('class="other-payable-grid__document-link"');
    expect(indexSource).toContain('class="other-payable-summary"');
    expect(indexSource).toContain('未结算金额');
    expect(indexSource).toContain('.vxe-grid--bottom-wrapper');
    expect(indexSource).toContain('.vxe-grid--pager-wrapper');
  });

  it('keeps batch and row actions permission- and status-aware', () => {
    expect(indexSource).toContain('ifShow: () => checkedRows.length > 0');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toContain('message.success(`已删除 ');
    expect(indexSource).toContain('条，已跳过 ');
    expect(indexSource).toContain('skippedCount} 条`');
    for (const permission of [
      'erp:payable-other:create',
      'erp:payable-other:delete',
      'erp:payable-other:export',
      'erp:payable-other:import',
      'erp:payable-other:update',
      'erp:payable-other:update-status',
    ]) {
      expect(indexSource).toContain(permission);
    }
    expect(indexSource).toContain('ifShow: () => isPendingRow(row)');
    expect(indexSource).toContain('<template #deleteAction="{ row }">');
    expect(indexSource).toContain('<template #printAction="{ row }">');
    expect(indexSource).toContain('import PrintTemplateModal');
    expect(indexSource).toContain('import PrintTemplateSelector');
    expect(indexSource).toContain('useErpPrintTemplate');
    expect(indexSource).toContain(
      "const PRINT_TEMPLATE_MODULE = 'payable_other'",
    );
    expect(indexSource).toContain('PrintTemplateDesignModal');
    expect(indexSource).toContain('handleOpenPrintTemplateDesigner');
    expect(indexSource).toContain('printTemplateSelectOpen');
    expect(indexSource).toContain('printTemplateOptions');
    expect(indexSource).toContain("auth: ['erp:payable-other:print']");
    expect(indexSource).toContain("auth: ['erp:payable-other:print-template']");
    expect(indexSource).toContain('@printed="handleRefresh"');
    expect(indexSource).toContain('handlePrint.bind(null, row)');
    expect(indexSource).not.toContain('const rowActionColumnFields');
    expect(indexSource).not.toMatch(/cellClick:\s*\(/);
    expect(indexSource).toContain('@click.stop="handleDetail(row)"');
    expect(indexSource).not.toContain('打印模板配置中');
  });

  it('uses the same fullscreen four-column structure for every form mode', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      "wrapperClass: 'other-payable-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain('基本信息');
    expect(formSource).toContain('审计信息');
    expect(formSource).toContain(
      "'other-payable-form__base-form--editable': !isDetail",
    );
    expect(formSource).toContain('other-payable-form-select-dropdown');
  });

  it('provides explicit detail loading, failure, success, and stale-request exits', () => {
    expect(formSource).toContain('detailLoading');
    expect(formSource).toContain('detailLoadError');
    expect(formSource).toContain('应付调账详情加载中...');
    expect(formSource).toContain('应付调账详情加载失败，请关闭后重试');
    expect(formSource).toContain('requestId !== openRequestId');
    expect(formSource).toContain('detailLoading.value = false');
    expect(formSource).toContain('modalApi.unlock()');
    expect(formSource).toContain('v-show="!detailLoading && !detailLoadError"');
  });

  it('keeps the adjusted create, edit, and detail form field order', () => {
    const expectedOrder = [
      'id',
      'no',
      'sourceType',
      'supplierId',
      'bizTime',
      'handlerId',
      'voucherNo',
      'payableAmount',
      'settledAmount',
      'project',
      'deptId',
      'remark',
      'fileUrl',
    ];

    for (const mode of ['create', 'edit', 'detail']) {
      expect(useFormSchema(mode).map((item) => item.fieldName)).toEqual(
        expectedOrder,
      );
    }
  });

  it('uses the screenshot labels only on the create/edit/detail form', () => {
    const schema = useFormSchema('create');
    expect(schema.find((item) => item.fieldName === 'no')?.label).toBe(
      '账单编号',
    );
    expect(
      schema.find((item) => item.fieldName === 'settledAmount')?.label,
    ).toBe('已付金额');
    expect(schema.find((item) => item.fieldName === 'project')?.label).toBe(
      '项目',
    );
    expect(schema.find((item) => item.fieldName === 'remark')?.label).toBe(
      '备注',
    );
  });

  it('requires only supplier, payable amount, and department on the form', () => {
    const schema = useFormSchema('create');
    expect(schema.find((item) => item.fieldName === 'supplierId')?.rules).toBe(
      'required',
    );
    expect(schema.find((item) => item.fieldName === 'deptId')?.rules).toBe(
      'required',
    );

    const payableAmountRules = schema.find(
      (item) => item.fieldName === 'payableAmount',
    )?.rules as { safeParse: (value: unknown) => { success: boolean } };
    const settledAmountRules = schema.find(
      (item) => item.fieldName === 'settledAmount',
    )?.rules as { safeParse: (value: unknown) => { success: boolean } };
    expect(payableAmountRules.safeParse('').success).toBe(false);
    expect(payableAmountRules.safeParse(0).success).toBe(false);
    expect(payableAmountRules.safeParse(-1).success).toBe(true);
    expect(settledAmountRules.safeParse('').success).toBe(true);
    expect(settledAmountRules.safeParse(-1).success).toBe(false);

    for (const field of ['bizTime', 'remark']) {
      expect(
        schema.find((item) => item.fieldName === field)?.rules,
      ).toBeUndefined();
    }
  });

  it('lets long-form fields span the full four-column form width', () => {
    const schema = useFormSchema('create');
    for (const field of ['fileUrl', 'remark']) {
      expect(
        schema.find((item) => item.fieldName === field)?.formItemClass,
      ).toBe('col-span-4');
    }
  });

  it('prefills source context from payable misc without copying the amount', () => {
    expect(formSource).toContain(
      'sourcePayableMisc?: ErpPayableMiscApi.PayableMisc',
    );
    expect(formSource).toContain('function buildSourcePayableMiscDefaults');
    expect(formSource).toContain('supplierId: source.supplierId');
    expect(formSource).toContain('supplierName: source.supplierName');
    expect(formSource).toContain('deptId: source.deptId');
    expect(formSource).toContain('deptName: source.deptName');
    expect(formSource).toContain('handlerId: source.handlerId');
    expect(formSource).toContain('handlerName: source.handlerName');
    expect(formSource).toContain("sourceType: '其他应付'");
    expect(formSource).toContain('sourceNo: source.no');
    expect(formSource).toContain(`\`由其他应付单 \${source.no} 转入\``);
    expect(formSource).toContain("'由其他应付单转入'");
    expect(formSource).toContain('data?.sourcePayableMisc');
    expect(formSource).toContain(
      'buildSourcePayableMiscDefaults(data.sourcePayableMisc)',
    );
    expect(formSource).not.toContain('payableAmount: source.amount');
  });

  it('skips automatic draft saving only for payable misc transfer closes', () => {
    expect(formSource).toContain('let sourcePayableMiscMode = false;');
    expect(formSource).toContain(
      'sourcePayableMiscMode = Boolean(data?.sourcePayableMisc);',
    );
    expect(formSource).toContain(
      '(sourcePayableMiscMode && !options.explicit) ||',
    );
    expect(formSource).toContain(
      'const saved = await saveCurrentDraft({ explicit: true });',
    );
    expect(formSource).toContain('sourcePayableMiscMode = false;');
  });

  it('hydrates the current supplier option before applying form values', () => {
    expect(formSource).toContain('buildFinanceDocumentFormSchema');
    expect(formSource).toContain('hydrateFinanceDocumentFormSelectLabels');
    expect(formSource).toContain(
      'supplierData: ErpPayableOtherApi.PayableOther | undefined = formData.value',
    );
    expect(formSource).toContain('buildFormSchema(type, supplierData)');
    expect(formSource).toContain('buildFinanceDocumentDetailFormValues');
    expect(formSource).toContain(
      'await applyFormMode(formType.value, formData.value)',
    );
    expect(formSource).toContain("await applyFormMode('edit', nextFormData)");
    expect(formSource).toContain("await applyFormMode('create', copyData)");
  });
});
