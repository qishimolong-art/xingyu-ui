import { financeValue, financeSum, financeSubtract, financeCompare } from '../utils/finance-decimal';
import type { FinanceDecimal } from '../utils/finance-decimal';
export function normalizeFinanceAmount(value?: FinanceDecimal) { return financeValue(value ?? 0); }
export function sumFinanceAmounts(values: Iterable<FinanceDecimal>) { return financeSum(values); }
export function subtractFinanceAmounts(value?: FinanceDecimal, ...others: FinanceDecimal[]) { return financeSubtract(value, ...others); }

/** 根据已选核销金额计算单据合计和实付/实收金额。 */
/**
 * 记录最近一次由程序写入的金额，用于区分异步表单监听中的自动赋值和用户编辑。
 */
export function createProgrammaticFinanceAmountGuard() {
  let expectedAmount: string | undefined;

  return {
    clear() {
      expectedAmount = undefined;
    },
    expect(value?: null | number | string) {
      expectedAmount = normalizeFinanceAmount(value);
    },
    isExpected(value?: null | number | string) {
      return (
        expectedAmount !== undefined &&
        financeCompare(expectedAmount, normalizeFinanceAmount(value)) === 0
      );
    },
  };
}

export function calculateSettlementDocumentAmounts(
  itemAmounts: Iterable<null | number | string | undefined>,
  discountPrice?: null | number | string,
  options?: {
    currentTotalPrice?: null | number | string;
    totalPriceManuallyEdited?: boolean;
  },
) {
  const allocatedPrice = sumFinanceAmounts(itemAmounts);
  const totalPrice = options?.totalPriceManuallyEdited
    ? normalizeFinanceAmount(options.currentTotalPrice)
    : allocatedPrice;
  return {
    allocatedPrice,
    totalPrice,
    actualPrice: subtractFinanceAmounts(totalPrice, discountPrice),
  };
}
