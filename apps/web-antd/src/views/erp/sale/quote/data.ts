import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PrepareSaleDocumentItemColumnOptions } from '#/views/erp/sale/utils/document-item-table';

import {
  getSaleQuoteCustomerDeptSimplePage,
  getSaleQuoteDeptSimplePage,
  getSaleQuoteUserSimplePage,
} from '#/api/erp/sale/quote';
import { getRangePickerDefaultProps } from '#/utils';
import { getSaleCustomerSelectProps } from '#/views/erp/sale/utils/customer-credit';
import { getCustomerSelectProps } from '#/views/erp/sale/utils/customer-select';
import { prepareSaleDocumentItemColumns } from '#/views/erp/sale/utils/document-item-table';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import {
  applySaleFormFieldPermission,
  applySaleItemColumnPermission,
  getSaleDetailColumnPermissionHiddenFields,
  isSalePriceItemHidden,
} from '#/views/erp/sale/utils/field-permission';
import { saleItemPieceCountColumnFormatter } from '#/views/erp/sale/utils/item-piece-count';
import { withEnterBlurInputSchemas } from '#/views/erp/sale/utils/keyboard';

export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
  deptOptions: any[] = [],
): VbenFormSchema[] {
  return withCandidateFocus(
    withEnterBlurInputSchemas(
      applySaleFormFieldPermission(
        [
          {
            fieldName: 'id',
            component: 'Input',
            dependencies: { triggerFields: [''], show: () => false },
          },
          {
            fieldName: 'no',
            label: '报价单号',
            component: 'Input',
            componentProps: { placeholder: '系统自动生成', disabled: true },
          },
          {
            fieldName: 'quoteTime',
            label: '报价时间',
            component: 'DatePicker',
            componentProps: {
              placeholder: '保存后自动生成',
              showTime: true,
              format: 'YYYY-MM-DD HH:mm:ss',
              valueFormat: 'x',
              disabled: true,
            },
          },
          {
            fieldName: 'customerId',
            label: '客户',
            component: 'SaleCustomerLazySelect',
            componentProps: {
              ...getSaleCustomerSelectProps(formType === 'detail'),
              popupClassName: 'sale-quote-form-select-dropdown',
            },
            rules: 'required',
          },
          {
            fieldName: 'customerReceivableInfo',
            component: 'Input',
            formItemClass: 'col-span-4',
          },
          {
            fieldName: 'saleUserId',
            label: '业务员',
            component: 'ErpLazyPageSelect',
            componentProps: {
              placeholder: '请选择业务员',
              allowClear: true,
              showSearch: true,
              api: getSaleQuoteUserSimplePage,
              pageSize: 10,
              popupClassName: 'sale-quote-form-select-dropdown',
              labelField: 'nickname',
              valueField: 'id',
              disabled: formType === 'detail',
            },
            rules: 'required',
          },
          {
            fieldName: 'deliveryAddress',
            label: '收货地址',
            component: 'Input',
            componentProps: {
              placeholder: '请输入收货地址',
              disabled: formType === 'detail',
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
              api: getSaleQuoteCustomerDeptSimplePage,
              pageSize: 10,
              params: {},
              shouldFetch: (params: { customerId?: number | string }) =>
                Boolean(params?.customerId),
              options: deptOptions,
              labelField: 'name',
              valueField: 'id',
              popupClassName: 'sale-quote-form-select-dropdown',
              disabled: formType === 'detail',
            },
          },
          {
            fieldName: 'receiverName',
            label: '收货人',
            component: 'Input',
            componentProps: {
              placeholder: '请输入收货人',
              disabled: formType === 'detail',
            },
          },
          {
            fieldName: 'receiverPhone',
            label: '收货电话',
            component: 'Input',
            componentProps: {
              placeholder: '请输入收货电话',
              disabled: formType === 'detail',
            },
          },
          {
            fieldName: 'expectedDeliveryTime',
            label: '预计发货时间',
            component: 'DatePicker',
            componentProps: {
              placeholder: '选择预计发货时间',
              showTime: true,
              format: 'YYYY-MM-DD HH:mm:ss',
              valueFormat: 'x',
              disabled: formType === 'detail',
            },
          },
          {
            fieldName: 'vin',
            label: 'VIN车架号',
            component: 'Input',
            componentProps: {
              placeholder: '请输入VIN车架号',
              disabled: formType === 'detail',
            },
          },
          {
            fieldName: 'remark',
            label: '备注',
            component: 'Textarea',
            componentProps: {
              placeholder: '请输入备注',
              autoSize: { minRows: 1, maxRows: 2 },
              disabled: formType === 'detail',
            },
          },
          {
            fieldName: 'internalRemark',
            label: '内部说明',
            component: 'Textarea',
            componentProps: {
              placeholder: '请输入内部说明',
              autoSize: { minRows: 1, maxRows: 2 },
              disabled: formType === 'detail',
            },
          },
          {
            fieldName: 'items',
            label: '报价产品清单',
            component: 'Input',
            formItemClass: 'col-span-4',
          },
          {
            fieldName: 'totalCount',
            component: 'Input',
            dependencies: { triggerFields: [''], show: () => false },
          },
          {
            fieldName: 'totalProductPrice',
            component: 'Input',
            dependencies: { triggerFields: [''], show: () => false },
          },
          {
            fieldName: 'totalTaxPrice',
            component: 'Input',
            dependencies: { triggerFields: [''], show: () => false },
          },
          {
            fieldName: 'totalPrice',
            component: 'Input',
            dependencies: { triggerFields: [''], show: () => false },
          },
        ],
        hiddenFields,
      ),
    ),
  );
}

