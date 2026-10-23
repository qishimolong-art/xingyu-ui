import { withPurchaseDecimalSchemas } from '#/views/erp/purchase/utils/decimal-form';
import { withPurchaseCandidateFocus } from '#/views/erp/purchase/utils/candidate-focus';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseInvoiceApi } from '#/api/erp/purchase/invoice';

import { getBaseDataSimpleList } from '#/api/erp/base';
import {
  getPurchaseInvoiceDeptSimplePage,
  getPurchaseInvoiceSupplierDeptSimplePage,
  getPurchaseInvoiceUserSimplePage,
  PURCHASE_INVOICE_STATUS,
} from '#/api/erp/purchase/invoice';
import { isFieldHidden } from '#/composables/useFieldPermission';
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

export interface PurchaseInvoiceActionPermissions {
  canEdit?: boolean;
  canUpdateStatus?: boolean;
}

const ACTION_COLUMN_MIN_WIDTH = 72;

function resolvePurchaseInvoiceActionColumnWidth(
  rows: ErpPurchaseInvoiceApi.PurchaseInvoice[],
  permissions: PurchaseInvoiceActionPermissions = {},
) {
  const { canEdit = true, canUpdateStatus = true } = permissions;
  const widths = rows.map((row) => {
    const labels: string[] = [];
    if (
      canEdit &&
      (row.status === PURCHASE_INVOICE_STATUS.DRAFT ||
        row.status === PURCHASE_INVOICE_STATUS.PROCESS)
    ) {
      labels.push(
        row.status === PURCHASE_INVOICE_STATUS.DRAFT ? '编辑草稿' : '编辑',
      );
    }
    if (canUpdateStatus && row.status === PURCHASE_INVOICE_STATUS.PROCESS) {
      labels.push('审批');
    }
    if (labels.length === 0) return ACTION_COLUMN_MIN_WIDTH;
    return (
      labels.reduce((total, label) => total + label.length * 13 + 28, 0) +
      Math.max(labels.length - 1, 0) * 4 +
      8
    );
  });
  return Math.max(ACTION_COLUMN_MIN_WIDTH, ...widths);
}

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
  'totalPrice',
  'wholesalePrice',
]);

const MASKED_PRICE_HIDDEN_FIELDS = new Set(
  [...MASKED_PRICE_ITEM_FIELDS].map((field) => `item_${field}`),
);

export function isPurchaseInvoicePriceItemHidden(
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
  supplierId?: number,
): VbenFormSchema[] {
  return withPurchaseDecimalSchemas(applyPurchaseFormFieldPermission(
    withPurchaseCandidateFocus([
      {
        fieldName: 'id',
        component: 'Input',
        dependencies: { triggerFields: [''], show: () => false },
      },
      {
        fieldName: 'no',
        label: '票据单号',
        component: 'Input',
        componentProps: {
          placeholder: '系统自动生成',
          disabled: true,
        },
      },
      {
        fieldName: 'invoiceDate',
        label: '开票日期',
        component: 'DatePicker',
        componentProps: {
          placeholder: '请选择开票日期',
          valueFormat: 'YYYY-MM-DD',
          disabled: formType === 'detail',
        },
        rules: 'required',
      },
      {
        fieldName: 'supplierId',
        label: '供应商',
        component: 'SupplierLazySelect',
        componentProps: getSupplierSelectProps(
          formType === 'detail',
          'purchase-invoice-search-select-dropdown',
        ),
        rules: 'required',
      },
      {
        fieldName: 'supplierPayableInfo',
        component: 'Input',
        formItemClass: 'col-span-3',
      },
      {
        fieldName: 'invoiceType',
        label: '票据类型',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择票据类型',
          allowClear: true,
          showSearch: true,
          api: () => getBaseDataSimpleList('invoice_type'),
          labelField: 'name',
          valueField: 'name',
          disabled: formType === 'detail',
        },
        rules: 'required',
      },
      {
        fieldName: 'invoiceNo',
        label: '发票号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入发票号',
          disabled: formType === 'detail',
        },
        rules: 'required',
      },
      {
        fieldName: 'invoiceCount',
        label: '发票张数',
        component: 'Input',
        formFieldProps: {
          validateOnBlur: true,
        },
        defaultValue: 1,
        componentProps: {
          class: 'w-full',
          disabled: formType === 'detail',
        },
        rules: createOptionalNumberRule('发票张数', { integer: true, min: 1 }),
      },
      {
        fieldName: 'deptId',
        label: '部门',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择部门',
          allowClear: true,
          showSearch: true,
          api: getPurchaseInvoiceSupplierDeptSimplePage,
          params: { supplierId },
          shouldFetch: (params: Record<string, any>) =>
            Boolean(params.supplierId),
          pageSize: 10,
          labelField: 'name',
          valueField: 'id',
          disabled: formType === 'detail',
        },
      },
      {
        fieldName: 'handlerId',
        label: '经手人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择经手人',
          allowClear: true,
          showSearch: true,
          api: getPurchaseInvoiceUserSimplePage,
          pageSize: 10,
          labelField: 'nickname',
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
          autoSize: { minRows: 1, maxRows: 2 },
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
        label: '票据明细',
        component: 'Input',
        formItemClass: 'col-span-3',
      },
      {
        fieldName: 'taxExclusiveAmount',
        label: '不含税金额',
        component: 'Input',
        formFieldProps: {
          validateOnBlur: true,
        },
        componentProps: { disabled: true, placeholder: '0.00' },
        rules: createOptionalNumberRule('不含税金额', { min: 0 }),
      },
      {
        fieldName: 'taxAmount',
        label: '税额',
        component: 'Input',
        formFieldProps: {
          validateOnBlur: true,
        },
        componentProps: { disabled: true, placeholder: '0.00' },
        rules: createOptionalNumberRule('税额', { min: 0 }),
      },
    ]),
    hiddenFields,
  ));
}

