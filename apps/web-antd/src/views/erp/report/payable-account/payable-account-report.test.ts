import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../../../');
const wrapperSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const sourcePage = readFileSync(
  join(currentDir, '../../finance/payable/account/index.vue'),
  'utf8',
);
const migrationSource = readFileSync(
  join(
    workspaceRoot,
    '../code/sql/mysql/erp_payable_account_report_entry_v266.sql',
  ),
  'utf8',
);

describe('应付账款报表复制入口', () => {
  it('使用独立路由组件名并完整复用资金管理应付账款页面', () => {
    expect(wrapperSource).toContain(
      "import PayableAccountPage from '../../finance/payable/account/index.vue'",
    );
    expect(wrapperSource).toContain(
      "defineOptions({ name: 'ErpPayableAccountReport' })",
    );
    expect(wrapperSource).toContain(
      '<PayableAccountPage :candidate-focus-highlight="false" />',
    );
    expect(sourcePage).toContain(
      "defineOptions({ name: 'ErpPayableAccount' })",
    );
    expect(sourcePage).toContain('getPayableAccountPage');
    expect(sourcePage).toContain('getPayableAccountSummary');
  });

  it('新增应付报表入口且保留原查询权限和资金管理页面', () => {
    expect(migrationSource).toContain("path='payable-detail'");
    expect(migrationSource).toContain("'payable-account'");
    expect(migrationSource).toContain("'erp/report/payable-account/index'");
    expect(migrationSource).toContain("'ErpPayableAccountReport'");
    expect(migrationSource).toContain("'erp:payable-account:query'");
    expect(migrationSource).toContain(
      "component='erp/finance/payable/account/index'",
    );
    expect(migrationSource).not.toMatch(/\bDELETE\b/i);
    expect(migrationSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(migrationSource).not.toMatch(/\bALTER\s+TABLE\b/i);
  });
});
