import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpOtherPayableApi } from '#/api/erp/finance/accounting/other-payable';

import { getAccountSimpleList } from '#/api/erp/finance/account';
import { getRangePickerDefaultProps } from '#/utils';

import {
  applyAccountingColumnPermission,
  applyAccountingFormFieldPermission,
  applyAccountingItemColumnPermission,
} from '../utils/field-permission';

/** 审核状态选项 */
export const AUDIT_STATUS_OPTIONS = [
  { label: '未审核', value: 10, color: 'orange' },
  { label: '已审核', value: 20, color: 'green' },
  { label: '已反审', value: 30, color: 'red' },
];

/** 对方类型选项 */
export const PARTY_TYPE_OPTIONS = [
  { label: '客户', value: 1 },
  { label: '供应商', value: 2 },
  { label: '员工', value: 3 },
];

export function getAuditStatusText(status?: number) {
  return (
    AUDIT_STATUS_OPTIONS.find((item) => item.value === status)?.label || '-'
  );
}

export function getAuditStatusColor(status?: number) {
  return (
    AUDIT_STATUS_OPTIONS.find((item) => item.value === status)?.color ||
    'default'
  );
}

export function getPartyTypeText(type?: number) {
  return PARTY_TYPE_OPTIONS.find((item) => item.value === type)?.label || '-';
}

/** 新增/编辑表单 schema */
export function useFormSchema(hiddenFields: string[] = []): VbenFormSchema[] {
  return applyAccountingFormFieldPermission(
    [
      {
        fieldName: 'id',
        component: 'Input',
        dependencies: { triggerFields: [''], show: () => false },
      },
      {
        fieldName: 'bizTime',
        label: '业务日期',
        component: 'DatePicker',
        componentProps: {
          placeholder: '请选择业务日期',
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
          valueFormat: 'x',
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
          allowClear: false,
        },
        rules: 'required',
      },
      {
        fieldName: 'partyName',
        label: '对方名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入对方名称',
          maxlength: 128,
        },
        rules: 'required',
      },
      {
        fieldName: 'accountId',
        label: '结算账户',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择结算账户',
          api: getAccountSimpleList,
          labelField: 'name',
          valueField: 'id',
          showSearch: true,
          allowClear: true,
        },
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
          autoSize: { minRows: 1, maxRows: 3 },
          maxlength: 500,
        },
        formItemClass: 'col-span-2',
      },
    ],
    hiddenFields,
  );
}

/** 列表页搜索 schema */
export function useGridFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyAccountingFormFieldPermission(
    [
      {
        fieldName: 'no',
        label: '单据编号',
        component: 'Input',
        componentProps: { placeholder: '请输入单据编号', allowClear: true },
      },
      {
        fieldName: 'bizTime',
        label: '业务日期',
        component: 'RangePicker',
        componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
      },
      {
        fieldName: 'partyName',
        label: '对方名称',
        component: 'Input',
        componentProps: { placeholder: '请输入对方名称', allowClear: true },
      },
      {
        fieldName: 'status',
        label: '审核状态',
        component: 'Select',
        componentProps: {
          placeholder: '请选择审核状态',
          options: AUDIT_STATUS_OPTIONS,
          allowClear: true,
        },
      },
    ],
    hiddenFields,
  );
}

/** 列表页列定义 */
export function useGridColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions<ErpOtherPayableApi.OtherPayable>['columns'] {
  return applyAccountingColumnPermission(
    [
      { field: 'no', title: '单据编号', minWidth: 180, fixed: 'left' },
      {
        field: 'bizTime',
        title: '业务日期',
        minWidth: 160,
        formatter: 'formatDate',
      },
      {
        field: 'partyType',
        title: '对方类型',
        minWidth: 100,
        slots: { default: 'partyType' },
      },
      { field: 'partyName', title: '对方名称', minWidth: 140 },
      {
        field: 'totalAmount',
        title: '合计金额',
        minWidth: 120,
        align: 'right',
        formatter: 'formatAmount2',
      },
      {
        field: 'discountAmount',
        title: '折让金额',
        minWidth: 120,
        align: 'right',
        formatter: 'formatAmount2',
      },
      {
        field: 'actualAmount',
        title: '实际金额',
        minWidth: 120,
        align: 'right',
        formatter: 'formatAmount2',
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
        width: 240,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    hiddenFields,
  );
}

/** 子表明细列定义 */
export function useItemColumns(
  disabled: boolean,
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  return applyAccountingItemColumnPermission(
    [
      { type: 'seq', title: '序号', width: 50 },
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
        align: 'right',
        slots: { default: 'amount' },
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 200,
        slots: { default: 'remark' },
      },
      {
        title: '操作',
        width: 70,
        slots: { default: 'actions' },
        visible: !disabled,
      },
    ],
    hiddenFields,
  );
}
