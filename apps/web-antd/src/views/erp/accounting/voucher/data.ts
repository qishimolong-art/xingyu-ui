import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getVoucherUserSimplePage } from '#/api/erp/finance/accounting/voucher';
import { getVoucherWordSimpleList } from '#/api/erp/finance/accounting/voucher-word';
import { getSimpleUserList } from '#/api/system/user';
import { getRangePickerDefaultProps } from '#/utils';

import {
  applyAccountingColumnPermission,
  applyAccountingFormFieldPermission,
  applyAccountingItemColumnPermission,
} from '../utils/field-permission';

/** 审核状态选项 */
export const VOUCHER_AUDIT_STATUS_OPTIONS = [
  { label: '未审核', value: 10, color: 'orange' },
  { label: '已审核', value: 20, color: 'green' },
  { label: '已反审', value: 30, color: 'red' },
];

/** 业务单据类型选项（与「是否产生业务单据」联动） */
export const SUBJECT_BIZ_DOC_TYPE_OPTIONS = [
  { label: '银行转账', value: '银行转账' },
  { label: '代垫运费', value: '代垫运费' },
];

export function getAuditStatusText(status?: number) {
  return (
    VOUCHER_AUDIT_STATUS_OPTIONS.find((item) => item.value === status)?.label ||
    '-'
  );
}

export function getAuditStatusColor(status?: number) {
  return (
    VOUCHER_AUDIT_STATUS_OPTIONS.find((item) => item.value === status)?.color ||
    'default'
  );
}

/** 凭证主表表单 schema */
export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  const isDetail = formType === 'detail';
  return applyAccountingFormFieldPermission(
    [
      {
        fieldName: 'id',
        component: 'Input',
        dependencies: { triggerFields: [''], show: () => false },
      },
      {
        fieldName: 'voucherWord',
        label: '凭证字',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择凭证字',
          api: getVoucherWordSimpleList,
          labelField: 'name',
          valueField: 'code',
          showSearch: true,
          allowClear: false,
          disabled: isDetail,
        },
        defaultValue: '记',
        rules: 'required',
      },
      {
        fieldName: 'voucherNo',
        label: '凭证编号',
        component: 'Input',
        componentProps: {
          placeholder: '系统自动生成',
          disabled: true,
        },
      },
      {
        fieldName: 'voucherDate',
        label: '凭证日期',
        component: 'DatePicker',
        componentProps: {
          placeholder: '请选择凭证日期',
          format: 'YYYY-MM-DD',
          valueFormat: 'YYYY-MM-DD',
          disabled: isDetail,
        },
        rules: 'required',
      },
      {
        fieldName: 'attachmentCount',
        label: '附件张数',
        component: 'InputNumber',
        componentProps: {
          placeholder: '请输入附件张数',
          disabled: isDetail,
          min: 0,
          precision: 0,
          class: 'w-full',
        },
        defaultValue: 0,
      },
      {
        fieldName: 'summary',
        label: '摘要',
        component: 'Input',
        componentProps: {
          placeholder: '请输入凭证摘要',
          disabled: isDetail,
          maxlength: 200,
        },
        formItemClass: 'col-span-3',
      },
      {
        fieldName: 'bookkeeperUserId',
        label: '记账',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择记账人',
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
          showSearch: true,
          allowClear: true,
          disabled: isDetail,
        },
      },
      {
        fieldName: 'cashierUserId',
        label: '出纳',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择出纳',
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
          showSearch: true,
          allowClear: true,
          disabled: isDetail,
        },
      },
      {
        fieldName: 'supervisorUserId',
        label: '主管',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择主管',
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
          showSearch: true,
          allowClear: true,
          disabled: isDetail,
        },
      },
      {
        fieldName: 'auditorUserId',
        label: '审核',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择审核人',
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
          showSearch: true,
          allowClear: true,
          disabled: isDetail,
        },
      },
      {
        fieldName: 'makerUserId',
        label: '制单',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '当前登录用户',
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
          showSearch: true,
          allowClear: false,
          disabled: true,
        },
      },
      {
        fieldName: 'projectId',
        label: '项目',
        component: 'Input',
        componentProps: {
          placeholder: '项目（不可写）',
          disabled: true,
        },
      },
      {
        fieldName: 'deptId',
        label: '部门',
        component: 'Input',
        componentProps: {
          placeholder: '部门（不可写）',
          disabled: true,
        },
      },
      {
        fieldName: 'customerId',
        label: '客户',
        component: 'Input',
        componentProps: {
          placeholder: '客户（不可写）',
          disabled: true,
        },
      },
      {
        fieldName: 'personUserId',
        label: '个人',
        component: 'Input',
        componentProps: {
          placeholder: '个人（不可写）',
          disabled: true,
        },
      },
      {
        fieldName: 'auditTime',
        label: '审核时间',
        component: 'DatePicker',
        componentProps: {
          placeholder: '审核后自动填充',
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
          disabled: true,
        },
      },
      {
        fieldName: 'generateBusinessDoc',
        label: '是否产生业务单据',
        component: 'Switch',
        componentProps: {
          disabled: isDetail,
        },
        defaultValue: false,
      },
      {
        fieldName: 'bizDocType',
        label: '业务单据类型',
        component: 'Select',
        componentProps: {
          placeholder: '请选择业务单据类型',
          options: SUBJECT_BIZ_DOC_TYPE_OPTIONS,
          allowClear: true,
          disabled: isDetail,
        },
        dependencies: {
          triggerFields: ['generateBusinessDoc'],
          show: (values) => Boolean(values.generateBusinessDoc),
        },
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
          autoSize: { minRows: 1, maxRows: 3 },
          disabled: isDetail,
          maxlength: 500,
        },
        formItemClass: 'col-span-3',
      },
    ],
    hiddenFields,
  );
}

