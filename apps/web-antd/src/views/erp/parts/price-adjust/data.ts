import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getWarehouseSimpleList } from '#/api/erp/stock/warehouse';
import { getProductCategorySimpleList } from '#/api/erp/product/category';
import { isFieldHidden } from '#/composables/useFieldPermission';

type PriceColumnConfig = {
  editable?: boolean;
  field: string;
  permissionField?: string;
  title: string;
};

const PRICE_COLUMN_FIELDS = new Set([
  'backupPrice1',
  'referencePrice',
  'retailPrice',
  'wholesalePrice',
  'sharePrice',
  'lastPurchasePrice',
]);

function formatPriceValue(value: any) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  return value;
}

function buildPriceColumn(
  config: PriceColumnConfig,
  hiddenFields: string[],
): NonNullable<VxeTableGridOptions['columns']>[number] {
  const permissionField = config.permissionField ?? config.field;
  const hidden = isFieldHidden(hiddenFields, permissionField);
  return {
    field: config.field,
    title: config.title,
    width: 120,
    formatter: ({ row }: { row: Record<string, any> }) =>
      hidden ? '****' : formatPriceValue(row[config.field]),
    ...(config.editable && !hidden
      ? { editRender: { name: 'input', attrs: { type: 'number' } } }
      : {}),
  };
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'code',
      label: '编码',
      component: 'Input',
      componentProps: { placeholder: '请输入编码', allowClear: true },
    },
    {
      fieldName: 'name',
      label: '名称',
      component: 'Input',
      componentProps: { placeholder: '请输入名称', allowClear: true },
    },
    {
      fieldName: 'categoryId',
      label: '类别',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '请选择类别',
        allowClear: true,
        showSearch: true,
        api: getProductCategorySimpleList,
        labelField: 'name',
        valueField: 'id',
      },
    },
    {
      fieldName: 'warehouseId',
      label: '仓库',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '请选择仓库',
        allowClear: true,
        showSearch: true,
        api: getWarehouseSimpleList,
        labelField: 'name',
        valueField: 'id',
      },
    },
    {
      fieldName: 'vehicleModel',
      label: '适用车型',
      component: 'Input',
      componentProps: { placeholder: '请输入适用车型', allowClear: true },
    },
    {
      fieldName: 'originPlace',
      label: '产地',
      component: 'Input',
      componentProps: { placeholder: '请输入产地', allowClear: true },
    },
    {
      fieldName: 'brand',
      label: '品牌',
      component: 'Input',
      componentProps: { placeholder: '请输入品牌', allowClear: true },
    },
  ];
}

export function useGridColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { type: 'seq', title: '序号', width: 55, fixed: 'left' },
    {
      field: 'name',
      title: '配件名称',
      minWidth: 150,
      fixed: 'left',
      showOverflow: 'tooltip',
      slots: { default: 'name' },
    },
    {
      field: 'code',
      title: '编码',
      width: 130,
      fixed: 'left',
      showOverflow: 'tooltip',
    },
    {
      field: 'vehicleModel',
      title: '适用车型',
      width: 130,
      showOverflow: 'tooltip',
    },
    { field: 'originPlace', title: '产地', width: 100 },
    {
      field: 'standard',
      title: '规格型号',
      width: 120,
      showOverflow: 'tooltip',
    },
    { field: 'brand', title: '品牌', width: 100 },
    { field: 'categoryName', title: '类别', width: 120 },
    {
      field: 'currentStock',
      title: '库存数量',
      width: 100,
      formatter: 'formatAmount3',
    },
    buildPriceColumn(
      { field: 'backupPrice1', title: '备用价1', editable: true },
      hiddenFields,
    ),
    buildPriceColumn(
      { field: 'referencePrice', title: '参考价', editable: true },
      hiddenFields,
    ),
    buildPriceColumn(
      { field: 'retailPrice', title: '零售价', editable: true },
      hiddenFields,
    ),
    buildPriceColumn(
      { field: 'wholesalePrice', title: '批发价', editable: true },
      hiddenFields,
    ),
    buildPriceColumn(
      { field: 'sharePrice', title: '股份价', editable: true },
      hiddenFields,
    ),
    buildPriceColumn(
      { field: 'lastPurchasePrice', title: '最后采购价' },
      hiddenFields,
    ),
    {
      field: 'stockMax',
      title: '库存上限',
      width: 110,
      editRender: { name: 'input', attrs: { type: 'number' } },
    },
    {
      field: 'stockMin',
      title: '库存下限',
      width: 110,
      editRender: { name: 'input', attrs: { type: 'number' } },
    },
    {
      field: 'stockStandard',
      title: '标准库存',
      width: 110,
      editRender: { name: 'input', attrs: { type: 'number' } },
    },
  ];
  return columns.filter(
    (column: any) =>
      !column.field ||
      PRICE_COLUMN_FIELDS.has(column.field) ||
      !isFieldHidden(hiddenFields, column.field),
  );
}

