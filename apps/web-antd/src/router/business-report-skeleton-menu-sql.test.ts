import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../');
const sqlSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_extension_11_12_20260916.sql',
  ),
  'utf8',
);

const overviewSqlSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_overview_20260922.sql',
  ),
  'utf8',
);

describe('business report skeleton menu SQL', () => {
  it('adds only the two first-stage skeleton page menus without query buttons', () => {
    expect(sqlSource).toContain('erp/report/fixed-asset/index');
    expect(sqlSource).toContain('ErpReportFixedAsset');
    expect(sqlSource).toContain('erp/report/audit-trace-performance/index');
    expect(sqlSource).toContain('ErpReportAuditTracePerformance');
    expect(sqlSource).toContain(
      '不迁移旧菜单、不授予角色/套餐、不创建按钮权限',
    );
    expect(sqlSource).not.toContain('erp:business-report:fixed-asset:query');
    expect(sqlSource).not.toContain(
      'erp:business-report:audit-trace-performance:query',
    );
  });

  it('keeps the migration repeatable without role, tenant package, or destructive business writes', () => {
    expect(sqlSource).not.toMatch(/\bDELETE\b/i);
    expect(sqlSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(sqlSource).not.toContain('system_role_menu');
    expect(sqlSource).not.toContain('system_tenant_package');
    expect(sqlSource).not.toMatch(/\bsuper_admin\b/i);
    expect(sqlSource).not.toMatch(/erp_reporting_dual_cost_enabled/i);
  });

  it('points to frontend components that exist in the workspace', () => {
    expect(
      existsSync(
        join(
          workspaceRoot,
          'ui/apps/web-antd/src/views/erp/report/fixed-asset/index.vue',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          workspaceRoot,
          'ui/apps/web-antd/src/views/erp/report/audit-trace-performance/index.vue',
        ),
      ),
    ).toBe(true);
  });
  it('adds the M0 overview menu only as a repeatable page entry', () => {
    expect(overviewSqlSource).toContain('erp/report/overview/index');
    expect(overviewSqlSource).toContain('ErpReportOverview');
    expect(overviewSqlSource).toContain('经营报表总览');
    expect(overviewSqlSource).toContain(
      '不授予角色/套餐、不创建按钮权限、不改业务表',
    );
    expect(overviewSqlSource).not.toMatch(/\bDELETE\b/i);
    expect(overviewSqlSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(overviewSqlSource).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(overviewSqlSource).not.toContain('system_role_menu');
    expect(overviewSqlSource).not.toContain('system_tenant_package');
    expect(overviewSqlSource).not.toMatch(/erp_reporting_dual_cost_enabled/i);
  });

  it('points the M0 overview SQL to an existing frontend component', () => {
    expect(
      existsSync(
        join(
          workspaceRoot,
          'ui/apps/web-antd/src/views/erp/report/overview/index.vue',
        ),
      ),
    ).toBe(true);
  });
});
