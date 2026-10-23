import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import {
  getStockMoveDeptSimplePage,
  getStockMoveUserSimplePage,
} from '#/api/erp/stock/move';
import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import {
  stockListNumber,
  stockNatural,
} from '#/views/erp/stock/utils/stock-decimal';
import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';

import { prepareStockDocumentListColumns } from '../utils/document-list-table';
import {
  applyStockFormFieldPermission,
  applyStockItemColumnPermission,
} from '../utils/field-permission';
import { stockItemPieceCountColumnFormatter } from '../utils/item-piece-count';

/** 表单的配置项 */
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
      fieldName: 'no',
      label: '调度单号',
      component: 'Input',
      componentProps: {
        placeholder: '系统自动生成',
        disabled: true,
      },
    },
    {
      fieldName: 'moveTime',
      label: '调度时间',
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
  hiddenFields: Set<string> | string[] = [],
): VxeTableGridOptions['columns'] {
  const columns: VxeTableGridOptions['columns'] = [
    { type: 'seq', title: '序号', minWidth: 50 },
    {
      field: 'fromWarehouseId',
      title: '调出仓库',
      minWidth: 150,
      slots: { default: 'fromWarehouseId' },
    },
    {
      field: 'fromWarehouseDeptName',
      title: '调出仓库部门',
      minWidth: 140,
      showOverflow: 'tooltip',
    },
    {
      field: 'toWarehouseId',
      title: '调入仓库',
      minWidth: 150,
      slots: { default: 'toWarehouseId' },
    },
    {
      field: 'toWarehouseDeptName',
      title: '调入仓库部门',
      minWidth: 140,
      showOverflow: 'tooltip',
    },
    {
      field: 'productId',
      title: '产品名称',
      minWidth: 200,
      slots: { default: 'productId' },
    },
    {
      field: 'stockCount',
      title: '库存',
      minWidth: 80,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'productCode',
      title: '产品编码',
      minWidth: 120,
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
      field: 'packageQty',
      title: '包装数',
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
      field: 'remark',
      title: '备注',
      minWidth: 150,
      slots: { default: 'remark' },
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
      field: 'totalPrice',
      title: '金额',
      minWidth: 120,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
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

/** 列表的搜索表单 */
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
      label: '调度单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入调度单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'moveTime',
      label: '调度时间',
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
        api: getStockMoveDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
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
        loadErrorMessage: '调入仓库列表加载失败，请重试',
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
        api: getStockMoveUserSimplePage,
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
        options: getDictOptions(DICT_TYPE.ERP_AUDIT_STATUS, 'number'),
        placeholder: '请选择状态',
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
  ]);
}

/** 列表的字段 */
export function useGridColumns(
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  return prepareStockDocumentListColumns(
    [
      {
        type: 'checkbox',
        width: 50,
        fixed: 'left',
      },
      {
        field: 'no',
        sortable: true,
        title: '调度单号',
        width: 200,
        fixed: 'left',
        slots: { default: 'no' },
      },
      {
        field: 'productNames',
        title: '产品信息',
        showOverflow: 'tooltip',
        minWidth: 120,
      },
      {
        field: 'productCodes',
        title: '产品编码',
        showOverflow: 'tooltip',
        minWidth: 120,
      },
      {
        field: 'deptName',
        title: '所属部门',
        minWidth: 120,
      },
      {
        field: 'moveTime',
        sortable: true,
        title: '调度时间',
        width: 160,
        formatter: 'formatDate',
      },
      {
        field: 'creatorName',
        title: '创建人',
        minWidth: 120,
      },
      {
        field: 'updateTime',
        sortable: true,
        title: '修改时间',
        width: 160,
        formatter: 'formatDate',
      },
      {
        field: 'totalCount',
        title: '总数量',
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        minWidth: 120,
      },
      {
        field: 'totalPrice',
        title: '总金额',
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
        minWidth: 120,
      },
      {
        field: 'status',
        sortable: true,
        title: '状态',
        minWidth: 120,
        cellRender: {
          name: 'CellDict',
          props: { type: DICT_TYPE.ERP_AUDIT_STATUS },
        },
      },
    ],
    rows,
  );
}
