import {
  financeValue,
  financeSubtract,
} from '#/views/erp/finance/utils/finance-decimal';
import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PrepareFinanceDocumentItemColumnOptions } from '#/views/erp/finance/utils/document-item-table';

import { DICT_TYPE } from '@vben/constants';

import {
  getAccountSimpleList,
  getAccountSimplePage,
} from '#/api/erp/finance/account';
import {
  getFinanceReceiptDeptSimplePage,
  getFinanceReceiptUserSimplePage,
} from '#/api/erp/finance/receipt';
import { getSimpleUserList } from '#/api/system/user';
import { getRangePickerDefaultProps } from '#/utils';
import { getFinanceReceiptCustomerDeptTree } from '#/views/erp/finance/utils/dept';
import { prepareFinanceDocumentItemColumns } from '#/views/erp/finance/utils/document-item-table';
import { prepareFinanceDocumentListColumns } from '#/views/erp/finance/utils/document-list-table';
import {
  applyFinanceFormFieldPermission,
  applyFinanceItemColumnPermission,
} from '#/views/erp/finance/utils/field-permission';
import {
  createOptionalNumberRule,
  createRequiredNumberRule,
} from '#/views/erp/finance/utils/text-number';
import { getCustomerSelectProps } from '#/views/erp/sale/utils/customer-select';

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
        fieldName: 'sourceReceivableMiscNo',
        label: '来源其他应收',
        component: 'Input',
        componentProps: {
          disabled: true,
          placeholder: '-',
        },
        dependencies: {
          triggerFields: ['sourceReceivableMiscNo'],
          show: (values) =>
            formType === 'detail' && Boolean(values.sourceReceivableMiscNo),
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
        componentProps: getCustomerSelectProps(
          formType === 'detail',
          'finance-receipt-form-select-dropdown',
        ),
        rules: 'required',
      },
      {
        fieldName: 'financeUserId',
        label: '财务人员',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'finance-receipt-form-select-dropdown',
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
        component: 'ApiTreeSelect',
        componentProps: {
          disabled: formType === 'detail',
          popupClassName: 'finance-receipt-form-select-dropdown',
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          api: getFinanceReceiptCustomerDeptTree,
          params: {},
          shouldFetch: (params: { customerId?: number | string }) =>
            Boolean(params?.customerId),
          labelField: 'name',
          valueField: 'id',
          childrenField: 'children',
        },
      },
      {
        fieldName: 'accountId',
        label: '收款账户',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'finance-receipt-form-select-dropdown',
          placeholder: '请选择收款账户',
          allowClear: true,
          showSearch: true,
          api: getAccountSimpleList,
          labelField: 'name',
          valueField: 'id',
        },
        rules: 'required',
      },
      {
        fieldName: 'totalPrice',
        label: '合计收款',
        component: 'DecimalAmountInput',
        formItemClass: 'receipt-form__amount-field',
        componentProps: {
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
        formItemClass: 'receipt-form__amount-field',
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
        formItemClass:
          'receipt-form__amount-field receipt-form__amount-field--actual',
        componentProps: {
          class: 'w-full',

          inputMode: 'decimal',
          disabled: true,
        },
        rules: createRequiredNumberRule('实际收款', { nonZero: true }),
      },
      {
        fieldName: 'paymentVoucherNo',
        label: '凭证号',
        component: 'Input',
        componentProps: {
          allowClear: true,
          disabled: formType === 'detail',
          maxlength: 64,
          placeholder: '请输入客户付款凭证号',
          showCount: formType !== 'detail',
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
        formItemClass: 'receipt-form__full-row',
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
        formItemClass: 'receipt-form__full-row',
      },
    ],
    hiddenFields,
  );
}

