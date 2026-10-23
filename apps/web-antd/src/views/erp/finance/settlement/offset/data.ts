import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getRangePickerDefaultProps } from '#/utils';
import { prepareFinanceDocumentItemColumns } from '#/views/erp/finance/utils/document-item-table';
import { prepareFinanceDocumentListColumns } from '#/views/erp/finance/utils/document-list-table';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'subjectName',
      label: '客户名称',
      component: 'Input',
      componentProps: {
        placeholder: '请输入客户名称',
        allowClear: true,
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
      { field: 'customerCode', title: '客户编码', width: 120 },
      {
        field: 'subjectName',
        title: '客户名称',
        minWidth: 220,
        slots: { default: 'subjectName' },
      },
      {
        field: 'receivableBalance',
        title: '应收余额',
        minWidth: 140,
        formatter: 'formatAmount2',
      },
      {
        field: 'payableBalance',
        title: '应付余额',
        minWidth: 140,
        formatter: 'formatAmount2',
      },
      {
        field: 'offsetBalance',
        title: '余额',
        minWidth: 140,
        formatter: 'formatAmount2',
        slots: { default: 'offsetBalance' },
      },
      {
        title: '操作',
        width: 100,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    rows,
  );
}

export function useReceivableDetailColumns(
  rows: Record<string, any>[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentItemColumns(
    [
      {
        field: 'approveTime',
        title: '审批日期',
        minWidth: 170,
        formatter: 'formatDateTime',
        sortable: true,
      },
      { type: 'seq', title: '序号', width: 60 },
      { field: 'docType', title: '单据类型', minWidth: 120, sortable: true },
      { field: 'docNo', title: '单据号', minWidth: 180, sortable: true },
      { field: 'deptName', title: '所属部门', minWidth: 120, sortable: true },
      {
        field: 'prevBalance',
        title: '上笔余额',
        minWidth: 120,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'increaseAmount',
        title: '增加金额',
        minWidth: 120,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'receiptAmount',
        title: '收款金额',
        minWidth: 120,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'writeOffAmount',
        title: '核销金额',
        minWidth: 120,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'allocatedAmount',
        title: '已核销金额',
        minWidth: 120,
        formatter: 'formatAmount2',
      },
      {
        field: 'balance',
        title: '余额',
        minWidth: 120,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'receiptStatus',
        title: '收款情况',
        minWidth: 110,
        slots: { default: 'receiptStatus' },
      },
      {
        field: 'docDate',
        title: '单据时间',
        minWidth: 170,
        formatter: 'formatDateTime',
        sortable: true,
      },
    ],
    { rows },
  );
}

export function usePayableDetailColumns(
  rows: Record<string, any>[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentItemColumns(
    [
      {
        field: 'approveTime',
        title: '审批日期',
        minWidth: 170,
        formatter: 'formatDateTime',
        sortable: true,
      },
      { type: 'seq', title: '序号', width: 60 },
      { field: 'docType', title: '单据类型', minWidth: 120, sortable: true },
      { field: 'docNo', title: '单据号', minWidth: 180, sortable: true },
      { field: 'deptName', title: '所属部门', minWidth: 120, sortable: true },
      {
        field: 'prevBalance',
        title: '上笔余额',
        minWidth: 120,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'increaseAmount',
        title: '增加金额',
        minWidth: 120,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'paymentAmount',
        title: '付款金额',
        minWidth: 120,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'writeOffAmount',
        title: '核销金额',
        minWidth: 120,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'allocatedAmount',
        title: '已核销金额',
        minWidth: 120,
        formatter: 'formatAmount2',
      },
      {
        field: 'balance',
        title: '余额',
        minWidth: 120,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'paymentStatus',
        title: '付款情况',
        minWidth: 110,
        slots: { default: 'paymentStatus' },
      },
      {
        field: 'docDate',
        title: '单据时间',
        minWidth: 170,
        formatter: 'formatDateTime',
        sortable: true,
      },
    ],
    { rows },
  );
}
