import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PrepareSaleDocumentItemColumnOptions } from '#/views/erp/sale/utils/document-item-table';

import { getBaseDataSimpleList } from '#/api/erp/base';
import { getProductSimpleList } from '#/api/erp/product/product';
import {
  getSaleReturnCustomerDeptSimplePage,
  getSaleReturnDeptSimplePage,
  getSaleReturnUserSimplePage,
} from '#/api/erp/sale/return';
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
import { filterErpProductOption } from '#/views/erp/utils/product-select';

const HIDDEN_FORM_FIELD = {
  triggerFields: [''],
  show: () => false,
};

const SELECT_FORM_COMPONENTS = new Set([
  'ApiSelect',
  'ApiTreeSelect',
  'ErpLazyPageSelect',
  'CustomerLazySelect',
  'SaleCustomerLazySelect',
  'Select',
  'TreeSelect',
]);

function withSelectPopupClassName(
  schemas: VbenFormSchema[],
  popupClassName: string,
): VbenFormSchema[] {
  return withCandidateFocus(
    schemas.map((schema) => {
      if (!SELECT_FORM_COMPONENTS.has(String(schema.component))) {
        return schema;
      }
      return {
        ...schema,
        componentProps: {
          ...(schema.componentProps as Record<string, unknown>),
          popupClassName,
        },
      };
    }),
  );
}

