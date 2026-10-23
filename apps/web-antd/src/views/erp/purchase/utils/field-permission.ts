import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';

type HiddenFields = Set<string> | string[];

export function isSameFieldSet(left: string[] = [], right: string[] = []) {
  const leftFields = new Set(left);
  const rightFields = new Set(right);
  if (leftFields.size !== rightFields.size) {
    return false;
  }
  return [...leftFields].every((field) => rightFields.has(field));
}

const ERP_DOCUMENT_TAX_FIELDS = new Set([
  'taxPercent',
  'taxRate',
  'taxPrice',
  'totalTaxPrice',
  'taxAmount',
  'taxExclusiveAmount',
  'taxExclusivePrice',
  'taxInclusivePrice',
  'taxInclusiveAmount',
]);

export function applyPurchaseFormFieldPermission(
  schema: VbenFormSchema[],
  hiddenFields: HiddenFields = [],
) {
  return applyFieldPermission(
    schema.filter(
      (item) => !ERP_DOCUMENT_TAX_FIELDS.has(String(item.fieldName)),
    ),
    hiddenFields,
  );
}

export function applyPurchaseItemColumnPermission(
  columns: VxeTableGridOptions['columns'],
  hiddenFields: HiddenFields = [],
) {
  return columns?.filter((column) => {
    if (!column || typeof column !== 'object') {
      return true;
    }
    const field = (column as { field?: unknown }).field;
    if (!field) {
      return true;
    }
    const fieldName = String(field);
    return (
      !ERP_DOCUMENT_TAX_FIELDS.has(fieldName) &&
      !isFieldHidden(hiddenFields, `item_${fieldName}`)
    );
  });
}

const PURCHASE_GRID_FIELD_ALIASES: Record<string, string[]> = {
  accountName: ['accountId'],
  adjusterName: ['adjuster'],
  auditUserName: ['updater'],
  contactInfo: ['mobile', 'telephone'],
  creatorName: ['creator'],
  deptName: ['deptId'],
  displayTaxPercent: ['taxPercent'],
  handlerName: ['handler', 'handlerId'],
  productNames: ['item_productId', 'productId', 'items'],
  purchaserName: ['purchaser'],
  supplierName: ['supplierId'],
  updaterName: ['updater'],
};

export function applyPurchaseGridFormFieldPermission(
  schema: VbenFormSchema[],
  hiddenFields: HiddenFields = [],
) {
  return applyFieldPermission(schema, hiddenFields);
}

export function applyPurchaseGridColumnPermission(
  columns: VxeTableGridOptions['columns'],
  hiddenFields: HiddenFields = [],
  fieldAliases: Record<string, string[]> = {},
) {
  return columns?.filter((column) => {
    if (!column || typeof column !== 'object') {
      return true;
    }
    const field = (column as { field?: unknown }).field;
    if (!field) {
      return true;
    }
    const fieldName = String(field);
    const aliases = [
      ...(PURCHASE_GRID_FIELD_ALIASES[fieldName] || []),
      ...(fieldAliases[fieldName] || []),
    ];
    return (
      !isFieldHidden(hiddenFields, fieldName) &&
      !aliases.some((alias) => isFieldHidden(hiddenFields, alias))
    );
  });
}

export function applyPurchaseSelectColumnPermission<
  T extends { dataIndex?: unknown; field?: unknown; key?: unknown },
>(columns: T[], hiddenFields: HiddenFields = []) {
  return columns.filter((column) => {
    const field = column.dataIndex ?? column.key ?? column.field;
    if (!field) {
      return true;
    }
    return (
      !isFieldHidden(hiddenFields, `select_${String(field)}`) &&
      !isFieldHidden(hiddenFields, `select_col_${String(field)}`)
    );
  });
}
