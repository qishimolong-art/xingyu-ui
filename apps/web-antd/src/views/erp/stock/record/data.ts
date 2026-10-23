import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import {
  getStockWarehouseOwnerDeptSimplePage,
  getWarehouseSimplePage,
} from '#/api/erp/stock/warehouse';
import { isFieldHidden } from '#/composables/useFieldPermission';
import { getRangePickerDefaultProps } from '#/utils';
import {
  stockListNumber,
  stockNatural,
} from '#/views/erp/stock/utils/stock-decimal';

const SALE_STOCK_RECORD_BIZ_TYPES = new Set([50, 51, 60, 61, 92]);

type HiddenFieldsSource = (() => string[]) | string[];
export type StockRecordReportScene = 'default' | 'stockDetailModal';

const DEFAULT_WAREHOUSE_SEARCH_OPTIONS = { popupClassName: true } as const;

function resolveHiddenFields(hiddenFields: HiddenFieldsSource = []) {
  return typeof hiddenFields === 'function' ? hiddenFields() : hiddenFields;
}

function isStockRecordTradePriceHidden(
  hiddenFields: HiddenFieldsSource = [],
  bizType?: number,
) {
  const fields = resolveHiddenFields(hiddenFields);
  if (SALE_STOCK_RECORD_BIZ_TYPES.has(Number(bizType))) {
    return isFieldHidden(fields, 'salePrice');
  }
  return (
    isFieldHidden(fields, 'lastPurchasePrice') ||
    isFieldHidden(fields, 'purchasePrice')
  );
}

function isStockRecordCostHidden(hiddenFields: HiddenFieldsSource = []) {
  return isFieldHidden(resolveHiddenFields(hiddenFields), 'lastPurchasePrice');
}

function formatStockRecordPrice(
  hiddenFields: HiddenFieldsSource,
  row: Record<string, any>,
  field: string,
  type: 'cost' | 'trade',
) {
  const hidden =
    type === 'cost'
      ? isStockRecordCostHidden(hiddenFields)
      : isStockRecordTradePriceHidden(hiddenFields, row.bizType);
  if (hidden) {
    return '****';
  }
  const value = row[field];
  return value === undefined || value === null || value === ''
    ? '-'
    : stockNatural(value);
}

/**
 * 报表搜索表单（五期：库存进出流水明细账）
 * 列对齐客户文档 4.2 节：发生日期区间 / 单据类型多选 / 仓库 / 产品 / 车型 / 产地 / 供应商
 */
function createWarehouseSearchSchema(
  options: { popupClassName?: boolean } = DEFAULT_WAREHOUSE_SEARCH_OPTIONS,
): VbenFormSchema {
  return {
    fieldName: 'warehouseId',
    label: '仓库',
    component: 'ErpLazyPageSelect',
    componentProps: {
      placeholder: '请选择仓库',
      allowClear: true,
      showSearch: true,
      ...(options.popupClassName === false
        ? {}
        : { popupClassName: 'stock-record-search-select-dropdown' }),
      api: (params: any) =>
        getWarehouseSimplePage({ ...params, bizType: 'stock' }),
      pageSize: 10,
      labelField: 'name',
      valueField: 'id',
      loadErrorMessage: '仓库列表加载失败，请重试',
    },
  };
}

function createStockDetailModalFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'keyword',
      label: '关键词',
      component: 'Input',
      componentProps: {
        placeholder: '请输入关键词',
        allowClear: true,
        'data-erp-product-keyword-search-input': 'true',
      },
    },
    {
      fieldName: 'approveTime',
      label: '审批日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'bizTypes',
      label: '单据类型',
      component: 'Select',
      componentProps: {
        mode: 'multiple',
        placeholder: '请选择单据类型（可多选）',
        allowClear: true,
        popupClassName: 'stock-record-search-select-dropdown',
        options: getDictOptions(DICT_TYPE.ERP_STOCK_RECORD_BIZ_TYPE, 'number'),
        maxTagCount: 'responsive',
      },
    },
    createWarehouseSearchSchema(),
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择部门',
        allowClear: true,
        showSearch: true,
        popupClassName: 'stock-record-search-select-dropdown',
        api: getStockWarehouseOwnerDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
  ];
}

