import { withSaleDecimalSchemas } from '#/views/erp/sale/utils/decimal-form';
import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PrepareSaleDocumentItemColumnOptions } from '#/views/erp/sale/utils/document-item-table';

import { z } from '#/adapter/form';
import { getBaseDataSimpleList } from '#/api/erp/base';
import { getAccountSimpleList } from '#/api/erp/finance/account';
import {
  getSaleCartCustomerDeptSimplePage,
  getSaleCartDeptSimplePage,
  getSaleCartUserSimplePage,
} from '#/api/erp/sale/cart';
import { isFieldHidden } from '#/composables/useFieldPermission';
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
import {
  createOptionalNumberRule,
  parseOptionalNumber,
} from '#/views/erp/sale/utils/text-number';

const cartStatusOptions = [
  { label: '草稿', value: 10 },
  { label: '待开单确认', value: 15 },
  { label: '待初审', value: 20 },
  { label: '待终审', value: 30 },
  { label: '终审通过', value: 40 },
  { label: '已生成销售单', value: 50 },
  { label: '已转报价', value: 60 },
  { label: '已取消', value: 90 },
];

const FREIGHT_TYPE_CUSTOMER_ADVANCE = '代客户付';
const FREIGHT_TYPE_SELF_PAY = '我方自付';

function isFinanceFreightType(value: unknown) {
  return (
    value === FREIGHT_TYPE_CUSTOMER_ADVANCE || value === FREIGHT_TYPE_SELF_PAY
  );
}

