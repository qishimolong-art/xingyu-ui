import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildSaleCurrentUserFormDefaults,
  buildSaleDocumentDetailFormValues,
  hydrateCurrentSaleFormSelectNames,
  withCurrentSaleFormSelectOptions,
  withSaleCustomerFromSource,
} from './document-form';

const apiMocks = vi.hoisted(() => ({
  getCustomer: vi.fn(),
  getDept: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('#/api/erp/sale/customer', () => ({
  getCustomer: apiMocks.getCustomer,
}));

vi.mock('#/api/system/dept', () => ({
  getDept: apiMocks.getDept,
}));

vi.mock('#/api/system/user', () => ({
  getUser: apiMocks.getUser,
}));

describe('sale document form select hydration', () => {
  beforeEach(() => {
    apiMocks.getCustomer.mockReset();
    apiMocks.getDept.mockReset();
    apiMocks.getUser.mockReset();
  });

  it('fills missing customer, user and dept labels for current lazy select values', async () => {
    apiMocks.getCustomer.mockResolvedValue({
      code: 'C001',
      id: 6,
      name: '客户A',
    });
    apiMocks.getDept.mockResolvedValue({ id: 2, name: '销售二部' });
    apiMocks.getUser.mockResolvedValue({ id: 8, nickname: '销售员A' });

    const data = {
      customerId: 6,
      deptId: 2,
      saleUserId: 8,
    };

    await hydrateCurrentSaleFormSelectNames(data);

    expect(apiMocks.getCustomer).toHaveBeenCalledWith(6);
    expect(apiMocks.getDept).toHaveBeenCalledWith(2);
    expect(apiMocks.getUser).toHaveBeenCalledWith(8);
    expect(data).toMatchObject({
      customerCode: 'C001',
      customerName: '客户A',
      deptName: '销售二部',
      saleUserName: '销售员A',
    });
  });

  it('keeps existing labels without extra fallback requests', async () => {
    const data = {
      adjustUserId: 9,
      adjustUserName: '调价员B',
      deptId: 3,
      deptName: '销售三部',
    };

    await hydrateCurrentSaleFormSelectNames(data);

    expect(apiMocks.getCustomer).not.toHaveBeenCalled();
    expect(apiMocks.getDept).not.toHaveBeenCalled();
    expect(apiMocks.getUser).not.toHaveBeenCalled();
    expect(data.adjustUserName).toBe('调价员B');
    expect(data.deptName).toBe('销售三部');
  });

  it('builds current user defaults with matching display names', () => {
    expect(
      buildSaleCurrentUserFormDefaults(
        { id: 1, nickname: '当前销售员', username: 'admin' },
        ['saleUserId', 'adjustUserId'],
      ),
    ).toEqual({
      adjustUserId: 1,
      adjustUserName: '当前销售员',
      saleUserId: 1,
      saleUserName: '当前销售员',
    });
  });

  it('copies the current customer id and label from a source sale document', () => {
    expect(
      withSaleCustomerFromSource(
        {
          customerCode: 'OLD',
          customerId: 1,
          customerName: '旧客户',
        },
        {
          customerCode: 'C383',
          customerId: 383,
          customerName: '九龙福众汽修',
        },
      ),
    ).toEqual({
      customerCode: 'C383',
      customerId: 383,
      customerName: '九龙福众汽修',
    });
  });

  it('clears a stale customer label when the source only contains a new id', () => {
    expect(
      withSaleCustomerFromSource(
        {
          customerCode: 'OLD',
          customerId: 1,
          customerName: '旧客户',
        },
        { customerId: 383 },
      ),
    ).toEqual({
      customerCode: undefined,
      customerId: 383,
      customerName: undefined,
    });
  });

  it('injects current options and converts detail lazy fields to readonly text', () => {
    const sourceSchema: Array<{
      component?: string;
      componentProps?: unknown;
      fieldName?: string;
    }> = [
      { component: 'SaleCustomerLazySelect', fieldName: 'customerId' },
      { component: 'ErpLazyPageSelect', fieldName: 'deptId' },
      { component: 'ErpLazyPageSelect', fieldName: 'saleUserId' },
    ];
    const schema = withCurrentSaleFormSelectOptions(
      sourceSchema,
      {
        customerId: 6,
        customerName: '客户A',
        deptId: 2,
        deptName: '销售二部',
        saleUserId: 8,
        saleUserName: '销售员A',
      },
      'detail',
    );

    expect(schema.every((field) => field.component === 'Input')).toBe(true);
    const firstFieldProps = schema[0]?.componentProps as any;
    expect(firstFieldProps.disabled).toBe(true);
  });

  it('injects current options for edit lazy fields', () => {
    const sourceSchema: Array<{
      component?: string;
      componentProps?: unknown;
      fieldName?: string;
    }> = [
      { component: 'SaleCustomerLazySelect', fieldName: 'customerId' },
      { component: 'ErpLazyPageSelect', fieldName: 'deptId' },
    ];
    const schema = withCurrentSaleFormSelectOptions(sourceSchema, {
      customerId: 6,
      customerName: '客户A',
      deptId: 2,
      deptName: '销售二部',
    });

    const customerFieldProps = schema[0]?.componentProps as any;
    const deptFieldProps = schema[1]?.componentProps as any;
    expect(customerFieldProps.options).toEqual([
      expect.objectContaining({ label: '客户A', value: 6 }),
    ]);
    expect(deptFieldProps.options).toEqual([
      expect.objectContaining({ label: '销售二部', value: 2 }),
    ]);
  });

  it('does not inject raw ids as current lazy field labels', () => {
    const sourceSchema: Array<{
      component?: string;
      componentProps?: unknown;
      fieldName?: string;
    }> = [{ component: 'ErpLazyPageSelect', fieldName: 'saleUserId' }];
    const schema = withCurrentSaleFormSelectOptions(sourceSchema, {
      saleUserId: 8,
      saleUserName: '8',
    });

    expect(schema[0]?.componentProps).toBeUndefined();
  });

  it('uses labels instead of raw ids in detail form values', () => {
    const detailValues = buildSaleDocumentDetailFormValues(
      {
        customerId: 6,
        customerName: '客户A',
        deptId: 2,
        deptName: '2',
        saleUserId: 8,
        saleUserName: '销售员A',
      },
      'detail',
    );

    expect(detailValues).toMatchObject({
      customerId: '客户A',
      deptId: '-',
      saleUserId: '销售员A',
    });
  });
});