export function useReportGridFormSchema(
  scene: StockRecordReportScene = 'default',
): VbenFormSchema[] {
  if (scene === 'stockDetailModal') {
    return createStockDetailModalFormSchema();
  }
  return [
    {
      fieldName: 'bizDate',
      label: '开单日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'bizTypes',
      label: '单据类型',
      component: 'Select',
      componentProps: {
        mode: 'multiple',
        placeholder: '请选择单据类型（可多选）',
        allowClear: true,
        popupClassName: 'stock-record-search-select-dropdown',
        options: getDictOptions(DICT_TYPE.ERP_STOCK_RECORD_BIZ_TYPE, 'number'),
        maxTagCount: 'responsive',
      },
    },
    createWarehouseSearchSchema(),
    {
      fieldName: 'productKeyword',
      label: '产品',
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件编码、名称、拼音码、五笔码等',
        allowClear: true,
        'data-erp-product-keyword-search-input': 'true',
      },
    },
    {
      fieldName: 'productCode',
      label: '零件编码',
      component: 'Input',
      componentProps: { placeholder: '请输入零件编码', allowClear: true },
    },
    {
      fieldName: 'productName',
      label: '零件名称',
      component: 'Input',
      componentProps: { placeholder: '请输入零件名称', allowClear: true },
    },
    {
      fieldName: 'vehicleModel',
      label: '适用车型',
      component: 'Input',
      componentProps: { placeholder: '请输入适用车型', allowClear: true },
    },
    {
      fieldName: 'originPlace',
      label: '产地',
      component: 'Input',
      componentProps: { placeholder: '请输入产地', allowClear: true },
    },
    {
      fieldName: 'bizNo',
      label: '单号',
      component: 'Input',
      componentProps: { placeholder: '请输入单号关键字', allowClear: true },
    },
  ];
}

/**
 * 报表列表字段（五期：入出分列）
 * 列对齐客户文档 4.3 节
 */
export function useReportGridColumns(
  hiddenFields: HiddenFieldsSource = [],
  scene: StockRecordReportScene = 'default',
): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { type: 'seq', title: '序号', width: 55 },
    scene === 'stockDetailModal'
      ? {
          field: 'approveTime',
          title: '审批日期',
          width: 170,
          formatter: 'formatDateTime',
          sortable: true,
        }
      : {
          field: 'bizDate',
          title: '发生日期',
          width: 170,
          formatter: 'formatDateTime',
          sortable: true,
        },
    {
      field: 'bizType',
      title: '交易类型',
      width: 120,
      slots: { default: 'bizType' },
      sortable: true,
    },
    {
      field: 'bizNo',
      title: '单号',
      width: 160,
      slots: { default: 'bizNo' },
      sortable: true,
    },
    {
      field: 'productCode',
      title: '零件编码',
      width: 110,
      sortable: true,
    },
    {
      field: 'productName',
      title: '产品名称',
      minWidth: 140,
      sortable: true,
    },
    {
      field: 'batchNo',
      title: '批次号',
      width: 130,
    },
    {
      field: 'packageQty',
      title: '包装数',
      width: 90,
      sortable: true,
    },
    {
      field: 'weight',
      title: '单重',
      width: 90,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
      sortable: true,
    },
    {
      field: 'totalWeight',
      title: '总重',
      width: 100,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
      sortable: true,
    },
    {
      field: 'warehouseName',
      title: '仓库',
      width: 100,
      sortable: true,
    },
    // ========== 入库分列 ==========
    {
      field: 'inCount',
      title: '入库数',
      width: 100,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
      sortable: true,
    },
    {
      field: 'inUnitPrice',
      title: '入库单价',
      width: 110,
      formatter: ({ row }: { row: Record<string, any> }) =>
        formatStockRecordPrice(hiddenFields, row, 'inUnitPrice', 'trade'),
      sortable: true,
    },
    {
      field: 'inAmount',
      title: '入库金额',
      width: 120,
      formatter: ({ row }: { row: Record<string, any> }) =>
        formatStockRecordPrice(hiddenFields, row, 'inAmount', 'trade'),
      sortable: true,
    },
    // ========== 出库分列 ==========
    {
      field: 'outCount',
      title: '出库数',
      width: 100,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
      sortable: true,
    },
    {
      field: 'outUnitPrice',
      title: '出库成本单价',
      width: 130,
      formatter: ({ row }: { row: Record<string, any> }) =>
        formatStockRecordPrice(hiddenFields, row, 'outUnitPrice', 'trade'),
      sortable: true,
    },
    {
      field: 'outAmount',
      title: '出库成本金额',
      width: 130,
      formatter: ({ row }: { row: Record<string, any> }) =>
        formatStockRecordPrice(hiddenFields, row, 'outAmount', 'trade'),
      sortable: true,
    },
    // ========== 结存列 ==========
    {
      field: 'totalCount',
      title: '结存数',
      width: 100,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
      sortable: true,
    },
    {
      field: 'costPrice',
      title: '结存单价',
      width: 110,
      formatter: ({ row }: { row: Record<string, any> }) =>
        formatStockRecordPrice(hiddenFields, row, 'costPrice', 'cost'),
      sortable: true,
    },
    {
      field: 'costAmount',
      title: '结存金额',
      width: 120,
      formatter: ({ row }: { row: Record<string, any> }) =>
        formatStockRecordPrice(hiddenFields, row, 'costAmount', 'cost'),
      sortable: true,
    },
  ];
  if (scene === 'stockDetailModal') {
    const warehouseIndex = columns.findIndex(
      (column) => column.field === 'warehouseName',
    );
    columns.splice(Math.max(warehouseIndex + 1, 0), 0, {
      field: 'deptName',
      title: '部门',
      width: 110,
      sortable: true,
    });
    columns.push({
      field: 'bizDate',
      title: '单据时间',
      width: 170,
      formatter: 'formatDateTime',
      sortable: true,
    });
  }
  return columns;
}

