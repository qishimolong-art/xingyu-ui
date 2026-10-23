import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PrepareFinanceDocumentItemColumnOptions } from '#/views/erp/finance/utils/document-item-table';

import { getBaseDataSimpleList } from '#/api/erp/base';
import {
  getAccountSimpleList,
  getAccountSimplePage,
} from '#/api/erp/finance/account';
import {
  getPayableExpenseDeptSimplePage,
  getPayableExpenseUserSimplePage,
} from '#/api/erp/finance/payable/expense';
import { getSimpleDeptList } from '#/api/system/dept';
import { getSimpleUserList } from '#/api/system/user';
import { getRangePickerDefaultProps } from '#/utils';
import { prepareFinanceDocumentItemColumns } from '#/views/erp/finance/utils/document-item-table';
import { prepareFinanceDocumentListColumns } from '#/views/erp/finance/utils/document-list-table';
import {
  applyFinanceFormFieldPermission,
  applyFinanceItemColumnPermission,
} from '#/views/erp/finance/utils/field-permission';
import { createOptionalNumberRule } from '#/views/erp/finance/utils/text-number';

const PAYABLE_EXPENSE_BIZ_TYPE = 'payable_expense_biz_type';
const PAYABLE_EXPENSE_TYPE = 'payable_expense_type';
const PAYABLE_EXPENSE_DOC_TYPE = 'payable_expense_doc_type';
export const PAYABLE_EXPENSE_ITEM_PROJECT = 'payable_expense_item_project';

