import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const importFormSource = readFileSync(
  join(currentDir, 'modules/import-form.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/customer/index.ts'),
  'utf8',
);

describe('customer import form contract', () => {
  it('shows import create and update result details', () => {
    expect(importFormSource).toContain('系统会根据客户编码执行新增或更新');
    expect(importFormSource).toContain('支持导入时分配部门');
    expect(importFormSource).toContain('当前用户有权限的部门名称');
    expect(importFormSource).toContain('已有客户填写部门会覆盖原部门分配');
    expect(importFormSource).toContain('空白字段不会覆盖原有资料');
    expect(importFormSource).toContain('importResult.successCount');
    expect(importFormSource).toContain('importResult.createCount');
    expect(importFormSource).toContain('importResult.updateCount');
    expect(importFormSource).toContain('importResult.failureCount');
    expect(importFormSource).toContain('failureDetails');
    expect(importFormSource).toContain(
      "{{ importResult ? '关闭' : '开始导入' }}",
    );
  });

  it('uses the typed upload result api', () => {
    expect(apiSource).toContain('export interface CustomerImportResult');
    expect(apiSource).toContain(
      'requestClient.upload<ErpCustomerApi.CustomerImportResult>',
    );
  });
});
