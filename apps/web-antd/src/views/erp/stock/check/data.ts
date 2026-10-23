import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';
import { formatDateTime } from '@vben/utils';

import {
  getStockCheckDeptSimplePage,
  getStockCheckUserSimplePage,
} from '#/api/erp/stock/check';
import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { isFieldHidden } from '#/composables/useFieldPermission';
import { getRangePickerDefaultProps } from '#/utils';
import {
  stockListNumber,
  stockNatural,
} from '#/views/erp/stock/utils/stock-decimal';
import { stockNatural as erpCountInputFormatter } from '#/views/erp/stock/utils/stock-decimal';
import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';

import { prepareStockDocumentListColumns } from '../utils/document-list-table';
import {
  applyStockFormFieldPermission,
  applyStockItemColumnPermission,
} from '../utils/field-permission';
import { stockItemPieceCountColumnFormatter } from '../utils/item-piece-count';

export const STOCK_CHECK_TYPE_OPTIONS = [
  { label: '盘数量', value: 1 },
  { label: '盘成本', value: 2 },
];

function toNumber(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function formatDistinctItemText(row: Record<string, any>, field: string) {
  const values = (row.items || [])
    .map((item: Record<string, any>) => item[field])
    .filter(Boolean);
  return [...new Set(values)].join('、') || '-';
}

function formatOptionalDateTime(value: unknown) {
  return value ? formatDateTime(value as Date | number | string) || '-' : '-';
}

export function getStockCheckBalanceType(row: Record<string, any>) {
  const totalCount = toNumber(row.totalCount);
  const totalPrice = toNumber(row.totalPrice);
  if (totalCount > 0) {
    return '盘盈';
  }
  if (totalCount < 0) {
    return '盘亏';
  }
  return totalPrice === 0 ? '无差异' : '成本调整';
}

function getStockCheckStatusOptions() {
  return [
    { label: '草稿', value: 0 },
    ...getDictOptions(DICT_TYPE.ERP_AUDIT_STATUS, 'number').filter(
      (item) => item.value !== 0,
    ),
  ];
}

export function useFormSchema(
  formType: string,
  hiddenFields: Set<string> | string[] = [],
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
      fieldName: 'deptId',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'deptName',
      label: '所属部门',
      component: 'Input',
      componentProps: {
        placeholder: '系统自动带出',
        disabled: true,
      },
      dependencies: {
        triggerFields: [''],
        show: () => !isFieldHidden(hiddenFields, 'deptId'),
      },
    },
    {
      fieldName: 'no',
      label: '盘点单号',
      component: 'Input',
      componentProps: {
        placeholder: '系统自动生成',
        disabled: true,
      },
    },
    {
      fieldName: 'checkType',
      label: '盘点类型',
      component: 'RadioGroup',
      componentProps: {
        options: STOCK_CHECK_TYPE_OPTIONS,
        disabled: formType !== 'create',
      },
      rules: 'required',
    },
    {
      fieldName: 'checkTime',
      label: '盘点时间',
      component: 'DatePicker',
      componentProps: {
        placeholder: '选择盘点时间',
        showTime: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        valueFormat: 'x',
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
      label: '产品清单',
      component: 'Input',
      formItemClass: 'col-span-4',
    },
  ];
  return withCandidateFocus(
    applyStockFormFieldPermission(schema, hiddenFields),
  );
}

export function useFormItemColumns(
  disabled: boolean,
  checkType = 1,
  hiddenFields: Set<string> | string[] = [],
): VxeTableGridOptions['columns'] {
  const isCostCheck = checkType === 2;
  const columns: VxeTableGridOptions['columns'] = [
    { type: 'seq', title: '序号', width: 48 },
    {
      field: 'warehouseId',
      title: '仓库名称',
      minWidth: 136,
      sortable: true,
      slots: { default: 'warehouseId' },
    },
    {
      field: 'warehouseDeptName',
      title: '仓库所属部门',
      minWidth: 112,
      sortable: true,
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
      title: '账面库存',
      width: 88,
      sortable: true,
      formatter: ({ cellValue }: any) =>
        cellValue === null || cellValue === undefined
          ? '-'
          : erpCountInputFormatter(cellValue),
    },
    {
      field: 'batchNo',
      title: '批次号',
      minWidth: 120,
      sortable: true,
      slots: { default: 'batchNo' },
    },
    {
      field: 'productCode',
      title: '产品编码',
      minWidth: 110,
      sortable: true,
    },
    {
      field: 'productBarCode',
      title: '条码',
      minWidth: 110,
      sortable: true,
    },
    {
      field: 'productUnitName',
      title: '单位',
      width: 64,
      sortable: true,
    },
    {
      field: 'packageQty',
      title: '包装数',
      formatter: ({ cellValue }: any) =>
        cellValue === null || cellValue === undefined
          ? '-'
          : erpCountInputFormatter(cellValue),
      width: 82,
      sortable: true,
    },
    {
      field: 'pieceCount',
      title: '件数',
      width: 80,
      sortable: true,
      formatter: stockItemPieceCountColumnFormatter,
    },
    {
      field: 'weight',
      title: '单重',
      width: 82,
      sortable: true,
      formatter: ({ cellValue }: any) =>
        cellValue === null || cellValue === undefined
          ? '-'
          : erpCountInputFormatter(cellValue),
    },
    {
      field: 'totalWeight',
      title: '总重',
      width: 92,
      sortable: true,
      formatter: ({ cellValue }: any) =>
        cellValue === null || cellValue === undefined
          ? '-'
          : erpCountInputFormatter(cellValue),
    },
    {
      field: 'actualCount',
      title: '实际库存',
      width: 96,
      sortable: true,
      slots: { default: 'actualCount' },
      formatter: ({ cellValue }: any) =>
        cellValue === null || cellValue === undefined
          ? '-'
          : erpCountInputFormatter(cellValue),
      visible: !isCostCheck,
    },
    {
      field: 'count',
      title: '调整数',
      width: 88,
      sortable: true,
      slots: { default: 'count' },
      formatter: ({ cellValue }: any) =>
        cellValue === null || cellValue === undefined
          ? '-'
          : erpCountInputFormatter(cellValue),
      visible: !isCostCheck,
    },
    {
      field: 'productPrice',
      title: '产品单价',
      width: 96,
      sortable: true,
      slots: { default: 'productPrice' },
    },
    {
      field: 'totalPrice',
      title: '金额',
      width: 100,
      sortable: true,
      slots: { default: 'totalPrice' },
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
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
      width: 50,
      fixed: 'right',
      slots: { default: 'actions' },
      visible: !disabled,
    },
  ];
  return applyStockItemColumnPermission(columns, hiddenFields);
}