export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  const disabled = formType === 'detail';
  const formHiddenFields = hiddenFields.filter(
    (field) => field !== 'items' && field !== 'col_items',
  );
  return applyFinanceFormFieldPermission(
    [
      {
        fieldName: 'id',
        component: 'Input',
        dependencies: { triggerFields: [''], show: () => false },
      },
      {
        fieldName: 'bizTime',
        label: '日期',
        component: 'DatePicker',
        componentProps: {
          placeholder: '请选择日期',
          disabled,
          format: 'YYYY-MM-DD',
          valueFormat: 'YYYY-MM-DD',
        },
        rules: 'required',
      },
      {
        fieldName: 'no',
        label: '单号',
        component: 'Input',
        componentProps: { placeholder: '系统自动生成', disabled: true },
      },
      {
        fieldName: 'settleMethod',
        label: '结算方式',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'payable-expense-form-select-dropdown',
          placeholder: '请选择结算方式',
          allowClear: true,
          showSearch: true,
          api: () => getBaseDataSimpleList('settle_method'),
          labelField: 'name',
          valueField: 'name',
          disabled,
        },
        rules: 'required',
      },
      {
        fieldName: 'accountId',
        label: '结算账户',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'payable-expense-form-select-dropdown',
          placeholder: '请选择结算账户',
          disabled,
          allowClear: true,
          showSearch: true,
          api: getAccountSimpleList,
          labelField: 'name',
          valueField: 'id',
        },
        rules: 'required',
      },
      {
        fieldName: 'voucherNo',
        label: '凭证号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入凭证号',
          disabled,
          maxlength: 64,
        },
      },
      {
        fieldName: 'expenseBizType',
        label: '类型',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'payable-expense-form-select-dropdown',
          placeholder: '请选择类型',
          allowClear: true,
          showSearch: true,
          api: () => getBaseDataSimpleList(PAYABLE_EXPENSE_BIZ_TYPE),
          labelField: 'name',
          valueField: 'name',
          disabled,
        },
      },
      {
        fieldName: 'totalAmount',
        label: '总金额',
        component: 'DecimalAmountInput',
        componentProps: {
          placeholder: '总金额',
          disabled: true,
          class: 'w-full',

          inputMode: 'decimal',
        },
        rules: createOptionalNumberRule('总金额', { min: 0 }),
      },
      {
        fieldName: 'deptId',
        label: '开单部门',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'payable-expense-form-select-dropdown',
          placeholder: '请选择开单部门',
          disabled,
          allowClear: true,
          showSearch: true,
          api: getSimpleDeptList,
          labelField: 'name',
          valueField: 'id',
        },
        rules: 'required',
      },
      {
        fieldName: 'handlerId',
        label: '经手人',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'payable-expense-form-select-dropdown',
          placeholder: '请选择经手人',
          disabled,
          allowClear: true,
          showSearch: true,
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
        },
        rules: 'required',
      },
      {
        fieldName: 'expenseType',
        label: '支出类型',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'payable-expense-form-select-dropdown',
          placeholder: '请选择支出类型',
          allowClear: true,
          showSearch: true,
          api: () => getBaseDataSimpleList(PAYABLE_EXPENSE_TYPE),
          labelField: 'name',
          valueField: 'name',
          disabled,
        },
        rules: 'required',
      },
      {
        fieldName: 'party',
        label: '对象',
        component: 'Input',
        componentProps: {
          placeholder: '请输入对象',
          disabled,
          maxlength: 128,
        },
      },
      {
        fieldName: 'relatedBiz',
        label: '相关业务',
        component: 'Input',
        componentProps: {
          placeholder: '请输入相关业务描述',
          disabled,
          maxlength: 256,
        },
        formItemClass: 'col-span-1 sm:col-span-2',
      },
      {
        fieldName: 'docType',
        label: '单据类型',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'payable-expense-form-select-dropdown',
          placeholder: '请选择单据类型',
          allowClear: true,
          showSearch: true,
          api: () => getBaseDataSimpleList(PAYABLE_EXPENSE_DOC_TYPE),
          labelField: 'name',
          valueField: 'name',
          disabled,
        },
        defaultValue: '正常单据',
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
          disabled,
          autoSize: { minRows: 1, maxRows: 2 },
          maxlength: 512,
        },
        formItemClass: 'col-span-1 sm:col-span-2 xl:col-span-4',
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
        formItemClass: 'col-span-1 sm:col-span-2 xl:col-span-3',
      },
    ],
    formHiddenFields,
  );
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'accountId',
      label: '结算账户',
      component: 'ErpLazyPageSelect',
      componentProps: {
        popupClassName: 'payable-expense-search-select-dropdown',
        placeholder: '请选择结算账户',
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
      fieldName: 'bizTime',
      label: '日期',
      component: 'RangePicker',
      componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
    },
    {
      fieldName: 'deptId',
      label: '开单部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        popupClassName: 'payable-expense-search-select-dropdown',
        placeholder: '请选择开单部门',
        allowClear: true,
        showSearch: true,
        api: getPayableExpenseDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'no',
      label: '单据编号',
      component: 'Input',
      componentProps: { placeholder: '请输入单据编号', allowClear: true },
    },
    {
      fieldName: 'handlerId',
      label: '经手人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        popupClassName: 'payable-expense-search-select-dropdown',
        placeholder: '请选择经手人',
        allowClear: true,
        showSearch: true,
        api: getPayableExpenseUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        loadErrorMessage: '经手人列表加载失败，请重试',
      },
    },
    {
      fieldName: 'party',
      label: '对象',
      component: 'Input',
      componentProps: { placeholder: '请输入对象', allowClear: true },
    },
    {
      fieldName: 'itemName',
      label: '项目名称',
      component: 'ApiSelect',
      componentProps: {
        popupClassName: 'payable-expense-search-select-dropdown',
        placeholder: '请选择项目名称',
        allowClear: true,
        showSearch: true,
        api: () => getBaseDataSimpleList(PAYABLE_EXPENSE_ITEM_PROJECT),
        labelField: 'name',
        valueField: 'name',
      },
    },
    {
      fieldName: 'invoiceNo',
      label: '发票号',
      component: 'Input',
      componentProps: { placeholder: '请输入发票号', allowClear: true },
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'Input',
      componentProps: { placeholder: '请输入备注', allowClear: true },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        placeholder: '请选择状态',
        allowClear: true,
        options: [
          { label: '草稿', value: 0 },
          { label: '未审核', value: 10 },
          { label: '已审核', value: 20 },
        ],
      },
    },
  ];
}

