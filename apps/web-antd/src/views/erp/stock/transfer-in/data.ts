import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import {
  getStockTransferInFromDeptSimplePage,
  getStockTransferInToDeptSimplePage,
  getStockTransferInUserSimplePage,
} from '#/api/erp/stock/transfer-in';
import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import { formatStockNaturalNumber } from '#/views/erp/stock/utils/document-number';
import { stockListNumber } from '#/views/erp/stock/utils/stock-decimal';

import { prepareStockDocumentListColumns } from '../utils/document-list-table';
import {
  applyStockItemColumnPermission,
  applyStockListColumnPermission,
  applyStockQueryFieldPermission,
} from '../utils/field-permission';
import { stockItemPieceCountColumnFormatter } from '../utils/item-piece-count';

type HiddenFields = Set<string> | string[];

function formatWarehouseNames(
  row: Record<string, any>,
  field: 'fromWarehouseName' | 'toWarehouseName',
) {
  const summaryField =
    field === 'fromWarehouseName' ? 'fromWarehouseNames' : 'toWarehouseNames';
  if (row[summaryField]) {
    return row[summaryField];
  }
  const names = (row.items || [])
    .map((item: Record<string, any>) => item[field])
    .filter(Boolean);
  return [...new Set(names)].join('、') || '-';
}

export function useGridFormSchema(
  hiddenFields: HiddenFields = [],
): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
    {
      fieldName: 'no',
      label: '调拨入库单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入调拨入库单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'relatedMoveNo',
      label: '来源出库单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入来源出库单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'sourceNo',
      label: '来源单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入来源单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'moveTime',
      label: '入库日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'fromDeptId',
      label: '调出部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择调出部门',
        allowClear: true,
        showSearch: true,
        popupClassName: 'stock-transfer-in-search-select-dropdown',
        api: getStockTransferInFromDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '调出部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'toDeptId',
      label: '调入部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择调入部门',
        allowClear: true,
        showSearch: true,
        popupClassName: 'stock-transfer-in-search-select-dropdown',
        api: getStockTransferInToDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '调入部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'fromWarehouseId',
      label: '调出仓库',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择调出仓库',
        allowClear: true,
        showSearch: true,
        popupClassName: 'stock-transfer-in-search-select-dropdown',
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stockMoveFrom' }),
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '调出仓库列表加载失败，请重试',
      },
    },
    {
      fieldName: 'toWarehouseId',
      label: '调入仓库',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择调入仓库',
        allowClear: true,
        showSearch: true,
        popupClassName: 'stock-transfer-in-search-select-dropdown',
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stock' }),
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '调入仓库列表加载失败，请重试',
      },
    },
    {
      fieldName: 'productKeyword',
      label: '产品',
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
        allowClear: true,
        'data-erp-product-keyword-search-input': 'true',
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_AUDIT_STATUS, 'number'),
        placeholder: '请选择状态',
        allowClear: true,
        popupClassName: 'stock-transfer-in-search-select-dropdown',
      },
    },
    {
      fieldName: 'creator',
      label: '建立人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择建立人',
        allowClear: true,
        showSearch: true,
        popupClassName: 'stock-transfer-in-search-select-dropdown',
        api: getStockTransferInUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        loadErrorMessage: '建立人列表加载失败，请重试',
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
  return applyStockQueryFieldPermission(schema, hiddenFields);
}

