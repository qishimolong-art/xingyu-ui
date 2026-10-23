import type { TradeReportApi } from '#/api/erp/report/trade-v2';
import {
  decimalUnits,
  displayDecimal,
  unitsText,
} from '#/views/erp/stock/report/report-v2-ui';

export const businessTypes = {
  SALE_OUT: '销售出库',
  SALE_RETURN: '销售退货',
  PURCHASE_IN: '采购入库',
  PURCHASE_RETURN: '采购退货',
} as const;
export const reasons: Record<string, string> = {
  NOT_APPLICABLE: '不适用',
  MASKED: '没有金额查看权限',
  SOURCE_SNAPSHOT_MISSING: '缺少当时交易快照',
  HEADER_ALLOCATION_PENDING: '头部折扣或费用尚未分配至商品',
  TAX_BASIS_UNCONFIRMED: '税率和未税金额尚未确认',
  SETTLEMENT_ALLOCATION_PENDING: '商品收付款及余额归集尚未接入',
  FEE_ALLOCATION_PENDING: '费用分摊依据尚未配置',
  ORIGINAL_SNAPSHOT_MISSING: '缺少原销售属性快照',
  ZERO_DENOMINATOR: '分母为零',
  NO_ORIGINAL_SALE: '无原销售记录',
  COST_BASIS_NOT_RECORDED: '当时成本依据未记录',
};
export const groupLabels: Record<string, string> = {
  CUSTOMER: '客户',
  SUPPLIER: '供应商',
  PRODUCT: '商品',
  OE: 'OE号',
  BRAND: '品牌',
  CATEGORY: '品类',
  ACCOUNTING_DEPT: '核算部门',
  STOCK_DEPT: '库存部门',
  WAREHOUSE: '仓库',
  SALE_USER: '销售人员',
  PURCHASER: '采购员',
};
export const sourceTypes: Record<string, { type: number; permission: string }> =
  {
    SALE_OUT: { type: 50, permission: 'erp:sale-out:query' },
    SALE_RETURN: { type: 60, permission: 'erp:sale-return:query' },
    PURCHASE_IN: { type: 70, permission: 'erp:purchase-in:query' },
    PURCHASE_RETURN: { type: 80, permission: 'erp:purchase-return:query' },
  };