export function useFormItemColumns(
  _formData?: any[],
  disabled?: boolean,
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  const columns =
    applyPurchaseItemColumnPermission(
      [
        { type: 'seq', title: '序号', width: 60 },
        { field: 'sourceTypeName', title: '来源类型', minWidth: 90 },
        {
          field: 'sourceDocNo',
          title: '来源单据',
          minWidth: 150,
          slots: { default: 'sourceDocNo' },
        },
        { field: 'productCode', title: '产品编码', minWidth: 120 },
        {
          field: 'productId',
          title: '产品名称',
          minWidth: 220,
          slots: { default: 'productId' },
        },
        {
          field: 'stockCount',
          title: '库存',
          minWidth: 90,
          formatter: 'formatPurchaseDecimal6',
        },
        {
          field: 'count',
          title: '本次开票数量',
          minWidth: 110,
          slots: { default: 'count' },
        },
        {
          field: 'sourceRemainingCount',
          title: '剩余可开数量',
          minWidth: 110,
          formatter: 'formatPurchaseDecimal6',
        },
        {
          field: 'packageQty',
          title: '包装数',
          minWidth: 90,
          formatter: 'formatPurchaseDecimal6',
        },
        {
          field: 'pieceCount',
          title: '件数',
          minWidth: 90,
          formatter: purchaseItemPieceCountColumnFormatter,
        },
        {
          field: 'productPrice',
          title: '原单价/调价差额',
          minWidth: 130,
          slots: { default: 'productPrice' },
        },
        {
          field: 'taxExclusivePrice',
          title: '不含税金额',
          minWidth: 130,
          formatter: 'formatPurchaseAmount6',
        },
        {
          field: 'taxPercent',
          title: '税率(%)',
          minWidth: 110,
          slots: { default: 'taxPercent' },
        },
        {
          field: 'taxPrice',
          title: '税额',
          minWidth: 120,
          formatter: 'formatPurchaseAmount6',
        },
        {
          field: 'totalPrice',
          title: '金额',
          minWidth: 120,
          formatter:
            disabled &&
            isPurchaseInvoicePriceItemHidden(hiddenFields, 'totalPrice')
              ? () => '****'
              : 'formatPurchaseAmount6',
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
          width: 70,
          fixed: 'right',
          slots: { default: 'actions' },
        },
      ],
      getColumnPermissionHiddenFields(hiddenFields),
    ) ?? [];
  return disabled
    ? columns.filter((column) => column.field !== 'actions')
    : columns;
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
          'purchase-invoice-search-select-dropdown',
        ),
      },
      {
        fieldName: 'invoiceDate',
        label: '开票日期',
        component: 'RangePicker',
        componentProps: {
          allowClear: true,
          valueFormat: 'YYYY-MM-DD',
        },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          popupClassName: 'purchase-invoice-search-select-dropdown',
          pageSize: 10,
          api: getPurchaseInvoiceDeptSimplePage,
          labelField: 'name',
          valueField: 'id',
          loadErrorMessage: '部门列表加载失败，请重试',
        },
      },
      {
        fieldName: 'no',
        label: '票据单号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入票据单号',
          allowClear: true,
        },
      },
      {
        fieldName: 'creator',
        label: '创建人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择创建人',
          allowClear: true,
          showSearch: true,
          popupClassName: 'purchase-invoice-search-select-dropdown',
          pageSize: 10,
          api: getPurchaseInvoiceUserSimplePage,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '创建人列表加载失败，请重试',
        },
      },
      {
        fieldName: 'handlerId',
        label: '经手人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择经手人',
          allowClear: true,
          showSearch: true,
          popupClassName: 'purchase-invoice-search-select-dropdown',
          pageSize: 10,
          api: getPurchaseInvoiceUserSimplePage,
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
        fieldName: 'invoiceNo',
        label: '发票号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入发票号',
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
        fieldName: 'invoiceType',
        label: '票据类型',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择票据类型',
          allowClear: true,
          showSearch: true,
          popupClassName: 'purchase-invoice-search-select-dropdown',
          api: () => getBaseDataSimpleList('invoice_type'),
          labelField: 'name',
          valueField: 'name',
        },
      },
      {
        fieldName: 'status',
        label: '状态',
        component: 'Select',
        componentProps: {
          allowClear: true,
          placeholder: '请选择状态',
          popupClassName: 'purchase-invoice-search-select-dropdown',
          options: [
            { label: '草稿', value: 0 },
            { label: '待审核', value: 10 },
            { label: '已审核', value: 20 },
          ],
        },
      },
      {
        fieldName: 'showCompleted',
        label: '显示已完成',
        component: 'Switch',
        defaultValue: true,
        componentProps: {
          checkedChildren: '是',
          unCheckedChildren: '否',
        },
      },
    ]),
    hiddenFields,
  );
}

