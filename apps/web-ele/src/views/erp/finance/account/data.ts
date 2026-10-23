import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpAccountApi } from '#/api/erp/finance/account';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import { z } from '#/adapter/form';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'id',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: '名称',
      rules: 'required',
      componentProps: { placeholder: '请输入名称' },
    },
    {
      fieldName: 'accountType',
      label: '账户类型',
      component: 'Select',
      componentProps: {
        style: { width: '100%' },
        class: 'w-full',
        options: getDictOptions(DICT_TYPE.ERP_ACCOUNT_TYPE, 'number'),
        placeholder: '请选择账户类型',
      },
      rules: z.number().default(1),
    },
    {
      fieldName: 'bankName',
      label: '开户行',
      component: 'Input',
      componentProps: { placeholder: '请输入开户行' },
      dependencies: {
        triggerFields: ['accountType'],
        show: (values) => values.accountType === 1,
      },
    },
    {
      fieldName: 'bankAccount',
      label: '银行账号',
      component: 'Input',
      componentProps: { placeholder: '请输入银行账号' },
      dependencies: {
        triggerFields: ['accountType'],
        show: (values) => values.accountType === 1,
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
      fieldName: 'sort',
      label: '排序',
      component: 'InputNumber',
      componentProps: {
        placeholder: '请输入排序',
        precision: 0,
        style: { width: '100%' },
        class: 'w-full',
      },
      rules: 'required',
      defaultValue: 0,
    },
    {
      fieldName: 'defaultStatus',
      label: '是否默认',
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '是', value: true },
          { label: '否', value: false },
        ],
        buttonStyle: 'solid',
        optionType: 'button',
      },
      rules: z.boolean().default(false).optional(),
    },
    {
      fieldName: 'no',
      label: '编码',
      component: 'Input',
      componentProps: { placeholder: '请输入编码' },
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'Textarea',
      componentProps: { placeholder: '请输入备注', rows: 3 },
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'name',
      label: '名称',
      component: 'Input',
      componentProps: { placeholder: '请输入名称', allowClear: true },
    },
    {
      fieldName: 'accountType',
      label: '账户类型',
      component: 'Select',
      componentProps: {
        style: { width: '100%' },
        class: 'w-full',
        options: getDictOptions(DICT_TYPE.ERP_ACCOUNT_TYPE, 'number'),
        placeholder: '请选择账户类型',
        allowClear: true,
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        style: { width: '100%' },
        class: 'w-full',
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        placeholder: '请选择状态',
        allowClear: true,
      },
    },
  ];
}

export function useGridColumns(
  onDefaultStatusChange?: (
    newStatus: boolean,
    row: ErpAccountApi.Account,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    { field: 'name', title: '名称', minWidth: 150 },
    {
      field: 'accountType',
      title: '账户类型',
      minWidth: 120,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.ERP_ACCOUNT_TYPE },
      },
    },
    {
      field: 'bankName',
      title: '开户行',
      minWidth: 160,
      showOverflow: 'tooltip',
    },
    {
      field: 'bankAccount',
      title: '银行账号',
      minWidth: 180,
      showOverflow: 'tooltip',
    },
    {
      field: 'currentBalance',
      title: '账户余额',
      minWidth: 120,
      formatter: 'formatAmount2',
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
    {
      field: 'defaultStatus',
      title: '是否默认',
      minWidth: 100,
      cellRender: {
        attrs: { beforeChange: onDefaultStatusChange },
        name: 'CellSwitch',
        props: { activeValue: true, inactiveValue: false },
      },
    },
    {
      field: 'createTime',
      title: '创建时间',
      minWidth: 180,
      formatter: 'formatDateTime',
    },
    {
      title: '操作',
      width: 130,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}
