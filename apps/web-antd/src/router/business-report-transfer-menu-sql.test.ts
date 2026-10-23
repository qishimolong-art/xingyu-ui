import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../');
const sqlSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_transfer_pages_20260923.sql',
  ),
  'utf8',
);

describe('business report M4 transfer page menu SQL', () => {
  it('adds transfer report pages under the unified business report module', () => {
    expect(sqlSource).toContain('调拨移仓及在途');
    for (const page of [
      '调拨出入库台账',
      '调拨在途明细',
      '移仓流水明细',
      '调拨差价分析',
      '调拨链路追踪',
      '历史调拨口径',
    ]) {
      expect(sqlSource).toContain(page);
    }
    expect(sqlSource).toContain('erp/report/transfer/index');
    expect(sqlSource).toContain('ErpBusinessReportTransferLedger');
    expect(sqlSource).toContain('ErpBusinessReportTransferInTransit');
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

  it('hides the legacy migrated business-report transfer page to avoid duplicate customer entries', () => {
    expect(sqlSource).toContain(
      "component = 'erp/stock/transfer-ledger/index'",
    );
    expect(sqlSource).toContain("path = '/erp/stock/transfer-ledger'");
    expect(sqlSource).toContain("visible = b'0'");
  });

  it('points the transfer pages to an existing frontend component', () => {
    expect(
      existsSync(
        join(
          workspaceRoot,
          'ui/apps/web-antd/src/views/erp/report/transfer/index.vue',
        ),
      ),
    ).toBe(true);
  });
});
