import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { z } from '#/adapter/form';

import {
  applyAccountingColumnPermission,
  applyAccountingFormFieldPermission,
} from '../utils/field-permission';

/** 新增/修改的表单 */
export function useFormSchema(hiddenFields: string[] = []): VbenFormSchema[] {
  return applyAccountingFormFieldPermission(
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
        fieldName: 'code',
        label: '凭证字代码',
        component: 'Input',
        componentProps: {
          placeholder: '请输入凭证字代码（如：记）',
        },
        rules: 'required',
      },
      {
        fieldName: 'name',
        label: '名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入凭证字名称（如：记账凭证）',
        },
        rules: 'required',
      },
      {
        fieldName: 'enable',
        label: '是否启用',
        component: 'RadioGroup',
        componentProps: {
          options: [
            { label: '启用', value: true },
            { label: '停用', value: false },
          ],
          buttonStyle: 'solid',
          optionType: 'button',
        },
        rules: z.boolean().default(true),
      },
      {
        fieldName: 'sort',
        label: '排序',
        component: 'InputNumber',
        componentProps: {
          placeholder: '请输入排序',
          precision: 0,
          min: 0,
        },
        rules: 'required',
        defaultValue: 0,
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
          rows: 3,
        },
      },
    ],
    hiddenFields,
  );
}

/** 列表的搜索表单 */
export function useGridFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyAccountingFormFieldPermission(
    [
      {
        fieldName: 'code',
        label: '凭证字代码',
        component: 'Input',
        componentProps: {
          placeholder: '请输入凭证字代码',
          allowClear: true,
        },
      },
      {
        fieldName: 'name',
        label: '名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入名称',
          allowClear: true,
        },
      },
      {
        fieldName: 'enable',
        label: '是否启用',
        component: 'Select',
        componentProps: {
          options: [
            { label: '启用', value: true },
            { label: '停用', value: false },
          ],
          allowClear: true,
          placeholder: '请选择是否启用',
        },
      },
    ],
    hiddenFields,
  );
}

/** 列表的字段 */
export function useGridColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  return applyAccountingColumnPermission(
    [
      {
        field: 'code',
        title: '凭证字代码',
        minWidth: 120,
      },
      {
        field: 'name',
        title: '名称',
        minWidth: 160,
      },
      {
        field: 'enable',
        title: '是否启用',
        minWidth: 100,
        formatter: ({ cellValue }) => (cellValue ? '启用' : '停用'),
      },
      {
        field: 'sort',
        title: '排序',
        minWidth: 80,
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 180,
        showOverflow: 'tooltip',
      },
      {
        field: 'createTime',
        title: '创建时间',
        minWidth: 170,
        formatter: 'formatDateTime',
      },
      {
        title: '操作',
        width: 140,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    hiddenFields,
  );
}
