import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const webAntdDir = resolve(currentDir, '../../../..');

function readFinancialStatementFile(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

function readWebAntdFile(path: string) {
  return readFileSync(join(webAntdDir, path), 'utf8');
}

describe('financial statement independent source pages', () => {
  it('routes purchase invoice, purchase-in status, sale red-offset, voucher, voucher-word, and subject pages independently', () => {
    const source = readFinancialStatementFile('index.vue');

    expect(source).toContain("hasAccessByCodes(['erp:purchase-in:query'])");
    expect(source).toContain("hasAccessByCodes(['erp:sale-return:query'])");
    expect(source).toContain(
      "hasAccessByCodes(['erp:purchase-invoice:query'])",
    );
    expect(source).toContain("hasAccessByCodes(['erp:voucher:query'])");
    expect(source).toContain(
      "hasAccessByCodes(['erp:voucher-attribution:query'])",
    );
    expect(source).toContain("hasAccessByCodes(['erp:voucher-word:query'])");
    expect(source).toContain(
      "hasAccessByCodes(['erp:accounting-subject:query'])",
    );
    expect(source).toContain("'purchase-invoice': '采购发票明细'");
    expect(source).toContain(
      "'purchase-in-invoice-status': '采购入库开票状态'",
    );
    expect(source).toContain("'sale-return-red-offset': '销售退货红冲来源'");
    expect(source).toContain("voucher: '凭证明细'");
    expect(source).toContain("'voucher-attribution': '凭证归集来源'");
    expect(source).toContain("'voucher-word': '凭证字基础资料'");
    expect(source).toContain("'accounting-subject': '会计科目及辅助核算'");
    expect(source).toContain('<PurchaseInInvoiceStatusReadonlyTable');
    expect(source).toContain('<SaleReturnAdjustReadonlyTable');
    expect(source).toContain('mode="return"');
    expect(source).not.toContain('TabPane');
  });

  it('states formal business boundaries without internal implementation notes', () => {
    const source = readFinancialStatementFile('index.vue');

    expect(source).toContain(
      '正式金额以确认后的公式、凭证、科目余额、现金流项目和会计期间为准',
    );
    expect(source).toContain(
      '部分开票、未开票余额和原票关联需在发票口径确认后输出',
    );
    expect(source).toContain('红字发票和红冲凭证在正式票据流程确认后生成');
    for (const forbidden of [
      '第一阶段',
      '只读复用',
      '依赖 SQL',
      '后续接入',
      '待客户确认',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('uses a dedicated purchase-in status table without purchase-in maintenance actions', () => {
    const tableSource = readFinancialStatementFile(
      'modules/purchase-in-invoice-status-readonly-table.vue',
    );

    expect(tableSource).toContain('getFinancialPurchaseInInvoiceStatusPage');
    expect(tableSource).toContain('includeItems: false');
    expect(tableSource).toContain('采购入库开票状态');
    expect(tableSource).toContain("dataIndex: 'no'");
    expect(tableSource).toContain("dataIndex: 'supplierName'");
    expect(tableSource).toContain("dataIndex: 'invoiceStatus'");
    expect(tableSource).toContain('采购入库开票状态');
    expect(tableSource).toContain('本页价税合计参考');

    for (const forbidden of [
      'createPurchaseIn',
      'updatePurchaseIn',
      'deletePurchaseIn',
      'exportPurchaseIn',
      'importPurchaseIn',
      'updatePurchaseInStatus',
      'createPurchaseInDraft',
      'submitPurchaseIn',
      'useErpPrintTemplate',
      'TableAction',
      'handleCreate',
      'handleEdit',
      'handleDelete',
      'handleAudit',
      'handlePrint',
      'handleInvoice',
      'router.push',
    ]) {
      expect(tableSource).not.toContain(forbidden);
    }
  });

  it('reuses the sale return readonly table in return mode without red invoice or voucher generation actions', () => {
    const hubSource = readFinancialStatementFile('index.vue');
    const tableSource = readWebAntdFile(
      'views/erp/sale/report/modules/sale-return-adjust-readonly-table.vue',
    );

    expect(hubSource).toContain('mode="return"');
    expect(tableSource).toContain('getSaleReturnPage');
    expect(tableSource).toContain("type Mode = 'adjust' | 'return'");
    expect(tableSource).toContain("props.mode === 'return'");

    for (const forbidden of [
      'createSaleReturn',
      'updateSaleReturn',
      'deleteSaleReturn',
      'submitSaleReturn',
      'updateSaleReturnStatus',
      'createVoucher',
      'generateVoucher',
      'redInvoice',
      'redOffsetVoucher',
      'handleCreate',
      'handleEdit',
      'handleDelete',
      'handleAudit',
      'handlePrint',
      'TableAction',
    ]) {
      expect(tableSource).not.toContain(forbidden);
    }
  });
});
