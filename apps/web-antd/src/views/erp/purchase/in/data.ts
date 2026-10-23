import { withPurchaseCandidateFocus } from '#/views/erp/purchase/utils/candidate-focus';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';

import {
  getPurchaseInDeptSimplePage,
  getPurchaseInSupplierDeptSimplePage,
  getPurchaseInUserSimplePage,
} from '#/api/erp/purchase/in';
import { isFieldHidden } from '#/composables/useFieldPermission';
import { getRangePickerDefaultProps } from '#/utils';
import { preparePurchaseDocumentListColumns } from '#/views/erp/purchase/utils/document-list-table';
import {
  applyPurchaseFormFieldPermission,
  applyPurchaseGridColumnPermission,
  applyPurchaseGridFormFieldPermission,
  applyPurchaseItemColumnPermission,
} from '#/views/erp/purchase/utils/field-permission';
import { purchaseItemPieceCountColumnFormatter } from '#/views/erp/purchase/utils/item-piece-count';
import { getSupplierSelectProps } from '#/views/erp/purchase/utils/supplier-select';
import { createOptionalNumberRule } from '#/views/erp/purchase/utils/text-number';

const MASKED_PRICE_ITEM_FIELDS = new Set([
  'backupPrice1',
  'grossProfitRate',
  'lastPurchasePrice',
  'lastSalePrice',
  'minPrice',
  'productCostAmount',
  'productCostPrice',
  'productPrice',
  'productPurchasePrice',
  'referencePrice',
  'retailPrice',
  'salePrice',
  'sharePrice',
  'totalPrice',
  'totalProductPrice',
  'wholesalePrice',
]);

export const PURCHASE_IN_FREIGHT_TYPE_OPTIONS = [
  { label: '代厂家付', value: '代厂家付' },
  { label: '我方自付', value: '我方自付' },
];

const MASKED_PRICE_HIDDEN_FIELDS = new Set(
  [...MASKED_PRICE_ITEM_FIELDS].map((field) => `item_${field}`),
);

export function isPurchaseInPriceItemHidden(
  hiddenFields: string[] = [],
  field: string,
) {
  return (
    MASKED_PRICE_ITEM_FIELDS.has(field) &&
    isFieldHidden(hiddenFields, `item_${field}`)
  );
}

function shouldRetainMaskedPriceField(field: string) {
  const normalized = field.startsWith('col_') ? field.slice(4) : field;
  return MASKED_PRICE_HIDDEN_FIELDS.has(normalized);
}

function getColumnPermissionHiddenFields(hiddenFields: string[] = []) {
  return hiddenFields.filter((field) => !shouldRetainMaskedPriceField(field));
}

