import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import {
  getWarehouseMoveDeptSimplePage,
  getWarehouseMoveUserSimplePage,
} from '#/api/erp/stock/warehouse-move';
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
} from '../utils/field-permission';
import { stockItemPieceCountColumnFormatter } from '../utils/item-piece-count';

type HiddenFields = Set<string> | string[];

export function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(
    option?.label ?? option?.name ?? option?.nickname ?? option?.title ?? '',
  );
  return label.toLowerCase().includes(keyword);
}

export function useFormSchema(
  formType: string,
  hiddenFields: HiddenFields = [],
  options: {
    onWarehouseChange?: () => void;
    onWarehouseOptionsChange?: (options: any[]) => void;
  } = {},
): VbenFormSchema[] {
  const disabled = formType === 'detail';
  const isDetail = formType === 'detail';
  const schema: VbenFormSchema[] = [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'deptId',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'no',
      label: '移货单号',
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '系统自动生成',
      },
    },
    {
      fieldName: 'moveTime',
      label: '移货日期',
      component: 'DatePicker',
      componentProps: {
        disabled,
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择移货日期',
        showTime: true,
        valueFormat: 'x',
      },
      rules: 'required',
    },
    ...(isDetail
      ? [
          {
            fieldName: 'sourceNo',
            label: '来源单号',
            component: 'Input' as const,
            componentProps: { disabled: true },
          },
        ]
      : []),
    isDetail
      ? {
          fieldName: 'fromWarehouseId',
          label: '移出仓库',
          component: 'Input',
          componentProps: {
            allowClear: false,
            class: 'w-full stock-document-form-readonly-text',
            disabled: true,
          },
        }
      : {
          fieldName: 'fromWarehouseId',
          label: '移出仓库',
          component: 'ErpLazyPageSelect',
          componentProps: {
            api: (params: any) =>
              getWarehouseSimplePage({ ...params, bizType: 'stockMoveFrom' }),
            allowClear: true,
            disabled,
            labelField: 'name',
            onChange: options.onWarehouseChange,
            onOptionsChange: options.onWarehouseOptionsChange,
            pageSize: 10,
            placeholder: '请选择移出仓库',
            popupClassName: 'stock-document-form-select-dropdown',
            showSearch: true,
            valueField: 'id',
            loadErrorMessage: '移出仓库列表加载失败，请重试',
          },
          rules: 'required',
        },
    isDetail
      ? {
          fieldName: 'toWarehouseId',
          label: '移入仓库',
          component: 'Input',
          componentProps: {
            allowClear: false,
            class: 'w-full stock-document-form-readonly-text',
            disabled: true,
          },
        }
      : {
          fieldName: 'toWarehouseId',
          label: '移入仓库',
          component: 'ErpLazyPageSelect',
          componentProps: {
            api: (params: any) =>
              getWarehouseSimplePage({ ...params, bizType: 'stock' }),
            allowClear: true,
            disabled,
            labelField: 'name',
            onChange: options.onWarehouseChange,
            onOptionsChange: options.onWarehouseOptionsChange,
            pageSize: 10,
            placeholder: '请选择移入仓库',
            popupClassName: 'stock-document-form-select-dropdown',
            showSearch: true,
            valueField: 'id',
            loadErrorMessage: '移入仓库列表加载失败，请重试',
          },
          rules: 'required',
        },
    isDetail
      ? {
          fieldName: 'handlerId',
          label: '经办人',
          component: 'Input',
          componentProps: {
            allowClear: false,
            class: 'w-full stock-document-form-readonly-text',
            disabled: true,
          },
        }
      : {
          fieldName: 'handlerId',
          label: '经办人',
          component: 'ErpLazyPageSelect',
          componentProps: {
            api: getWarehouseMoveUserSimplePage,
            allowClear: true,
            disabled,
            labelField: 'nickname',
            pageSize: 10,
            placeholder: '请选择经办人',
            popupClassName: 'stock-document-form-select-dropdown',
            showSearch: true,
            valueField: 'id',
            loadErrorMessage: '经办人列表加载失败，请重试',
          },
        },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'Textarea',
      componentProps: {
        autoSize: { minRows: 1, maxRows: 1 },
        disabled,
        placeholder: '请输入备注',
      },
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'fileUrl',
      label: '附件',
      component: 'FileUpload',
      componentProps: {
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
        disabled,
        maxNumber: 1,
        maxSize: 10,
        showDescription: !disabled,
      },
      formItemClass: 'col-span-4',
    },
    {
      fieldName: 'items',
      label: '移货明细',
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
  hiddenFields: HiddenFields = [],
): VxeTableGridOptions['columns'] {
  const columns: VxeTableGridOptions['columns'] = [
    { type: 'seq', title: '序号', width: 60 },
    { field: 'productCode', title: '编码', minWidth: 120 },
    {
      field: 'productName',
      title: '零件名称',
      minWidth: 180,
      slots: { default: 'productName' },
    },
    {
      field: 'count',
      title: '移货数量',
      minWidth: 120,
      slots: { default: 'count' },
    },
    { field: 'fromShelf', title: '移出货架', minWidth: 110 },
    {
      field: 'toShelf',
      title: '移入货架',
      minWidth: 130,
      slots: { default: 'toShelf' },
    },
    { field: 'vehicleModel', title: '适用车型', minWidth: 140 },
    { field: 'originPlace', title: '产地', minWidth: 100 },
    { field: 'standard', title: '规格', minWidth: 110 },
    { field: 'featureCode', title: '特征码', minWidth: 110 },
    { field: 'brand', title: '品牌', minWidth: 100 },
    { field: 'drawingNo', title: '图号', minWidth: 110 },
    { field: 'productUnitName', title: '单位', minWidth: 80 },
    { field: 'batchNo', title: '批次号', minWidth: 120 },
    { field: 'packageQty', title: '包装数', minWidth: 90 },
    {
      field: 'pieceCount',
      title: '件数',
      minWidth: 80,
      sortable: true,
      formatter: stockItemPieceCountColumnFormatter,
    },
    { field: 'fromWarehouseName', title: '移出仓库', minWidth: 130 },
    {
      field: 'fromStockCount',
      title: '移出库存',
      minWidth: 110,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
    },
    { field: 'toWarehouseName', title: '移入仓库', minWidth: 130 },
    {
      field: 'toStockCount',
      title: '移入库存',
      minWidth: 110,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
    },
    {
      field: 'costPrice',
      title: '成本单价',
      minWidth: 120,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'costAmount',
      title: '成本金额',
      minWidth: 120,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'productPrice',
      title: '移货单价',
      minWidth: 120,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'totalPrice',
      title: '移货金额',
      minWidth: 120,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'weight',
      title: '单重',
      minWidth: 90,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
    },
    {
      field: 'totalWeight',
      title: '总重',
      minWidth: 100,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
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
  ];
  const sortableColumns = columns.map((column) =>
    column.field && column.field !== 'actions'
      ? { ...column, sortable: true }
      : column,
  );
  return applyStockItemColumnPermission(sortableColumns, hiddenFields);
}

export function useGridFormSchema(): VbenFormSchema[] {
  return withCandidateFocus([
    {
      fieldName: 'no',
      label: '移货单号',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入移货单号' },
    },
    {
      fieldName: 'moveTime',
      label: '移货日期',
      component: 'RangePicker',
      componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
    },
    {
      fieldName: 'fromWarehouseId',
      label: '移出仓库',
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stockMoveFrom' }),
        allowClear: true,
        labelField: 'name',
        pageSize: 10,
        placeholder: '请选择移出仓库',
        popupClassName: 'warehouse-move-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
        loadErrorMessage: '移出仓库列表加载失败，请重试',
      },
    },
    {
      fieldName: 'toWarehouseId',
      label: '移入仓库',
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stock' }),
        allowClear: true,
        labelField: 'name',
        pageSize: 10,
        placeholder: '请选择移入仓库',
        popupClassName: 'warehouse-move-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
        loadErrorMessage: '移入仓库列表加载失败，请重试',
      },
    },
    {
      fieldName: 'productKeyword',
      label: '产品',
      component: 'Input',
      componentProps: {
        allowClear: true,
        'data-erp-product-keyword-search-input': 'true',
        placeholder: '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
      },
    },
    {
      fieldName: 'deptId',
      label: '所属部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getWarehouseMoveDeptSimplePage,
        allowClear: true,
        labelField: 'name',
        pageSize: 10,
        placeholder: '请选择所属部门',
        popupClassName: 'warehouse-move-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'creator',
      label: '创建人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getWarehouseMoveUserSimplePage,
        allowClear: true,
        labelField: 'nickname',
        pageSize: 10,
        placeholder: '请选择创建人',
        popupClassName: 'warehouse-move-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
        loadErrorMessage: '创建人列表加载失败，请重试',
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        allowClear: true,
        filterOption: filterSelectOption,
        options: [
          { label: '草稿', value: 0 },
          { label: '待下单确认', value: 10 },
          { label: '拣货中', value: 15 },
          { label: '已审核', value: 20 },
          { label: '已作废', value: 30 },
        ],
        placeholder: '请选择状态',
        popupClassName: 'warehouse-move-search-select-dropdown',
        showSearch: true,
      },
    },
    {
      fieldName: 'pickStatus',
      label: '拣货状态',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '待拣货', value: 10 },
          { label: '部分拣货', value: 20 },
          { label: '已拣货', value: 30 },
        ],
        placeholder: '请选择拣货状态',
        popupClassName: 'warehouse-move-search-select-dropdown',
      },
    },
    {
      fieldName: 'sourceNo',
      label: '来源单号',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入来源单号' },
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入备注' },
    },
  ]);
}

