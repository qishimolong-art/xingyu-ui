import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const tableSource = readFileSync(
  join(currentDir, 'modules/expense-income-table.vue'),
  'utf8',
);
const readinessSource = readFileSync(
  join(currentDir, 'modules/expense-allocation-readiness.vue'),
  'utf8',
);
const departmentSummarySource = readFileSync(
  join(currentDir, 'modules/department-expense-readiness.vue'),
  'utf8',
);

const customerForbiddenTexts = [
  '第一阶段',
  '只读复用',
  '依赖 SQL',
  '未完成原因',
  '后续接入',
  '待客户确认',
  '双成本开关',
  '库存游标',
  '不提供新增',
  '待数据接入',
];

describe('经营报表费用分摊及经营收支独立页面契约', () => {
  it('splits M8 into independent report pages instead of tabs', () => {
    expect(indexSource).toContain('BusinessReportShell');
    expect(indexSource).toContain(
      "defineOptions({ name: 'ErpReportExpenseIncome' })",
    );
    expect(indexSource).toContain("'expense-detail': '费用支付明细'");
    expect(indexSource).toContain("'department-expense': '部门费用汇总'");
    expect(indexSource).toContain("'expense-allocation': '公共费用分摊明细'");
    expect(indexSource).toContain("'budget-variance': '费用预算及差异分析'");
    expect(indexSource).toContain("'operating-income': '其他经营收支明细'");
    expect(indexSource).toContain("history: '历史费用收支口径'");
    expect(indexSource).toContain('normalizePageKey(currentPath.value)');
    expect(indexSource).toContain("pageKey === 'expense-detail'");
    expect(indexSource).toContain("pageKey === 'operating-income'");
    expect(indexSource).not.toContain('TabPane');
    expect(indexSource).not.toContain('Tabs');
    expect(indexSource).not.toContain('expenseNotices');
    expect(indexSource).not.toContain('expenseStages');
  });

  it('keeps customer-facing M8 pages free of internal implementation notes', () => {
    for (const source of [
      indexSource,
      tableSource,
      readinessSource,
      departmentSummarySource,
    ]) {
      for (const text of customerForbiddenTexts) {
        expect(source).not.toContain(text);
      }
    }
  });

  it('reuses existing expense and other income page APIs without business actions', () => {
    expect(tableSource).toContain('getPayableExpensePage');
    expect(tableSource).toContain('getOtherIncomePage');
    expect(tableSource).toContain('exportPayableExpense');
    expect(tableSource).toContain('exportOtherIncome');
    expect(tableSource).toContain('downloadFileFromBlobPart');
    expect(tableSource).toContain('usePayableExpenseFormSchema');
    expect(tableSource).toContain('useOtherIncomeFormSchema');
    expect(tableSource).toContain('readonlyColumns');
    expect(tableSource).toContain('appendReportReadonlyColumns');
    expect(tableSource).toContain('<template #status="{ row }">');
    expect(tableSource).toContain('statusTag(row.status).label');
    for (const field of ['settleMethod', 'voucherNo', 'docType']) {
      expect(tableSource).toContain(`field: '${field}'`);
    }
    expect(tableSource).toContain(
      'pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] }',
    );
    expect(tableSource).toContain('本页合计');
    expect(tableSource).toContain(
      '<Button size="small" :loading="exportLoading" @click="handleExport">导出</Button>',
    );
    expect(tableSource).not.toContain('当前页参考合计');
    expect(tableSource).not.toContain('summaryNote');
    expect(tableSource).not.toContain('createPayableExpense');
    expect(tableSource).not.toContain('deletePayableExpense');
    expect(tableSource).not.toContain('updatePayableExpenseStatus');
    expect(tableSource).not.toContain('createOtherIncome');
    expect(tableSource).not.toContain('deleteOtherIncome');
    expect(tableSource).not.toContain('updateOtherIncomeStatus');
  });

  it('shows clean report placeholders for department, allocation, and budget pages', () => {
    expect(departmentSummarySource).toContain('部门费用汇总');
    expect(departmentSummarySource).toContain('费用金额');
    expect(departmentSummarySource).toContain('预算金额');
    expect(departmentSummarySource).toContain('差异金额');
    expect(departmentSummarySource).toContain('预算完成率');
    expect(departmentSummarySource).toContain('getPayableExpensePage');
    expect(departmentSummarySource).toContain('downloadFileFromBlobPart');
    expect(departmentSummarySource).toContain('费用单据');
    expect(departmentSummarySource).toContain('暂无部门费用汇总数据');
    expect(departmentSummarySource).toContain('DEFAULT_PAGE_SIZE = 10');
    expect(departmentSummarySource).toContain('@click="handleExport"');

    expect(readinessSource).toContain('公共费用分摊明细');
    expect(indexSource).toContain("'budget-variance': '费用预算及差异分析'");
    expect(readinessSource).toContain('暂无公共费用分摊数据');
    expect(readinessSource).toContain('暂无费用预算差异数据');
    expect(readinessSource).toContain(
      ':pagination="{ pageSize: 10, showSizeChanger: false }"',
    );
    expect(readinessSource).toContain('@click="handleExport"');
    expect(readinessSource).toContain('待规则确认');
    expect(readinessSource).toContain('不可计算');
  });

  it('keeps report pages stretched and scrollable inside the business report shell', () => {
    expect(indexSource).toContain('expense-income-report-page');
    expect(indexSource).toContain('shellScrollable');
    expect(indexSource).toContain('expense-income-report-page__stack');
    expect(tableSource).toContain('.expense-income-report-table');
    expect(tableSource).toContain('height: 100%');
    expect(tableSource).toContain('.expense-income-report-table__grid');
    expect(tableSource).toContain('flex: 1 1 auto');
    expect(readinessSource).toContain('.expense-income-readiness-report');
    expect(readinessSource).toContain('flex: 1 1 auto');
    expect(departmentSummarySource).toContain(
      '.expense-income-readiness-report',
    );
    expect(departmentSummarySource).toContain('flex: 1 1 auto');
  });
});
