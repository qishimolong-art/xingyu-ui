import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';

export function applyAccountingFormFieldPermission(
  schema: VbenFormSchema[],
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyFieldPermission(schema, hiddenFields);
}

export function applyAccountingColumnPermission(
  columns: VxeTableGridOptions['columns'],
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  if (!hiddenFields.length) {
    return columns;
  }
  return columns?.filter((column: any) => {
    if (!column.field) {
      return true;
    }
    return !isFieldHidden(hiddenFields, `col_${column.field}`);
  });
}

export function applyAccountingItemColumnPermission(
  columns: VxeTableGridOptions['columns'],
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  if (!hiddenFields.length) {
    return columns;
  }
  return columns?.filter((column: any) => {
    if (!column.field) {
      return true;
    }
    return !isFieldHidden(hiddenFields, `item_${column.field}`);
  });
}
