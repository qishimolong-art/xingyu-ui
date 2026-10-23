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
    'report',
    'account-ledger',
    'index.ts',
  ),
  'utf8',
);

describe('账户流水报表', () => {
  it('严格按确认顺序展示 17 列', () => {
    const columns = [
      '交易单位',
      '交易单位编码',
      '账户',
      '业务日期',
      '业务单号',
      '单据类型',
      '方向',
      '收入金额',
      '支出金额',
      '余额',
      '收款人',
      '付款人',
      '备注',
      '凭证号',
      '会计凭证号',
      '在线支付订单号',
      '在线支付凭证号',
    ];
    let previous = -1;
    for (const column of columns) {
      const current = pageSource.indexOf(`title: '${column}'`);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(pageSource).not.toContain("fixed: 'left'");
  });

  it('手工凭证号和会计凭证号使用独立字段与筛选参数', () => {
    expect(pageSource).toContain("fieldName: 'paymentVoucherNo'");
    expect(pageSource).toContain("field: 'paymentVoucherNo'");
    expect(pageSource).toContain("fieldName: 'voucherNo'");
    expect(pageSource).toContain("field: 'voucherNo'");
    expect(apiSource).toContain('paymentVoucherNo?: string');
    expect(apiSource).toContain('voucherNo?: string');
  });

  it('使用分页选择器、服务端分页汇总和远程排序', () => {
    expect(pageSource).toContain('getAccountLedgerReportPage');
    expect(pageSource).toContain('getAccountLedgerReportSummary');
    expect(pageSource).toContain('getAccountSimplePage');
    expect(pageSource).toContain('getAccountLedgerReportUserSimplePage');
    expect(pageSource).toContain('全条件合计');
    expect(pageSource).toContain('remote: true');
    expect(pageSource).toContain('showTime: true');
  });

  it('五类来源、权限、金额遮罩和接口完整', () => {
    expect(pageSource).toContain('erp:account-ledger-report:export');
    expect(pageSource).toContain('erp:account:query');
    expect(pageSource).toContain('amountVisible');
    for (const type of [
      'receipt',
      'payment',
      'other_income',
      'expense',
      'transfer',
    ]) {
      expect(pageSource).toContain(`value: '${type}'`);
    }
    expect(apiSource).toContain('/erp/account-ledger-report/page');
    expect(apiSource).toContain('/erp/account-ledger-report/summary');
    expect(apiSource).toContain('/erp/account-ledger-report/user-simple-page');
    expect(apiSource).toContain('/erp/account-ledger-report/export-excel');
  });

  it('五类流水业务单号打开各自只读详情', () => {
    expect(pageSource).toContain("slots: { default: 'businessNo' }");
    for (const type of [
      'FINANCE_RECEIPT',
      'FINANCE_PAYMENT',
      'OTHER_INCOME',
      'PAYABLE_EXPENSE',
      'FINANCE_TRANSFER',
    ]) {
      expect(pageSource).toContain(`REPORT_DOCUMENT_TYPES.${type}`);
    }
  });
});
