import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpAssemblyOrderApi } from '#/api/erp/assembly/order';

import { getStockWarehouseFilterOptionPage } from '#/api/erp/stock/warehouse';

export const orderStatusOptions = [
  { label: '草稿', value: 10 },
  { label: '已确认', value: 15 },
  { label: '装配中', value: 18 },
  { label: '已完成', value: 20 },
  { label: '历史已作废', value: 30 },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'keyword',
      label: '关键词',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '组装单号/模块编码/名称/组成件编码/名称',
      },
    },
    {
      fieldName: 'warehouseId',
      label: '仓库',
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getStockWarehouseFilterOptionPage,
        pageSize: 10,
        labelField: 'displayName',
        valueField: 'id',
        allowClear: true,
        showSearch: true,
        placeholder: '请选择仓库',
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: { allowClear: true, options: orderStatusOptions },
    },
    {
      fieldName: 'assemblyTime',
      label: '组装日期',
      component: 'RangePicker',
      componentProps: { valueFormat: 'YYYY-MM-DD HH:mm:ss', showTime: true },
    },
  ];
}

export function useGridColumns(): VxeTableGridOptions<ErpAssemblyOrderApi.Order>['columns'] {
  return [
    { type: 'checkbox', width: 36, autoFixed: false } as any,
    {
      field: 'deleteAction',
      title: '删除',
      width: 44,
      autoFixed: false,
      slots: { default: 'deleteAction' },
    } as any,
    {
      field: 'printAction',
      title: '打印',
      width: 44,
      autoFixed: false,
      slots: { default: 'printAction' },
    } as any,
    {
      field: 'exportAction',
      title: '导出',
      width: 44,
      autoFixed: false,
      slots: { default: 'exportAction' },
    } as any,
    {
      field: 'no',
      title: '单号',
      width: 150,
      slots: { default: 'no' },
    },
    {
      field: 'assemblyTime',
      title: '单据日期',
      width: 150,
      formatter: 'formatDateTime',
    },
    {
      field: 'status',
      title: '单据状态',
      width: 84,
      slots: { default: 'status' },
    },
    {
      field: 'customerName',
      title: '对象',
      width: 140,
      showOverflow: 'tooltip',
    },
    { field: 'productDrawingNo', title: '图号', width: 110 },
    { field: 'productCode', title: '产品编码', width: 120 },
    {
      field: 'productName',
      title: '产品名称',
      width: 160,
      showOverflow: 'tooltip',
    },
    { field: 'productOriginPlace', title: '产地', width: 100 },
    { field: 'productStandard', title: '规格', width: 120 },
    { field: 'productFeatureCode', title: '特征码', width: 110 },
    { field: 'productBrand', title: '品牌', width: 100 },
    { field: 'productVehicleModel', title: '车型', width: 120 },
    { field: 'warehouseName', title: '仓库', width: 120 },
    { field: 'shelf', title: '仓位', width: 100 },
    {
      field: 'setCount',
      title: '数量',
      width: 80,
      formatter: 'formatAmount3',
    },
    {
      field: 'totalCost',
      title: '组装成本金额',
      width: 110,
      formatter: 'formatAmount2',
    },
    {
      field: 'unitCost',
      title: '成本价',
      width: 90,
      formatter: 'formatAmount2',
    },
    {
      field: 'productRetailPrice',
      title: '零售价',
      width: 90,
      formatter: 'formatAmount2',
    },
    { field: 'creatorName', title: '创建人', width: 90 },
    { field: 'updaterName', title: '编辑人', width: 90 },
    { field: 'printCount', title: '打印次数', width: 80 },
    {
      field: 'printTime',
      title: '打印时间',
      width: 150,
      formatter: 'formatDateTime',
    },
  ];
}
