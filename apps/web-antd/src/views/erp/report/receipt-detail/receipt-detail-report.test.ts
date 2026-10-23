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
    'receipt-detail',
    'index.ts',
  ),
  'utf8',
);

describe('收款明细查询报表', () => {
  it('按确认顺序展示 23 列', () => {
    const columns = [
      '客户',
      '收款日期',
      '收款单号',
      '业务单号',
      '业务类型',
      '结算金额',
      '实收金额',
      '结算方式',
      '账户类型',
      '收款账户',
      '凭证号',
      '会计凭证号',
      '收款人',
      '业务员',
      '开发员',
      '制单人',
      '业务日期',
      '成本金额',
      '毛利',
      '毛利率',
      '客户类型',
      '部门',
      '备注',
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

  it('使用默认本月、分页选择器、服务端汇总和远程排序', () => {
    expect(pageSource).toContain("dayjs().startOf('month')");
    expect(pageSource).toContain('getReceiptDetailReportPage');
    expect(pageSource).toContain('getReceiptDetailReportSummary');
    expect(pageSource).toContain('getCustomerSimplePage');
    expect(pageSource).toContain('getAccountSimplePage');
    expect(pageSource).toContain('getFinanceReceiptUserSimplePage');
    expect(pageSource).toContain("component: 'ErpLazyPageSelect'");
    expect(pageSource).toContain('全条件合计');
    expect(pageSource).toContain('remote: true');
  });

  it('导出权限、接口和金额遮罩完整', () => {
    expect(pageSource).toContain('erp:receipt-detail-report:export');
    expect(pageSource).toContain('erp:finance-receipt:query');
    expect(pageSource).toContain('erp:finance-receipt:export');
    expect(pageSource).toContain('amountVisible');
    expect(pageSource).toContain('v-if="canExport"');
    expect(apiSource).toContain('/erp/receipt-detail-report/page');
    expect(apiSource).toContain('/erp/receipt-detail-report/summary');
    expect(apiSource).toContain('/erp/receipt-detail-report/export-excel');
  });

  it('收款单号和四类业务单号按原权限打开只读详情', () => {
    expect(apiSource).toContain('receiptId: number');
    expect(apiSource).toContain('businessId: number');
    expect(pageSource).toContain("slots: { default: 'receiptNo' }");
    expect(pageSource).toContain("slots: { default: 'businessNo' }");
    expect(pageSource).toContain('REPORT_DOCUMENT_TYPES.FINANCE_RECEIPT');
    expect(pageSource).toContain('row.businessTypeCode');
    expect(pageSource).toContain('row.businessId');
    expect(pageSource).toContain('ReportDocumentDetailModal');
    expect(pageSource).toContain('@click.stop');
    expect(pageSource).toContain('type="button"');
  });
});
