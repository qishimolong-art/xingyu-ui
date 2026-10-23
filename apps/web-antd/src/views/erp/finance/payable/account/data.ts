import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  getPayableAccountDeptSimplePage,
  getPayableAccountUserSimplePage,
} from '#/api/erp/finance/payable/account';
import { getRangePickerDefaultProps } from '#/utils';
import { prepareFinanceDocumentItemColumns } from '#/views/erp/finance/utils/document-item-table';
import { prepareFinanceDocumentListColumns } from '#/views/erp/finance/utils/document-list-table';
import { getSupplierSelectProps } from '#/views/erp/purchase/utils/supplier-select';

const SEARCH_SELECT_POPUP_CLASS = 'payable-account-search-select-dropdown';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'supplierId',
      label: '供应商',
      component: 'SupplierLazySelect',
      componentProps: getSupplierSelectProps(false, SEARCH_SELECT_POPUP_CLASS),
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择部门',
        allowClear: true,
        showSearch: true,
        api: getPayableAccountDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        popupClassName: SEARCH_SELECT_POPUP_CLASS,
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'handlerId',
      label: '经手人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择经手人',
        allowClear: true,
        showSearch: true,
        api: getPayableAccountUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        popupClassName: SEARCH_SELECT_POPUP_CLASS,
        valueField: 'id',
        loadErrorMessage: '经手人列表加载失败，请重试',
      },
    },
    {
      fieldName: 'approveTime',
      label: '审批日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'showZeroBalance',
      label: '显示零余额',
      component: 'Switch',
      defaultValue: false,
      componentProps: {
        checkedChildren: '是',
        unCheckedChildren: '否',
      },
    },
  ];
}

