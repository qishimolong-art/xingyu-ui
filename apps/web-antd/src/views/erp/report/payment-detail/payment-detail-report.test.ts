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
    'payment-detail',
    'index.ts',
  ),
  'utf8',
);

describe('付款明细查询报表', () => {
  it('严格按确认顺序展示 17 列且不含折让', () => {
    const columns = [
      '供应商',
      '付款日期',
      '付款单号',
      '业务单号',
      '业务类型',
      '结算金额',
      '实付金额',
      '付款账户',
      '凭证号',
      '会计凭证号',
      '付款人',
      '采购员',
      '供应商类型',
      '付款方式',
      '制单人',
      '结算方式',
      '部门',
    ];
    let previous = -1;
    for (const column of columns) {
      const current = pageSource.indexOf(`title: '${column}'`);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(pageSource).not.toContain("title: '折让'");
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
    expect(pageSource).toContain('getPaymentDetailReportPage');
    expect(pageSource).toContain('getPaymentDetailReportSummary');
    expect(pageSource).toContain('getSupplierSimplePage');
    expect(pageSource).toContain('getAccountSimplePage');
    expect(pageSource).toContain('getFinancePaymentUserSimplePage');
    expect(pageSource).toContain('getFinancePaymentDeptSimplePage');
    expect(pageSource).toContain('全条件合计');
    expect(pageSource).toContain('remote: true');
  });

  it('权限、接口、四类业务和金额遮罩完整', () => {
    expect(pageSource).toContain('erp:payment-detail-report:export');
    expect(pageSource).toContain('erp:finance-payment:query');
    expect(pageSource).toContain('amountVisible');
    for (const type of ['11', '12', '13', '14']) {
      expect(pageSource).toContain(`value: ${type}`);
    }
    expect(apiSource).toContain('/erp/payment-detail-report/page');
    expect(apiSource).toContain('/erp/payment-detail-report/summary');
    expect(apiSource).toContain('/erp/payment-detail-report/export-excel');
  });

  it('付款单号与四类业务单号分别打开对应只读详情', () => {
    expect(pageSource).toContain("slots: { default: 'paymentNo' }");
    expect(pageSource).toContain("slots: { default: 'businessNo' }");
    expect(pageSource).toContain('REPORT_DOCUMENT_TYPES.FINANCE_PAYMENT');
    expect(pageSource).toContain('REPORT_DOCUMENT_TYPES.PAYABLE_MISC');
    expect(apiSource).toContain('businessId?: number');
  });
});
