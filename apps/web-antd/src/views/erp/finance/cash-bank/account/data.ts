import { financeAbs } from '#/views/erp/finance/utils/finance-decimal';
import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpAccountApi } from '#/api/erp/finance/account';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';


import { z } from '#/adapter/form';
import { getAccountDeptSimplePage } from '#/api/erp/finance/account';
import { getSimpleDeptList } from '#/api/system/dept';
import { prepareFinanceDocumentItemColumns } from '#/views/erp/finance/utils/document-item-table';
import { prepareFinanceDocumentListColumns } from '#/views/erp/finance/utils/document-list-table';
import { applyFinanceFormFieldPermission } from '#/views/erp/finance/utils/field-permission';
import { createRequiredNumberRule } from '#/views/erp/finance/utils/text-number';

export const ACCOUNT_SORT_FIELD_MAP = {
  name: 'name',
  no: 'no',
  accountType: 'accountType',
  bankName: 'bankName',
  bankAccount: 'bankAccount',
  status: 'status',
  documentStatus: 'documentStatus',
  defaultStatus: 'defaultStatus',
  sort: 'sort',
  createTime: 'createTime',
  updateTime: 'updateTime',
} as const;

export const ACCOUNT_TRANSACTION_SORT_FIELD_MAP = {
  no: 'no',
  receiptAmount: 'amount',
  paymentAmount: 'amount',
  balance: 'balance',
  transactionTime: 'transactionTime',
  bizNo: 'bizNo',
} as const;

function toNumber(value: number | string | undefined) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function resolveTransactionReceiptAmount(
  row: Pick<ErpAccountApi.AccountTransaction, 'amount' | 'billType'>,
) {
  return row.billType === 'receipt' ? toNumber(row.amount) : undefined;
}

export function resolveTransactionPaymentAmount(
  row: Pick<ErpAccountApi.AccountTransaction, 'amount' | 'billType'>,
) {
  const amount = toNumber(row.amount);
  return row.billType === 'payment' && amount !== undefined
    ? -financeAbs(amount)
    : undefined;
}

export function formatTransactionAmountCell(
  value: number | string | undefined,
) {
  const numberValue = toNumber(value);
  return numberValue === undefined ? '-' : erpPriceInputFormatter(numberValue);
}

export function useFormSchema(hiddenFields: string[] = []): VbenFormSchema[] {
  return applyFinanceFormFieldPermission(
    [
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
          options: getDictOptions(DICT_TYPE.ERP_ACCOUNT_TYPE, 'number'),
          placeholder: '请选择账户类型',
          popupClassName: 'account-form-select-dropdown',
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
        component: 'Switch',
        componentProps: {
          checkedChildren: '启用',
          checkedValue: CommonStatusEnum.ENABLE,
          unCheckedChildren: '停用',
          unCheckedValue: CommonStatusEnum.DISABLE,
        },
        defaultValue: CommonStatusEnum.ENABLE,
        rules: z.number().default(CommonStatusEnum.ENABLE),
      },
      {
        fieldName: 'sort',
        label: '排序',
        component: 'Input',
        componentProps: {
          inputMode: 'numeric',
          maxlength: 10,
          placeholder: '请输入排序',
        },
        rules: createRequiredNumberRule('排序', { integer: true, min: 0 }),
        defaultValue: 0,
      },
      {
        fieldName: 'defaultStatus',
        label: '是否默认',
        component: 'Switch',
        componentProps: {
          checkedChildren: '是',
          checkedValue: true,
          unCheckedChildren: '否',
          unCheckedValue: false,
        },
        defaultValue: false,
        rules: z.boolean().default(false).optional(),
      },
      {
        fieldName: 'no',
        label: '编码',
        component: 'Input',
        componentProps: { placeholder: '请输入编码' },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          api: getSimpleDeptList,
          labelField: 'name',
          popupClassName: 'account-form-select-dropdown',
          valueField: 'id',
        },
      },
      {
        fieldName: 'currentBalance',
        label: '账户余额',
        component: 'DecimalAmountInput',
        componentProps: { disabled: true, placeholder: '系统自动计算' },
        dependencies: { triggerFields: ['id'], show: (values) => !!values.id },
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: { placeholder: '请输入备注', rows: 3 },
        formItemClass: 'sm:col-span-2 xl:col-span-4',
      },
    ],
    hiddenFields,
  );
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'no',
      label: '编码',
      component: 'Input',
      componentProps: { placeholder: '请输入编码', allowClear: true },
    },
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
        options: getDictOptions(DICT_TYPE.ERP_ACCOUNT_TYPE, 'number'),
        placeholder: '请选择账户类型',
        allowClear: true,
        popupClassName: 'account-search-select-dropdown',
      },
    },
    {
      fieldName: 'deptId',
      label: '所属部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择所属部门',
        allowClear: true,
        showSearch: true,
        api: getAccountDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        popupClassName: 'account-search-select-dropdown',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        placeholder: '请选择状态',
        allowClear: true,
        popupClassName: 'account-search-select-dropdown',
      },
    },
    {
      fieldName: 'documentStatus',
      label: '提交状态',
      component: 'Select',
      componentProps: {
        options: [
          { label: '草稿', value: 0 },
          { label: '正式', value: 10 },
        ],
        placeholder: '请选择提交状态',
        allowClear: true,
        popupClassName: 'account-search-select-dropdown',
      },
    },
  ];
}

