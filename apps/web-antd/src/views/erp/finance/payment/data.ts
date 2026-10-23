import { financeSubtract } from '#/views/erp/finance/utils/finance-decimal';
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
  toOptionalNumberValue,
} from '#/views/erp/finance/utils/text-number';
import { getSupplierSelectProps } from '#/views/erp/purchase/utils/supplier-select';

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
        label: '付款单号',
        component: 'Input',
        componentProps: {
          placeholder: '系统自动生成',
          disabled: true,
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
        componentProps: getSupplierSelectProps(formType === 'detail'),
        rules: 'required',
      },
      {
        fieldName: 'financeUserId',
        label: '经手人',
        component: 'ApiSelect',
        componentProps: {
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
        label: '采购入库、退货单',
        component: 'Input',
        formItemClass: 'col-span-3',
      },
      {
        fieldName: 'accountId',
        label: '付款账户',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择付款账户',
          allowClear: true,
          showSearch: true,
          api: getAccountSimpleList,
          labelField: 'name',
          valueField: 'id',
        },
      },
      {
        fieldName: 'totalPrice',
        label: '合计付款',
        component: 'DecimalAmountInput',
        componentProps: {
          placeholder: '合计付款',
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
        componentProps: {
          placeholder: '实际付款',
          class: 'w-full',
          
          inputMode: 'decimal',
          disabled: formType === 'detail',
        },
        rules: createRequiredNumberRule('实际付款', { nonZero: true }),
        dependencies: {
          triggerFields: ['totalPrice', 'discountPrice'],
          componentProps: (values) => {
            const totalPrice = toOptionalNumberValue(values.totalPrice) || 0;
            const discountPrice =
              toOptionalNumberValue(values.discountPrice) || 0;
            values.paymentPrice = financeSubtract(totalPrice, discountPrice);
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
          title: '采购单据编号',
          minWidth: 200,
          slots: { default: 'bizNo' },
        },
        {
          field: 'totalPrice',
          title: '应付金额',
          minWidth: 100,
          formatter: 'formatAmount2',
        },
        {
          field: 'paidPrice',
          title: '已付金额',
          minWidth: 100,
          formatter: 'formatAmount2',
        },
        {
          field: 'paymentPrice',
          title: '本次付款',
          minWidth: 115,
          fixed: 'right',
          slots: { default: 'paymentPrice' },
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
      fieldName: 'supplierId',
      label: '供应商',
      component: 'SupplierLazySelect',
      componentProps: getSupplierSelectProps(),
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
        title: '付款单号',
        width: 180,
        fixed: 'left',
      },
      {
        field: 'supplierName',
        title: '供应商',
        minWidth: 120,
      },
      {
        field: 'paymentTime',
        title: '付款时间',
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
        title: '经手人',
        minWidth: 120,
      },
      {
        field: 'deptName',
        title: '所属部门',
        minWidth: 120,
      },
      {
        field: 'accountName',
        title: '付款账户',
        minWidth: 120,
      },
      {
        field: 'totalPrice',
        title: '合计付款',
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
        field: 'paymentPrice',
        title: '实际付款',
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

/** 采购入库单选择表单的配置项 */
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
      fieldName: 'supplierId',
      label: '供应商',
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '已自动选择供应商',
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

/** 采购入库单选择列表的字段 */
export function usePurchaseInGridColumns(): NonNullable<
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
      title: '入库单号',
      width: 200,
      fixed: 'left',
    },
    {
      field: 'supplierName',
      title: '供应商',
      minWidth: 120,
    },
    {
      field: 'inTime',
      title: '入库时间',
      width: 160,
      formatter: 'formatDate',
    },
    {
      field: 'totalPrice',
      title: '应付金额',
      formatter: 'formatAmount2',
      minWidth: 120,
    },
    {
      field: 'paymentPrice',
      title: '已付金额',
      formatter: 'formatAmount2',
      minWidth: 120,
    },
    {
      field: 'unPaymentPrice',
      title: '未付金额',
      formatter: ({ row }) => {
        return erpPriceInputFormatter(financeSubtract(row.totalPrice, row.paymentPrice) || 0);
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

/** 采购退货单选择表单的配置项 */
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
      fieldName: 'supplierId',
      label: '供应商',
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '已自动选择供应商',
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

/** 采购退货单选择列表的字段 */
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
      field: 'supplierName',
      title: '供应商',
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
