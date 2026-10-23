export { moduleOptions, recordStatusOptions } from '../import-record/data';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getRangePickerDefaultProps } from '#/utils';

import { moduleOptions, recordStatusOptions } from '../import-record/data';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'moduleKey',
      label: '模块',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: moduleOptions,
      },
    },
    {
      fieldName: 'fileName',
      label: '文件名',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入文件名' },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: recordStatusOptions,
      },
    },
    {
      fieldName: 'createTime',
      label: '导出时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

export function useGridColumns(): VxeTableGridOptions['columns'] {
  return [
    { type: 'seq', title: '序号', width: 60, fixed: 'left' },
    { field: 'moduleName', title: '模块', width: 120 },
    { field: 'fileName', title: '文件名', minWidth: 180 },
    {
      field: 'status',
      title: '状态',
      width: 110,
      slots: { default: 'status' },
    },
    { field: 'totalCount', title: '导出数量', width: 110 },
    { field: 'operatorName', title: '操作人', width: 120 },
    {
      field: 'durationMs',
      title: '耗时',
      width: 100,
      slots: { default: 'duration' },
    },
    {
      field: 'createTime',
      title: '导出时间',
      width: 170,
      formatter: 'formatDateTime',
    },
    {
      field: 'action',
      title: '操作',
      width: 90,
      fixed: 'right',
      slots: { default: 'action' },
    },
  ];
}
