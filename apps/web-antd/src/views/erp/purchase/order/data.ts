import { withPurchaseDecimalSchemas } from '#/views/erp/purchase/utils/decimal-form';
import { withPurchaseCandidateFocus } from '#/views/erp/purchase/utils/candidate-focus';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';

import {
  getPurchaseOrderDeptSimplePage,
  getPurchaseOrderSupplierDeptSimplePage,
  getPurchaseOrderUserSimplePage,
  PURCHASE_ORDER_STATUS,
} from '#/api/erp/purchase/order';
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

const MASKED_PRICE_ITEM_FIELDS = new Set([
  'backupPrice1',
  'grossProfitRate',
  'lastPurchasePrice',
  'lastSalePrice',
  'minPrice',
  'productPrice',
  'productPurchasePrice',
  'referencePrice',
  'retailPrice',
  'salePrice',
  'sharePrice',
  'totalProductPrice',
  'wholesalePrice',
]);

const MASKED_PRICE_HIDDEN_FIELDS = new Set(
  [...MASKED_PRICE_ITEM_FIELDS].map((field) => `item_${field}`),
);

export function isPurchaseOrderPriceItemHidden(
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

export interface PurchaseOrderActionPermissions {
  canEdit?: boolean;
  canUpdateStatus?: boolean;
}

const ACTION_COLUMN_MIN_WIDTH = 72;
const ACTION_CELL_HORIZONTAL_PADDING = 8;
const ACTION_BUTTON_HORIZONTAL_PADDING = 8;
const ACTION_ICON_WIDTH = 16;
const ACTION_ICON_LABEL_GAP = 4;
const ACTION_BUTTON_GAP = 4;

function resolvePurchaseOrderActionColumnWidth(
  rows: ErpPurchaseOrderApi.PurchaseOrder[],
  permissions: PurchaseOrderActionPermissions = {},
) {
  const { canEdit = true, canUpdateStatus = true } = permissions;
  const widths = rows.map((row) => {
    const labels: string[] = [];
    if (canEdit && row.status !== PURCHASE_ORDER_STATUS.APPROVE) {
      labels.push('编辑');
    }
    if (canUpdateStatus && row.status === PURCHASE_ORDER_STATUS.DRAFT) {
      labels.push('提交');
    }
    if (canUpdateStatus && row.status === PURCHASE_ORDER_STATUS.PROCESS) {
      labels.push('下订');
    }
    if (
      canUpdateStatus &&
      row.status === PURCHASE_ORDER_STATUS.APPROVE &&
      Number(row.inCount ?? 0) <= 0 &&
      Number(row.returnCount ?? 0) <= 0
    ) {
      labels.push('反下订');
    }
    const buttonsWidth = labels.reduce(
      (total, label) =>
        total +
        label.length * 13 +
        ACTION_ICON_WIDTH +
        ACTION_ICON_LABEL_GAP +
        ACTION_BUTTON_HORIZONTAL_PADDING,
      0,
    );
    return (
      buttonsWidth +
      Math.max(labels.length - 1, 0) * ACTION_BUTTON_GAP +
      ACTION_CELL_HORIZONTAL_PADDING
    );
  });
  return Math.max(ACTION_COLUMN_MIN_WIDTH, ...widths);
}

/** 表单的配置项 */
export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return withPurchaseDecimalSchemas(applyPurchaseFormFieldPermission(
    withPurchaseCandidateFocus([
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
        label: '创建时间',
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
        label: '供应商',
        fieldName: 'supplierId',
        component: 'SupplierLazySelect',
        componentProps: getSupplierSelectProps(formType === 'detail'),
        rules: 'required',
      },
      {
        fieldName: 'supplierPayableInfo',
        component: 'Input',
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
          api: getPurchaseOrderUserSimplePage,
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
          api: getPurchaseOrderSupplierDeptSimplePage,
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
        fieldName: 'factoryOrderNo',
        label: '厂家单号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入厂家单号',
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
        fieldName: 'items',
        label: '采购产品清单',
        component: 'Input',
        formItemClass: 'col-span-3',
      },
    ]),
    hiddenFields,
  ));
}

