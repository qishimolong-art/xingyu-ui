import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpVoucherAttributionApi } from '#/api/erp/finance/accounting/voucher-attribution';

import { z } from '#/adapter/form';

import {
  applyAccountingColumnPermission,
  applyAccountingFormFieldPermission,
} from '../utils/field-permission';

/** 单据来源类型选项（与后端 ErpVoucherSourceBizTypeEnum 对应） */
export const SOURCE_BIZ_TYPE_OPTIONS = [
  { label: '销售凭证', value: 1 },
  { label: '销售出库单', value: 2 },
  { label: '销售退货单', value: 3 },
  { label: '其他应收', value: 4 },
  { label: '预收款凭证', value: 5 },
  { label: '收款凭证', value: 6 },
  { label: '采购凭证', value: 7 },
  { label: '采购入库单', value: 8 },
  { label: '采购退货单', value: 9 },
  { label: '其他应付', value: 10 },
  { label: '预付款凭证', value: 11 },
  { label: '付款凭证', value: 12 },
  { label: '其他收入凭证', value: 13 },
  { label: '费用支出凭证', value: 14 },
  { label: '调拨出库单', value: 15 },
  { label: '其他出库单', value: 16 },
  { label: '其他入库单', value: 17 },
  { label: '银行转账', value: 18 },
  { label: '采购调价', value: 19 },
  { label: '线上收款', value: 20 },
  { label: '预收款单', value: 21 },
  { label: '预付款单', value: 22 },
  { label: '预收账款单', value: 23 },
].map((option) => ({
  ...option,
  disabled: ![2, 3, 4, 6, 8, 9, 10, 12, 16, 17, 18, 21, 22, 23].includes(
    option.value,
  ),
  label: [2, 3, 4, 6, 8, 9, 10, 12, 16, 17, 18, 21, 22, 23].includes(
    option.value,
  )
    ? option.label
    : `${option.label}（未接入）`,
}));

export const SOURCE_BIZ_TYPE_MAP: Record<number, string> =
  SOURCE_BIZ_TYPE_OPTIONS.reduce(
    (acc, item) => {
      acc[item.value] = item.label;
      return acc;
    },
    {} as Record<number, string>,
  );

/** 业务单据类型选项（与 ErpVoucherTypeEnum 一致，凭证类型，编辑表单用） */
export const BIZ_TYPE_OPTIONS = [
  { label: '销售凭证', value: 1 },
  { label: '其他应收凭证', value: 2 },
  { label: '预收款凭证', value: 3 },
  { label: '预付款凭证', value: 4 },
  { label: '预收账款凭证', value: 5 },
  { label: '调拨出库凭证', value: 6 },
  { label: '采购凭证', value: 7 },
  { label: '其他应付凭证', value: 8 },
  { label: '其他出库凭证', value: 9 },
  { label: '其他入库凭证', value: 10 },
  { label: '银行转账凭证', value: 11 },
];

export const BIZ_TYPE_MAP: Record<number, string> = BIZ_TYPE_OPTIONS.reduce(
  (acc, item) => {
    acc[item.value] = item.label;
    return acc;
  },
  {} as Record<number, string>,
);

/** 归属状态选项 */
export const ATTRIBUTION_STATUS_OPTIONS = [
  { label: '未归属', value: 10 },
  { label: '已归属', value: 20 },
  { label: '已生成凭证', value: 30 },
];

export const ATTRIBUTION_STATUS_MAP: Record<number, string> = {
  10: '未归属',
  20: '已归属',
  30: '已生成凭证',
};

export const ATTRIBUTION_STATUS_COLOR: Record<number, string> = {
  10: 'default',
  20: 'processing',
  30: 'success',
};

/** 三选项布尔（应收确认 / 开票 / 发货状态等） */
export const TRI_BOOL_OPTIONS = [
  { label: '是', value: true },
  { label: '否', value: false },
];

/** 发货状态选项 */
export const SHIP_STATUS_OPTIONS = [
  { label: '未发货', value: 10 },
  { label: '已发货', value: 20 },
];

