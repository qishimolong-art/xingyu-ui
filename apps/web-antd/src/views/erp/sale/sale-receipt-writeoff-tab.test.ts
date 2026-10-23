import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const saleOutFormSource = readFileSync(
  join(currentDir, 'out/modules/form.vue'),
  'utf8',
);
const saleReturnFormSource = readFileSync(
  join(currentDir, 'return/modules/form.vue'),
  'utf8',
);
const salePriceAdjustFormSource = readFileSync(
  join(currentDir, 'priceadjust/modules/form.vue'),
  'utf8',
);
const saleOutTabSource = readFileSync(
  join(currentDir, 'out/modules/receipt-writeoff-tab.vue'),
  'utf8',
);
const saleReturnTabSource = readFileSync(
  join(currentDir, 'return/modules/refund-writeoff-tab.vue'),
  'utf8',
);
const salePriceAdjustTabSource = readFileSync(
  join(currentDir, 'priceadjust/modules/settlement-writeoff-tab.vue'),
  'utf8',
);
const receiptApiSource = readFileSync(
  join(currentDir, '../../../api/erp/finance/receipt/index.ts'),
  'utf8',
);
const saleOutApiSource = readFileSync(
  join(currentDir, '../../../api/erp/sale/out/index.ts'),
  'utf8',
);
const saleReturnApiSource = readFileSync(
  join(currentDir, '../../../api/erp/sale/return/index.ts'),
  'utf8',
);
const salePriceAdjustApiSource = readFileSync(
  join(currentDir, '../../../api/erp/sale/priceadjust/index.ts'),
  'utf8',
);

describe('sale receipt writeoff tab contract', () => {
  it('adds writeoff tabs to sale out, sale return, and sale price adjust detail forms', () => {
    expect(saleOutFormSource).toContain('tab="收款核销"');
    expect(saleOutFormSource).toContain('<ReceiptWriteOffTab');
    expect(saleOutFormSource).toContain('key="finance" tab="财务进度"');
    expect(saleOutFormSource).toContain('key="stockOut" tab="出仓信息"');
    expect(saleOutFormSource).toContain('key="log" tab="操作日志"');

    expect(saleReturnFormSource).toContain('tab="单据详情"');
    expect(saleReturnFormSource).toContain('tab="退款核销"');
    expect(saleReturnFormSource).toContain('<RefundWriteOffTab');

    expect(salePriceAdjustFormSource).toContain('tab="单据详情"');
    expect(salePriceAdjustFormSource).toContain('tab="结算核销"');
    expect(salePriceAdjustFormSource).toContain('<SettlementWriteOffTab');
  });

  it('lazy loads summaries and receipt details only when the tab is active', () => {
    for (const source of [
      saleOutTabSource,
      saleReturnTabSource,
      salePriceAdjustTabSource,
    ]) {
      expect(source).toContain('props.active');
      expect(source).toContain('void load');
      expect(source).toContain('getFinanceReceiptWriteOffItems');
      expect(source).toContain('if (!props.canViewReceiptItems)');
    }
    expect(saleOutTabSource).toContain('getSaleOutReceiptSummary');
    expect(saleReturnTabSource).toContain('getSaleReturnRefundSummary');
    expect(salePriceAdjustTabSource).toContain(
      'getSalePriceAdjustSettlementSummary',
    );
  });

  it('uses the receipt permission for details and keeps summaries visible without it', () => {
    for (const source of [
      saleOutFormSource,
      saleReturnFormSource,
      salePriceAdjustFormSource,
    ]) {
      expect(source).toContain(
        "hasAccessByCodes(['erp:finance-receipt:query'])",
      );
      expect(source).toContain(
        ':can-view-receipt-items="canViewFinanceReceiptItems"',
      );
    }
    for (const source of [
      saleOutTabSource,
      saleReturnTabSource,
      salePriceAdjustTabSource,
    ]) {
      expect(source).toContain('无收款单查询权限');
    }
  });

  it('maps sale business types and display semantics correctly', () => {
    expect(saleOutTabSource).toContain('const SALE_OUT_BIZ_TYPE = 21');
    expect(saleOutTabSource).toContain("label: '应收金额'");
    expect(saleOutTabSource).toContain('<th>本次收款</th>');

    expect(saleReturnTabSource).toContain('const SALE_RETURN_BIZ_TYPE = 22');
    expect(saleReturnTabSource).toContain("label: '应退金额'");
    expect(saleReturnTabSource).toContain('<th>本次退款</th>');
    expect(saleReturnTabSource).toContain('Math.abs(Number(value || 0))');

    expect(salePriceAdjustTabSource).toContain(
      'const SALE_PRICE_ADJUST_BIZ_TYPE = 23',
    );
    expect(salePriceAdjustTabSource).toContain("label: '应结算金额'");
    expect(salePriceAdjustTabSource).toContain('<th>本次核销</th>');
    expect(salePriceAdjustTabSource).toContain('Number(value || 0)');
  });

  it('exposes the new frontend api methods', () => {
    expect(receiptApiSource).toContain('/erp/finance-receipt/writeoff-items');
    expect(saleOutApiSource).toContain('/erp/sale-out/receipt-summary');
    expect(saleReturnApiSource).toContain('/erp/sale-return/refund-summary');
    expect(salePriceAdjustApiSource).toContain(
      '/erp/sale-price-adjust/settlement-summary',
    );
  });
});
