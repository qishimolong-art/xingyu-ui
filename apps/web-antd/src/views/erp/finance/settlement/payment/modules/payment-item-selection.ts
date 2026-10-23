import {
  financeValue,
  financeSubtract,
  financeCompare,
  financeSign,
  financeAbs,
} from '#/views/erp/finance/utils/finance-decimal';
interface FinancePaymentWriteOffItem {
  paidPrice?: number | string;
  paymentPrice?: number | string;
  totalPrice?: number | string;
}

/**
 * The selector is the source of truth while the payment form is editable.
 * An empty live selection is intentional and must not fall back to stale form data.
 */
export function resolveCurrentFinancePaymentItems<T>(
  liveItems: T[] | undefined,
  cachedItems: T[] | undefined,
): T[] {
  return liveItems ?? cachedItems ?? [];
}

export function validateFinancePaymentWriteOffItems(
  items: FinancePaymentWriteOffItem[],
) {
  items.forEach((item, index) => {
    const remaining = financeSubtract(
      financeValue(item.totalPrice || 0),
      financeValue(item.paidPrice || 0),
    );
    const amount = financeValue(item.paymentPrice || 0);
    if (
      financeCompare(amount, 0) === 0 ||
      financeCompare(financeSign(amount), financeSign(remaining)) !== 0 ||
      financeCompare(financeAbs(amount), financeAbs(remaining)) > 0
    ) {
      throw new Error(`第 ${index + 1} 行：核销金额必须在未核销金额范围内`);
    }
  });
}
