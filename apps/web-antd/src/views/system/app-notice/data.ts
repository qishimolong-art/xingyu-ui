import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import { z } from '#/adapter/form';
import { getRangePickerDefaultProps } from '#/utils';

/** 新增/修改的表单 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'title',
      label: '公告标题',
      component: 'Input',
      componentProps: {
        maxlength: 100,
        placeholder: '请输入公告标题',
        showCount: true,
      },
      rules: 'required',
    },
    {
      fieldName: 'status',
      label: '公告状态',
      component: 'RadioGroup',
      componentProps: {
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        buttonStyle: 'solid',
        optionType: 'button',
      },
      rules: z.number().default(CommonStatusEnum.ENABLE),
    },
    {
      fieldName: 'sort',
      label: '排序',
      component: 'InputNumber',
      componentProps: {
        class: 'w-full',
        min: 0,
        precision: 0,
        placeholder: '请输入排序',
      },
      rules: z.number().default(0),
    },
    {
      fieldName: 'startTime',
      label: '展示开始',
      component: 'DatePicker',
      componentProps: {
        allowClear: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择展示开始时间',
        showTime: true,
        valueFormat: 'x',
      },
    },
    {
      fieldName: 'endTime',
      label: '展示结束',
      component: 'DatePicker',
      componentProps: {
        allowClear: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择展示结束时间',
        showTime: true,
        valueFormat: 'x',
      },
    },
    {
      fieldName: 'content',
      label: '公告内容',
      component: 'RichTextarea',
      rules: 'required',
    },
  ];
}

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'title',
      label: '公告标题',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '请输入公告标题',
      },
    },
    {
      fieldName: 'status',
      label: '公告状态',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        placeholder: '请选择公告状态',
      },
    },
    {
      fieldName: 'createTime',
      label: '创建时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'id',
      title: '公告编号',
      minWidth: 100,
    },
    {
      field: 'title',
      title: '公告标题',
      minWidth: 220,
    },
    {
      field: 'status',
      title: '公告状态',
      minWidth: 100,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.COMMON_STATUS },
      },
    },
    {
      field: 'sort',
      title: '排序',
      minWidth: 80,
    },
    {
      field: 'startTime',
      title: '展示开始时间',
      minWidth: 180,
      formatter: 'formatDateTime',
    },
    {
      field: 'endTime',
      title: '展示结束时间',
      minWidth: 180,
      formatter: 'formatDateTime',
    },
    {
      field: 'createTime',
      title: '创建时间',
      minWidth: 180,
      formatter: 'formatDateTime',
    },
    {
      title: '操作',
      width: 160,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}
