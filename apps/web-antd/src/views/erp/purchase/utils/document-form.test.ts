import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupplier } from '#/api/erp/purchase/supplier';
import { getDept } from '#/api/system/dept';
import { getSimpleUserList, getUser } from '#/api/system/user';

import {
  buildPurchaseCurrentUserFormDefaults,
  buildPurchaseDocumentDetailFormValues,
  hydratePurchaseDocumentFormSelectLabels,
  hydratePurchaseSupplierFromFallback,
  preparePurchaseDocumentFormSchema,
  withCurrentPurchaseFormSelectOptions,
  withCurrentPurchaseSupplierOption,
} from './document-form';

vi.mock('#/api/system/dept', () => ({
  getDept: vi.fn(),
}));

vi.mock('#/api/system/user', () => ({
  getSimpleUserList: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('#/api/erp/purchase/supplier', () => ({
  getSupplier: vi.fn(),
}));

describe('purchase document form schema', () => {
  beforeEach(() => {
    vi.mocked(getDept).mockReset();
    vi.mocked(getSimpleUserList).mockReset();
    vi.mocked(getSupplier).mockReset();
    vi.mocked(getUser).mockReset();
  });

  it('keeps basic field order and removes embedded sections', () => {
    const schema = preparePurchaseDocumentFormSchema([
      { fieldName: 'no', component: 'Input' },
      { fieldName: 'supplierPayableInfo', component: 'Input' },
      { fieldName: 'supplierId', component: 'ApiSelect' },
      { fieldName: 'items', component: 'Input' },
      { fieldName: 'remark', component: 'Input' },
    ]);

    expect(schema.map(({ fieldName }) => fieldName)).toEqual([
      'no',
      'supplierId',
      'remark',
    ]);
  });

  it('adds an explicit popup class without dropping existing props', () => {
    const [field] = preparePurchaseDocumentFormSchema([
      {
        fieldName: 'supplierId',
        component: 'SupplierLazySelect',
        componentProps: { allowClear: true, popupClassName: 'existing-popup' },
      },
    ]);

    expect(field?.componentProps).toMatchObject({
      allowClear: true,
      popupClassName: 'existing-popup purchase-document-form-select-dropdown',
    });
  });

  it('injects the current supplier option into supplier select api results', async () => {
    const [field] = withCurrentPurchaseSupplierOption(
      [
        {
          fieldName: 'supplierId',
          component: 'ApiSelect',
          componentProps: {
            afterFetch: (data: unknown) => data,
          },
        },
      ],
      { supplierId: 12, supplierName: '供应商A' },
    );

    const props = field?.componentProps as {
      afterFetch: (data: unknown) => Promise<unknown>;
      options: unknown[];
    };

    expect(props.options).toEqual([
      { id: 12, label: '供应商A', name: '供应商A', value: 12 },
    ]);
    await expect(
      props.afterFetch([{ id: 13, name: '供应商B' }]),
    ).resolves.toEqual([
      { id: 12, label: '供应商A', name: '供应商A', value: 12 },
      { id: 13, name: '供应商B' },
    ]);
  });

  it('converts purchase document detail select fields to readonly text inputs', () => {
    const schema = preparePurchaseDocumentFormSchema(
      [
        { fieldName: 'deptId', component: 'ErpLazyPageSelect' },
        { fieldName: 'handler', component: 'ErpLazyPageSelect' },
        { fieldName: 'supplierId', component: 'SupplierLazySelect' },
      ],
      {
        formType: 'detail',
      },
    );

    expect(schema[0]).toMatchObject({
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '-',
      },
      fieldName: 'deptId',
    });
    expect(schema[1]).toMatchObject({
      component: 'Input',
      fieldName: 'handler',
    });
    expect(schema[2]).toMatchObject({
      component: 'Input',
      fieldName: 'supplierId',
    });
  });

  it('keeps editable select fields as lazy selects while injecting current labels', async () => {
    const existingOptions = [
      {
        id: 25,
        label: '杨万丽',
        name: '杨万丽',
        nickname: '杨万丽',
        value: 25,
      },
    ];
    const [field] = withCurrentPurchaseFormSelectOptions(
      [
        {
          fieldName: 'creator',
          component: 'ErpLazyPageSelect',
          componentProps: {
            afterFetch: (data: unknown) => data,
            options: existingOptions,
          },
        },
      ],
      { creator: 25, creatorName: '杨万丽' },
    );
    const props = field?.componentProps as {
      afterFetch: (data: unknown) => Promise<unknown>;
      options: unknown[];
    };

    expect(field?.component).toBe('ErpLazyPageSelect');
    expect(props.options).toBe(existingOptions);
    await expect(
      props.afterFetch([{ id: 26, nickname: '王五' }]),
    ).resolves.toEqual([
      {
        id: 25,
        label: '杨万丽',
        name: '杨万丽',
        nickname: '杨万丽',
        value: 25,
      },
      { id: 26, nickname: '王五' },
    ]);
  });

  it('builds current user defaults with display labels for lazy selects', async () => {
    const defaults = buildPurchaseCurrentUserFormDefaults(
      {
        id: 1,
        nickname: '张三',
        username: 'zhangsan',
        deptId: 3,
        deptName: '采购部',
      },
      ['purchaser', 'handlerId'],
      { includeDept: true },
    );
    const [field] = withCurrentPurchaseFormSelectOptions(
      [
        {
          fieldName: 'handlerId',
          component: 'ErpLazyPageSelect',
          componentProps: {
            afterFetch: (data: unknown) => data,
            options: [{ id: 2, nickname: '李四' }],
          },
        },
      ],
      defaults,
    );
    const props = field?.componentProps as {
      afterFetch: (data: unknown) => Promise<unknown>;
      options: unknown[];
    };

    expect(defaults).toMatchObject({
      deptId: 3,
      deptName: '采购部',
      handlerId: 1,
      handlerName: '张三',
      purchaser: 1,
      purchaserName: '张三',
    });
    expect(props.options).toEqual([
      { id: 1, label: '张三', name: '张三', nickname: '张三', value: 1 },
      { id: 2, nickname: '李四' },
    ]);
    await expect(
      props.afterFetch([{ id: 4, nickname: '王五' }]),
    ).resolves.toEqual([
      { id: 1, label: '张三', name: '张三', nickname: '张三', value: 1 },
      { id: 4, nickname: '王五' },
    ]);
  });

  it('updates stale numeric select options without churning stable options', () => {
    const [field] = withCurrentPurchaseFormSelectOptions(
      [
        {
          fieldName: 'deptId',
          component: 'ErpLazyPageSelect',
          componentProps: {
            options: [{ id: 1, label: '1', name: '1', value: 1 }],
          },
        },
      ],
      { deptId: 1, deptName: '东升配件站' },
    );
    const props = field?.componentProps as { options: unknown[] };

    expect(props.options).toEqual([
      {
        id: 1,
        label: '东升配件站',
        name: '东升配件站',
        nickname: '东升配件站',
        value: 1,
      },
    ]);
  });

  it('does not inject a numeric supplier label as the current option', () => {
    const [field] = withCurrentPurchaseSupplierOption(
      [
        {
          fieldName: 'supplierId',
          component: 'SupplierLazySelect',
          componentProps: {},
        },
      ],
      { supplierId: 12, supplierName: '12' },
    );

    expect(field?.componentProps).toEqual({});
  });

  it('builds text values for detail forms without mutating document data', () => {
    const data = {
      creator: 25,
      creatorName: '杨万丽',
      deptId: 1,
      deptName: '东升配件站',
      handler: 62,
      handlerName: '李四',
      supplierId: 12,
      supplierName: '12',
    };
    const detailValues = buildPurchaseDocumentDetailFormValues(data, 'detail');

    expect(detailValues).toMatchObject({
      creator: '杨万丽',
      deptId: '东升配件站',
      handler: '李四',
      supplierId: '-',
    });
    expect(data).toMatchObject({ creator: 25, deptId: 1, handler: 62 });
    expect(buildPurchaseDocumentDetailFormValues(data, 'edit')).toBe(data);
  });

  it('hydrates missing department and user labels for current select values', async () => {
    vi.mocked(getSimpleUserList).mockResolvedValue([
      {
        id: 25,
        nickname: '杨万丽',
        username: 'yang',
      } as any,
    ]);
    vi.mocked(getUser).mockResolvedValue({
      id: 62,
      nickname: '李四',
      username: 'li',
    } as any);
    vi.mocked(getDept).mockResolvedValue({
      id: 1,
      name: '东升配件站',
    } as any);
    vi.mocked(getSupplier).mockResolvedValue({
      id: 12,
      name: '供应商A',
    } as any);

    const hydrated = await hydratePurchaseDocumentFormSelectLabels({
      creator: 25,
      creatorName: '25',
      deptId: 1,
      handler: 62,
      handlerName: undefined,
      supplierId: 12,
      supplierName: '12',
    });

    expect(hydrated).toMatchObject({
      creatorName: '杨万丽',
      deptName: '东升配件站',
      handlerName: '李四',
      supplierName: '供应商A',
    });
  });

  it('hydrates missing supplier fields from a fallback row without overwriting loaded data', () => {
    const hydrated = hydratePurchaseSupplierFromFallback(
      {
        id: 1,
        items: [{ id: 100 }],
        supplierId: undefined,
        supplierName: undefined,
        supplierType: 'loaded-type',
      },
      {
        items: [{ id: 200 }],
        supplierId: 12,
        supplierName: '供应商A',
        supplierPayableInfo: { payable: 100 },
        supplierType: 'fallback-type',
      },
    );

    expect(hydrated).toMatchObject({
      id: 1,
      items: [{ id: 100 }],
      supplierId: 12,
      supplierName: '供应商A',
      supplierPayableInfo: { payable: 100 },
      supplierType: 'loaded-type',
    });
  });

  it('hydrates missing item rows from a fallback row', () => {
    const hydrated = hydratePurchaseSupplierFromFallback(
      { id: 1, items: [] },
      {
        items: [{ id: 200, productName: '配件A' }],
        supplierId: 12,
        supplierName: '供应商A',
      },
    );

    expect(hydrated.items).toEqual([{ id: 200, productName: '配件A' }]);
  });
});