export function useGridColumns(
  hiddenFields: string[] = [],
  rows: ErpPurchaseInvoiceApi.PurchaseInvoice[] = [],
  actionPermissions: PurchaseInvoiceActionPermissions = {},
): VxeTableGridOptions['columns'] {
  return applyPurchaseGridColumnPermission(
    preparePurchaseDocumentListColumns(
      [
        { type: 'checkbox', width: 44 },
        {
          field: 'deleteAction',
          title: '删除',
          width: 56,
          slots: { default: 'deleteAction' },
        },
        {
          field: 'printAction',
          title: '打印',
          width: 56,
          slots: { default: 'printAction' },
        },
        {
          field: 'no',
          title: '单号',
          minWidth: 150,
          sortable: true,
          slots: { default: 'no' },
        },
        {
          field: 'supplierName',
          title: '供应商',
          minWidth: 140,
          sortable: true,
        },
        {
          field: 'supplierType',
          title: '供应商类型',
          minWidth: 100,
          sortable: true,
        },
        { field: 'invoiceNo', title: '发票号', minWidth: 130, sortable: true },
        {
          field: 'invoiceType',
          title: '发票类型',
          minWidth: 100,
          sortable: true,
        },
        {
          field: 'totalAmount',
          title: '汇总金额',
          minWidth: 100,
          formatter: 'formatAmount2',
          sortable: true,
        },
        {
          field: 'taxAmount',
          title: '税费',
          minWidth: 80,
          formatter: 'formatAmount2',
          sortable: true,
        },
        {
          field: 'taxExclusiveAmount',
          title: '不含税金额',
          minWidth: 105,
          formatter: 'formatAmount2',
          sortable: true,
        },
        {
          field: 'status',
          title: '状态',
          minWidth: 90,
          sortable: true,
          slots: { default: 'status' },
        },
        {
          field: 'displayTaxPercent',
          title: '税率',
          minWidth: 72,
          sortable: true,
        },
        { field: 'creatorName', title: '创建人', minWidth: 90, sortable: true },
        {
          field: 'createTime',
          title: '创建日期',
          minWidth: 140,
          formatter: 'formatDateTime',
          sortable: true,
        },
        {
          field: 'invoiceDate',
          title: '开票日期',
          minWidth: 105,
          formatter: 'formatDate',
          sortable: true,
        },
        {
          field: 'auditUserName',
          title: '审核人',
          minWidth: 90,
          sortable: true,
        },
        {
          field: 'auditTime',
          title: '审核日期',
          minWidth: 140,
          formatter: 'formatDateTime',
          sortable: true,
        },
        { field: 'remark', title: '备注', minWidth: 150, sortable: true },
        {
          field: 'actions',
          title: '操作',
          width: resolvePurchaseInvoiceActionColumnWidth(
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
  );
}