/** 新增/编辑表单 */
export function useFormSchema(hiddenFields: string[] = []): VbenFormSchema[] {
  const now = new Date();
  return applyAccountingFormFieldPermission(
    [
      {
        component: 'Input',
        fieldName: 'id',
        dependencies: { triggerFields: [''], show: () => false },
      },
      {
        fieldName: 'bizType',
        label: '业务单据类型',
        component: 'Select',
        componentProps: {
          options: BIZ_TYPE_OPTIONS,
          placeholder: '请选择业务单据类型',
          allowClear: false,
        },
        rules: 'required',
      },
      {
        fieldName: 'bizNo',
        label: '业务单号',
        component: 'Input',
        componentProps: { placeholder: '请输入业务单号', allowClear: true },
      },
      {
        fieldName: 'bizDate',
        label: '业务发生日期',
        component: 'DatePicker',
        componentProps: {
          showTime: true,
          valueFormat: 'YYYY-MM-DD HH:mm:ss',
          format: 'YYYY-MM-DD HH:mm:ss',
          style: { width: '100%' },
        },
        rules: 'required',
      },
      {
        fieldName: 'bizAmount',
        label: '原始金额',
        component: 'InputNumber',
        componentProps: { precision: 2, min: 0, style: { width: '100%' } },
      },
      {
        fieldName: 'discountAmount',
        label: '折让金额',
        component: 'InputNumber',
        componentProps: { precision: 2, min: 0, style: { width: '100%' } },
      },
      {
        fieldName: 'receivedAmount',
        label: '实收金额',
        component: 'InputNumber',
        componentProps: { precision: 2, min: 0, style: { width: '100%' } },
      },
      {
        fieldName: 'voucherMakeDate',
        label: '制单日期',
        component: 'DatePicker',
        componentProps: {
          valueFormat: 'YYYY-MM-DD',
          format: 'YYYY-MM-DD',
          style: { width: '100%' },
        },
      },
      {
        fieldName: 'attributionYear',
        label: '归属年',
        component: 'InputNumber',
        componentProps: {
          min: 2000,
          max: now.getFullYear() + 5,
          style: { width: '100%' },
        },
        rules: z.number().optional(),
      },
      {
        fieldName: 'attributionMonth',
        label: '归属月',
        component: 'InputNumber',
        componentProps: { min: 1, max: 12, style: { width: '100%' } },
        rules: z.number().optional(),
      },
      {
        fieldName: 'transactionParty',
        label: '交易单位',
        component: 'Input',
        componentProps: { placeholder: '请输入交易单位', allowClear: true },
      },
      {
        fieldName: 'settleMethod',
        label: '结算方式',
        component: 'Input',
        componentProps: { placeholder: '请输入结算方式', allowClear: true },
      },
      {
        fieldName: 'shippingMethod',
        label: '运输方式',
        component: 'Input',
        componentProps: { placeholder: '请输入运输方式', allowClear: true },
      },
      {
        fieldName: 'receivableConfirmed',
        label: '应收确认',
        component: 'Select',
        componentProps: {
          options: TRI_BOOL_OPTIONS,
          allowClear: true,
          placeholder: '请选择',
        },
      },
      {
        fieldName: 'invoiceIssued',
        label: '是否开票',
        component: 'Select',
        componentProps: {
          options: TRI_BOOL_OPTIONS,
          allowClear: true,
          placeholder: '请选择',
        },
      },
      {
        fieldName: 'shipStatus',
        label: '发货状态',
        component: 'Select',
        componentProps: {
          options: SHIP_STATUS_OPTIONS,
          allowClear: true,
          placeholder: '请选择',
        },
      },
      {
        fieldName: 'summary',
        label: '摘要',
        component: 'Input',
        componentProps: { placeholder: '请输入摘要', allowClear: true },
        formItemClass: 'col-span-2',
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
          allowClear: true,
          rows: 2,
        },
        formItemClass: 'col-span-2',
      },
    ],
    hiddenFields,
  );
}

/** 列表搜索栏（凭证生成页：可按单据类型筛选 → 查询 → 勾选 → 生成） */
export function useGridFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyAccountingFormFieldPermission(
    [
      {
        fieldName: 'sourceBizType',
        label: '单据类型',
        component: 'Select',
        componentProps: {
          options: SOURCE_BIZ_TYPE_OPTIONS,
          placeholder: '请选择单据类型',
          allowClear: true,
        },
      },
      {
        fieldName: 'bizDate',
        label: '业务日期期间',
        component: 'RangePicker',
        componentProps: {
          valueFormat: 'YYYY-MM-DD',
          format: 'YYYY-MM-DD',
        },
      },
      {
        fieldName: 'bizNo',
        label: '业务单号',
        component: 'Input',
        componentProps: { placeholder: '业务单号', allowClear: true },
      },
      {
        fieldName: 'partyName',
        label: '交易单位',
        component: 'Input',
        componentProps: { placeholder: '交易单位', allowClear: true },
      },
    ],
    hiddenFields,
  );
}

/** 列表列定义（凭证生成页：精简列） */
export function useGridColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions<ErpVoucherAttributionApi.VoucherAttribution>['columns'] {
  return applyAccountingColumnPermission(
    [
      {
        field: 'generationStatus',
        title: '生成检查',
        minWidth: 250,
        slots: { default: 'generationStatus' },
      },
      { type: 'checkbox', width: 50, fixed: 'left' },
      {
        field: 'bizType',
        title: '单据类型',
        minWidth: 130,
        formatter: ({ cellValue }) =>
          SOURCE_BIZ_TYPE_MAP[Number(cellValue)] || cellValue || '',
      },
      {
        field: 'bizNo',
        title: '单据编号',
        minWidth: 180,
        fixed: 'left',
      },
      {
        field: 'bizDate',
        title: '业务日期',
        minWidth: 165,
        formatter: 'formatDateTime',
      },
      {
        field: 'bizAmount',
        title: '原始金额',
        minWidth: 130,
        align: 'right',
        formatter: 'formatNumber',
      },
      {
        field: 'transactionParty',
        title: '交易单位',
        minWidth: 160,
      },
      {
        field: 'attributionStatus',
        title: '归属状态',
        minWidth: 110,
        slots: { default: 'attributionStatus' },
      },
    ],
    hiddenFields,
  );
}