export function useGridColumns(
  rows: Record<string, any>[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentListColumns(
    [
      { type: 'checkbox', width: 36 },
      {
        field: 'deleteAction',
        title: '删除',
        width: 40,
        slots: { default: 'deleteAction' },
      },
      {
        field: 'printAction',
        title: '打印',
        width: 40,
        slots: { default: 'printAction' },
      },
      {
        field: 'no',
        title: '单号',
        width: 140,
        slots: { default: 'no' },
      },
      {
        field: 'bizTime',
        title: '日期',
        width: 104,
        formatter: 'formatDate',
      },
      { field: 'expenseBizType', title: '类型', width: 120 },
      { field: 'expenseType', title: '支出类型', width: 110 },
      {
        field: 'totalAmount',
        title: '金额',
        width: 108,
        align: 'right',
        headerAlign: 'right',
        className: 'payable-expense-amount-cell',
        formatter: 'formatAmount2',
      },
      { field: 'accountName', title: '账户', width: 130 },
      {
        field: 'status',
        title: '状态',
        width: 84,
        slots: { default: 'status' },
      },
      { field: 'handlerName', title: '经手人', width: 100 },
      { field: 'party', title: '对象', width: 130 },
      {
        field: 'auditTime',
        title: '审核时间',
        width: 154,
        formatter: 'formatDateTime',
      },
      { field: 'remark', title: '备注', width: 160 },
      { field: 'creatorName', title: '创建人', width: 100 },
      { field: 'relatedBiz', title: '相关业务', width: 140 },
      { field: 'deptName', title: '部门', width: 110 },
      { field: 'auditorName', title: '审核人', width: 100 },
      {
        field: 'actions',
        title: '操作',
        width: 168,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    rows,
  );
}

export function useItemColumns(
  disabled: boolean,
  hiddenFields: string[] = [],
  options: PrepareFinanceDocumentItemColumnOptions = {},
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentItemColumns(
    applyFinanceItemColumnPermission(
      [
        {
          field: 'itemName',
          title: '项目名称',
          minWidth: 150,
          slots: { default: 'itemName' },
        },
        {
          field: 'amount',
          title: '金额',
          minWidth: 120,
          align: 'right',
          headerAlign: 'center',
          slots: { default: 'amount' },
        },
        {
          field: 'invoiceNo',
          title: '发票号',
          minWidth: 130,
          slots: { default: 'invoiceNo' },
        },
        {
          field: 'party',
          title: '对象',
          minWidth: 130,
          slots: { default: 'party' },
        },
        {
          field: 'remark',
          title: '备注',
          minWidth: 180,
          slots: { default: 'remark' },
        },
        {
          field: 'deptId',
          title: '部门',
          minWidth: 150,
          slots: { default: 'deptId' },
        },
        {
          field: 'bizDate',
          title: '发生日期',
          minWidth: 140,
          slots: { default: 'bizDate' },
        },
        {
          field: 'handlerId',
          title: '申请人',
          minWidth: 140,
          slots: { default: 'handlerId' },
        },
        {
          field: 'qty',
          title: '数量',
          minWidth: 90,
          align: 'right',
          headerAlign: 'center',
          slots: { default: 'qty' },
        },
        {
          field: 'expenseCategory',
          title: '费用分类',
          minWidth: 120,
          slots: { default: 'expenseCategory' },
        },
        {
          field: 'fileUrl',
          title: '附件',
          minWidth: 170,
          slots: { default: 'fileUrl' },
        },
        {
          field: 'actions',
          title: '操作',
          width: 72,
          fixed: 'right',
          slots: { default: 'actions' },
          visible: !disabled,
        },
      ],
      hiddenFields,
    ) || [],
    { editable: !disabled, ...options },
  );
}