/** 表单的配置项 */
export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
  deptOptions: any[] = [],
): VbenFormSchema[] {
  const visibleFields = new Set([
    'creatorName',
    'customerId',
    'customerReceivableInfo',
    'deptId',
    'fileUrl',
    'no',
    'remark',
    'returnMode',
    'returnTime',
    'sourceOutNo',
    'totalCount',
  ]);
  const formFieldLabels: Record<string, string> = {
    no: '\u9000\u8D27\u5355\u53F7',
    returnTime: '\u9000\u8D27\u65E5\u671F',
    returnMode: '\u9000\u8D27\u7C7B\u578B',
    sourceOutNo: '\u539F\u9500\u552E\u5355',
    customerId: '\u5BA2\u6237',
    creatorName: '\u5236\u5355\u4EBA',
    deptId: '\u90E8\u95E8',
    totalCount: '\u4EF6\u6570',
    remark: '\u5907\u6CE8',
    fileUrl: '\u9644\u4EF6',
  };

  return withCandidateFocus(
    withEnterBlurInputSchemas(
      withSelectPopupClassName(
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
              fieldName: 'sourceOutId',
              component: 'Input',
              dependencies: {
                triggerFields: [''],
                show: () => false,
              },
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
              label: '退货时间',
              component: 'DatePicker',
              componentProps: {
                disabled: true,
                placeholder: '选择退货时间',
                showTime: true,
                format: 'YYYY-MM-DD HH:mm:ss',
                valueFormat: 'x',
              },
            },
            {
              fieldName: 'returnMode',
              label: '退货模式',
              component: 'RadioGroup',
              componentProps: {
                buttonStyle: 'solid',
                optionType: 'button',
                options: [
                  { label: '按销售退货', value: 10 },
                  { label: '按库存退货', value: 20 },
                ],
                disabled: formType === 'detail',
              },
              rules: 'required',
            },
            {
              fieldName: 'sourceOutNo',
              label: '关联销售单',
              component: 'Input',
              formItemClass: 'col-span-1',
              componentProps: {
                placeholder: '请选择关联销售单',
                disabled: formType === 'detail',
              },
            },
            {
              fieldName: 'customerId',
              label: '客户',
              component: 'SaleCustomerLazySelect',
              componentProps: {
                ...getSaleCustomerSelectProps(formType === 'detail'),
              },
              rules: 'required',
            },
            {
              fieldName: 'saleUserId',
              label: '业务员',
              component: 'ErpLazyPageSelect',
              componentProps: {
                placeholder: '请选择业务员',
                allowClear: true,
                showSearch: true,
                api: getSaleReturnUserSimplePage,
                pageSize: 10,
                labelField: 'nickname',
                valueField: 'id',
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
                api: getSaleReturnCustomerDeptSimplePage,
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
              fieldName: 'creatorName',
              label: '\u5236\u5355\u4EBA',
              component: 'Input',
              componentProps: {
                disabled: true,
              },
            },
            {
              fieldName: 'totalCount',
              label: '\u4EF6\u6570',
              component: 'Input',
              componentProps: {
                disabled: true,
                placeholder: '0',
              },
            },
            {
              fieldName: 'priority',
              label: '优先级别',
              component: 'Select',
              componentProps: {
                placeholder: '请选择优先级别',
                allowClear: true,
                disabled: formType === 'detail',
                options: [
                  { label: '正常件', value: '正常件' },
                  { label: '急件', value: '急件' },
                ],
              },
            },
            {
              fieldName: 'invoiceType',
              label: '开票类型',
              component: 'ApiSelect',
              componentProps: {
                placeholder: '请选择开票类型',
                allowClear: true,
                showSearch: true,
                disabled: formType === 'detail',
                api: () => getBaseDataSimpleList('invoice_type'),
                labelField: 'name',
                valueField: 'name',
              },
            },
            {
              fieldName: 'billNo',
              label: '票据号',
              component: 'Input',
              componentProps: {
                placeholder: '请输入票据号',
                disabled: formType === 'detail',
              },
            },
            {
              fieldName: 'deliveryMethod',
              label: '退货方式',
              component: 'ApiSelect',
              componentProps: {
                placeholder: '请选择退货方式',
                allowClear: true,
                showSearch: true,
                disabled: formType === 'detail',
                api: () => getBaseDataSimpleList('delivery_method'),
                labelField: 'name',
                valueField: 'name',
              },
            },
            {
              fieldName: 'reductionAmount',
              label: '减收金额',
              component: 'Input',
              componentProps: {
                placeholder: '请输入减收金额',
                disabled: formType === 'detail',
              },
              rules: createOptionalNumberRule('减收金额', { min: 0 }),
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
                  { label: '代客户付', value: '代客户付' },
                  { label: '我方自付', value: '我方自付' },
                  { label: '客户代付', value: '客户代付' },
                  { label: '客户自付', value: '客户自付' },
                  { label: '送货补贴', value: '送货补贴' },
                ],
              },
            },
            {
              fieldName: 'freightAmount',
              label: '运费金额',
              component: 'Input',
              componentProps: {
                placeholder: '请输入运费金额',
                disabled: formType === 'detail',
              },
              rules: createOptionalNumberRule('运费金额', { min: 0 }),
            },
            {
              fieldName: 'settleMethod',
              label: '结算方式',
              component: 'ApiSelect',
              componentProps: {
                placeholder: '请选择结算方式',
                allowClear: true,
                showSearch: true,
                disabled: formType === 'detail',
                api: () => getBaseDataSimpleList('settle_method'),
                labelField: 'name',
                valueField: 'name',
              },
              rules: 'required',
            },
            {
              fieldName: 'settleMethod',
              label: '结算方式',
              component: 'ApiSelect',
              componentProps: {
                placeholder: '请选择结算方式',
                allowClear: true,
                showSearch: true,
                disabled: formType === 'detail',
                api: () => getBaseDataSimpleList('settle_method'),
                labelField: 'name',
                valueField: 'name',
              },
              rules: 'required',
            },
            {
              fieldName: 'logisticsCompany',
              label: '物流公司',
              component: 'Input',
              componentProps: {
                placeholder: '请输入物流公司',
                disabled: formType === 'detail',
              },
            },
            {
              fieldName: 'vehicleNo',
              label: '车牌号',
              component: 'Input',
              componentProps: {
                placeholder: '请输入车牌号',
                disabled: formType === 'detail',
              },
            },
            {
              fieldName: 'branchStore',
              label: '货到分店',
              component: 'Input',
              componentProps: {
                placeholder: '请输入货到分店',
                disabled: formType === 'detail',
              },
            },
            {
              fieldName: 'purchaseArea',
              label: '进货区',
              component: 'Select',
              componentProps: {
                placeholder: '请选择进货区',
                allowClear: true,
                disabled: formType === 'detail',
                options: [
                  { label: '进货A区', value: '进货A区' },
                  { label: '进货B区', value: '进货B区' },
                ],
              },
            },
            {
              fieldName: 'businessType',
              label: '业务类型',
              component: 'Select',
              componentProps: {
                placeholder: '请选择业务类型',
                allowClear: true,
                disabled: formType === 'detail',
                options: [
                  { label: '普通销售', value: '普通销售' },
                  { label: '保险业务', value: '保险业务' },
                  { label: '平台代销', value: '平台代销' },
                ],
              },
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
                  { label: '正常单', value: '正常单' },
                  { label: '销售补单', value: '销售补单' },
                ],
              },
            },
            {
              fieldName: 'developerUserId',
              label: '开发员',
              component: 'ErpLazyPageSelect',
              componentProps: {
                placeholder: '请选择开发员',
                allowClear: true,
                showSearch: true,
                api: getSaleReturnUserSimplePage,
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
                autoSize: { minRows: 1, maxRows: 1 },
                disabled: formType === 'detail',
              },
              formItemClass: 'col-span-4',
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
              formItemClass: 'col-span-4 sale-return-attachment-field',
            },
            {
              fieldName: 'customerReceivableInfo',
              component: 'Input',
              formItemClass: 'col-span-4',
            },
            {
              fieldName: 'items',
              label: '退货产品清单',
              component: 'Input',
              formItemClass: 'col-span-4',
            },
            {
              fieldName: 'discountPercent',
              component: 'Input',
              dependencies: { triggerFields: [''], show: () => false },
              rules: createOptionalNumberRule('优惠率', { max: 100, min: 0 }),
            },
            {
              fieldName: 'discountPrice',
              component: 'Input',
              dependencies: { triggerFields: [''], show: () => false },
              rules: createOptionalNumberRule('付款优惠'),
            },
            {
              fieldName: 'feeAmount',
              label: '费用',
              component: 'Input',
              componentProps: {
                placeholder: '请输入费用',
                disabled: formType === 'detail',
              },
              rules: createOptionalNumberRule('费用', { min: 0 }),
            },
            {
              fieldName: 'accountId',
              component: 'Input',
              dependencies: { triggerFields: [''], show: () => false },
            },
            {
              fieldName: 'totalPrice',
              component: 'Input',
              dependencies: { triggerFields: [''], show: () => false },
              rules: createOptionalNumberRule('优惠后金额'),
            },
          ].map((schema) => {
            if (!schema.fieldName) return schema;
            if (!visibleFields.has(schema.fieldName)) {
              return {
                ...schema,
                dependencies: HIDDEN_FORM_FIELD,
                rules: undefined,
              };
            }
            return {
              ...schema,
              label: formFieldLabels[schema.fieldName] ?? schema.label,
            };
          }),
          hiddenFields,
        ),
        'sale-return-form-select-dropdown',
      ),
    ),
  );
}

