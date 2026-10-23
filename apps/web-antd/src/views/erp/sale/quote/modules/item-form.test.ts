import { createApp, h, nextTick, reactive, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ItemForm from './item-form.vue';

const testState = vi.hoisted(() => ({
  allowedPermissions: null as null | Set<string>,
  columnOptions: null as any,
  editableTarget: false,
  getAvailableBatchNoList: vi.fn(async () => []),
  getProduct: vi.fn(async () => ({
    barCode: 'BAR-001',
    batchNoEnabled: true,
    brand: 'Brand',
    code: 'P-001',
    name: 'Product 001',
    originPlace: 'Origin',
    standard: 'STD',
    unitId: 1,
    unitName: 'EA',
    vehicleModel: 'Model',
  })),
  gridOptions: null as any,
  loadData: vi.fn(async (_rows: any[]) => undefined),
  openProductForm: vi.fn(),
  openStockModal: vi.fn(),
  openPurchaseHistory: vi.fn(),
  optionsChanged: undefined as undefined | (() => void),
  runtimeColumns: [] as any[],
  savedColumnWidths: {} as Record<string, number>,
  renderedRows: [] as any[],
  selectedProducts: [] as any[],
  shortcutDialogOpen: false,
  setGridOptions: vi.fn((options: any) => {
    if (testState.gridOptions) {
      testState.gridOptions.gridOptions = {
        ...testState.gridOptions.gridOptions,
        ...options,
      };
      testState.optionsChanged?.();
    }
  }),
  warning: vi.fn(),
  warehouseListByDept: vi.fn(
    async (_deptId?: number, _params?: Record<string, any>) => [] as any[],
  ),
}));

vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    useVbenModal: vi.fn(() => [
      defineComponent({
        emits: ['success'],
        setup(_props, { emit }) {
          return () =>
            h('button', {
              'data-testid': 'product-form-modal',
              onClick: () => emit('success'),
            });
        },
      }),
      {
        setData: vi.fn((data?: Record<string, unknown>) => ({
          open: () => {
            if (data?.type === 'edit') testState.openProductForm();
          },
        })),
      },
    ]),
    VbenLoading: defineComponent({
      setup() {
        return () => h('div');
      },
    }),
  };
});

vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: vi.fn(
      (codes: string[]) =>
        testState.allowedPermissions === null ||
        codes.some((code) => testState.allowedPermissions?.has(code)),
    ),
  }),
}));

vi.mock('@vben/utils', () => ({
  erpCountInputFormatter: (value: unknown) => {
    if (value === null || value === undefined || value === '') return '';
    return Number(value)
      .toFixed(3)
      .replace(/(\.\d*?[1-9])0+$/u, '$1')
      .replace(/\.0+$/u, '');
  },
  erpPriceInputFormatter: (value: unknown) => {
    if (value === null || value === undefined || value === '') return '';
    return Number(value).toFixed(2);
  },
  erpPriceMultiply: (left: number, right: number) => left * right,
  mergeRouteModules: () => [],
  traverseTreeValues: () => [],
}));

vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const UiStub = defineComponent({
    setup(_props, { slots }) {
      return () => h('span', slots.default?.());
    },
  });
  const ButtonStub = defineComponent({
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      return () =>
        h(
          'button',
          {
            ...attrs,
            'data-testid':
              attrs.type === 'primary' ? 'primary-action' : 'secondary-action',
          },
          slots.default?.(),
        );
    },
  });
  return {
    Button: ButtonStub,
    Checkbox: UiStub,
    Input: UiStub,
    message: { warning: testState.warning },
    Pagination: UiStub,
    Select: UiStub,
    Tag: UiStub,
    TreeSelect: UiStub,
  };
});

