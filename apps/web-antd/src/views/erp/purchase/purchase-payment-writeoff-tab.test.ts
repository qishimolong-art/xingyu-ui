import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const returnFormSource = readFileSync(
  join(currentDir, 'return/modules/form.vue'),
  'utf8',
);
const returnTabSource = readFileSync(
  join(currentDir, 'return/modules/refund-writeoff-tab.vue'),
  'utf8',
);
const returnApiSource = readFileSync(
  join(currentDir, '../../../api/erp/purchase/return/index.ts'),
  'utf8',
);
const priceAdjustFormSource = readFileSync(
  join(currentDir, 'priceadjust/modules/form.vue'),
  'utf8',
);
const priceAdjustTabSource = readFileSync(
  join(currentDir, 'priceadjust/modules/settlement-writeoff-tab.vue'),
  'utf8',
);
const priceAdjustApiSource = readFileSync(
  join(currentDir, '../../../api/erp/purchase/priceadjust/index.ts'),
  'utf8',
);

describe('purchase payment write-off detail tabs', () => {
  it('adds refund write-off tab to purchase return detail mode', () => {
    expect(returnFormSource).toContain('tab="单据详情"');
    expect(returnFormSource).toContain('tab="退款核销"');
    expect(returnFormSource).toContain('<RefundWriteOffTab');
    expect(returnFormSource).toContain(
      ':active="detailActiveTab === REFUND_TAB_KEY"',
    );
    expect(returnFormSource).toContain(
      ':can-view-payment-items="canViewFinancePaymentItems"',
    );
    expect(returnFormSource).toContain('v-if="formType !== \'detail\'"');
  });

  it('adds settlement write-off tab to purchase price adjust detail mode', () => {
    expect(priceAdjustFormSource).toContain('tab="单据详情"');
    expect(priceAdjustFormSource).toContain('tab="结算核销"');
    expect(priceAdjustFormSource).toContain('<SettlementWriteOffTab');
    expect(priceAdjustFormSource).toContain(
      ':active="detailActiveTab === SETTLEMENT_TAB_KEY"',
    );
    expect(priceAdjustFormSource).toContain(
      ':can-view-payment-items="canViewFinancePaymentItems"',
    );
    expect(priceAdjustFormSource).toContain('v-if="formType !== \'detail\'"');
  });

  it('lazy loads summaries and skips payment details without finance permission', () => {
    for (const source of [returnTabSource, priceAdjustTabSource]) {
      expect(source).toContain('if (props.active)');
      expect(source).toContain('!props.canViewPaymentItems');
      expect(source).toContain('return;');
      expect(source).toContain('getFinancePaymentWriteOffItems');
      expect(source).toContain('无付款单查询权限');
    }
  });

  it('uses the confirmed summary endpoints, fields, biz types, and labels', () => {
    expect(returnApiSource).toContain('/erp/purchase-return/payment-summary');
    expect(returnApiSource).toContain('PurchaseReturnRefundSummary');
    expect(returnTabSource).toContain('const PURCHASE_RETURN_BIZ_TYPE = 12;');
    expect(returnTabSource).toContain('refundableAmount');
    expect(returnTabSource).toContain('refundedAmount');
    expect(returnTabSource).toContain('unrefundedAmount');
    expect(returnTabSource).toContain('refundStatus');
    expect(returnTabSource).toContain('本次退款');
    expect(returnTabSource).toContain('Math.abs(amount)');

    expect(priceAdjustApiSource).toContain(
      '/erp/purchase-price-adjust/payment-summary',
    );
    expect(priceAdjustApiSource).toContain(
      'PurchasePriceAdjustSettlementSummary',
    );
    expect(priceAdjustTabSource).toContain(
      'const PURCHASE_PRICE_ADJUST_BIZ_TYPE = 13;',
    );
    expect(priceAdjustTabSource).toContain('settlementAmount');
    expect(priceAdjustTabSource).toContain('writtenOffAmount');
    expect(priceAdjustTabSource).toContain('unwrittenOffAmount');
    expect(priceAdjustTabSource).toContain('settlementStatus');
    expect(priceAdjustTabSource).toContain('本次核销');
    expect(priceAdjustTabSource).not.toContain('Math.abs(amount)');
  });
});