export function useFormItemColumns(
  disabled: boolean,
  hiddenFields: string[] = [],
  options: PrepareSaleDocumentItemColumnOptions = {},
): VxeTableGridOptions['columns'] {
  const columns = applySaleItemColumnPermission(
    [
      { type: 'seq', title: '序号', width: 50 },
      {
        field: 'productId',
        title: '产品名称',
        minWidth: 220,
        sortable: true,
        showOverflow: 'tooltip',
        slots: { default: 'productId' },
      },
      {
        field: 'productCode',
        title: '产品编号',
        minWidth: 130,
        sortable: true,
        showOverflow: 'tooltip',
      },
      {
        field: 'warehouseId',
        title: '仓库',
        minWidth: 180,
        sortable: true,
        showOverflow: 'tooltip',
        slots: { default: 'warehouseId' },
      },
      {
        field: 'deptId',
        title: '所属部门',
        minWidth: 160,
        sortable: true,
        slots: { default: 'deptId' },
      },
      {
        field: 'count',
        title: '数量',
        minWidth: 100,
        sortable: true,
        slots: { default: 'count' },
      },
      {
        field: 'productPrice',
        title: '产品单价',
        minWidth: 110,
        sortable: true,
        slots: { default: 'productPrice' },
      },
      {
        field: 'lastSalePrice',
        title: '最后一次销售价',
        minWidth: 130,
        formatter: 'formatAmount2',
        sortable: true,
      },
      {
        field: 'totalPrice',
        title: '金额',
        minWidth: 110,
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'totalPrice')
            ? () => '****'
            : 'formatAmount2',
        sortable: true,
      },
      {
        field: 'giftFlag',
        title: '是否为赠品',
        minWidth: 100,
        sortable: true,
        slots: { default: 'giftFlag' },
      },
      {
        field: 'batchNo',
        title: '批次',
        minWidth: 120,
        sortable: true,
        slots: { default: 'batchNo' },
      },
      {
        field: 'stockCount',
        title: '库存',
        minWidth: 90,
        formatter: 'formatAmount3',
        sortable: true,
      },
      {
        field: 'productBarCode',
        title: '条码',
        minWidth: 130,
        sortable: true,
        showOverflow: 'tooltip',
      },
      {
        field: 'productUnitName',
        title: '单位',
        minWidth: 80,
        sortable: true,
      },
      {
        field: 'weight',
        title: '重量',
        minWidth: 80,
        formatter: 'formatAmount3',
        sortable: true,
      },
      {
        field: 'packageQty',
        title: '包装数',
        minWidth: 90,
        formatter: 'formatAmount3',
        sortable: true,
      },
      {
        field: 'pieceCount',
        title: '件数',
        minWidth: 80,
        formatter: saleItemPieceCountColumnFormatter,
      },
      {
        field: 'brand',
        title: '品牌',
        minWidth: 120,
        sortable: true,
        slots: { default: 'brand' },
      },
      {
        field: 'vehicleModel',
        title: '车型',
        minWidth: 130,
        sortable: true,
        slots: { default: 'vehicleModel' },
      },
      {
        field: 'originPlace',
        title: '产地',
        minWidth: 120,
        sortable: true,
        slots: { default: 'originPlace' },
      },
      {
        field: 'standard',
        title: '规格',
        minWidth: 120,
        sortable: true,
        slots: { default: 'standard' },
      },
      {
        field: 'convertedCount',
        title: '已转',
        minWidth: 100,
        formatter: 'formatAmount3',
        sortable: true,
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 240,
        sortable: true,
        showOverflow: 'tooltip',
        slots: { default: 'remark' },
      },
      {
        field: 'actions',
        title: '操作',
        width: 78,
        slots: { default: 'actions' },
        visible: !disabled,
      },
    ],
    disabled
      ? getSaleDetailColumnPermissionHiddenFields(hiddenFields)
      : hiddenFields,
  );
  return prepareSaleDocumentItemColumns(columns || [], {
    editable: !disabled,
    ...options,
  });
}

