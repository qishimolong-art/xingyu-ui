import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  getReceivableReportDeptSimplePage,
  getReceivableReportUserSimplePage,
} from '#/api/erp/finance/receivable/report';
import { getRangePickerDefaultProps } from '#/utils/rangePickerProps';
import { getCustomerSelectProps } from '#/views/erp/sale/utils/customer-select';

const SEARCH_SELECT_POPUP_CLASS = 'receivable-report-search-select-dropdown';

export const RECEIVABLE_REPORT_SORT_FIELD_MAP = {
  customerName: 'customerName',
  deptName: 'deptName',
  handlerName: 'handlerName',
  lastBizTime: 'lastBizTime',
  otherReceivableAmount: 'otherReceivableAmount',
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
      fieldName: 'handlerId',
      label: '经手人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择经手人',
        allowClear: true,
        showSearch: true,
        api: getReceivableReportUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        popupClassName: SEARCH_SELECT_POPUP_CLASS,
        valueField: 'id',
        loadErrorMessage: '经手人列表加载失败，请重试',
      },
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择部门',
        allowClear: true,
        showSearch: true,
        api: getReceivableReportDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        popupClassName: SEARCH_SELECT_POPUP_CLASS,
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
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

export function useGridColumns(): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { field: 'mobile', title: '客户电话', minWidth: 130 },
    {
      field: 'customerName',
      title: '客户名称',
      minWidth: 220,
      slots: { default: 'customerName' },
    },
    { field: 'contact', title: '联系人', minWidth: 100 },
    { field: 'deptName', title: '所属部门', minWidth: 120 },
    { field: 'handlerName', title: '经手人', minWidth: 100 },
    {
      field: 'otherReceivableAmount',
      title: '其他应收金额',
      minWidth: 130,
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
    column.field && column.field in RECEIVABLE_REPORT_SORT_FIELD_MAP
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
      width: 138,
      formatter: 'formatDateTime',
      sortable: true,
    },
    {
      field: 'docNo',
      title: '单据号',
      minWidth: 168,
      slots: { default: 'docNo' },
      sortable: true,
    },
    {
      field: 'increaseAmount',
      title: '金额',
      width: 106,
      formatter: 'formatAmount2',
      sortable: true,
    },
    { field: 'remark', title: '备注', minWidth: 160, sortable: true },
    {
      field: 'fileUrl',
      title: '附件',
      width: 84,
      slots: { default: 'fileUrl' },
    },
    {
      title: '操作',
      width: 84,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}
