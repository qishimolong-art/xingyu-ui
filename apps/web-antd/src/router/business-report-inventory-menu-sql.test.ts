import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../');
const sqlSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_inventory_pages_20260922.sql',
  ),
  'utf8',
);
const renameSqlSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_inventory_check_rename_20261014.sql',
  ),
  'utf8',
);

describe('business report M3 inventory page menu SQL', () => {
  it('adds inventory report pages under the unified business report module', () => {
    expect(sqlSource).toContain('库存及商品追溯');
    for (const page of [
      '实时库存',
      '库存进出流水明细账',
      '收发存汇总',
      '库龄分析',
      '库存周转分析',
      '商品追溯',
      '配件盈亏明细表',
      '历史口径',
    ]) {
      expect(sqlSource).toContain(page);
    }
    expect(sqlSource).toContain('erp/stock/report/index');
    expect(sqlSource).toContain('ErpBusinessReportInventoryRealtime');
    expect(sqlSource).toContain('ErpBusinessReportInventoryTrace');
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

  it('points the inventory pages to an existing frontend component', () => {
    expect(
      existsSync(
        join(
          workspaceRoot,
          'ui/apps/web-antd/src/views/erp/stock/report/index.vue',
        ),
      ),
    ).toBe(true);
  });

  it('仅对唯一 check 页面做幂等更名，不改权限关系', () => {
    expect(renameSqlSource).toContain("path = 'check'");
    expect(renameSqlSource).toContain("name = '配件盈亏明细表'");
    expect(renameSqlSource).toContain(
      "component_name = 'ErpBusinessReportInventoryCheck'",
    );
    expect(renameSqlSource).not.toMatch(/\bDELETE\b/i);
    expect(renameSqlSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(renameSqlSource).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(renameSqlSource).not.toContain('system_role_menu');
    expect(renameSqlSource).not.toContain('system_tenant_package');
  });
});