/** 搜索表单（旧页保留） */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'productKeyword',
      label: '产品',
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件编码、名称、拼音码、五笔码等',
        allowClear: true,
        'data-erp-product-keyword-search-input': 'true',
      },
    },
    createWarehouseSearchSchema({ popupClassName: false }),
    {
      fieldName: 'bizType',
      label: '类型',
      component: 'Select',
      componentProps: {
        placeholder: '请选择类型',
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_STOCK_RECORD_BIZ_TYPE, 'number'),
      },
    },
    {
      fieldName: 'bizNo',
      label: '业务单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入业务单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'createTime',
      label: '创建时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'productName',
      title: '产品名称',
      minWidth: 150,
    },
    {
      field: 'categoryName',
      title: '产品分类',
      width: 120,
    },
    {
      field: 'unitName',
      title: '产品单位',
      width: 100,
    },
    {
      field: 'batchNo',
      title: '批次号',
      width: 120,
    },
    {
      field: 'packageQty',
      title: '包装数',
      width: 90,
    },
    {
      field: 'weight',
      title: '单重',
      width: 90,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
    },
    {
      field: 'totalWeight',
      title: '总重',
      width: 100,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
    },
    {
      field: 'warehouseName',
      title: '仓库',
      width: 120,
    },
    {
      field: 'bizType',
      title: '类型',
      width: 100,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.ERP_STOCK_RECORD_BIZ_TYPE },
      },
    },
    {
      field: 'bizNo',
      title: '出入库单号',
      width: 200,
      showOverflow: 'tooltip',
    },
    {
      field: 'bizDate',
      title: '发生日期',
      width: 180,
      formatter: 'formatDateTime',
    },
    {
      field: 'createTime',
      title: '出入库日期',
      width: 180,
      formatter: 'formatDateTime',
    },
    {
      field: 'count',
      title: '出入库数量',
      width: 120,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
    },
    {
      field: 'totalCount',
      title: '库存量',
      width: 100,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
    },
    {
      field: 'unitPrice',
      title: '单价',
      width: 110,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
    },
    {
      field: 'totalPrice',
      title: '金额',
      width: 110,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
    },
    {
      field: 'costPrice',
      title: '结存单价',
      width: 110,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
    },
    {
      field: 'costAmount',
      title: '结存金额',
      width: 120,
      formatter: ({ cellValue }: any) => stockListNumber(cellValue),
    },
    {
      field: 'creatorName',
      title: '操作人',
      width: 100,
    },
  ];
}
