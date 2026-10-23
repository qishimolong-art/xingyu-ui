import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readFinanceSource(path: string) {
  return readFileSync(join(currentDir, path, 'index.vue'), 'utf8');
}

describe('finance list detail entry contract', () => {
  const documentNumberPages = [
    ['收款单', 'settlement/receipt'],
    ['付款单', 'settlement/payment'],
    ['银行转账', 'cash-bank/transfer'],
    ['费用支出', 'payable/expense'],
    ['其他应付', 'payable/other'],
    ['其他收入', 'receivable/other-income'],
    ['其他应收', 'receivable/other-receivable'],
    ['应付杂项', 'payable/misc'],
    ['应收杂项', 'receivable/misc'],
  ] as const;

  it.each(documentNumberPages)(
    '%s opens detail only from the document number cell',
    (_name, path) => {
      const source = readFinanceSource(path);

      expect(source).not.toContain('function handleCellClick');
      expect(source).not.toContain('cellClick: handleCellClick');
      expect(source).not.toMatch(/cellClick:\s*\(/);
      expect(source).not.toContain('const rowActionColumnFields');
      expect(source).toContain('@click.stop="handleDetail(row)"');
    },
  );

  it('keeps settlement offset explicit detail entries without ordinary cell click', () => {
    const source = readFinanceSource('settlement/offset');

    expect(source).not.toContain('function handleCellClick');
    expect(source).not.toMatch(/cellClick:\s*\(/);
    expect(source).toContain('@click.stop="handleOpenDetail(row)"');
    expect(source).toContain('onClick: handleOpenDetail.bind(null, row)');
  });

  it('keeps core finance document operations other than ordinary cell detail', () => {
    const receipt = readFinanceSource('settlement/receipt');
    const payment = readFinanceSource('settlement/payment');
    const transfer = readFinanceSource('cash-bank/transfer');
    const expense = readFinanceSource('payable/expense');
    const payableOther = readFinanceSource('payable/other');
    const otherIncome = readFinanceSource('receivable/other-income');
    const otherReceivable = readFinanceSource('receivable/other-receivable');
    const payableMisc = readFinanceSource('payable/misc');
    const receivableMisc = readFinanceSource('receivable/misc');

    for (const source of [
      receipt,
      payment,
      transfer,
      expense,
      payableOther,
      otherIncome,
      otherReceivable,
      payableMisc,
      receivableMisc,
    ]) {
      expect(source).toContain('handleImport');
      expect(source).toContain('handleExport');
      expect(source).toContain('handleBatch');
    }

    expect(receipt).toContain("auth: ['erp:finance-receipt:writeoff']");
    expect(payment).toContain("auth: ['erp:finance-payment:writeoff']");
    expect(transfer).toContain('onClick: handleCopy.bind(null, row)');
    expect(transfer).toContain('confirm: handleApprove.bind(null, row)');
    expect(expense).toContain('confirm: handleAudit.bind(null, row)');
    expect(payableOther).toContain('confirm: handleAudit.bind(null, row)');
    expect(otherIncome).toContain('confirm: handleAudit.bind(null, row)');
    expect(otherReceivable).toContain('confirm: handleAudit.bind(null, row)');
    expect(payableMisc).toContain('onClick: handleAudit.bind(null, row)');
    expect(receivableMisc).toContain('onClick: handleAudit.bind(null, row)');
  });
});