/** 分录子表列定义（vxe-grid 内联编辑） */
export function useFormItemColumns(
  formType: string,
  hiddenFields: string[] = [],
): VxeTableGridOptions['columns'] {
  const disabled = formType === 'detail';
  return applyAccountingItemColumnPermission(
    [
      { type: 'seq', title: '序号', width: 50, fixed: 'left' },
      {
        field: 'summary',
        title: '摘要',
        minWidth: 180,
        slots: { default: 'summary' },
      },
      {
        field: 'subjectId',
        title: '会计科目',
        minWidth: 240,
        slots: { default: 'subject' },
      },
      {
        field: 'auxiliaryName',
        title: '核算项',
        minWidth: 160,
        slots: { default: 'auxiliary' },
      },
      {
        field: 'debitAmount',
        title: '借方金额',
        minWidth: 150,
        align: 'right',
        slots: { default: 'debitAmount' },
      },
      {
        field: 'creditAmount',
        title: '贷方金额',
        minWidth: 150,
        align: 'right',
        slots: { default: 'creditAmount' },
      },
      {
        title: '操作',
        width: 70,
        fixed: 'right',
        slots: { default: 'actions' },
        visible: !disabled,
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
        fieldName: 'voucherDate',
        label: '凭证日期',
        component: 'RangePicker',
        componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
      },
      {
        fieldName: 'voucherNo',
        label: '凭证号',
        component: 'Input',
        componentProps: { placeholder: '请输入凭证号', allowClear: true },
      },
      {
        fieldName: 'makerUserId',
        label: '制单人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          placeholder: '请选择制单人',
          allowClear: true,
          showSearch: true,
          api: getVoucherUserSimplePage,
          pageSize: 10,
          labelField: 'nickname',
          valueField: 'id',
          loadErrorMessage: '制单人列表加载失败，请重试',
        },
      },
      {
        fieldName: 'auditStatus',
        label: '审核状态',
        component: 'Select',
        componentProps: {
          placeholder: '请选择审核状态',
          options: VOUCHER_AUDIT_STATUS_OPTIONS,
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
): VxeTableGridOptions['columns'] {
  return applyAccountingColumnPermission(
    [
      { type: 'checkbox', width: 50, fixed: 'left' },
      {
        field: 'printAction',
        title: '打印',
        width: 56,
        fixed: 'left',
        slots: { default: 'printAction' },
      },
      {
        field: 'deleteAction',
        title: '删除',
        width: 56,
        fixed: 'left',
        slots: { default: 'deleteAction' },
      },
      {
        field: 'createTime',
        title: '制单日期',
        minWidth: 120,
        formatter: 'formatDate',
      },
      {
        field: 'voucherDate',
        title: '凭证日期',
        minWidth: 120,
        formatter: 'formatDate',
      },
      {
        field: 'period',
        title: '期间',
        minWidth: 100,
        formatter: ({ row }) => {
          if (row.period) return row.period;
          if (!row.periodYear || !row.periodMonth) return '-';
          return `${row.periodYear}-${String(row.periodMonth).padStart(2, '0')}`;
        },
      },
      {
        field: 'voucherNo',
        title: '凭证号',
        minWidth: 180,
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 200,
        showOverflow: 'tooltip',
      },
      {
        field: 'totalDebit',
        title: '借方金额合计',
        minWidth: 140,
        align: 'right',
        formatter: 'formatAmount2',
      },
      {
        field: 'totalCredit',
        title: '贷方金额合计',
        minWidth: 140,
        align: 'right',
        formatter: 'formatAmount2',
      },
      { field: 'makerUserName', title: '制单人', minWidth: 110 },
      { field: 'auditorUserName', title: '审核人', minWidth: 110 },
      {
        field: 'auditTime',
        title: '审核日期',
        minWidth: 160,
        formatter: 'formatDate',
      },
      { field: 'bookkeeper', title: '登账人', minWidth: 110 },
      {
        field: 'bookkeeperTime',
        title: '登账日期',
        minWidth: 160,
        formatter: 'formatDate',
      },
      {
        title: '操作',
        field: 'actions',
        width: 280,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    hiddenFields,
  );
}