export function useGridColumns(
  hiddenFields: HiddenFields = [],
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  const columns: VxeTableGridOptions['columns'] = [
    {
      field: 'no',
      sortable: true,
      title: '单号',
      width: 132,
      slots: { default: 'no' },
    },
    {
      field: 'fromWarehouseNames',
      sortable: true,
      title: '调出仓库',
      width: 120,
      showOverflow: 'tooltip',
      formatter: ({ row }: any) =>
        formatWarehouseNames(row, 'fromWarehouseName'),
    },
    {
      field: 'fromDeptName',
      sortable: true,
      title: '调出部门',
      width: 100,
      showOverflow: 'tooltip',
    },
    {
      field: 'moveTime',
      sortable: true,
      title: '日期',
      width: 112,
      formatter: 'formatDate',
    },
    {
      field: 'toWarehouseNames',
      sortable: true,
      title: '调入仓库',
      width: 120,
      showOverflow: 'tooltip',
      formatter: ({ row }: any) => formatWarehouseNames(row, 'toWarehouseName'),
    },
    {
      field: 'toDeptName',
      sortable: true,
      title: '调入部门',
      showOverflow: 'tooltip',
      width: 100,
    },
    {
      field: 'totalCount',
      sortable: true,
      title: '调出数量',
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
      width: 84,
      align: 'right',
    },
    {
      field: 'totalPrice',
      sortable: true,
      title: '调出金额',
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      width: 84,
      align: 'right',
    },
    {
      field: 'transferType',
      title: '调拨类型',
      width: 84,
      showOverflow: 'tooltip',
    },
    {
      field: 'paymentMethod',
      title: '付款方式',
      width: 84,
      showOverflow: 'tooltip',
    },
    {
      field: 'deliveryMethod',
      title: '运输',
      width: 84,
      showOverflow: 'tooltip',
    },
    {
      field: 'itemCount',
      title: '项数',
      width: 56,
      align: 'right',
      formatter: ({ row }: any) => row.itemCount ?? row.items?.length ?? 0,
    },
    {
      field: 'handlerName',
      title: '经手人',
      width: 72,
      showOverflow: 'tooltip',
      formatter: ({ row }: any) => row.handlerName || row.creatorName || '-',
    },
    {
      field: 'approveUserName',
      title: '审核人',
      width: 72,
      showOverflow: 'tooltip',
    },
    {
      field: 'approveTime',
      title: '审核时间',
      width: 112,
      formatter: 'formatDate',
    },
    {
      field: 'creatorName',
      sortable: true,
      title: '建立人',
      width: 72,
      showOverflow: 'tooltip',
    },
    {
      field: 'remark',
      sortable: true,
      title: '备注',
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      field: 'createTime',
      sortable: true,
      title: '创建时间',
      width: 112,
      formatter: 'formatDate',
    },
    {
      field: 'updaterName',
      sortable: true,
      title: '修改人',
      width: 68,
      showOverflow: 'tooltip',
    },
    {
      field: 'updateTime',
      sortable: true,
      title: '修改时间',
      width: 112,
      formatter: 'formatDate',
    },
  ];
  return prepareStockDocumentListColumns(
    applyStockListColumnPermission(columns, hiddenFields) || [],
    rows,
  );
}

export function useFormItemColumns(
  hiddenFields: HiddenFields = [],
): VxeTableGridOptions['columns'] {
  const columns: VxeTableGridOptions['columns'] = [
    { type: 'seq', title: '序号', minWidth: 50 },
    {
      field: 'fromWarehouseName',
      title: '调出仓库',
      minWidth: 160,
      sortable: true,
    },
    {
      field: 'fromWarehouseDeptName',
      title: '调出仓库部门',
      minWidth: 140,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'toWarehouseName',
      title: '调入仓库',
      minWidth: 160,
      sortable: true,
    },
    {
      field: 'toWarehouseDeptName',
      title: '调入仓库部门',
      minWidth: 140,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'productName',
      title: '产品名称',
      minWidth: 200,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'stockCount',
      title: '库存',
      minWidth: 80,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
      sortable: true,
    },
    {
      field: 'productPrice',
      title: '产品单价',
      minWidth: 120,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      sortable: true,
    },
    {
      field: 'count',
      title: '数量',
      minWidth: 120,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
      sortable: true,
    },
    {
      field: 'productCode',
      title: '产品编码',
      minWidth: 120,
      sortable: true,
    },
    {
      field: 'productBarCode',
      title: '条码',
      minWidth: 120,
      sortable: true,
    },
    {
      field: 'productUnitName',
      title: '单位',
      minWidth: 80,
      sortable: true,
    },
    {
      field: 'batchNo',
      title: '批次号',
      minWidth: 120,
      sortable: true,
    },
    {
      field: 'packageQty',
      title: '包装数',
      minWidth: 90,
      sortable: true,
    },
    {
      field: 'pieceCount',
      title: '件数',
      minWidth: 80,
      sortable: true,
      formatter: stockItemPieceCountColumnFormatter,
    },
    {
      field: 'weight',
      title: '单重',
      minWidth: 90,
      sortable: true,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
    },
    {
      field: 'totalWeight',
      title: '总重',
      minWidth: 100,
      sortable: true,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
    },
    {
      field: 'totalPrice',
      title: '金额',
      minWidth: 120,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      sortable: true,
    },
    {
      field: 'remark',
      title: '备注',
      minWidth: 150,
      showOverflow: 'tooltip',
      sortable: true,
    },
  ];
  return applyStockItemColumnPermission(columns, hiddenFields);
}
