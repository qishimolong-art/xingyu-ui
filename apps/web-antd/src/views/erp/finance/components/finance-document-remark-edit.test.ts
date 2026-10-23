import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const financeDir = join(currentDir, '..');

const documents = [
  {
    api: 'transfer',
    endpoint: '/erp/finance-transfer/update-remark',
    forms: ['cash-bank/transfer'],
    permission: 'erp:finance-transfer:update',
  },
  {
    api: 'payment',
    endpoint: '/erp/finance-payment/update-remark',
    forms: ['payment', 'settlement/payment'],
    permission: 'erp:finance-payment:update',
  },
  {
    api: 'receipt',
    endpoint: '/erp/finance-receipt/update-remark',
    forms: ['receipt', 'settlement/receipt'],
    permission: 'erp:finance-receipt:update',
  },
  {
    api: 'payable/expense',
    endpoint: '/erp/payable-expense/update-remark',
    forms: ['payable/expense'],
    permission: 'erp:payable-expense:update',
  },
  {
    api: 'payable/other',
    endpoint: '/erp/payable-other/update-remark',
    forms: ['payable/other'],
    permission: 'erp:payable-other:update',
  },
  {
    api: 'receivable/other-income',
    endpoint: '/erp/receivable-other-income/update-remark',
    forms: ['receivable/other-income'],
    permission: 'erp:receivable-other-income:update',
  },
  {
    api: 'receivable/other-receivable',
    endpoint: '/erp/receivable-other/update-remark',
    forms: ['receivable/other-receivable'],
    permission: 'erp:receivable-other:update',
  },
] as const;

describe('finance document remark edit contract', () => {
  it.each(documents)(
    'keeps $api detail-only, permission-controlled and status-independent',
    ({ api, endpoint, forms, permission }) => {
      const apiSource = readFileSync(
        join(
          financeDir,
          '..',
          '..',
          '..',
          'api',
          'erp',
          'finance',
          api,
          'index.ts',
        ),
        'utf8',
      );
      expect(apiSource).toContain(endpoint);

      for (const form of forms) {
        const formSource = readFileSync(
          join(financeDir, form, 'modules', 'form.vue'),
          'utf8',
        );
        const conditionStart = formSource.indexOf(
          'const canEditRemark = computed(',
        );
        const conditionEnd = formSource.indexOf(');', conditionStart);
        const condition = formSource.slice(conditionStart, conditionEnd);

        expect(conditionStart).toBeGreaterThan(-1);
        expect(
          condition.includes("'detail'") ||
            condition.includes('isDetail.value'),
        ).toBe(true);
        expect(condition).toContain(permission);
        expect(condition).not.toContain('status');
        expect(formSource).toContain('修改备注');
        expect(formSource).toContain(
          '<RemarkModal @success="handleRemarkSuccess" />',
        );

        const indexSource = readFileSync(
          join(financeDir, form, 'index.vue'),
          'utf8',
        );
        expect(indexSource).not.toContain('修改备注');
      }
    },
  );

  it('uses a reusable, counted and resettable remark-only modal', () => {
    const modalSource = readFileSync(
      join(currentDir, 'FinanceDocumentRemarkForm.vue'),
      'utf8',
    );

    expect(modalSource).toContain(':maxlength="500"');
    expect(modalSource).toContain('show-count');
    expect(modalSource).toContain(
      "remark.value = document.value?.remark ?? ''",
    );
    expect(modalSource).toContain("remark.value = ''");
    expect(modalSource).toContain("emit('success', savedRemark)");
    expect(modalSource).toContain('finally');
    expect(modalSource).toContain('modalApi.unlock()');
  });
});