/** 表单的明细表格列 */
export function useFormItemColumns(
  disabled: boolean,
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  return applyPurchaseItemColumnPermission(
    [
      { type: 'seq', title: '序号', width: 44, fixed: 'left' },
      {
        field: 'inStatus',
        title: '入库状态',
        width: 68,
        fixed: 'left',
        slots: { default: 'inStatus' },
        sortable: true,
      },
      {
        field: 'gift',
        title: '赠品',
        width: 52,
        fixed: 'left',
        slots: { default: 'gift' },
        sortable: true,
      },
      {
        field: 'productCode',
        title: '编码',
        width: 82,
        sortable: true,
      },
      {
        field: 'warehouseId',
        title: '所属仓库',
        width: 88,
        slots: { default: 'warehouseId' },
        sortable: true,
      },
      {
        field: 'deptId',
        title: '所属部门',
        width: 88,
        slots: { default: 'deptId' },
        sortable: true,
      },
      {
        field: 'productId',
        title: '零件名称',
        width: 160,
        slots: { default: 'productId' },
        sortable: true,
      },
      {
        field: 'stockCount',
        title: '库存',
        width: 54,
        formatter: 'formatPurchaseDecimal6',
        sortable: true,
      },
      {
        field: 'count',
        title: '订货数',
        width: 62,
        slots: { default: 'count' },
        sortable: true,
      },
      {
        field: 'productPrice',
        title: '订货价',
        width: 64,
        slots: { default: 'productPrice' },
        sortable: true,
      },
      {
        field: 'lastPurchasePrice',
        title: '最后采购价',
        width: 78,
        formatter:
          disabled &&
          isPurchaseOrderPriceItemHidden(hiddenFields, 'lastPurchasePrice')
            ? () => '****'
            : 'formatPurchaseAmount6',
        sortable: true,
      },
      {
        field: 'totalProductPrice',
        title: '订货金额',
        width: 78,
        formatter:
          disabled &&
          isPurchaseOrderPriceItemHidden(hiddenFields, 'totalProductPrice')
            ? () => '****'
            : 'formatPurchaseAmount6',
        sortable: true,
      },
      {
        field: 'vehicleModel',
        title: '适用车型',
        width: 86,
        sortable: true,
      },
      {
        field: 'standard',
        title: '规格',
        width: 70,
        sortable: true,
      },
      {
        field: 'featureCode',
        title: '特征码',
        width: 72,
        sortable: true,
      },
      {
        field: 'productUnitName',
        title: '单位',
        width: 50,
        sortable: true,
      },
      {
        field: 'weight',
        title: '重量',
        width: 56,
        formatter: 'formatPurchaseDecimal6',
        sortable: true,
      },
      {
        field: 'packageQty',
        title: '包装数',
        width: 56,
        sortable: true,
      },
      {
        field: 'pieceCount',
        title: '件数',
        width: 56,
        formatter: purchaseItemPieceCountColumnFormatter,
      },
      {
        field: 'arrivalCount',
        title: '到货数',
        width: 60,
        sortable: true,
      },
      {
        field: 'warehousePosition',
        title: '货架位',
        width: 72,
        slots: { default: 'warehousePosition' },
        sortable: true,
      },
      {
        field: 'drawingNo',
        title: '图号',
        width: 66,
        slots: { default: 'drawingNo' },
        sortable: true,
      },
      {
        field: 'batchNo',
        title: '批次号',
        width: 72,
        slots: { default: 'batchNo' },
        sortable: true,
      },
      {
        field: 'factoryCode',
        title: '厂家编码',
        width: 78,
        sortable: true,
      },
      {
        field: 'brand',
        title: '品牌',
        width: 58,
        sortable: true,
      },
      {
        field: 'remark',
        title: '开单备注',
        width: 90,
        slots: { default: 'remark' },
        sortable: true,
      },
      {
        field: 'actions',
        title: '操作',
        width: 50,
        fixed: 'right',
        slots: { default: 'actions' },
        visible: !disabled,
      },
    ],
    getColumnPermissionHiddenFields(hiddenFields),
  );
}

