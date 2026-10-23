import { withPurchaseDecimalSchemas } from '#/views/erp/purchase/utils/decimal-form';
import { withPurchaseCandidateFocus } from '#/views/erp/purchase/utils/candidate-focus';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchasePriceAdjustApi } from '#/api/erp/purchase/priceadjust';

import {
  getPurchasePriceAdjustDeptSimplePage,
  getPurchasePriceAdjustSupplierDeptSimplePage,
  getPurchasePriceAdjustUserSimplePage,
} from '#/api/erp/purchase/priceadjust';
import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';
import { getRangePickerDefaultProps } from '#/utils';
import { preparePurchaseDocumentListColumns } from '#/views/erp/purchase/utils/document-list-table';
import {
  applyPurchaseGridColumnPermission,
  applyPurchaseGridFormFieldPermission,
  applyPurchaseItemColumnPermission,
} from '#/views/erp/purchase/utils/field-permission';
import { purchaseItemPieceCountColumnFormatter } from '#/views/erp/purchase/utils/item-piece-count';
import { getSupplierSelectProps } from '#/views/erp/purchase/utils/supplier-select';

/** 调价类型选项 */
export const PURCHASE_ADJUST_TYPE_OPTIONS = [
  { label: '按入库单调价', value: 10 },
  { label: '添加明细', value: 20 },
];

const MASKED_PRICE_ITEM_FIELDS = new Set([
  'adjustPrice',
  'backupPrice1',
  'grossProfitRate',
  'lastPurchasePrice',
  'lastSalePrice',
  'minPrice',
  'newPrice',
  'oldPrice',
  'productPurchasePrice',
  'referencePrice',
  'retailPrice',
  'salePrice',
  'sharePrice',
  'wholesalePrice',
]);

const MASKED_PRICE_HIDDEN_FIELDS = new Set(
  [...MASKED_PRICE_ITEM_FIELDS].map((field) => `item_${field}`),
);

export interface PurchasePriceAdjustActionPermissions {
  canEdit?: boolean;
  canUpdateStatus?: boolean;
}

const ACTION_COLUMN_MIN_WIDTH = 72;
const ACTION_CELL_HORIZONTAL_PADDING = 8;
const ACTION_BUTTON_HORIZONTAL_PADDING = 8;
const ACTION_ICON_WIDTH = 16;
const ACTION_ICON_LABEL_GAP = 4;
const ACTION_BUTTON_GAP = 4;

function resolvePurchasePriceAdjustActionColumnWidth(
  rows: ErpPurchasePriceAdjustApi.PurchasePriceAdjust[],
  permissions: PurchasePriceAdjustActionPermissions = {},
) {
  const { canEdit = true, canUpdateStatus = true } = permissions;
  const widths = rows.map((row) => {
    const labels: string[] = [];
    if (canEdit && (row.status === 0 || row.status === 10)) {
      labels.push(row.status === 0 ? '编辑草稿' : '编辑');
    }
    if (canUpdateStatus && row.status === 10) labels.push('审批');
    if (labels.length === 0) return ACTION_COLUMN_MIN_WIDTH;
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

export function isPurchasePriceAdjustPriceItemHidden(
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

/** 表单的配置项 */
export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
  supplierId?: number,
): VbenFormSchema[] {
  const isDetail = formType === 'detail';
  const isEdit = formType === 'edit';
  return withPurchaseDecimalSchemas(applyFieldPermission(
    withPurchaseCandidateFocus([
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
        fieldName: 'adjustTime',
        label: '调价日期',
        component: 'DatePicker',
        componentProps: {
          placeholder: '系统自动生成',
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
          valueFormat: 'x',
          disabled: true,
        },
      },
      {
        fieldName: 'adjustType',
        label: '调价方式',
        component: 'RadioGroup',
        componentProps: {
          class: 'w-full purchase-price-adjust-type-radio',
          options: PURCHASE_ADJUST_TYPE_OPTIONS,
          // 新增时可切换；编辑/详情禁用（切换会把已选择的子表清空语义）
          disabled: isDetail || isEdit,
        },
        defaultValue: 10,
        rules: 'required',
      },
      {
        fieldName: 'supplierId',
        label: '供应商',
        component: 'SupplierLazySelect',
        // 编辑/详情禁用，避免切换供应商造成子表数据与 supplier 不一致
        componentProps: getSupplierSelectProps(isDetail || isEdit),
        rules: 'required',
      },
      {
        fieldName: 'supplierPayableInfo',
        component: 'Input',
        formItemClass: 'col-span-3',
      },
      {
        fieldName: 'deptId',
        label: '部门',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择部门',
          allowClear: true,
          showSearch: true,
          api: getPurchasePriceAdjustSupplierDeptSimplePage,
          params: { supplierId },
          shouldFetch: (params: Record<string, any>) =>
            Boolean(params.supplierId),
          pageSize: 10,
          labelField: 'name',
          valueField: 'id',
          disabled: isDetail,
        },
      },
      {
        fieldName: 'adjuster',
        label: '调价人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择调价人',
          allowClear: true,
          showSearch: true,
          api: getPurchasePriceAdjustUserSimplePage,
          pageSize: 10,
          labelField: 'nickname',
          valueField: 'id',
          disabled: isDetail,
        },
      },
      {
        fieldName: 'totalAdjustPrice',
        label: '调价总额',
        component: 'Input',
        componentProps: {
          placeholder: '系统自动计算',
          disabled: true,
        },
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
          autoSize: { minRows: 1, maxRows: 3 },
          disabled: isDetail,
        },
        formItemClass: 'col-span-3',
      },
      {
        fieldName: 'items',
        label: '调价明细',
        component: 'Input',
        formItemClass: 'col-span-3',
      },
    ]),
    hiddenFields,
  ));
}

