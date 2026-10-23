/* eslint-disable unicorn/require-number-to-fixed-digits-argument -- BigNumber.toFixed() keeps all business digits. */
import BigNumber from 'bignumber.js';

export type FinanceDecimal = null | number | string | undefined;
const Decimal = BigNumber.clone({ DECIMAL_PLACES: 24, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
export function financeDecimal(value: FinanceDecimal) {
  if (value == null || value === '' || value === '****') throw new Error('缺少有效金额');
  const result = new Decimal(value);
  if (!result.isFinite()) throw new Error('必须为有效数字');
  return result;
}
export function financeValue(value: FinanceDecimal) { return financeDecimal(value).toFixed(); }
export function financeMoney(value: FinanceDecimal, empty = '-') {
  if (value === '****') return value;
  if (value == null || value === '') return empty;
  try {
    const decimal = financeDecimal(value);
    return decimal.toFixed(Math.max(2, decimal.decimalPlaces() ?? 0));
  } catch { return empty; }
}
export function financeListMoney(value: FinanceDecimal) {
  if (value === '****') return value;
  if (value == null || value === '') return '-';
  try { return financeDecimal(value).toFixed(2); } catch { return '-'; }
}
export function financeMoneyGrouped(value: FinanceDecimal) {
  const [integer = '', fraction] = financeMoney(value).split('.');
  const grouped = integer.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
export function financeSum(values: Iterable<FinanceDecimal>) {
  let total = new Decimal(0);
  for (const value of values) total = total.plus(financeDecimal(value ?? 0));
  return total.toFixed();
}
export function financeSubtract(value: FinanceDecimal, ...others: FinanceDecimal[]) {
  let result = financeDecimal(value ?? 0);
  for (const other of others) result = result.minus(financeDecimal(other ?? 0));
  return result.toFixed();
}
export function financeCompare(a: FinanceDecimal, b: FinanceDecimal) {
  return financeDecimal(a).comparedTo(financeDecimal(b))!;
}
export function financeMultiply(a: FinanceDecimal, b: FinanceDecimal) {
  return financeDecimal(a).times(financeDecimal(b)).toFixed();
}
export function validateFinanceStorage(value: FinanceDecimal, label = '金额', scale = 6, integer = 18) {
  if (value == null || value === '') return;
  if (!/^-?\d+(?:\.\d*)?$/.test(String(value))) throw new Error(`${label}格式不正确`);
  const decimal = financeDecimal(value);
  if ((decimal.decimalPlaces() ?? 0) > scale || decimal.abs().gte(new Decimal(10).pow(integer))) {
    throw new Error(`${label}最多支持 ${integer} 位整数和 ${scale} 位有效小数，末尾零不计`);
  }
}

export function financeAdd(a: FinanceDecimal, b: FinanceDecimal) { return financeSum([a,b]); }
export function financeDivide(a: FinanceDecimal, b: FinanceDecimal) { return financeDecimal(a).dividedBy(financeDecimal(b)).toFixed(); }
export function financeAbs(value: FinanceDecimal) { return financeDecimal(value).abs().toFixed(); }
export function financeSign(value: FinanceDecimal) { const decimal=financeDecimal(value); return decimal.isZero() ? 0 : decimal.isNegative() ? -1 : 1; }
export function financeMin(...values: FinanceDecimal[]) { return Decimal.minimum(...values.map(value=>financeDecimal(value))).toFixed(); }
export function financeMax(...values: FinanceDecimal[]) { return Decimal.maximum(...values.map(value=>financeDecimal(value))).toFixed(); }
