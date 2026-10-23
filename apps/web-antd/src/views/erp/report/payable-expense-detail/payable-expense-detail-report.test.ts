import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../../../');
const pageSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    'api',
    'erp',
    'report',
    'payable-expense-detail',
    'index.ts',
  ),
  'utf8',
);
const expenseFormSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    'finance',
    'payable',
    'expense',
    'modules',
    'form.vue',
  ),
  'utf8',
);
const expenseListSource = readFileSync(
  join(currentDir, '..', '..', 'finance', 'payable', 'expense', 'index.vue'),
  'utf8',
);
const relocationSqlSource = readFileSync(
  join(
    workspaceRoot,
    '../code/sql/mysql/erp_payable_expense_report_relocation_v265.sql',
  ),
  'utf8',
);

describe('费用支付查询报表', () => {
  it('按确认顺序展示 15 列且三个保留列固定为空', () => {
    const columns = [
      '审批日期',
      '结算账户',
      '单号',
      '费用项目名称',
      '金额',
      '凭证号',
      '摘要',
      '经办人',
      '对象',
      '类型',
      '开单部门',
      '部门',
      '业务员',
      '发票',
      '发生日期',
    ];
    let previous = -1;
    for (const column of columns) {
      const current = pageSource.indexOf(`title: '${column}'`);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(pageSource.match(/formatter: emptyFormatter/g)).toHaveLength(3);
    expect(pageSource).not.toContain('门店');
    expect(pageSource).not.toContain('配送线路');
    expect(pageSource).not.toContain('客户线路');
  });

  it('默认本月并使用分页懒加载筛选器与 10/20/50 分页', () => {
    expect(pageSource).toContain("dayjs().startOf('month')");
    expect(pageSource).toContain("dayjs().endOf('month')");
    expect(pageSource).toContain("component: 'ErpLazyPageSelect'");
    expect(pageSource).toContain('getAccountSimplePage');
    expect(pageSource).toContain('getPayableExpenseDeptSimplePage');
    expect(pageSource).toContain('getPayableExpenseUserSimplePage');
    expect(pageSource).toContain(
      'pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] }',
    );
  });

  it('使用服务端分页、全条件汇总、白名单远程排序与双重导出权限', () => {
    expect(pageSource).toContain('getPayableExpenseDetailReportPage');
    expect(pageSource).toContain('getPayableExpenseDetailReportSummary');
    expect(pageSource).toContain('sortFieldMap');
    expect(pageSource).toContain('remote: true');
    expect(pageSource).toContain('全条件合计');
    expect(pageSource).toContain('erp:payable-expense-detail-report:export');
    expect(pageSource).toContain('erp:payable-expense:export');
    expect(pageSource).toContain('amountVisible');
    expect(apiSource).toContain('/erp/payable-expense-detail-report/page');
    expect(apiSource).toContain('/erp/payable-expense-detail-report/summary');
    expect(apiSource).toContain(
      '/erp/payable-expense-detail-report/export-excel',
    );
  });

  it('单号打开严格只读详情且不改变普通业务列表详情行为', () => {
    expect(apiSource).toContain('expenseId: number');
    expect(pageSource).toContain("slots: { default: 'documentNo' }");
    expect(pageSource).toContain('<template #documentNo="{ row }">');
    expect(pageSource).toContain('<ReportDocumentLink');
    expect(pageSource).toContain('@open="handleDetail(row)"');
    expect(pageSource).toContain(
      "setData({ type: 'detail', id: row.expenseId, strictReadonly: true })",
    );
    expect(pageSource).toContain('v-if="row.expenseId && row.documentNo"');
    expect(expenseFormSource).toContain('const strictReadonly = ref(false)');
    expect(expenseFormSource).toContain(
      'strictReadonly.value = Boolean(modalData?.strictReadonly)',
    );
    expect(expenseFormSource.match(/!strictReadonly\.value &&/g)).toHaveLength(
      5,
    );
    expect(expenseFormSource).toContain('strictReadonly.value = false');
    expect(expenseListSource).toContain(
      "formModalApi.setData({ type: 'detail', id: row.id }).open()",
    );
    expect(expenseListSource).not.toContain('strictReadonly: true');
  });

  it('将既有费用支付查询菜单幂等归入应付报表且保留原权限', () => {
    expect(relocationSqlSource).toContain("path='payable-detail'");
    expect(relocationSqlSource).toContain("path='payable-expense-detail'");
    expect(relocationSqlSource).toContain(
      'SET parent_id=payable_group_id,sort=target_sort',
    );
    expect(relocationSqlSource).toContain(
      "'erp:payable-expense-detail-report:query'",
    );
    expect(relocationSqlSource).toContain(
      "'erp:payable-expense-detail-report:export'",
    );
    expect(relocationSqlSource).not.toMatch(/\bDELETE\b/i);
    expect(relocationSqlSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(relocationSqlSource).not.toMatch(/\bALTER\s+TABLE\b/i);
  });
});
