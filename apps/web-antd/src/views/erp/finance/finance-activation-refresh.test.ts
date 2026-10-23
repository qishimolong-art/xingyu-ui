import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const erpViewsDir = join(currentDir, '..');

const financePages = [
  {
    apiCall: 'getAccountPage',
    maskClass: 'account-management-activation-mask',
    name: 'cash bank account',
    path: 'cash-bank/account/index.vue',
  },
  {
    apiCall: 'getFinanceTransferPage',
    maskClass: 'bank-transfer-activation-mask',
    name: 'bank transfer',
    path: 'cash-bank/transfer/index.vue',
  },
  {
    apiCall: 'getPayableAccountPage',
    maskClass: 'payable-account-activation-mask',
    name: 'payable account',
    path: 'payable/account/index.vue',
  },
  {
    apiCall: 'getPayableExpensePage',
    maskClass: 'payable-expense-activation-mask',
    name: 'payable expense',
    path: 'payable/expense/index.vue',
  },
  {
    apiCall: 'getPayableOtherPage',
    maskClass: 'other-payable-activation-mask',
    name: 'other payable',
    path: 'payable/other/index.vue',
  },
  {
    apiCall: 'getPayableMiscPage',
    maskClass: 'payable-misc-activation-mask',
    name: 'payable misc',
    path: 'payable/misc/index.vue',
  },
  {
    apiCall: 'getReceivableAccountPage',
    maskClass: 'receivable-account-activation-mask',
    name: 'receivable account',
    path: 'receivable/account/index.vue',
  },
  {
    apiCall: 'getOtherIncomePage',
    maskClass: 'other-income-activation-mask',
    name: 'other income',
    path: 'receivable/other-income/index.vue',
  },
  {
    apiCall: 'getOtherReceivablePage',
    maskClass: 'other-receivable-activation-mask',
    name: 'other receivable',
    path: 'receivable/other-receivable/index.vue',
  },
  {
    apiCall: 'getReceivableMiscPage',
    maskClass: 'receivable-misc-activation-mask',
    name: 'receivable misc',
    path: 'receivable/misc/index.vue',
  },
  {
    apiCall: 'getSettlementOffsetPage',
    maskClass: 'settlement-offset-activation-mask',
    name: 'settlement offset',
    path: 'settlement/offset/index.vue',
  },
  {
    apiCall: 'getFinancePaymentPage',
    maskClass: 'finance-payment-activation-mask',
    name: 'finance payment',
    path: 'settlement/payment/index.vue',
  },
  {
    apiCall: 'getFinanceReceiptPage',
    maskClass: 'finance-receipt-activation-mask',
    name: 'finance receipt',
    path: 'settlement/receipt/index.vue',
  },
];

function readFinancePage(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

function readErpFile(path: string) {
  return readFileSync(join(erpViewsDir, path), 'utf8');
}

describe('finance activation refresh', () => {
  it('keeps activation refresh on direct data replacement path', () => {
    const source = readErpFile('utils/activation-refresh.ts');
    const refreshStart = source.indexOf(
      'async function refreshActivatedPage()',
    );
    const refreshSource = source.slice(refreshStart);

    expect(source).toContain('onActivated(() =>');
    expect(source).toContain('let activatedOnce = false;');
    expect(source).toContain('let activationRefreshVersion = 0;');
    expect(refreshSource.match(/await waitForFrame\(\);/g)?.length).toBe(2);
    expect(refreshSource).toContain('await gridApi.grid?.loadData?.(rows);');
    expect(refreshSource).not.toContain('gridApi.query()');
  });

  it.each(financePages)(
    'wires $name activation refresh',
    ({ apiCall, maskClass, path }) => {
      const source = readFinancePage(path);

      expect(source).toContain('useVxeActivationRefresh');
      expect(source).toContain(apiCall);
      expect(source).toContain('ErpActivationRefreshMask');
      expect(source).toContain('v-if="activationRefreshMaskVisible"');
      expect(source).toContain(`class="${maskClass}"`);
    },
  );

  it('keeps page-specific transforms and selection cleanup', () => {
    expect(readFinancePage('receivable/account/index.vue')).toContain(
      'mapReceivableDisplayFields',
    );
    expect(readFinancePage('payable/expense/index.vue')).toContain(
      'normalizePayableExpenseListRow(row)',
    );
    expect(readFinancePage('receivable/other-income/index.vue')).toContain(
      'normalizeOtherIncomeListRow',
    );
    expect(readFinancePage('payable/other/index.vue')).toContain(
      'increasePayableAmount: row.payableAmount',
    );
    expect(readFinancePage('receivable/other-receivable/index.vue')).toContain(
      'increaseReceivableAmount: row.receivableAmount',
    );
    expect(readFinancePage('receivable/misc/index.vue')).toContain(
      'gridApi.grid?.clearCheckboxReserve?.();',
    );
    expect(readFinancePage('payable/misc/index.vue')).toContain(
      'gridApi.grid?.clearCheckboxReserve?.();',
    );
    expect(readFinancePage('settlement/payment/index.vue')).toContain(
      'gridApi.grid?.clearCheckboxReserve?.();',
    );
    expect(readFinancePage('settlement/receipt/index.vue')).toContain(
      'gridApi.grid?.clearCheckboxReserve?.();',
    );
  });
});
