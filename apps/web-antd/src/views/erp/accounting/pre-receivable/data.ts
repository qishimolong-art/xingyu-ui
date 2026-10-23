import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPreReceivableApi } from '#/api/erp/finance/accounting/pre-receivable';

import {
  applyAccountingColumnPermission,
  applyAccountingFormFieldPermission,
  applyAccountingItemColumnPermission,
} from '../utils/field-permission';

/** 审核状态选项 */
export const AUDIT_STATUS_OPTIONS = [
  { label: '未审核', value: 10 },
  { label: '已审核', value: 20 },
  { label: '已反审', value: 30 },
];

/** 对方类型选项 */
export const PARTY_TYPE_OPTIONS = [
  { label: '客户', value: 1 },
  { label: '供应商', value: 2 },
  { label: '员工', value: 3 },
];

export function getAuditStatusText(status?: number) {
  return AUDIT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? '未知';
}

export function getAuditStatusColor(status?: number) {
  if (status === 20) return 'success';
  if (status === 30) return 'warning';
  return 'default';
}

export function getPartyTypeText(type?: number) {
  return PARTY_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? '未知';
}

/** 新增/编辑表单 schema */
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
        defaultValue: Date.now(),
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
        defaultValue: 1,
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
        component: 'ApiSelect',
        componentProps: {
          api: () =>
            import('#/api/erp/finance/account').then((m) =>
              m.getAccountSimpleList(),
            ),
          labelField: 'name',
          valueField: 'id',
          placeholder: '请选择结算账户',
          allowClear: true,
        },
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
          rows: 2,
          allowClear: true,
        },
      },
    ],
    hiddenFields,
  );
}

/** 列表搜索表单 schema */
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
          placeholder: ['开始日期', '结束日期'],
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
          options: AUDIT_STATUS_OPTIONS,
          allowClear: true,
        },
      },
    ],
    hiddenFields,
  );
}

/** 列表列定义 */
export function useGridColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions<ErpPreReceivableApi.PreReceivable>['columns'] {
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
        minWidth: 90,
        slots: { default: 'partyType' },
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

/** 子表明细列定义（用于弹窗内 vxe-grid） */
export function useFormItemColumns(
  formType: string,
  hiddenFields: string[] = [],
): VxeTableGridOptions<ErpPreReceivableApi.PreReceivableItem>['columns'] {
  return applyAccountingItemColumnPermission(
    [
      { type: 'seq', title: '#', width: 50 },
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
      ...(formType !== 'detail'
        ? [
            {
              title: '操作',
              width: 80,
              slots: { default: 'actions' },
            },
          ]
        : []),
    ],
    hiddenFields,
  );
}
