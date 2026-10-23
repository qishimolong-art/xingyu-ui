import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../');
const sqlPath = join(
  workspaceRoot,
  'code/sql/mysql/erp_business_report_profit_pages_20260924.sql',
);
const sqlSource = readFileSync(sqlPath, 'utf8');

const pageNames = [
  '部门利润汇总',
  '公司经营利润汇总',
  '内部收入成本抵销',
  '未实现内部利润明细',
  '已实现内部利润调整',
  '经营驾驶舱',
  '指标下钻明细',
  '历史利润口径',
];

const pagePaths = [
  'department-profit',
  'company-profit',
  'internal-offset',
  'unrealized-profit',
  'realized-profit',
  'cockpit',
  'metric-drilldown',
  'history',
];

describe('business report M9 profit dashboard menu SQL', () => {
  it('adds independent profit dashboard pages under the unified business report menu', () => {
    expect(sqlSource).toContain('部门利润及驾驶舱');
    expect(sqlSource).toContain('erp/report/profit-dashboard/index');
    for (const name of pageNames) {
      expect(sqlSource).toContain(name);
    }
    for (const path of pagePaths) {
      expect(sqlSource).toContain(`'${path}'`);
    }
  });

  it('keeps the migration repeatable without role, tenant package, business table, or dual-cost writes', () => {
    expect(sqlSource).not.toMatch(/\bDELETE\b/i);
    expect(sqlSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(sqlSource).not.toContain('system_role_menu');
    expect(sqlSource).not.toContain('system_tenant_package');
    expect(sqlSource).not.toMatch(/dual-cost-enabled/i);
    expect(sqlSource).not.toMatch(/erp_stock_record_cursor/i);
    expect(sqlSource).not.toMatch(/ALTER\s+TABLE\s+erp_/i);
    expect(sqlSource).toContain('GET_LOCK');
    expect(sqlSource).toContain('START TRANSACTION');
    expect(sqlSource).toContain('ROLLBACK');
  });

  it('points to a frontend component that exists in the workspace', () => {
    expect(
      existsSync(
        join(
          workspaceRoot,
          'ui/apps/web-antd/src/views/erp/report/profit-dashboard/index.vue',
        ),
      ),
    ).toBe(true);
  });
});
