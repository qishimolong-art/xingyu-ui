import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFieldConfigApi } from '#/api/erp/config/field';
import type { ErpProductApi } from '#/api/erp/product/product';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';
import { handleTree } from '@vben/utils';

import { z } from '#/adapter/form';
import { getProductBrandSimpleList } from '#/api/erp/product/brand';
import { getProductCategorySimpleList } from '#/api/erp/product/category';
import { getProductUnitSimpleList } from '#/api/erp/product/unit';
import { getWarehouseSimpleList } from '#/api/erp/stock/warehouse';
import { getSimpleDeptList } from '#/api/system/dept';
import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';
import { prepareErpArchiveListColumns } from '#/views/erp/base/utils/archive-list-table';
import { applyFieldConfig } from '#/views/erp/composables/useFieldConfig';
import { blurOnEnter } from './utils/keyboard';
import {
  buildCustomFieldColumns,
  buildCustomFieldSchemas,
  getProductCustomFieldConfigs,
  PRODUCT_FIELD_CONFIG_MODULE,
} from './utils/custom-fields';
import {
  createOptionalNumberRule,
  normalizeOptionalNumberFields,
} from './utils/text-number';

const PRODUCT_NUMERIC_FIELDS = [
  'referencePrice',
  'retailPrice',
  'grossProfitRate',
  'backupPrice1',
  'wholesalePrice',
  'sharePrice',
  'stockMax',
  'stockMin',
  'stockStandard',
  'packageQty',
  'weight',
];

const moneyInputProps = {
  allowClear: true,
  placeholder: '请输入价格，单位：元',
};

export interface BaseFormSchemaOptions {
  canCreateCategory?: boolean;
  canCreateBrand?: boolean;
  canCreateUnit?: boolean;
  canCreateWarehouse?: boolean;
  getWarehouseOptions?: typeof getWarehouseSimpleList;
  onQuickCreate?: (payload: ProductQuickCreatePayload) => void;
  onCreateWarehouse?: () => void;
}

export type ProductQuickCreateTarget =
  | 'brand'
  | 'category'
  | 'unit'
  | 'warehouse';

export interface ProductQuickCreatePayload {
  fieldName: 'brand' | 'categoryId' | 'defaultWarehouseId' | 'unitId';
  target: ProductQuickCreateTarget;
  title: string;
}

/** 系统固定文案不允许被历史字段配置中的旧名称覆盖。 */
export function normalizeProductBaseFieldLabels(schema: VbenFormSchema[]) {
  return schema.map((item) =>
    item.fieldName === 'batchNoEnabled'
      ? { ...item, label: '开启批次号' }
      : item,
  );
}

function filterOptionByVisibleText(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(
    option?.name ?? option?.label ?? option?.title ?? option?.value ?? '',
  );
  return label.toLowerCase().includes(keyword);
}

function filterTreeNodeByVisibleText(input: string, node: any) {
  const keyword = input.trim().toLowerCase();
  if (!keyword) {
    return true;
  }
  const label = String(
    node?.label ?? node?.name ?? node?.title ?? node?.value ?? '',
  );
  return label.toLowerCase().includes(keyword);
}

function markCategoryLeafSelectable(nodes: any[] = []): any[] {
  return nodes.map((node) => {
    const children = markCategoryLeafSelectable(node.children ?? []);
    const hasChildren = children.length > 0;
    return {
      ...node,
      children,
      disabled: hasChildren,
      selectable: !hasChildren,
    };
  });
}

async function getLeafSelectableProductCategoryTree() {
  const data = await getProductCategorySimpleList();
  return markCategoryLeafSelectable(handleTree(data));
}

export async function isLeafProductCategoryId(
  categoryId?: null | number | string,
) {
  if (categoryId === undefined || categoryId === null || categoryId === '') {
    return false;
  }
  const data = await getProductCategorySimpleList();
  const selectedId = Number(categoryId);
  return !data.some((item: any) => Number(item.parentId) === selectedId);
}