export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyPurchaseFormFieldPermission(
    withPurchaseCandidateFocus([
      {
        fieldName: 'id',
        component: 'Input',
        dependencies: { triggerFields: [''], show: () => false },
      },
      {
        fieldName: 'no',
        label: '入库单号',
        component: 'Input',
        componentProps: { placeholder: '系统自动生成', disabled: true },
      },
      {
        fieldName: 'inTime',
        label: '入库时间',
        component: 'DatePicker',
        componentProps: {
          disabled: true,
          placeholder: '系统自动生成',
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
          valueFormat: 'x',
        },
      },
      {
        fieldName: 'supplierId',
        label: '供应商',
        component: 'SupplierLazySelect',
        componentProps: getSupplierSelectProps(formType === 'detail'),
        rules: 'required',
      },
      {
        fieldName: 'orderNo',
        label: '关联订单',
        component: 'Input',
        componentProps: {
          placeholder: '请选择关联订单',
          disabled: formType === 'detail',
          class: 'w-full',
        },
      },
      {
        fieldName: 'factoryOrderNo',
        label: '厂家单号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入厂家单号',
          disabled: formType === 'detail',
        },
      },
      {
        fieldName: 'freightType1',
        label: '运费类型',
        component: 'Select',
        componentProps: {
          allowClear: true,
          disabled: formType === 'detail',
          options: PURCHASE_IN_FREIGHT_TYPE_OPTIONS,
          placeholder: '请选择运费类型',
        },
      },
      {
        fieldName: 'totalFreight1',
        label: '运费',
        component: 'Input',
        formFieldProps: {
          validateOnBlur: true,
        },
        componentProps: {
          disabled: formType === 'detail',
          placeholder: '0.00',
        },
        rules: createOptionalNumberRule('运费', { min: 0 }),
      },
      {
        fieldName: 'supplierPayableInfo',
        component: 'Input',
        formItemClass: 'col-span-3',
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
      {
        fieldName: 'fileUrl',
        label: '附件',
        component: 'FileUpload',
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
          showDescription: formType !== 'detail',
          disabled: formType === 'detail',
        },
        formItemClass: 'col-span-3',
      },
      {
        fieldName: 'purchaser',
        label: '采购员',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择采购员',
          allowClear: true,
          showSearch: true,
          api: getPurchaseInUserSimplePage,
          pageSize: 10,
          labelField: 'nickname',
          valueField: 'id',
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
          api: getPurchaseInSupplierDeptSimplePage,
          pageSize: 10,
          params: {},
          shouldFetch: (params: { supplierId?: number | string }) =>
            Boolean(params?.supplierId),
          labelField: 'name',
          valueField: 'id',
          disabled: formType === 'detail',
        },
      },
      {
        fieldName: 'handler',
        label: '经办人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择经办人',
          allowClear: true,
          showSearch: true,
          api: getPurchaseInUserSimplePage,
          pageSize: 10,
          labelField: 'nickname',
          valueField: 'id',
          disabled: formType === 'detail',
        },
      },
      {
        fieldName: 'items',
        label: '入库产品清单',
        component: 'Input',
        formItemClass: 'col-span-3',
      },
    ]),
    hiddenFields,
  );
}