export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
  deptOptions: any[] = [],
  customerOptions: any[] = [],
  saleUserOptions: Array<{ id: number; nickname: string }> = [],
  onCustomerOptionsChange?: (options: any[]) => void,
): VbenFormSchema[] {
  const disabled = formType === 'detail';

  return withSaleDecimalSchemas(withCandidateFocus(
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
            label: '手推车单号',
            component: 'Input',
            componentProps: {
              placeholder: '系统自动生成',
              disabled: true,
            },
          },
          {
            fieldName: 'cartTime',
            label: '开单时间',
            component: 'DatePicker',
            componentProps: {
              placeholder: '保存后系统自动生成',
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
              ...getSaleCustomerSelectProps(disabled),
              options: customerOptions,
              onOptionsChange: onCustomerOptionsChange,
              popupClassName: 'sale-cart-form-select-dropdown',
            },
            rules: 'required',
          },
          {
            fieldName: 'customerReceivableInfo',
            component: 'Input',
            formItemClass: 'col-span-3',
          },
          {
            fieldName: 'saleUserId',
            label: '销售人员',
            component: 'ErpLazyPageSelect',
            componentProps: {
              popupClassName: 'sale-cart-form-select-dropdown',
              placeholder: '请选择销售人员',
              allowClear: true,
              showSearch: true,
              api: getSaleCartUserSimplePage,
              pageSize: 10,
              options: saleUserOptions,
              labelField: 'nickname',
              valueField: 'id',
              disabled: true,
            },
          },
          {
            fieldName: 'deptId',
            label: '所属部门',
            component: 'ErpLazyPageSelect',
            componentProps: {
              popupClassName: 'sale-cart-form-select-dropdown',
              placeholder: '请选择所属部门',
              allowClear: true,
              showSearch: true,
              api: getSaleCartCustomerDeptSimplePage,
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
            fieldName: 'settleMethod',
            label: '结算方式',
            component: 'ApiSelect',
            componentProps: {
              popupClassName: 'sale-cart-form-select-dropdown',
              placeholder: '请选择结算方式',
              allowClear: true,
              showSearch: true,
              api: () => getBaseDataSimpleList('settle_method'),
              labelField: 'name',
              valueField: 'name',
              disabled,
            },
            dependencies: {
              triggerFields: ['freightType'],
              rules: (values) =>
                values.freightType === FREIGHT_TYPE_SELF_PAY
                  ? z.string().trim().min(1, '我方自付时请选择结算方式')
                  : z.string().optional().nullable(),
            },
          },
          {
            fieldName: 'accountId',
            label: '结算账户',
            component: 'ApiSelect',
            componentProps: {
              popupClassName: 'sale-cart-form-select-dropdown',
              placeholder: '请选择结算账户',
              allowClear: true,
              showSearch: true,
              api: getAccountSimpleList,
              labelField: 'name',
              valueField: 'id',
              disabled,
            },
            dependencies: {
              triggerFields: ['freightType'],
              rules: (values) =>
                values.freightType === FREIGHT_TYPE_SELF_PAY
                  ? z.number({ message: '我方自付时请选择结算账户' })
                  : z.number().optional().nullable(),
            },
          },
          {
            fieldName: 'freightType',
            label: '运费类型',
            component: 'Select',
            componentProps: {
              popupClassName: 'sale-cart-form-select-dropdown',
              placeholder: '请选择',
              options: [
                { label: '送货', value: '送货' },
                { label: '自提', value: '自提' },
                { label: '代收', value: '代收' },
                {
                  label: FREIGHT_TYPE_CUSTOMER_ADVANCE,
                  value: FREIGHT_TYPE_CUSTOMER_ADVANCE,
                },
                {
                  label: FREIGHT_TYPE_SELF_PAY,
                  value: FREIGHT_TYPE_SELF_PAY,
                },
              ],
              disabled,
            },
          },
          {
            fieldName: 'feeAmount',
            label: '费用',
            component: 'Input',
            componentProps: {
              placeholder: '请输入费用',
              disabled,
            },
            dependencies: {
              triggerFields: ['freightType'],
              rules: (values) =>
                createOptionalNumberRule('费用', { min: 0 }).superRefine(
                  (value, ctx) => {
                    const amount = parseOptionalNumber(value);
                    if (
                      isFinanceFreightType(values.freightType) &&
                      (amount === undefined || amount <= 0)
                    ) {
                      ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '代客户付或我方自付时，费用必须大于 0',
                      });
                    }
                  },
                ),
            },
          },
          {
            fieldName: 'deliveryMethod',
            label: '送货方式',
            component: 'ApiSelect',
            componentProps: {
              popupClassName: 'sale-cart-form-select-dropdown',
              placeholder: '请选择送货方式',
              allowClear: true,
              showSearch: true,
              api: () => getBaseDataSimpleList('delivery_method'),
              labelField: 'name',
              valueField: 'name',
              disabled,
            },
          },
          {
            fieldName: 'logisticsCompany',
            label: '物流公司',
            component: 'ApiSelect',
            componentProps: {
              popupClassName: 'sale-cart-form-select-dropdown',
              placeholder: '请选择',
              allowClear: true,
              showSearch: true,
              api: () => getBaseDataSimpleList('logistics_company'),
              labelField: 'name',
              valueField: 'name',
              disabled,
            },
          },
          {
            fieldName: 'vin',
            label: 'VIN码',
            component: 'Input',
            componentProps: {
              placeholder: '请输入VIN码',
              disabled,
            },
          },
          {
            fieldName: 'contactPerson',
            label: '联系人',
            component: 'Input',
            componentProps: {
              placeholder: '请输入联系人',
              disabled,
            },
          },
          {
            fieldName: 'contactPhone',
            label: '联系电话',
            component: 'Input',
            componentProps: {
              placeholder: '请输入联系电话',
              disabled,
            },
          },
          {
            fieldName: 'deliveryAddress',
            label: '运费地址',
            component: 'Input',
            componentProps: {
              placeholder: '请输入运费地址',
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
            label: '手推车产品清单',
            component: 'Input',
            formItemClass: 'col-span-3',
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
  ));
}

