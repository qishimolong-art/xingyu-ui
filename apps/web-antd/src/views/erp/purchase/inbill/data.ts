import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getPurchaseWarehouseSimpleList } from '#/api/erp/stock/warehouse';
import { getSimpleUserList } from '#/api/system/user';
import { getRangePickerDefaultProps } from '#/utils';
import { prepareStockDocumentListColumns } from '#/views/erp/stock/utils/document-list-table';
import {
  applyStockListColumnPermission,
  applyStockQueryFieldPermission,
} from '#/views/erp/stock/utils/field-permission';
import { stockListNumber } from '#/views/erp/stock/utils/stock-decimal';

import { STOCK_IN_BILL_STATUS_OPTIONS } from '../../stock/inbill/ui';

const SEARCH_SELECT_POPUP_CLASS = 'stock-in-bill-search-select-dropdown';

export function useGridFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyStockQueryFieldPermission(
    [
      {
        fieldName: 'billDate',
        label: '日期',
        component: 'RangePicker',
        componentProps: {
          ...getRangePickerDefaultProps(),
          allowClear: true,
        },
      },
      {
        fieldName: 'no',
        label: '单号',
        component: 'Input',
        componentProps: { placeholder: '请输入单号', allowClear: true },
      },
      {
        fieldName: 'sourceNo',
        label: '来源单号',
        component: 'Input',
        componentProps: { placeholder: '请输入来源单号', allowClear: true },
      },
      {
        fieldName: 'warehouseId',
        label: '仓库',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择仓库',
          allowClear: true,
          showSearch: true,
          popupClassName: SEARCH_SELECT_POPUP_CLASS,
          api: getPurchaseWarehouseSimpleList,
          labelField: 'name',
          valueField: 'id',
        },
      },
      {
        fieldName: 'sourceUnitName',
        label: '来源单位',
        component: 'Input',
        componentProps: { placeholder: '请输入来源单位', allowClear: true },
      },
      {
        fieldName: 'status',
        label: '状态',
        component: 'Select',
        componentProps: {
          placeholder: '请选择状态',
          allowClear: true,
          options: STOCK_IN_BILL_STATUS_OPTIONS,
          popupClassName: SEARCH_SELECT_POPUP_CLASS,
        },
      },
      {
        fieldName: 'pickupUserName',
        label: '提货人',
        component: 'Input',
        componentProps: { placeholder: '请输入提货人', allowClear: true },
      },
      {
        fieldName: 'creator',
        label: '创建人',
        component: 'ApiSelect',
        componentProps: {
          api: getSimpleUserList,
          allowClear: true,
          labelField: 'nickname',
          placeholder: '请选择创建人',
          popupClassName: SEARCH_SELECT_POPUP_CLASS,
          showSearch: true,
          valueField: 'id',
        },
      },
    ],
    hiddenFields,
  );
}

export function useGridColumns(
  rows: Record<string, any>[] = [],
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  return prepareStockDocumentListColumns(
    applyStockListColumnPermission(
      [
        { type: 'checkbox', width: 50, fixed: 'left' },
        { type: 'seq', title: '序号', width: 55, fixed: 'left' },
        {
          field: 'priority',
          title: '优先级',
          width: 90,
          fixed: 'left',
          sortable: true,
        },
        {
          field: 'no',
          title: '入仓单号',
          width: 170,
          fixed: 'left',
          showOverflow: 'tooltip',
          sortable: true,
        },
        {
          field: 'status',
          title: '状态',
          width: 100,
          slots: { default: 'status' },
          sortable: true,
        },
        {
          field: 'totalCount',
          title: '应提数量',
          width: 110,
          formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        },
        {
          field: 'pickedCount',
          title: '已提数量',
          width: 110,
          formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        },
        {
          field: 'remainingCount',
          title: '待提数量',
          width: 110,
          formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        },
        {
          field: 'billDate',
          title: '日期',
          width: 170,
          formatter: 'formatDateTime',
          sortable: true,
        },
        {
          field: 'warehouseName',
          title: '仓库',
          width: 140,
          showOverflow: 'tooltip',
        },
        {
          field: 'sourceUnitName',
          title: '来源单位',
          minWidth: 150,
          showOverflow: 'tooltip',
        },
        {
          field: 'sourceNo',
          title: '来源单号',
          width: 170,
          showOverflow: 'tooltip',
          sortable: true,
        },
        { field: 'pickupUserName', title: '提货人', width: 110 },
        { field: 'creatorName', title: '创建人', width: 110 },
        {
          field: 'createTime',
          title: '创建时间',
          width: 170,
          formatter: 'formatDateTime',
          sortable: true,
        },
        { field: 'updaterName', title: '修改人', width: 110 },
        {
          field: 'updateTime',
          title: '修改时间',
          width: 170,
          formatter: 'formatDateTime',
          sortable: true,
        },
        { field: 'auditorName', title: '审核人', width: 110 },
        {
          field: 'auditTime',
          title: '审核时间',
          width: 170,
          formatter: 'formatDateTime',
          sortable: true,
        },
        {
          field: 'printTime',
          title: '打印时间',
          width: 170,
          formatter: 'formatDateTime',
          sortable: true,
        },
        { field: 'printCount', title: '打印次数', width: 100, sortable: true },
        {
          field: 'totalWeight',
          title: '总重',
          width: 110,
          formatter: ({ cellValue }: any) => stockListNumber(cellValue),
          sortable: true,
        },
        {
          field: 'remark',
          title: '备注',
          minWidth: 160,
          showOverflow: 'tooltip',
          sortable: true,
        },
        {
          field: 'timeoutFlag',
          title: '超时',
          width: 90,
          slots: { default: 'timeoutFlag' },
        },
        {
          field: 'wholeQty',
          title: '整件数',
          width: 110,
          formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        },
        {
          field: 'looseQty',
          title: '散件数',
          width: 110,
          formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        },
        {
          field: 'actions',
          title: '操作',
          width: 150,
          fixed: 'right',
          slots: { default: 'actions' },
        },
      ],
      hiddenFields,
    ) || [],
    rows,
  );
}
