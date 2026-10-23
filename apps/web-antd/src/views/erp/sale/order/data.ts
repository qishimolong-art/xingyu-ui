import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PrepareSaleDocumentItemColumnOptions } from '#/views/erp/sale/utils/document-item-table';

import { DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import { getAccountSimpleList } from '#/api/erp/finance/account';
import {
  getSaleOrderCustomerDeptSimplePage,
  getSaleOrderDeptSimplePage,
  getSaleOrderUserSimplePage,
} from '#/api/erp/sale/order';
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
import { createOptionalNumberRule } from '#/views/erp/sale/utils/text-number';

/** 表单的配置项 */
export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
  deptOptions: any[] = [],
): VbenFormSchema[] {
  return withEnterBlurInputSchemas(
    applySaleFormFieldPermission(
      [
        {
          fieldName: 'id',
          component: 'Input',
          dependencies: {
            triggerFields: [''],
            show: () => false,
          },
        },
        {
          fieldName: 'no',
          label: '订单单号',
          component: 'Input',
          componentProps: {
            placeholder: '系统自动生成',
            disabled: true,
          },
        },
        {
          fieldName: 'orderTime',
          label: '订单时间',
          component: 'DatePicker',
          componentProps: {
            placeholder: '选择订单时间',
            showTime: true,
            format: 'YYYY-MM-DD HH:mm:ss',
            valueFormat: 'x',
          },
          rules: 'required',
        },
        {
          label: '客户',
          fieldName: 'customerId',
          component: 'SaleCustomerLazySelect',
          componentProps: {
            ...getSaleCustomerSelectProps(formType === 'detail'),
          },
          rules: 'required',
        },
        {
          fieldName: 'customerReceivableInfo',
          component: 'Input',
          formItemClass: 'col-span-3',
        },
        {
          fieldName: 'orderType',
          label: '订单类型',
          component: 'Select',
          componentProps: {
            placeholder: '请选择订单类型',
            allowClear: true,
            options: [
              { label: '正式单', value: 1 },
              { label: '报价单', value: 2 },
            ],
            disabled: formType === 'detail',
          },
        },
        {
          fieldName: 'saleUserId',
          label: '销售人员',
          component: 'ErpLazyPageSelect',
          componentProps: {
            placeholder: '请选择销售人员',
            allowClear: true,
            showSearch: true,
            api: getSaleOrderUserSimplePage,
            pageSize: 10,
            labelField: 'nickname',
            valueField: 'id',
          },
        },
        {
          fieldName: 'deptId',
          label: '\u6240\u5c5e\u90e8\u95e8',
          component: 'ErpLazyPageSelect',
          componentProps: {
            placeholder: '\u8bf7\u9009\u62e9\u6240\u5c5e\u90e8\u95e8',
            allowClear: true,
            showSearch: true,
            api: getSaleOrderCustomerDeptSimplePage,
            pageSize: 10,
            params: {},
            shouldFetch: (params: { customerId?: number | string }) =>
              Boolean(params?.customerId),
            options: deptOptions,
            labelField: 'name',
            valueField: 'id',
            disabled: formType === 'detail',
          },
        },
        {
          fieldName: 'remark',
          label: '备注',
          component: 'Textarea',
          componentProps: {
            placeholder: '请输入备注',
            autoSize: { minRows: 1, maxRows: 1 },
            disabled: formType === 'detail',
          },
          formItemClass: 'col-span-2',
        },
        ...(formType !== 'detail'
          ? ([
              {
                fieldName: 'fileUrl',
                label: '附件',
                component: 'FileUpload' as const,
                componentProps: {
                  maxNumber: 1,
                  maxSize: 10,
                  accept: [
                    'pdf',
                    'doc',
                    'docx',
                    'xls',
                    'xlsx',
                    'txt',
                    'jpg',
                    'jpeg',
                    'png',
                  ],
                  showDescription: true,
                },
                formItemClass: 'col-span-3',
              },
            ] as VbenFormSchema[])
          : []),
        {
          fieldName: 'items',
          label: '销售产品清单',
          component: 'Input',
          formItemClass: 'col-span-3',
        },
        ...(formType !== 'detail'
          ? ([
              {
                fieldName: 'discountPercent',
                label: '优惠率(%)',
                component: 'Input',
                componentProps: {
                  placeholder: '请输入优惠率',
                },
                rules: createOptionalNumberRule('优惠率', { min: 0, max: 100 }),
              },
              {
                fieldName: 'discountPrice',
                label: '付款优惠',
                component: 'Input',
                componentProps: {
                  placeholder: '收款优惠',
                  disabled: true,
                },
                rules: createOptionalNumberRule('付款优惠'),
              },
              {
                fieldName: 'feeAmount',
                label: '费用',
                component: 'Input',
                componentProps: {
                  placeholder: '请输入费用',
                },
                rules: createOptionalNumberRule('费用', { min: 0 }),
              },
              {
                fieldName: 'totalPrice',
                label: '优惠后金额',
                component: 'Input',
                componentProps: {
                  placeholder: '优惠后金额',
                  disabled: true,
                },
                rules: createOptionalNumberRule('优惠后金额'),
              },
              {
                fieldName: 'accountId',
                label: '结算账户',
                component: 'ApiSelect',
                componentProps: {
                  placeholder: '请选择结算账户',
                  allowClear: true,
                  showSearch: true,
                  api: getAccountSimpleList,
                  labelField: 'name',
                  valueField: 'id',
                },
              },
              {
                fieldName: 'depositPrice',
                label: '收取订金',
                component: 'Input',
                componentProps: {
                  placeholder: '请输入收取订金',
                },
                rules: createOptionalNumberRule('收取订金', { min: 0 }),
              },
            ] as VbenFormSchema[])
          : []),
      ],
      hiddenFields,
    ),
  );
}

