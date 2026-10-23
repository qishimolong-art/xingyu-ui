import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../');
const sqlSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_extension_07_08_10_20260916.sql',
  ),
  'utf8',
);
const preflightSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_preflight_20260916.sql',
  ),
  'utf8',
);

const components = [
  'erp/report/account-fund/index',
  'erp/report/expense-income/index',
  'erp/report/financial-statement/index',
];

const allBusinessReportComponents = [
  'erp/sale/report/index',
  'erp/purchase/report/index',
  'erp/stock/report/index',
  'erp/stock/record/index',
  'erp/stock/transfer-ledger/index',
  'erp/finance/receivable/report/index',
  'erp/finance/payable/report/index',
  'erp/report/system/index',
  'erp/report/account-fund/index',
  'erp/report/expense-income/index',
  'erp/report/financial-statement/index',
  'erp/report/fixed-asset/index',
  'erp/report/audit-trace-performance/index',
  'erp/report/financial/report-template/index',
  'erp/report/financial/balance-sheet/index',
  'erp/report/financial/income-statement/index',
  'erp/report/financial/cash-flow/index',
];

describe('business report stage1 07/08/10 menu SQL', () => {
  it('adds only three first-stage hub menus without query buttons', () => {
    for (const component of components) {
      expect(sqlSource).toContain(component);
      expect(preflightSource).toContain(component);
    }
    expect(sqlSource).toContain('账户资金及总部归集');
    expect(sqlSource).toContain('费用分摊及经营收支');
    expect(sqlSource).toContain('发票凭证及财务报表');
    expect(sqlSource).toContain(
      '不迁移旧菜单、不授予角色/套餐、不创建按钮权限',
    );
    expect(sqlSource).not.toMatch(
      /erp:business-report:(account|fund|expense|financial)/i,
    );
  });

  it('keeps the migration repeatable without role, tenant package, or destructive business writes', () => {
    expect(sqlSource).not.toMatch(/\bDELETE\b/i);
    expect(sqlSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(sqlSource).not.toContain('system_role_menu');
    expect(sqlSource).not.toContain('system_tenant_package');
    expect(sqlSource).not.toMatch(/\bsuper_admin\b/i);
    expect(sqlSource).not.toMatch(/dual-cost-enabled/i);
  });

  it('points to frontend hub components that exist in the workspace', () => {
    for (const folder of [
      'account-fund',
      'expense-income',
      'financial-statement',
    ]) {
      expect(
        existsSync(
          join(
            workspaceRoot,
            `ui/apps/web-antd/src/views/erp/report/${folder}/index.vue`,
          ),
        ),
      ).toBe(true);
    }
  });

  it('preflight covers every current business report frontend entry', () => {
    for (const component of allBusinessReportComponents) {
      expect(preflightSource).toContain(component);
      expect(
        existsSync(
          join(workspaceRoot, `ui/apps/web-antd/src/views/${component}.vue`),
        ),
      ).toBe(true);
    }
  });
});
