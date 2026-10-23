import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getSupplierSimpleList } from '#/api/erp/purchase/supplier';
import {
  getStockInDeptSimplePage,
  getStockInUserSimplePage,
} from '#/api/erp/stock/in';
import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import {
  stockListNumber,
  stockNatural,
} from '#/views/erp/stock/utils/stock-decimal';
import { filterErpBusinessPartnerOption } from '#/views/erp/utils/business-partner-select';
import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';

import { prepareStockDocumentListColumns } from '../utils/document-list-table';
import {
  applyStockFormFieldPermission,
  applyStockItemColumnPermission,
  applyStockListColumnPermission,
  applyStockQueryFieldPermission,
} from '../utils/field-permission';
import { stockItemPieceCountColumnFormatter } from '../utils/item-piece-count';

type HiddenFields = Set<string> | string[];

const STOCK_DOCUMENT_STATUS_OPTIONS = [
  { label: '待下单确认', value: 10 },
  { label: '待拣货/部分拣货', value: 15 },
  { label: '已审批', value: 20 },
];
const PICK_STATUS_OPTIONS = [
  { label: '待拣货', value: 10 },
  { label: '部分拣货', value: 20 },
  { label: '已拣货', value: 30 },
];

/** 表单的配置项 */
export function useFormSchema(
  formType: string,
  hiddenFields: HiddenFields = [],
): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
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
      label: '入库单号',
      component: 'Input',
      componentProps: {
        placeholder: '系统自动生成',
        disabled: true,
      },
    },
    {
      fieldName: 'inTime',
      label: '入库时间',
      component: 'DatePicker',
      componentProps: {
        placeholder: '选择入库时间',
        showTime: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        valueFormat: 'x',
      },
      rules: 'required',
    },
    {
      label: '供应商',
      fieldName: 'supplierId',
      component: 'SupplierLazySelect',
      componentProps: {
        placeholder: '请选择供应商',
        allowClear: true,
        showSearch: true,
        popupClassName: 'stock-document-form-select-dropdown',
      },
      rules: 'required',
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
      formItemClass: 'col-span-4',
    },
    {
      fieldName: 'items',
      label: '入库产品清单',
      component: 'Input',
      formItemClass: 'col-span-4',
    },
  ];
  return withCandidateFocus(
    applyStockFormFieldPermission(schema, hiddenFields),
  );
}

/** 表单的明细表格列 */
export function useFormItemColumns(
  disabled: boolean,
  hiddenFields: HiddenFields = [],
): VxeTableGridOptions['columns'] {
  const columns: VxeTableGridOptions['columns'] = [
    { type: 'seq', title: '序号', minWidth: 50 },
    {
      field: 'warehouseId',
      title: '仓库名称',
      minWidth: 160,
      sortable: true,
      slots: { default: 'warehouseId' },
    },
    {
      field: 'productId',
      title: '产品名称',
      minWidth: 180,
      sortable: true,
      slots: { default: 'productId' },
    },
    {
      field: 'stockCount',
      title: '库存',
      minWidth: 80,
      sortable: true,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'productCode',
      title: '产品编码',
      minWidth: 120,
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
      field: 'batchNo',
      title: '批次号',
      minWidth: 120,
      sortable: true,
      slots: { default: 'batchNo' },
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
      sortable: true,
      formatter: stockItemPieceCountColumnFormatter,
    },
    {
      field: 'weight',
      title: '单重',
      minWidth: 90,
      sortable: true,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'totalWeight',
      title: '总重',
      minWidth: 100,
      sortable: true,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
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
      title: '金额',
      minWidth: 120,
      sortable: true,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'remark',
      title: '备注',
      minWidth: 180,
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
  ];
  return applyStockItemColumnPermission(columns, hiddenFields);
}

/** 列表的搜索表单 */
export function useGridFormSchema(
  hiddenFields: HiddenFields = [],
): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
    {
      fieldName: 'no',
      label: '入库单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入入库单号',
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
        'data-erp-product-keyword-search-input': 'true',
      },
    },
    {
      fieldName: 'inTime',
      label: '入库时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'supplierId',
      label: '供应商',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '请选择供应商',
        allowClear: true,
        showSearch: true,
        filterOption: filterErpBusinessPartnerOption,
        api: getSupplierSimpleList,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'stock-in-search-select-dropdown',
      },
    },
    {
      fieldName: 'warehouseId',
      label: '仓库',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择仓库',
        allowClear: true,
        showSearch: true,
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stock' }),
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'stock-in-search-select-dropdown',
        loadErrorMessage: '仓库列表加载失败，请重试',
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
        api: getStockInDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'stock-in-search-select-dropdown',
        loadErrorMessage: '部门列表加载失败，请重试',
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
        api: getStockInUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        popupClassName: 'stock-in-search-select-dropdown',
        loadErrorMessage: '创建人列表加载失败，请重试',
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        options: STOCK_DOCUMENT_STATUS_OPTIONS,
        placeholder: '请选择状态',
        allowClear: true,
        popupClassName: 'stock-in-search-select-dropdown',
      },
    },
    {
      fieldName: 'pickStatus',
      label: '拣货状态',
      component: 'Select',
      componentProps: {
        options: PICK_STATUS_OPTIONS,
        placeholder: '请选择拣货状态',
        allowClear: true,
        popupClassName: 'stock-in-search-select-dropdown',
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
  ];
  return withCandidateFocus(
    applyStockQueryFieldPermission(schema, hiddenFields),
  );
}

