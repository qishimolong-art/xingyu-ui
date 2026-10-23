import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PrepareSaleDocumentItemColumnOptions } from '#/views/erp/sale/utils/document-item-table';

import { DICT_TYPE } from '@vben/constants';

import {
  getSaleOutDeptSimplePage,
  getSaleOutUserSimplePage,
} from '#/api/erp/sale/out';
import { getRangePickerDefaultProps } from '#/utils';
import { getCustomerSelectProps } from '#/views/erp/sale/utils/customer-select';
import { prepareSaleDocumentItemColumns } from '#/views/erp/sale/utils/document-item-table';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import {
  applySaleItemColumnPermission,
  getSaleDetailColumnPermissionHiddenFields,
  isSalePriceItemHidden,
} from '#/views/erp/sale/utils/field-permission';
import { saleItemPieceCountColumnFormatter } from '#/views/erp/sale/utils/item-piece-count';
import { withEnterBlurInputSchemas } from '#/views/erp/sale/utils/keyboard';

/** 列表搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return withCandidateFocus(
    withEnterBlurInputSchemas([
      {
        fieldName: 'customerId',
        label: '客户',
        component: 'CustomerLazySelect',
        componentProps: getCustomerSelectProps(
          false,
          'sale-out-search-select-dropdown',
        ),
      },
      {
        fieldName: 'outTime',
        label: '单据日期',
        component: 'RangePicker',
        componentProps: {
          ...getRangePickerDefaultProps(),
          allowClear: true,
        },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'sale-out-search-select-dropdown',
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          pageSize: 10,
          api: getSaleOutDeptSimplePage,
          labelField: 'name',
          valueField: 'id',
          loadErrorMessage: '部门列表加载失败，请重试',
        },
      },
      {
        fieldName: 'no',
        label: '销售单号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入销售单号',
          allowClear: true,
        },
      },
      {
        fieldName: 'saleUserId',
        label: '业务员',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'sale-out-search-select-dropdown',
          placeholder: '请选择业务员',
          allowClear: true,
          showSearch: true,
          pageSize: 10,
          api: getSaleOutUserSimplePage,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '业务员列表加载失败，请重试',
        },
      },
      {
        fieldName: 'receiverName',
        label: '联系人',
        component: 'Input',
        componentProps: {
          placeholder: '请输入联系人',
          allowClear: true,
        },
      },
      {
        fieldName: 'productKeyword',
        label: '产品',
        component: 'Input',
        componentProps: {
          placeholder:
            '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
          allowClear: true,
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
    ]),
  );
}
export function useGridColumns(
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  const operationWidth = rows.some(
    (row) => row.status === 20 && row.returnStatus !== 2,
  )
    ? 132
    : 78;
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { type: 'checkbox', width: 36 },
    {
      field: 'printAction',
      title: '打印',
      width: 40,
      slots: { default: 'printAction' },
    },
    {
      field: 'cloudPrintAction',
      title: '云打印',
      width: 60,
      slots: { default: 'cloudPrintAction' },
    },
    {
      field: 'wechatNotifyAction',
      title: '微信通知',
      width: 60,
      slots: { default: 'wechatNotifyAction' },
    },
    {
      field: 'printCount',
      title: '打印次数',
      width: 64,
      align: 'right',
      formatter: ({ cellValue }) => Number(cellValue || 0),
      sortable: true,
    },
    {
      field: 'no',
      title: '销售单号',
      width: 108,
      sortable: true,
      slots: { default: 'no' },
    },
    {
      field: 'adjustStatus',
      title: '调价状态',
      width: 72,
      slots: { default: 'adjustStatus' },
    },
    {
      field: 'returnStatus',
      title: '退货状态',
      width: 72,
      slots: { default: 'returnStatus' },
    },
    {
      field: 'settleStatus',
      title: '结算状态',
      width: 76,
      sortable: true,
      slots: { default: 'settleStatus' },
    },
    {
      field: 'quoteAction',
      title: '报价单',
      width: 52,
      slots: { default: 'quoteAction' },
    },
    {
      field: 'expenseAction',
      title: '报销单',
      width: 52,
      slots: { default: 'expenseAction' },
    },
    {
      field: 'outTime',
      title: '日期',
      width: 108,
      formatter: 'formatDateTime',
      sortable: true,
    },
    {
      field: 'status',
      title: '状态',
      width: 72,
      sortable: true,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.ERP_AUDIT_STATUS },
      },
    },
    {
      field: 'customerName',
      title: '客户名称',
      width: 96,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'deliveryMethod',
      title: '送货方式',
      width: 76,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'signAction',
      title: '签收',
      width: 40,
      slots: { default: 'signAction' },
    },
    {
      field: 'settleMethod',
      title: '结算方式',
      width: 80,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'totalProductPrice',
      title: '开单金额',
      formatter: 'formatAmount2',
      width: 88,
      align: 'right',
      sortable: true,
    },
    {
      field: 'reductionAmount',
      title: '减收金额',
      width: 88,
      align: 'right',
      sortable: true,
      slots: { default: 'reductionAmount' },
    },
    {
      field: 'afterReductionAmount',
      title: '减后金额',
      width: 88,
      align: 'right',
      sortable: true,
      slots: { default: 'afterReductionAmount' },
    },
    {
      field: 'billAmount',
      title: '票据金额',
      formatter: 'formatAmount2',
      width: 88,
      align: 'right',
      sortable: true,
    },
    {
      field: 'freight',
      title: '运费',
      formatter: 'formatAmount2',
      width: 72,
      align: 'right',
      sortable: true,
    },
    {
      field: 'freightType',
      title: '运费类型',
      width: 80,
      showOverflow: 'tooltip',
    },
    {
      field: 'billType',
      title: '票据类型',
      width: 88,
      showOverflow: 'tooltip',
    },
    {
      field: 'totalCount',
      title: '数量',
      formatter: 'formatAmount3',
      width: 72,
      align: 'right',
      sortable: true,
    },
    {
      field: 'cancelCount',
      title: '取消数量',
      formatter: 'formatAmount3',
      width: 88,
      align: 'right',
      sortable: true,
    },
    {
      field: 'cancelAmount',
      title: '取消金额',
      formatter: 'formatAmount2',
      width: 88,
      align: 'right',
      sortable: true,
    },
    {
      field: 'afterCancelAmount',
      title: '取消后金额',
      formatter: 'formatAmount2',
      width: 100,
      align: 'right',
      sortable: true,
    },
    {
      field: 'receiverName',
      title: '收货人',
      width: 76,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'receiverPhone',
      title: '收货人电话',
      width: 120,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'remark',
      title: '备注',
      width: 140,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'totalWeight',
      title: '总重',
      formatter: 'formatAmount3',
      width: 76,
      align: 'right',
      sortable: true,
    },
    {
      field: 'customerCode',
      title: '客户编码',
      width: 100,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'billNo',
      title: '票据号',
      width: 110,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'sourceNo',
      title: '来源单号',
      width: 140,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'sourceCreateTime',
      title: '来源单制单日期',
      width: 128,
      formatter: 'formatDateTime',
      sortable: true,
    },
    {
      field: 'sourceCreatorName',
      title: '来源单制单人',
      width: 112,
      showOverflow: 'tooltip',
    },
    {
      field: 'vin',
      title: 'VIN',
      width: 140,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'extraFee',
      title: '额外费用',
      width: 88,
      align: 'right',
      sortable: true,
      slots: { default: 'extraFee' },
    },
    {
      field: 'actions',
      title: '操作',
      width: operationWidth,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareSaleDocumentListColumns(columns, rows, {
    baseWidths: { actions: operationWidth },
    trailingFlexibleColumnMinWidth: 90,
  });
}

/** 详情明细表列 */
export function useDetailItemColumns(
  hiddenFields: string[] = [],
  options: PrepareSaleDocumentItemColumnOptions = {},
): VxeTableGridOptions['columns'] {
  const columns = applySaleItemColumnPermission(
    [
      { type: 'seq', title: '序号', width: 50 },
      { field: 'productCode', title: '编码', minWidth: 100 },
      {
        field: 'productName',
        title: '配件名称',
        minWidth: 120,
        slots: { default: 'productName' },
      },
      { field: 'vehicleModel', title: '车型', minWidth: 100 },
      { field: 'standard', title: '规格', minWidth: 80 },
      { field: 'featureCode', title: '特征码', minWidth: 80 },
      { field: 'brand', title: '品牌', minWidth: 80 },
      {
        field: 'giftFlag',
        title: '赠品',
        minWidth: 80,
        slots: { default: 'giftFlag' },
      },
      { field: 'productUnitName', title: '单位', minWidth: 60 },
      {
        field: 'count',
        title: '数量',
        minWidth: 120,
        slots: { default: 'count' },
      },
      {
        field: 'productPrice',
        title: '单价',
        minWidth: 120,
        slots: { default: 'productPrice' },
      },
      {
        field: 'totalProductPrice',
        title: '金额',
        minWidth: 100,
        formatter: isSalePriceItemHidden(hiddenFields, 'totalProductPrice')
          ? () => '****'
          : 'formatAmount2',
      },
      {
        field: 'saleCostPrice',
        title: '销售成本',
        minWidth: 110,
        formatter: isSalePriceItemHidden(hiddenFields, 'saleCostPrice')
          ? () => '****'
          : 'formatAmount2',
      },
      {
        field: 'saleCostAmount',
        title: '成本金额',
        minWidth: 110,
        formatter: isSalePriceItemHidden(hiddenFields, 'saleCostAmount')
          ? () => '****'
          : 'formatAmount2',
      },
      {
        field: 'actualSaleAmount',
        title: '实际销售金额',
        minWidth: 120,
        formatter: isSalePriceItemHidden(hiddenFields, 'actualSaleAmount')
          ? () => '****'
          : 'formatAmount2',
      },
      { field: 'drawingNo', title: '图号', minWidth: 100 },
      { field: 'batchNo', title: '批次', minWidth: 80 },
      {
        field: 'sourceWarehouseName',
        title: '来源仓库',
        minWidth: 180,
        slots: { default: 'sourceWarehouseName' },
      },
      {
        field: 'warehouseName',
        title: '出库仓库',
        minWidth: 160,
        slots: { default: 'warehouseName' },
      },
      { field: 'deptName', title: '所属部门', minWidth: 120 },
      {
        field: 'stockCount',
        title: '库存',
        minWidth: 90,
        formatter: 'formatAmount3',
      },
      { field: 'warehousePosition', title: '仓位', minWidth: 80 },
      {
        field: 'unitWeight',
        title: '单重',
        minWidth: 80,
        formatter: 'formatAmount3',
      },
      {
        field: 'packageQty',
        title: '包装数',
        minWidth: 90,
      },
      {
        field: 'pieceCount',
        title: '件数',
        minWidth: 80,
        formatter: saleItemPieceCountColumnFormatter,
      },
      {
        field: 'totalWeight',
        title: '总重',
        minWidth: 80,
        formatter: 'formatAmount3',
      },
      {
        field: 'afterReductionPrice',
        title: '减后价',
        minWidth: 100,
        formatter: isSalePriceItemHidden(hiddenFields, 'afterReductionPrice')
          ? () => '****'
          : 'formatAmount2',
      },
      {
        field: 'afterReductionAmount',
        title: '减后金额',
        minWidth: 100,
        formatter: isSalePriceItemHidden(hiddenFields, 'afterReductionAmount')
          ? () => '****'
          : 'formatAmount2',
      },
      { field: 'originPlace', title: '产地', minWidth: 80 },
      {
        field: 'originalProductPrice',
        title: '浮动前价格',
        minWidth: 100,
        formatter: isSalePriceItemHidden(hiddenFields, 'originalProductPrice')
          ? () => '****'
          : 'formatAmount2',
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 220,
        showOverflow: 'tooltip',
      },
    ],
    getSaleDetailColumnPermissionHiddenFields(hiddenFields),
  );
  return prepareSaleDocumentItemColumns(columns || [], {
    editable: false,
    ...options,
  });
}

