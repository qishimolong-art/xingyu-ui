import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    'api',
    'erp',
    'config',
    'auto-write-off.ts',
  ),
  'utf8',
);

describe('ERP auto write-off config page contract', () => {
  it('loads enabled departments and saves disabled auto write-off departments', () => {
    expect(pageSource).toContain(
      "defineOptions({ name: 'ErpAutoWriteOffConfig' })",
    );
    expect(pageSource).toContain('自动核销配置');
    expect(pageSource).toContain(
      '选择的部门及其下级部门不会在收/付款审批后自动核销',
    );
    expect(pageSource).toContain(
      '未选择所属部门的收款单、付款单默认不会自动核销',
    );
    expect(pageSource).toContain('getSimpleDeptList()');
    expect(pageSource).toContain('filterEnabledDepartments');
    expect(pageSource).toContain('TreeSelect');
    expect(pageSource).toContain('tree-checkable');
    expect(pageSource).toContain('getAutoWriteOffConfig()');
    expect(pageSource).toContain('updateAutoWriteOffConfig');
    expect(pageSource).toContain("['erp:auto-write-off-config:update']");
  });

  it('keeps the API shape aligned with the backend endpoints', () => {
    expect(apiSource).toContain('/erp/auto-write-off-config/get');
    expect(apiSource).toContain('/erp/auto-write-off-config/update');
    expect(apiSource).toContain('disabledDeptIds: number[]');
    expect(apiSource).toContain('effectiveDisabledDeptIds: number[]');
    expect(apiSource).toContain("'Content-Type': 'application/json'");
  });
});
