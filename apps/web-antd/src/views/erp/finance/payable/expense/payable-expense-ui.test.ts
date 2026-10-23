import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormSchema, useGridColumns, useItemColumns } from './data';
import {
  formatPayableExpenseAmount,
  getPayableExpensePageSummary,
  normalizePayableExpenseDate,
  normalizePayableExpenseListRow,
} from './ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const itemFormSource = readFileSync(
  join(currentDir, 'modules', 'item-form.vue'),
  'utf8',
);

describe('payable expense UI contract', () => {
  it('summarizes and formats the visible page reliably', () => {
    expect(
      getPayableExpensePageSummary([
        { totalAmount: 1200.5 },
        { totalAmount: 99.5 },
      ]),
    ).toEqual({
      documentCount: 2,
      totalAmount: 1300,
    });
    expect(formatPayableExpenseAmount(1_234_567.8)).toBe('1,234,567.80');
  });

  it('normalizes array-shaped item dates before rendering the date picker', () => {
    expect(normalizePayableExpenseDate([2026, 9, 28])).toBe('2026-09-28');
    expect(normalizePayableExpenseDate('2026-09-28')).toBe('2026-09-28');
    expect(normalizePayableExpenseDate([2026, 13, 28])).toBeUndefined();
    expect(normalizePayableExpenseDate(undefined)).toBeUndefined();
    expect(itemFormSource).toContain(
      'bizDate: normalizePayableExpenseDate(item.bizDate)',
    );
    expect(formSource).toContain(
      'bizTime: normalizePayableExpenseDate(detail.bizTime)',
    );
  });

  it('shows audit information only for approved rows', () => {
    expect(
      normalizePayableExpenseListRow({
        status: 20,
        updaterName: '审核员',
        updateTime: '2026-07-20 10:00:00',
      }),
    ).toMatchObject({
      auditorName: '审核员',
      auditTime: '2026-07-20 10:00:00',
    });
    expect(
      normalizePayableExpenseListRow({
        status: 10,
        updaterName: '制单员',
        updateTime: '2026-07-20 09:00:00',
      }),
    ).toMatchObject({ auditorName: undefined, auditTime: undefined });
  });

  it('keeps the requested field order and fixes only operations', () => {
    const columns = useGridColumns() || [];
    const checkbox = columns.find((column) => column.type === 'checkbox');
    const documentNo = columns.find((column) => column.field === 'no');
    const actions = columns.find((column) => column.field === 'actions');
    const amount = columns.find((column) => column.field === 'totalAmount');

    expect(columns.map((column) => column.field || column.type)).toEqual([
      'checkbox',
      'deleteAction',
      'printAction',
      'no',
      'bizTime',
      'expenseBizType',
      'expenseType',
      'totalAmount',
      'accountName',
      'status',
      'handlerName',
      'party',
      'auditTime',
      'remark',
      'creatorName',
      'relatedBiz',
      'deptName',
      'auditorName',
      'actions',
    ]);
    expect(columns.slice(1, -1).map((column) => column.title)).toEqual([
      '删除',
      '打印',
      '单号',
      '日期',
      '类型',
      '支出类型',
      '金额',
      '账户',
      '状态',
      '经手人',
      '对象',
      '审核时间',
      '备注',
      '创建人',
      '相关业务',
      '部门',
      '审核人',
    ]);
    expect(checkbox?.fixed).toBeUndefined();
    expect(documentNo?.fixed).toBeUndefined();
    expect(documentNo?.slots?.default).toBe('no');
    expect(actions?.fixed).toBe('right');
    expect(amount?.align).toBe('right');
    expect(amount?.headerAlign).toBe('right');
  });

  it('does not show business report boundary notes in the operational list', () => {
    expect(indexSource).not.toContain(
      '费用支付明细可作为经营报表第一阶段费用展示入口',
    );
    expect(indexSource).not.toContain(
      '公共费用分摊、预算完成率、部门利润归集和其他经营收支剔除规则仍待配置确认',
    );
    expect(indexSource).not.toContain('费用承担部门与付款部门需要区分');
    expect(indexSource).not.toContain('规则版本、基数快照和尾差处理');
    expect(indexSource).not.toContain('预算缺失不显示虚假完成率');
    expect(indexSource).not.toContain('<Alert');
    expect(indexSource).toContain("import { message } from 'ant-design-vue'");
  });

  it('uses a compact sortable list, subtotal, and sticky summary', () => {
    expect(indexSource).toContain('font-size: 12px');
    expect(indexSource).toContain('<FinanceListQuerySummary');
    expect(indexSource).toContain('querySummaryState.load');
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
    expect(indexSource).toContain('handleSearchEnter');
    expect(indexSource).toContain(
      'class="payable-expense-grid__document-link"',
    );
    expect(indexSource).toContain('class="payable-expense-summary"');
    expect(indexSource).toContain('.vxe-grid--bottom-wrapper');
    expect(indexSource).toContain('.vxe-grid--pager-wrapper');
  });

  it('refreshes explicitly after create, import, audit, and delete', () => {
    expect(indexSource).toContain('async function handleRefresh(');
    expect(indexSource).toContain("commitProxy('page', { currentPage: 1 })");
    expect(indexSource).toContain('await gridApi.query()');
    expect(indexSource).toContain('@success="handleRefresh(true)"');
    expect(indexSource).toContain('@success="handleImportSuccess"');
    expect(indexSource).toContain('await handleRefresh();');

    const emitIndex = formSource.indexOf("emit('success')");
    const closeIndex = formSource.indexOf('await modalApi.close()', emitIndex);
    expect(emitIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(emitIndex);
  });

  it('uses one fullscreen four-column structure for create, edit, and detail', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain('xl:grid-cols-4');
    expect(formSource).toContain("layout: 'horizontal'");
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain('基本信息');
    expect(formSource).toContain('费用明细');
    expect(formSource).toContain('<ErpDocumentSummaryBar');
    expect(formSource).toContain(':entries="documentSummaryEntries"');
    expect(formSource).not.toContain('payable-expense-document-summary');
    expect(formSource).toContain('审计信息');
    expect(formSource).toContain(
      "'payable-expense-document-form--editable': !isDetail",
    );
  });

  it('defaults applicant fields to the current user and places add detail on the table', () => {
    const bodyIndex = formSource.indexOf(
      'class="payable-expense-document-section__body"',
    );
    const toolbarIndex = formSource.indexOf(
      'class="payable-expense-document-table-toolbar"',
    );
    const itemFormIndex = formSource.indexOf('<ItemForm');

    expect(formSource).toContain('const userStore = useUserStore()');
    expect(formSource).toContain('deptId: userInfo?.deptId');
    expect(formSource).toContain('handlerId: userInfo?.id');
    expect(toolbarIndex).toBeGreaterThan(bodyIndex);
    expect(itemFormIndex).toBeGreaterThan(toolbarIndex);
    expect(formSource).toContain('itemFormRef.value?.addRow()');
    expect(formSource).toContain('@update:items="handleItemsUpdate"');
  });

  it('applies the compact main-form typography to every field state', () => {
    expect(formSource).toContain('--payable-expense-main-font-size: 12px');
    expect(formSource).toContain('.payable-expense-basic-grid');
    expect(formSource).toContain(
      '.payable-expense-document-basic-form .ant-input-number-input',
    );
    expect(formSource).toContain(
      '.payable-expense-document-basic-form .ant-select-selection-placeholder',
    );
    expect(formSource).toContain(
      '.payable-expense-document-basic-form .ant-form-item-explain',
    );
    expect(formSource).toContain(
      '.payable-expense-document-basic-form .ant-upload-list-item',
    );
    expect(itemFormSource).toContain('font-size: 12px');
    expect(itemFormSource).not.toContain('font-size: 14px');
    expect(formSource).toContain(
      '.finance-document-form-readonly-text.ant-input-affix-wrapper',
    );
    expect(formSource).toContain('height: 32px !important');
    expect(formSource).toContain('> input.ant-input');
    expect(itemFormSource).toContain('height: 28px !important');
    expect(itemFormSource).toContain('line-height: 26px');
    expect(itemFormSource).toContain(
      'payable-expense-inline-item-date-picker-dropdown',
    );
  });

  it('has explicit detail loading, failure, mounted hydration, and stale exits', () => {
    expect(formSource).toContain('const detailLoading = ref(false)');
    expect(formSource).toContain("const detailLoadError = ref('')");
    expect(formSource).toContain("'费用支付详情加载失败，请关闭后重试'");
    expect(formSource).toContain('requestId !== openRequestId');
    expect(formSource).toContain('v-show="!detailLoading && !detailLoadError"');
    expect(formSource).toContain('v-if="!isHidden(\'items\')"');
    expect(formSource).toContain('<ItemForm');
    expect(formSource).toContain('detailLoading.value = false');
    expect(formSource).toContain('modalApi.unlock()');
  });

  it('keeps item operations visible on the right and enables inline sorting', () => {
    const columns = useItemColumns(false) || [];
    const actions = columns.find((column) => column.title === '操作');
    const amount = columns.find((column) => column.field === 'amount');
    const qty = columns.find((column) => column.field === 'qty');

    expect(columns.map((column) => column.field || column.title)).toEqual([
      'itemName',
      'amount',
      'invoiceNo',
      'party',
      'remark',
      'deptId',
      'bizDate',
      'handlerId',
      'qty',
      'expenseCategory',
      'fileUrl',
      'actions',
    ]);
    expect(actions?.field).toBe('actions');
    expect(actions?.fixed).toBe('right');
    expect(actions?.visible).toBe(true);
    expect(
      columns.find((column) => column.field === 'itemName')?.slots?.default,
    ).toBe('itemName');
    expect(
      columns.find((column) => column.field === 'amount')?.slots?.default,
    ).toBe('amount');
    expect(
      columns.find((column) => column.field === 'fileUrl')?.slots?.default,
    ).toBe('fileUrl');
    expect(amount?.align).toBe('right');
    expect(amount?.headerAlign).toBe('center');
    expect(qty?.align).toBe('right');
    expect(qty?.headerAlign).toBe('center');
    expect(itemFormSource).toContain("orders: ['asc', 'desc', null]");
    expect(itemFormSource).toContain('sortPayableExpenseItems(');
    expect(itemFormSource).toContain('getItemsSignature(items)');
    expect(itemFormSource).toContain('incomingSignature === currentSignature');
    expect(itemFormSource).toContain('trailingFlexibleColumnMinWidth: 150');
    expect(itemFormSource).toContain(
      'applyFinanceDocumentItemColumnCustomization(',
    );
    expect(itemFormSource).toContain('custom: handleItemColumnCustom');
    expect(itemFormSource).toContain('queryMethod: () => refreshItemGrid()');
    expect(itemFormSource).toContain('fitFinanceDocumentItemColumnsToWidth(');
    expect(itemFormSource).toContain('fit: false');
    expect(itemFormSource).toContain('inputmode="decimal"');
    expect(itemFormSource).toContain('inputmode="numeric"');
    expect(itemFormSource).toContain('queueFocusRowAmountInput(clientRowKey)');
    expect(itemFormSource).not.toContain(
      'refreshItemGrid().then(() => queueFocusFirstAmountInput())',
    );
    expect(itemFormSource).toContain('zoom: true');
    expect(itemFormSource).toContain('<template #toolbar-tools>');
  });

  it('keeps action visibility permission- and status-aware', () => {
    for (const permission of [
      'erp:payable-expense:create',
      'erp:payable-expense:delete',
      'erp:payable-expense:export',
      'erp:payable-expense:import',
      'erp:payable-expense:print',
      'erp:payable-expense:print-template',
      'erp:payable-expense:update',
      'erp:payable-expense:update-status',
    ]) {
      expect(indexSource).toContain(permission);
    }
    expect(indexSource).toContain('ifShow: () => isPendingRow(row)');
    expect(indexSource).toContain('ifShow: () => checkedRows.length > 0');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toContain('message.success(`已删除 ');
    expect(indexSource).toContain('条，已跳过 ');
    expect(indexSource).toContain('skippedCount} 条`');
    expect(formSource).toContain('erp:payable-expense:create');
    expect(formSource).toContain('erp:payable-expense:update-status');
    expect(indexSource).not.toContain('const rowActionColumnFields');
    expect(indexSource).not.toMatch(/cellClick:\s*\(/);
    expect(indexSource).toContain('@click.stop="handleDetail(row)"');
    expect(indexSource).toContain('<template #deleteAction="{ row }">');
    expect(indexSource).toContain('<template #printAction="{ row }">');
    expect(indexSource).toContain("auth: ['erp:payable-expense:print']");
    expect(indexSource).toContain('onClick: handlePrint.bind(null, row)');
  });

  it('wires payable expense into the shared print template flow', () => {
    expect(indexSource).toContain('import PrintTemplateModal');
    expect(indexSource).toContain('import PrintTemplateSelector');
    expect(indexSource).toContain('useErpPrintTemplate');
    expect(indexSource).toContain(
      "const PRINT_TEMPLATE_MODULE = 'payable_expense'",
    );
    expect(indexSource).toContain('PrintTemplateDesignModal');
    expect(indexSource).toContain('<PrintTemplateSelector');
    expect(indexSource).toContain("moduleName: '费用支付'");
    expect(indexSource).toContain(
      "auth: ['erp:payable-expense:print-template']",
    );
  });

  it('keeps long form fields responsive without changing field permissions', () => {
    const schema = useFormSchema('create');
    expect(schema.map((item) => item.fieldName)).toEqual([
      'id',
      'bizTime',
      'no',
      'settleMethod',
      'accountId',
      'voucherNo',
      'expenseBizType',
      'totalAmount',
      'deptId',
      'handlerId',
      'expenseType',
      'party',
      'relatedBiz',
      'docType',
      'remark',
      'fileUrl',
    ]);
    expect(schema.find((item) => item.fieldName === 'bizTime')?.label).toBe(
      '日期',
    );
    expect(schema.find((item) => item.fieldName === 'no')?.label).toBe('单号');
    expect(
      schema.find((item) => item.fieldName === 'settleMethod')?.component,
    ).toBe('ApiSelect');
    expect(
      schema.find((item) => item.fieldName === 'expenseBizType')?.label,
    ).toBe('类型');
    expect(schema.find((item) => item.fieldName === 'expenseType')?.label).toBe(
      '支出类型',
    );
    expect(schema.find((item) => item.fieldName === 'deptId')?.rules).toBe(
      'required',
    );
    expect(
      schema.find((item) => item.fieldName === 'relatedBiz')?.formItemClass,
    ).toContain('sm:col-span-2');
    expect(
      schema.find((item) => item.fieldName === 'fileUrl')?.formItemClass,
    ).toContain('xl:col-span-3');
    expect(
      schema.find((item) => item.fieldName === 'remark')?.formItemClass,
    ).toContain('xl:col-span-4');
  });

  it('uses configurable project options for payable expense item names', () => {
    const gridSearchSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
    expect(gridSearchSource).toContain(
      "export const PAYABLE_EXPENSE_ITEM_PROJECT = 'payable_expense_item_project'",
    );
    expect(gridSearchSource).toContain(
      'getBaseDataSimpleList(PAYABLE_EXPENSE_BIZ_TYPE)',
    );
    expect(gridSearchSource).toContain(
      'getBaseDataSimpleList(PAYABLE_EXPENSE_ITEM_PROJECT)',
    );
    expect(gridSearchSource).toContain("fieldName: 'itemName'");
    expect(gridSearchSource).toContain("component: 'ApiSelect'");
    expect(itemFormSource).toContain('const itemProjectOptions = ref');
    expect(itemFormSource).toContain(
      'getBaseDataSimpleList(PAYABLE_EXPENSE_ITEM_PROJECT)',
    );
    expect(itemFormSource).toContain(':options="itemProjectOptions"');
    expect(itemFormSource).toContain('placeholder="请选择项目名称"');
  });
});