/** 列表的搜索表单 */
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
          'purchase-order-search-select-dropdown',
        ),
      },
      {
        fieldName: 'orderTime',
        label: '单据日期',
        component: 'RangePicker',
        componentProps: {
          ...getRangePickerDefaultProps(),
          allowClear: true,
        },
      },
      {
        fieldName: 'deptId',
        label: '\u6240\u5C5E\u90E8\u95E8',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '\u8BF7\u9009\u62E9\u6240\u5C5E\u90E8\u95E8',
          allowClear: true,
          showSearch: true,
          popupClassName: 'purchase-order-search-select-dropdown',
          pageSize: 10,
          api: getPurchaseOrderDeptSimplePage,
          labelField: 'name',
          valueField: 'id',
          loadErrorMessage: '部门列表加载失败，请重试',
        },
      },
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
        fieldName: 'purchaser',
        label: '采购员',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择采购员',
          allowClear: true,
          showSearch: true,
          popupClassName: 'purchase-order-search-select-dropdown',
          pageSize: 10,
          api: getPurchaseOrderUserSimplePage,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '采购员列表加载失败，请重试',
        },
      },
      {
        fieldName: 'factoryOrderNo',
        label: '厂家单号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入厂家单号',
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
    hiddenFields,
  );
}

/** 列表的字段 */
export function useGridColumns(
  hiddenFields: string[] = [],
  rows: ErpPurchaseOrderApi.PurchaseOrder[] = [],
  actionPermissions: PurchaseOrderActionPermissions = {},
): VxeTableGridOptions['columns'] {
  return preparePurchaseDocumentListColumns(
    applyPurchaseGridColumnPermission(
      [
        {
          type: 'checkbox',
          width: 36,
        },
        {
          field: 'deleteAction',
          title: '删除',
          width: 40,
          slots: { default: 'deleteAction' },
        },
        {
          field: 'inAction',
          title: '入库',
          width: 40,
          slots: { default: 'inAction' },
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
          title: '单据编号',
          width: 156,
          sortable: true,
          slots: { default: 'no' },
        },
        {
          field: 'createTime',
          title: '单据日期',
          width: 160,
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
          field: 'factoryOrderNo',
          title: '厂家单号',
          width: 96,
          sortable: true,
        },
        {
          field: 'supplierName',
          title: '供应商',
          width: 128,
          sortable: true,
        },
        {
          field: 'status',
          title: '状态',
          width: 64,
          sortable: true,
          slots: { default: 'orderStatus' },
        },
        {
          field: 'inStatus',
          title: '入库说明',
          width: 72,
          sortable: true,
          slots: { default: 'fixedInStatus' },
        },
        {
          field: 'wechatNotifyAction',
          title: '微信通知',
          width: 62,
          slots: { default: 'wechatNotifyAction' },
        },
        {
          field: 'orderDate',
          title: '订货日期',
          width: 160,
          formatter: 'formatDateTime',
          sortable: true,
        },
        {
          field: 'totalCount',
          title: '订货数',
          formatter: 'formatAmount2',
          width: 64,
          sortable: true,
        },
        {
          field: 'totalProductPrice',
          title: '订货总金额',
          formatter: 'formatAmount2',
          width: 84,
          sortable: true,
        },
        {
          field: 'depositAction',
          title: '预付金额',
          width: 72,
          slots: { default: 'depositAction' },
        },
        {
          field: 'itemCount',
          title: '项数',
          width: 52,
          formatter: ({ row }: { row: any }) =>
            row.itemCount ?? row.items?.length ?? 0,
        },
        {
          field: 'remark',
          title: '备注',
          width: 120,
          showOverflow: 'tooltip',
          sortable: true,
        },
        {
          field: 'deptName',
          title: '部门',
          width: 96,
          sortable: true,
        },
        {
          field: 'creatorName',
          title: '制单人',
          width: 86,
          sortable: true,
        },
        {
          field: 'purchaserName',
          title: '采购员',
          width: 86,
          sortable: true,
        },
        {
          field: 'printTime',
          title: '打印时间',
          width: 160,
          formatter: 'formatDateTime',
        },
        {
          field: 'printFrequency',
          title: '打印次数',
          width: 72,
          slots: { default: 'printFrequency' },
        },
        {
          field: 'actions',
          title: '操作',
          width: resolvePurchaseOrderActionColumnWidth(rows, actionPermissions),
          fixed: 'right',
          slots: { default: 'actions' },
        },
      ],
      hiddenFields,
      {
        createTime: ['orderTime'],
      },
    ) ?? [],
    rows,
    { trailingFlexibleColumnMinWidth: 72 },
  );
}