/** 表单的明细表格列 */
export function useFormItemColumns(
  formData?: any[],
  disabled?: boolean,
  hiddenFields: string[] = [],
  options: PrepareSaleDocumentItemColumnOptions = {},
): VxeTableGridOptions['columns'] {
  const columns = applySaleItemColumnPermission(
    [
      { type: 'seq', title: '序号', minWidth: 50 },
      {
        field: 'warehouseId',
        title: '仓库名称',
        minWidth: 150,
        sortable: true,
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
        field: 'batchNo',
        title: '批次号',
        minWidth: 120,
        sortable: true,
      },
      {
        field: 'productId',
        title: '产品名称',
        minWidth: 200,
        sortable: true,
        slots: { default: 'productId' },
      },
      {
        field: 'productCode',
        title: '产品编号',
        minWidth: 130,
        sortable: true,
      },
      {
        field: 'count',
        title: '数量',
        minWidth: 120,
        sortable: true,
        slots: { default: 'count' },
      },
      {
        field: 'productPrice',
        title: '产品单价',
        minWidth: 120,
        sortable: true,
        slots: { default: 'productPrice' },
      },
      {
        field: 'totalPrice',
        title: '合计金额',
        minWidth: 120,
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'totalPrice')
            ? () => '****'
            : 'formatAmount2',
        sortable: true,
      },
      {
        field: 'stockCount',
        title: '库存',
        minWidth: 80,
        formatter: 'formatAmount3',
        sortable: true,
      },
      {
        field: 'productBarCode',
        title: '条码',
        minWidth: 120,
        sortable: true,
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
        sortable: true,
      },
      {
        field: 'pieceCount',
        title: '件数',
        minWidth: 80,
        formatter: saleItemPieceCountColumnFormatter,
      },
      {
        field: 'returnReason',
        title: '退货原因',
        minWidth: 150,
        sortable: true,
        slots: { default: 'returnReason' },
      },
      {
        field: 'warehousePosition',
        title: '货位/仓位',
        minWidth: 120,
        sortable: true,
        slots: { default: 'warehousePosition' },
      },
      {
        field: 'outCount',
        title: '已出库',
        formatter: 'formatAmount3',
        minWidth: 120,
        sortable: true,
        visible: formData && formData[0]?.outCount !== undefined,
      },
      {
        field: 'returnCount',
        title: '已退货',
        formatter: 'formatAmount3',
        minWidth: 120,
        sortable: true,
        visible: formData && formData[0]?.returnCount !== undefined,
      },
      {
        field: 'totalProductPrice',
        title: '产品金额',
        minWidth: 120,
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'totalProductPrice')
            ? () => '****'
            : 'formatAmount2',
        sortable: true,
      },
      {
        field: 'taxPercent',
        title: '税率(%)',
        minWidth: 105,
        sortable: true,
        slots: { default: 'taxPercent' },
      },
      {
        field: 'taxPrice',
        title: '税额',
        minWidth: 120,
        formatter:
          disabled && isSalePriceItemHidden(hiddenFields, 'taxPrice')
            ? () => '****'
            : 'formatAmount2',
        sortable: true,
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 150,
        sortable: true,
        slots: { default: 'remark' },
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
    rows: formData ?? [],
    ...options,
  });
}

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return withCandidateFocus(
    withEnterBlurInputSchemas(
      withSelectPopupClassName(
        [
          {
            fieldName: 'customerId',
            label: '客户',
            component: 'CustomerLazySelect',
            componentProps: getCustomerSelectProps(),
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
            fieldName: 'workflowStatus',
            label: '业务状态',
            component: 'Select',
            componentProps: {
              allowClear: true,
              placeholder: '请选择业务状态',
              options: [
                { label: '草稿', value: '0' },
                { label: '待下单确认', value: '10' },
                { label: '待拣货', value: 'pick-waiting' },
                { label: '部分拣货', value: 'pick-partial' },
                { label: '已审批', value: '20' },
              ],
            },
          },
          {
            fieldName: 'deptId',
            label: '所属部门',
            component: 'ErpLazyPageSelect',
            componentProps: {
              popupClassName: 'sale-return-search-select-dropdown',
              placeholder: '请选择所属部门',
              allowClear: true,
              showSearch: true,
              pageSize: 10,
              api: getSaleReturnDeptSimplePage,
              labelField: 'name',
              valueField: 'id',
              loadErrorMessage: '部门列表加载失败，请重试',
            },
          },
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
            fieldName: 'creator',
            label: '创建人',
            component: 'ErpLazyPageSelect',
            componentProps: {
              popupClassName: 'sale-return-search-select-dropdown',
              placeholder: '请选择创建人',
              allowClear: true,
              showSearch: true,
              pageSize: 10,
              api: getSaleReturnUserSimplePage,
              labelField: 'nickname',
              valueField: 'id',
              loadErrorMessage: '创建人列表加载失败，请重试',
            },
          },
          {
            fieldName: 'handler',
            label: '制单人',
            component: 'ErpLazyPageSelect',
            componentProps: {
              popupClassName: 'sale-return-search-select-dropdown',
              placeholder: '请选择制单人',
              allowClear: true,
              showSearch: true,
              pageSize: 10,
              api: getSaleReturnUserSimplePage,
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
        ],
        'sale-return-search-select-dropdown',
      ),
    ),
  );
}

