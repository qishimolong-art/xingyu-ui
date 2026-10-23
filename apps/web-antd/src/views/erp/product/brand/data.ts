import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpProductBrandApi } from '#/api/erp/product/brand';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import { z } from '#/adapter/form';
import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';

/** 新增/修改的表单 */
export function useFormSchema(hiddenFields: string[] = []): VbenFormSchema[] {
  return applyFieldPermission(
    [
      {
        component: 'Input',
        fieldName: 'id',
        dependencies: {
          triggerFields: [''],
          show: () => false,
        },
      },
      {
        component: 'Input',
        fieldName: 'name',
        label: '品牌名称',
        rules: 'required',
        componentProps: {
          maxlength: 64,
          placeholder: '请输入品牌名称',
          showCount: true,
        },
      },
      {
        fieldName: 'status',
        label: '品牌状态',
        component: 'RadioGroup',
        componentProps: {
          options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
          buttonStyle: 'solid',
          optionType: 'button',
        },
        defaultValue: CommonStatusEnum.ENABLE,
        rules: z.number().default(CommonStatusEnum.ENABLE),
      },
      {
        fieldName: 'sort',
        label: '排序',
        component: 'InputNumber',
        componentProps: {
          min: 0,
          placeholder: '请输入排序',
        },
        defaultValue: 0,
        rules: z.number().default(0),
      },
    ],
    hiddenFields,
  );
}

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'name',
      label: '品牌名称',
      component: 'Input',
      componentProps: {
        placeholder: '请输入品牌名称',
        allowClear: true,
        'data-erp-archive-name-search-input': 'true',
      },
    },
    {
      fieldName: 'status',
      label: '品牌状态',
      component: 'Select',
      componentProps: {
        placeholder: '请选择品牌状态',
        allowClear: true,
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        popupClassName: 'product-brand-search-select-dropdown',
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions<ErpProductBrandApi.ProductBrand>['columns'] {
  const columns: NonNullable<
    VxeTableGridOptions<ErpProductBrandApi.ProductBrand>['columns']
  > = [
    {
      type: 'checkbox',
      width: 40,
    },
    {
      field: 'id',
      title: '品牌编号',
      width: 100,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'name',
      title: '品牌名称',
      align: 'left',
      minWidth: 220,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'status',
      title: '品牌状态',
      width: 100,
      sortable: true,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.COMMON_STATUS },
      },
    },
    {
      field: 'sort',
      title: '排序',
      width: 100,
      sortable: true,
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
      width: 130,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return columns.filter(
    (item) => !item.field || !isFieldHidden(hiddenFields, item.field),
  );
}