export function useGridColumns(
  hiddenFields: HiddenFields = [],
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  const columns: VxeTableGridOptions['columns'] = [
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
      width: 48,
      slots: { default: 'printAction' },
    },
    {
      field: 'no',
      title: '移货单号',
      width: 150,
      sortable: true,
      slots: { default: 'no' },
    },
    {
      field: 'moveTime',
      title: '移货日期',
      width: 138,
      formatter: 'formatDate',
      sortable: true,
    },
    {
      field: 'moveType',
      title: '移货类型',
      width: 82,
      formatter: ({ row }: any) => row.moveType || '同价移货',
      showOverflow: 'tooltip',
    },
    {
      field: 'fromWarehouseName',
      title: '移出仓库',
      width: 108,
      sortable: true,
    },
    {
      field: 'toWarehouseName',
      title: '移入仓库',
      width: 108,
      sortable: true,
    },
    {
      field: 'status',
      sortable: true,
      title: '状态',
      width: 78,
      slots: { default: 'status' },
    },
    {
      field: 'pickProgress',
      title: '拣货进度',
      width: 96,
      showOverflow: 'tooltip',
    },
    { field: 'itemCount', title: '项数', width: 64, sortable: true },
    {
      field: 'totalCount',
      title: '移货数',
      width: 92,
      formatter: ({ cellValue }: any) => formatStockNaturalNumber(cellValue),
      sortable: true,
    },
    {
      field: 'totalCostAmount',
      title: '总成本金额',
      width: 102,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      sortable: true,
    },
    {
      field: 'totalPrice',
      title: '移货总金额',
      width: 102,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      sortable: true,
    },
    { field: 'handlerName', title: '经办人', width: 82, sortable: true },
    {
      field: 'firstAuditUserName',
      title: '初审人',
      width: 82,
      showOverflow: 'tooltip',
    },
    {
      field: 'firstAuditTime',
      title: '初审时间',
      width: 138,
      formatter: 'formatDate',
    },
    {
      field: 'approveUserName',
      title: '审核人',
      width: 82,
      sortable: true,
    },
    {
      field: 'approveTime',
      title: '审核时间',
      width: 138,
      formatter: 'formatDate',
      sortable: true,
    },
    {
      field: 'sourceNo',
      title: '来源',
      width: 112,
      showOverflow: 'tooltip',
    },
    {
      field: 'remark',
      title: '备注',
      width: 130,
      showOverflow: 'tooltip',
      sortable: true,
    },
    {
      field: 'actions',
      title: '操作',
      width: 146,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareStockDocumentListColumns(
    applyStockListColumnPermission(columns, hiddenFields) || [],
    rows,
  );
}