export function useStockOutDetailItemColumns(
  hiddenFields: string[] = [],
  options: PrepareSaleDocumentItemColumnOptions = {},
): VxeTableGridOptions['columns'] {
  const columns = applySaleItemColumnPermission(
    [
      { type: 'seq', title: '序号', width: 50 },
      { field: 'productCode', title: '编码', minWidth: 100 },
      {
        field: 'productName',
        title: '配件名称',
        minWidth: 140,
        slots: { default: 'productName' },
      },
      {
        field: 'sourceWarehouseName',
        title: '来源仓库',
        minWidth: 180,
        slots: { default: 'sourceWarehouseName' },
      },
      {
        field: 'warehouseName',
        title: '出库仓库',
        minWidth: 160,
        slots: { default: 'warehouseName' },
      },
      { field: 'deptName', title: '所属部门', minWidth: 120 },
      {
        field: 'count',
        title: '销售数量',
        minWidth: 110,
        formatter: 'formatAmount3',
      },
      {
        field: 'stockOutBillNos',
        title: '出仓单号',
        minWidth: 180,
        showOverflow: 'tooltip',
      },
      {
        field: 'stockOutBillStatusName',
        title: '出仓状态',
        minWidth: 110,
        slots: { default: 'stockOutBillStatus' },
      },
      {
        field: 'stockOutBillCount',
        title: '出仓数量',
        minWidth: 110,
        formatter: 'formatAmount3',
      },
      {
        field: 'stockOutBillPickedCount',
        title: '已拣货',
        minWidth: 100,
        formatter: 'formatAmount3',
      },
      {
        field: 'stockOutBillRemainCount',
        title: '待拣货',
        minWidth: 100,
        formatter: 'formatAmount3',
      },
    ],
    hiddenFields,
  );
  return prepareSaleDocumentItemColumns(columns || [], {
    editable: false,
    ...options,
  }).map((column) => ({ ...column, sortable: false }));
}
