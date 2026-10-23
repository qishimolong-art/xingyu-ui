import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';

type HiddenFields = Set<string> | string[];

const queryFieldPermissionAliases: Record<string, string[]> = {
  productKeyword: ['productId'],
};

export function isSameFieldSet(left: string[] = [], right: string[] = []) {
  const leftFields = new Set(left);
  const rightFields = new Set(right);
  if (leftFields.size !== rightFields.size) {
    return false;
  }
  return [...leftFields].every((field) => rightFields.has(field));
}

export function applyStockFormFieldPermission(
  schema: VbenFormSchema[],
  hiddenFields: HiddenFields = [],
) {
  return applyFieldPermission(schema, hiddenFields);
}

export function applyStockItemColumnPermission(
  columns: VxeTableGridOptions['columns'],
  hiddenFields: HiddenFields = [],
) {
  return columns?.filter((column) => {
    if (!column || typeof column !== 'object' || !('field' in column)) {
      return true;
    }
    const field = column.field;
    if (!field) {
      return true;
    }
    return !isFieldHidden(hiddenFields, `item_${String(field)}`);
  });
}

export function applyStockListColumnPermission(
  columns: VxeTableGridOptions['columns'],
  hiddenFields: HiddenFields = [],
) {
  return columns?.filter((column) => {
    if (!column || typeof column !== 'object' || !('field' in column)) {
      return true;
    }
    const field = column.field;
    if (!field) {
      return true;
    }
    return !isFieldHidden(hiddenFields, `col_${String(field)}`);
  });
}

export function applyStockReportColumnPermission(
  columns: VxeTableGridOptions['columns'],
  hiddenFields: HiddenFields = [],
) {
  return columns?.filter((column) => {
    if (!column || typeof column !== 'object' || !('field' in column)) {
      return true;
    }
    const field = column.field;
    if (!field) {
      return true;
    }
    return !isFieldHidden(hiddenFields, `report_${String(field)}`);
  });
}

export function applyStockQueryFieldPermission(
  schema: VbenFormSchema[],
  hiddenFields: HiddenFields = [],
) {
  return schema.filter((item) => {
    const fieldName = String(item.fieldName || '');
    if (isFieldHidden(hiddenFields, `query_${fieldName}`)) {
      return false;
    }
    return !queryFieldPermissionAliases[fieldName]?.some((alias) =>
      isFieldHidden(hiddenFields, `query_${alias}`),
    );
  });
}
