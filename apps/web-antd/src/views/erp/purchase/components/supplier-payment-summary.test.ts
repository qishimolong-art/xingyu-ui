import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(
  join(currentDir, 'SupplierPaymentSummary.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/finance/payable/account/index.ts'),
  'utf8',
);

describe('supplier payment summary', () => {
  it('shows independent other payable amount from the account summary API', () => {
    expect(apiSource).toContain('miscPayableAmount?: number');
    expect(componentSource).toContain("label: '其他应付'");
    expect(componentSource).toContain('summary.value?.miscPayableAmount');
    expect(componentSource).toContain("label: '待付金额'");
    expect(componentSource).toContain('summary.value?.balance');
    expect(componentSource).toContain('summary.lastBizTime');
  });
});