/** 表单内子表格列定义（adjustType: 10=按入库单，20=添加明细） */
export function useFormItemColumns(
  formType: string,
  adjustType: number,
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  const disabled = formType === 'detail';
  const byInOrder = adjustType === 10;
  return applyPurchaseItemColumnPermission(
    [
      { type: 'seq', title: '序号', width: 50, fixed: 'left' },
      { field: 'inNo', title: '入库单号', minWidth: 170, fixed: 'left' },
      { field: 'productCode', title: '产品编码', minWidth: 130 },
      { field: 'productName', title: '产品名称', minWidth: 180 },
      {
        field: 'batchNo',
        title: '批次号',
        minWidth: 120,
        showOverflow: 'tooltip',
      },
      {
        field: 'oldPrice',
        title: '原单价',
        minWidth: 110,
        formatter:
          disabled &&
          isPurchasePriceAdjustPriceItemHidden(hiddenFields, 'oldPrice')
            ? () => '****'
            : 'formatPurchaseAmount6',
      },
      {
        field: 'adjustRatio',
        title: '调价比率(%)',
        minWidth: 120,
        visible: byInOrder,
        slots: { default: 'adjustRatio' },
        formatter: 'formatPurchaseDecimal6',
      },
      {
        field: 'newPrice',
        title: '调价后单价',
        minWidth: 130,
        fixed: 'right',
        slots: { default: 'newPrice' },
      },
      {
        field: 'adjustPrice',
        title: '调价差额',
        minWidth: 120,
        fixed: 'right',
        formatter:
          disabled &&
          isPurchasePriceAdjustPriceItemHidden(hiddenFields, 'adjustPrice')
            ? () => '****'
            : 'formatPurchaseAmount6',
      },
      { field: 'vehicleModel', title: '车型', minWidth: 110 },
      { field: 'standard', title: '规格', minWidth: 110 },
      {
        field: 'featureCode',
        title: '特征码',
        minWidth: 110,
        visible: !byInOrder,
      },
      {
        field: 'originPlace',
        title: '产地',
        minWidth: 100,
        visible: !byInOrder,
      },
      { field: 'brand', title: '品牌', minWidth: 110, visible: !byInOrder },
      { field: 'drawingNo', title: '图号', minWidth: 110 },
      {
        field: 'warehouseId',
        title: '仓库',
        minWidth: 160,
        slots: { default: 'warehouseId' },
      },
      {
        field: 'deptId',
        title: '部门',
        minWidth: 130,
        slots: { default: 'deptId' },
      },
      { field: 'warehousePosition', title: '货架位', minWidth: 110 },
      { field: 'productUnitName', title: '单位', minWidth: 72 },
      {
        field: 'weight',
        title: '重量',
        minWidth: 80,
        formatter: 'formatPurchaseDecimal6',
      },
      { field: 'packageQty', title: '包装数', minWidth: 80 },
      {
        field: 'pieceCount',
        title: '件数',
        minWidth: 80,
        formatter: purchaseItemPieceCountColumnFormatter,
      },
      {
        field: 'stockCount',
        title: '库存',
        minWidth: 90,
        formatter: 'formatPurchaseDecimal6',
      },
      {
        field: 'count',
        title: '数量',
        minWidth: 100,
        formatter: 'formatPurchaseDecimal6',
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 150,
        showOverflow: 'tooltip',
        slots: { default: 'remark' },
      },
      {
        field: 'actions',
        title: '操作',
        width: 70,
        fixed: 'right',
        slots: { default: 'actions' },
        visible: !disabled,
      },
    ],
    getColumnPermissionHiddenFields(hiddenFields),
  );
}

