import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormSchema, useGridColumns } from './data';
import {
  formatOtherReceivableAmount,
  getOtherReceivablePageSummary,
  normalizeOtherReceivableBizDate,
} from './ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);

function getComponentProps(
  schema: ReturnType<typeof useFormSchema>,
  fieldName: string,
) {
  return schema.find((item) => item.fieldName === fieldName)?.componentProps as
    | Record<string, any>
    | undefined;
}

describe('other receivable page design contract', () => {
  it('normalizes string and Java LocalDate array values for the date picker', () => {
    expect(normalizeOtherReceivableBizDate('2026-06-12T10:30:00')).toBe(
      '2026-06-12',
    );
    expect(normalizeOtherReceivableBizDate([2026, 6, 12])).toBe('2026-06-12');
    expect(normalizeOtherReceivableBizDate(undefined)).toBeUndefined();
  });

  it('summarizes current-page receivables with stable financial formatting', () => {
    expect(
      getOtherReceivablePageSummary([
        { receivableAmount: 1250, settledAmount: 300 },
        { receivableAmount: 750.5, settledAmount: 200.25 },
      ]),
    ).toEqual({
      documentCount: 2,
      outstandingAmount: '1500.25',
      receivableAmount: '2000.5',
      settledAmount: '500.25',
    });
    expect(formatOtherReceivableAmount(1_234_567.8)).toBe('1,234,567.80');
  });

  it('keeps the configured field order while refining scan density', () => {
    const columns = useGridColumns() || [];
    expect(columns.map((column) => column.field || column.type)).toEqual([
      'checkbox',
      'deleteAction',
      'printAction',
      'no',
      'bizTime',
      'receivableAmount',
      'increaseReceivableAmount',
      'settledAmount',
      'sourceType',
      'status',
      'voucherNo',
      'customerName',
      'saleUserName',
      'creatorName',
      'createTime',
      'auditorName',
      'auditTime',
      'handlerName',
      'remark',
      'project',
      'deptName',
      undefined,
    ]);
    expect(columns.slice(1, -1).map((column) => column.title)).toEqual([
      '删除',
      '打印',
      '单号',
      '日期',
      '应收金额',
      '增加应收',
      '已结金额',
      '来源类型',
      '状态',
      '凭证号',
      '客户名称',
      '业务员',
      '创建人',
      '创建时间',
      '审核人',
      '审核时间',
      '经手人',
      '备注',
      '项目',
      '所属部门',
    ]);
    expect(columns[0]?.fixed).toBeUndefined();
    expect(columns[3]?.fixed).toBeUndefined();
    expect(columns.at(-1)?.fixed).toBe('right');
    expect(columns.find((column) => column.field === 'no')?.slots).toEqual({
      default: 'otherReceivableNo',
    });
  });

  it('right-aligns all financial list values and emphasizes receivables', () => {
    const amountColumns = useGridColumns()?.filter((column) =>
      [
        'increaseReceivableAmount',
        'receivableAmount',
        'settledAmount',
      ].includes(String(column.field)),
    );
    expect(amountColumns).toHaveLength(3);
    amountColumns?.forEach((column) => {
      expect(column.align).toBe('right');
      expect(column.headerAlign).toBe('right');
    });
    expect(
      amountColumns?.find((column) => column.field === 'receivableAmount')
        ?.className,
    ).toContain('other-receivable-amount-cell--primary');
  });

  it('uses a compact sortable list with a subtotal and sticky page summary', () => {
    expect(indexSource).toContain('font-size: 12px');
    expect(indexSource).toContain('<FinanceListQuerySummary');
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
    expect(indexSource).toContain('handleSearchEnter');
    expect(indexSource).toContain(
      'class="other-receivable-grid__document-link"',
    );
    expect(indexSource).toContain('class="other-receivable-summary"');
    expect(indexSource).toContain('未结算金额');
    expect(indexSource).toContain('.vxe-grid--bottom-wrapper');
    expect(indexSource).toContain('.vxe-grid--pager-wrapper');
  });

  it('keeps batch and row actions permission- and status-aware', () => {
    expect(indexSource).toContain(
      'ifShow: () => checkedRows.some(isPendingRow)',
    );
    expect(indexSource).toContain('ifShow: () => checkedRows.length > 0');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toContain('message.success(`已删除 ');
    expect(indexSource).toContain('条，已跳过 ');
    expect(indexSource).toContain('skippedCount} 条`');
    for (const permission of [
      'erp:receivable-other:create',
      'erp:receivable-other:delete',
      'erp:receivable-other:export',
      'erp:receivable-other:import',
      'erp:receivable-other:update',
      'erp:receivable-other:update-status',
    ]) {
      expect(indexSource).toContain(permission);
    }
    expect(indexSource).toContain('ifShow: () => isPendingRow(row)');
    expect(indexSource).toContain(
      'ifShow: () => isDraftRow(row) || isPendingRow(row)',
    );
    expect(indexSource).toContain('import PrintTemplateModal');
    expect(indexSource).toContain('import PrintTemplateSelector');
    expect(indexSource).toContain('useErpPrintTemplate');
    expect(indexSource).toContain(
      "const PRINT_TEMPLATE_MODULE = 'receivable_other'",
    );
    expect(indexSource).toContain('PrintTemplateDesignModal');
    expect(indexSource).toContain('handleOpenPrintTemplateDesigner');
    expect(indexSource).toContain('printTemplateSelectOpen');
    expect(indexSource).toContain('printTemplateOptions');
    expect(indexSource).toContain("auth: ['erp:receivable-other:print']");
    expect(indexSource).toContain(
      "auth: ['erp:receivable-other:print-template']",
    );
    expect(indexSource).toContain('@printed="handleRefresh"');
    expect(indexSource).toContain('<template #deleteAction="{ row }">');
    expect(indexSource).toContain('<template #printAction="{ row }">');
    expect(indexSource).toContain('handlePrint.bind(null, row)');
    expect(indexSource).not.toContain('const rowActionColumnFields');
    expect(indexSource).not.toMatch(/cellClick:\s*\(/);
    expect(indexSource).toContain('@click.stop="handleDetail(row)"');
    expect(indexSource).not.toContain('打印模板配置中');
  });

  it('uses the same fullscreen four-column structure for every form mode', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      "wrapperClass: 'other-receivable-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain('基本信息');
    expect(formSource).toContain('审计信息');
    expect(formSource).toContain(
      "'other-receivable-form__base-form--editable': !isDetail",
    );
    expect(formSource).toContain('other-receivable-form-select-dropdown');
  });

  it('keeps the create form aligned with the other receivable field contract', () => {
    const schema = useFormSchema('create');
    expect(schema.map((item) => item.fieldName)).toEqual([
      'id',
      'no',
      'sourceType',
      'customerId',
      'bizTime',
      'creatorName',
      'handlerId',
      'voucherNo',
      'receivableAmount',
      'settledAmount',
      'deptId',
      'project',
      'sourceNo',
      'receivableType',
      'costAmount',
      'isPaperNote',
      'paperNoteDesc',
      'remark',
      'fileUrl',
    ]);
    expect(schema.map((item) => item.label).filter(Boolean)).toEqual([
      '单据编号',
      '来源类型',
      '客户',
      '开单日期',
      '创建人',
      '经手人',
      '凭证号',
      '应收金额',
      '已结金额',
      '部门',
      '项目',
      '来源单号',
      '应收类型',
      '成本金额',
      '是否纸质欠条',
      '纸质欠条说明',
      '备注',
      '附件',
    ]);
    expect(getComponentProps(schema, 'bizTime')?.disabled).toBe(true);
    expect(getComponentProps(schema, 'sourceType')?.disabled).toBe(true);
    expect(getComponentProps(schema, 'creatorName')?.disabled).toBe(true);
  });

  it('uses fixed option sets and required validation for the new fields', () => {
    const schema = useFormSchema('create');
    expect(schema.find((item) => item.fieldName === 'project')?.component).toBe(
      'Select',
    );
    expect(getComponentProps(schema, 'project')?.options).toEqual([
      { label: '代垫运费', value: '代垫运费' },
    ]);
    expect(
      schema.find((item) => item.fieldName === 'receivableType')?.defaultValue,
    ).toBe('普通应收');
    expect(getComponentProps(schema, 'receivableType')?.options).toEqual([
      { label: '普通应收', value: '普通应收' },
    ]);
    expect(schema.find((item) => item.fieldName === 'deptId')?.rules).toBe(
      'required',
    );

    const receivableRule = schema.find(
      (item) => item.fieldName === 'receivableAmount',
    )?.rules as any;
    expect(receivableRule.safeParse(-12.5).success).toBe(true);
    expect(receivableRule.safeParse('').success).toBe(false);
    expect(schema.find((item) => item.fieldName === 'remark')?.rules).toBe(
      undefined,
    );
  });

  it('prefills source context from receivable misc without copying the amount', () => {
    expect(formSource).toContain(
      'sourceReceivableMisc?: ErpReceivableMiscApi.ReceivableMisc',
    );
    expect(formSource).toContain('function buildSourceReceivableMiscDefaults');
    expect(formSource).toContain("sourceType: '其他应收'");
    expect(formSource).toContain('sourceNo: source.no');
    expect(formSource).toContain(`\`由其他应收单 \${source.no} 转入\``);
    expect(formSource).toContain("'由其他应收单转入'");
    expect(formSource).toContain('customerId: source.customerId');
    expect(formSource).toContain('customerName: source.customerName');
    expect(formSource).toContain('deptId: source.deptId ?? defaults.deptId');
    expect(formSource).toContain('handlerId: source.handlerId');
    expect(formSource).toContain('data?.sourceReceivableMisc');
    expect(formSource).not.toContain('receivableAmount: source.amount');
  });

  it('hydrates the current customer option before applying form values', () => {
    expect(formSource).toContain('buildFinanceDocumentFormSchema');
    expect(formSource).toContain('hydrateFinanceDocumentFormSelectLabels');
    expect(formSource).toContain('buildFormSchema(type, customerData)');
    expect(formSource).toContain('buildFinanceDocumentDetailFormValues');
    expect(formSource).toContain(
      'await applyFormMode(formType.value, formData.value)',
    );
    expect(formSource).toContain("await applyFormMode('edit', nextFormData)");
    expect(formSource).toContain("await applyFormMode('create', copyData)");
  });

  it('provides explicit detail loading, failure, success, and stale-request exits', () => {
    expect(formSource).toContain('detailLoading');
    expect(formSource).toContain('detailLoadError');
    expect(formSource).toContain('应收调账详情加载中...');
    expect(formSource).toContain('应收调账详情加载失败，请关闭后重试');
    expect(formSource).toContain('requestId !== openRequestId');
    expect(formSource).toContain('detailLoading.value = false');
    expect(formSource).toContain('modalApi.unlock()');
    expect(formSource).toContain('v-show="!detailLoading && !detailLoadError"');
  });

  it('lets long-form fields span the full four-column form width', () => {
    const schema = useFormSchema('create');
    for (const field of ['fileUrl', 'paperNoteDesc', 'remark']) {
      expect(
        schema.find((item) => item.fieldName === field)?.formItemClass,
      ).toBe('col-span-4');
    }
    expect(
      schema.find((item) => item.fieldName === 'paperNoteDesc')?.component,
    ).toBe('Textarea');
  });
});
