import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPreReceiptApi } from '#/api/erp/finance/accounting/pre-receipt';

import { createOptionalNumberRule } from '#/views/erp/finance/utils/text-number';

import {
  applyAccountingColumnPermission,
  applyAccountingFormFieldPermission,
  applyAccountingItemColumnPermission,
} from '../utils/field-permission';

export const PARTY_TYPE_OPTIONS = [
  { label: '客户', value: 1 },
  { label: '供应商', value: 2 },
  { label: '员工', value: 3 },
];

export const STATUS_OPTIONS = [
  { label: '未审核', value: 10 },
  { label: '已审核', value: 20 },
  { label: '已反审', value: 30 },
];

/** 新增/修改的表单 */
export function useFormSchema(hiddenFields: string[] = []): VbenFormSchema[] {
  return applyAccountingFormFieldPermission(
    [
      {
        component: 'Input',
        fieldName: 'id',
        dependencies: {
          triggerFields: [''],
          show: () => false,
        },
      },
      {
        fieldName: 'bizTime',
        label: '业务日期',
        component: 'DatePicker',
        componentProps: {
          placeholder: '请选择业务日期',
          valueFormat: 'x',
          format: 'YYYY-MM-DD',
          style: { width: '100%' },
        },
        rules: 'required',
      },
      {
        fieldName: 'partyType',
        label: '对方类型',
        component: 'Select',
        componentProps: {
          placeholder: '请选择对方类型',
          options: PARTY_TYPE_OPTIONS,
          allowClear: true,
        },
        rules: 'required',
      },
      {
        fieldName: 'partyName',
        label: '对方名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入对方名称',
          allowClear: true,
        },
        rules: 'required',
      },
      {
        fieldName: 'accountId',
        label: '结算账户',
        component: 'Select',
        componentProps: {
          placeholder: '请选择结算账户',
          allowClear: true,
          fieldNames: { label: 'name', value: 'id' },
        },
      },
      {
        fieldName: 'discountAmount',
        label: '折让金额',
        component: 'Input',
        componentProps: {
          placeholder: '请输入折让金额',
          class: 'w-full',
          maxlength: 20,
          inputMode: 'decimal',
          style: { width: '100%' },
        },
        rules: createOptionalNumberRule('折让金额', { min: 0 }),
        defaultValue: 0,
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Input',
        componentProps: {
          placeholder: '请输入备注',
          allowClear: true,
        },
        formItemClass: 'col-span-2',
      },
    ],
    hiddenFields,
  );
}

/** 列表的搜索表单 */
export function useGridFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyAccountingFormFieldPermission(
    [
      {
        fieldName: 'no',
        label: '单据编号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入单据编号',
          allowClear: true,
        },
      },
      {
        fieldName: 'bizTime',
        label: '业务日期',
        component: 'RangePicker',
        componentProps: {
          valueFormat: 'YYYY-MM-DD HH:mm:ss',
          format: 'YYYY-MM-DD',
          style: { width: '100%' },
        },
      },
      {
        fieldName: 'partyName',
        label: '对方名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入对方名称',
          allowClear: true,
        },
      },
      {
        fieldName: 'status',
        label: '审核状态',
        component: 'Select',
        componentProps: {
          placeholder: '请选择审核状态',
          options: STATUS_OPTIONS,
          allowClear: true,
        },
      },
    ],
    hiddenFields,
  );
}

/** 列表的字段 */
export function useGridColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions<ErpPreReceiptApi.PreReceipt>['columns'] {
  return applyAccountingColumnPermission(
    [
      { field: 'no', title: '单据编号', minWidth: 180 },
      {
        field: 'bizTime',
        title: '业务日期',
        minWidth: 120,
        formatter: 'formatDate',
      },
      {
        field: 'partyType',
        title: '对方类型',
        minWidth: 100,
        formatter: ({ cellValue }) => {
          const opt = PARTY_TYPE_OPTIONS.find((o) => o.value === cellValue);
          return opt?.label || '';
        },
      },
      { field: 'partyName', title: '对方名称', minWidth: 140 },
      {
        field: 'totalAmount',
        title: '合计金额',
        minWidth: 120,
        align: 'right',
        formatter: ({ cellValue }) =>
          cellValue != null ? Number(cellValue).toFixed(2) : '',
      },
      {
        field: 'discountAmount',
        title: '折让金额',
        minWidth: 110,
        align: 'right',
        formatter: ({ cellValue }) =>
          cellValue != null ? Number(cellValue).toFixed(2) : '',
      },
      {
        field: 'actualAmount',
        title: '实际金额',
        minWidth: 120,
        align: 'right',
        formatter: ({ cellValue }) =>
          cellValue != null ? Number(cellValue).toFixed(2) : '',
      },
      {
        field: 'status',
        title: '审核状态',
        minWidth: 100,
        slots: { default: 'status' },
      },
      {
        field: 'createTime',
        title: '创建时间',
        minWidth: 170,
        formatter: 'formatDateTime',
      },
      {
        title: '操作',
        width: 200,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    hiddenFields,
  );
}

/** 子表明细列 */
export function useFormItemColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions<ErpPreReceiptApi.PreReceiptItem>['columns'] {
  return applyAccountingItemColumnPermission(
    [
      { field: 'lineNo', title: '序号', width: 60, align: 'center' },
      {
        field: 'summary',
        title: '摘要',
        minWidth: 200,
        slots: { default: 'summary' },
      },
      {
        field: 'amount',
        title: '金额',
        minWidth: 150,
        slots: { default: 'amount' },
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 180,
        slots: { default: 'remark' },
      },
      { title: '操作', width: 80, slots: { default: 'actions' } },
    ],
    hiddenFields,
  );
}
