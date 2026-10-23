import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { z } from '#/adapter/form';

import {
  applyAccountingColumnPermission,
  applyAccountingFormFieldPermission,
} from '../utils/field-permission';

/** 报表类型枚举 */
export const REPORT_TYPE_OPTIONS = [
  { label: '资产负债表', value: 1 },
  { label: '利润表', value: 2 },
  { label: '现金流量表', value: 3 },
];

/** 区域枚举 */
export const SIDE_OPTIONS = [
  { label: '左侧', value: 1 },
  { label: '右侧', value: 2 },
];

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
        fieldName: 'reportType',
        label: '报表类型',
        component: 'Select',
        componentProps: {
          options: REPORT_TYPE_OPTIONS,
          placeholder: '请选择报表类型',
        },
        rules: 'required',
      },
      {
        fieldName: 'side',
        label: '区域',
        component: 'Select',
        componentProps: {
          options: SIDE_OPTIONS,
          placeholder: '请选择区域（资产负债表用）',
          allowClear: true,
        },
      },
      {
        fieldName: 'itemName',
        label: '项目名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入项目名称',
        },
        rules: 'required',
      },
      {
        fieldName: 'rowNo',
        label: '行次',
        component: 'InputNumber',
        componentProps: {
          placeholder: '请输入行次',
          precision: 0,
          min: 0,
        },
      },
      {
        fieldName: 'parentId',
        label: '父项编号',
        component: 'InputNumber',
        componentProps: {
          placeholder: '0 表示无父项',
          precision: 0,
          min: 0,
        },
        defaultValue: 0,
      },
      {
        fieldName: 'formula',
        label: '取数公式',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入取数公式（如：1001+1002）',
          rows: 3,
        },
        formItemClass: 'col-span-2',
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
          rows: 2,
        },
        formItemClass: 'col-span-2',
      },
    ],
    hiddenFields,
  );
}

/** 列表的搜索表单（隐式带 reportType / side，由顶部 Tab 控制） */
export function useGridFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyAccountingFormFieldPermission(
    [
      {
        fieldName: 'itemName',
        label: '项目名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入项目名称',
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
        field: 'rowNo',
        title: '行次',
        minWidth: 80,
      },
      {
        field: 'itemName',
        title: '项目名称',
        minWidth: 200,
      },
      {
        field: 'side',
        title: '区域',
        minWidth: 100,
        formatter: ({ cellValue }) =>
          cellValue === 1 ? '左侧' : cellValue === 2 ? '右侧' : '-',
      },
      {
        field: 'formula',
        title: '取数公式',
        minWidth: 220,
        showOverflow: 'tooltip',
      },
      {
        field: 'parentId',
        title: '父项编号',
        minWidth: 100,
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
        minWidth: 160,
        showOverflow: 'tooltip',
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
