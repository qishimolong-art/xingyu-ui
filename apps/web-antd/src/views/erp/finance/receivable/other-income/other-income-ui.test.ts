import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormItemColumns, useFormSchema, useGridColumns } from './data';
import {
  formatOtherIncomeAmountInput,
  formatOtherIncomeQtyInput,
  normalizeOtherIncomeAmount,
  parseOtherIncomeAmountText,
  parseOtherIncomeQtyText,
} from './modules/other-income-item-input';
import {
  formatOtherIncomeAmount,
  getOtherIncomePageSummary,
  normalizeOtherIncomeBizTime,
  normalizeOtherIncomeBizTimeForPicker,
  normalizeOtherIncomeItemBizDateForPicker,
  normalizeOtherIncomeListRow,
} from './ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const itemSource = readFileSync(
  join(currentDir, 'modules', 'item-form.vue'),
  'utf8',
);

function getComponentProps(field: any) {
  return typeof field?.componentProps === 'function'
    ? {}
    : (field?.componentProps ?? {});
}

describe('other income UI contract', () => {
  it('uses stable text input states for document quantity and amount', () => {
    expect(parseOtherIncomeQtyText('12')).toEqual({ ok: true, value: 12 });
    expect(parseOtherIncomeQtyText('1.25')).toMatchObject({ ok: false });
    expect(parseOtherIncomeQtyText('')).toMatchObject({ ok: false });
    expect(parseOtherIncomeAmountText('20.567')).toEqual({ ok: true, value: '20.567' });
    expect(parseOtherIncomeAmountText('20.56')).toEqual({
      ok: true,
      value: '20.56',
    });
    expect(parseOtherIncomeAmountText('1.')).toEqual({ ok: true, value: '1' });
    expect(parseOtherIncomeAmountText('-1')).toMatchObject({ ok: false });
    expect(normalizeOtherIncomeAmount(20.567)).toBe('20.567');
    expect(formatOtherIncomeQtyInput(12)).toBe('12');
    expect(formatOtherIncomeAmountInput(20)).toBe('20.00');
    expect(formatOtherIncomeAmountInput(20.5)).toBe('20.50');

    expect(itemSource).not.toContain('<InputNumber');
    expect(itemSource).toContain("'qtyText'");
    expect(itemSource).toContain("'amountText'");
    expect(itemSource).toContain('inputmode="numeric"');
    expect(itemSource).toContain('inputmode="decimal"');
    expect(itemSource).toContain("message.warning('单据数量必须大于 0')");
    expect(itemSource).toContain('return toBusinessItem(item)');
    expect(formSource).toContain('itemFormInstance?.getItems?.()');
  });

  it('summarizes and formats the visible page reliably', () => {
    expect(
      getOtherIncomePageSummary([
        { totalAmount: 1200.5 },
        { totalAmount: 99.5 },
      ]),
    ).toEqual({ documentCount: 2, totalAmount: '1300' });
    expect(formatOtherIncomeAmount(1_234_567.8)).toBe('1,234,567.80');
  });

  it('shows audit information only for approved rows', () => {
    expect(
      normalizeOtherIncomeListRow({
        status: 20,
        updaterName: '审核员',
        updateTime: '2026-07-20 10:00:00',
      }),
    ).toMatchObject({
      auditorName: '审核员',
      auditTime: '2026-07-20 10:00:00',
    });
    expect(
      normalizeOtherIncomeListRow({
        status: 20,
        updaterName: '后续修改人',
        updateTime: '2026-07-21 11:00:00',
        approveTime: '2026-07-20 10:00:00',
      }),
    ).toMatchObject({
      auditTime: '2026-07-20 10:00:00',
    });
    expect(
      normalizeOtherIncomeListRow({
        status: 10,
        updaterName: '制单员',
        updateTime: '2026-07-20 09:00:00',
      }),
    ).toMatchObject({ auditorName: undefined, auditTime: undefined });
  });

  it('normalizes business time for grid display and date picker hydration', () => {
    expect(normalizeOtherIncomeBizTime('1784678400000')).toBe(
      1_784_678_400_000,
    );
    expect(normalizeOtherIncomeBizTimeForPicker('1784678400000')).toBe(
      '1784678400000',
    );
    expect(
      normalizeOtherIncomeListRow({ bizTime: '1784678400000' }).bizTime,
    ).toBe(1_784_678_400_000);
    expect(normalizeOtherIncomeBizTime(undefined)).toBeUndefined();
    expect(
      normalizeOtherIncomeItemBizDateForPicker([2026, 10, 16, 11, 22, 33]),
    ).toBe('2026-10-16 11:22:33');
    expect(normalizeOtherIncomeItemBizDateForPicker('1784678400000')).toMatch(
      /^2026-07-2[12] \d{2}:00:00$/,
    );
    expect(normalizeOtherIncomeItemBizDateForPicker(undefined)).toBeUndefined();
    expect(itemSource).toContain(
      'normalizeOtherIncomeItemBizDateForPicker(item.bizDate)',
    );
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
      'incomeType',
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
      '收入类型',
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
      '其他收入作为其他经营收支第一阶段展示入口',
    );
    expect(indexSource).not.toContain(
      '正式其他经营收支需要排除销售、采购、普通费用和盘点损益',
    );
    expect(indexSource).not.toContain('往来本金收付不直接当作经营收益');
    expect(indexSource).not.toContain('<Alert');
    expect(indexSource).toContain(
      "import { message, Tag } from 'ant-design-vue'",
    );
  });

  it('uses a fullscreen four-column document layout with explicit load exits', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain('xl:grid-cols-4');
    expect(formSource).toContain("layout: 'horizontal'");
    expect(formSource).toContain('const detailLoading = ref(false)');
    expect(formSource).toContain("const detailLoadError = ref('')");
    expect(formSource).toContain(
      "detailLoadError.value = '其他收入详情加载失败，请关闭后重试'",
    );
    expect(formSource).toContain('v-if="detailLoading"');
    expect(formSource).toContain('v-else-if="detailLoadError"');
    expect(formSource).toContain('sequence !== detailLoadSequence');
    expect(formSource).toContain('await nextTick()');
    expect(formSource).toContain('normalizeOtherIncomeBizTimeForPicker');
    expect(formSource).toContain('normalizeOtherIncomeFormData(');
  });

  it('aligns document form fields and keeps detail mode read-only', () => {
    const createSchema = useFormSchema('create') || [];
    const detailSchema = useFormSchema('detail') || [];

    expect(
      createSchema
        .filter((field) => field.fieldName !== 'id')
        .map((field) => field.label),
    ).toEqual([
      '日期',
      '单号',
      '状态',
      '结算方式',
      '结算账户',
      '凭证号',
      '总金额',
      '开单部门',
      '经手人',
      '收入类型',
      '对象',
      '相关业务',
      '单据类型',
      '附件',
      '备注',
    ]);
    expect(
      getComponentProps(createSchema.find((field) => field.fieldName === 'no'))
        .disabled,
    ).toBe(true);
    expect(
      getComponentProps(
        createSchema.find((field) => field.fieldName === 'status'),
      ).disabled,
    ).toBe(true);
    expect(
      getComponentProps(
        createSchema.find((field) => field.fieldName === 'totalAmount'),
      ).disabled,
    ).toBe(true);
    expect(
      createSchema.find((field) => field.fieldName === 'settleMethod')
        ?.component,
    ).toBe('ApiSelect');
    expect(
      createSchema.find((field) => field.fieldName === 'incomeType')?.component,
    ).toBe('ApiSelect');
    expect(
      createSchema.find((field) => field.fieldName === 'docType')?.component,
    ).toBe('ApiSelect');
    expect(
      getComponentProps(
        createSchema.find((field) => field.fieldName === 'settleMethod'),
      ).disabled,
    ).toBe(false);
    expect(
      createSchema.find((field) => field.fieldName === 'deptId')?.rules,
    ).toBe('required');
    expect(
      getComponentProps(
        createSchema.find((field) => field.fieldName === 'party'),
      ).disabled,
    ).toBe(true);
    expect(
      detailSchema
        .filter((field) => field.fieldName !== 'id')
        .every((field) => getComponentProps(field).disabled === true),
    ).toBe(true);
  });

  it('applies the compact main-form typography to every field state', () => {
    expect(formSource).toContain('--other-income-main-font-size: 12px');
    expect(formSource).toContain('.other-income-basic-grid > div > label');
    expect(formSource).toContain(
      '.other-income-document-basic-form .ant-input-number-input',
    );
    expect(formSource).toContain(
      '.other-income-document-basic-form .ant-select-selection-placeholder',
    );
    expect(formSource).toContain(
      '.other-income-document-basic-form .ant-form-item-explain',
    );
    expect(formSource).toContain(
      '.other-income-document-basic-form .ant-upload-list-item',
    );
  });

  it('keeps converted detail text fields at the same 32px control height', () => {
    expect(formSource).toMatch(
      /\.finance-document-form-readonly-text\.ant-input-affix-wrapper[\s\S]*?height: 32px !important;[\s\S]*?min-height: 32px !important;/,
    );
    expect(formSource).toMatch(
      /\.finance-document-form-readonly-text\.ant-input-affix-wrapper[\s\S]*?> input\.ant-input[\s\S]*?height: 22px !important;[\s\S]*?min-height: 0;/,
    );
  });

  it('keeps detail rows mounted for safe hydration and preserves section order', () => {
    expect(formSource).toContain('v-show="!detailLoading && !detailLoadError"');
    expect(formSource).toContain(':items="formData.items ?? []"');
    expect(formSource).toContain('function handleAddItem()');
    expect(formSource).toContain(
      'class="other-income-document-section__actions"',
    );
    expect(formSource).toContain('@click="handleAddItem"');
    expect(itemSource).toContain('defineExpose({');
    expect(itemSource).toContain('focusFirstAmountInput');
    expect(itemSource).toContain('focusRowAmountInput');
    expect(itemSource).not.toContain('other-income-item-form__header');
    expect(itemSource).not.toContain('other-income-item-form__title');
    expect(formSource).toContain('handleSubmitDraftFromDetail');
    expect(formSource).toContain('handleEditFromDetail');
    expect(formSource).toContain('v-if="canSubmitDraftFromDetail"');
    expect(formSource).toContain('v-if="canEditFromDetail"');
    expect(formSource).not.toContain('handleEditRemark');
    expect(formSource).not.toContain("emit('audit', formData)");

    const basicIndex = formSource.indexOf('基本信息');
    const itemIndex = formSource.indexOf('收入明细', basicIndex + 1);
    const summaryIndex = formSource.indexOf(
      '<ErpDocumentSummaryBar',
      itemIndex + 1,
    );
    const auditIndex = formSource.indexOf('审计信息', summaryIndex + 1);
    expect(basicIndex).toBeGreaterThan(-1);
    expect(itemIndex).toBeGreaterThan(basicIndex);
    expect(summaryIndex).toBeGreaterThan(itemIndex);
    expect(auditIndex).toBeGreaterThan(summaryIndex);
    expect(formSource.slice(itemIndex, summaryIndex)).not.toContain(
      '</section>',
    );
    expect(formSource).not.toContain('other-income-document-summary');
  });

  it('refreshes explicitly after create, import, audit, and delete', () => {
    expect(indexSource).toContain('async function handleRefresh(');
    expect(indexSource).toContain("commitProxy('page', { currentPage: 1 })");
    expect(indexSource).toContain('await gridApi.query()');
    expect(indexSource).toContain('@success="handleRefresh(true)"');
    expect(indexSource).toContain('@success="handleImportSuccess"');
    expect(indexSource).toContain('@printed="handleRefresh"');
    expect(indexSource).toContain('await handleRefresh();');

    const emitIndex = formSource.indexOf("emit('success')");
    const closeIndex = formSource.indexOf('await modalApi.close()', emitIndex);
    expect(emitIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(emitIndex);
  });

  it('keeps item operations available and enables local three-state sorting', () => {
    const columns = useFormItemColumns(false) || [];
    const sequence = columns.find((column) => column.type === 'seq');
    const actions = columns.find((column) => column.title === '操作');

    expect(columns.map((column) => column.field || column.type)).toEqual([
      'seq',
      'itemName',
      'qty',
      'amount',
      'deptId',
      'handlerId',
      'invoiceNo',
      'customerId',
      'freightType',
      'fileUrl',
      'bizDate',
      'remark',
      'actions',
    ]);
    expect(columns.map((column) => column.title)).toEqual([
      '序号',
      '项目名称',
      '单据数量',
      '金额',
      '部门',
      '业务员',
      '发票号',
      '对象',
      '运费类型',
      '附件',
      '发生日期',
      '备注',
      '操作',
    ]);
    expect(sequence?.fixed).toBeUndefined();
    expect(actions?.field).toBe('actions');
    expect(columns.find((column) => column.field === 'qty')?.align).toBe(
      'right',
    );
    expect(columns.find((column) => column.field === 'qty')?.headerAlign).toBe(
      'center',
    );
    expect(columns.find((column) => column.field === 'amount')?.align).toBe(
      'right',
    );
    expect(
      columns.find((column) => column.field === 'amount')?.headerAlign,
    ).toBe('center');
    expect(actions?.fixed).toBe('right');
    expect(actions?.visible).toBe(true);
    expect((useFormItemColumns(true) || []).at(-1)?.visible).toBe(false);
    expect(itemSource).toContain("orders: ['asc', 'desc', null]");
    expect(itemSource).toContain('sortOtherIncomeItems(');
    expect(itemSource).toContain('trailingFlexibleColumnMinWidth: 150');
    expect(itemSource).toContain('applyFinanceDocumentItemColumnCustomization');
    expect(itemSource).toContain('fit: false');
    expect(itemSource).toContain('fitFinanceDocumentItemColumnsToWidth');
    expect(itemSource).toContain('queryMethod: () => refreshItemGrid()');
    expect(itemSource).toContain('zoom: true');
    expect(itemSource).toContain('<template #toolbar-tools>');
    expect(itemSource).toContain(
      "id: 'erp-finance-receivable-other-income-item-list-v2'",
    );
    expect(indexSource).toContain('fit: false');
    expect(indexSource).toContain(
      'applyFinanceDocumentListColumnCustomization',
    );
    expect(itemSource).toContain(
      "const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200']",
    );
    expect(itemSource).toContain('height: ITEM_TABLE_HEIGHT');
    expect(itemSource).toContain('class="other-income-item-form__pager"');
    expect(itemSource).toContain(
      `candidatePopupClass('other-income-item-select-dropdown')`,
    );
    expect(itemSource).toContain('<CustomerLazySelect');
    expect(itemSource).not.toContain('getCustomerSimpleList()');
    expect(itemSource).toContain(
      'getBaseDataSimpleList(OTHER_INCOME_ITEM_PROJECT)',
    );
    expect(itemSource).toContain('v-model:value="row.customerId"');
    expect(itemSource).toContain(
      "import { FileUpload } from '#/components/upload'",
    );
    expect(itemSource).toContain('<FileUpload');
    expect(itemSource).toContain('.ant-picker-input > input');
    expect(itemSource).toContain('.ant-select-selection-item');
    expect(itemSource).toMatch(
      /\.ant-select-single \.ant-select-selector\)[\s\S]*?height: 28px !important;[\s\S]*?min-height: 28px !important;/,
    );
    expect(itemSource).toContain(
      'popup-class-name="other-income-item-date-picker-dropdown"',
    );
    expect(indexSource).toContain("getBaseDataSimpleList('settle_method')");
    expect(indexSource).toContain('getBaseDataSimpleList(OTHER_INCOME_TYPE)');
    expect(indexSource).toContain(
      'getBaseDataSimpleList(OTHER_INCOME_DOC_TYPE)',
    );
  });

  it('uses the final remark as the adaptive detail column', () => {
    const columns = useFormItemColumns(false, [], {
      rows: [{ bizDate: '2026-10-21 08:30:00', remark: '较长的收入备注' }],
      trailingFlexibleColumnMinWidth: 150,
    }) as any[];
    const remark = columns.find((column) => column.field === 'remark');
    const actions = columns.find((column) => column.field === 'actions');

    expect(columns.at(-2)?.field).toBe('remark');
    expect(remark).not.toHaveProperty('width');
    expect(remark?.minWidth).toBeGreaterThanOrEqual(150);
    expect(actions?.fixed).toBe('right');

    const columnsWithoutRemark = useFormItemColumns(false, ['item_remark'], {
      trailingFlexibleColumnMinWidth: 150,
    }) as any[];
    const bizDate = columnsWithoutRemark.find(
      (column) => column.field === 'bizDate',
    );
    expect(bizDate).not.toHaveProperty('width');
    expect(bizDate?.minWidth).toBeGreaterThanOrEqual(150);
  });

  it('preserves existing action permission codes', () => {
    for (const permission of [
      'erp:receivable-other-income:create',
      'erp:receivable-other-income:import',
      'erp:receivable-other-income:export',
      'erp:receivable-other-income:update',
      'erp:receivable-other-income:update-status',
      'erp:receivable-other-income:delete',
    ]) {
      expect(indexSource).toContain(permission);
    }
    expect(formSource).toContain('erp:receivable-other-income:update-status');
    expect(indexSource).not.toContain('const rowActionColumnFields');
    expect(indexSource).not.toMatch(/cellClick:\s*\(/);
    expect(indexSource).toContain('@click.stop="handleDetail(row)"');
    expect(indexSource).toContain('ifShow: () => checkedRows.length > 0');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toContain('message.success(`已删除 ');
    expect(indexSource).toContain('条，已跳过 ');
    expect(indexSource).toContain('skippedCount} 条`');
    expect(indexSource).toContain('<template #deleteAction="{ row }">');
    expect(indexSource).toContain('<template #printAction="{ row }">');
    expect(indexSource).toContain(
      "auth: ['erp:receivable-other-income:print']",
    );
    expect(indexSource).toContain(
      "auth: ['erp:receivable-other-income:print-template']",
    );
    expect(indexSource).toContain('onClick: handlePrint.bind(null, row)');
  });

  it('wires other income into the shared print-template flow', () => {
    expect(indexSource).toContain('import PrintTemplateModal');
    expect(indexSource).toContain('import PrintTemplateSelector');
    expect(indexSource).toContain('useErpPrintTemplate');
    expect(indexSource).toContain(
      "const PRINT_TEMPLATE_MODULE = 'receivable_other_income'",
    );
    expect(indexSource).toContain('PrintTemplateDesignModal');
    expect(indexSource).toContain('handleOpenPrintTemplateDesigner');
    expect(indexSource).toContain("moduleName: '其他收入'");
    expect(indexSource).toContain('openModal: openOtherIncomePrintModal');
    expect(indexSource).not.toContain('打印模板配置中');
  });
});
