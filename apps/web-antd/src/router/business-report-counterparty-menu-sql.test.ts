import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../');
const sqlSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_counterparty_pages_20260923.sql',
  ),
  'utf8',
);

describe('business report M5 counterparty page menu SQL', () => {
  it('adds counterparty report pages under the unified business report module', () => {
    expect(sqlSource).toContain('销售采购往来及对账');
    for (const page of [
      '客户应收对账',
      '供应商应付对账',
      '往来余额汇总',
      '应收账龄分析',
      '应付账龄分析',
      '核销明细查询',
      '收付款核销追踪',
      '对账差异记录',
      '历史往来口径',
    ]) {
      expect(sqlSource).toContain(page);
    }
    expect(sqlSource).toContain('erp/report/counterparty/index');
    expect(sqlSource).toContain(
      'ErpBusinessReportCounterpartyCustomerReceivable',
    );
    expect(sqlSource).toContain(
      'ErpBusinessReportCounterpartyReconciliationDifference',
    );
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

  it('points the counterparty pages to an existing frontend component', () => {
    expect(
      existsSync(
        join(
          workspaceRoot,
          'ui/apps/web-antd/src/views/erp/report/counterparty/index.vue',
        ),
      ),
    ).toBe(true);
  });
});
