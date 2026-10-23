import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readFinanceSource(...segments: string[]) {
  return readFileSync(join(currentDir, ...segments), 'utf8');
}

const itemListPages = [
  ['settlement', 'receipt', 'index.vue'],
  ['settlement', 'payment', 'index.vue'],
  ['payable', 'expense', 'index.vue'],
  ['receivable', 'other-income', 'index.vue'],
];

const lazySearchDataFiles = [
  {
    apis: [
      'getAccountSimplePage',
      'getFinanceReceiptDeptSimplePage',
      'getFinanceReceiptUserSimplePage',
    ],
    path: ['settlement', 'receipt', 'data.ts'],
  },
  {
    apis: [
      'getAccountSimplePage',
      'getFinancePaymentDeptSimplePage',
      'getFinancePaymentUserSimplePage',
    ],
    path: ['settlement', 'payment', 'data.ts'],
  },
  {
    apis: [
      'getAccountSimplePage',
      'getFinanceTransferDeptSimplePage',
      'getFinanceTransferUserSimplePage',
    ],
    path: ['cash-bank', 'transfer', 'data.ts'],
  },
  {
    apis: ['getAccountDeptSimplePage'],
    path: ['cash-bank', 'account', 'data.ts'],
  },
  {
    apis: [
      'getAccountSimplePage',
      'getPayableExpenseDeptSimplePage',
      'getPayableExpenseUserSimplePage',
    ],
    path: ['payable', 'expense', 'data.ts'],
  },
  {
    apis: [
      'getAccountSimplePage',
      'getOtherIncomeDeptSimplePage',
      'getOtherIncomeUserSimplePage',
    ],
    path: ['receivable', 'other-income', 'data.ts'],
  },
  {
    apis: [
      'getPayableAccountDeptSimplePage',
      'getPayableAccountUserSimplePage',
    ],
    path: ['payable', 'account', 'data.ts'],
  },
  {
    apis: [
      'getReceivableAccountDeptSimplePage',
      'getReceivableAccountUserSimplePage',
    ],
    path: ['receivable', 'account', 'data.ts'],
  },
  {
    apis: ['getPayableReportDeptSimplePage', 'getPayableReportUserSimplePage'],
    path: ['payable', 'report', 'data.ts'],
  },
  {
    apis: [
      'getReceivableReportDeptSimplePage',
      'getReceivableReportUserSimplePage',
    ],
    path: ['receivable', 'report', 'data.ts'],
  },
  {
    apis: ['getPayableOtherDeptSimplePage', 'getPayableOtherUserSimplePage'],
    path: ['payable', 'other', 'data.ts'],
  },
  {
    apis: [
      'getOtherReceivableDeptSimplePage',
      'getOtherReceivableUserSimplePage',
    ],
    path: ['receivable', 'other-receivable', 'data.ts'],
  },
];

describe('finance list performance contracts', () => {
  it('keeps master-detail normal list page requests slim', () => {
    itemListPages.forEach((path) => {
      const source = readFinanceSource(...path);

      expect(source).toContain('includeItems: false');
    });
  });

  it('uses paged lazy selectors for database-backed list filters', () => {
    lazySearchDataFiles.forEach(({ apis, path }) => {
      const source = readFinanceSource(...path);

      expect(source).toContain("component: 'ErpLazyPageSelect'");
      expect(source).toContain('pageSize: 10');
      apis.forEach((api) => expect(source).toContain(api));
    });
  });
});