/** 列表的字段 */
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
      field: 'wechatNotifyAction',
      title: '微信通知',
      width: 62,
      slots: { default: 'wechatNotifyAction' },
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
      title: '单号',
      width: 112,
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
      field: 'status',
      title: '状态',
      width: 96,
      sortable: true,
      slots: { default: 'status' },
    },
    {
      field: 'pickProgress',
      title: '拣货进度',
      width: 86,
      slots: { default: 'pickProgress' },
    },
    {
      field: 'confirmTime',
      title: '下单确认时间',
      width: 142,
      formatter: 'formatDateTime',
    },
    {
      field: 'confirmUserName',
      title: '下单确认人',
      width: 96,
      showOverflow: 'tooltip',
    },
    {
      field: 'continueBuyAction',
      title: '继续选购',
      width: 62,
      slots: { default: 'continueBuyAction' },
    },
    {
      field: 'approveTime',
      title: '审核日期',
      width: 112,
      slots: { default: 'approveTime' },
    },
    {
      field: 'customerCode',
      title: '客户编码',
      width: 100,
      showOverflow: 'tooltip',
    },
    {
      field: 'customerName',
      title: '客户名称',
      width: 112,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'returnMode',
      title: '退货类型',
      width: 92,
      sortable: true,
      formatter: ({ cellValue }) => {
        if (cellValue === 10) return '按销售退货';
        if (cellValue === 20) return '按库存退货';
        return '';
      },
    },
    {
      field: 'orderMethod',
      title: '开单方式',
      width: 84,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'totalCount',
      title: '退货总数量',
      formatter: 'formatAmount3',
      width: 88,
      align: 'right',
      sortable: true,
    },
    {
      field: 'settleMethod',
      title: '结算方式',
      width: 84,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'deliveryMethod',
      title: '送货方式',
      width: 84,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'totalProductPrice',
      title: '实际金额',
      formatter: 'formatAmount2',
      width: 84,
      align: 'right',
      sortable: true,
    },
    {
      field: 'discountPrice',
      title: '优惠',
      formatter: 'formatAmount2',
      width: 72,
      align: 'right',
      sortable: true,
    },
    {
      field: 'totalPrice',
      title: '应收金额',
      formatter: 'formatAmount2',
      width: 84,
      align: 'right',
      sortable: true,
    },
    {
      field: 'totalWeight',
      title: '总重',
      width: 72,
      align: 'right',
      formatter: 'formatAmount3',
    },
    {
      field: 'invoiceType',
      title: '票据类型',
      width: 84,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'billNo',
      title: '票据号',
      width: 100,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'deliveryNo',
      title: '配送单号',
      width: 100,
      showOverflow: 'tooltip',
    },
    {
      field: 'logisticsCompany',
      title: '物流公司',
      width: 100,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'logisticsNo',
      title: '物流单号',
      width: 100,
      showOverflow: 'tooltip',
    },
    {
      field: 'deptName',
      title: '\u90E8\u95E8',
      width: 80,
      sortable: true,
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
      field: 'handlerName',
      title: '制单人',
      width: 72,
      sortable: true,
      showOverflow: 'tooltip',
      slots: { default: 'handlerName' },
    },
    {
      field: 'auditorName',
      title: '审核人',
      width: 72,
      showOverflow: 'tooltip',
      slots: { default: 'auditorName' },
    },
    {
      field: 'printTime',
      title: '打印时间',
      width: 112,
      formatter: 'formatDateTime',
    },
    {
      field: 'priority',
      title: '优先级',
      width: 72,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'remark',
      title: '\u5907\u6CE8',
      width: 120,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'confirmTime',
      title: '确认时间',
      width: 112,
      formatter: 'formatDateTime',
    },
    {
      field: 'actions',
      title: '操作',
      width: 72,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareSaleDocumentListColumns(columns, rows);
}

/** 列表的搜索表单 */
export function useOrderGridFormSchema(): VbenFormSchema[] {
  return withCandidateFocus(
    withEnterBlurInputSchemas([
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
        fieldName: 'customerId',
        label: '客户',
        component: 'CustomerLazySelect',
        componentProps: getCustomerSelectProps(),
      },
      {
        fieldName: 'productId',
        label: '产品',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择产品',
          allowClear: true,
          showSearch: true,
          filterOption: filterErpProductOption,
          api: getProductSimpleList,
          labelField: 'name',
          valueField: 'id',
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
    ]),
  );
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
      field: 'customerName',
      title: '客户',
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
      formatter: 'formatAmount3',
      minWidth: 120,
    },
    {
      field: 'returnCount',
      title: '已退货数量',
      formatter: 'formatAmount3',
      minWidth: 120,
    },
    {
      field: 'totalProductPrice',
      title: '金额合计',
      formatter: 'formatAmount2',
      minWidth: 120,
    },
    {
      field: 'totalPrice',
      title: '含税金额',
      formatter: 'formatAmount2',
      minWidth: 120,
    },
  ];
}