export function useFormItemColumns(
  disabled: boolean,
  hiddenFields: string[] = [],
  allowReverse = false,
  options: PrepareFinanceDocumentItemColumnOptions = {},
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentItemColumns(
    applyFinanceItemColumnPermission(
      [
        { type: 'seq', title: '序号', minWidth: 50 },
        {
          field: 'bizNo',
          title: '关联销售单或应收单',
          minWidth: 190,
          slots: { default: 'bizNo' },
        },
        { field: 'customerName', title: '收款客户', minWidth: 130 },
        { field: 'deptName', title: '所属部门', minWidth: 120 },
        {
          field: 'receiptPrice',
          title: '收款/核销金额',
          minWidth: 120,
          align: 'right',
          headerAlign: 'right',
          slots: { default: 'receiptPrice' },
        },
        {
          field: 'receiptTime',
          title: '收款日期',
          minWidth: 160,
          formatter: 'formatDateTime',
        },
        {
          field: 'writeOffStatus',
          title: '核销状态',
          minWidth: 90,
          slots: { default: 'writeOffStatus' },
        },
        {
          field: 'writeOffTime',
          title: '核销时间',
          minWidth: 160,
          formatter: 'formatDateTime',
        },
        { field: 'reverseReason', title: '撤销原因', minWidth: 150 },
        {
          field: 'totalPrice',
          title: '应收金额',
          minWidth: 100,
          align: 'right',
          headerAlign: 'right',
          formatter: 'formatAmount2',
        },
        {
          field: 'receiptedPrice',
          title: '已核销金额',
          minWidth: 100,
          align: 'right',
          headerAlign: 'right',
          formatter: 'formatAmount2',
        },
        {
          field: 'unReceiptedPrice',
          title: '未核销金额',
          minWidth: 110,
          align: 'right',
          headerAlign: 'right',
          formatter: ({ row }) =>
            erpPriceInputFormatter(
              financeSubtract(
                financeSubtract(
                  financeValue(row.totalPrice || 0),
                  financeValue(row.receiptedPrice || 0),
                ),
                financeValue(row.receiptPrice || 0),
              ),
            ),
        },
        {
          field: 'remark',
          title: '备注',
          minWidth: 150,
          slots: { default: 'remark' },
        },
        { field: 'receiptMethod', title: '收款方式', minWidth: 110 },
        { field: 'accountName', title: '收款账户', minWidth: 130 },
        { field: 'financeUserName', title: '经办人', minWidth: 110 },
        {
          field: 'actions',
          title: '操作',
          width: 72,
          fixed: 'right',
          slots: { default: 'actions' },
          visible:
            !disabled ||
            (allowReverse &&
              (options.rows ?? []).some((row) => row.writeOffStatus === 1)),
        },
      ],
      hiddenFields,
    ) || [],
    { editable: !disabled, ...options },
  );
}

export function useGridFormSchema(
  hiddenFields: string[] = [],
  accountingVoucherVisible = true,
): VbenFormSchema[] {
  return applyFinanceFormFieldPermission(
    [
      {
        fieldName: 'customerId',
        label: '客户',
        component: 'CustomerLazySelect',
        componentProps: getCustomerSelectProps(
          false,
          'finance-receipt-search-select-dropdown',
        ),
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
          popupClassName: 'finance-receipt-search-select-dropdown',
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
          popupClassName: 'finance-receipt-search-select-dropdown',
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
          popupClassName: 'finance-receipt-search-select-dropdown',
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
          popupClassName: 'finance-receipt-search-select-dropdown',
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
        fieldName: 'paymentVoucherNo',
        label: '凭证号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入凭证号',
          allowClear: true,
          maxlength: 64,
        },
      },
      {
        fieldName: 'voucherNo',
        label: '会计凭证号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入会计凭证号',
          allowClear: true,
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
    ],
    hiddenFields,
  ).filter(
    (item) => item.fieldName !== 'voucherNo' || accountingVoucherVisible,
  );
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
        width: 118,
        slots: { default: 'receiptNo' },
      },
      {
        field: 'customerName',
        title: '客户',
        width: 132,
        showOverflow: 'tooltip',
      },
      {
        field: 'receiptTime',
        title: '日期',
        width: 100,
        formatter: 'formatDate',
      },
      {
        field: 'settleMethod',
        title: '结算方式',
        width: 92,
        showOverflow: 'tooltip',
      },
      {
        field: 'accountName',
        title: '结算账户',
        width: 110,
        showOverflow: 'tooltip',
      },
      {
        field: 'totalPrice',
        title: '总结算金额',
        formatter: 'formatAmount2',
        width: 104,
        align: 'right',
        headerAlign: 'right',
        className: 'finance-receipt-amount-cell',
      },
      {
        field: 'discountPrice',
        title: '折让金额',
        formatter: 'formatAmount2',
        width: 92,
        align: 'right',
        headerAlign: 'right',
        className: 'finance-receipt-amount-cell',
      },
      {
        field: 'receiptPrice',
        title: '实收总金额',
        formatter: 'formatAmount2',
        width: 104,
        align: 'right',
        headerAlign: 'right',
        className:
          'finance-receipt-amount-cell finance-receipt-amount-cell--actual',
      },
      {
        field: 'allocatedPrice',
        title: '已核销金额',
        formatter: 'formatAmount2',
        width: 104,
        align: 'right',
        headerAlign: 'right',
        className: 'finance-receipt-amount-cell',
      },
      {
        field: 'unallocatedPrice',
        title: '未核销金额',
        formatter: 'formatAmount2',
        width: 104,
        align: 'right',
        headerAlign: 'right',
        className: 'finance-receipt-amount-cell',
      },
      {
        field: 'writeOffStatus',
        title: '核销状态',
        width: 88,
        formatter: ({ cellValue }) =>
          ['未核销', '部分核销', '已核销', '数据异常'][Number(cellValue)] ||
          '-',
      },
      {
        field: 'status',
        title: '状态',
        width: 76,
        slots: { default: 'status' },
      },
      {
        field: 'remark',
        title: '备注',
        width: 140,
        showOverflow: 'tooltip',
      },
      {
        field: 'paymentVoucherNo',
        title: '凭证号',
        width: 140,
        showOverflow: 'tooltip',
      },
      {
        field: 'voucherNo',
        title: '会计凭证号',
        width: 140,
        showOverflow: 'tooltip',
      },
      {
        field: 'financeUserName',
        title: '经手人',
        width: 78,
        showOverflow: 'tooltip',
      },
      {
        field: 'auditorName',
        title: '审核人',
        width: 78,
        showOverflow: 'tooltip',
      },
      {
        field: 'auditTime',
        title: '审核日期',
        width: 112,
        formatter: 'formatDateTime',
      },
      {
        field: 'bankName',
        title: '开户行',
        width: 120,
        showOverflow: 'tooltip',
      },
      {
        field: 'actions',
        title: '操作',
        width: 180,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    rows,
  );
}

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