/** 列表的字段 */
export function useGridColumns(
  hiddenFields: HiddenFields = [],
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  const columns: VxeTableGridOptions['columns'] = [
    {
      type: 'checkbox',
      width: 36,
      autoFixed: false,
    } as any,
    {
      field: 'printAction',
      title: '打印',
      width: 48,
      slots: { default: 'printAction' },
    },
    {
      field: 'printCount',
      title: '打印次数',
      width: 64,
      align: 'right',
      formatter: ({ row }) => row.printCount ?? 0,
    },
    {
      field: 'no',
      sortable: true,
      title: '单号',
      width: 132,
      slots: { default: 'no' },
    },
    {
      field: 'supplierName',
      title: '相关对象',
      showOverflow: 'tooltip',
      width: 112,
    },
    {
      field: 'warehouseNames',
      title: '仓库',
      showOverflow: 'tooltip',
      width: 120,
    },
    {
      field: 'inTime',
      sortable: true,
      title: '日期',
      width: 112,
      formatter: 'formatDate',
    },
    {
      field: 'totalCount',
      title: '总数量',
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      width: 76,
    },
    {
      field: 'totalPrice',
      title: '总金额',
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      width: 84,
    },
    {
      field: 'status',
      sortable: true,
      title: '状态',
      width: 72,
      formatter: ({ row }: any) => row.statusName ?? '-',
    },
    {
      field: 'itemCount',
      title: '项数',
      width: 56,
      formatter: ({ row }) => row.itemCount ?? row.items?.length ?? 0,
    },
    {
      field: 'pickProgress',
      title: '拣货进度',
      width: 90,
      formatter: ({ row }: any) => row.pickProgress ?? '-',
    },
    {
      field: 'remark',
      title: '备注',
      showOverflow: 'tooltip',
      width: 120,
    },
    {
      field: 'deptName',
      title: '部门',
      showOverflow: 'tooltip',
      width: 88,
    },
    {
      field: 'creatorName',
      title: '制单人',
      showOverflow: 'tooltip',
      width: 72,
    },
    {
      field: 'createTime',
      title: '制单时间',
      width: 112,
      formatter: 'formatDate',
    },
    {
      field: 'lastPrintTime',
      title: '打印时间',
      width: 112,
      formatter: 'formatDate',
    },
    {
      field: 'productNames',
      title: '产品信息',
      showOverflow: 'tooltip',
      visible: false,
      width: 112,
    },
    {
      field: 'productCodes',
      title: '产品编码',
      showOverflow: 'tooltip',
      visible: false,
      width: 100,
    },
    {
      field: 'updaterName',
      title: '修改人',
      showOverflow: 'tooltip',
      visible: false,
      width: 68,
    },
    {
      field: 'updateTime',
      sortable: true,
      title: '修改时间',
      visible: false,
      width: 112,
      formatter: 'formatDate',
    },
    {
      field: 'actions',
      title: '操作',
      width: 130,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareStockDocumentListColumns(
    applyStockListColumnPermission(columns, hiddenFields) || [],
    rows,
    { trailingFlexibleColumnMinWidth: 72 },
  );
}
