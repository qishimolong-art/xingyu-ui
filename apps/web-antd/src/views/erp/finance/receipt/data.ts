import { financeSubtract } from '#/views/erp/finance/utils/finance-decimal';
import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PrepareFinanceDocumentItemColumnOptions } from '#/views/erp/finance/utils/document-item-table';

import { DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';


import {
  getAccountSimpleList,
  getAccountSimplePage,
} from '#/api/erp/finance/account';
import { getFinanceBillDeptSimplePage } from '#/api/erp/finance/bill';
import {
  getFinanceReceiptDeptSimplePage,
  getFinanceReceiptUserSimplePage,
} from '#/api/erp/finance/receipt';
import { getSimpleDeptList } from '#/api/system/dept';
import { getSimpleUserList } from '#/api/system/user';
import { getRangePickerDefaultProps } from '#/utils';
import { prepareFinanceDocumentItemColumns } from '#/views/erp/finance/utils/document-item-table';
import { prepareFinanceDocumentListColumns } from '#/views/erp/finance/utils/document-list-table';
import {
  applyFinanceFormFieldPermission,
  applyFinanceItemColumnPermission,
} from '#/views/erp/finance/utils/field-permission';
import {
  createOptionalNumberRule,
  createRequiredNumberRule,
  toOptionalNumberValue,
} from '#/views/erp/finance/utils/text-number';
import { getSupplierSelectProps } from '#/views/erp/purchase/utils/supplier-select';
import { getCustomerSelectProps } from '#/views/erp/sale/utils/customer-select';

/** 表单的配置项 */
export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyFinanceFormFieldPermission(
    [
      {
        fieldName: 'id',
        component: 'Input',
        dependencies: {
          triggerFields: [''],
          show: () => false,
        },
      },
      {
        fieldName: 'no',
        label: '收款单号',
        component: 'Input',
        componentProps: {
          placeholder: '系统自动生成',
          disabled: true,
        },
      },
      {
        fieldName: 'receiptTime',
        label: '收款时间',
        component: 'DatePicker',
        componentProps: {
          disabled: formType === 'detail',
          placeholder: '选择收款时间',
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
          valueFormat: 'x',
        },
        rules: 'required',
      },
      {
        fieldName: 'customerId',
        label: '客户',
        component: 'CustomerLazySelect',
        componentProps: getCustomerSelectProps(formType === 'detail'),
        rules: 'required',
      },
      {
        fieldName: 'financeUserId',
        label: '财务人员',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择财务人员',
          allowClear: true,
          showSearch: true,
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
        },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ApiSelect',
        componentProps: {
          disabled: formType === 'detail',
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          api: getSimpleDeptList,
          labelField: 'name',
          valueField: 'id',
        },
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
          autoSize: { minRows: 1, maxRows: 1 },
          disabled: formType === 'detail',
        },
        formItemClass: 'col-span-2',
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
          showDescription: formType !== 'detail',
          disabled: formType === 'detail',
        },
        formItemClass: 'col-span-3',
      },
      {
        fieldName: 'items',
        label: '销售出库、退货单',
        component: 'Input',
        formItemClass: 'col-span-3',
      },
      {
        fieldName: 'accountId',
        label: '收款账户',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择收款账户',
          allowClear: true,
          showSearch: true,
          api: getAccountSimpleList,
          labelField: 'name',
          valueField: 'id',
        },
      },
      {
        fieldName: 'totalPrice',
        label: '合计收款',
        component: 'DecimalAmountInput',
        componentProps: {
          placeholder: '合计收款',
          class: 'w-full',
          
          inputMode: 'decimal',
          disabled: formType === 'detail',
        },
        rules: createRequiredNumberRule('合计收款', { nonZero: true }),
      },
      {
        fieldName: 'discountPrice',
        label: '优惠金额',
        component: 'DecimalAmountInput',
        componentProps: {
          disabled: formType === 'detail',
          placeholder: '请输入优惠金额',
          class: 'w-full',
          
          inputMode: 'decimal',
        },
        rules: createOptionalNumberRule('优惠金额', { min: 0 }),
      },
      {
        fieldName: 'receiptPrice',
        label: '实际收款',
        component: 'DecimalAmountInput',
        componentProps: {
          placeholder: '实际收款',
          class: 'w-full',
          
          inputMode: 'decimal',
          disabled: formType === 'detail',
        },
        rules: createRequiredNumberRule('实际收款', { nonZero: true }),
        dependencies: {
          triggerFields: ['totalPrice', 'discountPrice'],
          componentProps: (values) => {
            const totalPrice = toOptionalNumberValue(values.totalPrice) || 0;
            const discountPrice =
              toOptionalNumberValue(values.discountPrice) || 0;
            values.receiptPrice = financeSubtract(totalPrice, discountPrice);
            return {};
          },
        },
      },
      {
        fieldName: 'creatorName',
        label: '创建人',
        component: 'Input',
        componentProps: { disabled: true },
        dependencies: { triggerFields: ['id'], show: (values) => !!values.id },
      },
      {
        fieldName: 'createTime',
        label: '创建时间',
        component: 'DatePicker',
        componentProps: {
          disabled: true,
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
        },
        dependencies: { triggerFields: ['id'], show: (values) => !!values.id },
      },
      {
        fieldName: 'updaterName',
        label: '修改人',
        component: 'Input',
        componentProps: { disabled: true },
        dependencies: { triggerFields: ['id'], show: (values) => !!values.id },
      },
      {
        fieldName: 'updateTime',
        label: '修改时间',
        component: 'DatePicker',
        componentProps: {
          disabled: true,
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
        },
        dependencies: { triggerFields: ['id'], show: (values) => !!values.id },
      },
    ],
    hiddenFields,
  );
}