export function useFormItemColumns(
  formData?: any[],
  disabled?: boolean,
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  return applyPurchaseItemColumnPermission(
    [
      { type: 'seq', title: '序号', minWidth: 50 },
      {
        field: 'warehouseId',
        title: '仓库名称',
        minWidth: 200,
        slots: { default: 'warehouseId' },
      },
      {
        field: 'deptId',
        title: '所属部门',
        minWidth: 160,
        slots: { default: 'deptId' },
      },
      {
        field: 'gift',
        title: '是否赠品',
        minWidth: 90,
        slots: { default: 'gift' },
      },
      { field: 'productCode', title: '产品编码', minWidth: 120 },
      {
        field: 'productId',
        title: '产品名称',
        minWidth: 200,
        slots: { default: 'productId' },
      },
      {
        field: 'count',
        title: '数量',
        minWidth: 120,
        slots: { default: 'count' },
      },
      {
        field: 'productPrice',
        title: '产品单价',
        minWidth: 120,
        slots: { default: 'productPrice' },
      },
      {
        field: 'lastPurchasePrice',
        title: '最后采购价',
        minWidth: 120,
        formatter:
          disabled &&
          isPurchaseInPriceItemHidden(hiddenFields, 'lastPurchasePrice')
            ? () => '****'
            : 'formatPurchaseDecimal6',
      },
      {
        field: 'totalProductPrice',
        title: '产品金额',
        minWidth: 120,
        formatter:
          disabled &&
          isPurchaseInPriceItemHidden(hiddenFields, 'totalProductPrice')
            ? () => '****'
            : 'formatPurchaseDecimal6',
      },
      {
        field: 'productCostPrice',
        title: '产品成本',
        minWidth: 120,
        formatter:
          disabled &&
          isPurchaseInPriceItemHidden(hiddenFields, 'productCostPrice')
            ? () => '****'
            : 'formatPurchaseDecimal6',
      },
      {
        field: 'productCostAmount',
        title: '成本金额',
        minWidth: 120,
        formatter:
          disabled &&
          isPurchaseInPriceItemHidden(hiddenFields, 'productCostAmount')
            ? () => '****'
            : 'formatPurchaseDecimal6',
      },
      {
        field: 'adjustStatus',
        title: '调价情况',
        minWidth: 100,
        slots: { default: 'adjustStatus' },
        visible: !!formData?.some(
          (item: any) =>
            item.adjusted !== undefined ||
            item.originalProductPrice !== undefined,
        ),
      },
      {
        field: 'invoiceStatus',
        title: '开票情况',
        minWidth: 100,
        slots: { default: 'invoiceStatus' },
        visible: !!formData?.some((item: any) => item.hasInvoice !== undefined),
      },
      {
        field: 'returnStatus',
        title: '退货情况',
        minWidth: 100,
        slots: { default: 'returnStatus' },
        visible: !!formData?.some(
          (item: any) =>
            item.returnStatus !== undefined || item.returnCount !== undefined,
        ),
      },
      {
        field: 'returnCount',
        title: '已退货数量',
        formatter: 'formatPurchaseDecimal6',
        minWidth: 120,
        visible: !!formData?.some(
          (item: any) => item.returnCount !== undefined,
        ),
      },
      {
        field: 'stockCount',
        title: '库存',
        minWidth: 80,
        formatter: 'formatPurchaseDecimal6',
      },
      { field: 'productBarCode', title: '条码', minWidth: 120 },
      { field: 'productUnitName', title: '单位', minWidth: 80 },
      {
        field: 'packageQty',
        title: '包装数',
        formatter: 'formatPurchaseDecimal6',
        minWidth: 80,
      },
      {
        field: 'pieceCount',
        title: '件数',
        formatter: purchaseItemPieceCountColumnFormatter,
        minWidth: 80,
      },
      {
        field: 'wholeQty',
        title: '整件数',
        minWidth: 90,
        slots: { default: 'wholeQty' },
      },
      {
        field: 'warehousePosition',
        title: '货架位',
        minWidth: 120,
        slots: { default: 'warehousePosition' },
      },
      {
        field: 'barCode',
        title: '条形码',
        minWidth: 140,
        slots: { default: 'barCode' },
      },
      {
        field: 'batchNo',
        title: '批次',
        minWidth: 100,
        slots: { default: 'batchNo' },
      },
      {
        field: 'drawingNo',
        title: '图号',
        minWidth: 100,
        slots: { default: 'drawingNo' },
      },
      { field: 'brand', title: '品牌', minWidth: 100 },
      { field: 'vehicleModel', title: '适用车型', minWidth: 120 },
      { field: 'originPlace', title: '产地', minWidth: 100 },
      {
        field: 'totalCount',
        title: '原数量',
        formatter: 'formatPurchaseDecimal6',
        minWidth: 120,
        visible: formData && formData[0]?.inCount !== undefined,
      },
      {
        field: 'inCount',
        title: '已入库',
        formatter: 'formatPurchaseDecimal6',
        minWidth: 120,
        visible: formData && formData[0]?.returnCount !== undefined,
      },
      {
        field: 'taxPercent',
        title: '税率(%)',
        minWidth: 105,
        slots: { default: 'taxPercent' },
      },
      {
        field: 'taxPrice',
        title: '税额',
        minWidth: 120,
        formatter: 'formatPurchaseDecimal6',
      },
      {
        field: 'totalPrice',
        title: '合计金额',
        minWidth: 120,
        formatter:
          disabled && isPurchaseInPriceItemHidden(hiddenFields, 'totalPrice')
            ? () => '****'
            : 'formatPurchaseDecimal6',
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 150,
        slots: { default: 'remark' },
      },
      {
        field: 'actions',
        title: '操作',
        width: 76,
        fixed: 'right',
        slots: { default: 'actions' },
        visible: !disabled,
      },
    ],
    getColumnPermissionHiddenFields(hiddenFields),
  );
}

