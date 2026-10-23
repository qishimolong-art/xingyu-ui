import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpBookOpenApi } from '#/api/erp/finance/accounting/book-open';

import { z } from '#/adapter/form';

import {
  applyAccountingColumnPermission,
  applyAccountingFormFieldPermission,
} from '../utils/field-permission';

/** 凭证类型选项（11 种，硬编码与后端 ErpVoucherTypeEnum 一致） */
export const VOUCHER_TYPE_OPTIONS = [
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

/** 会计年度下拉选项（2000 ~ 当前年 + 5） */
export function buildFiscalYearOptions() {
  const currentYear = new Date().getFullYear();
  const options: Array<{ label: string; value: number }> = [];
  for (let y = currentYear + 5; y >= 2000; y--) {
    options.push({ label: `${y}`, value: y });
  }
  return options;
}

/** 新增/修改的表单 */
export function useFormSchema(hiddenFields: string[] = []): VbenFormSchema[] {
  const currentYear = new Date().getFullYear();
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
        fieldName: 'fiscalYear',
        label: '会计年度',
        component: 'Select',
        componentProps: {
          placeholder: '请选择会计年度',
          options: buildFiscalYearOptions(),
          allowClear: false,
        },
        rules: z
          .number({ required_error: '会计年度不能为空' })
          .default(currentYear),
        defaultValue: currentYear,
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
        label: '开账编号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入开账编号',
          allowClear: true,
        },
      },
      {
        fieldName: 'fiscalYear',
        label: '会计年度',
        component: 'Select',
        componentProps: {
          placeholder: '请选择会计年度',
          options: buildFiscalYearOptions(),
          allowClear: true,
        },
      },
      {
        fieldName: 'opened',
        label: '是否开账',
        component: 'Select',
        componentProps: {
          placeholder: '请选择是否开账',
          options: [
            { label: '已开账', value: true },
            { label: '未开账', value: false },
          ],
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
): VxeTableGridOptions<ErpBookOpenApi.BookOpen>['columns'] {
  return applyAccountingColumnPermission(
    [
      {
        field: 'no',
        title: '开账编号',
        minWidth: 180,
      },
      {
        field: 'fiscalYear',
        title: '会计年度',
        minWidth: 100,
      },
      {
        field: 'startDate',
        title: '期间开始时间',
        minWidth: 130,
        formatter: 'formatDate',
      },
      {
        field: 'opened',
        title: '是否开账',
        minWidth: 100,
        slots: { default: 'opened' },
      },
      {
        field: 'operateTime',
        title: '操作时间',
        minWidth: 170,
        formatter: 'formatDateTime',
      },
      {
        field: 'operator',
        title: '操作人',
        minWidth: 110,
      },
    ],
    hiddenFields,
  );
}