export function referenceTarget(row: Record<string, unknown>, field: string) {
  if (
    row.businessType === 'SALE_RETURN' &&
    field === 'originalBizNo' &&
    row.sourceRole !== 'NO_ORIGINAL_SALE' &&
    typeof row.originalBizId === 'number' &&
    row.originalBizId > 0
  ) {
    return { ...sourceTypes.SALE_OUT!, id: row.originalBizId };
  }
  if (row.businessType !== 'PURCHASE_RETURN') return undefined;
  if (
    field === 'sourcePurchaseInNo' &&
    row.sourceRole === 'SOURCE_PURCHASE_IN' &&
    typeof row.sourcePurchaseInId === 'number' &&
    row.sourcePurchaseInId > 0
  ) {
    return { ...sourceTypes.PURCHASE_IN!, id: row.sourcePurchaseInId };
  }
  if (
    field === 'traceSaleReturnNo' &&
    typeof row.traceSaleReturnId === 'number' &&
    row.traceSaleReturnId > 0
  ) {
    return { ...sourceTypes.SALE_RETURN!, id: row.traceSaleReturnId };
  }
  return undefined;
}
export const numericLabels: Record<string, string> = {
  positiveQuantity: '正向销售/采购数量',
  returnQuantity: '退货数量',
  netQuantity: '净数量',
  rawUnitPrice: '原含税单价',
  rawGrossAmount: '原含税行额（带方向）',
  positiveGrossAmount: '销售/采购含税额',
  returnGrossAmount: '退货含税额',
  grossAmount: '含税净交易额',
  netAmount: '未税净交易额',
  financialUnitCost: '财务成本单价',
  settlementUnitCost: '结算成本单价',
  positiveFinancialCost: '正向财务成本',
  returnFinancialCost: '退货财务成本',
  financialCost: '财务净成本',
  positiveSettlementCost: '正向结算成本',
  returnSettlementCost: '退货结算成本',
  settlementCost: '结算净成本',
  financialGrossProfit: '财务毛利',
  financialMargin: '财务毛利率',
  settlementGrossProfit: '部门毛利',
  settlementMargin: '部门毛利率',
  freightAllocatedAmount: '运费分摊',
  otherFeeAllocatedAmount: '其他费用分摊',
  returnDifferenceProfit: '退货差额损益',
  receivedAmount: '已收金额',
  paidAmount: '已付金额',
  refundedAmount: '退款金额',
  receivableBalance: '应收余额',
  payableBalance: '应付余额',
};
export const totalFields = Object.keys(numericLabels).filter(
  (key) =>
    ![
      'rawUnitPrice',
      'financialUnitCost',
      'settlementUnitCost',
      'financialMargin',
      'settlementMargin',
    ].includes(key),
);
function metricStates(row: Record<string, unknown>): Record<string, unknown> {
  return row.metricStates && typeof row.metricStates === 'object'
    ? (row.metricStates as Record<string, unknown>)
    : {};
}
export function cellReason(
  row: Record<string, unknown>,
  field: string,
): string {
  const code = metricStates(row)[field];
  return typeof code === 'string' ? reasons[code] || code : '';
}
export function tradeCell(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  const state = metricStates(row)[field];
  if (state === 'MASKED') return '****';
  if (state === 'NOT_APPLICABLE') return '不适用';
  if (state === 'NO_ORIGINAL_SALE') return '无原销售记录';
  if (field === 'returnMode')
    return value === 10
      ? row.businessType === 'SALE_RETURN'
        ? '按原销售单退货'
        : '按采购入库单退货'
      : value === 20
        ? '按库存退货'
        : '未记录';
  if (field === 'costBasis')
    return value === 'CURRENT_AVERAGE'
      ? '退货时两套当前均价'
      : value === 'MANUAL_CONFIRMED'
        ? '人工确认成本'
        : '未记录';
  if (field === 'sourceRole') {
    const labels: Record<string, string> = {
      SOURCE_PURCHASE_IN: '原采购入库追溯',
      NO_ORIGINAL_PURCHASE: '无原采购入库',
      NO_ORIGINAL_SALE: '无原销售单',
      ORIGINAL_SALE: '原销售',
      SOURCE_ORDER: '来源订单',
    };
    return typeof value === 'string' ? labels[value] || '未记录' : '未记录';
  }
  if (field === 'returnDifferenceStatus')
    return typeof value === 'string' ? reasons[value] || '未记录' : '未记录';
  if (field === 'dataStatus')
    return value === 'POSTED'
      ? '已过账'
      : value === 'SOURCE_SNAPSHOT_MISSING'
        ? '缺当时交易快照'
        : '待核对';
  if (numericLabels[field])
    return typeof value === 'string' ? displayDecimal(value) : '不可用';
  if (field === 'businessType')
    return typeof value === 'string'
      ? businessTypes[value as keyof typeof businessTypes] || value
      : '未记录';
  if (field === 'noOriginalSale')
    return value === null || value === undefined
      ? '—'
      : value === true || value === 1
        ? '是'
        : '否';
  return value === null || value === undefined || typeof value === 'object'
    ? '未记录'
    : String(value);
}
export function pageTotals(
  rows: TradeReportApi.Row[],
  summary?: TradeReportApi.Row,
): TradeReportApi.Row {
  const result: TradeReportApi.Row = { metricStates: {} };
  for (const field of totalFields) {
    let total = 0n;
    let applicableRows = 0;
    let missing =
      rows.length === 0
        ? summary?.metricStates?.[field] ||
          (typeof summary?.[field] === 'string'
            ? ''
            : 'SOURCE_SNAPSHOT_MISSING')
        : '';
    for (const row of rows) {
      const state = row.metricStates?.[field];
      if (state === 'NOT_APPLICABLE') continue;
      applicableRows++;
      if (state === 'MASKED') {
        missing = 'MASKED';
        break;
      }
      const value = row[field];
      const units = typeof value === 'string' ? decimalUnits(value) : undefined;
      if (units === undefined) missing = state || 'SOURCE_SNAPSHOT_MISSING';
      else total += units;
    }
    if (rows.length > 0 && applicableRows === 0) missing = 'NOT_APPLICABLE';
    result[field] = missing ? null : unitsText(total);
    if (missing) result.metricStates![field] = missing;
  }
  return result;
}
