import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getAccountSimplePage } from '#/api/erp/finance/account';
import { getReceivableMiscDeptSimplePage } from '#/api/erp/finance/receivable/misc';
import { getRangePickerDefaultProps } from '#/utils';
import { prepareFinanceDocumentListColumns } from '#/views/erp/finance/utils/document-list-table';
import { createRequiredNumberRule } from '#/views/erp/finance/utils/text-number';
import { getCustomerSelectProps } from '#/views/erp/sale/utils/customer-select';

const SEARCH_SELECT_POPUP_CLASS = 'receivable-misc-search-select-dropdown';
const FORM_SELECT_POPUP_CLASS = 'receivable-misc-form-select-dropdown';

export const RECEIVABLE_MISC_SORT_FIELD_MAP = {
  accountName: 'accountId',
  amount: 'amount',
  bizTime: 'bizTime',
  createTime: 'createTime',
  customerName: 'customerName',
  deptName: 'deptId',
  handlerName: 'handlerId',
  no: 'no',
  status: 'status',
} as const;

export function useFormSchema(formType: string): VbenFormSchema[] {
  const disabled = formType === 'detail';
  return [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'no',
      label: '单号',
      component: 'Input',
      componentProps: { placeholder: '系统自动生成', disabled: true },
    },
    {
      fieldName: 'bizTime',
      label: '日期',
      component: 'DatePicker',
      componentProps: {
        placeholder: '系统自动填充当前时间',
        disabled: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
    },
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'CustomerLazySelect',
      componentProps: {
        ...getCustomerSelectProps(disabled),
        popupClassName: FORM_SELECT_POPUP_CLASS,
      },
      rules: 'required',
    },
    {
      fieldName: 'accountId',
      label: '账户',
      component: 'ErpLazyPageSelect',
      componentProps: {
        popupClassName: FORM_SELECT_POPUP_CLASS,
        placeholder: '请选择账户',
        allowClear: true,
        showSearch: true,
        disabled,
        api: getAccountSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '账户列表加载失败，请重试',
      },
      rules: 'required',
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        popupClassName: FORM_SELECT_POPUP_CLASS,
        placeholder: '请选择部门',
        allowClear: true,
        showSearch: true,
        disabled,
        api: getReceivableMiscDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
      rules: 'required',
    },
    {
      fieldName: 'amount',
      label: '金额',
      component: 'DecimalAmountInput',
      componentProps: {
        placeholder: '请输入金额',
        disabled,
        class: 'w-full',
        inputMode: 'decimal',
        
      },
      rules: createRequiredNumberRule('金额', { nonZero: true, }),
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入备注',
        disabled,
        rows: 3,
        maxlength: 512,
      },
      formItemClass: 'receivable-misc-full-row',
    },
    {
      fieldName: 'fileUrl',
      label: '附件',
      component: 'FileUpload',
      componentProps: {
        maxNumber: 1,
        maxSize: 10,
        accept: [
          'pdf',
          'doc',
          'docx',
          'xls',
          'xlsx',
          'txt',
          'jpg',
          'jpeg',
          'png',
        ],
        showDescription: !disabled,
        disabled,
      },
      formItemClass: 'receivable-misc-full-row',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'CustomerLazySelect',
      componentProps: getCustomerSelectProps(false, SEARCH_SELECT_POPUP_CLASS),
    },
    {
      fieldName: 'accountId',
      label: '账户',
      component: 'ErpLazyPageSelect',
      componentProps: {
        popupClassName: SEARCH_SELECT_POPUP_CLASS,
        placeholder: '请选择账户',
        allowClear: true,
        showSearch: true,
        api: getAccountSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '账户列表加载失败，请重试',
      },
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        popupClassName: SEARCH_SELECT_POPUP_CLASS,
        placeholder: '请选择部门',
        allowClear: true,
        showSearch: true,
        api: getReceivableMiscDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'bizTime',
      label: '日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'no',
      label: '单号',
      component: 'Input',
      componentProps: { placeholder: '请输入单号', allowClear: true },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '草稿', value: 0 },
          { label: '待审核', value: 10 },
          { label: '已审核', value: 20 },
        ],
      },
    },
  ];
}

export function useGridColumns(
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { type: 'checkbox', width: 42, fixed: 'left' },
    {
      field: 'no',
      title: '单号',
      width: 150,
      slots: { default: 'no' },
    },
    {
      field: 'bizTime',
      title: '日期',
      width: 160,
      formatter: 'formatDateTime',
    },
    { field: 'customerName', title: '客户', minWidth: 180 },
    { field: 'accountName', title: '账户', width: 130 },
    { field: 'deptName', title: '部门', width: 110 },
    { field: 'handlerName', title: '经办人', width: 100 },
    {
      field: 'amount',
      title: '原金额',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      formatter: 'formatAmount2',
    },
    {
      field: 'settledAmount',
      title: '已收金额',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      formatter: 'formatAmount2',
    },
    {
      field: 'balanceAmount',
      title: '剩余金额',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      formatter: 'formatAmount2',
    },
    { field: 'status', title: '状态', width: 92, slots: { default: 'status' } },
    { field: 'remark', title: '备注', minWidth: 160 },
    {
      field: 'fileUrl',
      title: '附件',
      width: 88,
      slots: { default: 'fileUrl' },
    },
    { field: 'creatorName', title: '创建人', width: 100 },
    {
      field: 'createTime',
      title: '创建时间',
      width: 160,
      formatter: 'formatDateTime',
    },
    { field: 'auditorName', title: '审核人', width: 100 },
    {
      field: 'auditTime',
      title: '审核时间',
      width: 160,
      formatter: 'formatDateTime',
    },
    {
      title: '操作',
      width: 126,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareFinanceDocumentListColumns(
    columns.map((column) =>
      column.field && column.field in RECEIVABLE_MISC_SORT_FIELD_MAP
        ? { ...column, sortable: true }
        : column,
    ),
    rows,
  );
}
