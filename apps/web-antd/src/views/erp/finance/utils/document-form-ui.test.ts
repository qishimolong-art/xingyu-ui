import type { VbenFormSchema } from '#/adapter/form';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildFinanceDocumentDetailFormValues,
  buildFinanceDocumentFormSchema,
  hydrateFinanceDocumentFormSelectLabels,
} from './document-form-ui';

const apiMocks = vi.hoisted(() => ({
  getAccount: vi.fn(),
  getCustomer: vi.fn(),
  getDept: vi.fn(),
  getSimpleUserList: vi.fn(),
  getSupplier: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('#/api/erp/finance/account', () => ({
  getAccount: apiMocks.getAccount,
}));

vi.mock('#/api/erp/purchase/supplier', () => ({
  getSupplier: apiMocks.getSupplier,
}));

vi.mock('#/api/erp/sale/customer', () => ({
  getCustomer: apiMocks.getCustomer,
}));

vi.mock('#/api/system/dept', () => ({
  getDept: apiMocks.getDept,
}));

vi.mock('#/api/system/user', () => ({
  getSimpleUserList: apiMocks.getSimpleUserList,
  getUser: apiMocks.getUser,
}));

describe('finance document form ui helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders configured select fields as readonly text fields in detail mode', () => {
    const result = buildFinanceDocumentFormSchema(
      [
        {
          component: 'ApiSelect',
          fieldName: 'deptId',
          componentProps: {
            allowClear: true,
          },
          rules: 'required',
        },
        {
          component: 'SupplierLazySelect',
          fieldName: 'supplierId',
          rules: 'required',
        },
        {
          component: 'Select',
          fieldName: 'status',
        },
      ] as VbenFormSchema[],
      {
        data: {
          deptId: 1,
          deptName: '财务部',
          supplierId: 2,
          supplierName: '供应商A',
        },
        formType: 'detail',
      },
    );

    expect(result[0]).toMatchObject({
      component: 'Input',
      componentProps: {
        allowClear: false,
        class: 'w-full finance-document-form-readonly-text',
        disabled: true,
      },
      fieldName: 'deptId',
      rules: undefined,
    });
    expect(result[1]?.component).toBe('Input');
    expect(result[2]?.component).toBe('Select');
  });

  it('keeps editable selects and injects current options', async () => {
    const options = [{ id: 5, label: '现金账户', name: '现金账户', value: 5 }];
    const result = buildFinanceDocumentFormSchema(
      [
        {
          component: 'ErpLazyPageSelect',
          componentProps: {
            afterFetch: (data: unknown) => data,
            options,
          },
          fieldName: 'accountId',
        },
        {
          component: 'ApiSelect',
          componentProps: { options: [] },
          fieldName: 'financeUserId',
        },
      ] as VbenFormSchema[],
      {
        data: {
          accountId: 5,
          accountName: '现金账户',
          financeUserId: 25,
          financeUserName: '杨万丽',
        },
        formType: 'edit',
      },
    );

    const accountProps = result[0]?.componentProps as any;
    const userProps = result[1]?.componentProps as any;
    expect(result[0]?.component).toBe('ErpLazyPageSelect');
    expect(accountProps.options).toBe(options);
    expect(userProps.options).toEqual([
      {
        id: 25,
        label: '杨万丽',
        name: '杨万丽',
        nickname: '杨万丽',
        value: 25,
      },
    ]);
    await expect(
      accountProps.afterFetch([{ id: 6, name: '银行账户' }]),
    ).resolves.toEqual([
      { id: 5, label: '现金账户', name: '现金账户', value: 5 },
      { id: 6, name: '银行账户' },
    ]);
  });

  it('builds detail display values without mutating source ids', () => {
    const source = {
      accountId: 5,
      accountName: '现金账户',
      creator: 25,
      creatorName: '制单人',
      deptId: 1,
      deptName: '财务部',
      outAccountId: 8,
      outAccountName: '转出账户',
    };

    const result = buildFinanceDocumentDetailFormValues(source, 'detail');

    expect(result).toMatchObject({
      accountId: '现金账户',
      creator: '制单人',
      deptId: '财务部',
      outAccountId: '转出账户',
    });
    expect(source).toMatchObject({ accountId: 5, creator: 25, deptId: 1 });
    expect(buildFinanceDocumentDetailFormValues(source, 'edit')).toBe(source);
  });

  it('hydrates missing labels from current options before fallback APIs', async () => {
    apiMocks.getSimpleUserList.mockResolvedValue([]);
    apiMocks.getUser.mockResolvedValue({ id: 25, nickname: '经手人' });
    apiMocks.getDept.mockResolvedValue({ id: 1, name: '财务部' });
    apiMocks.getAccount.mockResolvedValue({ id: 5, name: '现金账户' });
    apiMocks.getCustomer.mockResolvedValue({ id: 6, name: '客户A' });
    apiMocks.getSupplier.mockResolvedValue({ id: 7, name: '供应商A' });

    const result = await hydrateFinanceDocumentFormSelectLabels(
      {
        accountId: 5,
        customerId: 6,
        deptId: 1,
        financeUserId: 25,
        supplierId: 7,
      },
      {
        accountOptions: [{ id: 5, name: '已有账户' }],
      },
    );

    expect(result).toMatchObject({
      accountName: '已有账户',
      customerName: '客户A',
      deptName: '财务部',
      financeUserName: '经手人',
      supplierName: '供应商A',
    });
    expect(apiMocks.getAccount).not.toHaveBeenCalled();
  });
});
