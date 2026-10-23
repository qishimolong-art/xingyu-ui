import type { VbenFormSchema } from '#/adapter/form';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withCandidateFocus } from '../../utils/candidate-focus';

import {
  buildStockDocumentDetailFormValues,
  buildStockDocumentFormSchema,
  hydrateStockDocumentFormSelectLabels,
  isMissingStockDocumentDisplayName,
  mergeResolvedStockDocumentOptions,
} from './document-form-ui';

const apiMocks = vi.hoisted(() => ({
  getCustomer: vi.fn(),
  getDept: vi.fn(),
  getSimpleUserList: vi.fn(),
  getSupplier: vi.fn(),
  getUser: vi.fn(),
  getWarehouse: vi.fn(),
}));

vi.mock('#/api/erp/purchase/supplier', () => ({
  getSupplier: apiMocks.getSupplier,
}));

vi.mock('#/api/erp/sale/customer', () => ({
  getCustomer: apiMocks.getCustomer,
}));

vi.mock('#/api/erp/stock/warehouse', () => ({
  getWarehouse: apiMocks.getWarehouse,
}));

vi.mock('#/api/system/dept', () => ({
  getDept: apiMocks.getDept,
}));

vi.mock('#/api/system/user', () => ({
  getSimpleUserList: apiMocks.getSimpleUserList,
  getUser: apiMocks.getUser,
}));

