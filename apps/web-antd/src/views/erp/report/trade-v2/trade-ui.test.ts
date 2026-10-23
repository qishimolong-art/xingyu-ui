import { describe, expect, it } from 'vitest';
import { pageTotals, tradeCell, cellReason, referenceTarget } from './trade-ui';
describe('交易报表精确合计与缺失状态', () => {
  it('销售退货原单号可下钻原销售单，无单退货不伪造原单链接', () => {
    expect(
      referenceTarget(
        {
          businessType: 'SALE_RETURN',
          originalBizId: 50,
          originalBizNo: 'XSCK202609160001',
          sourceRole: 'ORIGINAL_SALE',
        },
        'originalBizNo',
      ),
    ).toEqual({
      type: 50,
      id: 50,
      permission: 'erp:sale-out:query',
    });
    expect(
      referenceTarget(
        {
          businessType: 'SALE_RETURN',
          originalBizId: 50,
          sourceRole: 'NO_ORIGINAL_SALE',
        },
        'originalBizNo',
      ),
    ).toBeUndefined();
    expect(
      referenceTarget(
        { businessType: 'SALE_OUT', originalBizId: 50 },
        'originalBizNo',
      ),
    ).toBeUndefined();
  });
  it('采购退货的采购来源和销售退货追溯使用独立白名单', () => {
    const row = {
      businessType: 'PURCHASE_RETURN',
      sourceRole: 'SOURCE_PURCHASE_IN',
      sourcePurchaseInId: 71,
      traceSaleReturnId: 61,
    };
    expect(referenceTarget(row, 'sourcePurchaseInNo')).toEqual({
      type: 70,
      id: 71,
      permission: 'erp:purchase-in:query',
    });
    expect(referenceTarget(row, 'traceSaleReturnNo')).toEqual({
      type: 60,
      id: 61,
      permission: 'erp:sale-return:query',
    });
    expect(
      referenceTarget(
        { ...row, sourceRole: 'NO_ORIGINAL_PURCHASE' },
        'sourcePurchaseInNo',
      ),
    ).toBeUndefined();
    expect(referenceTarget(row, 'sourceOrderNo')).toBeUndefined();
    expect(
      referenceTarget(
        { ...row, businessType: 'SALE_RETURN' },
        'sourcePurchaseInNo',
      ),
    ).toBeUndefined();
  });
  it('退货成本当前均价与未知税基差额明确展示，不相减伪造利润', () => {
    const row = {
      returnMode: 20,
      costBasis: 'CURRENT_AVERAGE',
      returnDifferenceStatus: 'TAX_BASIS_UNCONFIRMED',
      returnGrossAmount: '100',
      returnFinancialCost: '80',
      returnDifferenceProfit: null,
      metricStates: { returnDifferenceProfit: 'TAX_BASIS_UNCONFIRMED' },
    } as const;
    expect(tradeCell(row, 'returnMode')).toBe('按库存退货');
    expect(tradeCell(row, 'costBasis')).toContain('两套当前均价');
    expect(tradeCell(row, 'returnDifferenceProfit')).toBe('不可用');
    expect(tradeCell(pageTotals([row]), 'returnDifferenceProfit')).toBe(
      '不可用',
    );
  });
  it('采购入库差额不适用，混合合计只继承采购退货的待核状态', () => {
    const inbound = {
      returnDifferenceProfit: null,
      metricStates: { returnDifferenceProfit: 'NOT_APPLICABLE' },
    };
    const returned = {
      returnDifferenceProfit: null,
      metricStates: { returnDifferenceProfit: 'TAX_BASIS_UNCONFIRMED' },
    };
    expect(tradeCell(pageTotals([inbound]), 'returnDifferenceProfit')).toBe(
      '不适用',
    );
    expect(
      cellReason(pageTotals([returned, inbound]), 'returnDifferenceProfit'),
    ).toContain('未税金额');
    expect(
      cellReason(pageTotals([inbound, returned]), 'returnDifferenceProfit'),
    ).toContain('未税金额');
  });
  it('空页沿用本次汇总的未知及金额权限，只有可计算字段显示零', () => {
    const result = pageTotals([], {
      netQuantity: '0',
      grossAmount: null,
      netAmount: null,
      receivedAmount: null,
      metricStates: {
        grossAmount: 'MASKED',
        netAmount: 'TAX_BASIS_UNCONFIRMED',
        receivedAmount: 'SETTLEMENT_ALLOCATION_PENDING',
      },
    });
    expect(tradeCell(result, 'netQuantity')).toBe('0');
    expect(tradeCell(result, 'grossAmount')).toBe('****');
    expect(tradeCell(result, 'netAmount')).toBe('不可用');
    expect(cellReason(result, 'receivedAmount')).toContain('尚未接入');
    expect(tradeCell(pageTotals([]), 'grossAmount')).toBe('不可用');
  });
  it('大额小数求和不经过Number', () => {
    const result = pageTotals([
      { grossAmount: '999999999999999999.123456' },
      { grossAmount: '0.000001' },
    ]);
    expect(result.grossAmount).toBe('999999999999999999.123457');
    expect(tradeCell(result, 'grossAmount')).toBe(
      '999,999,999,999,999,999.123457',
    );
  });
  it('未知金额不补零，隐藏优先于未知', () => {
    let result = pageTotals([
      { grossAmount: '1' },
      {
        grossAmount: null,
        metricStates: { grossAmount: 'HEADER_ALLOCATION_PENDING' },
      },
    ]);
    expect(result.grossAmount).toBeNull();
    expect(cellReason(result, 'grossAmount')).toContain('尚未分配');
    result = pageTotals([
      { grossAmount: null },
      { grossAmount: null, metricStates: { grossAmount: 'MASKED' } },
    ]);
    expect(tradeCell(result, 'grossAmount')).toBe('****');
  });
  it('实际0可展示，不信任数值类型的大额API金额', () => {
    expect(tradeCell({ grossAmount: '0' }, 'grossAmount')).toBe('0');
    expect(
      tradeCell({ grossAmount: Number.MAX_SAFE_INTEGER + 1 }, 'grossAmount'),
    ).toBe('不可用');
  });
});