/** 配件"基础档案" Tab 的表单项 */
export function useBaseFormSchema(
  hiddenFields: string[] = [],
  options: BaseFormSchemaOptions = {},
): VbenFormSchema[] {
  return applyFieldPermission(
    [
      {
        component: 'Input',
        fieldName: 'id',
        dependencies: { triggerFields: [''], show: () => false },
      },
      {
        component: 'Input',
        fieldName: 'codeMode',
        dependencies: { triggerFields: [''], show: () => false },
      },
      {
        fieldName: 'code',
        label: '配件编码',
        component: 'Input',
        componentProps: (values) => {
          const manualInput =
            values.codeMode === 'MANUAL' || Boolean(values.manualInputCode);
          const isEdit = Boolean(values.id);
          return {
            placeholder: manualInput ? '请输入配件编码' : '保存后自动生成',
            disabled: isEdit || !manualInput,
            allowClear: manualInput && !isEdit,
            maxlength: 64,
          };
        },
      },
      {
        fieldName: 'manualInputCode',
        label: '手动输入',
        component: 'Checkbox',
        componentProps: (values) => ({
          disabled: Boolean(values.id) || values.codeMode === 'MANUAL',
        }),
        dependencies: {
          triggerFields: ['id'],
          show: (values) => !values.id,
        },
      },
      {
        component: 'Input',
        fieldName: 'name',
        label: '配件名称',
        rules: 'required',
        componentProps: { placeholder: '请输入配件名称' },
      },
      {
        component: 'Input',
        fieldName: 'pinyinCode',
        label: '拼音码',
        componentProps: {
          placeholder: '按配件名称自动生成，可手动修改',
          allowClear: true,
          maxlength: 64,
        },
      },
      {
        component: 'Input',
        fieldName: 'wubiCode',
        label: '五笔码',
        componentProps: {
          placeholder: '按配件名称自动生成，可手动修改',
          allowClear: true,
          maxlength: 32,
        },
      },
      {
        fieldName: 'unitId',
        label: '单位',
        component: 'QuickCreateApiSelect',
        componentProps: {
          api: getProductUnitSimpleList,
          labelField: 'name',
          valueField: 'id',
          placeholder: '请选择单位',
          popupClassName: 'product-form-select-dropdown',
          showSearch: true,
          filterOption: filterOptionByVisibleText,
          alwaysLoad: true,
          canQuickCreate: options.canCreateUnit ?? false,
          quickCreateTitle: '可选单位',
          quickCreateText: '新增',
          onQuickCreate: () =>
            options.onQuickCreate?.({
              fieldName: 'unitId',
              target: 'unit',
              title: '单位',
            }),
        },
        rules: 'required',
      },
      {
        fieldName: 'defaultWarehouseId',
        label: '默认仓库',
        component: 'QuickCreateApiSelect',
        componentProps: {
          api: options.getWarehouseOptions ?? getWarehouseSimpleList,
          labelField: 'name',
          valueField: 'id',
          placeholder: '请选择默认仓库',
          popupClassName: 'product-form-select-dropdown',
          showSearch: true,
          filterOption: filterOptionByVisibleText,
          alwaysLoad: true,
          canQuickCreate: options.canCreateWarehouse ?? false,
          quickCreateTitle: '可选仓库',
          quickCreateText: '新增',
          onQuickCreate: () => {
            if (options.onQuickCreate) {
              options.onQuickCreate({
                fieldName: 'defaultWarehouseId',
                target: 'warehouse',
                title: '默认仓库',
              });
              return;
            }
            options.onCreateWarehouse?.();
          },
        },
        rules: 'required',
      },
      {
        fieldName: 'vehicleModel',
        label: '适用车型',
        component: 'Input',
        componentProps: { placeholder: '请输入适用车型' },
      },
      {
        fieldName: 'brand',
        label: '品牌',
        component: 'QuickCreateApiSelect',
        componentProps: {
          api: getProductBrandSimpleList,
          labelField: 'name',
          valueField: 'name',
          placeholder: '请选择品牌',
          popupClassName: 'product-form-select-dropdown',
          showSearch: true,
          allowClear: true,
          filterOption: filterOptionByVisibleText,
          alwaysLoad: true,
          canQuickCreate: options.canCreateBrand ?? false,
          quickCreateTitle: '可选品牌',
          quickCreateText: '新增',
          onQuickCreate: () =>
            options.onQuickCreate?.({
              fieldName: 'brand',
              target: 'brand',
              title: '品牌',
            }),
        },
      },
      {
        fieldName: 'standard',
        label: '规格',
        component: 'Input',
        componentProps: { placeholder: '请输入规格' },
      },
      {
        fieldName: 'categoryId',
        label: '配件分类',
        component: 'QuickCreateApiTreeSelect',
        componentProps: {
          api: getLeafSelectableProductCategoryTree,
          labelField: 'name',
          valueField: 'id',
          childrenField: 'children',
          placeholder: '请选择最末级配件分类',
          popupClassName: 'product-form-select-dropdown',
          showSearch: true,
          filterTreeNode: filterTreeNodeByVisibleText,
          treeNodeFilterProp: 'label',
          treeDefaultExpandAll: true,
          alwaysLoad: true,
          canQuickCreate: options.canCreateCategory ?? false,
          quickCreateTitle: '可选分类',
          quickCreateText: '新增',
          onQuickCreate: () =>
            options.onQuickCreate?.({
              fieldName: 'categoryId',
              target: 'category',
              title: '配件分类',
            }),
        },
        rules: 'required',
      },
      {
        fieldName: 'batchNoEnabled',
        label: '开启批次号',
        component: 'Switch',
        componentProps: {
          checkedChildren: '是',
          unCheckedChildren: '否',
        },
        defaultValue: false,
      },
      {
        fieldName: 'barCode',
        label: '条形码',
        component: 'Input',
        componentProps: { placeholder: '请输入条形码' },
      },
      {
        fieldName: 'factoryCode',
        label: '厂家编码',
        component: 'Input',
        componentProps: { placeholder: '请输入厂家编码' },
      },
      {
        fieldName: 'status',
        label: '状态',
        component: 'RadioGroup',
        componentProps: {
          options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
          buttonStyle: 'solid',
          optionType: 'button',
        },
        rules: z.number().default(CommonStatusEnum.ENABLE),
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: { placeholder: '请输入备注' },
        formItemClass: 'col-span-2',
      },
    ],
    hiddenFields,
  );
}

