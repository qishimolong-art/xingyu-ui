import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../');
const sqlSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_fixed_asset_pages_20260924.sql',
  ),
  'utf8',
);

describe('business report fixed asset pages SQL', () => {
  it('adds the independent M11 fixed asset report pages under business reports', () => {
    expect(sqlSource).toContain('固定资产及折旧');
    expect(sqlSource).toContain('固定资产卡片台账');
    expect(sqlSource).toContain('固定资产折旧明细');
    expect(sqlSource).toContain('部门资产汇总');
    expect(sqlSource).toContain('资产变更记录');
    expect(sqlSource).toContain('资产处置记录');
    expect(sqlSource).toContain('历史固定资产口径');
    expect(sqlSource).toContain('asset-card');
    expect(sqlSource).toContain('depreciation-detail');
    expect(sqlSource).toContain('department-summary');
    expect(sqlSource).toContain('transfer-record');
    expect(sqlSource).toContain('disposal-record');
    expect(sqlSource).toContain('erp/report/fixed-asset/index');
  });

  it('is repeatable menu SQL without business table, role, tenant, or accounting switch writes', () => {
    expect(sqlSource).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(sqlSource).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sqlSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(sqlSource).not.toContain('system_role_menu');
    expect(sqlSource).not.toContain('system_tenant_package');
    expect(sqlSource).not.toMatch(/dual[-_]?cost/i);
    expect(sqlSource).not.toMatch(/erp_stock_record_cursor/i);
  });

  it('points every page to an existing frontend component', () => {
    expect(
      existsSync(
        join(
          workspaceRoot,
          'ui/apps/web-antd/src/views/erp/report/fixed-asset/index.vue',
        ),
      ),
    ).toBe(true);
  });
});