/** 表单的明细表格列 */
export function useFormItemColumns(
  disabled: boolean,
  hiddenFields: string[] = [],
  options: PrepareFinanceDocumentItemColumnOptions = {},
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentItemColumns(
    applyFinanceItemColumnPermission(
      [
        { type: 'seq', title: '序号', minWidth: 50, fixed: 'left' },
        {
          field: 'bizNo',
          title: '销售单据编号',
          minWidth: 200,
          slots: { default: 'bizNo' },
        },
        {
          field: 'totalPrice',
          title: '应收金额',
          minWidth: 100,
          formatter: 'formatAmount2',
        },
        {
          field: 'receiptedPrice',
          title: '已收金额',
          minWidth: 100,
          formatter: 'formatAmount2',
        },
        {
          field: 'receiptPrice',
          title: '本次收款',
          minWidth: 115,
          fixed: 'right',
          slots: { default: 'receiptPrice' },
        },
        {
          field: 'remark',
          title: '备注',
          minWidth: 150,
          slots: { default: 'remark' },
        },
        {
          title: '操作',
          width: 50,
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

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'CustomerLazySelect',
      componentProps: getCustomerSelectProps(),
    },
    {
      fieldName: 'receiptTime',
      label: '收款时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
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
        api: getFinanceReceiptDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'no',
      label: '收款单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入收款单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'creator',
      label: '创建人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择创建人',
        allowClear: true,
        showSearch: true,
        api: getFinanceReceiptUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        loadErrorMessage: '创建人列表加载失败，请重试',
      },
    },
    {
      fieldName: 'financeUserId',
      label: '财务人员',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择财务人员',
        allowClear: true,
        showSearch: true,
        api: getFinanceReceiptUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        loadErrorMessage: '财务人员列表加载失败，请重试',
      },
    },
    {
      fieldName: 'accountId',
      label: '收款账户',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择收款账户',
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
      fieldName: 'remark',
      label: '备注',
      component: 'Input',
      componentProps: {
        placeholder: '请输入备注',
        allowClear: true,
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(
  rows: Record<string, any>[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentListColumns(
    [
      {
        type: 'checkbox',
        width: 50,
        fixed: 'left',
      },
      {
        field: 'no',
        title: '收款单号',
        width: 180,
        fixed: 'left',
      },
      {
        field: 'customerName',
        title: '客户',
        minWidth: 120,
      },
      {
        field: 'receiptTime',
        title: '收款时间',
        width: 160,
        formatter: 'formatDate',
      },
      {
        field: 'creatorName',
        title: '创建人',
        minWidth: 120,
      },
      {
        field: 'createTime',
        title: '创建时间',
        minWidth: 170,
        formatter: 'formatDateTime',
      },
      {
        field: 'financeUserName',
        title: '财务人员',
        minWidth: 120,
      },
      {
        field: 'deptName',
        title: '所属部门',
        minWidth: 120,
      },
      {
        field: 'accountName',
        title: '收款账户',
        minWidth: 120,
      },
      {
        field: 'totalPrice',
        title: '合计收款',
        formatter: 'formatAmount2',
        minWidth: 120,
      },
      {
        field: 'discountPrice',
        title: '优惠金额',
        formatter: 'formatAmount2',
        minWidth: 120,
      },
      {
        field: 'receiptPrice',
        title: '实际收款',
        formatter: 'formatAmount2',
        minWidth: 120,
      },
      {
        field: 'status',
        title: '状态',
        minWidth: 90,
        cellRender: {
          name: 'CellDict',
          props: { type: DICT_TYPE.ERP_AUDIT_STATUS },
        },
      },
      {
        field: 'updaterName',
        title: '修改人',
        minWidth: 120,
      },
      {
        field: 'updateTime',
        title: '修改时间',
        minWidth: 170,
        formatter: 'formatDateTime',
      },
      {
        title: '操作',
        width: 260,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    rows,
  );
}

export function useBillGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'billType',
      label: '账单类型',
      component: 'Select',
      componentProps: {
        options: [
          { label: '收款', value: 'receipt' },
          { label: '付款', value: 'payment' },
        ],
        placeholder: '请选择账单类型',
        allowClear: true,
      },
    },
    {
      fieldName: 'no',
      label: '单据编号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入单据编号',
        allowClear: true,
      },
    },
    {
      fieldName: 'billTime',
      label: '交易时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'CustomerLazySelect',
      componentProps: getCustomerSelectProps(),
    },
    {
      fieldName: 'supplierId',
      label: '供应商',
      component: 'SupplierLazySelect',
      componentProps: getSupplierSelectProps(false),
    },
    {
      fieldName: 'accountId',
      label: '账户',
      component: 'ErpLazyPageSelect',
      componentProps: {
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
      label: '所属部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择所属部门',
        allowClear: true,
        showSearch: true,
        api: getFinanceBillDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_AUDIT_STATUS, 'number'),
        placeholder: '请选择状态',
        allowClear: true,
      },
    },
  ];
}

export function useBillGridColumns(): NonNullable<
  VxeTableGridOptions['columns']
> {
  return [
    { type: 'checkbox', width: 50, fixed: 'left' },
    { field: 'billTypeName', title: '账单类型', minWidth: 90, fixed: 'left' },
    { field: 'no', title: '单据编号', minWidth: 180, fixed: 'left' },
    { field: 'customerName', title: '客户', minWidth: 140 },
    { field: 'supplierName', title: '供应商', minWidth: 140 },
    {
      field: 'billTime',
      title: '交易时间',
      minWidth: 170,
      formatter: 'formatDateTime',
    },
    { field: 'accountName', title: '账户', minWidth: 140 },
    { field: 'financeUserName', title: '财务人员', minWidth: 110 },
    { field: 'deptName', title: '所属部门', minWidth: 120 },
    {
      field: 'totalPrice',
      title: '合计金额',
      minWidth: 120,
      formatter: 'formatAmount2',
    },
    {
      field: 'discountPrice',
      title: '优惠金额',
      minWidth: 120,
      formatter: 'formatAmount2',
    },
    {
      field: 'actualPrice',
      title: '实际金额',
      minWidth: 120,
      formatter: 'formatAmount2',
    },
    {
      field: 'status',
      title: '状态',
      minWidth: 90,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.ERP_AUDIT_STATUS },
      },
    },
    { field: 'creatorName', title: '创建人', minWidth: 110 },
    {
      field: 'createTime',
      title: '创建时间',
      minWidth: 170,
      formatter: 'formatDateTime',
    },
    { field: 'updaterName', title: '修改人', minWidth: 110 },
    {
      field: 'updateTime',
      title: '修改时间',
      minWidth: 170,
      formatter: 'formatDateTime',
    },
    {
      title: '操作',
      width: 260,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}

/** 销售出库单选择表单的配置项 */
export function useSaleOutGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'no',
      label: '出库单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入出库单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '已自动选择客户',
      },
    },
    {
      fieldName: 'receiptStatus',
      label: '收款状态',
      component: 'Select',
      componentProps: {
        options: [
          { label: '未收款', value: 0 },
          { label: '部分收款', value: 1 },
          { label: '全部收款', value: 2 },
        ],
        placeholder: '请选择收款状态',
        allowClear: true,
      },
    },
  ];
}