export function useConfiguredBaseFormSchema(
  hiddenFields: string[] = [],
  options: BaseFormSchemaOptions = {},
) {
  return Promise.all([
    applyFieldConfig(
      useBaseFormSchema(hiddenFields, options),
      PRODUCT_FIELD_CONFIG_MODULE,
    ),
    getProductCustomFieldConfigs(),
  ]).then(([schema, customFields]) => [
    ...normalizeProductBaseFieldLabels(schema),
    ...buildCustomFieldSchemas(customFields, 'base_info', hiddenFields),
  ]);
}

/** 配件"价格列表" Tab 的表单项 */
export function usePriceFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyFieldPermission(
    [
      {
        fieldName: 'referencePrice',
        label: '参考价',
        component: 'Input',
        componentProps: moneyInputProps,
        rules: createOptionalNumberRule('参考价', { min: 0, decimalPlaces: 2 }),
      },
      {
        fieldName: 'retailPrice',
        label: '零售价',
        component: 'Input',
        componentProps: moneyInputProps,
        rules: createOptionalNumberRule('零售价', { min: 0, decimalPlaces: 2 }),
      },
      {
        fieldName: 'lastPurchasePrice',
        label: '最后采购入库价',
        component: 'Input',
        componentProps: {
          ...moneyInputProps,
          allowClear: false,
          disabled: true,
          readonly: true,
          placeholder: '系统自动回写',
        },
      },
      {
        fieldName: 'grossProfitRate',
        label: '毛利率（%）',
        component: 'Input',
        componentProps: {
          placeholder: '请输入毛利率百分比',
          allowClear: true,
        },
        rules: createOptionalNumberRule('毛利率', {
          integer: true,
          min: -100,
          max: 100,
        }),
      },
      {
        fieldName: 'backupPrice1',
        label: '备用价1',
        component: 'Input',
        componentProps: moneyInputProps,
        rules: createOptionalNumberRule('备用价1', {
          min: 0,
          decimalPlaces: 2,
        }),
      },
      {
        fieldName: 'wholesalePrice',
        label: '批发价',
        component: 'Input',
        componentProps: moneyInputProps,
        rules: createOptionalNumberRule('批发价', { min: 0, decimalPlaces: 2 }),
      },
      {
        fieldName: 'sharePrice',
        label: '股份价',
        component: 'Input',
        componentProps: moneyInputProps,
        rules: createOptionalNumberRule('股份价', { min: 0, decimalPlaces: 2 }),
      },
    ],
    hiddenFields,
  );
}

