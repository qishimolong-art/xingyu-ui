import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getSimpleUserList } from '#/api/system/user';
import { getRangePickerDefaultProps } from '#/utils';
import { getCustomerSelectProps } from '#/views/erp/sale/utils/customer-select';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';

import { getSaleReportSearchDeptTree } from '../utils/dept';

const SEARCH_SELECT_POPUP_CLASS = 'sale-report-search-select-dropdown';

export const SALE_REPORT_SORT_FIELD_MAP = {
  customerName: 'customerName',
  deptName: 'deptName',
  lastBizTime: 'lastBizTime',
  netAmount: 'netAmount',
  returnAmount: 'returnAmount',
  saleAmount: 'saleAmount',
  saleUserName: 'saleUserName',
} as const;

export function useGridFormSchema(): VbenFormSchema[] {
  return withErpKeywordSearchSchema([
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'CustomerLazySelect',
      componentProps: getCustomerSelectProps(false, SEARCH_SELECT_POPUP_CLASS),
    },
    {
      fieldName: 'saleUserId',
      label: '销售员',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '请选择销售员',
        allowClear: true,
        showSearch: true,
        api: getSimpleUserList,
        labelField: 'nickname',
        popupClassName: SEARCH_SELECT_POPUP_CLASS,
        valueField: 'id',
      },
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '请选择部门',
        allowClear: true,
        showSearch: true,
        api: getSaleReportSearchDeptTree,
        labelField: 'name',
        popupClassName: SEARCH_SELECT_POPUP_CLASS,
        valueField: 'id',
      },
    },
    {
      fieldName: 'bizTime',
      label: '业务时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ]);
}

export function useGridColumns(): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    {
      field: 'customerName',
      title: '客户',
      minWidth: 220,
      slots: { default: 'customerName' },
    },
    { field: 'contact', title: '联系人', minWidth: 100 },
    { field: 'mobile', title: '电话', minWidth: 130 },
    { field: 'deptName', title: '所属部门', minWidth: 120 },
    { field: 'saleUserName', title: '销售员', minWidth: 100 },
    { field: 'docCount', title: '单据数', width: 86 },
    { field: 'saleCount', title: '出库数量', width: 110 },
    {
      field: 'saleAmount',
      title: '出库金额',
      width: 120,
      formatter: 'formatAmount2',
    },
    { field: 'returnCount', title: '退货数量', width: 110 },
    {
      field: 'returnAmount',
      title: '退货金额',
      width: 120,
      formatter: 'formatAmount2',
    },
    {
      field: 'netAmount',
      title: '销售净额',
      width: 120,
      formatter: 'formatAmount2',
    },
    {
      field: 'lastBizTime',
      title: '最近业务时间',
      minWidth: 160,
      formatter: 'formatDateTime',
    },
    {
      title: '操作',
      width: 84,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return columns.map((column) =>
    column.field && column.field in SALE_REPORT_SORT_FIELD_MAP
      ? { ...column, sortable: true }
      : column,
  );
}

export function useDetailColumns(): VxeTableGridOptions['columns'] {
  return [
    { type: 'seq', title: '序号', width: 52 },
    { field: 'docType', title: '单据类型', width: 104, sortable: true },
    {
      field: 'docDate',
      title: '单据日期',
      width: 160,
      formatter: 'formatDateTime',
      sortable: true,
    },
    { field: 'docNo', title: '单据号', minWidth: 168, sortable: true },
    { field: 'bizCount', title: '业务数量', width: 110, sortable: true },
    {
      field: 'saleAmount',
      title: '出库金额',
      width: 120,
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'returnAmount',
      title: '退货金额',
      width: 120,
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'netAmount',
      title: '销售净额',
      width: 120,
      formatter: 'formatAmount2',
      sortable: true,
    },
  ];
}
