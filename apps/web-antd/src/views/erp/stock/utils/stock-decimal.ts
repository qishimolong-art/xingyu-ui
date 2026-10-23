import {
  financeMoney,
  financeMoneyGrouped,
} from '#/views/erp/finance/utils/finance-decimal';
export const stockMoney = financeMoney;
export const stockMoneyGrouped = financeMoneyGrouped;
/* eslint-disable unicorn/require-number-to-fixed-digits-argument -- BigNumber.toFixed() preserves all decimal digits. */
import BigNumber from 'bignumber.js';

export type StockDecimal = null | number | string | undefined;
export const STOCK_DECIMAL_MODE = { decimalMode: 'string' } as const;
const Decimal = BigNumber.clone({
  DECIMAL_PLACES: 24,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
});
export function stockDecimal(value: StockDecimal) {
  if (value === null || value === undefined || value === '' || value === '****')
    throw new Error('缺少有效业务数值');
  const decimal = new Decimal(value);
  if (!decimal.isFinite()) throw new Error('必须为有效数字');
  return decimal;
}
export function stockNatural(value: StockDecimal, empty = '-') {
  if (value === '****') return value;
  if (value === null || value === undefined || value === '') return empty;
  try {
    return stockDecimal(value).toFixed();
  } catch {
    return empty;
  }
}
export function stockNaturalGrouped(value: StockDecimal) {
  const text = stockNatural(value);
  if (text === '-' || text === '****') return text;
  const [integer = '0', fraction] = text.split('.');
  const grouped = integer.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}
export function stockListNumber(value: StockDecimal) {
  if (value === '****') return value;
  if (value === null || value === undefined || value === '') return '-';
  try {
    return stockDecimal(value).toFixed(2);
  } catch {
    return '-';
  }
}
export function stockMultiply(a: StockDecimal, b: StockDecimal, scale = 6) {
  if (
    a === null ||
    a === undefined ||
    a === '' ||
    b === null ||
    b === undefined ||
    b === ''
  )
    return undefined;
  return stockDecimal(a).times(stockDecimal(b)).decimalPlaces(scale).toFixed();
}
export function stockProduct(a: StockDecimal, b: StockDecimal) {
  return stockDecimal(a).times(stockDecimal(b)).toFixed();
}
export function stockAdd(a: StockDecimal, b: StockDecimal) {
  return stockDecimal(a).plus(stockDecimal(b)).toFixed();
}
export function stockSubtract(a: StockDecimal, b: StockDecimal) {
  return stockDecimal(a).minus(stockDecimal(b)).toFixed();
}
export function stockDivide(a: StockDecimal, b: StockDecimal, scale = 6) {
  return stockDecimal(a)
    .dividedBy(stockDecimal(b))
    .decimalPlaces(scale)
    .toFixed();
}
export function stockSum(values: StockDecimal[]) {
  let total = new Decimal(0);
  for (const value of values) total = total.plus(stockDecimal(value));
  return total.toFixed();
}

export function stockSumKnown(values: StockDecimal[]) {
  if (values.includes('****')) return '****';
  if (values.some((value) => value == null || value === '')) return undefined;
  return stockSum(values);
}
export function stockInput(
  text: unknown,
  options: { allowZero?: boolean; label?: string; signed?: boolean } = {},
) {
  const value = String(text ?? '').trim();
  if (!(options.signed ? /^-?\d+(?:\.\d*)?$/ : /^\d+(?:\.\d*)?$/).test(value))
    throw new Error(`${options.label || '数值'}格式不正确`);
  const number = stockDecimal(value);
  if (
    !options.signed &&
    (options.allowZero ? number.isNegative() : number.lte(0))
  )
    throw new Error(
      `${options.label || '数值'}必须${options.allowZero ? '不小于' : '大于'}零`,
    );
  return number.toFixed();
}
export function validateStockStorage(
  value: StockDecimal,
  label: string,
  scale = 6,
  integer = 18,
) {
  if (value === null || value === undefined || value === '') return;
  const number = stockDecimal(value);
  if (
    (number.decimalPlaces() ?? 0) > scale ||
    number.abs().gte(new Decimal(10).pow(integer))
  )
    throw new Error(
      `${label}最多支持 ${integer} 位整数和 ${scale} 位有效小数，请调整后保存`,
    );
}

/** Only calculate changed/local rows; saved historical amounts remain authoritative. */
export function stockRoundingRows(
  rows: Record<string, any>[],
  hiddenFields: string[] = [],
) {
  const adjustments: { label: string; raw: string; saved: string }[] = [];
  rows.forEach((row, index) => {
    if (row.operation === 'delete') return;
    for (const field of [
      'count',
      'actualCount',
      'productPrice',
      'weight',
      'totalPrice',
    ]) {
      if (row[field] != null && row[field] !== '') {
        stockInput(row[field], {
          signed: field === 'count' || field === 'totalPrice',
          allowZero: true,
        });
        const labels: Record<string, string> = {
          count: '数量',
          actualCount: '实际库存',
          productPrice: '单价',
          weight: '单重',
          totalPrice: '金额',
        };
        validateStockStorage(row[field], `第 ${index + 1} 行${labels[field]}`);
      }
    }
    if (row.count == null) return;
    for (const [field, label] of [
      ['productPrice', '金额'],
      ['weight', '总重'],
      ['costPrice', '成本金额'],
    ] as const) {
      if (row[field] == null || row[field] === '****') continue;
      const dependencies = [
        field,
        'count',
        (
          {
            productPrice: 'totalPrice',
            weight: 'totalWeight',
            costPrice: 'costAmount',
          } as const
        )[field],
      ];
      if (
        (field !== 'weight' && row.priceVisible === false) ||
        dependencies.some((dependency) =>
          hiddenFields.some((hidden) =>
            [`col_${dependency}`, `item_${dependency}`, dependency].includes(
              hidden,
            ),
          ),
        )
      )
        continue;
      const raw = stockProduct(row.count, row[field]);
      const saved = stockMultiply(row.count, row[field]) ?? '0';
      if (!stockDecimal(raw).eq(saved))
        adjustments.push({
          label: `第 ${index + 1} 行${label}`,
          raw,
          saved: stockNatural(saved),
        });
    }
  });
  return adjustments;
}
