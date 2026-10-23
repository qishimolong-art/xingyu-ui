import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../');
const sqlSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_financial_20260916.sql',
  ),
  'utf8',
);

const components = [
  'erp/report/financial/report-template/index',
  'erp/report/financial/balance-sheet/index',
  'erp/report/financial/income-statement/index',
  'erp/report/financial/cash-flow/index',
];

describe('business report financial menu SQL', () => {
  it('adds financial report wrapper menus without query buttons', () => {
    for (const component of components) {
      expect(sqlSource).toContain(component);
    }
    expect(sqlSource).toContain('发票凭证及财务报表');
    expect(sqlSource).toContain(
      '不迁移旧财务菜单、不授予角色/套餐、不创建按钮权限',
    );
    expect(sqlSource).not.toMatch(/erp:business-report:financial/i);
  });

  it('keeps the migration without role, tenant package, or destructive business writes', () => {
    expect(sqlSource).not.toMatch(/\bDELETE\b/i);
    expect(sqlSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(sqlSource).not.toContain('system_role_menu');
    expect(sqlSource).not.toContain('system_tenant_package');
    expect(sqlSource).not.toMatch(/\bsuper_admin\b/i);
    expect(sqlSource).not.toMatch(/dual-cost-enabled/i);
  });

  it('points to frontend wrapper components that exist in the workspace', () => {
    for (const folder of [
      'report-template',
      'balance-sheet',
      'income-statement',
      'cash-flow',
    ]) {
      expect(
        existsSync(
          join(
            workspaceRoot,
            `ui/apps/web-antd/src/views/erp/report/financial/${folder}/index.vue`,
          ),
        ),
      ).toBe(true);
    }
  });
});
