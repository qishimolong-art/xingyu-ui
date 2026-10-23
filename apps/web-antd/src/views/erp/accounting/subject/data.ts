import type { VbenFormSchema } from '#/adapter/form';

import { z } from '#/adapter/form';

import { getAccountingSubjectSimpleList } from '#/api/erp/finance/accounting/subject';

import { applyAccountingFormFieldPermission } from '../utils/field-permission';

/** 科目类型选项（1-资产 2-负债 3-共同 4-权益 5-成本 6-损益） */
export const SUBJECT_CATEGORY_OPTIONS = [
  { label: '资产', value: 1 },
  { label: '负债', value: 2 },
  { label: '共同', value: 3 },
  { label: '权益', value: 4 },
  { label: '成本', value: 5 },
  { label: '损益', value: 6 },
];

export const SUBJECT_CATEGORY_MAP: Record<number, string> = {
  1: '资产',
  2: '负债',
  3: '共同',
  4: '权益',
  5: '成本',
  6: '损益',
};

/** 余额方向：1-借 2-贷 */
export const BALANCE_DIRECTION_OPTIONS = [
  { label: '借', value: 1 },
  { label: '贷', value: 2 },
];

export const BALANCE_DIRECTION_MAP: Record<number, string> = {
  1: '借',
  2: '贷',
};

/** 凭证类型选项：1-客户 2-连锁 */
export const SUBJECT_VOUCHER_TYPE_OPTIONS = [
  { label: '客户', value: 1 },
  { label: '连锁', value: 2 },
];

export const SUBJECT_VOUCHER_TYPE_MAP: Record<number, string> = {
  1: '客户',
  2: '连锁',
};

/** 辅助核算类型选项 */
export const AUXILIARY_TYPE_OPTIONS = [
  { label: '供应商', value: 'supplier' },
  { label: '客户', value: 'customer' },
  { label: '项目', value: 'project' },
  { label: '部门', value: 'dept' },
  { label: '员工', value: 'person' },
];

export const AUXILIARY_TYPE_MAP: Record<string, string> = {
  supplier: '供应商',
  customer: '客户',
  project: '项目',
  dept: '部门',
  person: '员工',
};

/** 把辅助核算类型数组转成中文展示 */
export function formatAuxiliaryTypes(types?: string[]): string {
  if (!types || types.length === 0) {
    return '-';
  }
  return types.map((t) => AUXILIARY_TYPE_MAP[t] ?? t).join(', ');
}

/** 新增/修改科目的表单（弹窗） */
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
        component: 'Input',
        fieldName: 'subjectCode',
        label: '科目编码',
        rules: 'required',
        componentProps: {
          placeholder: '请输入科目编码（如 100201）',
        },
      },
      {
        component: 'Input',
        fieldName: 'subjectName',
        label: '科目名称',
        rules: 'required',
        componentProps: {
          placeholder: '请输入科目名称',
        },
      },
      {
        component: 'Input',
        fieldName: 'shortName',
        label: '科目别名',
        componentProps: {
          placeholder: '请输入科目别名',
        },
      },
      {
        fieldName: 'subjectCategory',
        label: '科目类型',
        component: 'Select',
        rules: 'required',
        componentProps: {
          placeholder: '请选择科目类型',
          options: SUBJECT_CATEGORY_OPTIONS,
        },
      },
      {
        fieldName: 'voucherType',
        label: '凭证类型',
        component: 'Select',
        componentProps: {
          placeholder: '请选择凭证类型',
          options: SUBJECT_VOUCHER_TYPE_OPTIONS,
          allowClear: true,
        },
      },
      {
        fieldName: 'parentCode',
        label: '父科目编码',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请先选择科目类型，再选择父科目（一级科目留空）',
          labelField: 'label',
          valueField: 'subjectCode',
          showSearch: true,
          allowClear: true,
          immediate: true,
          optionFilterProp: 'label',
          api: (params: { category?: number }) =>
            getAccountingSubjectSimpleList(false, params?.category),
          afterFetch: (list: any[]) =>
            (list || []).map((item) => ({
              ...item,
              label: `${item.subjectCode} ${item.subjectName ?? ''}`,
            })),
        },
        dependencies: {
          triggerFields: ['subjectCategory'],
          componentProps: (values: Record<string, any>) => ({
            params: { category: values.subjectCategory },
          }),
        },
      },
      {
        fieldName: 'subjectLevel',
        label: '层级',
        component: 'InputNumber',
        dependencies: {
          triggerFields: [''],
          show: () => false,
        },
      },
      {
        fieldName: 'balanceDirection',
        label: '余额方向',
        component: 'RadioGroup',
        componentProps: {
          options: BALANCE_DIRECTION_OPTIONS,
          buttonStyle: 'solid',
          optionType: 'button',
        },
        rules: z.number().default(1).optional(),
      },
      {
        fieldName: 'openingBalance',
        label: '期初余额',
        component: 'InputNumber',
        componentProps: {
          min: 0,
          precision: 2,
          step: 0.01,
          placeholder: '0.00',
          class: 'w-full',
        },
      },
      {
        fieldName: 'enable',
        label: '是否启用',
        component: 'RadioGroup',
        componentProps: {
          options: [
            { label: '启用', value: true },
            { label: '禁用', value: false },
          ],
          buttonStyle: 'solid',
          optionType: 'button',
        },
        rules: z.boolean().default(true),
      },
      {
        fieldName: 'sort',
        label: '排序',
        component: 'InputNumber',
        dependencies: {
          triggerFields: [''],
          show: () => false,
        },
      },
      {
        fieldName: 'auxiliaryTypes',
        label: '辅助核算',
        component: 'Select',
        componentProps: {
          mode: 'multiple',
          placeholder: '请选择辅助核算类型（可多选）',
          options: AUXILIARY_TYPE_OPTIONS,
          allowClear: true,
        },
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
          rows: 3,
        },
      },
    ],
    hiddenFields,
  );
}
