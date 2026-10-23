import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';

type HiddenFields = Set<string> | string[];

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

const SALE_MASKED_PRICE_ITEM_FIELDS = new Set([
  'productPurchasePrice',
  'productPrice',
  'salePrice',
  'saleCostAmount',
  'saleCostPrice',
  'lastSalePrice',
  'minPrice',
  'referencePrice',
  'retailPrice',
  'lastPurchasePrice',
  'grossProfitRate',
  'backupPrice1',
  'wholesalePrice',
  'sharePrice',
  'totalProductPrice',
  'totalPrice',
  'taxPrice',
  'totalTaxPrice',
  'discountPrice',
  'allowancePrice',
  'reductionAmount',
  'afterReductionPrice',
  'afterReductionAmount',
  'oldPrice',
  'newPrice',
  'totalOriginalPrice',
  'totalAdjustedPrice',
  'adjustPrice',
  'totalAdjustPrice',
  'adjustAmount',
  'actualSaleAmount',
  'originalProductPrice',
  'feeAmount',
  'otherPrice',
  'freightAmount',
  'depositPrice',
  'receiptPrice',
  'refundPrice',
  'extraFee',
  'invoiceAmount',
  'billAmount',
  'cancelAmount',
  'afterCancelAmount',
]);

const SALE_MASKED_PRICE_HIDDEN_FIELDS = new Set(
  [...SALE_MASKED_PRICE_ITEM_FIELDS].map((field) => `item_${field}`),
);

export function isSalePriceItemHidden(
  _hiddenFields: HiddenFields = [],
  _field: string,
) {
  return false;
}

function isSalePricePermissionField(field: string) {
  let normalized = field;
  let changed = false;
  do {
    changed = false;
    ['select_col_', 'select_', 'col_', 'item_'].forEach((prefix) => {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length);
        changed = true;
      }
    });
  } while (changed);
  return SALE_MASKED_PRICE_ITEM_FIELDS.has(normalized);
}

function filterSalePriceHiddenFields(hiddenFields: HiddenFields = []) {
  return Array.from(hiddenFields).filter(
    (field) => !isSalePricePermissionField(String(field)),
  );
}

export function getSalePriceReferenceOverlayHiddenFields(
  hiddenFields: HiddenFields = [],
) {
  return filterSalePriceHiddenFields(hiddenFields);
}

function shouldRetainMaskedPriceField(field: string) {
  return (
    SALE_MASKED_PRICE_HIDDEN_FIELDS.has(field) ||
    SALE_MASKED_PRICE_HIDDEN_FIELDS.has(
      field.startsWith('col_') ? field.slice(4) : field,
    )
  );
}

export function getSaleDetailColumnPermissionHiddenFields(
  hiddenFields: string[] = [],
) {
  return hiddenFields.filter((field) => !shouldRetainMaskedPriceField(field));
}

export function applySaleFormFieldPermission(
  schema: VbenFormSchema[],
  hiddenFields: HiddenFields = [],
) {
  return applyFieldPermission(
    schema.filter(
      (item) => !ERP_DOCUMENT_TAX_FIELDS.has(String(item.fieldName)),
    ),
    filterSalePriceHiddenFields(hiddenFields),
  );
}

export function applySaleItemColumnPermission(
  columns: VxeTableGridOptions['columns'],
  hiddenFields: HiddenFields = [],
) {
  return columns?.filter((column) => {
    const field = 'field' in column ? column.field : undefined;
    if (!field) {
      return true;
    }
    const fieldName = String(field);
    return (
      !ERP_DOCUMENT_TAX_FIELDS.has(fieldName) &&
      (SALE_MASKED_PRICE_ITEM_FIELDS.has(fieldName) ||
        !isFieldHidden(hiddenFields, `item_${fieldName}`))
    );
  });
}

export function applySaleSelectColumnPermission<
  T extends { dataIndex?: unknown; field?: unknown; key?: unknown },
>(columns: T[], hiddenFields: HiddenFields = []) {
  const saleDetailHiddenFields = filterSalePriceHiddenFields(hiddenFields);
  return columns.filter((column) => {
    const field = column.dataIndex ?? column.key ?? column.field;
    if (!field) {
      return true;
    }
    return (
      !isFieldHidden(saleDetailHiddenFields, `select_${String(field)}`) &&
      !isFieldHidden(saleDetailHiddenFields, `select_col_${String(field)}`)
    );
  });
}