/** 销售出库单选择列表的字段 */
export function useSaleOutGridColumns(): NonNullable<
  VxeTableGridOptions['columns']
> {
  return [
    {
      type: 'checkbox',
      width: 50,
      fixed: 'left',
    },
    {
      field: 'no',
      title: '出库单号',
      width: 200,
      fixed: 'left',
    },
    {
      field: 'customerName',
      title: '客户',
      minWidth: 120,
    },
    {
      field: 'outTime',
      title: '出库时间',
      width: 160,
      formatter: 'formatDate',
    },
    {
      field: 'totalPrice',
      title: '应收金额',
      formatter: 'formatAmount2',
      minWidth: 120,
    },
    {
      field: 'receiptPrice',
      title: '已收金额',
      formatter: 'formatAmount2',
      minWidth: 120,
    },
    {
      field: 'unReceiptPrice',
      title: '未收金额',
      formatter: ({ row }) => {
        return erpPriceInputFormatter(financeSubtract(row.totalPrice, row.receiptPrice) || 0);
      },
      minWidth: 120,
    },
    {
      field: 'status',
      title: '状态',
      minWidth: 100,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.ERP_AUDIT_STATUS },
      },
    },
  ];
}

/** 销售退货单选择表单的配置项 */
export function useSaleReturnGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'no',
      label: '退货单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入退货单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '已自动选择客户',
      },
    },
    {
      fieldName: 'refundStatus',
      label: '退款状态',
      component: 'Select',
      componentProps: {
        options: [
          { label: '未退款', value: 0 },
          { label: '部分退款', value: 1 },
          { label: '全部退款', value: 2 },
        ],
        placeholder: '请选择退款状态',
        allowClear: true,
      },
    },
  ];
}

/** 销售退货单选择列表的字段 */
export function useSaleReturnGridColumns(): NonNullable<
  VxeTableGridOptions['columns']
> {
  return [
    {
      type: 'checkbox',
      width: 50,
      fixed: 'left',
    },
    {
      field: 'no',
      title: '退货单号',
      width: 200,
      fixed: 'left',
    },
    {
      field: 'customerName',
      title: '客户',
      minWidth: 120,
    },
    {
      field: 'returnTime',
      title: '退货时间',
      width: 160,
      formatter: 'formatDate',
    },
    {
      field: 'totalPrice',
      title: '应退金额',
      formatter: 'formatAmount2',
      minWidth: 120,
    },
    {
      field: 'refundPrice',
      title: '已退金额',
      formatter: 'formatAmount2',
      minWidth: 120,
    },
    {
      field: 'unRefundPrice',
      title: '未退金额',
      formatter: ({ row }) => {
        return erpPriceInputFormatter(financeSubtract(row.totalPrice, row.refundPrice) || 0);
      },
      minWidth: 120,
    },
    {
      field: 'status',
      title: '状态',
      minWidth: 100,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.ERP_AUDIT_STATUS },
      },
    },
  ];
}
