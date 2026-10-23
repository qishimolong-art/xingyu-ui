import type { StockReportV2Api } from '#/api/erp/report/stock-v2';

import dayjs from 'dayjs';

const SCALE = 1_000_000n;

/** 六位定点运算，保留缺失状态，避免浮点累加及把未知值计作零。 */
export function decimalUnits(
  value: number | StockReportV2Api.Decimal | undefined,
): bigint | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) ||
      Math.abs(value) > Number.MAX_SAFE_INTEGER / 1_000_000)
  )
    return undefined;
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d{0,6}))?$/);
  if (!match) return undefined;
  const integerPart = match[2];
  if (!integerPart) return undefined;
  return (
    (match[1] ? -1n : 1n) *
    (BigInt(integerPart) * SCALE + BigInt((match[3] || '').padEnd(6, '0')))
  );
}

export function unitsText(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const fraction = String(absolute % SCALE)
    .padStart(6, '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${absolute / SCALE}${fraction ? `.${fraction}` : ''}`;
}

export function displayDecimal(
  value: StockReportV2Api.Decimal | undefined,
  masked = false,
): string {
  if (masked) return '****';
  const units = decimalUnits(value);
  if (units === undefined) return '不可用';
  const [integer, fraction] = unitsText(units).split('.');
  const formattedInteger = (integer || '0').replaceAll(
    /\B(?=(\d{3})+(?!\d))/g,
    ',',
  );
  return `${formattedInteger}${fraction ? `.${fraction}` : ''}`;
}

export const dataStatusLabels: Record<string, string> = {
  READY: '数据可计算',
  COMPLETE: '完整',
  INCOMPLETE: '数据不完整',
  MISSING_OPENING: '缺少期初核对',
  BEFORE_CUTOVER: '期间超出切换覆盖范围',
  STALE_OPENING: '期初与当前库存不一致，需复核',
  SELF_MOVEMENT_ONLY: '仅本人发生额，无权查看完整库存结存',
};

export function stockOriginLabel(originKind: unknown): string {
  if (originKind === 'MANUAL_OPENING') return '人工核对期初';
  if (originKind === 'NEW_DIMENSION') return '新库存受控起点';
  return '未记录起点来源';
}

export function defaultPostingRange(): [string, string] {
  return [
    dayjs().subtract(29, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
    dayjs().add(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
  ];
}

export function buildReportQuery(filters: {
  batchNo?: string;
  bizTypes?: number[];
  dates?: string[];
  productId?: number;
  stockDeptIds?: number[];
  warehouseId?: number;
}): StockReportV2Api.Query {
  const [start, end] = filters.dates || [];
  if (
    !start ||
    !end ||
    !dayjs(start).isValid() ||
    !dayjs(end).isValid() ||
    dayjs(start).format('YYYY-MM-DD HH:mm:ss') !== start ||
    dayjs(end).format('YYYY-MM-DD HH:mm:ss') !== end ||
    !dayjs(start).isBefore(dayjs(end))
  ) {
    throw new Error('请选择有效的起止时间，截止时间必须晚于开始时间');
  }
  return {
    postedFrom: start,
    postedTo: end,
    productId: filters.productId,
    warehouseId: filters.warehouseId,
    stockDeptIds: filters.stockDeptIds?.length
      ? [...filters.stockDeptIds]
      : undefined,
    bizTypes: filters.bizTypes?.length ? [...filters.bizTypes] : undefined,
    batchNo: filters.batchNo?.trim() || undefined,
  };
}

export function summarizePage(
  rows: StockReportV2Api.Row[],
  type: StockReportV2Api.ReportType,
): StockReportV2Api.Summary {
  const result: StockReportV2Api.Summary = {
    rowCount: rows.length,
    financialMasked: rows.some((row) => row.financialMasked),
    settlementMasked: rows.some((row) => row.settlementMasked),
    dataStatus: rows.some(
      (row) =>
        row.dataStatus &&
        !['READY', 'SELF_MOVEMENT_ONLY'].includes(row.dataStatus),
    )
      ? 'INCOMPLETE'
      : 'COMPLETE',
  };
  const sum = (field: keyof StockReportV2Api.Row, direction?: 'in' | 'out') => {
    let total = 0n;
    for (const row of rows) {
      const value = decimalUnits(row[field] as StockReportV2Api.Decimal);
      if (value === undefined) return null;
      if (direction === 'in') {
        total += value > 0n ? value : 0n;
      } else if (direction === 'out') {
        total += value < 0n ? -value : 0n;
      } else {
        total += value;
      }
    }
    return unitsText(total);
  };
  if (type === 'MOVEMENT') {
    result.inQuantity = sum('quantity', 'in');
    result.outQuantity = sum('quantity', 'out');
    result.financialInAmount = result.financialMasked
      ? null
      : sum('financialMovement', 'in');
    result.financialOutAmount = result.financialMasked
      ? null
      : sum('financialMovement', 'out');
    result.settlementInAmount = result.settlementMasked
      ? null
      : sum('settlementMovement', 'in');
    result.settlementOutAmount = result.settlementMasked
      ? null
      : sum('settlementMovement', 'out');
  } else {
    result.byBizType =
      result.dataStatus === 'INCOMPLETE' ? null : summarizeBusinessTypes(rows);
    for (const field of [
      'openingQuantity',
      'inQuantity',
      'outQuantity',
      'closingQuantity',
      'openingFinancialAmount',
      'financialInAmount',
      'financialOutAmount',
      'closingFinancialAmount',
      'openingSettlementAmount',
      'settlementInAmount',
      'settlementOutAmount',
      'closingSettlementAmount',
    ] as const) {
      const masked = field.toLowerCase().includes('financial')
        ? result.financialMasked
        : field.toLowerCase().includes('settlement')
          ? result.settlementMasked
          : false;
      result[field] =
        masked || result.dataStatus === 'INCOMPLETE' ? null : sum(field);
    }
  }
  return result;
}

export function summarizeBusinessTypes(
  rows: StockReportV2Api.Row[],
): null | StockReportV2Api.BusinessTypeAmount[] {
  if (rows.some((row) => !Array.isArray(row.byBizType))) return null;
  const names = new Map<number, string>();
  const totals = new Map<
    number,
    Record<
      'financialMovement' | 'quantity' | 'settlementMovement',
      bigint | null
    >
  >();
  for (const row of rows) {
    for (const item of row.byBizType || []) {
      if (item.bizTypeName) names.set(item.bizType, item.bizTypeName);
      const target = totals.get(item.bizType) || {
        quantity: 0n,
        financialMovement: 0n,
        settlementMovement: 0n,
      };
      for (const field of [
        'quantity',
        'financialMovement',
        'settlementMovement',
      ] as const) {
        const value = decimalUnits(item[field]);
        const masked =
          field === 'financialMovement'
            ? row.financialMasked
            : field === 'settlementMovement'
              ? row.settlementMasked
              : false;
        const current = target[field];
        target[field] =
          masked || value === undefined || current === null
            ? null
            : current + value;
      }
      totals.set(item.bizType, target);
    }
  }
  return [...totals]
    .toSorted(([a], [b]) => a - b)
    .map(([bizType, amounts]) => ({
      bizType,
      ...(names.has(bizType) ? { bizTypeName: names.get(bizType) } : {}),
      quantity: amounts.quantity === null ? null : unitsText(amounts.quantity),
      financialMovement:
        amounts.financialMovement === null
          ? null
          : unitsText(amounts.financialMovement),
      settlementMovement:
        amounts.settlementMovement === null
          ? null
          : unitsText(amounts.settlementMovement),
    }));
}

/** 与后端 ErpStockRecordBizTypeEnum 对应；未知值保留原编号。 */
export const businessTypeLabels: Record<number, string> = {
  10: '其它入库',
  11: '其它入库（作废）',
  20: '其它出库',
  21: '其它出库（作废）',
  30: '调拨入库',
  31: '调拨入库（作废）',
  32: '调拨出库',
  33: '调拨出库（作废）',
  34: '仓库移货入库',
  35: '仓库移货出库',
  40: '盘盈入库',
  41: '盘盈入库（作废）',
  42: '盘亏出库',
  43: '盘亏出库（作废）',
  50: '销售出库',
  51: '销售出库（作废）',
  60: '销售退货入库',
  61: '销售退货入库（作废）',
  70: '采购入库',
  71: '采购入库（作废）',
  80: '采购退货出库',
  81: '采购退货出库（作废）',
  90: '采购调价',
  91: '采购调价（作废）',
  92: '销售调价',
};

export function historicalOptionLabel(
  option: StockReportV2Api.HistoricalOption,
) {
  return `${option.name}${option.archived ? '（已归档，历史可查）' : option.status !== undefined && option.status !== 0 ? '（已停用，历史可查）' : ''}`;
}

export const sourceTargets: Record<
  number,
  { key: string; permission: string }
> = Object.fromEntries(
  (
    [
      [[10, 11], 'stockIn', 'erp:stock-in:query'],
      [[20, 21], 'stockOut', 'erp:stock-out:query'],
      [[30, 31, 32, 33], 'stockMove', 'erp:stock-move:query'],
      [[34, 35], 'warehouseMove', 'erp:warehouse-move:query'],
      [[40, 41, 42, 43], 'stockCheck', 'erp:stock-check:query'],
      [[50, 51], 'saleOut', 'erp:sale-out:query'],
      [[60, 61], 'saleReturn', 'erp:sale-return:query'],
      [[70, 71], 'purchaseIn', 'erp:purchase-in:query'],
      [[80, 81], 'purchaseReturn', 'erp:purchase-return:query'],
      [[90, 91], 'purchaseAdjust', 'erp:purchase-price-adjust:query'],
      [[92], 'saleAdjust', 'erp:sale-price-adjust:query'],
      [[100, 101, 102, 103], 'assemblyOrder', 'erp:assembly-order:query'],
    ] satisfies Array<[number[], string, string]>
  ).flatMap(([types, key, permission]) =>
    types.map((type) => [type, { key, permission }]),
  ),
);

export function validateOpening(
  values: Partial<StockReportV2Api.Opening>,
): string | undefined {
  if (!values.productId || !values.warehouseId)
    return '请选择配件和有权限的仓库';
  for (const field of [
    'quantity',
    'financialAmount',
    'settlementAmount',
  ] as const) {
    const text = values[field];
    if (typeof text !== 'string' || !/^\d{1,18}(\.\d{1,6})?$/.test(text))
      return '数量及两套成本金额必须填写非负数，最多18位整数、6位小数';
  }
  if (
    decimalUnits(values.quantity) === 0n &&
    (decimalUnits(values.financialAmount) !== 0n ||
      decimalUnits(values.settlementAmount) !== 0n)
  )
    return '期初数量为0时，两套成本金额也必须为0';
  if (
    !values.cutoverAt ||
    !dayjs(values.cutoverAt).isValid() ||
    dayjs(values.cutoverAt).format('YYYY-MM-DD HH:mm:ss') !== values.cutoverAt
  )
    return '请选择核算切换时间';
  if (!values.evidence?.trim() || values.evidence.trim().length > 500)
    return '请填写核对依据（1至500字）';
  return undefined;
}
