import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';

export const purchaseInSelectColumns: VxeTableGridOptions<ErpPurchaseInApi.PurchaseIn>['columns'] =
  [
    { type: 'radio', width: 50, fixed: 'left' },
    { field: 'no', title: '入库单号', width: 200, fixed: 'left' },
    { field: 'supplierName', title: '供应商', minWidth: 140 },
    { field: 'inTime', title: '入库时间', width: 170, formatter: 'formatDate' },
    {
      field: 'totalCount',
      title: '入库数量',
      minWidth: 120,
      formatter: 'formatPurchaseDecimal6',
    },
    {
      field: 'totalPrice',
      title: '入库金额',
      minWidth: 120,
      formatter: 'formatPurchaseDecimal6',
    },
    {
      field: 'returnStatus',
      title: '退货状态',
      width: 110,
      slots: { default: 'returnStatus' },
    },
    { field: 'orderNo', title: '来源单号', minWidth: 180 },
  ];
