import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import dayjs from 'dayjs';

import {
  getStockTransferLedgerFromDeptSimplePage,
  getStockTransferLedgerToDeptSimplePage,
} from '#/api/erp/stock/transfer-ledger';
import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import { withEnterBlurInputSchemas } from '#/views/erp/sale/utils/keyboard';
import {
  applyStockQueryFieldPermission,
  applyStockReportColumnPermission,
} from '#/views/erp/stock/utils/field-permission';
import { stockListNumber } from '#/views/erp/stock/utils/stock-decimal';

import { EXCEPTION_OPTIONS } from './modules/status';

type HiddenFields = Set<string> | string[];

export function useGridFormSchema(
  hiddenFields: HiddenFields = [],
): VbenFormSchema[] {
  return withEnterBlurInputSchemas(
    applyStockQueryFieldPermission(
      [
        {
          fieldName: 'moveTime',
          label: '业务日期',
          component: 'RangePicker',
          defaultValue: [
            dayjs()
              .subtract(29, 'day')
              .startOf('day')
              .format('YYYY-MM-DD HH:mm:ss'),
            dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss'),
          ],
          componentProps: {
            ...getRangePickerDefaultProps(),
            allowClear: false,
          },
        },
        {
          fieldName: 'fromDeptId',
          label: '调出部门',
          component: 'ErpLazyPageSelect',
          componentProps: {
            api: getStockTransferLedgerFromDeptSimplePage,
            labelField: 'name',
            valueField: 'id',
            popupClassName: 'transfer-ledger-search-select-dropdown',
            allowClear: true,
            showSearch: true,
            pageSize: 10,
            loadErrorMessage: '调出部门列表加载失败，请重试',
          },
        },
        {
          fieldName: 'toDeptId',
          label: '调入部门',
          component: 'ErpLazyPageSelect',
          componentProps: {
            api: getStockTransferLedgerToDeptSimplePage,
            labelField: 'name',
            valueField: 'id',
            popupClassName: 'transfer-ledger-search-select-dropdown',
            allowClear: true,
            showSearch: true,
            pageSize: 10,
            loadErrorMessage: '调入部门列表加载失败，请重试',
          },
        },
        {
          fieldName: 'fromWarehouseId',
          label: '调出仓库',
          component: 'ErpLazyPageSelect',
          componentProps: {
            api: (params: any) =>
              getWarehouseSimplePage({ ...params, bizType: 'stockMoveFrom' }),
            labelField: 'name',
            valueField: 'id',
            popupClassName: 'transfer-ledger-search-select-dropdown',
            allowClear: true,
            showSearch: true,
            pageSize: 10,
            loadErrorMessage: '调出仓库列表加载失败，请重试',
          },
        },
        {
          fieldName: 'toWarehouseId',
          label: '调入仓库',
          component: 'ErpLazyPageSelect',
          componentProps: {
            api: (params: any) =>
              getWarehouseSimplePage({ ...params, bizType: 'stock' }),
            labelField: 'name',
            valueField: 'id',
            popupClassName: 'transfer-ledger-search-select-dropdown',
            allowClear: true,
            showSearch: true,
            pageSize: 10,
            loadErrorMessage: '调入仓库列表加载失败，请重试',
          },
        },
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
          fieldName: 'transferOutNo',
          label: '出库单号',
          component: 'Input',
          componentProps: { allowClear: true },
        },
        {
          fieldName: 'transferInNo',
          label: '入库单号',
          component: 'Input',
          componentProps: { allowClear: true },
        },
        {
          fieldName: 'sourceNo',
          label: '来源单号',
          component: 'Input',
          componentProps: { allowClear: true },
        },
        {
          fieldName: 'status',
          label: '审核状态',
          component: 'Select',
          componentProps: {
            popupClassName: 'transfer-ledger-search-select-dropdown',
            options: getDictOptions(DICT_TYPE.ERP_AUDIT_STATUS, 'number'),
            allowClear: true,
          },
        },
        {
          fieldName: 'matchStatus',
          label: '匹配状态',
          component: 'Select',
          componentProps: {
            popupClassName: 'transfer-ledger-search-select-dropdown',
            options: [
              { label: '正常', value: 'NORMAL' },
              { label: '异常', value: 'ABNORMAL' },
            ],
            allowClear: true,
          },
        },
        {
          fieldName: 'exceptionCode',
          label: '异常类型',
          component: 'Select',
          componentProps: {
            popupClassName: 'transfer-ledger-search-select-dropdown',
            options: EXCEPTION_OPTIONS,
            allowClear: true,
          },
        },
        {
          fieldName: 'keyword',
          label: '关键词',
          component: 'Input',
          componentProps: {
            placeholder: '单号、产品、仓库或部门',
            allowClear: true,
            'data-erp-keyword-search-input': 'true',
          },
        },
      ],
      hiddenFields,
    ),
  );
}

export function useGridColumns(
  hiddenFields: HiddenFields = [],
): VxeTableGridOptions['columns'] {
  return applyStockReportColumnPermission(
    [
      {
        field: 'businessDate',
        title: '业务日期',
        minWidth: 120,
        sortable: true,
        slots: { default: 'businessDate' },
      },
      {
        field: 'transferOutDocumentCount',
        title: '出库单数',
        width: 90,
        align: 'right',
      },
      {
        field: 'transferOutCount',
        title: '调拨出库数量',
        width: 125,
        align: 'right',
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      },
      {
        field: 'transferInDocumentCount',
        title: '入库单数',
        width: 90,
        align: 'right',
      },
      {
        field: 'transferInCount',
        title: '调拨入库数量',
        width: 125,
        align: 'right',
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      },
      {
        field: 'differenceCount',
        title: '数量差异',
        width: 110,
        align: 'right',
        formatter: ({ cellValue }: any) => stockListNumber(cellValue),
      },
      {
        field: 'completedGroupCount',
        title: '已完成组数',
        width: 105,
        align: 'right',
      },
      {
        field: 'abnormalGroupCount',
        title: '异常组数',
        width: 95,
        align: 'right',
        slots: { default: 'abnormalGroupCount' },
      },
      {
        field: 'ledgerStatus',
        title: '台账状态',
        width: 100,
        slots: { default: 'ledgerStatus' },
      },
      {
        field: 'action',
        title: '操作',
        width: 76,
        fixed: 'right',
        slots: { default: 'action' },
      },
    ],
    hiddenFields,
  );
}
