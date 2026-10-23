import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getSimpleUserList } from '#/api/system/user';
import { getRangePickerDefaultProps } from '#/utils';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';

import { getPurchaseReportSearchDeptTree } from '../utils/dept';
import { getSupplierSelectProps } from '../utils/supplier-select';

const SEARCH_SELECT_POPUP_CLASS = 'purchase-report-search-select-dropdown';

export const PURCHASE_REPORT_SORT_FIELD_MAP = {
  deptName: 'deptName',
  lastBizTime: 'lastBizTime',
  netAmount: 'netAmount',
  purchaseAmount: 'purchaseAmount',
  returnAmount: 'returnAmount',
  purchaserName: 'purchaserName',
  supplierName: 'supplierName',
} as const;

export const PURCHASE_PRODUCT_REPORT_SORT_FIELD_MAP = {
  docCount: 'docCount',
  lastBizTime: 'lastBizTime',
  netAmount: 'netAmount',
  productCode: 'productCode',
  productName: 'productName',
  purchaseAmount: 'purchaseAmount',
  purchaseCount: 'purchaseCount',
  returnAmount: 'returnAmount',
  returnCount: 'returnCount',
  supplierCount: 'supplierCount',
} as const;

export const PURCHASE_DEPT_REPORT_SORT_FIELD_MAP = {
  deptName: 'deptName',
  docCount: 'docCount',
  lastBizTime: 'lastBizTime',
  netAmount: 'netAmount',
  purchaseAmount: 'purchaseAmount',
  purchaseCount: 'purchaseCount',
  returnAmount: 'returnAmount',
  returnCount: 'returnCount',
  supplierCount: 'supplierCount',
} as const;

export function useGridFormSchema(): VbenFormSchema[] {
  return withErpKeywordSearchSchema([
    {
      fieldName: 'supplierId',
      label: '供应商',
      component: 'SupplierLazySelect',
      componentProps: getSupplierSelectProps(false, SEARCH_SELECT_POPUP_CLASS),
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '请选择部门',
        allowClear: true,
        showSearch: true,
        api: getPurchaseReportSearchDeptTree,
        labelField: 'name',
        popupClassName: SEARCH_SELECT_POPUP_CLASS,
        valueField: 'id',
      },
    },
    {
      fieldName: 'purchaser',
      label: '采购员',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '请选择采购员',
        allowClear: true,
        showSearch: true,
        api: getSimpleUserList,
        labelField: 'nickname',
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
      field: 'supplierName',
      title: '供应商',
      minWidth: 220,
      slots: { default: 'supplierName' },
    },
    { field: 'contact', title: '联系人', minWidth: 100 },
    { field: 'mobile', title: '电话', minWidth: 130 },
    { field: 'deptName', title: '所属部门', minWidth: 120 },
    { field: 'purchaserName', title: '采购员', minWidth: 110 },
    { field: 'docCount', title: '单据数', width: 86 },
    { field: 'purchaseCount', title: '入库数量', width: 110 },
    {
      field: 'purchaseAmount',
      title: '入库金额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
    },
    { field: 'returnCount', title: '退货数量', width: 110 },
    {
      field: 'returnAmount',
      title: '退货金额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
    },
    {
      field: 'netAmount',
      title: '采购净额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
    },
    {
      field: 'lastBizTime',
      title: '最近业务时间',
      minWidth: 160,
      formatter: 'formatDateTime',
    },
    {
      field: 'actions',
      title: '操作',
      width: 84,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return columns.map((column) =>
    column.field && column.field in PURCHASE_REPORT_SORT_FIELD_MAP
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
    { field: 'supplierName', title: '供应商', minWidth: 180, sortable: true },
    { field: 'purchaserName', title: '采购员', width: 110, sortable: true },
    { field: 'bizCount', title: '业务数量', width: 110, sortable: true },
    {
      field: 'purchaseAmount',
      title: '入库金额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
      sortable: true,
    },
    {
      field: 'returnAmount',
      title: '退货金额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
      sortable: true,
    },
    {
      field: 'netAmount',
      title: '采购净额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
      sortable: true,
    },
  ];
}

export function useDeptGridColumns(): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { field: 'deptName', title: '部门', minWidth: 180 },
    { field: 'supplierCount', title: '供应商数', width: 100 },
    { field: 'docCount', title: '单据数', width: 86 },
    { field: 'purchaseCount', title: '入库数量', width: 110 },
    {
      field: 'purchaseAmount',
      title: '入库金额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
    },
    { field: 'returnCount', title: '退货数量', width: 110 },
    {
      field: 'returnAmount',
      title: '退货金额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
    },
    {
      field: 'netAmount',
      title: '采购净额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
    },
    {
      field: 'lastBizTime',
      title: '最近业务时间',
      minWidth: 160,
      formatter: 'formatDateTime',
    },
  ];
  return columns.map((column) =>
    column.field && column.field in PURCHASE_DEPT_REPORT_SORT_FIELD_MAP
      ? { ...column, sortable: true }
      : column,
  );
}

export function useProductGridColumns(): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { field: 'productCode', title: '配件编码', minWidth: 130 },
    { field: 'productName', title: '配件名称', minWidth: 180 },
    { field: 'barCode', title: '条形码', minWidth: 130 },
    { field: 'unitName', title: '单位', width: 80 },
    { field: 'brand', title: '品牌', minWidth: 110 },
    { field: 'standard', title: '规格', minWidth: 110 },
    { field: 'vehicleModel', title: '适用车型', minWidth: 140 },
    { field: 'drawingNo', title: '图号', minWidth: 120 },
    { field: 'supplierCount', title: '供应商数', width: 96 },
    { field: 'docCount', title: '单据数', width: 86 },
    { field: 'purchaseCount', title: '入库数量', width: 110 },
    {
      field: 'purchaseAmount',
      title: '入库金额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
    },
    { field: 'returnCount', title: '退货数量', width: 110 },
    {
      field: 'returnAmount',
      title: '退货金额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
    },
    {
      field: 'netAmount',
      title: '采购净额',
      width: 120,
      formatter: 'formatPurchaseDecimal6',
    },
    {
      field: 'lastBizTime',
      title: '最近业务时间',
      minWidth: 160,
      formatter: 'formatDateTime',
    },
  ];
  return columns.map((column) =>
    column.field && column.field in PURCHASE_PRODUCT_REPORT_SORT_FIELD_MAP
      ? { ...column, sortable: true }
      : column,
  );
}