export function useGridColumns(
  rows: Record<string, any>[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentListColumns(
    [
      {
        field: 'supplierName',
        title: '供应商',
        align: 'center',
        width: 156,
        slots: { default: 'supplierName' },
      },
      { field: 'contact', title: '联系人', width: 92 },
      { field: 'mobile', title: '电话', width: 112 },
      { field: 'deptName', title: '部门', width: 96 },
      { field: 'handlerName', title: '经手人', width: 84 },
      {
        field: 'purchaseInAmount',
        title: '采购入库',
        width: 102,
        formatter: 'formatAmount2',
        slots: { default: 'amountDrilldown' },
      },
      {
        field: 'purchaseReturnAmount',
        title: '采购退货',
        width: 102,
        formatter: 'formatAmount2',
        slots: { default: 'amountDrilldown' },
      },
      {
        field: 'priceAdjustAmount',
        title: '采购调价',
        width: 102,
        formatter: 'formatAmount2',
        slots: { default: 'amountDrilldown' },
      },
      {
        field: 'otherPayableAmount',
        title: '应付调账',
        width: 102,
        formatter: 'formatAmount2',
        slots: { default: 'amountDrilldown' },
      },
      {
        field: 'paymentAmount',
        title: '付款',
        width: 92,
        formatter: 'formatAmount2',
        slots: { default: 'amountDrilldown' },
      },
      {
        field: 'writeOffAmount',
        title: '核销',
        width: 92,
        formatter: 'formatAmount2',
        slots: { default: 'amountDrilldown' },
      },
      {
        field: 'balance',
        title: '应付余额',
        width: 102,
        formatter: 'formatAmount2',
        slots: { default: 'amountDrilldown' },
      },
      {
        field: 'openingPayableBalance',
        title: '此前应付',
        width: 102,
        formatter: 'formatAmount2',
        slots: { default: 'amountDrilldown' },
      },
      {
        field: 'miscPayableAmount',
        title: '其他应付款',
        width: 112,
        formatter: 'formatAmount2',
        slots: { default: 'amountDrilldown' },
      },
      {
        field: 'unclearedPrepayment',
        title: '未核销预付款',
        width: 112,
        formatter: 'formatAmount2',
      },
      {
        field: 'lastBizTime',
        title: '最近业务时间',
        width: 138,
        formatter: 'formatDateTime',
      },
      {
        title: '操作',
        width: 84,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    rows,
  );
}

export function useDrilldownColumns(
  rows: Record<string, any>[] = [],
  changeTitle = '本笔变动',
  approvalBasis = false,
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentItemColumns(
    [
      ...(approvalBasis
        ? [
            {
              field: 'approveTime',
              title: '审批日期',
              width: 150,
              formatter: 'formatDateTime',
              sortable: true,
            },
          ]
        : []),
      { type: 'seq', title: '序号', width: 52 },
      { field: 'docType', title: '单据类型', width: 112, sortable: true },
      ...(!approvalBasis
        ? [
            {
              field: 'docDate',
              title: '单据日期',
              width: 150,
              formatter: 'formatDateTime',
              sortable: true,
            },
          ]
        : []),
      {
        field: 'docNo',
        title: '单据号',
        minWidth: 158,
        slots: { default: 'docNo' },
        sortable: true,
      },
      {
        field: 'changeAmount',
        title: changeTitle,
        width: 112,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'prevBalance',
        title: '上笔累计',
        width: 112,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'balance',
        title: '累计金额',
        width: 112,
        formatter: 'formatAmount2',
        sortable: true,
      },
      { field: 'deptName', title: '所属部门', width: 112, sortable: true },
      {
        field: 'businessUserName',
        title: '业务员',
        width: 100,
        sortable: true,
      },
      { field: 'remark', title: '备注', width: 180, sortable: true },
      ...(approvalBasis
        ? [
            {
              field: 'docDate',
              title: '单据时间',
              width: 150,
              formatter: 'formatDateTime',
              sortable: true,
            },
          ]
        : []),
      {
        title: '操作',
        width: 84,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    { rows },
  );
}

export function useDetailColumns(
  rows: Record<string, any>[] = [],
  approvalBasis = false,
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentItemColumns(
    [
      ...(approvalBasis
        ? [
            {
              field: 'approveTime',
              title: '审批日期',
              width: 150,
              formatter: 'formatDateTime',
              sortable: true,
            },
          ]
        : []),
      { type: 'seq', title: '序号', width: 52 },
      { field: 'docType', title: '单据类型', width: 104, sortable: true },
      ...(!approvalBasis
        ? [
            {
              field: 'docDate',
              title: '单据日期',
              width: 138,
              formatter: 'formatDateTime',
              sortable: true,
            },
          ]
        : []),
      {
        field: 'docNo',
        title: '单据号',
        minWidth: 158,
        slots: { default: 'docNo' },
        sortable: true,
      },
      {
        field: 'businessUserName',
        title: '业务员',
        width: 100,
        sortable: true,
      },
      { field: 'deptName', title: '所属部门', width: 104, sortable: true },
      {
        field: 'prevBalance',
        title: '上次余额',
        width: 106,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'increaseAmount',
        title: '应付款',
        width: 106,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'paymentDisplayAmount',
        title: '付款金额',
        width: 106,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'balance',
        title: '余额',
        width: 106,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'writeOffAmount',
        title: '核销金额',
        width: 106,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'sourceNo',
        title: '来源单号',
        minWidth: 138,
        sortable: true,
        slots: { default: 'sourceNo' },
      },
      {
        field: 'factoryOrderNo',
        title: '厂家单号',
        minWidth: 118,
        sortable: true,
      },
      {
        field: 'invoiceStatus',
        title: '开票情况',
        width: 96,
        sortable: true,
      },
      { field: 'remark', title: '备注', minWidth: 160, sortable: true },
      { field: 'voucherNo', title: '凭证号', minWidth: 112, sortable: true },
      ...(approvalBasis
        ? [
            {
              field: 'docDate',
              title: '单据时间',
              width: 150,
              formatter: 'formatDateTime',
              sortable: true,
            },
          ]
        : [
            {
              field: 'confirmTime',
              title: '确认时间',
              width: 138,
              formatter: 'formatDateTime',
              sortable: true,
            },
          ]),
      {
        title: '操作',
        width: 84,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    { rows },
  );
}
