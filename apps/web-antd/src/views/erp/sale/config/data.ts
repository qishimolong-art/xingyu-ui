import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import { z } from '#/adapter/form';
import { applyFieldPermission } from '#/composables/useFieldPermission';
import { getSimpleDeptList } from '#/api/system/dept';
import { withEnterBlurInputSchemas } from '#/views/erp/sale/utils/keyboard';

export const saleConfigTypeOptions = [
  { label: '合同类型', value: 'CONTRACT_TYPE' },
  { label: '客户类型', value: 'CUSTOMER_TYPE' },
  { label: '线路配置', value: 'ROUTE' },
  { label: '运费说明', value: 'FREIGHT_EXPLAIN' },
  { label: '内部账户', value: 'INTERNAL_ACCOUNT' },
  { label: '连锁/集团', value: 'CHAIN_GROUP' },
  { label: '总经销信息', value: 'GENERAL_DISTRIBUTOR' },
  { label: '任务级别', value: 'TASK_LEVEL' },
  { label: '销售区域', value: 'SALES_AREA' },
];

export function getConfigTypeLabel(configType?: string) {
  return (
    saleConfigTypeOptions.find((item) => item.value === configType)?.label ||
    configType ||
    '销售配置'
  );
}

export function useFormSchema(hiddenFields: string[] = []): VbenFormSchema[] {
  return withEnterBlurInputSchemas(
    applyFieldPermission(
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
          component: 'Select',
          fieldName: 'configType',
          label: '配置类型',
          rules: 'required',
          componentProps: {
            options: saleConfigTypeOptions,
            placeholder: '请选择配置类型',
          },
        },
        {
          component: 'Input',
          fieldName: 'code',
          label: '配置编码',
          rules: 'required',
          componentProps: {
            placeholder: '请输入配置编码',
          },
        },
        {
          component: 'Input',
          fieldName: 'name',
          label: '配置名称',
          rules: 'required',
          componentProps: {
            placeholder: '请输入配置名称',
          },
        },
        {
          fieldName: 'configValue',
          label: '配置值',
          component: 'Textarea',
          formItemClass: 'col-span-2',
          componentProps: {
            rows: 2,
            placeholder: '可填写扩展信息，例如账户、路线说明或 JSON',
          },
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
          fieldName: 'deptId',
          label: '所属部门',
          component: 'ApiTreeSelect',
          componentProps: {
            api: getSimpleDeptList,
            labelField: 'name',
            valueField: 'id',
            childrenField: 'children',
            allowClear: true,
            treeDefaultExpandAll: true,
            placeholder: '请选择所属部门',
          },
        },
        {
          fieldName: 'sort',
          label: '排序',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            placeholder: '请输入排序',
          },
          rules: z.number().default(0),
        },
        {
          fieldName: 'remark',
          label: '备注',
          component: 'Textarea',
          formItemClass: 'col-span-2',
          componentProps: {
            rows: 3,
            placeholder: '请输入备注',
          },
        },
      ],
      hiddenFields,
    ),
  );
}

export function useGridFormSchema(): VbenFormSchema[] {
  return withEnterBlurInputSchemas([
    {
      fieldName: 'configType',
      label: '配置类型',
      component: 'Select',
      componentProps: {
        options: saleConfigTypeOptions,
        allowClear: true,
        placeholder: '请选择配置类型',
      },
    },
    {
      fieldName: 'code',
      label: '配置编码',
      component: 'Input',
      componentProps: {
        placeholder: '请输入配置编码',
        allowClear: true,
      },
    },
    {
      fieldName: 'name',
      label: '配置名称',
      component: 'Input',
      componentProps: {
        placeholder: '请输入配置名称',
        allowClear: true,
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
      },
    },
    {
      fieldName: 'deptId',
      label: '所属部门',
      component: 'ApiTreeSelect',
      componentProps: {
        api: getSimpleDeptList,
        labelField: 'name',
        valueField: 'id',
        childrenField: 'children',
        allowClear: true,
        treeDefaultExpandAll: true,
        placeholder: '请选择所属部门',
      },
    },
  ]);
}

export function useGridColumns(): VxeTableGridOptions['columns'] {
  return [
    { type: 'checkbox', width: 50, fixed: 'left' },
    {
      field: 'configType',
      title: '配置类型',
      minWidth: 140,
      formatter: ({ cellValue }) => getConfigTypeLabel(cellValue),
    },
    { field: 'code', title: '配置编码', minWidth: 160 },
    { field: 'name', title: '配置名称', minWidth: 180 },
    {
      field: 'configValue',
      title: '配置值',
      minWidth: 220,
      showOverflow: 'tooltip',
    },
    {
      field: 'status',
      title: '状态',
      minWidth: 100,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.COMMON_STATUS },
      },
    },
    { field: 'deptName', title: '所属部门', minWidth: 120 },
    { field: 'sort', title: '排序', minWidth: 90 },
    { field: 'remark', title: '备注', minWidth: 180, showOverflow: 'tooltip' },
    {
      field: 'createTime',
      title: '创建时间',
      minWidth: 180,
      formatter: 'formatDateTime',
    },
    {
      field: 'actions',
      title: '操作',
      width: 150,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}