/** 表单的明细表格列 */
export function useFormItemColumns(
  disabled: boolean,
  hiddenFields: string[] = [],
  options: PrepareSaleDocumentItemColumnOptions = {},
): VxeTableGridOptions['columns'] {
  const columns = applySaleItemColumnPermission(
    [
      { type: 'seq', title: '序号', minWidth: 50, fixed: 'left' },
      {
        field: 'productId',
        title: '产品名称',
        minWidth: 200,
        slots: { default: 'productId' },
      },
      {
        field: 'warehouseId',
        title: '仓库',
        minWidth: 150,
        slots: { default: 'warehouseId' },
      },
      {
        field: 'deptId',
        title: '所属部门',
        minWidth: 160,
        slots: { default: 'deptId' },
      },
      {
        field: 'batchNo',
        title: '批次号',
        minWidth: 120,
        slots: { default: 'batchNo' },
      },
      {
        field: 'stockCount',
        title: '库存',
        minWidth: 80,
        formatter: 'formatAmount3',
      },
      {
        field: 'productBarCode',
        title: '条码',
        minWidth: 120,
      },
      {
        field: 'productUnitName',
        title: '单位',
        minWidth: 80,
      },
      {
        field: 'weight',
        title: '重量',
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
        field: 'giftFlag',
        title: '赠品',
        minWidth: 80,
        slots: { default: 'giftFlag' },
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 150,
        slots: { default: 'remark' },
      },
      {
        field: 'count',
        title: '数量',
        minWidth: 120,
        fixed: 'right',
        slots: { default: 'count' },
      },
      {
        field: 'productPrice',
        title: '产品单价',
        minWidth: 120,
        fixed: 'right',
        slots: { default: 'productPrice' },
      },
      {
        field: 'salePrice',
        title: '售价',
        minWidth: 110,
        fixed: 'right',
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'salePrice')
            ? () => '****'
            : 'formatAmount2',
      },
      {
        field: 'lastSalePrice',
        title: '最后一次销售价',
        minWidth: 140,
        fixed: 'right',
        formatter: 'formatAmount2',
      },
      {
        field: 'totalProductPrice',
        title: '金额',
        minWidth: 120,
        fixed: 'right',
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'totalProductPrice')
            ? () => '****'
            : 'formatAmount2',
      },
      {
        field: 'saleCostPrice',
        title: '销售成本',
        minWidth: 120,
        fixed: 'right',
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'saleCostPrice')
            ? () => '****'
            : 'formatAmount2',
      },
      {
        field: 'saleCostAmount',
        title: '成本金额',
        minWidth: 120,
        fixed: 'right',
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'saleCostAmount')
            ? () => '****'
            : 'formatAmount2',
      },
      {
        field: 'taxPercent',
        title: '税率(%)',
        minWidth: 105,
        fixed: 'right',
        slots: { default: 'taxPercent' },
      },
      {
        field: 'taxPrice',
        title: '税额',
        minWidth: 120,
        fixed: 'right',
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'taxPrice')
            ? () => '****'
            : 'formatAmount2',
      },
      {
        field: 'totalPrice',
        title: '含税合计',
        minWidth: 120,
        fixed: 'right',
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'totalPrice')
            ? () => '****'
            : 'formatAmount2',
      },
      {
        field: 'actions',
        title: '操作',
        width: 78,
        fixed: 'right',
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

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return withEnterBlurInputSchemas([
    {
      fieldName: 'no',
      label: '订单单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入订单单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'productKeyword',
      label: '产品',
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
        allowClear: true,
      },
    },
    {
      fieldName: 'orderTime',
      label: '订单时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'supplierId',
      label: '客户',
      component: 'CustomerLazySelect',
      componentProps: getCustomerSelectProps(),
    },
    {
      fieldName: 'deptId',
      label: '\u6240\u5c5e\u90e8\u95e8',
      component: 'ErpLazyPageSelect',
      componentProps: {
        popupClassName: 'sale-order-search-select-dropdown',
        placeholder: '\u8bf7\u9009\u62e9\u6240\u5c5e\u90e8\u95e8',
        allowClear: true,
        showSearch: true,
        pageSize: 10,
        api: getSaleOrderDeptSimplePage,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'orderType',
      label: '订单类型',
      component: 'Select',
      componentProps: {
        placeholder: '请选择订单类型',
        allowClear: true,
        options: [
          { label: '正式单', value: 1 },
          { label: '报价单', value: 2 },
        ],
      },
    },
    {
      fieldName: 'creator',
      label: '创建人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        popupClassName: 'sale-order-search-select-dropdown',
        placeholder: '请选择创建人',
        allowClear: true,
        showSearch: true,
        pageSize: 10,
        api: getSaleOrderUserSimplePage,
        labelField: 'nickname',
        valueField: 'id',
        loadErrorMessage: '创建人列表加载失败，请重试',
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
    {
      fieldName: 'outStatus',
      label: '出库状态',
      component: 'Select',
      componentProps: {
        options: [
          { label: '未出库', value: 0 },
          { label: '部分出库', value: 1 },
          { label: '全部出库', value: 2 },
        ],
        placeholder: '请选择出库状态',
        allowClear: true,
      },
    },
    {
      fieldName: 'returnStatus',
      label: '退货状态',
      component: 'Select',
      componentProps: {
        options: [
          { label: '未退货', value: 0 },
          { label: '部分退货', value: 1 },
          { label: '全部退货', value: 2 },
        ],
        placeholder: '请选择退货状态',
        allowClear: true,
      },
    },
  ]);
}

/** 列表的字段 */
export function useGridColumns(
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    {
      type: 'checkbox',
      width: 50,
      fixed: 'left',
    },
    {
      field: 'no',
      title: '订单单号',
      width: 200,
      fixed: 'left',
      slots: { default: 'no' },
      sortable: true,
    },
    {
      field: 'printAction',
      title: '打印',
      width: 70,
      fixed: 'left',
      slots: { default: 'printAction' },
    },
    {
      field: 'orderType',
      title: '订单类型',
      minWidth: 100,
      sortable: true,
      formatter: ({ cellValue }) => {
        const map: Record<number, string> = { 1: '正式单', 2: '报价单' };
        return map[cellValue] || '';
      },
    },
    {
      field: 'productNames',
      title: '产品信息',
      showOverflow: 'tooltip',
      minWidth: 120,
    },
    {
      field: 'customerName',
      title: '客户',
      minWidth: 120,
      sortable: true,
    },
    {
      field: 'orderTime',
      title: '订单时间',
      width: 160,
      formatter: 'formatDate',
      sortable: true,
    },
    {
      field: 'creatorName',
      title: '创建人',
      minWidth: 120,
      sortable: true,
    },
    {
      field: 'totalCount',
      title: '总数量',
      formatter: 'formatAmount3',
      minWidth: 120,
      sortable: true,
    },
    {
      field: 'outCount',
      title: '出库数量',
      formatter: 'formatAmount3',
      minWidth: 120,
      sortable: true,
    },
    {
      field: 'returnCount',
      title: '退货数量',
      formatter: 'formatAmount3',
      minWidth: 120,
      sortable: true,
    },
    {
      field: 'totalProductPrice',
      title: '金额合计',
      formatter: 'formatAmount2',
      minWidth: 120,
      sortable: true,
    },
    {
      field: 'totalPrice',
      title: '含税金额',
      formatter: 'formatAmount2',
      minWidth: 120,
      sortable: true,
    },
    {
      field: 'depositPrice',
      title: '收取订金',
      formatter: 'formatAmount2',
      minWidth: 120,
      sortable: true,
    },
    {
      field: 'status',
      title: '状态',
      minWidth: 120,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.ERP_AUDIT_STATUS },
      },
      sortable: true,
    },
    {
      field: 'actions',
      title: '操作',
      width: 160,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareSaleDocumentListColumns(columns, rows, {
    trailingFlexibleColumnMinWidth: 90,
  });
}