vi.mock('#/adapter/vxe-table', async () => {
  const { defineComponent, h } = await import('vue');
  const GridStub = defineComponent({
    setup(_, { slots }) {
      return () =>
        h('div', { 'data-testid': 'item-grid' }, slots['toolbar-tools']?.());
    },
  });
  return {
    TableAction: defineComponent({
      setup() {
        return () => h('button');
      },
    }),
    useVbenVxeGrid: vi.fn((options) => {
      testState.gridOptions = options;
      return [
        GridStub,
        {
          grid: {
            getFullColumns: () => testState.runtimeColumns,
            loadData: testState.loadData,
            reloadColumn: vi.fn(async (columns: any[]) => {
              testState.runtimeColumns = structuredClone(columns).map(
                (column: any) => ({
                  ...column,
                  resizeWidth: testState.savedColumnWidths[column.field] || 0,
                }),
              );
            }),
            reloadData: vi.fn(),
            resetCustom: vi.fn(async () => {
              testState.savedColumnWidths = {};
              testState.runtimeColumns = [];
            }),
            saveCustom: vi.fn(async () => {
              testState.savedColumnWidths = Object.fromEntries(
                testState.runtimeColumns
                  .filter((column) => column.field && column.resizeWidth)
                  .map((column) => [column.field, column.resizeWidth]),
              );
            }),
            setSort: vi.fn(),
            updateData: vi.fn(),
          },
          setGridOptions: testState.setGridOptions,
        },
      ];
    }),
  };
});

vi.mock('#/api/erp/product/product', () => ({
  getProduct: testState.getProduct,
}));

vi.mock('#/api/erp/sale/quote', () => ({
  batchUpdateSaleQuoteItems: vi.fn(async () => undefined),
  getSaleQuoteDeptSimplePage: vi.fn(async () => ({ list: [], total: 0 })),
  getSaleQuoteWarehouseDeptSimplePage: vi.fn(async () => ({
    list: [],
    total: 0,
  })),
}));

vi.mock('#/api/erp/config/field', () => ({
  getRuntimeFieldConfigList: vi.fn(async () => [
    {
      fieldGroup: 'price_info',
      fieldLabel: '订货价',
      fieldName: 'orderPriceCustom',
      fieldSource: 'CUSTOM',
    },
  ]),
}));

vi.mock('#/api/erp/stock/stock', () => ({
  getAvailableBatchNoList: testState.getAvailableBatchNoList,
  getSaleStockPage: vi.fn(async () => ({ list: [], total: 0 })),
  getStockCount: vi.fn(async () => 10),
}));

vi.mock('#/api/erp/stock/warehouse', () => ({
  getWarehouse: vi.fn(async (id: number) => ({
    id,
    deptId: 102,
    deptName: '销售部门',
    name: `仓库${id}`,
  })),
  getSaleWarehouseSimplePage: vi.fn(async (params?: Record<string, any>) => {
    const { deptId, pageNo, pageSize, ...rest } = params || {};
    void pageNo;
    void pageSize;
    const list = await testState.warehouseListByDept(deptId, rest);
    return { list, total: list.length };
  }),
}));

vi.mock('#/api/system/dept', () => ({
  getDept: vi.fn(async (id: number) => ({ id, name: `部门${id}` })),
}));

vi.mock('#/composables/useFieldPermission', () => ({
  isFieldHidden: (hiddenFields: string[] = [], field: string) =>
    hiddenFields.includes(field),
  useFieldPermission: () => ({
    hiddenFields: ref([]),
    loadHiddenFields: vi.fn(async () => undefined),
    loaded: ref(true),
  }),
}));

vi.mock(
  '#/views/erp/sale/components/SaleStockProductSelectModal.vue',
  async () => {
    const { defineComponent, h } = await import('vue');
    return {
      default: defineComponent({
        emits: ['success'],
        setup(_, { emit, expose }) {
          expose({
            isShortcutDialogOpen: vi.fn(() => testState.shortcutDialogOpen),
            open: testState.openStockModal,
            openShortcutHistory: vi.fn(),
          });
          return () =>
            h('button', {
              'data-testid': 'select-stock-products',
              onClick: () => {
                emit('success', testState.selectedProducts);
              },
            });
        },
      }),
    };
  },
);

