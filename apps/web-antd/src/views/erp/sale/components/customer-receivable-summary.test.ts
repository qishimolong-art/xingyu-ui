import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(
  join(currentDir, 'CustomerReceivableSummary.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/finance/receivable/account/index.ts'),
  'utf8',
);

describe('customer receivable summary', () => {
  it('shows independent other receivable amount from the account summary API', () => {
    expect(apiSource).toContain('miscReceivableAmount?: number');
    expect(componentSource).toContain("label: '其他应收'");
    expect(componentSource).toContain('summary.value?.miscReceivableAmount');
    expect(componentSource).toContain("label: '应收余额'");
    expect(componentSource).toContain('summary.value?.unreceivedAmount');
    expect(componentSource).toContain('summary.lastBizTime');
  });
});
