import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpProductUnitApi } from '#/api/erp/product/unit';

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
        label: '单位名称',
        rules: 'required',
        componentProps: {
          placeholder: '请输入单位名称',
        },
      },
      {
        fieldName: 'status',
        label: '单位状态',
        component: 'RadioGroup',
        componentProps: {
          options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
          buttonStyle: 'solid',
          optionType: 'button',
        },
        defaultValue: CommonStatusEnum.ENABLE,
        rules: z.number().default(CommonStatusEnum.ENABLE),
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
      label: '单位名称',
      component: 'Input',
      componentProps: {
        placeholder: '请输入单位名称',
        allowClear: true,
        'data-erp-archive-name-search-input': 'true',
      },
    },
    {
      fieldName: 'status',
      label: '单位状态',
      component: 'Select',
      componentProps: {
        placeholder: '请选择单位状态',
        allowClear: true,
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        popupClassName: 'product-unit-search-select-dropdown',
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions<ErpProductUnitApi.ProductUnit>['columns'] {
  const columns: NonNullable<
    VxeTableGridOptions<ErpProductUnitApi.ProductUnit>['columns']
  > = [
    {
      type: 'checkbox',
      width: 40,
    },
    {
      field: 'id',
      title: '单位编号',
      width: 100,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'name',
      title: '单位名称',
      align: 'left',
      minWidth: 220,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'status',
      title: '单位状态',
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
      width: 130,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return columns.filter(
    (item) => !item.field || !isFieldHidden(hiddenFields, item.field),
  );
}