vi.mock(
  '#/views/erp/purchase/components/PurchaseItemDetailShortcuts.vue',
  async () => {
    const { defineComponent } = await import('vue');
    return {
      default: defineComponent({
        setup(_, { expose }) {
          expose({
            isShortcutDialogOpen: vi.fn(() => testState.shortcutDialogOpen),
            openPurchaseHistory: testState.openPurchaseHistory,
          });
          return () => null;
        },
      }),
    };
  },
);

vi.mock('#/views/erp/product/product/modules/form.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      setup() {
        return () => h('div');
      },
    }),
  };
});

vi.mock(
  '#/views/erp/sale/components/sale-batch-update-items-form.vue',
  async () => {
    const { defineComponent, h } = await import('vue');
    return {
      default: defineComponent({
        emits: ['success'],
        setup() {
          return () => h('div');
        },
      }),
    };
  },
);

vi.mock(
  '#/views/erp/sale/components/sale-batch-adjust-price-form.vue',
  async () => {
    const { defineComponent, h } = await import('vue');
    return {
      default: defineComponent({
        emits: ['success'],
        setup() {
          return () => h('div');
        },
      }),
    };
  },
);

vi.mock('#/views/erp/sale/utils/dept', () => ({
  getSaleDeptTree: vi.fn(async () => []),
}));

vi.mock('#/views/erp/utils/item', () => ({
  buildErpItemDuplicateKey: (
    item: Record<string, any>,
    options: Record<string, any> = {},
  ) =>
    [
      item.productId,
      item.warehouseId,
      options.batchField ? item[options.batchField] : undefined,
      item.giftFlag === true,
    ].join('-'),
  isBatchNoEnabled: (value: unknown) => value === true,
}));

vi.mock('#/views/erp/utils/keyboard', () => ({
  focusFirstEditableInput: vi.fn(() => true),
  focusNextInputOnEnter: vi.fn(),
  isCreateShortcutKey: vi.fn(() => false),
  isEditableEnterTarget: vi.fn(() => testState.editableTarget),
  queueAfterEditableControlRender: vi.fn((callback: () => void) => callback()),
}));

vi.mock('../data', async () => {
  const { prepareSaleDocumentItemColumns } =
    await import('#/views/erp/sale/utils/document-item-table');
  return {
    useFormItemColumns: vi.fn(
      (_disabled: boolean, hiddenFields: string[], options: any) => {
        testState.columnOptions = options;
        return prepareSaleDocumentItemColumns(
          [
            { type: 'seq', title: '序号', width: 50 },
            { field: 'productId', title: '产品名称', minWidth: 220 },
            { field: 'productCode', title: '产品编号', minWidth: 130 },
            { field: 'remark', title: '备注', minWidth: 90 },
          ].filter((column) => !hiddenFields.includes(`item_${column.field}`)),
          options,
        );
      },
    ),
  };
});

