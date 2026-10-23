import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readFinanceFile(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

function readFinanceApiFile(path: string) {
  return readFileSync(
    join(currentDir, '../../../api/erp/finance', path),
    'utf8',
  );
}

describe('finance import failure download contract', () => {
  it('exposes scoped failure download APIs for visible finance imports', () => {
    const cases = [
      {
        source: readFinanceApiFile('receipt/index.ts'),
        typeName: 'FinanceImportResult',
        functionName: 'downloadFinanceReceiptImportFailureDetails',
        endpoint: '/erp/finance-receipt/import-failure-details/download',
      },
      {
        source: readFinanceApiFile('payment/index.ts'),
        typeName: 'FinanceImportResult',
        functionName: 'downloadFinancePaymentImportFailureDetails',
        endpoint: '/erp/finance-payment/import-failure-details/download',
      },
      {
        source: readFinanceApiFile('transfer/index.ts'),
        typeName: 'FinanceImportResult',
        functionName: 'downloadFinanceTransferImportFailureDetails',
        endpoint: '/erp/finance-transfer/import-failure-details/download',
      },
      {
        source: readFinanceApiFile('account/index.ts'),
        typeName: 'FinanceImportResult',
        functionName: 'downloadAccountImportFailureDetails',
        endpoint: '/erp/account/import-failure-details/download',
      },
      {
        source: readFinanceApiFile('receivable/other-receivable/index.ts'),
        typeName: 'FinanceImportResult',
        functionName: 'downloadOtherReceivableImportFailureDetails',
        endpoint: '/erp/receivable-other/import-failure-details/download',
      },
      {
        source: readFinanceApiFile('receivable/other-income/index.ts'),
        typeName: 'FinanceImportResult',
        functionName: 'downloadOtherIncomeImportFailureDetails',
        endpoint:
          '/erp/receivable-other-income/import-failure-details/download',
      },
      {
        source: readFinanceApiFile('payable/other/index.ts'),
        typeName: 'FinanceImportResult',
        functionName: 'downloadPayableOtherImportFailureDetails',
        endpoint: '/erp/payable-other/import-failure-details/download',
      },
      {
        source: readFinanceApiFile('payable/expense/index.ts'),
        typeName: 'FinanceImportResult',
        functionName: 'downloadPayableExpenseImportFailureDetails',
        endpoint: '/erp/payable-expense/import-failure-details/download',
      },
    ];

    cases.forEach(({ endpoint, functionName, source, typeName }) => {
      expect(source).toContain(`interface ${typeName}`);
      expect(source).toContain('recordId?: number');
      expect(source).toContain(functionName);
      expect(source).toContain(endpoint);
      expect(source).toContain('params: { recordId }');
    });
  });

  it('passes failure download config from every visible finance import entry', () => {
    const cases = [
      {
        source: readFinanceFile('settlement/receipt/index.vue'),
        functionName: 'downloadFinanceReceiptImportFailureDetails',
        fileName: '收款单错误数据.xls',
      },
      {
        source: readFinanceFile('settlement/payment/index.vue'),
        functionName: 'downloadFinancePaymentImportFailureDetails',
        fileName: '付款单错误数据.xls',
      },
      {
        source: readFinanceFile('cash-bank/transfer/index.vue'),
        functionName: 'downloadFinanceTransferImportFailureDetails',
        fileName: '银行转账错误数据.xls',
      },
      {
        source: readFinanceFile('cash-bank/account/index.vue'),
        functionName: 'downloadAccountImportFailureDetails',
        fileName: '结算账户错误数据.xls',
      },
      {
        source: readFinanceFile('receivable/other-receivable/index.vue'),
        functionName: 'downloadOtherReceivableImportFailureDetails',
        fileName: '应收调账错误数据.xls',
      },
      {
        source: readFinanceFile('receivable/other-income/index.vue'),
        functionName: 'downloadOtherIncomeImportFailureDetails',
        fileName: '其他收入错误数据.xls',
      },
      {
        source: readFinanceFile('payable/other/index.vue'),
        functionName: 'downloadPayableOtherImportFailureDetails',
        fileName: '应付调账错误数据.xls',
      },
      {
        source: readFinanceFile('payable/expense/index.vue'),
        functionName: 'downloadPayableExpenseImportFailureDetails',
        fileName: '费用支付错误数据.xls',
      },
    ];

    cases.forEach(({ fileName, functionName, source }) => {
      expect(source).toContain(functionName);
      expect(source).toContain('failureDownload: {');
      expect(source).toContain(`request: ${functionName}`);
      expect(source).toContain(`fileName: '${fileName}'`);
    });
  });

  it('keeps failure results actionable inside the shared finance import modal', () => {
    const source = readFinanceFile('components/import-modal.vue');

    expect(source).toContain('const uploadFile = ref<File | null>(null)');
    expect(source).toContain('const importResult');
    expect(source).toContain('recordId?: number');
    expect(source).toContain('failureDownload?: FinanceFailureDownloadConfig');
    expect(source).toContain('canDownloadFailureDetails');
    expect(source).toContain('handleDownloadFailureDetails');
    expect(source).toContain('下载错误数据');
    expect(source).toContain("{{ importResult ? '关闭' : '开始导入' }}");
    expect(source).toContain('max-h-[calc(100vh-48px)]');
    expect(source).toContain('content-class="!min-h-0"');
    expect(source).toContain('footer-class="flex-wrap gap-2');
    expect(source).toContain('flex-auto flex-wrap');
    expect(source).toContain('max-h-40 overflow-auto');
    expect(source).not.toContain('content-class="!flex-none"');
    expect(source).not.toContain(
      "emit('success');\n      if ((result.failureCount ?? 0) > 0)",
    );
  });

  it('adds the confirmed account import failure download but keeps accounting unchanged', () => {
    expect(readFinanceFile('cash-bank/account/index.vue')).toContain(
      'ImportModal',
    );
    expect(readFinanceApiFile('account/index.ts')).toContain(
      'downloadAccountImportFailureDetails',
    );
    expect(
      readFinanceFile('../accounting/subject/modules/import-modal.vue'),
    ).not.toContain('failureDownload');
  });
});
