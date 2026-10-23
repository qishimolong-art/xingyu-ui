import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, 'index.vue'), 'utf8');

describe('business report M5 counterparty stage one pages', () => {
  it('renders nine independent counterparty report pages with a shared customer-facing shell', () => {
    for (const title of [
      '客户应收对账',
      '供应商应付对账',
      '往来余额汇总',
      '应收账龄分析',
      '应付账龄分析',
      '核销明细查询',
      '收付款核销追踪',
      '对账差异记录',
      '历史往来口径',
    ]) {
      expect(source).toContain(title);
    }
    expect(source).toContain("| 'customer-receivable'");
    expect(source).toContain("| 'supplier-payable'");
    expect(source).toContain("| 'writeoff-detail'");
    expect(source).toContain("| 'payment-writeoff-trace'");
    expect(source).toContain("| 'reconciliation-difference'");
  });

  it('keeps the common report interactions visible and defaults lists to ten rows', () => {
    expect(source).toContain('const DEFAULT_PAGE_SIZE = 10');
    expect(source).toContain(":page-size-options=\"['10', '20', '50']\"");
    expect(source).toContain('业务时间');
    expect(source).toContain('往来对象');
    expect(source).toContain('核销状态');
    expect(source).toContain('关键词');
    expect(source).toContain('查询');
    expect(source).toContain('重置');
    expect(source).toContain('导出');
    expect(source).toContain(':scroll="{ x: tableScrollX, y: 360 }"');
  });

  it('connects stage two pages to existing receivable payable receipt payment APIs', () => {
    for (const apiName of [
      'getReceivableAccountPage',
      'getPayableAccountPage',
      'getReceivableReportPage',
      'getPayableReportPage',
      'getFinanceReceiptPage',
      'getFinancePaymentPage',
      'exportReceivableAccount',
      'exportPayableAccount',
      'exportReceivableReport',
      'exportPayableReport',
      'exportFinanceReceipt',
      'exportFinancePayment',
    ]) {
      expect(source).toContain(apiName);
    }
    expect(source).toContain("pageDataKind.value === 'difference'");
    expect(source).toContain('暂无符合条件的数据');
    expect(source).not.toContain('counterparty-report-page__intro');
  });

  it('does not expose internal implementation notes on the customer page', () => {
    for (const phrase of [
      '第一阶段',
      '只读复用',
      '依赖 SQL',
      '未完成原因',
      '后续接入',
      '待客户确认',
      '双成本开关',
      '库存游标',
      '不提供新增',
      '待数据接入',
    ]) {
      expect(source).not.toContain(phrase);
    }
    expect(source).toContain('待规则确认');
  });

  it('uses business report menu access with old receivable, payable and fund permissions as fallback', () => {
    expect(source).toContain('/erp/business-report/counterparty');
    expect(source).toContain('canCurrentMenu.value ||');
    expect(source).toContain('erp:receivable-report:query');
    expect(source).toContain('erp:payable-report:query');
    expect(source).toContain('erp:receivable-account:query');
    expect(source).toContain('erp:payable-account:query');
    expect(source).toContain('erp:finance-receipt:query');
    expect(source).toContain('erp:finance-payment:query');
  });
});
