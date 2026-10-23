import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFieldConfigApi } from '#/api/erp/config/field';

import { getProductCategorySimpleList } from '#/api/erp/product/category';
import { getPriceSystemSimpleList } from '#/api/erp/product/pricesystem';
import {
  getStockWarehouseFilterOptionPage,
  getStockWarehouseOwnerDeptSimplePage,
} from '#/api/erp/stock/warehouse';
import { isFieldHidden } from '#/composables/useFieldPermission';
import { prepareStockDocumentListColumns } from '#/views/erp/stock/utils/document-list-table';
import { stockListNumber } from '#/views/erp/stock/utils/stock-decimal';

const CUSTOM_FIELD_PREFIX = 'customFields__';

type FixedProductPriceColumn = {
  field: string;
  formatter?: string;
  permissionField: string;
  title: string;
  visible?: boolean;
};

const FIXED_PRODUCT_PRICE_COLUMNS: FixedProductPriceColumn[] = [
  {
    field: 'productPurchasePrice',
    permissionField: 'purchasePrice',
    title: '采购价',
    visible: false,
  },
  {
    field: 'salePrice',
    permissionField: 'salePrice',
    title: '销售价',
    visible: false,
  },
  {
    field: 'minPrice',
    permissionField: 'minPrice',
    title: '最低价',
    visible: false,
  },
  {
    field: 'referencePrice',
    permissionField: 'referencePrice',
    title: '参考价',
  },
  {
    field: 'retailPrice',
    permissionField: 'retailPrice',
    title: '零售价',
  },
  {
    field: 'lastPurchasePrice',
    permissionField: 'lastPurchasePrice',
    title: '最近采购价',
  },
  {
    field: 'grossProfitRate',
    permissionField: 'grossProfitRate',
    title: '毛利率',
    formatter: 'percent',
  },
  {
    field: 'backupPrice1',
    permissionField: 'backupPrice1',
    title: '备用价1',
    visible: false,
  },
  {
    field: 'wholesalePrice',
    permissionField: 'wholesalePrice',
    title: '批发价',
    visible: false,
  },
  {
    field: 'sharePrice',
    permissionField: 'sharePrice',
    title: '股份价',
  },
];

function toCustomFieldName(fieldName: string) {
  return `${CUSTOM_FIELD_PREFIX}${fieldName}`;
}

function formatPriceValue(value: any, formatter?: string) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  if (formatter === 'percent') {
    return `${stockListNumber(value)}%`;
  }
  return stockListNumber(value);
}

function sortCustomFields(
  fields: ErpFieldConfigApi.FieldConfig[],
): ErpFieldConfigApi.FieldConfig[] {
  return fields.toSorted((a, b) => {
    const sortA = a.sort ?? Number.MAX_SAFE_INTEGER;
    const sortB = b.sort ?? Number.MAX_SAFE_INTEGER;
    if (sortA !== sortB) return sortA - sortB;
    return String(a.fieldName).localeCompare(String(b.fieldName));
  });
}

