import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readReportHub(path: string) {
  return readFileSync(join(currentDir, path, 'index.vue'), 'utf8');
}

function readReportFile(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

const forbiddenCustomerWords = [
  '第一阶段',
  '只读复用',
  '依赖 SQL',
  '未完成原因',
  '后续接入',
  '待客户确认',
  '双成本开关',
  '库存游标',
  '待数据接入',
];

describe('business report stage1 hub pages', () => {
  it('keeps account fund as clean independent report pages', () => {
    const source = readReportHub('account-fund');

    expect(source).toContain('BusinessReportShell');
    expect(source).toContain('account-fund-report-page');
    expect(source).toContain("'account-ledger': '账户资金流水表'");
    expect(source).toContain("'account-balance': '账户余额及对账表'");
    expect(source).toContain(
      "'transfer-in-transit': '部门转总部资金归集及在途表'",
    );
    expect(source).toContain(
      "'hq-collection-payment': '总部代收代付及部门资金占用表'",
    );
    expect(source).toContain("'receipt-record': '收款记录'");
    expect(source).toContain("'payment-record': '付款记录'");
    expect(source).not.toContain('第一阶段');
    expect(source).not.toContain('依赖 SQL');
  });

  it('keeps expense allocation and other operating income as clean independent report pages', () => {
    const source = readReportHub('expense-income');

    expect(source).toContain('BusinessReportShell');
    expect(source).toContain('expense-income-report-page');
    expect(source).toContain("'expense-detail': '费用支付明细'");
    expect(source).toContain("'department-expense': '部门费用汇总'");
    expect(source).toContain("'expense-allocation': '公共费用分摊明细'");
    expect(source).toContain("'budget-variance': '费用预算及差异分析'");
    expect(source).toContain("'operating-income': '其他经营收支明细'");
    expect(source).toContain("history: '历史费用收支口径'");
    expect(source).not.toContain('TabPane');
    for (const word of forbiddenCustomerWords)
      expect(source).not.toContain(word);
  });

  it('keeps financial statement as clean independent report pages', () => {
    const source = readReportHub('financial-statement');

    expect(source).toContain('BusinessReportShell');
    expect(source).toContain('erp-financial-statement-report');
    expect(source).toContain("'purchase-invoice': '采购发票明细'");
    expect(source).toContain(
      "'purchase-in-invoice-status': '采购入库开票状态'",
    );
    expect(source).toContain("'sale-return-red-offset': '销售退货红冲来源'");
    expect(source).toContain("voucher: '凭证明细'");
    expect(source).toContain("'voucher-attribution': '凭证归集来源'");
    expect(source).toContain("'voucher-word': '凭证字基础资料'");
    expect(source).toContain("'accounting-subject': '会计科目及辅助核算'");
    expect(source).toContain("history: '历史财务口径'");
    expect(source).toContain('<PurchaseInvoiceReadonlyTable');
    expect(source).toContain('<PurchaseInInvoiceStatusReadonlyTable');
    expect(source).toContain('<SaleReturnAdjustReadonlyTable');
    expect(source).toContain('<VoucherReadonlyTable');
    expect(source).toContain('<VoucherAttributionReadonlyTable');
    expect(source).toContain('<VoucherWordReadonlyTable');
    expect(source).toContain('<SubjectReadonlyTable');
    expect(source).not.toContain('TabPane');
    expect(source).not.toContain('Tabs');
    for (const word of forbiddenCustomerWords)
      expect(source).not.toContain(word);
  });

  it('keeps financial readonly source tables free from internal customer-facing notes', () => {
    for (const path of [
      'financial-statement/modules/purchase-invoice-readonly-table.vue',
      'financial-statement/modules/purchase-in-invoice-status-readonly-table.vue',
      'financial-statement/modules/voucher-attribution-readonly-table.vue',
      'financial-statement/modules/voucher-word-readonly-table.vue',
    ]) {
      const source = readReportFile(path);
      for (const word of forbiddenCustomerWords)
        expect(source).not.toContain(word);
      expect(source).not.toContain('不提供新增');
    }
  });

  it('uses dedicated readonly financial tables without embedding maintenance actions', () => {
    const voucherSource = readReportFile(
      'financial-statement/modules/voucher-readonly-table.vue',
    );
    const voucherWordSource = readReportFile(
      'financial-statement/modules/voucher-word-readonly-table.vue',
    );
    const attributionSource = readReportFile(
      'financial-statement/modules/voucher-attribution-readonly-table.vue',
    );
    const purchaseInvoiceSource = readReportFile(
      'financial-statement/modules/purchase-invoice-readonly-table.vue',
    );
    const subjectSource = readReportFile(
      'financial-statement/modules/subject-readonly-table.vue',
    );

    expect(voucherSource).toContain('getFinancialVoucherPage');
    expect(voucherSource).toContain(
      "id: 'erp-business-report-voucher-readonly-list-v1'",
    );
    expect(voucherWordSource).toContain('getFinancialVoucherWordPage');
    expect(voucherWordSource).toContain(
      "id: 'erp-business-report-voucher-word-readonly-list-v1'",
    );
    expect(attributionSource).toContain(
      'getFinancialVoucherAttributionSourcePage',
    );
    expect(attributionSource).toContain(
      "id: 'erp-business-report-voucher-attribution-readonly-list-v1'",
    );
    expect(purchaseInvoiceSource).toContain('getFinancialPurchaseInvoicePage');
    expect(purchaseInvoiceSource).toContain('本页价税合计');
    expect(subjectSource).toContain('getFinancialAccountingSubjectPage');
    expect(subjectSource).toContain(
      "id: 'erp-business-report-accounting-subject-readonly-list-v1'",
    );

    for (const forbidden of [
      'createVoucher',
      'updateVoucher',
      'deleteVoucher',
      'auditVoucher',
      'createVoucherWord',
      'updateVoucherWord',
      'deleteVoucherWord',
      'createVoucherAttribution',
      'generateVouchers',
      'createPurchaseInvoice',
      'updatePurchaseInvoice',
      'deletePurchaseInvoice',
      'createAccountingSubject',
      'updateAccountingSubject',
      'deleteAccountingSubject',
      'TableAction',
      'handleCreate',
      'handleDelete',
      'handleAudit',
    ]) {
      expect(voucherSource).not.toContain(forbidden);
      expect(voucherWordSource).not.toContain(forbidden);
      expect(attributionSource).not.toContain(forbidden);
      expect(purchaseInvoiceSource).not.toContain(forbidden);
      expect(subjectSource).not.toContain(forbidden);
    }
  });

  it('uses the shared business report shell for the customer-visible report hubs', () => {
    for (const path of [
      'account-fund',
      'expense-income',
      'financial-statement',
      'profit-dashboard',
    ]) {
      const source = readReportHub(path);
      expect(source).toContain('BusinessReportShell');
      expect(source).toContain('经营报表 · ');
      expect(source).not.toContain('<Page auto-content-height>');
    }
  });
});
