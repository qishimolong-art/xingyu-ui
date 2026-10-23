import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PrepareSaleDocumentItemColumnOptions } from '#/views/erp/sale/utils/document-item-table';

import { getBaseDataSimpleList } from '#/api/erp/base';
import {
  getSalePriceAdjustCustomerDeptSimplePage,
  getSalePriceAdjustDeptSimplePage,
  getSalePriceAdjustUserSimplePage,
} from '#/api/erp/sale/priceadjust';
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
import { salePriceAdjustPieceCountColumnFormatter } from '#/views/erp/sale/utils/item-piece-count';
import { withEnterBlurInputSchemas } from '#/views/erp/sale/utils/keyboard';

export const priceAdjustStatusOptions = [
  { label: '草稿', value: 0 },
  { label: '未审核', value: 10 },
  { label: '已审核', value: 20 },
  { label: '已驳回', value: 30 },
];

export const priceAdjustTypeOptions = [
  { label: '销售单', value: 10 },
  { label: '退货单', value: 20 },
  { label: '调拨出库', value: 30 },
];

export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
  deptOptions: any[] = [],
): VbenFormSchema[] {
  const disabled = formType === 'detail';
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
            label: '调价单号',
            component: 'Input',
            componentProps: { placeholder: '系统自动生成', disabled: true },
          },
          {
            fieldName: 'adjustDate',
            label: '调价日期',
            component: 'DatePicker',
            componentProps: {
              placeholder: '系统自动生成',
              showTime: true,
              format: 'YYYY-MM-DD HH:mm:ss',
              valueFormat: 'x',
              disabled: true,
            },
            rules: 'required',
          },
          {
            fieldName: 'customerId',
            label: '客户',
            component: 'SaleCustomerLazySelect',
            componentProps: {
              ...getSaleCustomerSelectProps(disabled),
              allowClear: false,
              popupClassName: 'sale-price-adjust-form-select-dropdown',
            },
            rules: 'required',
          },
          {
            fieldName: 'customerReceivableInfo',
            component: 'Input',
            formItemClass: 'col-span-3',
          },
          {
            fieldName: 'adjustUserId',
            label: '调价人',
            component: 'ErpLazyPageSelect',
            componentProps: {
              popupClassName: 'sale-price-adjust-form-select-dropdown',
              placeholder: '请选择调价人',
              allowClear: true,
              showSearch: true,
              api: getSalePriceAdjustUserSimplePage,
              pageSize: 10,
              labelField: 'nickname',
              valueField: 'id',
              disabled,
            },
            rules: 'required',
          },
          {
            fieldName: 'settleMethod',
            label: '结算方式',
            component: 'ApiSelect',
            componentProps: {
              popupClassName: 'sale-price-adjust-form-select-dropdown',
              placeholder: '请选择结算方式',
              allowClear: true,
              showSearch: true,
              api: () => getBaseDataSimpleList('settle_method'),
              labelField: 'name',
              valueField: 'name',
              disabled,
            },
            rules: 'required',
          },
          {
            fieldName: 'deliveryMethod',
            label: '送货方式',
            component: 'ApiSelect',
            componentProps: {
              popupClassName: 'sale-price-adjust-form-select-dropdown',
              placeholder: '请选择送货方式',
              allowClear: true,
              showSearch: true,
              api: () => getBaseDataSimpleList('delivery_method'),
              labelField: 'name',
              valueField: 'name',
              disabled,
            },
            rules: 'required',
          },
          {
            fieldName: 'logisticsCompany',
            label: '物流公司',
            component: 'Input',
            componentProps: {
              placeholder: '请输入物流公司',
              disabled,
            },
          },
          {
            fieldName: 'adjustType',
            label: '销售调价类型',
            component: 'Select',
            componentProps: {
              popupClassName: 'sale-price-adjust-form-select-dropdown',
              placeholder: '请选择销售调价类型',
              options: priceAdjustTypeOptions,
              allowClear: true,
              disabled,
            },
          },
          {
            fieldName: 'deptId',
            label: '部门',
            component: 'ErpLazyPageSelect',
            componentProps: {
              popupClassName: 'sale-price-adjust-form-select-dropdown',
              placeholder: '请选择部门',
              allowClear: true,
              showSearch: true,
              api: getSalePriceAdjustCustomerDeptSimplePage,
              pageSize: 10,
              params: {},
              shouldFetch: (params: { customerId?: number | string }) =>
                Boolean(params?.customerId),
              options: deptOptions,
              labelField: 'name',
              valueField: 'id',
              disabled,
            },
          },
          {
            fieldName: 'remark',
            label: '备注',
            component: 'Textarea',
            componentProps: {
              placeholder: '请输入备注',
              autoSize: { minRows: 1, maxRows: 1 },
              disabled,
            },
          },
          {
            fieldName: 'items',
            label: '调价产品清单',
            component: 'Input',
            formItemClass: 'col-span-4 sale-price-adjust-items-field',
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
      { type: 'seq', title: '序号', width: 52 },
      { field: 'saleOutNo', title: '销售单号', width: 156, sortable: true },
      { field: 'partCode', title: '产品编号', width: 132, sortable: true },
      {
        field: 'partName',
        title: '配件名称',
        width: 180,
        sortable: true,
        slots: { default: 'partName' },
      },
      {
        field: 'oldPrice',
        title: '原售价(开单价)',
        width: 128,
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'oldPrice')
            ? () => '****'
            : 'formatAmount2',
        sortable: true,
      },
      {
        field: 'newPrice',
        title: '调整价',
        width: 118,
        sortable: true,
        slots: { default: 'newPrice' },
      },
      {
        field: 'outCount',
        title: '出库数',
        width: 88,
        formatter: 'formatAmount3',
        sortable: true,
      },
      {
        field: 'stockCount',
        title: '库存',
        width: 80,
        formatter: 'formatAmount3',
        sortable: true,
      },
      {
        field: 'warehouseName',
        title: '仓库',
        width: 160,
        sortable: true,
        slots: { default: 'warehouseName' },
      },
      { field: 'batchNo', title: '批次号', width: 120, sortable: true },
      { field: 'vehicleModel', title: '车型', width: 120, sortable: true },
      { field: 'originPlace', title: '产地', width: 100, sortable: true },
      { field: 'brand', title: '品牌', width: 110, sortable: true },
      { field: 'unit', title: '单位', width: 68, sortable: true },
      {
        field: 'weight',
        title: '重量',
        width: 80,
        formatter: 'formatAmount3',
        sortable: true,
      },
      { field: 'packageQty', title: '包装数', width: 90, sortable: true },
      {
        field: 'pieceCount',
        title: '件数',
        width: 80,
        formatter: salePriceAdjustPieceCountColumnFormatter,
      },
      {
        field: 'adjustAmount',
        title: '调整金额',
        width: 112,
        sortable: true,
        slots: { default: 'adjustAmount' },
      },
      {
        field: 'adjustPrice',
        title: '差价',
        width: 100,
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'adjustPrice')
            ? () => '****'
            : 'formatAmount2',
        sortable: true,
      },
      {
        field: 'adjustReason',
        title: '销售调价原因',
        width: 200,
        sortable: true,
        slots: { default: 'adjustReason' },
      },
      {
        field: 'itemRemark',
        title: '备注',
        width: 180,
        sortable: true,
        slots: { default: 'itemRemark' },
      },
      {
        field: 'actions',
        title: '操作',
        width: 64,
        fixed: 'right',
        slots: { default: 'actions' },
        visible: !disabled,
      },
    ],
    disabled
      ? getSaleDetailColumnPermissionHiddenFields(hiddenFields)
      : hiddenFields,
  );
  const modeColumns = disabled
    ? (columns || []).filter((column: any) => column.field !== 'actions')
    : columns || [];
  return prepareSaleDocumentItemColumns(modeColumns, {
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
          'sale-price-adjust-search-select-dropdown',
        ),
      },
      {
        fieldName: 'adjustDate',
        label: '调价时间',
        component: 'RangePicker',
        componentProps: {
          ...getRangePickerDefaultProps(),
          allowClear: true,
          popupClassName: 'sale-price-adjust-search-picker-dropdown',
        },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'sale-price-adjust-search-select-dropdown',
          api: getSalePriceAdjustDeptSimplePage,
          labelField: 'name',
          valueField: 'id',
          allowClear: true,
          showSearch: true,
          pageSize: 10,
          placeholder: '请选择所属部门',
          loadErrorMessage: '部门列表加载失败，请重试',
        },
      },
      {
        fieldName: 'no',
        label: '调价单号',
        component: 'Input',
        componentProps: { placeholder: '请输入调价单号', allowClear: true },
      },
      {
        fieldName: 'adjustUserId',
        label: '调价人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'sale-price-adjust-search-select-dropdown',
          placeholder: '请选择调价人',
          allowClear: true,
          showSearch: true,
          pageSize: 10,
          api: getSalePriceAdjustUserSimplePage,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '调价人列表加载失败，请重试',
        },
      },
      {
        fieldName: 'adjustType',
        label: '调价方式',
        component: 'Select',
        componentProps: {
          popupClassName: 'sale-price-adjust-search-select-dropdown',
          placeholder: '请选择调价方式',
          options: priceAdjustTypeOptions,
          allowClear: true,
          showSearch: true,
          filterOption: (input: string, option: any) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.trim().toLowerCase()),
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
        componentProps: { placeholder: '请输入备注', allowClear: true },
      },
    ]),
  );
}

