import {
  financeDecimal,
  financeMoney,
  financeCompare,
} from './finance-decimal';
export function getTransferAmountError(
  value: unknown,
  limit: number | string | null,
): string {
  if (limit == null) return '可转额度暂不可用，请刷新后重试';
  try {
    const amount = financeDecimal((value ?? 0) as number | string);
    const cap = financeDecimal(limit);
    if (amount.isZero()) return '';
    if (
      amount.isNegative() !== cap.isNegative() ||
      financeCompare(amount.abs().toFixed(), cap.abs().toFixed()) > 0
    )
      return `本次转款金额不能超过剩余可转金额 ${financeMoney(limit)} 元`;
    return '';
  } catch {
    return '可转额度或转款金额无效，请检查后重试';
  }
}
