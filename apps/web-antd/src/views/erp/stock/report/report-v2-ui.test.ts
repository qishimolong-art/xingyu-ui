import type { StockReportV2Api } from '#/api/erp/report/stock-v2';
import { describe, expect, it } from 'vitest';
import {
  buildReportQuery,
  decimalUnits,
  displayDecimal,
  stockOriginLabel,
  summarizePage,
  validateOpening,
} from './report-v2-ui';

function row(values: Partial<StockReportV2Api.Row>): StockReportV2Api.Row {
  return {
    stockId: 1,
    productId: 2,
    warehouseId: 3,
    financialMasked: false,
    settlementMasked: false,
    dataStatus: 'READY',
    ...values,
  };
}
describe('库存v2精确展示与查询契约', () => {
  it('起点来源仅按后端明确标识展示，缺失及未知不推定人工期初', () => {
    expect(stockOriginLabel('MANUAL_OPENING')).toBe('人工核对期初');
    expect(stockOriginLabel('NEW_DIMENSION')).toBe('新库存受控起点');
    expect(stockOriginLabel(null)).toBe('未记录起点来源');
    expect(stockOriginLabel(undefined)).toBe('未记录起点来源');
    expect(stockOriginLabel('FUTURE_KIND')).toBe('未记录起点来源');
  });
  it('精确累加大额与六位小数，不对小数分组插逗号', () => {
    const result = summarizePage(
      [
        row({
          quantity: '0.1',
          financialMovement: '999999999999999999.000001',
          settlementMovement: '1.123456',
        }),
        row({
          quantity: '0.2',
          financialMovement: '0.999999',
          settlementMovement: '0.000001',
        }),
      ],
      'MOVEMENT',
    );
    expect(result.inQuantity).toBe('0.3');
    expect(result.financialInAmount).toBe('1000000000000000000');
    expect(result.settlementInAmount).toBe('1.123457');
    expect(displayDecimal('1234.123456')).toBe('1,234.123456');
    expect(decimalUnits(1000000000000000000)).toBeUndefined();
  });
  it('零数量调价按各套金额方向独立统计，不丢弃', () => {
    const result = summarizePage(
      [
        row({
          quantity: '0',
          financialMovement: '-0.1',
          settlementMovement: '0.2',
        }),
      ],
      'MOVEMENT',
    );
    expect(result).toMatchObject({
      inQuantity: '0',
      outQuantity: '0',
      financialOutAmount: '0.1',
      settlementInAmount: '0.2',
    });
  });
  it('缺失与金额权限分开，SELF_MOVEMENT_ONLY只影响结存', () => {
    expect(displayDecimal(null)).toBe('不可用');
    expect(displayDecimal(null, true)).toBe('****');
    const result = summarizePage(
      [
        row({
          quantity: '-2',
          financialMovement: null,
          settlementMovement: '-3',
          financialMasked: true,
          balanceMasked: true,
          dataStatus: 'SELF_MOVEMENT_ONLY',
        }),
      ],
      'MOVEMENT',
    );
    expect(result).toMatchObject({
      outQuantity: '2',
      financialOutAmount: null,
      settlementOutAmount: '3',
      financialMasked: true,
    });
    const balance = summarizePage(
      [
        row({
          dataStatus: 'MISSING_OPENING',
          closingQuantity: null,
          closingFinancialAmount: null,
        }),
      ],
      'BALANCE',
    );
    expect(balance.dataStatus).toBe('INCOMPLETE');
    expect(balance.closingQuantity).toBeNull();
    expect(balance.closingFinancialAmount).toBeNull();
  });
  it('收发存数量/两套金额按本页求和不将期末混成发生额', () => {
    const result = summarizePage(
      [
        row({
          openingQuantity: '10',
          inQuantity: '5',
          outQuantity: '4',
          closingQuantity: '11',
          openingFinancialAmount: '1000',
          financialInAmount: '650',
          financialOutAmount: '440',
          closingFinancialAmount: '1210',
          openingSettlementAmount: '1200',
          settlementInAmount: '750',
          settlementOutAmount: '520',
          closingSettlementAmount: '1430',
        }),
      ],
      'BALANCE',
    );
    expect(result).toMatchObject({
      openingQuantity: '10',
      inQuantity: '5',
      outQuantity: '4',
      closingQuantity: '11',
      closingFinancialAmount: '1210',
      closingSettlementAmount: '1430',
    });
  });
  it('精确起止时间原值传递且不修改筛选数组，拒绝空区间和无效日期', () => {
    const departments = [2, 3];
    const bizTypes = [50, 60];
    const query = buildReportQuery({
      dates: ['2026-09-01 10:30:00', '2026-10-01 00:00:00'],
      stockDeptIds: departments,
      bizTypes,
      batchNo: ' BATCH-001 ',
    });
    expect(query.postedFrom).toBe('2026-09-01 10:30:00');
    expect(query.postedTo).toBe('2026-10-01 00:00:00');
    departments.push(4);
    bizTypes.push(70);
    expect(query.stockDeptIds).toEqual([2, 3]);
    expect(query.bizTypes).toEqual([50, 60]);
    expect(query.batchNo).toBe('BATCH-001');
    expect(() => buildReportQuery({ dates: [] })).toThrow();
    expect(() =>
      buildReportQuery({
        dates: ['2026-09-01 00:00:00', '2026-09-01 00:00:00'],
      }),
    ).toThrow();
    expect(() =>
      buildReportQuery({
        dates: ['2026-02-30 00:00:00', '2026-03-01 00:00:00'],
      }),
    ).toThrow();
  });
  it('业务分类精确保留负数和零数量成本发生，未知类别不丢弃', () => {
    const result = summarizePage(
      [
        row({
          byBizType: [
            {
              bizType: 999,
              quantity: '-4',
              financialMovement: '-440.000001',
              settlementMovement: '-520',
            },
          ],
        }),
        row({
          byBizType: [
            {
              bizType: 999,
              quantity: '0',
              financialMovement: '0.000002',
              settlementMovement: '-0.1',
            },
          ],
        }),
      ],
      'BALANCE',
    );
    expect(result.byBizType).toEqual([
      {
        bizType: 999,
        quantity: '-4',
        financialMovement: '-439.999999',
        settlementMovement: '-520.1',
      },
    ]);
    expect(
      summarizePage([row({ byBizType: null })], 'BALANCE').byBizType,
    ).toBeNull();
  });
  it('期初金额必填、保留18位精度、数量为0不能带非零成本', () => {
    const values = {
      productId: 1,
      warehouseId: 2,
      quantity: '10',
      financialAmount: '999999999999999999.123456',
      settlementAmount: '1200',
      cutoverAt: '2026-09-01 00:00:00',
      evidence: '核对单A',
    };
    expect(validateOpening(values)).toBeUndefined();
    expect(
      validateOpening({ ...values, financialAmount: undefined }),
    ).toContain('必须填写');
    expect(validateOpening({ ...values, quantity: '0' })).toContain(
      '也必须为0',
    );
    expect(validateOpening({ ...values, evidence: ' ' })).toContain('核对依据');
  });
});
