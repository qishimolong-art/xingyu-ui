import type { ErpReceivableAccountApi } from '#/api/erp/finance/receivable/account';

export type ReceivableDetailSortOrder = 'asc' | 'desc';

const textCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

function isBlank(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function comparePopulatedValues(left: unknown, right: unknown) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return textCollator.compare(String(left), String(right));
}

/** 按展示值稳定排序，并保证空值在升序、降序时均位于末尾。 */
export function sortReceivableDetails(
  rows: ErpReceivableAccountApi.ReceivableDetail[],
  field: keyof ErpReceivableAccountApi.ReceivableDetail,
  order: ReceivableDetailSortOrder,
) {
  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = leftItem.row[field];
      const right = rightItem.row[field];
      const leftBlank = isBlank(left);
      const rightBlank = isBlank(right);
      if (leftBlank || rightBlank) {
        if (leftBlank !== rightBlank) {
          return leftBlank ? 1 : -1;
        }
        return leftItem.index - rightItem.index;
      }
      const compared = comparePopulatedValues(left, right);
      if (compared === 0) {
        return leftItem.index - rightItem.index;
      }
      return order === 'asc' ? compared : -compared;
    })
    .map(({ row }) => row);
}