const PRICE_TYPE_FIELD_MAP: Record<string, string> = {
  LAST_PURCHASE_PRICE: 'lastPurchasePrice',
  PURCHASE_PRICE: 'purchasePrice',
  REFERENCE_PRICE: 'referencePrice',
  RETAIL_PRICE: 'retailPrice',
  SALE_PRICE: 'salePrice',
  SHARE_PRICE: 'sharePrice',
  SPARE_PRICE_1: 'backupPrice1',
  WHOLESALE_PRICE: 'wholesalePrice',
};

export function getPriceTypeFieldKey(priceType?: string) {
  return priceType ? PRICE_TYPE_FIELD_MAP[priceType] : undefined;
}

export function filterPriceTypeOptions<T extends { value: string }>(
  options: T[],
  hiddenFields: string[] = [],
) {
  return options.filter((option) => {
    const fieldKey = getPriceTypeFieldKey(option.value);
    return !fieldKey || !isFieldHidden(hiddenFields, fieldKey);
  });
}

export function getFirstVisiblePriceType<T extends { value: string }>(
  options: T[],
  hiddenFields: string[] = [],
) {
  return filterPriceTypeOptions(options, hiddenFields)[0]?.value;
}

export function getPreferredVisiblePriceType<T extends { value: string }>(
  options: T[],
  hiddenFields: string[] = [],
  preferred?: string,
) {
  const visibleOptions = filterPriceTypeOptions(options, hiddenFields);
  if (
    preferred &&
    visibleOptions.some((option) => option.value === preferred)
  ) {
    return preferred;
  }
  return visibleOptions[0]?.value;
}

// 价格类型选项（目标）
export const targetPriceTypeOptions = [
  { label: '备用价1', value: 'SPARE_PRICE_1' },
  { label: '参考价', value: 'REFERENCE_PRICE' },
  { label: '零售价', value: 'RETAIL_PRICE' },
  { label: '批发价', value: 'WHOLESALE_PRICE' },
  { label: '股份价', value: 'SHARE_PRICE' },
  { label: '采购价格', value: 'PURCHASE_PRICE' },
  { label: '销售价格', value: 'SALE_PRICE' },
];

// 价格类型选项（数据源）
export const sourcePriceTypeOptions = [
  { label: '备用价1', value: 'SPARE_PRICE_1' },
  { label: '参考价', value: 'REFERENCE_PRICE' },
  { label: '零售价', value: 'RETAIL_PRICE' },
  { label: '批发价', value: 'WHOLESALE_PRICE' },
  { label: '股份价', value: 'SHARE_PRICE' },
  { label: '采购价格', value: 'PURCHASE_PRICE' },
  { label: '销售价格', value: 'SALE_PRICE' },
  { label: '最后一次采购入库价格', value: 'LAST_PURCHASE_PRICE' },
];

// 调整方式选项
export const adjustMethodOptions = [
  { label: '加（+）', value: 'ADD' },
  { label: '减（-）', value: 'SUBTRACT' },
  { label: '乘（×）', value: 'MULTIPLY' },
  { label: '除（÷）', value: 'DIVIDE' },
];

// 保留小数位选项
export const decimalPlacesOptions = [
  { label: '0位', value: 0 },
  { label: '1位', value: 1 },
  { label: '2位', value: 2 },
  { label: '3位', value: 3 },
  { label: '4位', value: 4 },
];