export function useFormItemColumns(
  disabled: boolean,
  hiddenFields: string[] = [],
  compact = false,
  options: PrepareSaleDocumentItemColumnOptions = {},
): VxeTableGridOptions['columns'] {
  const columnWidth = (minWidth: number) => ({ minWidth });
  const itemColumnHiddenFields = disabled
    ? getSaleDetailColumnPermissionHiddenFields(hiddenFields)
    : hiddenFields.filter(
        (field) => !isFieldHidden([field], 'item_productPrice'),
      );
  const columns = applySaleItemColumnPermission(
    [
      { type: 'seq', title: '序号', width: 50 },
      {
        field: 'productId',
        title: '产品名称',
        sortable: true,
        ...columnWidth(220),
        slots: { default: 'productId' },
      },
      {
        field: 'productCode',
        title: '产品编号',
        sortable: true,
        ...columnWidth(130),
      },
      {
        field: 'warehouseId',
        title: '仓库',
        sortable: true,
        ...columnWidth(200),
        slots: { default: 'warehouseId' },
      },
      {
        field: 'deptId',
        title: '销售部门',
        sortable: true,
        minWidth: 160,
        slots: { default: 'deptId' },
      },
      {
        field: 'count',
        title: '数量',
        sortable: true,
        ...columnWidth(120),
        slots: { default: 'count' },
      },
      {
        field: 'productPrice',
        title: '单价',
        sortable: true,
        ...columnWidth(120),
        slots: { default: 'productPrice' },
      },
      {
        field: 'lastSalePrice',
        title: '最后一次销售价',
        sortable: true,
        ...columnWidth(140),
        formatter: 'formatSaleAmount6',
      },
      {
        field: 'totalPrice',
        title: '金额',
        sortable: true,
        ...columnWidth(120),
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'totalPrice')
            ? () => '****'
            : 'formatSaleAmount6',
      },
      {
        field: 'giftFlag',
        title: compact ? '赠品' : '是否为赠品',
        sortable: true,
        ...columnWidth(100),
        slots: { default: 'giftFlag' },
      },
      {
        field: 'batchNo',
        title: '批次',
        sortable: true,
        ...columnWidth(120),
        slots: { default: 'batchNo' },
      },
      {
        field: 'brand',
        title: '品牌',
        sortable: true,
        ...columnWidth(120),
        slots: { default: 'brand' },
      },
      {
        field: 'vehicleModel',
        title: '车型',
        sortable: true,
        ...columnWidth(130),
        slots: { default: 'vehicleModel' },
      },
      {
        field: 'standard',
        title: '规格',
        sortable: true,
        ...columnWidth(120),
        slots: { default: 'standard' },
      },
      {
        field: 'originPlace',
        title: '产地',
        sortable: true,
        ...columnWidth(120),
        slots: { default: 'originPlace' },
      },
      {
        field: 'productUnitName',
        title: '单位',
        sortable: true,
        ...columnWidth(80),
      },
      {
        field: 'weight',
        title: '重量',
        sortable: true,
        ...columnWidth(80),
        formatter: 'formatSaleDecimal6',
      },
      {
        field: 'packageQty',
        title: '包装数',
        sortable: true,
        ...columnWidth(90),
      },
      {
        field: 'pieceCount',
        title: '件数',
        sortable: true,
        ...columnWidth(80),
        formatter: saleItemPieceCountColumnFormatter,
      },
      {
        field: 'stockCount',
        title: '库存',
        sortable: true,
        ...columnWidth(90),
        formatter: 'formatSaleDecimal6',
      },
      {
        field: 'remark',
        title: '备注',
        sortable: true,
        ...columnWidth(150),
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
    itemColumnHiddenFields,
  );
  const visibleColumns: NonNullable<VxeTableGridOptions['columns']> = [];
  columns?.forEach((column) => {
    const field = 'field' in column ? column.field : undefined;
    if (field === 'deptId') {
      return;
    }
    visibleColumns.push(column);
    if (
      field === 'warehouseId' &&
      !isFieldHidden(hiddenFields, 'item_warehouseDeptName')
    ) {
      visibleColumns.push({
        field: 'warehouseDeptName',
        title: compact ? '部门' : '所属部门',
        sortable: true,
        ...columnWidth(140),
        slots: { default: 'warehouseDeptName' },
      });
    }
  });
  return prepareSaleDocumentItemColumns(visibleColumns, {
    compact,
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
          'sale-cart-search-select-dropdown',
        ),
      },
      {
        fieldName: 'cartTime',
        label: '单据日期',
        component: 'RangePicker',
        componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'sale-cart-search-select-dropdown',
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          pageSize: 10,
          api: getSaleCartDeptSimplePage,
          labelField: 'name',
          valueField: 'id',
          loadErrorMessage: '部门列表加载失败，请重试',
        },
      },
      {
        fieldName: 'no',
        label: '手推车单号',
        component: 'Input',
        componentProps: { placeholder: '请输入手推车单号', allowClear: true },
      },
      {
        fieldName: 'saleUserId',
        label: '业务员',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'sale-cart-search-select-dropdown',
          placeholder: '请选择业务员',
          allowClear: true,
          showSearch: true,
          pageSize: 10,
          api: getSaleCartUserSimplePage,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '业务员列表加载失败，请重试',
        },
      },
      {
        fieldName: 'contactPerson',
        label: '联系人',
        component: 'Input',
        componentProps: { placeholder: '请输入联系人', allowClear: true },
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
    { type: 'checkbox', width: 36, autoFixed: false } as any,
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
      field: 'wechatNotifyAction',
      title: '微信通知',
      width: 62,
      slots: { default: 'wechatNotifyAction' },
    },
    {
      field: 'quoteAction',
      title: '报价单',
      width: 54,
      slots: { default: 'quoteAction' },
    },
    {
      field: 'no',
      title: '手推车号',
      width: 104,
      sortable: true,
      slots: { default: 'no' },
    },
    {
      field: 'cartTime',
      title: '单据日期',
      width: 100,
      formatter: 'formatDateTime',
      sortable: true,
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
      field: 'vehiclePlateNo',
      title: '车牌号',
      width: 64,
      showOverflow: 'tooltip',
    },
    {
      field: 'vin',
      title: 'VIN码',
      width: 120,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'creatorName',
      title: '建立人',
      width: 72,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'totalProductPrice',
      title: '总金额',
      width: 72,
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'discountPrice',
      title: '折让金额',
      width: 84,
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'totalPrice',
      title: '实收金额',
      width: 84,
      formatter: 'formatAmount2',
      sortable: true,
    },
    {
      field: 'feeAmount',
      title: '费用',
      width: 60,
      formatter: 'formatAmount2',
      sortable: true,
    },
    { field: 'settleMethod', title: '付款方式', width: 84, sortable: true },
    { field: 'deliveryMethod', title: '送货方式', width: 84, sortable: true },
    {
      field: 'logisticsCompany',
      title: '物流公司',
      width: 100,
      sortable: true,
      showOverflow: 'tooltip',
    },
    { field: 'remark', title: '备注', width: 120, showOverflow: 'tooltip' },
    {
      field: 'remark2',
      title: '内部说明',
      width: 120,
      showOverflow: 'tooltip',
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
    {
      field: 'deliveryAddress',
      title: '送货地址',
      width: 140,
      showOverflow: 'tooltip',
    },
    { field: 'priority', title: '优先级', width: 72, sortable: true },
    { field: 'invoiceType', title: '开票类型', width: 80, sortable: true },
    {
      field: 'status',
      title: '状态',
      width: 210,
      sortable: true,
      slots: { default: 'status' },
      formatter: ({ cellValue }) =>
        cartStatusOptions.find((item) => item.value === cellValue)?.label ??
        cellValue ??
        '',
    },
    { field: 'customerCode', title: '客户编码', width: 100 },
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
      width: 68,
      showOverflow: 'tooltip',
    },
    {
      field: 'updateTime',
      title: '修改时间',
      width: 112,
      formatter: 'formatDateTime',
    },
    {
      field: 'emailAction',
      title: '邮件',
      width: 44,
      slots: { default: 'emailAction' },
    },
    {
      title: '操作',
      width: 130,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareSaleDocumentListColumns(columns, rows, {
    trailingFlexibleColumnMinWidth: 90,
  });
}
