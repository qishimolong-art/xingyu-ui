import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getStockOutBillUserSimplePage } from '#/api/erp/stock/outbill';
import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import { stockListNumber } from '#/views/erp/stock/utils/stock-decimal';
import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';

import { prepareStockDocumentListColumns } from '../utils/document-list-table';

export function useGridFormSchema(): VbenFormSchema[] {
  return withCandidateFocus([
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
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择仓库',
        allowClear: true,
        showSearch: true,
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stock' }),
        pageSize: 10,
        labelField: 'name',
        popupClassName: 'stock-out-bill-search-select-dropdown',
        valueField: 'id',
        loadErrorMessage: '仓库列表加载失败，请重试',
      },
    },
    {
      fieldName: 'productKeyword',
      label: '产品',
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件编码、名称、拼音码、五笔码等',
        allowClear: true,
        'data-erp-product-keyword-search-input': 'true',
      },
    },
    {
      fieldName: 'shippingArea',
      label: '发货区',
      component: 'Input',
      componentProps: { placeholder: '请输入发货区', allowClear: true },
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
        allowClear: true,
        options: [
          { label: '历史待领（待核对）', value: 10 },
          { label: '历史部分领货（待核对）', value: 20 },
          { label: '历史已完成', value: 30 },
        ],
        placeholder: '请选择状态',
        popupClassName: 'stock-out-bill-search-select-dropdown',
      },
    },
    {
      fieldName: 'pickUserName',
      label: '历史拣货人',
      component: 'Input',
      componentProps: { placeholder: '请输入拣货人', allowClear: true },
    },
    {
      fieldName: 'creator',
      label: '创建人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getStockOutBillUserSimplePage,
        allowClear: true,
        labelField: 'nickname',
        placeholder: '请选择创建人',
        popupClassName: 'stock-out-bill-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
        pageSize: 10,
        loadErrorMessage: '创建人列表加载失败，请重试',
      },
    },
    {
      fieldName: 'auditor',
      label: '审核人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getStockOutBillUserSimplePage,
        allowClear: true,
        labelField: 'nickname',
        placeholder: '请选择审核人',
        popupClassName: 'stock-out-bill-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
        pageSize: 10,
        loadErrorMessage: '审核人列表加载失败，请重试',
      },
    },
  ]);
}

export function useGridColumns(
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  return prepareStockDocumentListColumns(
    [
      { type: 'checkbox', width: 44 },
      { type: 'seq', title: '序号', width: 48 },
      {
        field: 'priority',
        title: '优先级',
        width: 76,
        sortable: true,
      },
      {
        field: 'no',
        title: '单号',
        width: 148,
        showOverflow: 'tooltip',
        slots: { default: 'no' },
        sortable: true,
      },
      { field: 'pick', title: '历史拣货', width: 72, sortable: true },
      {
        field: 'pickUserName',
        title: '历史拣货人',
        width: 92,
        showOverflow: 'tooltip',
      },
      {
        field: 'billDate',
        title: '日期',
        width: 144,
        formatter: 'formatDateTime',
        sortable: true,
      },
      {
        field: 'warehouseName',
        title: '仓库',
        width: 112,
        showOverflow: 'tooltip',
      },
      {
        field: 'shippingArea',
        title: '发货区',
        width: 92,
        showOverflow: 'tooltip',
        sortable: true,
      },
      {
        field: 'sourceUnitName',
        title: '来源单位',
        minWidth: 128,
        showOverflow: 'tooltip',
      },
      {
        field: 'sourceNo',
        title: '来源单号',
        width: 148,
        showOverflow: 'tooltip',
        sortable: true,
      },
      {
        field: 'status',
        title: '状态',
        width: 88,
        slots: { default: 'status' },
        sortable: true,
      },
      {
        field: 'creatorName',
        title: '创建人',
        width: 88,
        showOverflow: 'tooltip',
      },
      {
        field: 'createTime',
        title: '创建时间',
        width: 144,
        formatter: 'formatDateTime',
        sortable: true,
      },
      {
        field: 'updaterName',
        title: '修改人',
        width: 88,
        showOverflow: 'tooltip',
      },
      {
        field: 'updateTime',
        title: '修改时间',
        width: 144,
        formatter: 'formatDateTime',
        sortable: true,
      },
      {
        field: 'auditorName',
        title: '审核人',
        width: 88,
        showOverflow: 'tooltip',
      },
      {
        field: 'auditTime',
        title: '审核时间',
        width: 144,
        formatter: 'formatDateTime',
        sortable: true,
      },
      {
        field: 'printTime',
        title: '打印时间',
        width: 144,
        formatter: 'formatDateTime',
        sortable: true,
      },
      { field: 'printCount', title: '打印次数', width: 84, sortable: true },
      {
        field: 'sourceRemark',
        title: '来源备注',
        minWidth: 160,
        showOverflow: 'tooltip',
        sortable: true,
      },
      {
        field: 'totalWeight',
        title: '总重',
        width: 92,
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        sortable: true,
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 180,
        showOverflow: 'tooltip',
        sortable: true,
      },
      {
        field: 'timeoutFlag',
        title: '超时',
        width: 76,
        slots: { default: 'timeoutFlag' },
      },
      {
        field: 'wholeQty',
        title: '整件数',
        width: 88,
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      },
      {
        field: 'looseQty',
        title: '散件数',
        width: 88,
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      },
      {
        field: 'totalCount',
        title: '历史应领数量',
        width: 96,
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      },
      {
        field: 'pickedCount',
        title: '历史已领数量',
        width: 96,
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      },
    ],
    rows,
  );
}