function buildProductPriceColumns(
  hiddenFields: string[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  return FIXED_PRODUCT_PRICE_COLUMNS.map((column) => ({
    field: column.field,
    title: column.title,
    ...(column.visible === false ? { visible: false } : {}),
    width: 96,
    sortable: true,
    formatter: ({ row }: { row: Record<string, any> }) =>
      isFieldHidden(hiddenFields, column.permissionField)
        ? '****'
        : formatPriceValue(row[column.field], column.formatter),
  }));
}

function buildCustomProductPriceColumns(
  customFields: ErpFieldConfigApi.FieldConfig[] = [],
  hiddenFields: string[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  return sortCustomFields(customFields)
    .filter((config) => config.visible !== false)
    .filter((config) => (config.fieldGroup || 'base_info') === 'price_info')
    .filter((config) => !!config.fieldName)
    .map((config) => ({
      field: toCustomFieldName(config.fieldName),
      minWidth: 120,
      title: config.fieldLabel || config.fieldName,
      formatter: ({ row }: { row: { customFields?: Record<string, any> } }) =>
        isFieldHidden(hiddenFields, config.fieldName)
          ? '****'
          : formatPriceValue(row.customFields?.[config.fieldName]),
    }));
}

/** 搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'warehouseId',
      label: '仓库',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择仓库',
        allowClear: true,
        showSearch: true,
        popupClassName: 'stock-search-select-dropdown',
        api: getStockWarehouseFilterOptionPage,
        pageSize: 10,
        labelField: 'displayName',
        valueField: 'id',
        loadErrorMessage: '仓库列表加载失败，请重试',
      },
    },
    {
      fieldName: 'productKeyword',
      label: '产品',
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
        allowClear: true,
        'data-erp-product-keyword-search-input': 'true',
      },
    },
    // ========== 配件条件 ==========
    {
      fieldName: 'deptId',
      label: '所属部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择所属部门',
        allowClear: true,
        showSearch: true,
        popupClassName: 'stock-search-select-dropdown',
        api: getStockWarehouseOwnerDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'productCode',
      label: '零件编码',
      component: 'Input',
      componentProps: {
        placeholder: '请输入零件编码',
        allowClear: true,
      },
    },
    {
      fieldName: 'productName',
      label: '配件名称',
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件名称',
        allowClear: true,
      },
    },
    {
      fieldName: 'drawingNo',
      label: '图号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入图号',
        allowClear: true,
      },
    },
    {
      fieldName: 'vehicleModel',
      label: '适用车型',
      component: 'Input',
      componentProps: {
        placeholder: '请输入适用车型',
        allowClear: true,
      },
    },
    {
      fieldName: 'originPlace',
      label: '产地',
      component: 'Input',
      componentProps: {
        placeholder: '请输入产地',
        allowClear: true,
      },
    },
    {
      fieldName: 'brand',
      label: '品牌',
      component: 'Input',
      componentProps: {
        placeholder: '请输入品牌',
        allowClear: true,
      },
    },
    {
      fieldName: 'shelf',
      label: '货架',
      component: 'Input',
      componentProps: {
        placeholder: '请输入货架位',
        allowClear: true,
      },
    },
    {
      fieldName: 'featureCode',
      label: '特征码',
      component: 'Input',
      componentProps: {
        placeholder: '请输入特征码',
        allowClear: true,
      },
    },
    {
      fieldName: 'standard',
      label: '规格',
      component: 'Input',
      componentProps: {
        placeholder: '请输入规格',
        allowClear: true,
      },
    },
    {
      fieldName: 'factoryCode',
      label: '厂家编码',
      component: 'Input',
      componentProps: {
        placeholder: '请输入厂家编码',
        allowClear: true,
      },
    },
    {
      fieldName: 'barCode',
      label: '条形码',
      component: 'Input',
      componentProps: {
        placeholder: '请输入条形码',
        allowClear: true,
      },
    },
    {
      fieldName: 'oeNumber',
      label: 'OE号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入OE号',
        allowClear: true,
      },
    },
    {
      fieldName: 'categoryId',
      label: '配件分类',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '请选择配件分类',
        allowClear: true,
        showSearch: true,
        popupClassName: 'stock-search-select-dropdown',
        api: getProductCategorySimpleList,
        labelField: 'name',
        valueField: 'id',
      },
    },
    {
      fieldName: 'productStatus',
      label: '配件状态',
      component: 'Select',
      componentProps: {
        placeholder: '请选择配件状态',
        allowClear: true,
        popupClassName: 'stock-search-select-dropdown',
        options: [
          { label: '启用', value: 0 },
          { label: '停用', value: 1 },
        ],
      },
    },
    // ========== 数量条件 ==========
    {
      fieldName: 'countFilter',
      label: '库存数',
      component: 'Select',
      componentProps: {
        placeholder: '请选择',
        allowClear: true,
        popupClassName: 'stock-search-select-dropdown',
        options: [
          { label: '全部', value: 0 },
          { label: '大于 0', value: 1 },
          { label: '等于 0', value: 2 },
        ],
      },
    },
    {
      fieldName: 'countMin',
      label: '库存数量最小',
      component: 'InputNumber',
      componentProps: {
        placeholder: '最小值',
        stringMode: true,
        class: 'w-full',
      },
    },
    {
      fieldName: 'countMax',
      label: '库存数量最大',
      component: 'InputNumber',
      componentProps: {
        placeholder: '最大值',
        stringMode: true,
        class: 'w-full',
      },
    },
    // ========== 上下限 ==========
    {
      fieldName: 'stockMaxMin',
      label: '库存上限最小',
      component: 'InputNumber',
      componentProps: {
        placeholder: '最小值',
        stringMode: true,
        class: 'w-full',
      },
    },
    {
      fieldName: 'stockMaxMax',
      label: '库存上限最大',
      component: 'InputNumber',
      componentProps: {
        placeholder: '最大值',
        stringMode: true,
        class: 'w-full',
      },
    },
    {
      fieldName: 'stockMinMin',
      label: '库存下限最小',
      component: 'InputNumber',
      componentProps: {
        placeholder: '最小值',
        stringMode: true,
        class: 'w-full',
      },
    },
    {
      fieldName: 'stockMinMax',
      label: '库存下限最大',
      component: 'InputNumber',
      componentProps: {
        placeholder: '最大值',
        stringMode: true,
        class: 'w-full',
      },
    },
    {
      fieldName: 'stockStandardMin',
      label: '标准库存最小',
      component: 'InputNumber',
      componentProps: {
        placeholder: '最小值',
        stringMode: true,
        class: 'w-full',
      },
    },
    {
      fieldName: 'stockStandardMax',
      label: '标准库存最大',
      component: 'InputNumber',
      componentProps: {
        placeholder: '最大值',
        stringMode: true,
        class: 'w-full',
      },
    },
    // ========== 特殊筛选 ==========
    {
      fieldName: 'shelfDuplicateOnly',
      label: '货架位重复',
      component: 'Checkbox',
      renderComponentContent: () => ({
        default: () => '仅显示重复的货架位',
      }),
    },
    {
      fieldName: 'shelfEmptyOnly',
      label: '空置货架位',
      component: 'Checkbox',
      renderComponentContent: () => ({
        default: () => '仅显示空置货架位',
      }),
    },
    {
      fieldName: 'positiveCountOnly',
      label: '正库存',
      component: 'Checkbox',
      renderComponentContent: () => ({
        default: () => '只显示正库存',
      }),
    },
    // ========== 价格体系 ==========
    {
      fieldName: 'priceSystemId',
      label: '价格体系',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '请选择价格体系',
        allowClear: true,
        showSearch: true,
        popupClassName: 'stock-search-select-dropdown',
        api: getPriceSystemSimpleList,
        labelField: 'name',
        valueField: 'id',
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(
  hiddenFields: string[] = [],
  customFields: ErpFieldConfigApi.FieldConfig[] = [],
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  const priceColumns = [
    ...buildProductPriceColumns(hiddenFields),
    ...buildCustomProductPriceColumns(customFields, hiddenFields),
  ];
  return prepareStockDocumentListColumns(
    [
      { type: 'checkbox', width: 36, autoFixed: false } as any,
      {
        field: 'warehouseName',
        title: '仓库',
        width: 112,
        sortable: true,
      },
      {
        field: 'deptName',
        title: '所属部门',
        width: 104,
        sortable: true,
      },
      {
        field: 'productName',
        title: '配件名称',
        width: 144,
        sortable: true,
        slots: { default: 'productName' },
      },
      {
        field: 'unitName',
        title: '配件单位',
        width: 76,
        sortable: true,
      },
      {
        field: 'categoryName',
        title: '配件分类',
        width: 104,
        sortable: true,
      },
      {
        field: 'count',
        title: '库存量',
        width: 84,
        sortable: true,
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        slots: { default: 'count' },
      },
      {
        field: 'batchNoSummary',
        title: '批次号',
        width: 140,
        sortable: true,
        slots: { default: 'batchNoSummary' },
      },
      {
        field: 'productCode',
        title: '编码',
        width: 104,
        sortable: true,
      },
      {
        field: 'drawingNo',
        title: '图号',
        width: 92,
        sortable: true,
      },
      {
        field: 'standard',
        title: '规格',
        width: 92,
        sortable: true,
      },
      {
        field: 'featureCode',
        title: '特征码',
        width: 88,
        sortable: true,
      },
      {
        field: 'vehicleModel',
        title: '适用车型',
        width: 120,
        sortable: true,
      },
      {
        field: 'brand',
        title: '品牌',
        width: 88,
        sortable: true,
      },
      {
        field: 'originPlace',
        title: '产地',
        width: 88,
        sortable: true,
      },
      {
        field: 'shelf',
        title: '货架',
        width: 88,
        sortable: true,
        slots: { default: 'shelf' },
      },
      {
        field: 'purchasePrice',
        title: '进价',
        visible: false,
        width: 88,
        sortable: true,
        formatter: ({ row }: { row: Record<string, any> }) =>
          isFieldHidden(hiddenFields, 'purchasePrice') ||
          isFieldHidden(hiddenFields, 'lastPurchasePrice')
            ? '****'
            : formatPriceValue(row.purchasePrice),
        slots: { default: 'purchasePrice' },
      },
      ...priceColumns,
      {
        field: 'occupiedCount',
        title: '占用数',
        width: 80,
        sortable: true,
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        slots: { default: 'occupiedCount' },
      },
      {
        field: 'pendingInCount',
        title: '未入数',
        width: 80,
        sortable: true,
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        slots: { default: 'pendingInCount' },
      },
      {
        field: 'inTransitCount',
        title: '在途数',
        width: 80,
        sortable: true,
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        slots: { default: 'inTransitCount' },
      },
      {
        field: 'stockMin',
        title: '库存下限',
        width: 88,
        sortable: true,
      },
      {
        field: 'stockMax',
        title: '库存上限',
        width: 88,
        sortable: true,
      },
      {
        field: 'stockStandard',
        title: '标准库存',
        width: 88,
        sortable: true,
      },
      {
        field: 'costPrice',
        title: '成本单价',
        width: 96,
        sortable: true,
        formatter: ({ row }: { row: Record<string, any> }) =>
          isFieldHidden(hiddenFields, 'lastPurchasePrice')
            ? '****'
            : formatPriceValue(row.costPrice),
        slots: { default: 'costPrice' },
      },
      {
        field: 'costAmount',
        title: '成本金额',
        width: 104,
        sortable: true,
        formatter: ({ row }: { row: Record<string, any> }) =>
          isFieldHidden(hiddenFields, 'lastPurchasePrice')
            ? '****'
            : formatPriceValue(row.costAmount),
        slots: { default: 'costAmount' },
      },
      {
        field: 'currentPrice',
        title: '价格体系单价',
        width: 112,
        sortable: true,
        formatter: 'formatAmount',
        visible: false,
      },
      {
        field: 'currentPriceAmount',
        title: '价格体系金额',
        width: 112,
        sortable: true,
        formatter: 'formatAmount',
        visible: false,
      },
      {
        field: 'actions',
        title: '操作',
        width: 132,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    rows,
    { trailingFlexibleColumnMinWidth: 72 },
  );
}
