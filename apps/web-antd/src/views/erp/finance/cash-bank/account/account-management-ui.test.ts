import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CommonStatusEnum } from '@vben/constants';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ACCOUNT_SORT_FIELD_MAP,
  ACCOUNT_TRANSACTION_SORT_FIELD_MAP,
  formatTransactionAmountCell,
  resolveTransactionPaymentAmount,
  resolveTransactionReceiptAmount,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
  useTransactionGridColumns,
  useTransactionGridFormSchema,
} from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const transactionSource = readFileSync(
  join(currentDir, 'modules', 'transaction-drawer.vue'),
  'utf8',
);

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('account management UI contract', () => {
  it('keeps leading list columns scrollable and fixes only operations', () => {
    const columns = useGridColumns() as any[];

    expect(
      columns
        .filter((column) => column.fixed)
        .map((column) => ({ fixed: column.fixed, title: column.title })),
    ).toEqual([{ fixed: 'right', title: '操作' }]);
    expect(
      columns.find((column) => column.type === 'checkbox')?.autoFixed,
    ).toBe(false);
    expect(columns.find((column) => column.field === 'name')?.slots).toEqual({
      default: 'accountName',
    });
  });

  it('wires every whitelisted main-list sort to a sortable column', () => {
    const columns = useGridColumns() as any[];

    for (const field of Object.keys(ACCOUNT_SORT_FIELD_MAP)) {
      expect(
        columns.find((column) => column.field === field)?.sortable,
        field,
      ).toBe(true);
    }
    expect(
      columns.find((column) => column.field === 'currentBalance')?.sortable,
    ).not.toBe(true);
    expect(
      columns.find((column) => column.field === 'actions')?.sortable,
    ).not.toBe(true);
  });

  it('uses compact overlays, switch fields, and positions the read-only balance', () => {
    useGridFormSchema()
      .filter(
        (schema) =>
          schema.component === 'ApiSelect' || schema.component === 'Select',
      )
      .forEach((schema) => {
        expect(schema.componentProps).toMatchObject({
          popupClassName: 'account-search-select-dropdown',
        });
      });

    const formSchema = useFormSchema();
    const balance = formSchema.find(
      (schema) => schema.fieldName === 'currentBalance',
    );
    expect(balance?.componentProps).toMatchObject({ disabled: true });
    expect(formSchema.map((schema) => schema.fieldName)).toEqual(
      expect.arrayContaining(['deptId', 'currentBalance', 'remark']),
    );
    expect(
      formSchema.findIndex((schema) => schema.fieldName === 'currentBalance'),
    ).toBe(formSchema.findIndex((schema) => schema.fieldName === 'deptId') + 1);
    expect(
      formSchema.find((schema) => schema.fieldName === 'status'),
    ).toMatchObject({
      component: 'Switch',
      componentProps: {
        checkedChildren: '启用',
        checkedValue: CommonStatusEnum.ENABLE,
        unCheckedChildren: '停用',
        unCheckedValue: CommonStatusEnum.DISABLE,
      },
    });
    expect(
      formSchema.find((schema) => schema.fieldName === 'defaultStatus'),
    ).toMatchObject({
      component: 'Switch',
      componentProps: {
        checkedChildren: '是',
        checkedValue: true,
        unCheckedChildren: '否',
        unCheckedValue: false,
      },
    });
    expect(
      formSchema.find((schema) => schema.fieldName === 'remark')?.formItemClass,
    ).toContain('xl:col-span-4');
  });

  it('keeps the compact list, explicit detail link, and selection-aware actions', () => {
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain('account-management-grid__name-link');
    expect(indexSource).toContain('.vxe-grid--pager-wrapper');
    expect(indexSource).toContain('font-size: 12px');
    expect(indexSource).toContain('ifShow: () => !isEmpty(checkedIds)');

    for (const permission of [
      'erp:account:create',
      'erp:account:delete',
      'erp:account:export',
      'erp:account:import',
      'erp:account:query',
      'erp:account:update',
    ]) {
      expect(indexSource).toContain(permission);
    }
    expect(indexSource).toContain('onImport');
    expect(indexSource).toContain('I 导入');
    expect(indexSource).toContain('ExportFieldModal');
    expect(indexSource).toContain('账户资金流水需要区分业务来源');
    expect(indexSource).toContain('业务归属部门和账户管理部门');
    expect(indexSource).toContain('总部代收代付后续需要与其他往来关联');
    expect(indexSource).toContain('避免重复记债权债务');
    expect(indexSource).toContain('反向资金单处理');
  });

  it('uses one fullscreen four-column form with explicit loading exits', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain('xl:grid-cols-4');
    expect(formSource).toContain("layout: 'horizontal'");
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain('基本信息');
    expect(formSource).toContain('审计信息');
    expect(formSource).toContain("'account-edit-form--editable': !isDetail");
    expect(formSource).toContain('const sequence = ++dataLoadSequence');
    expect(formSource).toContain('if (sequence !== dataLoadSequence)');
    expect(formSource).toContain(
      "dataLoadError.value = '账户信息加载失败，请关闭后重试'",
    );
    expect(formSource).toContain('dataLoading.value = false');
    expect(formSource).toContain('isHidden(item.field)');
    expect(formSource).toContain('queueFocusFirstFinanceEditableFormControl');
    expect(formSource).toContain('handleFinanceEditableFormEnter');
    expect(formSource).toContain('() => void modalApi.onConfirm()');
    expect(formSource).toContain('erp-form-focus-highlight');
  });

  it('keeps transaction filters, paging, sorting, and summary connected', () => {
    const schemas = useTransactionGridFormSchema();
    expect(schemas).toHaveLength(1);
    expect(schemas.map((schema) => schema.fieldName)).toEqual([
      'transactionTime',
    ]);
    expect(schemas.map((schema) => schema.label)).not.toContain('单据类型');
    const columns = useTransactionGridColumns() as any[];
    expect(columns.map((column) => column.title)).toEqual(
      expect.arrayContaining(['收款', '付款', '余额']),
    );
    expect(columns.map((column) => column.title)).not.toContain('单据类型');
    expect(columns.map((column) => column.field)).not.toContain('billTypeName');
    for (const field of Object.keys(ACCOUNT_TRANSACTION_SORT_FIELD_MAP)) {
      expect(
        columns.find((column) => column.field === field)?.sortable,
        field,
      ).toBe(true);
    }
    expect(transactionSource).toContain('...formValues');
    expect(transactionSource).toContain("height: '100%'");
    expect(transactionSource).toContain('search: true');
    expect(transactionSource).toContain('custom: true');
    expect(transactionSource).toContain('zoom: true');
    expect(transactionSource).toContain('ExportFieldModal');
    expect(transactionSource).toContain('本页流水数量');
    expect(transactionSource).toContain('余额：');
    expect(transactionSource).toContain('account-transaction-summary');
    expect(transactionSource).toContain('font-size: 12px');
  });

  it('formats transaction receipt and payment columns with payment shown negative', () => {
    const receipt = { amount: 120.5, billType: 'receipt' as const };
    const payment = { amount: 36.2, billType: 'payment' as const };

    expect(resolveTransactionReceiptAmount(receipt)).toBe('120.5');
    expect(resolveTransactionPaymentAmount(receipt)).toBeUndefined();
    expect(resolveTransactionReceiptAmount(payment)).toBeUndefined();
    expect(resolveTransactionPaymentAmount(payment)).toBe('-36.2');
    expect(
      formatTransactionAmountCell(resolveTransactionPaymentAmount(payment)),
    ).toBe('-36.20');
    expect(formatTransactionAmountCell(undefined)).toBe('-');
  });
});