export function useGridFormSchema(): VbenFormSchema[] {
  return withCandidateFocus(
    withEnterBlurInputSchemas([
      {
        fieldName: 'customerId',
        label: '客户',
        component: 'CustomerLazySelect',
        componentProps: getCustomerSelectProps(
          false,
          'sale-quote-search-select-dropdown',
        ),
      },
      {
        fieldName: 'quoteTime',
        label: '单据日期',
        component: 'RangePicker',
        componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
      },
      {
        fieldName: 'deptId',
        label: '\u6240\u5C5E\u90E8\u95E8',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'sale-quote-search-select-dropdown',
          placeholder: '\u8BF7\u9009\u62E9\u6240\u5C5E\u90E8\u95E8',
          allowClear: true,
          showSearch: true,
          pageSize: 10,
          api: getSaleQuoteDeptSimplePage,
          labelField: 'name',
          valueField: 'id',
          loadErrorMessage: '部门列表加载失败，请重试',
        },
      },
      {
        fieldName: 'no',
        label: '报价单号',
        component: 'Input',
        componentProps: { placeholder: '请输入报价单号', allowClear: true },
      },
      {
        fieldName: 'saleUserId',
        label: '业务员',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'sale-quote-search-select-dropdown',
          placeholder: '请选择业务员',
          allowClear: true,
          showSearch: true,
          pageSize: 10,
          api: getSaleQuoteUserSimplePage,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '业务员列表加载失败，请重试',
        },
      },
      {
        fieldName: 'vin',
        label: 'VIN车架号',
        component: 'Input',
        componentProps: { placeholder: '请输入VIN车架号', allowClear: true },
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
        componentProps: { placeholder: '请输入备注', allowClear: true },
      },
    ]),
  );
}

export function useGridColumns(
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { type: 'checkbox', width: 36, ...({ autoFixed: false } as any) },
    {
      field: 'deleteAction',
      title: '删除',
      width: 40,
      slots: { default: 'deleteAction' },
    },
    {
      field: 'outAction',
      title: '出库',
      width: 40,
      slots: { default: 'outAction' },
    },
    {
      field: 'printAction',
      title: '打印',
      width: 40,
      slots: { default: 'printAction' },
    },
    {
      field: 'wechatNotifyAction',
      title: '微信通知',
      width: 62,
      slots: { default: 'wechatNotifyAction' },
    },
    {
      field: 'exportAction',
      title: '导出',
      width: 40,
      slots: { default: 'exportAction' },
    },
    {
      field: 'printCount',
      title: '打印次数',
      width: 64,
      align: 'right',
      formatter: ({ cellValue }) => Number(cellValue || 0),
    },
    {
      field: 'no',
      title: '报价单号',
      width: 108,
      sortable: true,
      slots: { default: 'no' },
    },
    {
      field: 'quoteTime',
      title: '单据日期',
      width: 112,
      formatter: 'formatDateTime',
      sortable: true,
    },
    {
      field: 'orderStatus',
      title: '下订状态',
      width: 84,
      sortable: true,
      slots: { default: 'orderStatus' },
    },
    {
      field: 'outStatus',
      title: '出库状态',
      width: 112,
      sortable: true,
      slots: { default: 'outStatus' },
    },
    {
      field: 'continueBuyAction',
      title: '继续选购',
      width: 62,
      slots: { default: 'continueBuyAction' },
    },
    {
      field: 'customerName',
      title: '客户名称',
      width: 112,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'totalProductPrice',
      title: '总金额',
      width: 72,
      align: 'right',
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'discountPrice',
      title: '折让金额',
      width: 84,
      align: 'right',
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'totalPrice',
      title: '实收金额',
      width: 84,
      align: 'right',
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'saleUserName',
      title: '业务员',
      width: 72,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'deptName',
      title: '部门',
      width: 80,
      sortable: true,
      showOverflow: 'tooltip',
    },
    { field: 'priority', title: '优先级', width: 72 },
    { field: 'deliveryMethod', title: '送货方式', width: 84 },
    {
      field: 'deliveryAddress',
      title: '送货地址',
      width: 140,
      showOverflow: 'tooltip',
      sortable: true,
    },
    { field: 'settleMethod', title: '付款方式', width: 84 },
    {
      field: 'expectedDeliveryTime',
      title: '预计发货时间',
      width: 112,
      formatter: 'formatDateTime',
      sortable: true,
    },
    {
      field: 'remark',
      title: '备注',
      width: 120,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'internalRemark',
      title: '内部说明',
      width: 120,
      showOverflow: 'tooltip',
      sortable: true,
    },
    { field: 'customerCode', title: '客户编码', width: 100 },
    {
      field: 'creatorName',
      title: '建立人',
      width: 72,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'createTime',
      title: '建立时间',
      width: 112,
      formatter: 'formatDateTime',
      sortable: true,
    },
    {
      field: 'updaterName',
      title: '修改人',
      width: 72,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'updateTime',
      title: '修改时间',
      width: 112,
      formatter: 'formatDateTime',
      sortable: true,
    },
    {
      field: 'printTime',
      title: '打印时间',
      width: 112,
      formatter: 'formatDateTime',
    },
    {
      field: 'actions',
      title: '操作',
      width: 96,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareSaleDocumentListColumns(columns, rows, {
    trailingFlexibleColumnMinWidth: 90,
  });
}
