import { withPurchaseDecimalSchemas } from '#/views/erp/purchase/utils/decimal-form';
import { withPurchaseCandidateFocus } from '#/views/erp/purchase/utils/candidate-focus';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseReturnApi } from '#/api/erp/purchase/return';

import { getBaseDataSimpleList } from '#/api/erp/base';
import {
  getPurchaseReturnDeptSimplePage,
  getPurchaseReturnSupplierDeptSimplePage,
  getPurchaseReturnUserSimplePage,
} from '#/api/erp/purchase/return';
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

const MASKED_PRICE_HIDDEN_FIELDS = new Set(
  [...MASKED_PRICE_ITEM_FIELDS].map((field) => `item_${field}`),
);

export function isPurchaseReturnPriceItemHidden(
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

const HIDDEN_FORM_FIELD = {
  triggerFields: [''],
  show: () => false,
};

export interface PurchaseReturnActionPermissions {
  canEdit?: boolean;
  canUpdateStatus?: boolean;
}

const ACTION_COLUMN_MIN_WIDTH = 72;
const ACTION_CELL_HORIZONTAL_PADDING = 8;
const ACTION_BUTTON_HORIZONTAL_PADDING = 8;
const ACTION_ICON_WIDTH = 16;
const ACTION_ICON_LABEL_GAP = 4;
const ACTION_BUTTON_GAP = 4;

function resolvePurchaseReturnActionColumnWidth(
  rows: ErpPurchaseReturnApi.PurchaseReturn[],
  permissions: PurchaseReturnActionPermissions = {},
) {
  const { canEdit = true, canUpdateStatus = true } = permissions;
  const widths = rows.map((row) => {
    const labels: string[] = [];
    if (canEdit && row.status !== 20) labels.push('编辑');
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

/** 表单的配置项 */
export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  const visibleFields = new Set([
    'creatorName',
    'deptId',
    'fileUrl',
    'handler',
    'items',
    'no',
    'purchaser',
    'remark',
    'returnMode',
    'returnTime',
    'sourceInNo',
    'supplierId',
    'supplierPayableInfo',
    'totalCount',
    'warehouseType',
  ]);
  const formFieldLabels: Record<string, string> = {
    returnMode: '\u9000\u8D27\u6A21\u5F0F',
    no: '\u9000\u8D27\u5355\u53F7',
    returnTime: '\u9000\u8D27\u65E5\u671F',
    sourceInNo: '\u539F\u5165\u5E93\u5355',
    supplierId: '\u4F9B\u5E94\u5546',
    supplierPayableInfo: '',
    purchaser: '\u91C7\u8D2D\u5458',
    handler: '\u5236\u5355\u4EBA',
    creatorName: '\u521B\u5EFA\u4EBA',
    deptId: '\u90E8\u95E8',
    totalCount: '\u4EF6\u6570',
    warehouseType: '\u4ED3\u5E93\u7C7B\u578B',
    remark: '\u5907\u6CE8',
    fileUrl: '\u9644\u4EF6',
    items: '\u9000\u8D27\u4EA7\u54C1\u6E05\u5355',
  };

  const schemas: VbenFormSchema[] = withPurchaseCandidateFocus([
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'returnMode',
      label: '退货模式',
      component: 'RadioGroup',
      defaultValue: 10,
      componentProps: {
        disabled: formType === 'edit' || formType === 'detail',
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: '按入库单退货', value: 10 },
          { label: '按库存退货', value: 20 },
        ],
      },
      rules: 'required',
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'no',
      label: '退货单号',
      component: 'Input',
      componentProps: {
        placeholder: '系统自动生成',
        disabled: true,
      },
    },
    {
      fieldName: 'returnTime',
      label: '退货日期',
      component: 'DatePicker',
      componentProps: {
        // 客户要求只读
        disabled: true,
        placeholder: '系统自动生成',
        showTime: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        valueFormat: 'x',
      },
    },
    // 关联订单字段已隐藏（客户需求：两种退货模式都不需要关联订单）
    // {
    //   fieldName: 'orderNo',
    //   label: '关联订单',
    //   component: 'Input',
    //   formItemClass: 'col-span-1',
    //   dependencies: {
    //     triggerFields: ['returnMode'],
    //     show: () => false, // 永久隐藏
    //   },
    //   componentProps: {
    //     placeholder: '请选择关联订单',
    //     disabled: formType === 'detail',
    //   },
    // },
    {
      fieldName: 'sourceInNo',
      label: '原入库单',
      component: 'Input',
      formItemClass: 'col-span-1',
      dependencies: {
        triggerFields: ['returnMode'],
        show: (values: any) => values.returnMode === 10,
      },
      componentProps: {
        disabled: true,
        placeholder: '请选择原采购入库单',
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
      fieldName: 'supplierPayableInfo',
      component: 'Input',
      formItemClass: 'col-span-3',
    },
    // ========== 汽配扩展字段 ==========
    {
      fieldName: 'purchaser',
      label: '采购员',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择采购员',
        allowClear: true,
        showSearch: true,
        api: getPurchaseReturnUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        disabled: formType === 'detail',
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'handler',
      label: '制单人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '制单人默认当前登录人',
        allowClear: false,
        showSearch: true,
        api: getPurchaseReturnUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        // 客户要求：制单人只读
        disabled: true,
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'creatorName',
      label: '\u521B\u5EFA\u4EBA',
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '\u7CFB\u7EDF\u81EA\u52A8\u751F\u6210',
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择部门',
        allowClear: true,
        showSearch: true,
        api: getPurchaseReturnSupplierDeptSimplePage,
        pageSize: 10,
        params: {},
        shouldFetch: (params: { supplierId?: number | string }) =>
          Boolean(params?.supplierId),
        labelField: 'name',
        valueField: 'id',
        disabled: formType === 'detail',
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'taxRate',
      label: '税率（单位：%）',
      component: 'Input',
      formFieldProps: {
        validateOnBlur: true,
      },
      defaultValue: 0,
      componentProps: {
        class: 'w-full',
        placeholder: '请输入税率',
        disabled: formType === 'detail',
      },
      rules: createOptionalNumberRule('税率（单位：%）', { max: 100, min: 0 }),
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'invoiceType',
      label: '开票类型',
      component: 'ApiSelect',
      defaultValue: '收据和不开票',
      componentProps: {
        placeholder: '请选择开票类型',
        allowClear: true,
        showSearch: true,
        api: () => getBaseDataSimpleList('invoice_type'),
        labelField: 'name',
        valueField: 'name',
        disabled: formType === 'detail',
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'transportMethod',
      label: '运输方式',
      component: 'Select',
      defaultValue: '客户自提',
      componentProps: {
        placeholder: '请选择运输方式',
        allowClear: true,
        disabled: formType === 'detail',
        options: [
          { label: '客户自提', value: '客户自提' },
          { label: '物流配送', value: '物流配送' },
          { label: '快递', value: '快递' },
        ],
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'settleMethod',
      label: '结算方式',
      component: 'ApiSelect',
      defaultValue: '现金',
      componentProps: {
        placeholder: '请选择结算方式',
        allowClear: true,
        showSearch: true,
        api: () => getBaseDataSimpleList('settle_method'),
        labelField: 'name',
        valueField: 'name',
        disabled: formType === 'detail',
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'shipArea',
      label: '发货区',
      component: 'Select',
      componentProps: {
        placeholder: '请选择发货区',
        allowClear: true,
        disabled: formType === 'detail',
        options: [
          { label: '华北', value: '华北' },
          { label: '华东', value: '华东' },
          { label: '华南', value: '华南' },
          { label: '西南', value: '西南' },
          { label: '西北', value: '西北' },
          { label: '东北', value: '东北' },
          { label: '华中', value: '华中' },
        ],
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'totalCount',
      label: '件数',
      component: 'Input',
      formFieldProps: {
        validateOnBlur: true,
      },
      defaultValue: 0,
      componentProps: {
        class: 'w-full',
        placeholder: '根据明细自动计算',
        disabled: true,
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'warehouseType',
      label: '仓库类型',
      component: 'Select',
      defaultValue: '全部',
      componentProps: {
        placeholder: '请选择仓库类型',
        allowClear: true,
        disabled: formType === 'detail',
        options: [
          { label: '全部', value: '全部' },
          { label: '主仓', value: '主仓' },
          { label: '次仓', value: '次仓' },
        ],
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'freightType',
      label: '运费类型',
      component: 'Select',
      componentProps: {
        placeholder: '请选择运费类型',
        allowClear: true,
        disabled: formType === 'detail',
        options: [
          { label: '卖方承担', value: '卖方承担' },
          { label: '买方承担', value: '买方承担' },
          { label: '运费对半', value: '运费对半' },
        ],
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'freightAmount',
      label: '运费金额',
      component: 'Input',
      formFieldProps: {
        validateOnBlur: true,
      },
      componentProps: {
        class: 'w-full',
        placeholder: '请输入运费金额',
        disabled: formType === 'detail',
      },
      rules: createOptionalNumberRule('运费金额', { min: 0 }),
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'feeAmount',
      label: '费用',
      component: 'Input',
      formFieldProps: {
        validateOnBlur: true,
      },
      componentProps: {
        class: 'w-full',
        placeholder: '请输入费用',
        disabled: formType === 'detail',
      },
      rules: createOptionalNumberRule('费用', { min: 0 }),
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'logisticsCompany',
      label: '物流公司',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '请选择物流公司',
        allowClear: true,
        showSearch: true,
        api: () => getBaseDataSimpleList('logistics_company'),
        labelField: 'name',
        valueField: 'name',
        disabled: formType === 'detail',
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'logisticsNo',
      label: '物流单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入物流单号',
        disabled: formType === 'detail',
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'sourceType',
      label: '单据来源',
      component: 'Select',
      componentProps: {
        placeholder: '请选择单据来源',
        allowClear: true,
        disabled: formType === 'detail',
        options: [
          { label: '手工录入', value: '手工录入' },
          { label: '系统生成', value: '系统生成' },
        ],
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'factoryOrderNo',
      label: '厂家单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入厂家单号',
        disabled: formType === 'detail',
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'priority',
      label: '优先级',
      component: 'Select',
      componentProps: {
        placeholder: '请选择优先级',
        allowClear: true,
        disabled: formType === 'detail',
        options: [
          { label: '正厂件', value: '正厂件' },
          { label: '副厂件', value: '副厂件' },
          { label: '拆车件', value: '拆车件' },
        ],
      },
      formItemClass: 'col-span-1',
    },
    {
      fieldName: 'orderMethod',
      label: '开单方式',
      component: 'Select',
      componentProps: {
        placeholder: '请选择开单方式',
        allowClear: true,
        disabled: formType === 'detail',
        options: [
          { label: '手工开单', value: '手工开单' },
          { label: '自动开单', value: '自动开单' },
        ],
      },
      formItemClass: 'col-span-1',
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
      label: '退货产品清单',
      hideLabel: true,
      component: 'Input',
      formItemClass: 'col-span-3',
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
  ]);

  const visibleOnlySchemas = schemas.map((schema) => {
    const fieldName = String(schema.fieldName ?? '');
    const label = formFieldLabels[fieldName] ?? schema.label;
    if (!visibleFields.has(fieldName)) {
      return {
        ...schema,
        label,
        dependencies: HIDDEN_FORM_FIELD,
        rules: undefined,
      };
    }
    return {
      ...schema,
      label,
    };
  });

  return withPurchaseDecimalSchemas(applyPurchaseFormFieldPermission(visibleOnlySchemas, hiddenFields));
}

/** 表单的明细表格列 */
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
        field: 'productCode',
        title: '产品编码',
        minWidth: 120,
      },
      {
        field: 'productName',
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
          isPurchaseReturnPriceItemHidden(hiddenFields, 'lastPurchasePrice')
            ? () => '****'
            : 'formatPurchaseAmount6',
      },
      {
        field: 'totalProductPrice',
        title: '产品金额',
        minWidth: 120,
        formatter:
          disabled &&
          isPurchaseReturnPriceItemHidden(hiddenFields, 'totalProductPrice')
            ? () => '****'
            : 'formatPurchaseAmount6',
      },
      {
        field: 'batchNo',
        title: '批次',
        minWidth: 120,
        slots: { default: 'batchNo' },
      },
      {
        field: 'sourceInNo',
        title: '原入库单',
        minWidth: 140,
      },
      {
        field: 'inCount',
        title: '原入库数量',
        minWidth: 100,
        formatter: 'formatPurchaseDecimal6',
      },
      {
        field: 'returnableCount',
        title: '可退数量',
        minWidth: 100,
        formatter: 'formatPurchaseDecimal6',
      },
      {
        field: 'partCode',
        title: '零件编码',
        minWidth: 120,
      },
      {
        field: 'partName',
        title: '零件名称',
        minWidth: 120,
      },
      {
        field: 'vehicleModel',
        title: '适用车型',
        minWidth: 120,
      },
      {
        field: 'originPlace',
        title: '产地',
        minWidth: 100,
      },
      {
        field: 'stockCount',
        title: '库存',
        minWidth: 80,
        formatter: 'formatPurchaseDecimal6',
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
        formatter: 'formatPurchaseDecimal6',
      },
      {
        field: 'packageQty',
        title: '包装数',
        minWidth: 80,
      },
      {
        field: 'pieceCount',
        title: '件数',
        minWidth: 80,
        formatter: purchaseItemPieceCountColumnFormatter,
      },
      {
        field: 'returnCount',
        title: '已退货',
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
        formatter: 'formatPurchaseAmount6',
      },
      {
        field: 'totalPrice',
        title: '合计金额',
        minWidth: 120,
        formatter:
          disabled &&
          isPurchaseReturnPriceItemHidden(hiddenFields, 'totalPrice')
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
        fieldName: 'no',
        label: '退货单号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入退货单号',
          allowClear: true,
        },
      },
      {
        fieldName: 'supplierId',
        label: '供应商',
        component: 'SupplierLazySelect',
        componentProps: getSupplierSelectProps(
          false,
          'purchase-return-search-select-dropdown',
        ),
      },
      {
        fieldName: 'returnTime',
        label: '退货时间',
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
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          popupClassName: 'purchase-return-search-select-dropdown',
          pageSize: 10,
          api: getPurchaseReturnDeptSimplePage,
          labelField: 'name',
          valueField: 'id',
          loadErrorMessage: '部门列表加载失败，请重试',
        },
      },
      {
        fieldName: 'sourceInNo',
        label: '入库单号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入入库单号',
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
          popupClassName: 'purchase-return-search-select-dropdown',
          pageSize: 10,
          api: getPurchaseReturnUserSimplePage,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '采购员列表加载失败，请重试',
        },
      },
      {
        fieldName: 'handler',
        label: '制单人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择制单人',
          allowClear: true,
          showSearch: true,
          popupClassName: 'purchase-return-search-select-dropdown',
          pageSize: 10,
          api: getPurchaseReturnUserSimplePage,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '制单人列表加载失败，请重试',
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
  rows: ErpPurchaseReturnApi.PurchaseReturn[] = [],
  actionPermissions: PurchaseReturnActionPermissions = {},
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
          title: '退货单号',
          width: 132,
          sortable: true,
          slots: { default: 'no' },
        },
        {
          field: 'settlementStatus',
          title: '结算状态',
          width: 84,
          sortable: true,
          slots: { default: 'settlementStatus' },
        },
        {
          field: 'returnTime',
          title: '开单日期',
          width: 112,
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
          field: 'supplierName',
          title: '供应商',
          width: 112,
          sortable: true,
          showOverflow: 'tooltip',
        },
        {
          field: 'itemCount',
          title: '项数',
          width: 56,
          align: 'right',
          sortable: true,
          formatter: ({ row }: { row: any }) =>
            row.itemCount ?? row.items?.length ?? 0,
        },
        {
          field: 'totalCount',
          title: '退货数',
          width: 80,
          align: 'right',
          sortable: true,
          formatter: 'formatAmount2',
        },
        {
          field: 'totalPrice',
          title: '总金额',
          width: 88,
          align: 'right',
          formatter: 'formatAmount2',
          sortable: true,
        },
        {
          field: 'purchaser',
          title: '采购员',
          width: 72,
          sortable: true,
          formatter: ({ row }: { row: any }) =>
            row.purchaserName ?? row.purchaser ?? '',
          showOverflow: 'tooltip',
        },
        {
          field: 'status',
          title: '状态',
          width: 64,
          sortable: true,
          slots: { default: 'status' },
        },
        {
          field: 'deptName',
          title: '部门',
          width: 80,
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
          field: 'creatorName',
          title: '开单人',
          width: 72,
          sortable: true,
          showOverflow: 'tooltip',
        },
        {
          field: 'actions',
          title: '操作',
          width: resolvePurchaseReturnActionColumnWidth(
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
/** 列表的搜索表单 */
export function useOrderGridFormSchema(): VbenFormSchema[] {
  return withPurchaseCandidateFocus([
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
        placeholder: '请输入配件编码、名称、拼音码、五笔码等',
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
  ]);
}

/** 列表的字段 */
export function useOrderGridColumns(): VxeTableGridOptions['columns'] {
  return [
    {
      type: 'radio',
      width: 50,
      fixed: 'left',
    },
    {
      field: 'no',
      title: '订单单号',
      width: 200,
      fixed: 'left',
    },
    {
      field: 'productNames',
      title: '产品信息',
      showOverflow: 'tooltip',
      minWidth: 120,
    },
    {
      field: 'supplierName',
      title: '供应商',
      minWidth: 120,
    },
    {
      field: 'orderTime',
      title: '订单时间',
      width: 160,
      formatter: 'formatDate',
    },
    {
      field: 'creatorName',
      title: '创建人',
      minWidth: 120,
    },
    {
      field: 'totalCount',
      title: '总数量',
      formatter: 'formatPurchaseDecimal6',
      minWidth: 120,
    },
    {
      field: 'inCount',
      title: '已入库数量',
      formatter: 'formatPurchaseDecimal6',
      minWidth: 120,
    },
    {
      field: 'returnCount',
      title: '已退货数量',
      formatter: 'formatPurchaseDecimal6',
      minWidth: 120,
    },
    {
      field: 'totalProductPrice',
      title: '金额合计',
      formatter: 'formatPurchaseAmount6',
      minWidth: 120,
    },
    {
      field: 'totalPrice',
      title: '金额',
      formatter: 'formatPurchaseAmount6',
      minWidth: 120,
    },
  ];
}