export function useConfiguredPriceFormSchema(hiddenFields: string[] = []) {
  return Promise.all([
    applyFieldConfig(
      usePriceFormSchema(hiddenFields),
      PRODUCT_FIELD_CONFIG_MODULE,
    ),
    getProductCustomFieldConfigs(),
  ]).then(([schema, customFields]) => [
    ...schema,
    ...buildCustomFieldSchemas(customFields, 'price_info', hiddenFields),
  ]);
}

/** 配件"扩展信息" Tab 的表单项 */
export function useExtendFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyFieldPermission(
    [
      {
        fieldName: 'stockMax',
        label: '库存上限',
        component: 'Input',
        componentProps: { allowClear: true, placeholder: '请输入库存上限' },
        rules: createOptionalNumberRule('库存上限', { integer: true, min: 0 }),
      },
      {
        fieldName: 'stockMin',
        label: '库存下限',
        component: 'Input',
        componentProps: { allowClear: true, placeholder: '请输入库存下限' },
        rules: createOptionalNumberRule('库存下限', { integer: true, min: 0 }),
      },
      {
        fieldName: 'stockStandard',
        label: '标准库存',
        component: 'Input',
        componentProps: { allowClear: true, placeholder: '请输入标准库存' },
        rules: createOptionalNumberRule('标准库存', { integer: true, min: 0 }),
      },
      {
        fieldName: 'packageQty',
        label: '包装数',
        component: 'Input',
        componentProps: { allowClear: true, placeholder: '请输入包装数' },
        rules: createOptionalNumberRule('包装数', { integer: true, min: 1 }),
      },
      {
        fieldName: 'weight',
        label: '重量（kg）',
        component: 'Input',
        componentProps: {
          placeholder: '请输入重量（kg）',
          allowClear: true,
        },
        rules: createOptionalNumberRule('重量', { min: 0, decimalPlaces: 2 }),
      },
    ],
    hiddenFields,
  );
}

export function useConfiguredExtendFormSchema(hiddenFields: string[] = []) {
  return Promise.all([
    applyFieldConfig(
      useExtendFormSchema(hiddenFields),
      PRODUCT_FIELD_CONFIG_MODULE,
    ),
    getProductCustomFieldConfigs(),
  ]).then(([schema, customFields]) => [
    ...schema,
    ...buildCustomFieldSchemas(customFields, 'extend_info', hiddenFields),
  ]);
}

/** 配件"库存信息" Tab 的（只读）表单项 */
export function useStockReadonlySchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'currentStock',
      label: '当前库存',
      component: 'InputNumber',
      componentProps: { disabled: true, placeholder: '系统自动计算' },
    },
    {
      fieldName: 'inTransitStock',
      label: '在途数量',
      component: 'InputNumber',
      componentProps: { disabled: true, placeholder: '系统自动计算' },
    },
    {
      fieldName: 'availableStock',
      label: '可用库存',
      component: 'InputNumber',
      componentProps: { disabled: true, placeholder: '系统自动计算' },
    },
  ];
}

