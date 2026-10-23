import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../');
const sqlSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_expense_income_pages_20260923.sql',
  ),
  'utf8',
);

describe('business report M8 expense income page menu SQL', () => {
  it('adds expense income report pages under the unified business report module', () => {
    expect(sqlSource).toContain('费用分摊及经营收支');
    for (const page of [
      '费用支付明细',
      '部门费用汇总',
      '公共费用分摊明细',
      '费用预算及差异分析',
      '其他经营收支明细',
      '历史费用收支口径',
    ]) {
      expect(sqlSource).toContain(page);
    }
    expect(sqlSource).toContain('erp/report/expense-income/index');
    expect(sqlSource).toContain('ErpBusinessReportExpenseIncomeExpenseDetail');
    expect(sqlSource).toContain('ErpBusinessReportExpenseIncomeBudgetVariance');
  });

  it('keeps the migration repeatable without business table, role, tenant package, or accounting switch writes', () => {
    expect(sqlSource).not.toMatch(/\bDELETE\b/i);
    expect(sqlSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(sqlSource).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(sqlSource).not.toContain('system_role_menu');
    expect(sqlSource).not.toContain('system_tenant_package');
    expect(sqlSource).not.toMatch(/super_admin/i);
    expect(sqlSource).not.toMatch(/erp_reporting_dual_cost_enabled/i);
    expect(sqlSource).not.toMatch(/erp_stock_record_cursor/i);
  });

  it('hides the legacy migrated single expense-income page to avoid duplicate customer entries', () => {
    expect(sqlSource).toContain("path = '/erp/report/expense-income'");
    expect(sqlSource).toContain("visible = b'0'");
  });

  it('points the expense income pages to an existing frontend component', () => {
    expect(
      existsSync(
        join(
          workspaceRoot,
          'ui/apps/web-antd/src/views/erp/report/expense-income/index.vue',
        ),
      ),
    ).toBe(true);
  });
});
