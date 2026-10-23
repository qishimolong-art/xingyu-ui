import { stockMoney } from '#/views/erp/stock/utils/stock-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import {
  getStockTransferOutFromDeptSimplePage,
  getStockTransferOutToDeptSimplePage,
  getStockTransferOutUserSimplePage,
} from '#/api/erp/stock/transfer-out';
import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import { formatStockNaturalNumber } from '#/views/erp/stock/utils/document-number';
import {
  stockListNumber,
  stockNatural,
} from '#/views/erp/stock/utils/stock-decimal';
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

function formatWarehouseNames(
  row: Record<string, any>,
  field: 'fromWarehouseName' | 'toWarehouseName',
) {
  const summaryField =
    field === 'fromWarehouseName' ? 'fromWarehouseNames' : 'toWarehouseNames';
  if (row[summaryField]) {
    return row[summaryField];
  }
  const names = (row.items || [])
    .map((item: Record<string, any>) => item[field])
    .filter(Boolean);
  return [...new Set(names)].join('、') || '-';
}

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
      fieldName: 'deptId',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'no',
      label: '调拨出库单号',
      component: 'Input',
      componentProps: {
        placeholder: '系统自动生成',
        disabled: true,
      },
    },
    {
      fieldName: 'sourceNo',
      label: '来源单号',
      component: 'Input',
      componentProps: {
        placeholder: '无来源单号',
        disabled: true,
      },
    },
    {
      fieldName: 'directCustomerName',
      label: '直发客户',
      component: 'Input',
      componentProps: {
        placeholder: '无直发客户',
        disabled: true,
      },
    },
    {
      fieldName: 'moveTime',
      label: '开单日期',
      component: 'DatePicker',
      componentProps: {
        placeholder: '选择调度时间',
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

/** 表单的明细表格列 */
export function useFormItemColumns(
  disabled: boolean,
  hiddenFields: HiddenFields = [],
): VxeTableGridOptions['columns'] {
  const columns: VxeTableGridOptions['columns'] = [
    { type: 'seq', title: '序号', minWidth: 50 },
    {
      field: 'fromWarehouseId',
      title: '调出仓库',
      sortable: true,
      minWidth: 160,
      slots: { default: 'fromWarehouseId' },
    },
    {
      field: 'fromWarehouseDeptName',
      title: '调出仓库部门',
      sortable: true,
      minWidth: 140,
      showOverflow: 'tooltip',
    },
    {
      field: 'toWarehouseId',
      title: '调入仓库',
      sortable: true,
      minWidth: 160,
      slots: { default: 'toWarehouseId' },
    },
    {
      field: 'toWarehouseDeptName',
      title: '调入仓库部门',
      sortable: true,
      minWidth: 140,
      showOverflow: 'tooltip',
    },
    {
      field: 'productId',
      title: '产品名称',
      sortable: true,
      minWidth: 200,
      slots: { default: 'productId' },
    },
    {
      field: 'stockCount',
      title: '库存',
      sortable: true,
      minWidth: 80,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
    },
    {
      field: 'batchNo',
      title: '批次号',
      sortable: true,
      minWidth: 120,
      slots: { default: 'batchNo' },
    },
    {
      field: 'productPrice',
      title: '产品单价',
      sortable: true,
      minWidth: 120,
      slots: { default: 'productPrice' },
    },
    {
      field: 'count',
      title: '数量',
      sortable: true,
      minWidth: 120,
      slots: { default: 'count' },
    },
    {
      field: 'productCode',
      title: '产品编码',
      sortable: true,
      minWidth: 120,
    },
    {
      field: 'productBarCode',
      title: '条码',
      sortable: true,
      minWidth: 120,
    },
    {
      field: 'productUnitName',
      title: '单位',
      sortable: true,
      minWidth: 80,
    },
    {
      field: 'packageQty',
      title: '包装数',
      sortable: true,
      minWidth: 90,
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
      sortable: true,
      minWidth: 90,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
    },
    {
      field: 'totalWeight',
      title: '总重',
      sortable: true,
      minWidth: 100,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
    },
    {
      field: 'totalPrice',
      title: '金额',
      sortable: true,
      minWidth: 120,
      formatter: ({ cellValue }: any) => stockMoney(cellValue),
    },
    {
      field: 'remark',
      title: '备注',
      sortable: true,
      minWidth: 150,
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
      fieldName: 'keyword',
      label: '关键词',
      component: 'Input',
      componentProps: {
        placeholder: '请输入关键词，产品多个条件可用 / 或空格分隔',
        allowClear: true,
        'data-erp-keyword-search-input': 'true',
      },
    },
    {
      fieldName: 'no',
      label: '调拨出库单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入调拨出库单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'moveTime',
      label: '开单日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'sourceNo',
      label: '来源单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入来源单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'fromDeptId',
      label: '调出部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择调出部门',
        allowClear: true,
        showSearch: true,
        api: getStockTransferOutFromDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'transfer-out-search-select-dropdown',
        loadErrorMessage: '调出部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'toDeptId',
      label: '调入部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择调入部门',
        allowClear: true,
        showSearch: true,
        api: getStockTransferOutToDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'transfer-out-search-select-dropdown',
        loadErrorMessage: '调入部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'fromWarehouseId',
      label: '调出仓库',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择调出仓库',
        allowClear: true,
        showSearch: true,
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stockMoveFrom' }),
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'transfer-out-search-select-dropdown',
        loadErrorMessage: '调出仓库列表加载失败，请重试',
      },
    },
    {
      fieldName: 'toWarehouseId',
      label: '调入仓库',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择调入仓库',
        allowClear: true,
        showSearch: true,
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stock' }),
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'transfer-out-search-select-dropdown',
        loadErrorMessage: '调入仓库列表加载失败，请重试',
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
      fieldName: 'creator',
      label: '经手人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择创建人',
        allowClear: true,
        showSearch: true,
        api: getStockTransferOutUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        popupClassName: 'transfer-out-search-select-dropdown',
        loadErrorMessage: '经手人列表加载失败，请重试',
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        options: [
          { label: '草稿', value: 0 },
          ...getDictOptions(DICT_TYPE.ERP_AUDIT_STATUS, 'number'),
        ],
        placeholder: '请选择状态',
        allowClear: true,
        popupClassName: 'transfer-out-search-select-dropdown',
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
  return applyStockQueryFieldPermission(schema, hiddenFields);
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
      field: 'deleteAction',
      title: '删除',
      width: 40,
      slots: { default: 'deleteAction' },
    },
    {
      field: 'printAction',
      title: '打印(次数)',
      width: 76,
      slots: { default: 'printAction' },
    },
    {
      field: 'wechatNotifyAction',
      title: '微信通知',
      width: 62,
      slots: { default: 'wechatNotifyAction' },
    },
    {
      field: 'no',
      sortable: true,
      title: '单号',
      width: 132,
      slots: { default: 'no' },
    },
    {
      field: 'settleStatus',
      title: '结算状态',
      width: 76,
      slots: { default: 'settleStatus' },
    },
    {
      field: 'moveTime',
      sortable: true,
      title: '日期',
      width: 112,
      formatter: 'formatDate',
    },
    {
      field: 'continueBuyAction',
      title: '继续选购',
      width: 62,
      slots: { default: 'continueBuyAction' },
    },
    {
      field: 'fromDeptName',
      sortable: true,
      title: '调出部门',
      width: 100,
      showOverflow: 'tooltip',
    },
    {
      field: 'fromWarehouseNames',
      sortable: true,
      title: '调出仓库',
      width: 120,
      showOverflow: 'tooltip',
      formatter: ({ row }: any) =>
        row.fromWarehouseNames ||
        formatWarehouseNames(row, 'fromWarehouseName'),
    },
    {
      field: 'toDeptName',
      sortable: true,
      title: '调入部门',
      width: 100,
      showOverflow: 'tooltip',
    },
    {
      field: 'toWarehouseNames',
      sortable: true,
      title: '调入仓库',
      width: 120,
      showOverflow: 'tooltip',
      formatter: ({ row }: any) =>
        row.toWarehouseNames || formatWarehouseNames(row, 'toWarehouseName'),
    },
    {
      field: 'sourceNo',
      sortable: true,
      title: '来源单号',
      showOverflow: 'tooltip',
      width: 112,
    },
    {
      field: 'status',
      sortable: true,
      title: '状态',
      width: 72,
      slots: { default: 'status' },
    },
    {
      field: 'totalCount',
      sortable: true,
      title: '调出数量',
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
      width: 84,
      align: 'right',
    },
    {
      field: 'totalPrice',
      sortable: true,
      title: '调出金额',
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      width: 84,
      align: 'right',
    },
    {
      field: 'transferType',
      title: '调拨类型',
      width: 84,
      showOverflow: 'tooltip',
    },
    {
      field: 'directCustomerName',
      title: '直发客户',
      showOverflow: 'tooltip',
      width: 100,
    },
    {
      field: 'paymentMethod',
      title: '付款方式',
      showOverflow: 'tooltip',
      width: 84,
    },
    {
      field: 'priorityLevel',
      title: '优先级别',
      showOverflow: 'tooltip',
      width: 76,
    },
    {
      field: 'invoiceType',
      title: '开票类型',
      showOverflow: 'tooltip',
      width: 80,
    },
    {
      field: 'invoiceNo',
      title: '票据号',
      showOverflow: 'tooltip',
      width: 100,
    },
    {
      field: 'deliveryMethod',
      title: '运输方式',
      showOverflow: 'tooltip',
      width: 84,
    },
    {
      field: 'itemCount',
      title: '项数',
      width: 56,
      align: 'right',
      formatter: ({ row }: any) => row.itemCount ?? row.items?.length ?? 0,
    },
    {
      field: 'remark',
      sortable: true,
      title: '备注',
      showOverflow: 'tooltip',
      width: 120,
    },
    {
      field: 'logisticsNo',
      title: '物流单号',
      showOverflow: 'tooltip',
      width: 110,
    },
    {
      field: 'logisticsCompany',
      title: '物流公司',
      showOverflow: 'tooltip',
      width: 100,
    },
    {
      field: 'signImageUrl',
      title: '签收图片',
      width: 64,
      slots: { default: 'signImageUrl' },
    },
    {
      field: 'handlerName',
      title: '经手人',
      width: 72,
      showOverflow: 'tooltip',
      slots: { default: 'handlerName' },
    },
    {
      field: 'approveUserName',
      title: '审核人',
      width: 72,
      showOverflow: 'tooltip',
    },
    {
      field: 'approveTime',
      title: '审核时间',
      width: 112,
      formatter: 'formatDate',
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
      sortable: true,
      title: '建立时间',
      width: 112,
      formatter: 'formatDate',
    },
    {
      field: 'updaterName',
      sortable: true,
      title: '修改人',
      width: 68,
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
      field: 'lastPrintTime',
      title: '打印时间',
      width: 112,
      formatter: 'formatDate',
    },
    {
      field: 'directSettlementMethod',
      title: '直发结算方式',
      width: 96,
      showOverflow: 'tooltip',
    },
    {
      field: 'salespersonName',
      title: '业务员',
      width: 72,
      showOverflow: 'tooltip',
      slots: { default: 'salespersonName' },
    },
    {
      field: 'actions',
      title: '操作',
      width: 72,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareStockDocumentListColumns(
    applyStockListColumnPermission(columns, hiddenFields) || [],
    rows,
  );
}
