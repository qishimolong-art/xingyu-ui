import { financeValue, financeSubtract } from '#/views/erp/finance/utils/finance-decimal';
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
  getFinancePaymentDeptSimplePage,
  getFinancePaymentUserSimplePage,
} from '#/api/erp/finance/payment';
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
} from '#/views/erp/finance/utils/text-number';
import { getSupplierSelectProps } from '#/views/erp/purchase/utils/supplier-select';

export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
  onSupplierOptionsChange?: (options: any[]) => void,
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
        label: '付款单号',
        component: 'Input',
        componentProps: {
          placeholder: '系统自动生成',
          disabled: true,
        },
      },
      {
        fieldName: 'sourcePayableMiscNo',
        label: '来源其他应付',
        component: 'Input',
        componentProps: {
          disabled: true,
          placeholder: '-',
        },
        dependencies: {
          triggerFields: ['sourcePayableMiscNo'],
          show: (values) =>
            formType === 'detail' && Boolean(values.sourcePayableMiscNo),
        },
      },
      {
        fieldName: 'paymentTime',
        label: '付款时间',
        component: 'DatePicker',
        componentProps: {
          disabled: formType === 'detail',
          placeholder: '选择付款时间',
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
          valueFormat: 'x',
        },
        rules: 'required',
      },
      {
        fieldName: 'supplierId',
        label: '供应商',
        component: 'SupplierLazySelect',
        componentProps: {
          ...getSupplierSelectProps(
            formType === 'detail',
            'finance-payment-form-select-dropdown',
          ),
          onOptionsChange: onSupplierOptionsChange,
        },
        rules: 'required',
      },
      {
        fieldName: 'financeUserId',
        label: '经手人',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'finance-payment-form-select-dropdown',
          placeholder: '请选择经手人',
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
          popupClassName: 'finance-payment-form-select-dropdown',
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
        fieldName: 'accountId',
        label: '付款账户',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'finance-payment-form-select-dropdown',
          placeholder: '请选择付款账户',
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
        label: '合计付款',
        component: 'DecimalAmountInput',
        formItemClass: 'payment-form__amount-field',
        componentProps: {
          class: 'w-full',
          
          inputMode: 'decimal',
          disabled: formType === 'detail',
        },
        rules: createRequiredNumberRule('合计付款', { nonZero: true }),
      },
      {
        fieldName: 'discountPrice',
        label: '优惠金额',
        component: 'DecimalAmountInput',
        formItemClass: 'payment-form__amount-field',
        componentProps: {
          disabled: formType === 'detail',
          placeholder: '请输入优惠金额',
          class: 'w-full',
          
          inputMode: 'decimal',
        },
        rules: createOptionalNumberRule('优惠金额', { min: 0 }),
      },
      {
        fieldName: 'paymentPrice',
        label: '实际付款',
        component: 'DecimalAmountInput',
        formItemClass:
          'payment-form__amount-field payment-form__amount-field--actual',
        componentProps: {
          class: 'w-full',
          
          inputMode: 'decimal',
          disabled: true,
        },
        rules: createRequiredNumberRule('实际付款', { nonZero: true }),
      },
      {
        fieldName: 'paymentVoucherNo',
        label: '凭证号',
        component: 'Input',
        componentProps: {
          disabled: formType === 'detail',
          placeholder: '请输入凭证号',
          allowClear: true,
          maxlength: 64,
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
        formItemClass: 'payment-form__full-row',
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
        formItemClass: 'payment-form__full-row',
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

export function useFormItemColumns(
  disabled: boolean,
  hiddenFields: string[] = [],
  allowReverse = false,
  options: PrepareFinanceDocumentItemColumnOptions = {},
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentItemColumns(
    applyFinanceItemColumnPermission(
      [
        { type: 'seq', title: '序号', width: 48 },
        {
          field: 'bizNo',
          title: '关联采购单或应付单',
          minWidth: 190,
          sortable: true,
          slots: { default: 'bizNo' },
        },
        {
          field: 'supplierName',
          title: '付款供应商',
          minWidth: 130,
          sortable: true,
        },
        {
          field: 'deptName',
          title: '所属部门',
          minWidth: 120,
          sortable: true,
        },
        {
          field: 'paymentPrice',
          title: '付款/核销金额',
          minWidth: 120,
          sortable: true,
          align: 'right',
          headerAlign: 'right',
          slots: { default: 'paymentPrice' },
        },
        {
          field: 'paymentTime',
          title: '付款日期',
          minWidth: 160,
          sortable: true,
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
          title: '应付金额',
          minWidth: 100,
          sortable: true,
          align: 'right',
          headerAlign: 'right',
          formatter: 'formatAmount2',
        },
        {
          field: 'paidPrice',
          title: '已核销金额',
          minWidth: 100,
          sortable: true,
          align: 'right',
          headerAlign: 'right',
          formatter: 'formatAmount2',
        },
        {
          field: 'unPaymentPrice',
          title: '未核销金额',
          minWidth: 110,
          sortable: true,
          align: 'right',
          headerAlign: 'right',
          formatter: ({ row }) =>
            erpPriceInputFormatter(
              financeSubtract(financeSubtract(financeValue(row.totalPrice || 0), financeValue(row.paidPrice || 0)), financeValue(row.paymentPrice || 0)),
            ),
        },
        {
          field: 'remark',
          title: '备注',
          minWidth: 150,
          sortable: true,
          slots: { default: 'remark' },
        },
        {
          field: 'paymentMethod',
          title: '付款方式',
          minWidth: 110,
          sortable: true,
        },
        {
          field: 'accountName',
          title: '付款账户',
          minWidth: 130,
          sortable: true,
        },
        {
          field: 'financeUserName',
          title: '经办人',
          minWidth: 110,
          sortable: true,
        },
        {
          field: 'actions',
          title: '操作',
          width: 80,
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
        fieldName: 'supplierId',
        label: '供应商',
        component: 'SupplierLazySelect',
        componentProps: getSupplierSelectProps(
          false,
          'finance-payment-search-select-dropdown',
        ),
      },
      {
        fieldName: 'paymentTime',
        label: '付款时间',
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
          popupClassName: 'finance-payment-search-select-dropdown',
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          api: getFinancePaymentDeptSimplePage,
          pageSize: 10,
          labelField: 'name',
          valueField: 'id',
          loadErrorMessage: '部门列表加载失败，请重试',
        },
      },
      {
        fieldName: 'no',
        label: '付款单号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入付款单号',
          allowClear: true,
        },
      },
      {
        fieldName: 'creator',
        label: '创建人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'finance-payment-search-select-dropdown',
          placeholder: '请选择创建人',
          allowClear: true,
          showSearch: true,
          api: getFinancePaymentUserSimplePage,
          pageSize: 10,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '创建人列表加载失败，请重试',
        },
      },
      {
        fieldName: 'financeUserId',
        label: '经手人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'finance-payment-search-select-dropdown',
          placeholder: '请选择经手人',
          allowClear: true,
          showSearch: true,
          api: getFinancePaymentUserSimplePage,
          pageSize: 10,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '经手人列表加载失败，请重试',
        },
      },
      {
        fieldName: 'accountId',
        label: '付款账户',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'finance-payment-search-select-dropdown',
          placeholder: '请选择付款账户',
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
        slots: { default: 'paymentNo' },
      },
      {
        field: 'supplierName',
        title: '供应商',
        width: 132,
        showOverflow: 'tooltip',
      },
      {
        field: 'paymentTime',
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
        title: '应付金额',
        width: 92,
        formatter: 'formatAmount2',
        align: 'right',
        headerAlign: 'right',
        className: 'finance-payment-amount-cell',
      },
      {
        field: 'paymentPrice',
        title: '实付金额',
        width: 92,
        formatter: 'formatAmount2',
        align: 'right',
        headerAlign: 'right',
        className:
          'finance-payment-amount-cell finance-payment-amount-cell--actual',
      },
      {
        field: 'discountPrice',
        title: '折让金额',
        width: 92,
        formatter: 'formatAmount2',
        align: 'right',
        headerAlign: 'right',
        className: 'finance-payment-amount-cell',
      },
      {
        field: 'allocatedPrice',
        title: '已核销金额',
        formatter: 'formatAmount2',
        width: 104,
        align: 'right',
        headerAlign: 'right',
        className: 'finance-payment-amount-cell',
      },
      {
        field: 'unallocatedPrice',
        title: '未核销金额',
        formatter: 'formatAmount2',
        width: 104,
        align: 'right',
        headerAlign: 'right',
        className: 'finance-payment-amount-cell',
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
        field: 'creatorName',
        title: '制单人',
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
        field: 'printCount',
        title: '打印次数',
        width: 64,
        align: 'right',
        headerAlign: 'right',
        formatter: ({ cellValue }) => Number(cellValue || 0),
      },
      {
        field: 'financeUserName',
        title: '经手人',
        width: 78,
        showOverflow: 'tooltip',
      },
      {
        field: 'printTime',
        title: '打印时间',
        width: 112,
        formatter: 'formatDateTime',
      },
      {
        field: 'remark',
        title: '备注',
        width: 140,
        showOverflow: 'tooltip',
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
        width: 210,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    rows,
  );
}

export function usePurchaseInGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'no',
      label: '入库单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入入库单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'paymentStatus',
      label: '付款状态',
      component: 'Select',
      componentProps: {
        options: [
          { label: '未付款', value: 0 },
          { label: '部分付款', value: 1 },
          { label: '全部付款', value: 2 },
        ],
        placeholder: '请选择付款状态',
        allowClear: true,
      },
    },
  ];
}

