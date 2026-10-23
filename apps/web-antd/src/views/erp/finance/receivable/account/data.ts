import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  getReceivableAccountDeptSimplePage,
  getReceivableAccountUserSimplePage,
} from '#/api/erp/finance/receivable/account';
import { getRangePickerDefaultProps } from '#/utils/rangePickerProps';
import { prepareFinanceDocumentItemColumns } from '#/views/erp/finance/utils/document-item-table';
import { prepareFinanceDocumentListColumns } from '#/views/erp/finance/utils/document-list-table';
import { getCustomerSelectProps } from '#/views/erp/sale/utils/customer-select';

const SEARCH_SELECT_POPUP_CLASS = 'receivable-account-search-select-dropdown';

export const RECEIVABLE_ACCOUNT_SORT_FIELD_MAP = {
  areaName: 'areaId',
  baseAmount: 'baseAmount',
  creditBalance: 'creditBalance',
  creditLimit: 'creditLimit',
  creditTermDays: 'creditTermDays',
  customerName: 'customerName',
  customerTypeName: 'customerType',
  deptName: 'deptName',
  mobile: 'mobile',
  miscReceivableAmount: 'miscReceivableAmount',
  openingReceivableBalance: 'openingReceivableBalance',
  preAdvanceAmount: 'preAdvanceAmount',
  receivableBalance: 'receivableBalance',
  receiptAmount: 'receiptAmount',
  routeName: 'routeId',
  saleOutAmount: 'saleOutAmount',
  saleReturnAmount: 'saleReturnAmount',
  saleUserName: 'saleUserName',
} as const;

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'CustomerLazySelect',
      componentProps: getCustomerSelectProps(false, SEARCH_SELECT_POPUP_CLASS),
    },
    {
      fieldName: 'saleUserId',
      label: '业务员',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择业务员',
        allowClear: true,
        showSearch: true,
        api: getReceivableAccountUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        popupClassName: SEARCH_SELECT_POPUP_CLASS,
        valueField: 'id',
        loadErrorMessage: '业务员列表加载失败，请重试',
      },
    },
    {
      fieldName: 'deptId',
      label: '单据部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择单据部门',
        allowClear: true,
        showSearch: true,
        api: getReceivableAccountDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        popupClassName: SEARCH_SELECT_POPUP_CLASS,
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
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
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { field: 'mobile', title: '客户电话号码', width: 118 },
    {
      field: 'customerName',
      title: '客户名称',
      align: 'center',
      width: 156,
      slots: { default: 'customerName' },
    },
    { field: 'deptName', title: '单据所属部门', width: 116 },
    {
      field: 'receivableBalance',
      title: '余额',
      width: 102,
      formatter: 'formatAmount2',
      slots: { default: 'amountDrilldown' },
    },
    {
      field: 'openingReceivableBalance',
      title: '此前应收',
      width: 102,
      formatter: 'formatAmount2',
      slots: { default: 'amountDrilldown' },
    },
    {
      field: 'miscReceivableAmount',
      title: '其他应收款',
      width: 112,
      formatter: 'formatAmount2',
      slots: { default: 'amountDrilldown' },
    },
    {
      field: 'preAdvanceAmount',
      title: '未核销预收金额',
      width: 126,
      formatter: 'formatAmount2',
    },
    {
      field: 'receiptAmount',
      title: '明细收款',
      width: 96,
      formatter: 'formatAmount2',
      slots: { default: 'amountDrilldown' },
    },
    {
      field: 'baseAmount',
      title: '铺底金额',
      width: 102,
      formatter: 'formatAmount2',
    },
    {
      field: 'creditLimit',
      title: '信用额度',
      width: 102,
      formatter: 'formatAmount2',
    },
    {
      field: 'creditBalance',
      title: '信用余额',
      width: 102,
      formatter: 'formatAmount2',
    },
    { field: 'creditTermDays', title: '信用期限', width: 92 },
    { field: 'customerTypeName', title: '客户类型', width: 104 },
    { field: 'saleUserName', title: '业务员', width: 92 },
    { field: 'areaName', title: '区域', width: 104 },
    {
      field: 'saleOutAmount',
      title: '销售增加',
      width: 102,
      formatter: 'formatAmount2',
      slots: { default: 'amountDrilldown' },
    },
    {
      field: 'saleReturnAmount',
      title: '退货增加',
      width: 102,
      formatter: 'formatAmount2',
      slots: { default: 'amountDrilldown' },
    },
    { field: 'routeName', title: '线路名称', width: 112 },
    {
      field: 'actions',
      title: '操作',
      width: 84,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareFinanceDocumentListColumns(columns, rows).map((column) =>
    column.field && column.field in RECEIVABLE_ACCOUNT_SORT_FIELD_MAP
      ? { ...column, sortable: true }
      : column,
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
              width: 165,
              sortable: true,
              formatter: 'formatDateTime',
            },
          ]
        : []),
      { type: 'seq', title: '序号', width: 52 },
      { field: 'docType', title: '单据类型', width: 112, sortable: true },
      ...(!approvalBasis
        ? [
            {
              field: 'docDate',
              title: '日期',
              width: 165,
              sortable: true,
              formatter: 'formatDateTime',
            },
          ]
        : []),
      {
        field: 'docNo',
        title: '单号',
        width: 180,
        sortable: true,
        slots: { default: 'docNo' },
      },
      {
        field: 'changeAmount',
        title: changeTitle,
        width: 112,
        sortable: true,
        formatter: 'formatAmount2',
      },
      {
        field: 'prevBalance',
        title: '上笔累计',
        width: 112,
        sortable: true,
        formatter: 'formatAmount2',
      },
      {
        field: 'balance',
        title: '累计金额',
        width: 112,
        sortable: true,
        formatter: 'formatAmount2',
      },
      { field: 'deptName', title: '所属部门', width: 112, sortable: true },
      { field: 'auditorName', title: '审核人', width: 112, sortable: true },
      { field: 'remark', title: '备注', width: 180, sortable: true },
      ...(approvalBasis
        ? [
            {
              field: 'docDate',
              title: '单据时间',
              width: 165,
              sortable: true,
              formatter: 'formatDateTime',
            },
          ]
        : []),
      {
        field: 'actions',
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
              width: 165,
              sortable: true,
              formatter: 'formatDateTime',
            },
          ]
        : []),
      { type: 'seq', title: '序号', width: 52 },
      {
        field: 'docType',
        title: '单据类型',
        width: 104,
        sortable: true,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      ...(!approvalBasis
        ? [
            {
              field: 'docDate',
              title: '日期',
              width: 165,
              sortable: true,
              formatter: 'formatDateTime',
            },
          ]
        : []),
      {
        field: 'docNo',
        title: '单号',
        width: 180,
        sortable: true,
        slots: { default: 'docNo' },
      },
      {
        field: 'prevBalance',
        title: '上笔余额',
        width: 112,
        sortable: true,
        formatter: 'formatAmount2',
      },
      {
        field: 'increaseAmount',
        title: '增加应收',
        width: 112,
        sortable: true,
        formatter: 'formatAmount2',
      },
      {
        field: 'receiptDisplayAmount',
        title: '收款金额',
        width: 112,
        sortable: true,
        formatter: 'formatAmount2',
      },
      {
        field: 'balance',
        title: '余额',
        width: 112,
        sortable: true,
        formatter: 'formatAmount2',
      },
      {
        field: 'auditorName',
        title: '审核人',
        width: 112,
        sortable: true,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      {
        field: 'deliveryMethod',
        title: '送货方式',
        width: 112,
        sortable: true,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      ...(!approvalBasis
        ? [
            {
              field: 'approveTime',
              title: '审核日期',
              width: 165,
              sortable: true,
              formatter: 'formatDateTime',
            },
          ]
        : []),
      {
        field: 'settleMethod',
        title: '结算方式',
        width: 112,
        sortable: true,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      {
        field: 'invoiceStatus',
        title: '开票情况',
        width: 112,
        sortable: true,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      {
        field: 'billAmount',
        title: '票据金额',
        width: 112,
        sortable: true,
        formatter: ({ cellValue }) =>
          cellValue === null || cellValue === undefined
            ? '-'
            : erpPriceInputFormatter(cellValue),
      },
      {
        field: 'billNo',
        title: '票据号',
        width: 180,
        sortable: true,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      {
        field: 'remark',
        title: '备注',
        width: 180,
        sortable: true,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      {
        field: 'voucherNo',
        title: '凭证号',
        width: 180,
        sortable: true,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      {
        field: 'customerName',
        title: '客户名称',
        width: 180,
        sortable: true,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      {
        field: 'internalNote',
        title: '说明',
        width: 180,
        sortable: true,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      {
        field: 'receivedWriteOffAmount',
        title: '已核销金额',
        width: 112,
        sortable: true,
        formatter: ({ cellValue }) =>
          cellValue === null || cellValue === undefined
            ? '-'
            : erpPriceInputFormatter(cellValue),
      },
      {
        field: 'receivedAmount',
        title: '已收款金额',
        width: 112,
        sortable: true,
        formatter: ({ cellValue }) =>
          cellValue === null || cellValue === undefined
            ? '-'
            : erpPriceInputFormatter(cellValue),
      },
      {
        field: 'deptName',
        title: '所属部门',
        width: 112,
        sortable: true,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      {
        field: 'otherReceivableAmount',
        title: '应收调账',
        width: 112,
        sortable: true,
        formatter: 'formatAmount2',
      },
      {
        field: 'writeOffAmount',
        title: '核销金额',
        width: 112,
        sortable: true,
        formatter: 'formatAmount2',
      },
      ...(approvalBasis
        ? [
            {
              field: 'docDate',
              title: '单据时间',
              width: 165,
              sortable: true,
              formatter: 'formatDateTime',
            },
          ]
        : []),
      {
        field: 'actions',
        title: '操作',
        width: 84,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    { rows },
  );
}