export function useStockInDetailItemColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  return applyPurchaseItemColumnPermission(
    [
      { type: 'seq', title: '序号', minWidth: 50 },
      { field: 'productName', title: '产品名称', minWidth: 180 },
      { field: 'productCode', title: '产品编码', minWidth: 120 },
      { field: 'warehouseName', title: '仓库名称', minWidth: 140 },
      {
        field: 'count',
        title: '入库数量',
        minWidth: 110,
        formatter: 'formatPurchaseDecimal6',
      },
      {
        field: 'stockInBillNos',
        title: '历史入仓单号',
        minWidth: 180,
        showOverflow: 'tooltip',
      },
      {
        field: 'stockInBillStatusName',
        title: '历史入仓状态',
        minWidth: 110,
        slots: { default: 'stockInBillStatus' },
      },
      {
        field: 'stockInBillCount',
        title: '历史入仓数量',
        minWidth: 110,
        formatter: 'formatPurchaseDecimal6',
      },
      {
        field: 'stockInBillPickedCount',
        title: '历史已提数量',
        minWidth: 100,
        formatter: 'formatPurchaseDecimal6',
      },
      {
        field: 'stockInBillRemainCount',
        title: '历史未提数量（待核对）',
        minWidth: 100,
        formatter: 'formatPurchaseDecimal6',
      },
    ],
    hiddenFields,
  );
}

export function useGridFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyPurchaseGridFormFieldPermission(
    withPurchaseCandidateFocus([
      {
        fieldName: 'supplierId',
        label: '供应商',
        component: 'SupplierLazySelect',
        componentProps: getSupplierSelectProps(
          false,
          'purchase-in-search-select-dropdown',
        ),
      },
      {
        fieldName: 'inTime',
        label: '单据时间',
        component: 'RangePicker',
        componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          popupClassName: 'purchase-in-search-select-dropdown',
          pageSize: 10,
          api: getPurchaseInDeptSimplePage,
          labelField: 'name',
          valueField: 'id',
          loadErrorMessage: '部门列表加载失败，请重试',
        },
      },
      {
        fieldName: 'no',
        label: '入库单号',
        component: 'Input',
        componentProps: { placeholder: '请输入入库单号', allowClear: true },
      },
      {
        fieldName: 'factoryOrderNo',
        label: '厂家单号',
        component: 'Input',
        componentProps: { placeholder: '请输入厂家单号', allowClear: true },
      },
      {
        fieldName: 'purchaser',
        label: '采购员',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择采购员',
          allowClear: true,
          showSearch: true,
          popupClassName: 'purchase-in-search-select-dropdown',
          pageSize: 10,
          api: getPurchaseInUserSimplePage,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '采购员列表加载失败，请重试',
        },
      },
      {
        fieldName: 'handler',
        label: '经手人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择经手人',
          allowClear: true,
          showSearch: true,
          popupClassName: 'purchase-in-search-select-dropdown',
          pageSize: 10,
          api: getPurchaseInUserSimplePage,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '经手人列表加载失败，请重试',
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
    hiddenFields,
  );
}