export function useSaleOutGridColumns(): NonNullable<
  VxeTableGridOptions['columns']
> {
  return [
    { type: 'checkbox', width: 50, fixed: 'left' },
    { field: 'no', title: '出库单号', width: 180, fixed: 'left' },
    {
      field: 'outTime',
      title: '出库时间',
      width: 150,
      formatter: 'formatDate',
    },
    {
      field: 'totalPrice',
      title: '应收金额',
      minWidth: 110,
      formatter: 'formatAmount2',
    },
    {
      field: 'receiptPrice',
      title: '已收金额',
      minWidth: 110,
      formatter: 'formatAmount2',
    },
    {
      field: 'unReceiptPrice',
      title: '未收金额',
      minWidth: 110,
      formatter: ({ row }) =>
        erpPriceInputFormatter(
          financeSubtract(row.totalPrice || 0, row.receiptPrice || 0),
        ),
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
  ];
}

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

export function useSaleReturnGridColumns(): NonNullable<
  VxeTableGridOptions['columns']
> {
  return [
    { type: 'checkbox', width: 50, fixed: 'left' },
    { field: 'no', title: '退货单号', width: 180, fixed: 'left' },
    {
      field: 'returnTime',
      title: '退货时间',
      width: 150,
      formatter: 'formatDate',
    },
    {
      field: 'totalPrice',
      title: '应退金额',
      minWidth: 110,
      formatter: 'formatAmount2',
    },
    {
      field: 'refundPrice',
      title: '已退金额',
      minWidth: 110,
      formatter: 'formatAmount2',
    },
    {
      field: 'unRefundPrice',
      title: '未退金额',
      minWidth: 110,
      formatter: ({ row }) =>
        erpPriceInputFormatter(
          financeSubtract(row.totalPrice || 0, row.refundPrice || 0),
        ),
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
  ];
}

export function useSalePriceAdjustGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'no',
      label: '调价单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入调价单号',
        allowClear: true,
      },
    },
  ];
}

export function useSalePriceAdjustGridColumns(): NonNullable<
  VxeTableGridOptions['columns']
> {
  return [
    { type: 'checkbox', width: 50, fixed: 'left' },
    { field: 'no', title: '调价单号', width: 180, fixed: 'left' },
    {
      field: 'adjustDate',
      title: '调价时间',
      width: 150,
      formatter: 'formatDate',
    },
    {
      field: 'totalAdjustPrice',
      title: '调价金额',
      minWidth: 110,
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
  ];
}
