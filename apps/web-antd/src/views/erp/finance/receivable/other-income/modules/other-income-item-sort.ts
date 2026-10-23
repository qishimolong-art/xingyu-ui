import type { ErpReceivableOtherIncomeApi } from '#/api/erp/finance/receivable/other-income';

export type OtherIncomeItemSortOrder = 'asc' | 'desc';

interface DisplayOption {
  label: string;
  value: number;
}

interface SortContext {
  customerOptions?: DisplayOption[];
  deptOptions?: DisplayOption[];
  userOptions?: DisplayOption[];
}

const numericFields = new Set(['amount', 'qty']);

function isBlank(value: unknown) {
  return value === null || value === undefined || value === '';
}

function getOptionLabel(options: DisplayOption[] = [], value: unknown) {
  return options.find((option) => option.value === Number(value))?.label ?? '';
}

function getDisplayValue(
  row: ErpReceivableOtherIncomeApi.Item,
  field: string,
  context: SortContext,
) {
  if (field === 'deptId') {
    return row.deptName || getOptionLabel(context.deptOptions, row.deptId);
  }
  if (field === 'customerId') {
    return (
      row.customerName ||
      row.party ||
      getOptionLabel(context.customerOptions, row.customerId)
    );
  }
  if (field === 'handlerId') {
    return (
      row.handlerName || getOptionLabel(context.userOptions, row.handlerId)
    );
  }
  return (row as Record<string, unknown>)[field];
}

function compareValues(left: unknown, right: unknown, field: string) {
  if (numericFields.has(field)) {
    return Number(left) - Number(right);
  }
  if (field === 'bizDate') {
    return new Date(String(left)).getTime() - new Date(String(right)).getTime();
  }
  return String(left).localeCompare(String(right), 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function sortOtherIncomeItems(
  rows: ErpReceivableOtherIncomeApi.Item[],
  field: string,
  order: OtherIncomeItemSortOrder,
  context: SortContext = {},
) {
  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((leftEntry, rightEntry) => {
      const left = getDisplayValue(leftEntry.row, field, context);
      const right = getDisplayValue(rightEntry.row, field, context);
      const leftBlank = isBlank(left);
      const rightBlank = isBlank(right);

      if (leftBlank || rightBlank) {
        if (leftBlank && rightBlank) {
          return leftEntry.index - rightEntry.index;
        }
        return leftBlank ? 1 : -1;
      }

      const result = compareValues(left, right, field);
      if (result === 0) {
        return leftEntry.index - rightEntry.index;
      }
      return order === 'desc' ? -result : result;
    })
    .map(({ row }) => row);
}
