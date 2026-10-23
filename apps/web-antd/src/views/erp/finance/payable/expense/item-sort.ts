import type { ErpPayableExpenseApi } from '#/api/erp/finance/payable/expense';

export type PayableExpenseItemSortOrder = 'asc' | 'desc' | null;

const numericFields = new Set(['amount', 'qty']);
const dateFields = new Set(['bizDate']);

function isBlank(value: unknown) {
  return value === null || value === undefined || value === '';
}

function compareValues(left: unknown, right: unknown, field: string) {
  if (numericFields.has(field)) {
    return Number(left) - Number(right);
  }
  if (dateFields.has(field)) {
    return Date.parse(String(left)) - Date.parse(String(right));
  }
  return String(left).localeCompare(String(right), 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function sortPayableExpenseItems(
  rows: ErpPayableExpenseApi.PayableExpenseItem[],
  field?: string,
  order?: PayableExpenseItemSortOrder,
) {
  if (!field || !order) {
    return [...rows];
  }

  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((leftEntry, rightEntry) => {
      const left = (leftEntry.row as Record<string, unknown>)[field];
      const right = (rightEntry.row as Record<string, unknown>)[field];
      const leftBlank = isBlank(left);
      const rightBlank = isBlank(right);

      if (leftBlank || rightBlank) {
        if (leftBlank && rightBlank) {
          return leftEntry.index - rightEntry.index;
        }
        return leftBlank ? 1 : -1;
      }

      const compared = compareValues(left, right, field);
      if (compared === 0) {
        return leftEntry.index - rightEntry.index;
      }
      return order === 'desc' ? -compared : compared;
    })
    .map(({ row }) => row);
}