export function useGridColumns(
  hiddenFields: string[] = [],
  rows: ErpPurchaseInApi.PurchaseIn[] = [],
): VxeTableGridOptions['columns'] {
  return applyPurchaseGridColumnPermission(
    preparePurchaseDocumentListColumns(
      [
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
          field: 'exportAction',
          title: '导出',
          width: 40,
          slots: { default: 'exportAction' },
        },
        {
          field: 'no',
          title: '入库单号',
          width: 128,
          sortable: true,
          slots: { default: 'no' },
        },
        {
          field: 'invoiceStatus',
          title: '开票状态',
          width: 76,
          slots: { default: 'invoiceStatus' },
        },
        {
          field: 'adjustStatus',
          title: '调价状态',
          width: 76,
          slots: { default: 'adjustStatus' },
        },
        {
          field: 'returnStatus',
          title: '退货状态',
          width: 76,
          slots: { default: 'returnStatus' },
        },
        {
          field: 'transferOutStatus',
          title: '调拨状态',
          width: 76,
          slots: { default: 'transferOutStatus' },
        },
        {
          field: 'paymentStatus',
          title: '结算状态',
          width: 72,
          sortable: true,
          slots: { default: 'settlementStatus' },
        },
        {
          field: 'factoryOrderNo',
          title: '厂家单号',
          width: 100,
          sortable: true,
          showOverflow: 'tooltip',
        },
        {
          field: 'createTime',
          title: '开单日期',
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
          field: 'status',
          title: '状态',
          width: 60,
          sortable: true,
          slots: { default: 'status' },
        },
        {
          field: 'supplierName',
          title: '供应商',
          width: 112,
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
          title: '折后金额',
          width: 84,
          formatter: 'formatAmount2',
          sortable: true,
        },
        {
          field: 'freightType1',
          title: '运费类型',
          width: 84,
          sortable: true,
          showOverflow: 'tooltip',
        },
        {
          field: 'totalFreight1',
          title: '运费',
          width: 72,
          formatter: 'formatAmount2',
          sortable: true,
        },
        {
          field: 'itemCount',
          title: '项数',
          width: 52,
          sortable: true,
          formatter: ({ row }) => row.itemCount ?? row.items?.length ?? 0,
        },
        {
          field: 'totalCount',
          title: '总数量',
          width: 64,
          sortable: true,
          formatter: 'formatAmount2',
        },
        {
          field: 'creatorName',
          title: '制单人',
          width: 72,
          sortable: true,
          showOverflow: 'tooltip',
        },
        {
          field: 'purchaserName',
          title: '采购员',
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
          field: 'orderNo',
          title: '来源',
          width: 120,
          sortable: true,
          showOverflow: 'tooltip',
        },
        {
          field: 'remark',
          title: '备注',
          width: 120,
          sortable: true,
          showOverflow: 'tooltip',
        },
        {
          field: 'actions',
          title: '操作',
          width: 128,
          fixed: 'right',
          slots: { default: 'actions' },
        },
      ],
      rows,
    ),
    hiddenFields,
    {
      createTime: ['inTime'],
      itemCount: ['items'],
    },
  );
}

export function useOrderGridFormSchema(
  options: { supplierLocked?: boolean } = {},
): VbenFormSchema[] {
  return withPurchaseCandidateFocus([
    {
      fieldName: 'no',
      label: '订单号',
      component: 'Input',
      componentProps: { placeholder: '请输入订单号', allowClear: true },
    },
    {
      fieldName: 'supplierId',
      label: '供应商',
      component: 'SupplierLazySelect',
      componentProps: getSupplierSelectProps(options.supplierLocked),
    },
  ]);
}

export function useOrderGridColumns(): VxeTableGridOptions['columns'] {
  return [
    { type: 'radio', width: 50, fixed: 'left' },
    { field: 'no', title: '订单号', width: 200, fixed: 'left' },
    {
      field: 'productNames',
      title: '产品信息',
      showOverflow: 'tooltip',
      minWidth: 120,
    },
    { field: 'supplierName', title: '供应商', minWidth: 120 },
    {
      field: 'orderTime',
      title: '订单时间',
      width: 160,
      formatter: 'formatDate',
    },
    { field: 'creatorName', title: '创建人', minWidth: 120 },
    {
      field: 'totalCount',
      title: '总数量',
      formatter: 'formatPurchaseDecimal6',
      minWidth: 120,
    },
    {
      field: 'inCount',
      title: '入库数量',
      formatter: 'formatPurchaseDecimal6',
      minWidth: 120,
    },
    {
      field: 'totalProductPrice',
      title: '金额合计',
      formatter: 'formatPurchaseDecimal6',
      minWidth: 120,
    },
    {
      field: 'totalPrice',
      title: '金额',
      formatter: 'formatPurchaseDecimal6',
      minWidth: 120,
    },
  ];
}
