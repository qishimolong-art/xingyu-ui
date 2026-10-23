import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../../../');
const wrapperSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const sourcePage = readFileSync(
  join(currentDir, '../../finance/receivable/account/index.vue'),
  'utf8',
);
const detailSource = readFileSync(
  join(
    currentDir,
    '../../finance/receivable/account/modules/detail-drawer.vue',
  ),
  'utf8',
);
const migrationSource = readFileSync(
  join(
    workspaceRoot,
    '../code/sql/mysql/erp_receivable_account_report_entry_v268.sql',
  ),
  'utf8',
);

describe('应收账款报表复制入口', () => {
  it('使用独立路由组件复用应收账款页面并启用报表只读模式', () => {
    expect(wrapperSource).toContain(
      "import ReceivableAccountPage from '../../finance/receivable/account/index.vue'",
    );
    expect(wrapperSource).toContain(
      "defineOptions({ name: 'ErpReceivableAccountReport' })",
    );
    expect(wrapperSource).toContain('provideReportViewOnly();');
    expect(wrapperSource).toContain(
      '<ReceivableAccountPage :candidate-focus-highlight="false" report-mode />',
    );
    expect(sourcePage).toContain('reportMode?: boolean');
    expect(sourcePage).toContain(':readonly="props.reportMode"');
    expect(sourcePage).toContain(':report-mode="props.reportMode"');
  });

  it('报表只读模式保留原单详情和导出但屏蔽核销', () => {
    expect(detailSource).toContain('reportMode?: boolean');
    expect(detailSource).toContain('!props.readonly || props.reportMode');
    expect(detailSource).toContain('v-if="!readonly || reportMode"');
    expect(detailSource).toContain('if (props.readonly) return;');
    expect(detailSource).toContain('!props.readonly && props.customerId');
    expect(detailSource).toContain(
      'v-if="!readonly && isReceiptDetailRow(row)"',
    );
    expect(detailSource).toContain('v-if="!readonly"');
    expect(detailSource).toContain('exportReceivableDrilldown');
  });

  it('新增应收报表入口且保留原查询权限和资金管理页面', () => {
    expect(migrationSource).toContain("path='receivable-detail'");
    expect(migrationSource).toContain("'receivable-account'");
    expect(migrationSource).toContain("'erp/report/receivable-account/index'");
    expect(migrationSource).toContain("'ErpReceivableAccountReport'");
    expect(migrationSource).toContain("'erp:receivable-account:query'");
    expect(migrationSource).toContain(
      "component='erp/finance/receivable/account/index'",
    );
    expect(migrationSource).not.toMatch(/\bDELETE\b/i);
    expect(migrationSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(migrationSource).not.toMatch(/\bALTER\s+TABLE\b/i);
  });
});