/** 列表页搜索 schema */
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
          'purchase-price-adjust-search-select-dropdown',
        ),
      },
      {
        fieldName: 'adjustTime',
        label: '调价时间',
        component: 'RangePicker',
        componentProps: {
          ...getRangePickerDefaultProps(),
          allowClear: true,
          popupClassName: 'purchase-price-adjust-search-picker-dropdown',
        },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'purchase-price-adjust-search-select-dropdown',
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          pageSize: 10,
          api: getPurchasePriceAdjustDeptSimplePage,
          labelField: 'name',
          valueField: 'id',
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
        fieldName: 'adjuster',
        label: '调价人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'purchase-price-adjust-search-select-dropdown',
          placeholder: '请选择调价人',
          allowClear: true,
          showSearch: true,
          pageSize: 10,
          api: getPurchasePriceAdjustUserSimplePage,
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
          popupClassName: 'purchase-price-adjust-search-select-dropdown',
          placeholder: '请选择调价方式',
          options: PURCHASE_ADJUST_TYPE_OPTIONS,
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
    hiddenFields,
  );
}

/** 列表页列定义 */
export function useGridColumns(
  hiddenFields: string[] = [],
  rows: ErpPurchasePriceAdjustApi.PurchasePriceAdjust[] = [],
  actionPermissions: PurchasePriceAdjustActionPermissions = {},
): VxeTableGridOptions['columns'] {
  return applyPurchaseGridColumnPermission(
    preparePurchaseDocumentListColumns(
      [
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
          field: 'no',
          title: '单号',
          width: 118,
          sortable: true,
          slots: { default: 'no' },
        },
        {
          field: 'supplierName',
          title: '供应商名称',
          width: 120,
          sortable: true,
          showOverflow: 'tooltip',
        },
        {
          field: 'adjustTime',
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
          field: 'adjustType',
          title: '调价方式',
          width: 96,
          formatter: ({ cellValue }) =>
            PURCHASE_ADJUST_TYPE_OPTIONS.find(
              (item) => item.value === cellValue,
            )?.label || '-',
        },
        {
          field: 'originalTotalPrice',
          title: '原单金额',
          width: 88,
          formatter: 'formatAmount2',
          sortable: true,
        },
        {
          field: 'adjustedTotalPrice',
          title: '调后金额',
          width: 88,
          formatter: 'formatAmount2',
          sortable: true,
        },
        {
          field: 'totalAdjustPrice',
          title: '调价差额',
          width: 88,
          formatter: 'formatAmount2',
          sortable: true,
        },
        {
          field: 'paymentPrice',
          title: '已结算金额',
          width: 96,
          formatter: 'formatAmount2',
        },
        {
          field: 'deptName',
          title: '部门',
          width: 90,
          showOverflow: 'tooltip',
        },
        { field: 'adjusterName', title: '调价人', width: 72, sortable: true },
        { field: 'creatorName', title: '创建人', width: 72 },
        {
          field: 'createTime',
          title: '创建日期',
          width: 112,
          formatter: 'formatDate',
        },
        { field: 'updaterName', title: '修改人', width: 72 },
        {
          field: 'updateTime',
          title: '修改日期',
          width: 112,
          formatter: 'formatDate',
        },
        { field: 'approverName', title: '审核人', width: 72, sortable: true },
        {
          field: 'approveTime',
          title: '审核日期',
          width: 112,
          formatter: 'formatDate',
          sortable: true,
        },
        {
          field: 'remark',
          title: '备注',
          width: 160,
          sortable: true,
          showOverflow: 'tooltip',
        },
        {
          field: 'actions',
          title: '操作',
          width: resolvePurchasePriceAdjustActionColumnWidth(
            rows,
            actionPermissions,
          ),
          fixed: 'right',
          slots: { default: 'actions' },
        },
      ],
      rows,
    ),
    hiddenFields,
    {
      adjustedTotalPrice: ['item_newPrice'],
      originalTotalPrice: ['item_oldPrice'],
    },
  );
}