export const PRODUCT_ARCHIVE_KEYWORD_SEARCH_MODE = 'PRODUCT_ARCHIVE';

export function withProductArchiveKeywordSearchMode<
  T extends Record<string, any>,
>(
  params: T,
): T & { keywordSearchMode: typeof PRODUCT_ARCHIVE_KEYWORD_SEARCH_MODE } {
  return {
    ...params,
    keywordSearchMode: PRODUCT_ARCHIVE_KEYWORD_SEARCH_MODE,
  };
}

/** 列表搜索表单 */
export function useGridFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
    {
      fieldName: 'keyword',
      label: '关键词',
      component: 'Input',
      componentProps: {
        placeholder:
          '配件编码、名称、拼音码、五笔码、车型、条形码、厂家编码、图号；支持空格组合搜索',
        allowClear: true,
        'data-erp-keyword-search-input': 'true',
      },
    },
    {
      fieldName: 'code',
      label: '编码',
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件编码',
        allowClear: true,
        'data-erp-archive-code-search-input': 'true',
      },
    },
    {
      fieldName: 'name',
      label: '名称',
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件名称',
        allowClear: true,
        'data-erp-archive-name-search-input': 'true',
      },
    },
    {
      fieldName: 'vehicleModel',
      label: '适用车型',
      component: 'Input',
      componentProps: { placeholder: '请输入适用车型', allowClear: true },
    },
    {
      fieldName: 'factoryCode',
      label: '厂家编码',
      component: 'Input',
      componentProps: { placeholder: '请输入厂家编码', allowClear: true },
    },
    {
      fieldName: 'brand',
      label: '品牌',
      component: 'ApiSelect',
      componentProps: {
        api: getProductBrandSimpleList,
        labelField: 'name',
        valueField: 'name',
        placeholder: '请选择品牌',
        allowClear: true,
        showSearch: true,
        popupClassName: 'product-search-select-dropdown',
        filterOption: filterOptionByVisibleText,
        alwaysLoad: true,
      },
    },
    {
      fieldName: 'categoryId',
      label: '配件分类',
      component: 'ApiTreeSelect',
      componentProps: {
        api: async () => {
          const data = await getProductCategorySimpleList();
          return handleTree(data);
        },
        labelField: 'name',
        valueField: 'id',
        childrenField: 'children',
        placeholder: '请选择配件分类',
        allowClear: true,
        showSearch: true,
        popupClassName: 'product-search-select-dropdown',
        filterTreeNode: filterTreeNodeByVisibleText,
        treeNodeFilterProp: 'label',
        treeDefaultExpandAll: true,
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        allowClear: true,
        placeholder: '请选择状态',
        popupClassName: 'product-search-select-dropdown',
      },
    },
  ];

  schema.push({
    fieldName: 'deptId',
    label: '所属部门',
    component: 'ApiTreeSelect',
    componentProps: {
      api: getSimpleDeptList,
      fieldNames: { label: 'name', value: 'id', children: 'children' },
      placeholder: '请选择所属部门',
      allowClear: true,
      showSearch: true,
      popupClassName: 'product-search-select-dropdown',
      treeNodeFilterProp: 'name',
      treeDefaultExpandAll: false,
    },
  });

  schema.forEach((item) => {
    if (item.component === 'Input') {
      item.componentProps = {
        ...(item.componentProps as Record<string, any> | undefined),
        onPressEnter: blurOnEnter,
      };
    }
  });

  return applyFieldPermission(schema, hiddenFields);
}