export function useTransactionGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'transactionTime',
      label: '交易时间',
      component: 'RangePicker',
      componentProps: {
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
    },
  ];
}

export function useGridColumns(
  onDefaultStatusChange?: (
    newStatus: boolean,
    row: ErpAccountApi.Account,
  ) => PromiseLike<boolean | undefined>,
  rows: Record<string, any>[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { type: 'checkbox', width: 40, autoFixed: false } as any,
    {
      field: 'name',
      title: '名称',
      width: 132,
      showOverflow: 'tooltip',
      slots: { default: 'accountName' },
    },
    { field: 'no', title: '编码', width: 108, showOverflow: 'tooltip' },
    {
      field: 'accountType',
      title: '账户类型',
      width: 96,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.ERP_ACCOUNT_TYPE },
      },
    },
    {
      field: 'bankName',
      title: '开户行',
      width: 132,
      showOverflow: 'tooltip',
    },
    {
      field: 'bankAccount',
      title: '银行账号',
      width: 148,
      showOverflow: 'tooltip',
    },
    {
      field: 'deptName',
      title: '所属部门',
      width: 104,
      showOverflow: 'tooltip',
    },
    {
      field: 'currentBalance',
      title: '账户余额',
      width: 112,
      align: 'right',
      headerAlign: 'right',
      formatter: 'formatAmount2',
      className: 'account-amount-cell',
    },
    {
      field: 'status',
      title: '状态',
      width: 76,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.COMMON_STATUS },
      },
    },
    {
      field: 'documentStatus',
      title: '提交状态',
      width: 88,
      slots: { default: 'documentStatus' },
    },
    {
      field: 'defaultStatus',
      title: '是否默认',
      width: 88,
      cellRender: {
        attrs: { beforeChange: onDefaultStatusChange },
        name: 'CellSwitch',
        props: { checkedValue: true, unCheckedValue: false },
      },
    },
    { field: 'sort', title: '排序', width: 72, align: 'right' },
    {
      field: 'remark',
      title: '备注',
      width: 140,
      showOverflow: 'tooltip',
    },
    {
      field: 'creatorName',
      title: '创建人',
      width: 88,
      showOverflow: 'tooltip',
    },
    {
      field: 'createTime',
      title: '创建时间',
      width: 148,
      formatter: 'formatDateTime',
    },
    {
      field: 'updaterName',
      title: '修改人',
      width: 88,
      showOverflow: 'tooltip',
    },
    {
      field: 'updateTime',
      title: '修改时间',
      width: 148,
      formatter: 'formatDateTime',
    },
    {
      field: 'actions',
      title: '操作',
      width: 136,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareFinanceDocumentListColumns(columns, rows).map((column) =>
    column.field && column.field in ACCOUNT_SORT_FIELD_MAP
      ? { ...column, sortable: true }
      : column,
  );
}

export function useTransactionGridColumns(
  rows: Record<string, any>[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { field: 'no', title: '单据编号', minWidth: 160 },
    {
      field: 'receiptAmount',
      title: '收款',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      formatter: ({ row }) =>
        formatTransactionAmountCell(resolveTransactionReceiptAmount(row)),
      className: 'account-transaction-amount-cell',
    },
    {
      field: 'paymentAmount',
      title: '付款',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      formatter: ({ row }) =>
        formatTransactionAmountCell(resolveTransactionPaymentAmount(row)),
      className: 'account-transaction-amount-cell',
    },
    {
      field: 'balance',
      title: '余额',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      formatter: ({ row }) => formatTransactionAmountCell(row.balance),
      className: 'account-transaction-amount-cell',
    },
    {
      field: 'transactionTime',
      title: '交易时间',
      width: 152,
      formatter: 'formatDateTime',
    },
    {
      field: 'bizNo',
      title: '关联业务单据号',
      minWidth: 168,
      showOverflow: 'tooltip',
    },
    {
      field: 'remark',
      title: '备注',
      minWidth: 160,
      showOverflow: 'tooltip',
    },
  ];
  return prepareFinanceDocumentItemColumns(columns, { rows }).map((column) =>
    column.field && column.field in ACCOUNT_TRANSACTION_SORT_FIELD_MAP
      ? { ...column, sortable: true }
      : column,
  );
}