export function useGridColumns(
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { type: 'checkbox', width: 36 },
    {
      field: 'deleteAction',
      title: '删除',
      width: 40,
      slots: { default: 'deleteAction' },
    },
    {
      field: 'printAction',
      title: '打印',
      width: 40,
      slots: { default: 'printAction' },
    },
    {
      field: 'no',
      title: '单号',
      width: 118,
      sortable: true,
      slots: { default: 'no' },
    },
    {
      field: 'customerName',
      title: '客户名称',
      width: 112,
      sortable: true,
    },
    {
      field: 'adjustDate',
      title: '单据日期',
      width: 112,
      formatter: 'formatDate',
      sortable: true,
    },
    {
      field: 'status',
      title: '状态',
      width: 72,
      sortable: true,
      slots: { default: 'status' },
    },
    {
      field: 'totalOriginalPrice',
      title: '原单金额',
      width: 88,
      formatter: 'formatAmount2',
    },
    {
      field: 'totalAdjustedPrice',
      title: '调后金额',
      width: 88,
      formatter: 'formatAmount2',
    },
    {
      field: 'totalAdjustPrice',
      title: '调价差额',
      width: 88,
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'taxExclusiveAdjustPrice',
      title: '不含税调价差额',
      width: 112,
      formatter: 'formatAmount2',
    },
    {
      field: 'taxPrice',
      title: '税额',
      width: 64,
      formatter: 'formatAmount2',
    },
    {
      field: 'sourceNo',
      title: '销售单号',
      width: 120,
    },
    { field: 'creatorName', title: '创建人', width: 72, sortable: true },
    {
      field: 'createTime',
      title: '创建日期',
      width: 112,
      formatter: 'formatDate',
      sortable: true,
    },
    { field: 'updaterName', title: '修改人', width: 72, sortable: true },
    {
      field: 'updateTime',
      title: '修改日期',
      width: 112,
      formatter: 'formatDate',
      sortable: true,
    },
    { field: 'adjustUserName', title: '调价人', width: 72, sortable: true },
    { field: 'auditorName', title: '审核人', width: 72, sortable: true },
    {
      field: 'approveTime',
      title: '审核日期',
      width: 112,
      formatter: 'formatDate',
      sortable: true,
    },
    {
      field: 'actions',
      title: '操作',
      width: 112,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareSaleDocumentListColumns(columns, rows);
}
