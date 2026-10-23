import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpProductCategoryApi } from '#/api/erp/product/category';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import { z } from '#/adapter/form';
import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';

type ProductCategoryFormMode = 'create' | 'edit';

/** 新增/修改的表单 */
export function useFormSchema(
  hiddenFields: string[] = [],
  mode: ProductCategoryFormMode = 'create',
): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'parentId',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'name',
      label: '分类名称',
      component: 'Input',
      componentProps: {
        placeholder: '请输入分类名称',
      },
      rules: 'required',
    },
    {
      fieldName: 'code',
      label: '分类编码',
      component: 'Input',
      componentProps: {
        placeholder: '例如：001 或 001 001',
        readonly: mode === 'edit',
      },
      rules: 'required',
    },
    ...(mode === 'edit'
      ? [
          {
            fieldName: 'sort',
            label: '显示顺序',
            component: 'InputNumber',
            componentProps: {
              min: 0,
              placeholder: '请输入显示顺序',
            },
            rules: 'required',
          } satisfies VbenFormSchema,
        ]
      : []),
    {
      fieldName: 'status',
      label: '状态',
      component: 'RadioGroup',
      componentProps: {
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        buttonStyle: 'solid',
        optionType: 'button',
      },
      defaultValue: CommonStatusEnum.ENABLE,
      rules: z.number().default(CommonStatusEnum.ENABLE),
    },
  ];
  return applyFieldPermission(schema, hiddenFields);
}

/** 查询表单 */
export function useQueryFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: '分类名称',
      componentProps: {
        placeholder: '请输入分类名称',
        allowClear: true,
        'data-erp-archive-name-search-input': 'true',
      },
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: '开启状态',
      componentProps: {
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        placeholder: '请选择开启状态',
        allowClear: true,
        popupClassName: 'product-category-search-select-dropdown',
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions<ErpProductCategoryApi.ProductCategory>['columns'] {
  const columns: NonNullable<
    VxeTableGridOptions<ErpProductCategoryApi.ProductCategory>['columns']
  > = [
    {
      type: 'checkbox',
      width: 40,
    },
    {
      field: 'name',
      title: '分类名称',
      align: 'left',
      minWidth: 220,
      showOverflow: 'tooltip',
      treeNode: true,
      sortable: true,
    },
    {
      field: 'code',
      title: '分类编码',
      minWidth: 180,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'sort',
      title: '显示顺序',
      width: 100,
      sortable: true,
    },
    {
      field: 'status',
      title: '分类状态',
      width: 100,
      sortable: true,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.COMMON_STATUS },
      },
    },
    {
      field: 'createTime',
      title: '创建时间',
      width: 180,
      formatter: 'formatDateTime',
      sortable: true,
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return columns.filter(
    (item) => !item.field || !isFieldHidden(hiddenFields, item.field),
  );
}