export function usePurchaseInGridColumns(): NonNullable<
  VxeTableGridOptions['columns']
> {
  return [
    { type: 'checkbox', width: 50, fixed: 'left' },
    { field: 'no', title: '入库单号', width: 180, fixed: 'left' },
    { field: 'inTime', title: '入库时间', width: 150, formatter: 'formatDate' },
    {
      field: 'totalPrice',
      title: '应付金额',
      minWidth: 110,
      formatter: 'formatAmount2',
    },
    {
      field: 'paymentPrice',
      title: '已付金额',
      minWidth: 110,
      formatter: 'formatAmount2',
    },
    {
      field: 'unPaymentPrice',
      title: '未付金额',
      minWidth: 110,
      formatter: ({ row }) =>
        erpPriceInputFormatter(financeSubtract(row.totalPrice || 0, row.paymentPrice || 0)),
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

export function usePurchaseReturnGridFormSchema(): VbenFormSchema[] {
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

export function usePurchaseReturnGridColumns(): NonNullable<
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
        erpPriceInputFormatter(financeSubtract(row.totalPrice || 0, row.refundPrice || 0)),
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

export function usePurchasePriceAdjustGridFormSchema(): VbenFormSchema[] {
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
    {
      fieldName: 'paymentStatus',
      label: '付款状态',
      component: 'Select',
      componentProps: {
        options: [
          { label: '未付款', value: 0 },
          { label: '部分付款', value: 1 },
          { label: '全部付款', value: 2 },
        ],
        placeholder: '请选择付款状态',
        allowClear: true,
      },
    },
  ];
}

export function usePurchasePriceAdjustGridColumns(): NonNullable<
  VxeTableGridOptions['columns']
> {
  return [
    { type: 'checkbox', width: 50, fixed: 'left' },
    { field: 'no', title: '调价单号', width: 180, fixed: 'left' },
    {
      field: 'adjustTime',
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
      field: 'paymentPrice',
      title: '已结算金额',
      minWidth: 110,
      formatter: 'formatAmount2',
    },
    {
      field: 'unPaymentPrice',
      title: '未结算金额',
      minWidth: 110,
      formatter: ({ row }) =>
        erpPriceInputFormatter(
          financeSubtract(row.totalAdjustPrice || 0, row.paymentPrice || 0),
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