describe('buildStockDocumentFormSchema', () => {
  it('preserves candidate markers, callbacks, current labels and detail readonly conversion through stock form preparation', () => {
    const api = vi.fn();
    const onChange = vi.fn();
    const schema = withCandidateFocus([
      {
        fieldName: 'warehouseId',
        component: 'ErpLazyPageSelect',
        componentProps: (context: unknown) => ({
          api,
          onChange,
          context,
          pageSize: 10,
          popupClassName: 'original',
        }),
      },
    ]) as VbenFormSchema[];
    const data = { warehouseId: 8, warehouseName: '仓库八' };
    const edit = buildStockDocumentFormSchema(schema, {
      formType: 'update',
      data,
    });
    const resolve = edit[0]?.componentProps;
    expect(typeof resolve).toBe('function');
    if (typeof resolve !== 'function') throw new Error('missing dynamic props');
    const context = { mode: 'edit' };
    const props = resolve(context, {} as any);
    expect(props).toMatchObject({
      api,
      onChange,
      context,
      pageSize: 10,
      popupClassName:
        'original erp-candidate-focus-popup stock-document-form-select-dropdown',
    });
    expect(api).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    const detail = buildStockDocumentFormSchema(schema, {
      formType: 'detail',
      data,
    });
    expect(detail[0]).toMatchObject({
      component: 'Input',
      componentProps: { disabled: true },
    });
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes the embedded item field and keeps ordinary fields', () => {
    const result = buildStockDocumentFormSchema([
      { component: 'Input', fieldName: 'no' },
      { component: 'Input', fieldName: 'items' },
      { component: 'Textarea', fieldName: 'remark' },
    ] as VbenFormSchema[]);

    expect(result.map((item) => item.fieldName)).toEqual(['no', 'remark']);
  });

  it('adds the shared popup class to static and dynamic select props', () => {
    const result = buildStockDocumentFormSchema([
      {
        component: 'Select',
        componentProps: { popupClassName: 'existing-popup' },
        fieldName: 'status',
      },
      {
        component: 'ApiSelect',
        componentProps: () => ({ allowClear: true }),
        fieldName: 'warehouseId',
      },
    ] as VbenFormSchema[]);

    expect(result[0]?.componentProps).toMatchObject({
      popupClassName: 'existing-popup stock-document-form-select-dropdown',
    });

    const dynamicProps = result[1]?.componentProps;
    expect(typeof dynamicProps).toBe('function');
    if (typeof dynamicProps !== 'function') return;
    expect(dynamicProps({}, {} as any)).toMatchObject({
      allowClear: true,
      popupClassName: 'stock-document-form-select-dropdown',
    });
  });

  it('renders configured select fields as readonly text fields in detail mode', () => {
    const result = buildStockDocumentFormSchema(
      [
        {
          component: 'ErpLazyPageSelect',
          fieldName: 'deptId',
          rules: 'required',
        },
        {
          component: 'CustomerLazySelect',
          fieldName: 'customerId',
          rules: 'required',
        },
        {
          component: 'SupplierLazySelect',
          fieldName: 'supplierId',
          rules: 'required',
        },
        { component: 'Select', fieldName: 'status' },
      ] as VbenFormSchema[],
      {
        data: {
          customerId: 2,
          customerName: '客户A',
          deptId: 1,
          deptName: '总经办',
          supplierId: 3,
          supplierName: '供应商A',
        },
        formType: 'detail',
      },
    );

    expect(result[0]).toMatchObject({
      component: 'Input',
      componentProps: {
        class: 'w-full stock-document-form-readonly-text',
        disabled: true,
      },
      fieldName: 'deptId',
      rules: undefined,
    });
    expect(result[1]?.component).toBe('Input');
    expect(result[2]?.component).toBe('Input');
    expect(result[3]?.component).toBe('Select');
  });

  it('keeps edit selects and injects the current option', () => {
    const result = buildStockDocumentFormSchema(
      [
        {
          component: 'ErpLazyPageSelect',
          componentProps: { options: [] },
          fieldName: 'creator',
        },
      ] as VbenFormSchema[],
      {
        data: { creator: 25, creatorName: '制单人' },
        formType: 'edit',
      },
    );

    expect(result[0]?.component).toBe('ErpLazyPageSelect');
    expect(result[0]?.componentProps).toMatchObject({
      options: [
        {
          id: 25,
          label: '制单人',
          name: '制单人',
          nickname: '制单人',
          value: 25,
        },
      ],
    });
  });

  it('keeps stable option references when nothing changed', () => {
    const options = [{ id: 1, label: '仓库A', name: '仓库A', value: 1 }];
    const result = buildStockDocumentFormSchema(
      [
        {
          component: 'ErpLazyPageSelect',
          componentProps: { options },
          fieldName: 'warehouseId',
        },
      ] as VbenFormSchema[],
      {
        data: { warehouseId: 1, warehouseName: '仓库A' },
        formType: 'edit',
      },
    );

    const componentProps = result[0]?.componentProps as any;
    expect(componentProps.options).toBe(options);
  });

  it('does not inject unresolved raw ids as current options', () => {
    const result = buildStockDocumentFormSchema(
      [
        {
          component: 'ErpLazyPageSelect',
          componentProps: { options: [] },
          fieldName: 'fromDeptId',
        },
      ] as VbenFormSchema[],
      {
        data: { fromDeptId: 8, fromDeptName: '8' },
        formType: 'edit',
      },
    );

    expect(result[0]?.componentProps).toMatchObject({ options: [] });
  });

  it('builds detail display values without mutating source ids', () => {
    const source = {
      customerId: 2,
      customerName: '客户A',
      fromWarehouseId: 3,
      fromWarehouseName: '调出仓',
      toDeptId: 6,
      toDeptName: '调入部门',
    };

    const result = buildStockDocumentDetailFormValues(source, 'detail');

    expect(result).toMatchObject({
      customerId: '客户A',
      fromWarehouseId: '调出仓',
      toDeptId: '调入部门',
    });
    expect(source.customerId).toBe(2);
    expect(source.fromWarehouseId).toBe(3);
  });

  it('hydrates missing stock document labels with fallback APIs', async () => {
    apiMocks.getSimpleUserList.mockResolvedValue([
      { id: 25, nickname: '经办人' },
    ]);
    apiMocks.getDept.mockResolvedValue({ id: 1, name: '仓储部' });
    apiMocks.getWarehouse.mockResolvedValue({ id: 3, name: '东仓' });
    apiMocks.getCustomer.mockResolvedValue({ id: 4, name: '客户A' });
    apiMocks.getSupplier.mockResolvedValue({ id: 5, name: '供应商A' });

    const result = await hydrateStockDocumentFormSelectLabels({
      creator: 25,
      creatorName: '25',
      customerId: 4,
      deptId: 1,
      fromDeptId: 1,
      fromWarehouseId: 3,
      supplierId: 5,
      toDeptId: 1,
    });

    expect(result).toMatchObject({
      creatorName: '经办人',
      customerName: '客户A',
      deptName: '仓储部',
      fromDeptName: '仓储部',
      fromWarehouseName: '东仓',
      supplierName: '供应商A',
      toDeptName: '仓储部',
    });
  });

  it('filters placeholder and raw-id labels while merging resolved options', () => {
    const oldOptions = [
      { id: 1, label: '仓库A', name: '仓库A', value: 1 },
      { id: 2, label: '加载中...', name: '加载中...', value: 2 },
    ];

    const result = mergeResolvedStockDocumentOptions(oldOptions, [
      { id: 2, label: '2', name: '2', value: 2 },
      { id: 3, label: '仓库C', name: '仓库C', value: 3 },
    ]);

    expect(result).toEqual([
      { id: 1, label: '仓库A', name: '仓库A', value: 1 },
      { id: 3, label: '仓库C', name: '仓库C', value: 3 },
    ]);
    expect(isMissingStockDocumentDisplayName('加载中...', 2)).toBe(true);
  });
});
