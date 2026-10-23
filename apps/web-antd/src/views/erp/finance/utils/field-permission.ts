import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';

export function applyFinanceFormFieldPermission(
  schema: VbenFormSchema[],
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyFieldPermission(schema, hiddenFields);
}

export function applyFinanceItemColumnPermission(
  columns: NonNullable<VxeTableGridOptions['columns']>,
  hiddenFields: string[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  if (hiddenFields.length === 0) {
    return columns;
  }
  return columns.filter((column: any) => {
    if (!column.field) {
      return true;
    }
    return !isFieldHidden(hiddenFields, `item_${column.field}`);
  });
}
