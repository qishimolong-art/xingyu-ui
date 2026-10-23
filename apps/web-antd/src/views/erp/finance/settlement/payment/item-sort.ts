import {
  financeValue,
  financeSubtract,
} from '#/views/erp/finance/utils/finance-decimal';
export type PaymentItemSortOrder = 'asc' | 'desc' | null;

const NUMERIC_FIELDS = new Set([
  'paidPrice',
  'paymentPrice',
  'totalPrice',
  'unPaymentPrice',
]);

const DATE_FIELDS = new Set(['bizTime', 'paymentTime']);

function isBlank(value: unknown) {
  return value === undefined || value === null || value === '';
}

function getSortValue(row: Record<string, any>, field: string) {
  if (field === 'unPaymentPrice') {
    return financeSubtract(
      financeSubtract(
        financeValue(row.totalPrice || 0),
        financeValue(row.paidPrice || 0),
      ),
      financeValue(row.paymentPrice || 0),
    );
  }
  return row[field];
}

function getDateValue(value: unknown) {
  if (value instanceof Date) return value.getTime();
  return Number(value) || Date.parse(String(value)) || 0;
}

function compareValues(left: unknown, right: unknown, field: string) {
  if (NUMERIC_FIELDS.has(field)) {
    return Number(left) - Number(right);
  }
  if (DATE_FIELDS.has(field)) {
    return getDateValue(left) - getDateValue(right);
  }
  return String(left).localeCompare(String(right), 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function sortFinancePaymentItems<T extends Record<string, any>>(
  rows: T[],
  field?: string,
  order?: PaymentItemSortOrder,
) {
  if (!field || !order) return [...rows];

  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = getSortValue(leftItem.row, field);
      const right = getSortValue(rightItem.row, field);
      const leftBlank = isBlank(left);
      const rightBlank = isBlank(right);
      if (leftBlank || rightBlank) {
        if (leftBlank && rightBlank) return leftItem.index - rightItem.index;
        return leftBlank ? 1 : -1;
      }

      const compared = compareValues(left, right, field);
      if (compared === 0) return leftItem.index - rightItem.index;
      return order === 'asc' ? compared : -compared;
    })
    .map(({ row }) => row);
}
