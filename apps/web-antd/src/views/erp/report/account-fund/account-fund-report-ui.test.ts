import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const tableSource = readFileSync(
  join(currentDir, 'modules/account-fund-table.vue'),
  'utf8',
);
const ledgerTableSource = readFileSync(
  join(currentDir, 'modules/account-fund-ledger-table.vue'),
  'utf8',
);
const transferTableSource = readFileSync(
  join(currentDir, 'modules/bank-transfer-readonly-table.vue'),
  'utf8',
);
const receiptPaymentTableSource = readFileSync(
  join(currentDir, 'modules/finance-receipt-payment-readonly-table.vue'),
  'utf8',
);

describe('经营报表账户资金及总部归集独立页面契约', () => {
  it('splits M7 account fund reports into route-driven independent pages', () => {
    expect(indexSource).toContain('useRoute');
    expect(indexSource).toContain('account-ledger');
    expect(indexSource).toContain('account-balance');
    expect(indexSource).toContain('transfer-in-transit');
    expect(indexSource).toContain('hq-collection-payment');
    expect(indexSource).toContain('bank-transfer');
    expect(indexSource).toContain('receipt-record');
    expect(indexSource).toContain('payment-record');
    expect(indexSource).toContain('history');
    expect(indexSource).toContain('账户资金流水表');
    expect(indexSource).toContain('账户余额及对账表');
    expect(indexSource).toContain('部门转总部资金归集及在途表');
    expect(indexSource).toContain('总部代收代付及部门资金占用表');
    expect(indexSource).not.toContain('<Tabs');
    expect(indexSource).not.toContain('<TabPane');
  });

  it('keeps report permissions compatible with current menu and old source permissions', () => {
    expect(indexSource).toContain("hasAccessByCodes(['erp:account:query'])");
    expect(indexSource).toContain(
      "hasAccessByCodes(['erp:finance-transfer:query'])",
    );
    expect(indexSource).toContain(
      "hasAccessByCodes(['erp:finance-receipt:query'])",
    );
    expect(indexSource).toContain(
      "hasAccessByCodes(['erp:finance-payment:query'])",
    );
    expect(indexSource).toContain('canCurrentMenu');
    expect(indexSource).toContain(
      "currentPath.value.startsWith('/erp/business-report/account-fund/')",
    );
  });

  it('does not render internal implementation notes on the customer pages', () => {
    const combined = `${indexSource}\n${tableSource}\n${ledgerTableSource}\n${transferTableSource}\n${receiptPaymentTableSource}`;
    for (const text of [
      '第一阶段',
      '只读复用',
      '依赖 SQL',
      '未完成原因',
      '后续接入',
      '待客户确认',
      '双成本开关',
      '库存游标',
      '不提供新增',
      '资金事件服务接入',
    ]) {
      expect(combined).not.toContain(text);
    }
  });

  it('reuses the unified finance bill page as the account fund ledger', () => {
    expect(indexSource).toContain('AccountFundLedgerTable');
    expect(indexSource).toContain("pageKey === 'account-ledger'");
    expect(indexSource).toContain("pageKey === 'hq-collection-payment'");
    expect(ledgerTableSource).toContain('getFinanceBillPage');
    expect(ledgerTableSource).toContain('downloadFileFromBlobPart');
    expect(ledgerTableSource).toContain('text/csv;charset=utf-8');
    expect(ledgerTableSource).toContain('const pageSize = ref(10)');
    expect(ledgerTableSource).toContain(
      ":page-size-options=\"['10', '20', '50']\"",
    );
    for (const field of [
      'billType',
      'no',
      'billTime',
      'accountName',
      'deptName',
      'customerName',
      'supplierName',
      'financeUserName',
      'bizNo',
      'actualPrice',
    ]) {
      expect(ledgerTableSource).toContain(field);
    }
  });

  it('reuses existing account page and transaction drawer without management actions', () => {
    expect(tableSource).toContain('getAccountPage');
    expect(tableSource).toContain('exportAccount');
    expect(tableSource).toContain('downloadFileFromBlobPart');
    expect(tableSource).toContain('TransactionDrawer');
    expect(tableSource).toContain('账户交易流水');
    expect(tableSource).toContain(
      'pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] }',
    );
    expect(tableSource).toContain('erp-business-report-account-fund-list-v1');
    expect(tableSource).not.toContain('createAccount');
    expect(tableSource).not.toContain('deleteAccount');
    expect(tableSource).not.toContain('batchUpdateAccount');
    expect(tableSource).not.toContain('updateAccountDefaultStatus');
  });

  it('keeps account balance table stretched in the report page', () => {
    expect(tableSource).toMatch(
      /\.account-fund-report-table\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
    expect(tableSource).toMatch(
      /\.account-fund-report-table__grid\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
  });

  it('reuses and exports bank transfer data as a report table', () => {
    expect(transferTableSource).toContain('getFinanceTransferPage');
    expect(transferTableSource).toContain('exportFinanceTransfer');
    expect(transferTableSource).toContain('downloadFileFromBlobPart');
    expect(transferTableSource).toContain(
      'pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] }',
    );
    expect(transferTableSource).toContain(
      'erp-business-report-bank-transfer-readonly-list-v1',
    );
    for (const field of [
      'outAccountName',
      'inAccountName',
      'transferPrice',
      'exchangeRate',
      'feePrice',
      'feeExpenseCategory',
      'status',
      'deptName',
      'financeUserName',
      'auditorName',
      'auditTime',
      'transferTime',
      'no',
    ]) {
      expect(transferTableSource).toContain(`field: '${field}'`);
    }
    for (const action of [
      'createFinanceTransfer',
      'updateFinanceTransfer',
      'deleteFinanceTransfer',
      'submitFinanceTransfer',
      'updateFinanceTransferStatus',
      'importFinanceTransfer',
      'useErpPrintTemplate',
    ]) {
      expect(transferTableSource).not.toContain(action);
    }
  });

  it('keeps bank transfer readonly table stretched in the report page', () => {
    expect(transferTableSource).toMatch(
      /\.bank-transfer-readonly-table\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
    expect(transferTableSource).toMatch(
      /\.bank-transfer-readonly-table__grid\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
  });

  it('reuses and exports receipt and payment pages as report tables', () => {
    expect(receiptPaymentTableSource).toContain('getFinanceReceiptPage');
    expect(receiptPaymentTableSource).toContain('getFinancePaymentPage');
    expect(receiptPaymentTableSource).toContain('exportFinanceReceipt');
    expect(receiptPaymentTableSource).toContain('exportFinancePayment');
    expect(receiptPaymentTableSource).toContain('const pageSize = ref(10)');
    expect(receiptPaymentTableSource).toContain(
      ":page-size-options=\"['10', '20', '50']\"",
    );
    for (const field of [
      'bankName',
      'settleMethod',
      'discountPrice',
      'voucherNo',
      'auditorName',
      'auditTime',
      'remark',
    ]) {
      expect(receiptPaymentTableSource).toContain(`dataIndex: '${field}'`);
    }
    for (const action of [
      'createFinanceReceipt',
      'updateFinanceReceipt',
      'deleteFinanceReceipt',
      'writeOffFinanceReceipt',
      'createFinancePayment',
      'updateFinancePayment',
      'deleteFinancePayment',
      'writeOffFinancePayment',
      'getFinanceReceipt(',
      'getFinancePayment(',
    ]) {
      expect(receiptPaymentTableSource).not.toContain(action);
    }
  });

  it('keeps receipt and payment readonly table stretched in the report page', () => {
    expect(receiptPaymentTableSource).toMatch(
      /\.finance-receipt-payment-readonly-table\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
    expect(receiptPaymentTableSource).toMatch(
      /\.finance-receipt-payment-readonly-table__table\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
  });
});
