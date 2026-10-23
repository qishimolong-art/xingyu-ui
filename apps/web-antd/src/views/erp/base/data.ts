import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpBaseDataApi } from '#/api/erp/base';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import { z } from '#/adapter/form';
import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';
import { prepareErpArchiveListColumns } from '#/views/erp/base/utils/archive-list-table';

export interface BaseDataFormSchemaOptions {
  codeRequired?: boolean;
}

/** 新增/修改的表单 */
export function useFormSchema(
  hiddenFields: string[] = [],
  options: BaseDataFormSchemaOptions = {},
): VbenFormSchema[] {
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
        fieldName: 'type',
        dependencies: {
          triggerFields: [''],
          show: () => false,
        },
      },
      {
        component: 'Input',
        fieldName: 'name',
        label: '名称',
        rules: 'required',
        componentProps: {
          placeholder: '请输入名称',
        },
      },
      {
        component: 'Input',
        fieldName: 'code',
        label: '编码',
        rules: options.codeRequired
          ? z.string().trim().min(1, '请输入编码')
          : z.string().optional(),
        componentProps: {
          placeholder: '请输入编码',
          allowClear: true,
          maxlength: 64,
        },
      },
      {
        component: 'InputNumber',
        fieldName: 'sort',
        label: '排序',
        componentProps: {
          placeholder: '请输入排序',
          min: 0,
        },
        defaultValue: 0,
        rules: z.number().default(0),
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
        defaultValue: CommonStatusEnum.ENABLE,
        rules: z.number().default(CommonStatusEnum.ENABLE),
      },
      {
        component: 'Textarea',
        fieldName: 'remark',
        label: '备注',
        componentProps: {
          placeholder: '请输入备注',
          rows: 3,
        },
        formItemClass: 'col-span-1 sm:col-span-2',
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
      label: '名称',
      component: 'Input',
      componentProps: {
        placeholder: '请输入名称',
        allowClear: true,
        'data-erp-archive-name-search-input': 'true',
      },
    },
    {
      fieldName: 'code',
      label: '编码',
      component: 'Input',
      componentProps: {
        placeholder: '请输入编码',
        allowClear: true,
        'data-erp-archive-code-search-input': 'true',
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        placeholder: '请选择状态',
        allowClear: true,
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        popupClassName: 'base-data-search-select-dropdown',
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(
  hiddenFields: string[] = [],
  rows: ErpBaseDataApi.BaseData[] = [],
): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    {
      field: 'id',
      title: '编号',
      width: 100,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'name',
      title: '名称',
      align: 'left',
      minWidth: 180,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'code',
      title: '编码',
      minWidth: 150,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'sort',
      title: '排序',
      width: 90,
      sortable: true,
    },
    {
      field: 'status',
      title: '状态',
      width: 100,
      sortable: true,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.COMMON_STATUS },
      },
    },
    {
      field: 'remark',
      title: '备注',
      minWidth: 220,
      showOverflow: 'tooltip',
    },
    {
      field: 'createTime',
      title: '创建时间',
      width: 180,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      title: '操作',
      width: 130,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareErpArchiveListColumns(
    columns.filter(
      (column: any) =>
        !column.field || !isFieldHidden(hiddenFields, column.field),
    ),
    rows,
  );
}