export function useGridFormSchema(): VbenFormSchema[] {
  return withCandidateFocus([
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
      fieldName: 'no',
      label: '盘点单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入盘点单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'checkTime',
      label: '盘点时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'checkType',
      label: '盘点类型',
      component: 'Select',
      componentProps: {
        options: STOCK_CHECK_TYPE_OPTIONS,
        placeholder: '请选择盘点类型',
        allowClear: true,
        popupClassName: 'stock-search-select-dropdown',
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
        popupClassName: 'stock-search-select-dropdown',
        api: getStockCheckDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
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
        popupClassName: 'stock-search-select-dropdown',
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stock' }),
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '仓库列表加载失败，请重试',
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
        popupClassName: 'stock-search-select-dropdown',
        api: getStockCheckUserSimplePage,
        pageSize: 10,
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
        options: getStockCheckStatusOptions(),
        placeholder: '请选择状态',
        allowClear: true,
        popupClassName: 'stock-search-select-dropdown',
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
  ]);
}

export function useGridColumns(
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  return prepareStockDocumentListColumns(
    [
      {
        type: 'checkbox',
        width: 36,
        autoFixed: false,
      } as any,
      {
        field: 'deleteAction',
        title: '删除',
        width: 40,
        slots: { default: 'deleteAction' },
      },
      {
        field: 'printAction',
        title: '打印',
        width: 48,
        slots: { default: 'printAction' },
      },
      {
        field: 'no',
        sortable: true,
        title: '单号',
        width: 132,
        slots: { default: 'no' },
      },
      {
        field: 'checkTime',
        sortable: true,
        title: '日期',
        width: 112,
        formatter: 'formatDate',
      },
      {
        field: 'status',
        sortable: true,
        title: '状态',
        width: 72,
        slots: { default: 'status' },
      },
      {
        field: 'warehouseNames',
        title: '仓库',
        width: 120,
        showOverflow: 'tooltip',
        formatter: ({ row }: any) =>
          row.warehouseNames || formatDistinctItemText(row, 'warehouseName'),
      },
      {
        field: 'checkType',
        sortable: true,
        title: '盘点类型',
        width: 84,
        formatter: ({ cellValue }) =>
          STOCK_CHECK_TYPE_OPTIONS.find((item) => item.value === cellValue)
            ?.label || '盘数量',
      },
      {
        field: 'balanceType',
        title: '类型',
        width: 76,
        formatter: ({ row }: any) => getStockCheckBalanceType(row),
      },
      {
        field: 'totalCount',
        sortable: true,
        title: '盈亏数',
        formatter: ({ cellValue }: any) =>
          cellValue === null || cellValue === undefined
            ? '-'
            : erpCountInputFormatter(cellValue),
        width: 84,
        align: 'right',
      },
      {
        field: 'totalPrice',
        sortable: true,
        title: '盈亏金额',
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        width: 92,
        align: 'right',
      },
      {
        field: 'checkerName',
        title: '盘点人',
        width: 72,
        showOverflow: 'tooltip',
        formatter: ({ row }: any) => row.creatorName || '-',
      },
      {
        field: 'deptName',
        sortable: true,
        title: '部门',
        width: 100,
        showOverflow: 'tooltip',
      },
      {
        field: 'remark',
        title: '备注',
        width: 120,
        showOverflow: 'tooltip',
      },
      {
        field: 'approveUserName',
        title: '审核人',
        width: 72,
        showOverflow: 'tooltip',
        formatter: ({ row }: any) =>
          row.status === 20 ? row.updaterName || '-' : '-',
      },
      {
        field: 'approveTime',
        title: '审核时间',
        width: 112,
        slots: { default: 'approveTime' },
      },
      {
        field: 'creatorName',
        sortable: true,
        title: '建立人',
        width: 72,
        showOverflow: 'tooltip',
      },
      {
        field: 'createTime',
        title: '建立时间',
        width: 112,
        formatter: 'formatDate',
      },
      {
        field: 'updaterName',
        title: '修改人',
        width: 72,
        showOverflow: 'tooltip',
      },
      {
        field: 'updateTime',
        sortable: true,
        title: '修改时间',
        width: 112,
        formatter: 'formatDate',
      },
      {
        field: 'itemCount',
        title: '项数',
        width: 56,
        align: 'right',
        formatter: ({ row }: any) => row.itemCount ?? row.items?.length ?? 0,
      },
      {
        field: 'printCount',
        title: '打印次数',
        width: 84,
        align: 'right',
        formatter: ({ cellValue }) => cellValue ?? 0,
      },
      {
        field: 'printTime',
        title: '打印时间',
        width: 112,
        formatter: ({ cellValue }) => formatOptionalDateTime(cellValue),
      },
      {
        title: '操作',
        field: 'actions',
        width: 146,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    rows,
  );
}