export function normalizeGridSearchValues<T extends Record<string, any>>(
  values: T,
) {
  const normalized: Record<string, any> = { ...values };
  if (typeof normalized.keyword === 'string') {
    const trimmed = normalized.keyword.trim();
    normalized.keyword = trimmed || undefined;
  }

  const fuzzyFields = [
    'code',
    'name',
    'brand',
    'vehicleModel',
    'factoryCode',
  ] as const;

  fuzzyFields.forEach((field) => {
    const value = normalized[field];
    if (typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim();
    normalized[field] = trimmed ? trimmed.replace(/\s+/g, '%') : undefined;
  });

  return normalized as T;
}

export function normalizeProductNumberValues<T extends Record<string, any>>(
  values: T,
) {
  return normalizeOptionalNumberFields(values, PRODUCT_NUMERIC_FIELDS) as T;
}

export function normalizeProductTextValues<T extends Record<string, any>>(
  values: T,
) {
  const normalized: Record<string, any> = { ...values };
  const optionalTextFields = [
    'barCode',
    'brand',
    'pinyinCode',
    'wubiCode',
  ] as const;

  optionalTextFields.forEach((field) => {
    const value = normalized[field];
    if (typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim();
    normalized[field] = trimmed || undefined;
  });

  return normalized as T;
}

/** 列表列 */
export function normalizeProductDeptValues<T extends Record<string, any>>(
  values: T,
) {
  const normalized: Record<string, any> = { ...values };
  delete normalized.deptIds;
  delete normalized.deptId;
  delete normalized.deptName;
  delete normalized.deptNames;
  return normalized as T;
}

export function useGridColumns(
  hiddenFields: string[] = [],
  customFields: ErpFieldConfigApi.FieldConfig[] = [],
  rows: ErpProductApi.Product[] = [],
): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { type: 'checkbox', width: 50, fixed: 'left' },
    {
      field: 'code',
      title: '编码',
      minWidth: 110,
      fixed: 'left',
      sortable: true,
    },
    {
      field: 'name',
      title: '配件名称',
      minWidth: 210,
      sortable: true,
      slots: { default: 'productName' },
    },
    { field: 'vehicleModel', title: '适用车型', minWidth: 140, sortable: true },
    { field: 'brand', title: '品牌', minWidth: 110, sortable: true },
    { field: 'standard', title: '规格', minWidth: 100, sortable: true },
    { field: 'categoryName', title: '配件分类', minWidth: 120 },
    { field: 'unitName', title: '单位', minWidth: 80 },
    { field: 'barCode', title: '条形码', minWidth: 130, sortable: true },
    { field: 'factoryCode', title: '厂家编码', minWidth: 120, sortable: true },
    {
      field: 'retailPrice',
      title: '零售价',
      minWidth: 100,
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'referencePrice',
      title: '参考价',
      minWidth: 100,
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'sharePrice',
      title: '股份价',
      minWidth: 100,
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'currentStock',
      title: '当前库存',
      minWidth: 110,
      slots: { default: 'currentStock' },
    },
    {
      field: 'status',
      title: '状态',
      minWidth: 90,
      sortable: true,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.COMMON_STATUS },
      },
    },
    {
      field: 'createTime',
      title: '创建时间',
      minWidth: 170,
      formatter: 'formatDateTime',
      sortable: true,
    },
    { field: 'creatorName', title: '创建人', minWidth: 120, visible: false },
    { field: 'updaterName', title: '修改人', minWidth: 120, visible: false },
    {
      field: 'updateTime',
      title: '修改时间',
      minWidth: 170,
      formatter: 'formatDateTime',
      visible: false,
      sortable: true,
    },
    {
      title: '操作',
      width: 130,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  const actionColumn = columns.at(-1);
  const visibleColumns = columns
    .slice(0, -1)
    .filter(
      (column: any) =>
        !column.field || !isFieldHidden(hiddenFields, column.field),
    );
  return prepareErpArchiveListColumns(
    [
      ...visibleColumns,
      ...buildCustomFieldColumns(customFields, hiddenFields),
      ...(actionColumn ? [actionColumn] : []),
    ],
    rows,
  );
}