describe('sale quote item form product selection', () => {
  let unmount: (() => void) | undefined;

  beforeEach(() => {
    testState.loadData.mockImplementation(async (rows: any[]) => {
      testState.renderedRows = [...rows];
    });
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
    testState.allowedPermissions = null;
    testState.columnOptions = null;
    testState.getAvailableBatchNoList.mockReset();
    testState.getAvailableBatchNoList.mockResolvedValue([]);
    testState.getProduct.mockClear();
    testState.editableTarget = false;
    testState.gridOptions = null;
    testState.loadData.mockReset();
    testState.openProductForm.mockReset();
    testState.openStockModal.mockReset();
    testState.openPurchaseHistory.mockReset();
    testState.optionsChanged = undefined;
    testState.runtimeColumns = [];
    testState.savedColumnWidths = {};
    testState.renderedRows = [];
    testState.selectedProducts = [];
    testState.shortcutDialogOpen = false;
    testState.setGridOptions.mockClear();
    testState.warning.mockReset();
    testState.warehouseListByDept.mockReset();
    testState.warehouseListByDept.mockResolvedValue([]);
  });

  function mountItemForm(mainDeptId?: number, customerPriceLevel?: number) {
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      customerPriceLevel,
      compact: true,
      items: [],
      mainDeptId,
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };
    return container;
  }

  function mountAdaptiveDetail() {
    const props = reactive({
      compact: true,
      disabled: true,
      hiddenFields: [] as string[],
      itemPageLoading: true,
      items: [] as any[],
      mainDeptId: 102,
      remotePaging: true,
    });
    const container = document.createElement('div');
    const app = createApp({ render: () => h(ItemForm, props) });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };
    // The real wrapper clones columns for every options update, and VXE then
    // reloads those column props even when only the loading flag changed.
    testState.optionsChanged = () => {
      testState.runtimeColumns = structuredClone(
        testState.gridOptions.gridOptions.columns,
      ).map((column: any) => ({
        ...column,
        resizeWidth: testState.savedColumnWidths[column.field] || 0,
      }));
    };
    return props;
  }

  function adaptiveRow(productName = '美孚黑霸王傲超轻享C3 5W-30') {
    return {
      count: 1,
      productCode: '144704',
      productId: 144704,
      productName,
      productPrice: 150,
      warehouseDeptId: 103,
      warehouseDeptName: '兴宇路通',
      warehouseId: 201,
      warehouseName: '大塘仓',
    };
  }

  const productColumn = () =>
    testState.runtimeColumns.find((column) => column.field === 'productId');

  it('keeps adaptive widths after loading ends and detail is reopened', async () => {
    for (let cycle = 0; cycle < 2; cycle++) {
      const props = mountAdaptiveDetail();
      await nextTick();
      props.items = [adaptiveRow()];
      await vi.waitFor(() => expect(productColumn()?.width).toBe(273));
      props.itemPageLoading = false;
      await nextTick();
      expect(productColumn()?.width).toBe(273);
      expect(testState.runtimeColumns).toMatchObject(
        testState.gridOptions.gridOptions.columns,
      );
      unmount?.();
      unmount = undefined;
      testState.optionsChanged = undefined;
      testState.runtimeColumns = [];
    }
  });

  it('keeps reset defaults after another loading cycle and recalculates each page', async () => {
    let props = mountAdaptiveDetail();
    await nextTick();
    props.items = [adaptiveRow()];
    await vi.waitFor(() => expect(productColumn()?.width).toBe(273));
    testState.runtimeColumns.find(
      (column) => column.field === 'productCode',
    ).visible = false;
    productColumn().resizeWidth = 180;
    await testState.gridOptions.gridEvents.custom({ type: 'confirm' });
    expect(productColumn()?.width).toBe(180);
    await testState.gridOptions.gridEvents.custom({ type: 'reset' });
    expect(productColumn()?.width).toBe(273);
    expect(
      testState.runtimeColumns.find((column) => column.field === 'productCode')
        .visible,
    ).not.toBe(false);
    props.itemPageLoading = false;
    await nextTick();
    expect(productColumn()?.width).toBe(273);
    unmount?.();
    unmount = undefined;
    testState.optionsChanged = undefined;
    testState.runtimeColumns = [];
    props = mountAdaptiveDetail();
    await nextTick();
    props.items = [adaptiveRow()];
    await vi.waitFor(() => expect(productColumn()?.width).toBe(273));
    props.itemPageLoading = false;
    await nextTick();
    expect(productColumn()?.width).toBe(273);
    props.itemPageLoading = true;
    props.items = [
      adaptiveRow('用于验证第二页产品名称自适应且完整显示的超长产品名称'),
    ];
    await vi.waitFor(() => expect(productColumn()?.width).toBeGreaterThan(350));
    const width = productColumn().width;
    props.itemPageLoading = false;
    await nextTick();
    expect(productColumn()?.width).toBe(width);
  });

  it('preserves confirmed personal widths, order, visibility and fixed columns on reload', async () => {
    const props = mountAdaptiveDetail();
    await nextTick();
    props.items = [adaptiveRow()];
    await vi.waitFor(() => expect(productColumn()?.width).toBe(273));
    const columns = testState.runtimeColumns;
    const code = columns.find((column) => column.field === 'productCode');
    code.visible = false;
    productColumn().resizeWidth = 320;
    productColumn().fixed = 'left';
    testState.runtimeColumns = [
      code,
      ...columns.filter((column) => column !== code),
    ];
    await testState.gridOptions.gridEvents.custom({ type: 'confirm' });
    props.itemPageLoading = false;
    await nextTick();
    props.items = [adaptiveRow('另一个产品')];
    await vi.waitFor(() =>
      expect(testState.renderedRows[0]?.productName).toBe('另一个产品'),
    );
    expect(productColumn()).toMatchObject({ width: 320, fixed: 'left' });
    expect(testState.runtimeColumns[0]).toMatchObject({
      field: 'productCode',
      visible: false,
    });
    expect(testState.runtimeColumns.at(-1)).toMatchObject({
      field: 'remark',
      minWidth: 150,
    });
  });

  it('keeps permission-driven columns in wrapper options across loading updates', async () => {
    const props = mountAdaptiveDetail();
    await nextTick();
    props.items = [adaptiveRow()];
    await vi.waitFor(() => expect(productColumn()?.width).toBe(273));
    props.hiddenFields = ['item_remark'];
    await vi.waitFor(() =>
      expect(testState.gridOptions.gridOptions.columns.at(-1)).toMatchObject({
        field: 'productCode',
        minWidth: 150,
      }),
    );
    props.itemPageLoading = false;
    await nextTick();
    expect(
      testState.runtimeColumns.some((column) => column.field === 'remark'),
    ).toBe(false);
    expect(
      testState.runtimeColumns.find((column) => column.field === 'productCode'),
    ).toMatchObject({ minWidth: 150 });
  });

  it('将跨部门提示文字空间计入产品名称列宽', async () => {
    mountItemForm(102);
    await nextTick();

    const getExtraWidth = testState.columnOptions?.getCellContentExtraWidth;
    expect(getExtraWidth).toBeTypeOf('function');
    expect(
      getExtraWidth('productId', {
        productId: 101,
        warehouseDeptId: 102,
      }),
    ).toBe(0);
    expect(
      getExtraWidth('productId', {
        productId: 102,
        warehouseDeptId: 103,
      }),
    ).toBe(60);
    expect(
      getExtraWidth('warehouseId', {
        productId: 102,
        warehouseDeptId: 103,
      }),
    ).toBe(0);
  });

  it('新增行不再要求先选择客户所属部门', async () => {
    const container = mountItemForm();

    await vi.waitFor(() => expect(testState.loadData).toHaveBeenCalled());
    testState.loadData.mockClear();
    container
      .querySelector<HTMLButtonElement>('[data-testid="primary-action"]')
      ?.click();

    await vi.waitFor(() => expect(testState.renderedRows).toHaveLength(1));
    expect(testState.renderedRows[0]).toEqual(
      expect.objectContaining({
        count: 1,
        productPriceText: '',
        totalPrice: 0,
      }),
    );
    expect(testState.warning).not.toHaveBeenCalled();
    expect(testState.warehouseListByDept).not.toHaveBeenCalled();
    expect(testState.openStockModal).not.toHaveBeenCalled();
  });

  it('新增行不再打开旧报价库存选择弹窗', async () => {
    testState.warehouseListByDept.mockResolvedValue([
      { id: 201, name: '销售仓库' },
    ]);
    const container = mountItemForm(102);

    await vi.waitFor(() => expect(testState.loadData).toHaveBeenCalled());
    testState.loadData.mockClear();
    container
      .querySelector<HTMLButtonElement>('[data-testid="primary-action"]')
      ?.click();

    await vi.waitFor(() => expect(testState.renderedRows).toHaveLength(1));
    expect(testState.openStockModal).not.toHaveBeenCalled();
    expect(testState.warehouseListByDept).not.toHaveBeenCalled();
    expect(testState.warning).not.toHaveBeenCalled();
  });

  it('所属部门没有销售仓库时仍可先新增空行', async () => {
    const container = mountItemForm(100);

    await vi.waitFor(() => expect(testState.loadData).toHaveBeenCalled());
    testState.loadData.mockClear();
    container
      .querySelector<HTMLButtonElement>('[data-testid="primary-action"]')
      ?.click();

    await vi.waitFor(() => expect(testState.renderedRows).toHaveLength(1));
    expect(testState.warning).not.toHaveBeenCalled();
    expect(testState.openStockModal).not.toHaveBeenCalled();
  });

  it('详情表格挂载后重新灌入接口返回的产品行', async () => {
    testState.loadData.mockImplementationOnce(async () => undefined);
    testState.loadData.mockImplementation(async (rows: any[]) => {
      testState.renderedRows = [...rows];
    });
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      disabled: true,
      items: [
        {
          count: 2,
          productId: 101,
          productName: '报价产品',
          productPrice: 15,
          warehouseId: 201,
          warehouseName: '销售仓库',
        },
      ],
      mainDeptId: 102,
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => {
      expect(testState.loadData).toHaveBeenCalledTimes(2);
      expect(testState.renderedRows).toHaveLength(1);
      expect(testState.renderedRows[0]?.productId).toBe(101);
      expect(testState.renderedRows[0]?.countText).toBe('2');
      expect(testState.renderedRows[0]?.productPriceText).toBe('15.00');
    });
  });

  it('在报价详情中按活动明细行触发采购订单、采购入库和商品修改快捷键', async () => {
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      disabled: true,
      items: [
        {
          count: 1,
          productCode: 'P-DETAIL-101',
          productId: 101,
          productName: '报价详情快捷键商品',
          productPrice: 12,
          warehouseId: 201,
        },
      ],
      mainDeptId: 102,
      shortcutActive: true,
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => expect(testState.renderedRows).toHaveLength(1));
    testState.gridOptions.gridEvents.cellClick({
      row: testState.renderedRows[0],
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'KeyP',
        key: 'p',
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'KeyI',
        key: 'i',
      }),
    );
    expect(testState.openPurchaseHistory).toHaveBeenNthCalledWith(1, 'order');
    expect(testState.openPurchaseHistory).toHaveBeenNthCalledWith(2, 'in');

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'KeyF',
        key: 'f',
      }),
    );
    expect(testState.openProductForm).toHaveBeenCalledTimes(1);
  });

  it('输入、IME 和子弹框期间暂停采购快捷键并在关闭后恢复', async () => {
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      disabled: true,
      items: [
        {
          count: 1,
          productCode: 'P-GUARD-101',
          productId: 101,
          productName: '报价快捷键层级商品',
          productPrice: 12,
          warehouseId: 201,
        },
      ],
      mainDeptId: 102,
      shortcutActive: true,
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => expect(testState.renderedRows).toHaveLength(1));
    testState.gridOptions.gridEvents.cellClick({
      row: testState.renderedRows[0],
    });

    const pressKey = (
      key: string,
      init: KeyboardEventInit & { isComposing?: boolean } = {},
    ) => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: `Key${key.toUpperCase()}`,
        key,
        ...init,
      });
      if (init.isComposing !== undefined) {
        Object.defineProperty(event, 'isComposing', {
          value: init.isComposing,
        });
      }
      window.dispatchEvent(event);
    };

    testState.editableTarget = true;
    pressKey('p');
    pressKey('i');
    pressKey('f');

    testState.editableTarget = false;
    testState.shortcutDialogOpen = true;
    pressKey('p');
    pressKey('i');
    pressKey('f');

    testState.shortcutDialogOpen = false;
    pressKey('p', { isComposing: true });
    pressKey('i', { isComposing: true });
    pressKey('f', { isComposing: true });

    expect(testState.openPurchaseHistory).not.toHaveBeenCalled();
    expect(testState.openProductForm).not.toHaveBeenCalled();

    pressKey('p');
    pressKey('f');
    expect(testState.openPurchaseHistory).toHaveBeenCalledWith('order');
    expect(testState.openProductForm).toHaveBeenCalledTimes(1);
  });

  it('按采购订单、采购入库和商品权限分别显示并执行快捷键', async () => {
    testState.allowedPermissions = new Set(['erp:purchase-order:query']);
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      disabled: true,
      items: [
        {
          count: 1,
          productCode: 'P-PERMISSION-101',
          productId: 101,
          productName: '报价权限商品',
          productPrice: 12,
          warehouseId: 201,
        },
      ],
      mainDeptId: 102,
      shortcutActive: true,
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => expect(testState.renderedRows).toHaveLength(1));
    testState.gridOptions.gridEvents.cellClick({
      row: testState.renderedRows[0],
    });

    for (const key of ['p', 'i', 'f']) {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: `Key${key.toUpperCase()}`,
          key,
        }),
      );
    }

    expect(testState.openPurchaseHistory).toHaveBeenCalledTimes(1);
    expect(testState.openPurchaseHistory).toHaveBeenCalledWith('order');
    expect(testState.openProductForm).not.toHaveBeenCalled();
  });

  it('金额固定两位、其他数字去尾零且未编辑原值保持不变', async () => {
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      items: [
        {
          count: '1.250',
          productId: 101,
          productName: 'precision product',
          productPrice: 20.567,
          warehouseId: 201,
          warehouseName: 'sale warehouse',
        },
        {
          count: '1.000',
          giftFlag: true,
          productId: 102,
          productName: 'gift product',
          productPrice: 0,
          warehouseId: 201,
          warehouseName: 'sale warehouse',
        },
      ],
      mainDeptId: 102,
    });
    const vm = app.mount(container) as any;
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => expect(testState.renderedRows).toHaveLength(2));

    expect(testState.renderedRows[0]).toEqual(
      expect.objectContaining({
        countText: '1.25',
        productPriceText: '20.57',
      }),
    );
    expect(testState.renderedRows[1]).toEqual(
      expect.objectContaining({ countText: '1', productPriceText: '0.00' }),
    );
    const submitItems = vm.getSubmitItems();
    expect(submitItems[0]).toEqual(
      expect.objectContaining({ count: 1.25, productPrice: 20.567 }),
    );
    expect(() => vm.validate(submitItems)).not.toThrow();
  });

  it('allows zero price for draft items but still rejects formal submit items', async () => {
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      items: [
        {
          count: 1,
          productId: 101,
          productName: 'draft product',
          productPrice: 0,
          warehouseId: 201,
          warehouseName: 'sale warehouse',
        },
      ],
      mainDeptId: 102,
    });
    const vm = app.mount(container) as any;
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => expect(testState.loadData).toHaveBeenCalled());

    expect(vm.getDraftItems()).toEqual([
      expect.objectContaining({
        count: 1,
        productId: 101,
        productPrice: 0,
        totalPrice: 0,
        warehouseId: 201,
      }),
    ]);
    expect(() => vm.getSubmitItems()).toThrow();
  });

  it('uses pending unit price text when generating draft items', async () => {
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      items: [
        {
          count: 2,
          productId: 101,
          productName: 'draft product',
          productPrice: 0,
          warehouseId: 201,
          warehouseName: 'sale warehouse',
        },
      ],
      mainDeptId: 102,
    });
    const vm = app.mount(container) as any;
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => expect(testState.loadData).toHaveBeenCalled());

    testState.renderedRows[0].productPriceText = '30';
    testState.renderedRows[0].productPriceTextDirty = true;
    expect(vm.getDraftItems()).toEqual([
      expect.objectContaining({
        count: 2,
        productId: 101,
        productPrice: 30,
        totalPrice: 60,
        warehouseId: 201,
      }),
    ]);
  });

  it('先渲染全部新增行，并隔离销售批次查询失败与重复选择', async () => {
    testState.getAvailableBatchNoList.mockRejectedValueOnce(
      new Error('batch lookup failed'),
    );
    testState.selectedProducts = [
      {
        batchNo: 'BATCH-001',
        count: 8,
        productCode: 'P-001',
        productId: 101,
        productName: '跨部门产品一',
        lastSalePrice: 21.5,
        retailPrice: 32,
        salePrice: 12,
        warehouseId: 201,
        warehouseName: '跨部门销售仓',
      },
      {
        batchNoEnabled: false,
        count: 5,
        productCode: 'P-002',
        productId: 102,
        productName: '跨部门产品二',
        retailPrice: 36,
        salePrice: 18,
        warehouseId: 201,
        warehouseName: '跨部门销售仓',
      },
    ];

    const container = mountItemForm(undefined, 3);

    await vi.waitFor(() => expect(testState.loadData).toHaveBeenCalled());
    const selectButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="select-stock-products"]',
    );
    selectButton?.click();

    await vi.waitFor(() => {
      expect(testState.renderedRows).toHaveLength(2);
      expect(testState.renderedRows.map((row) => row.productId)).toEqual([
        101, 102,
      ]);
      expect(testState.renderedRows[0]?.lastSalePrice).toBe(21.5);
      expect(testState.renderedRows[0]?.salePrice).toBe(32);
      expect(testState.renderedRows[0]?.productPrice).toBe(32);
      expect(testState.renderedRows[0]?.batchNo).toBe('BATCH-001');
      expect(testState.renderedRows[0]?.batchNoEnabled).toBe(true);
    });
    expect(testState.getAvailableBatchNoList).toHaveBeenCalledWith({
      bizType: 'sale',
      productId: 101,
      warehouseId: 201,
    });

    selectButton?.click();
    await vi.waitFor(() => expect(testState.warning).toHaveBeenCalledTimes(2));
    expect(testState.renderedRows).toHaveLength(2);
    expect(testState.getAvailableBatchNoList).toHaveBeenCalledTimes(1);
  });

  it('按配件价格体系里的客户价格级别带入报价价格', async () => {
    testState.selectedProducts = [
      {
        count: 5,
        customFields: { orderPriceCustom: 77 },
        productCode: 'P-003',
        productId: 103,
        productName: '订货价产品',
        retailPrice: 32,
        salePrice: 12,
        warehouseId: 201,
        warehouseName: '销售仓库',
      },
    ];

    const container = mountItemForm(102, 11);

    await vi.waitFor(() => expect(testState.loadData).toHaveBeenCalled());
    container
      .querySelector<HTMLButtonElement>('[data-testid="select-stock-products"]')
      ?.click();

    await vi.waitFor(() => {
      expect(testState.renderedRows[0]).toEqual(
        expect.objectContaining({
          productId: 103,
          productPrice: 77,
          salePrice: 77,
        }),
      );
    });
  });

  it('库存选择后直接使用默认数量和自动报价', async () => {
    testState.selectedProducts = [
      {
        availableCount: 5,
        productCode: 'P-004',
        productId: 104,
        productName: '零价报价产品',
        salePrice: 12,
        warehouseId: 201,
        warehouseName: '销售仓库',
      },
    ];
    const container = mountItemForm(102);
    await vi.waitFor(() => expect(testState.loadData).toHaveBeenCalled());
    container
      .querySelector<HTMLButtonElement>('[data-testid="select-stock-products"]')
      ?.click();

    await vi.waitFor(() => {
      expect(testState.renderedRows[0]).toEqual(
        expect.objectContaining({ count: 1, productId: 104, productPrice: 12 }),
      );
    });
  });

  it('编辑表单加载期间不会因为客户价格级别变化刷新报价价格', async () => {
    const container = document.createElement('div');
    const props = reactive({
      compact: true,
      customerPriceLevel: undefined as number | undefined,
      items: [
        {
          count: 2,
          productId: 104,
          productName: 'Loaded quote product',
          productPrice: 46,
          salePrice: 46,
          totalPrice: 92,
          warehouseId: 201,
        },
      ],
      suspendPriceAutoRefresh: true,
    });
    const app = createApp({
      render: () => h(ItemForm, props),
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => {
      expect(testState.renderedRows[0]).toEqual(
        expect.objectContaining({
          productId: 104,
          productPrice: 46,
          salePrice: 46,
          totalPrice: 92,
        }),
      );
    });
    testState.getProduct.mockClear();

    props.customerPriceLevel = 3;
    await nextTick();
    await Promise.resolve();

    expect(testState.getProduct).not.toHaveBeenCalled();
  });
});
