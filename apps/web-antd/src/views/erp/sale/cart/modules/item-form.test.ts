import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp, h, nextTick, reactive, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ItemForm from './item-form.vue';

const currentDir = dirname(fileURLToPath(import.meta.url));
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');

const sortTestState = vi.hoisted(() => ({
  allowedPermissions: null as null | Set<string>,
  columnOptions: null as any,
  currentSort: null as null | { field: string; order: 'asc' | 'desc' },
  getAvailableBatchNoList: vi.fn(async () => []),
  focusFirstEditableInput: vi.fn(() => true),
  getProduct: vi.fn(async (id: number) => ({
    id,
    batchNoEnabled: false,
    code: `P-${id}`,
    name: `Product ${id}`,
  })),
  getWarehouse: vi.fn(async (id: number) => ({
    id,
    deptId: 102,
    deptName: '销售部门',
    name: `仓库${id}`,
  })),
  getStockCount: vi.fn(async () => 10),
  gridOptions: null as any,
  isCreateShortcutKey: vi.fn((_event: KeyboardEvent) => false),
  loadData: vi.fn(async (_rows: any[]) => undefined),
  reloadColumn: vi.fn(async () => {
    sortTestState.currentSort = null;
  }),
  mergeSaleCartItems: vi.fn((items: any[]) => items),
  openProductForm: vi.fn(),
  openPurchaseHistory: vi.fn(),
  openShortcutHistory: vi.fn(),
  openStockModal: vi.fn(),
  renderedRows: [] as any[],
  selectedProducts: [] as any[],
  shortcutDialogOpen: false,
  stockModalOpen: false,
  setGridOptions: vi.fn((options: any) => {
    if (sortTestState.gridOptions) {
      sortTestState.gridOptions.gridOptions = {
        ...sortTestState.gridOptions.gridOptions,
        ...options,
      };
    }
  }),
  setLoading: vi.fn(),
  setSort: vi.fn(async (sort: { field: string; order: 'asc' | 'desc' }) => {
    sortTestState.currentSort = { ...sort };
  }),
  simulateInitialDataMerge: false,
  warning: vi.fn(),
  warehouseListByDept: vi.fn(
    async (_deptId?: number, _params?: Record<string, any>) => [] as any[],
  ),
}));

vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  const ModalStub = defineComponent({
    setup() {
      return () => h('div', { 'data-testid': 'product-form-modal' });
    },
  });
  return {
    useVbenModal: vi.fn(() => [
      ModalStub,
      {
        open: sortTestState.openProductForm,
        setData: vi.fn(() => ({ open: sortTestState.openProductForm })),
      },
    ]),
    VbenLoading: defineComponent({
      props: { spinning: Boolean },
      setup(props) {
        return () =>
          h('div', {
            'data-spinning': String(props.spinning),
            'data-testid': 'sort-loading',
          });
      },
    }),
  };
});

vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: vi.fn(
      (codes: string[]) =>
        sortTestState.allowedPermissions === null ||
        codes.some((code) => sortTestState.allowedPermissions?.has(code)),
    ),
  }),
}));

vi.mock('@vben/utils', () => ({
  erpCountInputFormatter: (value: unknown) => String(value ?? ''),
  erpPriceInputFormatter: (value: unknown) =>
    value === null || value === undefined || value === ''
      ? ''
      : Number(value).toFixed(2),
  erpPriceMultiply: (left: number, right: number) => left * right,
  mergeRouteModules: () => [],
}));

vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const UiStub = defineComponent({
    setup(_props, { slots }) {
      return () => h('span', slots.default?.());
    },
  });
  return {
    Button: UiStub,
    Checkbox: UiStub,
    Input: UiStub,
    message: { info: vi.fn(), warning: sortTestState.warning },
    Modal: { confirm: vi.fn() },
    Select: UiStub,
    Tag: UiStub,
    TreeSelect: UiStub,
  };
});

vi.mock('#/adapter/vxe-table', async () => {
  const { defineComponent, h, nextTick, onMounted, ref } = await import('vue');
  const GridStub = defineComponent({
    setup(_, { slots }) {
      const visibleRows = ref<any[]>([]);
      sortTestState.loadData.mockImplementation(async (rows: any[]) => {
        sortTestState.renderedRows = [...rows];
        visibleRows.value = [...rows];
      });
      onMounted(async () => {
        if (!sortTestState.simulateInitialDataMerge) return;
        await nextTick();
        sortTestState.renderedRows = [
          ...(sortTestState.gridOptions.gridOptions.data ?? []),
        ];
      });
      return () =>
        h('div', { 'data-testid': 'item-grid' }, [
          slots['toolbar-buttons']?.(),
          slots['toolbar-tools']?.(),
          ...visibleRows.value.map((row) =>
            h('div', { 'data-testid': 'location-row' }, [
              h(
                'div',
                { 'data-testid': 'warehouse-cell' },
                slots.warehouseId?.({ row }),
              ),
              h('div', { 'data-testid': 'dept-cell' }, slots.deptId?.({ row })),
              h(
                'div',
                { 'data-testid': 'warehouse-dept-cell' },
                slots.warehouseDeptName?.({ row }),
              ),
            ]),
          ),
        ]);
    },
  });
  return {
    TableAction: defineComponent({
      props: {
        actions: {
          type: Array,
          default: () => [],
        },
      },
      setup(props) {
        return () =>
          h('button', {
            'data-testid': 'table-action',
            onClick: () => (props.actions as any[])?.[0]?.onClick?.(),
          });
      },
    }),
    useVbenVxeGrid: vi.fn((options) => {
      sortTestState.gridOptions = options;
      return [
        GridStub,
        {
          grid: {
            loadData: sortTestState.loadData,
            reloadColumn: sortTestState.reloadColumn,
            setSort: sortTestState.setSort,
            updateData: vi.fn(),
          },
          setGridOptions: sortTestState.setGridOptions,
          setLoading: sortTestState.setLoading,
        },
      ];
    }),
  };
});

vi.mock('#/api/erp/product/product', () => ({
  getProduct: sortTestState.getProduct,
}));

vi.mock('#/api/erp/sale/cart', () => ({
  batchUpdateSaleCartItems: vi.fn(async () => undefined),
  getSaleCartDeptSimplePage: vi.fn(async () => ({ list: [], total: 0 })),
  getSaleCartWarehouseDeptSimplePage: vi.fn(async () => ({
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
  getAvailableBatchNoList: sortTestState.getAvailableBatchNoList,
  getSaleStockPage: vi.fn(async () => ({ list: [], total: 0 })),
  getStockCount: sortTestState.getStockCount,
}));

vi.mock('#/api/erp/stock/warehouse', () => ({
  getWarehouse: sortTestState.getWarehouse,
  getSaleWarehouseSimplePage: vi.fn(async (params?: Record<string, any>) => {
    const { deptId, pageNo, pageSize, ...rest } = params || {};
    void pageNo;
    void pageSize;
    const list = await sortTestState.warehouseListByDept(deptId, rest);
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
        setup(_props, { emit, expose }) {
          expose({
            isOpen: () => sortTestState.stockModalOpen,
            isShortcutDialogOpen: () => sortTestState.shortcutDialogOpen,
            open: sortTestState.openStockModal,
            openShortcutHistory: sortTestState.openShortcutHistory,
          });
          return () =>
            h('button', {
              'data-testid': 'select-stock-products',
              onClick: () => {
                emit('success', sortTestState.selectedProducts);
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
            isShortcutDialogOpen: () => sortTestState.shortcutDialogOpen,
            openPurchaseHistory: sortTestState.openPurchaseHistory,
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
  isBatchNoEnabled: (value: unknown) => value === true,
}));

vi.mock('#/views/erp/utils/keyboard', () => ({
  focusFirstEditableInput: sortTestState.focusFirstEditableInput,
  focusNextInputOnEnter: vi.fn(),
  isEditableEnterTarget: vi.fn(
    (target: EventTarget | null) => target instanceof HTMLInputElement,
  ),
  isCreateShortcutKey: sortTestState.isCreateShortcutKey,
  queueAfterEditableControlRender: vi.fn((callback: () => void) => callback()),
}));

vi.mock('../data', () => ({
  useFormItemColumns: vi.fn(
    (
      _disabled: boolean,
      _hiddenFields: string[],
      _compact: boolean,
      options: any,
    ) => {
      sortTestState.columnOptions = options;
      return [];
    },
  ),
}));

vi.mock('../utils/item-merge', () => ({
  mergeSaleCartItems: sortTestState.mergeSaleCartItems,
}));

describe('sale cart item form sorting', () => {
  let unmount: (() => void) | undefined;

  beforeEach(() => {
    sortTestState.allowedPermissions = null;
    sortTestState.columnOptions = null;
    sortTestState.currentSort = null;
    sortTestState.renderedRows = [];
    sortTestState.simulateInitialDataMerge = false;
    sortTestState.loadData.mockImplementation(async (rows: any[]) => {
      sortTestState.renderedRows = [...rows];
    });
    sortTestState.mergeSaleCartItems.mockImplementation(
      (items: any[]) => items,
    );
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sortTestState.getAvailableBatchNoList.mockClear();
    sortTestState.focusFirstEditableInput.mockReset();
    sortTestState.focusFirstEditableInput.mockReturnValue(true);
    sortTestState.getProduct.mockClear();
    sortTestState.getWarehouse.mockClear();
    sortTestState.getStockCount.mockClear();
    sortTestState.loadData.mockReset();
    sortTestState.reloadColumn.mockClear();
    sortTestState.mergeSaleCartItems.mockReset();
    sortTestState.openProductForm.mockReset();
    sortTestState.openPurchaseHistory.mockReset();
    sortTestState.openShortcutHistory.mockReset();
    sortTestState.openStockModal.mockReset();
    sortTestState.renderedRows = [];
    sortTestState.selectedProducts = [];
    sortTestState.shortcutDialogOpen = false;
    sortTestState.stockModalOpen = false;
    sortTestState.setGridOptions.mockClear();
    sortTestState.setLoading.mockReset();
    sortTestState.setSort.mockClear();
    sortTestState.simulateInitialDataMerge = false;
    sortTestState.warning.mockReset();
    sortTestState.warehouseListByDept.mockReset();
    sortTestState.warehouseListByDept.mockResolvedValue([]);
    sortTestState.gridOptions = null;
    sortTestState.isCreateShortcutKey.mockReset();
    sortTestState.isCreateShortcutKey.mockReturnValue(false);
  });

  it('keeps the last visible business column flexible after column settings change', () => {
    expect(itemFormSource).toContain('trailingFlexibleColumnMinWidth: 150');
    expect(itemFormSource).toContain('fit: true');
    expect(itemFormSource).not.toContain('fit: false');
    expect(itemFormSource).toContain('getCellContentExtraWidth:');
    expect(itemFormSource).toContain(
      "field === 'productId' && isCrossDeptWarehouse(row) ? 60 : 0",
    );
    expect(itemFormSource).toContain(
      'applySaleDocumentItemColumnCustomization',
    );
    expect(itemFormSource).toContain('custom: handleItemColumnCustom');
    expect(itemFormSource).toContain('settleVxeColumnCustomization');
    expect(itemFormSource).toContain("type === 'reset'");
    expect(itemFormSource).toContain('buildCustomizedItemColumns(displayData)');
    expect(itemFormSource).toContain('custom: true');
    expect(itemFormSource).toContain('refresh: true');
    expect(itemFormSource).toContain('zoom: true');
    expect(itemFormSource).toContain('inputmode="decimal"');
    expect(itemFormSource).toContain('icon: ACTION_ICON.DELETE');
  });

  it('counts the cross-department notice in the product-name column width', async () => {
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      deptId: 102,
      items: [],
    });
    app.mount(container);
    unmount = () => app.unmount();
    await nextTick();

    const getExtraWidth = sortTestState.columnOptions?.getCellContentExtraWidth;
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

  it('keeps inventory locations as text and formats selected or reloaded prices to two decimals', async () => {
    const container = document.createElement('div');
    const props = reactive({
      compact: true,
      deptId: 102,
      disabled: false,
      documentId: 55,
      enableBatchEdit: true,
      items: [] as any[],
    });
    const app = createApp({
      render: () =>
        h(ItemForm, {
          ...props,
          'onUpdate:items': (items: any[]) => {
            props.items = items;
          },
        }),
    });
    app.mount(container);
    unmount = () => app.unmount();
    sortTestState.selectedProducts = [
      {
        count: 8,
        deptId: 103,
        deptName: '库存部门',
        productId: 901,
        productName: '库存产品',
        salePrice: 12,
        warehouseId: 701,
        warehouseName: '库存仓库',
      },
    ];
    container
      .querySelector<HTMLButtonElement>('[data-testid="select-stock-products"]')
      ?.click();
    await vi.waitFor(() => {
      expect(
        container.querySelector('[data-testid="warehouse-cell"]')?.textContent,
      ).toBe('库存仓库');
      expect(sortTestState.renderedRows[0]).toMatchObject({
        warehouseId: 701,
        warehouseDeptId: 103,
        deptId: 102,
        productPriceText: '12.00',
      });
    });
    expect(
      container.querySelector('[data-testid="warehouse-dept-cell"]')
        ?.textContent,
    ).toBe('库存部门');
    expect(
      container.querySelector('[data-testid="location-row"] input'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="location-row"] select'),
    ).toBeNull();
    expect(container.textContent).not.toContain('批量修改仓库/部门');
    expect(container.textContent).toContain('批量调整价格');
    expect(container.textContent).toContain('批量删除');

    // Saved drafts, imports and remote pages enter through the same items prop.
    props.items = [
      {
        id: 88,
        productId: 902,
        count: 2,
        warehouseId: 702,
        warehouseName: '恢复仓库',
        warehouseDeptId: 104,
        warehouseDeptName: '恢复库存部门',
        deptId: 102,
        deptName: '销售部门',
        productPrice: 17.5,
        salePrice: 17.5,
      },
    ];
    await vi.waitFor(() => {
      expect(
        container.querySelector('[data-testid="warehouse-cell"]')?.textContent,
      ).toBe('恢复仓库');
      expect(
        container.querySelector('[data-testid="dept-cell"]')?.textContent,
      ).toBe('销售部门');
      expect(sortTestState.renderedRows[0]).toMatchObject({
        productPrice: 17.5,
        productPriceText: '17.50',
      });
    });
    expect(
      container.querySelector('[data-testid="location-row"] input'),
    ).toBeNull();
    props.disabled = true;
    await nextTick();
    expect(container.textContent).toContain('批量调整价格');
    expect(
      sortTestState.gridOptions.gridOptions.columns.some(
        (column: any) => column.type === 'checkbox',
      ),
    ).toBe(true);
    expect(container.textContent).not.toContain('批量修改仓库/部门');
  });

  it('uses inline stock selection and a plain add-row entry', () => {
    const toolbar = itemFormSource.slice(
      itemFormSource.indexOf('<template #toolbar-tools>'),
      itemFormSource.indexOf(
        '<template #productId=',
        itemFormSource.indexOf('<template #toolbar-tools>'),
      ),
    );

    expect(itemFormSource).toContain('ErpInlineStockSelect');
    expect(itemFormSource).toContain('getSaleStockPage');
    expect(itemFormSource).toContain('data-erp-inline-stock-select-input');
    expect(itemFormSource).toContain('function handleAddBlankItemRow()');
    expect(toolbar).toContain('新增行');
    expect(toolbar).toContain('handleBatchDeleteItems');
    expect(toolbar).toContain('批量删除');
    expect(toolbar.indexOf('handleAddBlankItemRow')).toBeLessThan(
      toolbar.indexOf('handleBatchDeleteItems'),
    );
    expect(toolbar.indexOf('handleBatchDeleteItems')).toBeLessThan(
      toolbar.indexOf('handleOpenBatchAdjustPrice'),
    );
    expect(toolbar).not.toContain('添加销售手推车产品');
  });

  it('allows selected blank detail rows to be batch deleted', () => {
    expect(itemFormSource).toContain('const canShowItemSelection = computed(');
    expect(itemFormSource).toContain(
      'const selectedDeleteItemRows = computed(',
    );
    expect(itemFormSource).toContain('function handleBatchDeleteItems()');
    expect(itemFormSource).toContain('function canDeleteItemRow(');
    expect(itemFormSource).toContain('function canSelectItemRow(');
    expect(itemFormSource).toContain(
      'canBatchUpdateItemRow(row) || canDeleteItemRow(row)',
    );
    expect(itemFormSource).toContain(
      'selectedBatchItemRows.value = records.filter(canSelectItemRow)',
    );
  });

  it('adds from Insert in inputs while keeping overlay guards', () => {
    const createShortcutIndex = itemFormSource.indexOf(
      'if (!props.disabled && !event.shiftKey && isCreateShortcutKey(event))',
    );
    const spaceHistoryIndex = itemFormSource.indexOf(
      "if (event.key === ' ' || event.code === 'Space')",
      createShortcutIndex,
    );
    const createShortcutEnd = itemFormSource.indexOf(
      'void handleAddBlankItemRow();',
      createShortcutIndex,
    );
    const createShortcutBlock = itemFormSource.slice(
      createShortcutIndex,
      createShortcutEnd,
    );

    expect(createShortcutIndex).toBeGreaterThan(-1);
    expect(createShortcutEnd).toBeGreaterThan(createShortcutIndex);
    expect(spaceHistoryIndex).toBeGreaterThan(createShortcutEnd);
    expect(itemFormSource).toContain('function isStockSelectOpen()');
    expect(itemFormSource).toContain('function isShortcutOverlayTarget(');
    expect(itemFormSource).toContain('function isVisibleShortcutOverlay(');
    expect(itemFormSource).toContain('window.getComputedStyle(overlay)');
    expect(itemFormSource).toContain(
      'document.querySelectorAll(SHORTCUT_OVERLAY_SELECTOR)',
    );
    expect(itemFormSource).not.toContain(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-picker-dropdown:not(.ant-picker-dropdown-hidden), .ant-popover:not(.ant-popover-hidden)',
    );
    expect(createShortcutBlock).toContain('isStockSelectOpen()');
    expect(createShortcutBlock).toContain('isShortcutDialogOpen()');
    expect(createShortcutBlock).toContain('inlineStockSelectorOpen.value');
    expect(createShortcutBlock).not.toContain(
      'isEditableEnterTarget(event.target)',
    );
    expect(createShortcutBlock).toContain(
      'isShortcutOverlayTarget(event.target)',
    );
    expect(itemFormSource).toContain('<kbd>Insert</kbd><b>新增行</b>');
    expect(itemFormSource).not.toContain('<kbd>0</kbd><b>新增行</b>');
  });

  it('keeps the current detail row visible when Enter commits an inline edit', () => {
    const start = itemFormSource.indexOf('function handleRowChange(row: any)');
    const end = itemFormSource.indexOf(
      'function handleGiftFlagChange(row: any)',
      start,
    );
    const handlerSource = itemFormSource.slice(start, end);
    const existingRowBranch = handlerSource.slice(
      handlerSource.indexOf('} else {'),
    );

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(handlerSource).toContain(
      'if (activeItemSort.value) {\n    void nextTick(refreshItemGrid);\n  }',
    );
    expect(existingRowBranch).not.toContain(
      'emitItemsUpdate(true);\n    void nextTick(refreshItemGrid);',
    );
    expect(itemFormSource).toContain(
      '@press-enter="handleItemInputPressEnter"',
    );
  });

  it('enables Insert inside inputs while keeping detail and overlay guards', async () => {
    const container = document.createElement('div');
    const props = reactive({
      compact: true,
      disabled: true,
      items: [] as any[],
    });
    const app = createApp({
      render: () =>
        h(ItemForm, {
          ...props,
          'onUpdate:items': (items: any[]) => {
            props.items = items;
          },
        }),
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };
    sortTestState.isCreateShortcutKey.mockImplementation(
      (event: KeyboardEvent) => event.key === 'Insert',
    );

    const pressInsert = (
      target: EventTarget = window,
      init: KeyboardEventInit & { isComposing?: boolean } = {},
    ) => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Insert',
        key: 'Insert',
        ...init,
      });
      if (init.isComposing !== undefined) {
        Object.defineProperty(event, 'isComposing', {
          value: init.isComposing,
        });
      }
      target.dispatchEvent(event);
      return event;
    };

    pressInsert();
    await nextTick();
    expect(props.items).toHaveLength(0);

    props.disabled = false;
    await nextTick();
    pressInsert();
    await vi.waitFor(() => expect(props.items).toHaveLength(1));
    await vi.waitFor(() =>
      expect(sortTestState.focusFirstEditableInput).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('data-erp-inline-stock-select-input'),
      ),
    );

    const input = document.createElement('input');
    container.append(input);
    pressInsert(input);
    await vi.waitFor(() => expect(props.items).toHaveLength(2));

    pressInsert(window, { repeat: true });
    pressInsert(window, { isComposing: true });
    pressInsert(window, { ctrlKey: true });
    pressInsert(window, { altKey: true });
    pressInsert(window, { metaKey: true });
    pressInsert(window, { shiftKey: true });
    await nextTick();
    expect(props.items).toHaveLength(2);

    sortTestState.stockModalOpen = true;
    pressInsert();
    sortTestState.stockModalOpen = false;
    sortTestState.shortcutDialogOpen = true;
    pressInsert();
    sortTestState.shortcutDialogOpen = false;
    await nextTick();
    expect(props.items).toHaveLength(2);

    const overlay = document.createElement('div');
    overlay.className = 'ant-select-dropdown';
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      bottom: 32,
      height: 32,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    document.body.append(overlay);
    pressInsert();
    await nextTick();
    expect(props.items).toHaveLength(2);
    overlay.remove();

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Digit0',
        key: '0',
      }),
    );
    await nextTick();
    expect(props.items).toHaveLength(2);

    props.disabled = true;
    await nextTick();
    pressInsert();
    await nextTick();
    expect(props.items).toHaveLength(2);

    props.disabled = false;
    await nextTick();
    props.disabled = true;
    await nextTick();
    props.disabled = false;
    await nextTick();
    pressInsert();
    await vi.waitFor(() => expect(props.items).toHaveLength(3));

    unmount();
    unmount = undefined;
    pressInsert();
    await nextTick();
    expect(props.items).toHaveLength(3);
  });

  it('keeps W active in detail mode only while this form owns the shortcut layer', async () => {
    const container = document.createElement('div');
    const props = reactive({
      compact: true,
      disabled: true,
      items: [] as any[],
      shortcutActive: false,
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

    const pressW = () =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'KeyW',
          key: 'w',
        }),
      );

    pressW();
    await nextTick();
    expect(container.querySelector('.erp-price-reference-overlay')).toBeNull();

    props.shortcutActive = true;
    await nextTick();
    pressW();
    await nextTick();
    expect(
      container.querySelector('.erp-price-reference-overlay'),
    ).not.toBeNull();

    const childDialog = document.createElement('div');
    childDialog.className = 'ant-modal-wrap';
    childDialog.style.zIndex = '1100';
    childDialog.setAttribute('role', 'dialog');
    document.body.append(childDialog);
    pressW();
    await nextTick();
    expect(
      container.querySelector('.erp-price-reference-overlay'),
    ).not.toBeNull();

    childDialog.remove();
    pressW();
    await nextTick();
    expect(container.querySelector('.erp-price-reference-overlay')).toBeNull();
  });

  it('keeps history and product shortcuts in detail mode while blocking row creation', async () => {
    const container = document.createElement('div');
    const props = reactive({
      compact: true,
      disabled: true,
      items: [
        {
          count: 1,
          productCode: 'P-DETAIL-101',
          productId: 101,
          productName: 'Detail shortcut product',
          productPrice: 12,
          warehouseId: 201,
        },
      ] as any[],
      shortcutActive: true,
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
    sortTestState.isCreateShortcutKey.mockImplementation(
      (event: KeyboardEvent) => event.key === 'Insert',
    );

    await vi.waitFor(() => expect(sortTestState.renderedRows).toHaveLength(1));
    sortTestState.gridOptions.gridEvents.cellClick({
      row: sortTestState.renderedRows[0],
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Space',
        key: ' ',
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'ShiftLeft',
        key: 'Shift',
        shiftKey: true,
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keyup', {
        bubbles: true,
        cancelable: true,
        code: 'ShiftLeft',
        key: 'Shift',
      }),
    );

    await vi.waitFor(() =>
      expect(sortTestState.openShortcutHistory).toHaveBeenNthCalledWith(
        1,
        'history',
        expect.objectContaining({ productId: 101 }),
      ),
    );
    await vi.waitFor(() =>
      expect(sortTestState.openShortcutHistory).toHaveBeenNthCalledWith(
        2,
        'order',
        expect.objectContaining({ productId: 101 }),
      ),
    );

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'KeyF',
        key: 'f',
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Insert',
        key: 'Insert',
      }),
    );
    await nextTick();

    expect(sortTestState.openProductForm).toHaveBeenCalledTimes(1);
    expect(props.items).toHaveLength(1);
  });

  it('dispatches sale, purchase and product shortcuts from the active item row', async () => {
    const container = document.createElement('div');
    const props = reactive({
      compact: true,
      disabled: false,
      items: [
        {
          count: 1,
          productCode: 'P-101',
          productId: 101,
          productName: 'Shortcut product',
          productPrice: 12,
          warehouseId: 201,
        },
      ] as any[],
      shortcutActive: true,
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

    await vi.waitFor(() => expect(sortTestState.renderedRows).toHaveLength(1));
    const row = sortTestState.renderedRows[0];
    sortTestState.gridOptions.gridEvents.cellClick({ row });

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Space',
        key: ' ',
      }),
    );
    await vi.waitFor(() =>
      expect(sortTestState.openShortcutHistory).toHaveBeenNthCalledWith(
        1,
        'history',
        expect.objectContaining({ productId: 101 }),
      ),
    );

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'ShiftLeft',
        key: 'Shift',
        shiftKey: true,
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keyup', {
        bubbles: true,
        cancelable: true,
        code: 'ShiftLeft',
        key: 'Shift',
      }),
    );
    await vi.waitFor(() =>
      expect(sortTestState.openShortcutHistory).toHaveBeenNthCalledWith(
        2,
        'order',
        expect.objectContaining({ productId: 101 }),
      ),
    );

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'ShiftLeft',
        key: 'Shift',
        shiftKey: true,
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Tab',
        key: 'Tab',
        shiftKey: true,
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keyup', {
        bubbles: true,
        cancelable: true,
        code: 'ShiftLeft',
        key: 'Shift',
      }),
    );
    expect(sortTestState.openShortcutHistory).toHaveBeenCalledTimes(2);

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
    expect(sortTestState.openPurchaseHistory).toHaveBeenNthCalledWith(
      1,
      'order',
    );
    expect(sortTestState.openPurchaseHistory).toHaveBeenNthCalledWith(2, 'in');

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'KeyF',
        key: 'f',
      }),
    );
    expect(sortTestState.openProductForm).toHaveBeenCalledTimes(1);
  });

  it('gates purchase and product shortcuts with their independent permissions', async () => {
    sortTestState.allowedPermissions = new Set(['erp:purchase-order:query']);
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      disabled: true,
      items: [
        {
          count: 1,
          productCode: 'P-PERMISSION-101',
          productId: 101,
          productName: 'Cart permission product',
          productPrice: 12,
          warehouseId: 201,
        },
      ],
      shortcutActive: true,
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => expect(sortTestState.renderedRows).toHaveLength(1));
    sortTestState.gridOptions.gridEvents.cellClick({
      row: sortTestState.renderedRows[0],
    });
    expect(container.textContent).toContain('采购订单历史');
    expect(container.textContent).not.toContain('采购入库记录');
    expect(container.textContent).not.toContain('修改商品');

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

    expect(sortTestState.openPurchaseHistory).toHaveBeenCalledTimes(1);
    expect(sortTestState.openPurchaseHistory).toHaveBeenCalledWith('order');
    expect(sortTestState.openProductForm).not.toHaveBeenCalled();
  });

  it('renders newly selected product rows when batch metadata lookup fails', async () => {
    sortTestState.getAvailableBatchNoList.mockRejectedValueOnce(
      new Error('batch lookup failed'),
    );
    sortTestState.selectedProducts = [
      {
        batchNo: 'BATCH-001',
        count: 8,
        productCode: 'P-001',
        productId: 101,
        productName: 'Selected product one',
        salePrice: 12,
        warehouseId: 201,
        warehouseName: 'Sale warehouse',
      },
      {
        batchNoEnabled: false,
        count: 5,
        productCode: 'P-002',
        productId: 102,
        productName: 'Selected product two',
        salePrice: 18,
        warehouseId: 201,
        warehouseName: 'Sale warehouse',
      },
    ];

    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      items: [],
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => expect(sortTestState.loadData).toHaveBeenCalled());
    sortTestState.loadData.mockClear();

    const selectProductsButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="select-stock-products"]',
    );
    expect(selectProductsButton).not.toBeNull();
    selectProductsButton?.click();

    await vi.waitFor(() => {
      expect(sortTestState.renderedRows).toHaveLength(2);
      expect(sortTestState.renderedRows).toEqual([
        expect.objectContaining({
          batchNo: 'BATCH-001',
          batchNoEnabled: true,
          productId: 101,
          productName: 'Selected product one',
        }),
        expect.objectContaining({
          productId: 102,
          productName: 'Selected product two',
        }),
      ]);
    });
    expect(sortTestState.gridOptions.gridOptions.data).toEqual([
      expect.objectContaining({
        productId: 101,
        productName: 'Selected product one',
      }),
      expect.objectContaining({
        productId: 102,
        productName: 'Selected product two',
      }),
    ]);
    expect(sortTestState.getAvailableBatchNoList).toHaveBeenCalledWith({
      bizType: 'sale',
      productId: 101,
      warehouseId: 201,
    });
  });

  it('shows shortcut hints and maps selected stock prices by customer level', async () => {
    sortTestState.selectedProducts = [
      {
        count: 5,
        lastSalePrice: 21.5,
        productCode: 'P-003',
        productId: 103,
        productName: 'Retail level product',
        retailPrice: 32,
        salePrice: 12,
        warehouseId: 201,
        warehouseName: 'Sale warehouse',
      },
    ];

    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      customerPriceLevel: 3,
      deptId: 102,
      items: [],
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    expect(container.textContent).toContain('Space');
    expect(container.textContent).toContain('Shift');
    expect(container.textContent).toContain('销售历史');
    expect(container.textContent).toContain('报价订单历史');
    expect(container.textContent).toContain('修改商品');

    container
      .querySelector<HTMLButtonElement>('[data-testid="select-stock-products"]')
      ?.click();

    await vi.waitFor(() => {
      expect(sortTestState.renderedRows[0]).toEqual(
        expect.objectContaining({
          lastSalePrice: 21.5,
          productId: 103,
          productPrice: 32,
          salePrice: 32,
        }),
      );
    });
  });

  it('maps selected stock prices by product price-system levels', async () => {
    sortTestState.selectedProducts = [
      {
        count: 5,
        customFields: { orderPriceCustom: 66 },
        productCode: 'P-004',
        productId: 104,
        productName: 'Order price product',
        salePrice: 12,
        sharePrice: 45,
        warehouseId: 201,
        warehouseName: 'Sale warehouse',
      },
    ];

    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      customerPriceLevel: 11,
      deptId: 102,
      items: [],
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => expect(sortTestState.loadData).toHaveBeenCalled());
    container
      .querySelector<HTMLButtonElement>('[data-testid="select-stock-products"]')
      ?.click();

    await vi.waitFor(() => {
      expect(sortTestState.renderedRows[0]).toEqual(
        expect.objectContaining({
          productId: 104,
          productPrice: 66,
          salePrice: 66,
        }),
      );
    });
  });

  it('adds selected stock directly with quantity one and the automatic price', async () => {
    sortTestState.selectedProducts = [
      {
        availableCount: 10,
        batchNo: 'B-01',
        count: 10,
        productCode: 'P-005',
        productId: 105,
        productName: 'Direct product',
        salePrice: 18,
        warehouseId: 201,
        warehouseName: 'Sale warehouse',
      },
    ];

    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      deptId: 102,
      items: [],
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    container
      .querySelector<HTMLButtonElement>('[data-testid="select-stock-products"]')
      ?.click();

    await vi.waitFor(() => {
      expect(sortTestState.renderedRows).toHaveLength(1);
      expect(sortTestState.renderedRows[0]).toEqual(
        expect.objectContaining({
          count: 1,
          productId: 105,
          productPrice: 18,
          salePrice: 18,
        }),
      );
    });
    expect(itemFormSource).toContain(
      "await itemRowFocusController.focus(focusRow, 'count');",
    );
    expect(itemFormSource).not.toContain('StockSelectionReviewModal');
    expect(itemFormSource).not.toContain(':before-confirm=');
  });

  it('adds one to an existing matching stock row without review', async () => {
    sortTestState.selectedProducts = [
      {
        availableCount: 10,
        batchNo: 'B-02',
        count: 10,
        productCode: 'P-107',
        productId: 107,
        productName: 'Existing direct product',
        salePrice: 18,
        warehouseId: 201,
        warehouseName: 'Sale warehouse',
      },
    ];
    sortTestState.mergeSaleCartItems.mockImplementationOnce((items: any[]) => {
      const [existingItem, selectedItem] = items;
      const mergedItem = {
        ...existingItem,
        count: Number(existingItem.count) + Number(selectedItem.count),
      };
      mergedItem.totalPrice = mergedItem.count * mergedItem.productPrice;
      return [mergedItem];
    });

    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      deptId: 102,
      items: [
        {
          batchNo: 'B-02',
          batchNoEnabled: true,
          count: 2,
          productId: 107,
          productName: 'Existing direct product',
          productPrice: 18,
          salePrice: 18,
          totalPrice: 36,
          warehouseId: 201,
          warehouseName: 'Sale warehouse',
        },
      ],
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => expect(sortTestState.renderedRows).toHaveLength(1));
    container
      .querySelector<HTMLButtonElement>('[data-testid="select-stock-products"]')
      ?.click();

    await vi.waitFor(() => {
      expect(sortTestState.renderedRows).toEqual([
        expect.objectContaining({
          count: 3,
          productId: 107,
          productPrice: 18,
          totalPrice: 54,
        }),
      ]);
    });
  });

  it('does not insert stock when the selection is empty', async () => {
    sortTestState.selectedProducts = [];
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      deptId: 102,
      items: [],
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    container
      .querySelector<HTMLButtonElement>('[data-testid="select-stock-products"]')
      ?.click();
    await nextTick();
    await Promise.resolve();

    expect(sortTestState.renderedRows).toHaveLength(0);
  });

  it('does not overwrite loaded draft prices while the edit form is hydrating', async () => {
    const container = document.createElement('div');
    const props = reactive({
      compact: true,
      customerPriceLevel: undefined as number | undefined,
      items: [
        {
          count: 2,
          productId: 104,
          productName: 'Loaded cart product',
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
      expect(sortTestState.renderedRows[0]).toEqual(
        expect.objectContaining({
          productId: 104,
          productPrice: 46,
          salePrice: 46,
          totalPrice: 92,
        }),
      );
    });
    sortTestState.getProduct.mockClear();

    props.customerPriceLevel = 3;
    await nextTick();
    await Promise.resolve();

    expect(sortTestState.getProduct).not.toHaveBeenCalled();
  });

  it('listens for detail shortcuts during capture phase', () => {
    expect(itemFormSource).toContain('<kbd>Shift</kbd><b>报价订单历史</b>');
    expect(itemFormSource).toContain('pendingQuoteOrderHistoryShift');
    expect(itemFormSource).toContain('function isQuoteOrderHistoryShiftKey');
    expect(itemFormSource).toContain(
      'function handleShortcutKeyup(event: KeyboardEvent)',
    );
    expect(itemFormSource).not.toContain(
      "if (event.key === 'Enter') {\n    event.preventDefault();\n    void openSaleShortcutHistory('order');",
    );
    expect(itemFormSource).toContain(
      "window.addEventListener('keydown', handleShortcut, true)",
    );
    expect(itemFormSource).toContain(
      "window.addEventListener('keyup', handleShortcutKeyup, true)",
    );
    expect(itemFormSource).toContain(
      "window.removeEventListener('keydown', handleShortcut, true)",
    );
    expect(itemFormSource).toContain(
      "window.removeEventListener('keyup', handleShortcutKeyup, true)",
    );
  });

  it('keeps all detail rows while showing the local sorting mask', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      disabled: true,
      items: [
        { count: 12, id: 1, productId: 1, productName: '产品一' },
        { count: 3, id: 2, productId: 2, productName: '产品二' },
        { count: 8, id: 3, productId: 3, productName: '产品三' },
      ],
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => expect(sortTestState.loadData).toHaveBeenCalled());
    sortTestState.loadData.mockClear();

    const sortPromise = sortTestState.gridOptions.gridEvents.sortChange({
      field: 'count',
      order: 'asc',
    });
    await nextTick();
    const sortLoading = container.querySelector(
      '[data-testid="sort-loading"]',
    ) as HTMLElement | null;
    expect(sortLoading?.dataset.spinning).toBe('true');

    await Promise.resolve();
    await nextTick();
    await vi.runAllTimersAsync();
    await sortPromise;
    await nextTick();

    let displayedRows = sortTestState.loadData.mock.calls.at(-1)?.[0] ?? [];
    expect(displayedRows.map((row: any) => row.id)).toEqual([2, 3, 1]);
    expect(displayedRows).toHaveLength(3);
    expect(sortTestState.setLoading).not.toHaveBeenCalled();
    expect(sortLoading?.dataset.spinning).toBe('false');
    expect(sortTestState.currentSort).toEqual({ field: 'count', order: 'asc' });

    // 模拟用户再次点击同一列表头：刷新后的内部状态必须仍为 asc，
    // VXE 才会按配置的 asc -> desc -> null 顺序进入降序。
    const nextOrder =
      sortTestState.currentSort?.field === 'count' &&
      sortTestState.currentSort.order === 'asc'
        ? 'desc'
        : 'asc';
    expect(nextOrder).toBe('desc');
    const descendingPromise = sortTestState.gridOptions.gridEvents.sortChange({
      field: 'count',
      order: nextOrder,
    });
    await Promise.resolve();
    await nextTick();
    await vi.runAllTimersAsync();
    await descendingPromise;
    displayedRows = sortTestState.loadData.mock.calls.at(-1)?.[0] ?? [];
    expect(displayedRows.map((row: any) => row.id)).toEqual([1, 3, 2]);
    expect(displayedRows).toHaveLength(3);
    expect(sortTestState.currentSort).toEqual({
      field: 'count',
      order: 'desc',
    });

    const clearPromise = sortTestState.gridOptions.gridEvents.sortChange({
      field: 'count',
      order: null,
    });
    await Promise.resolve();
    await nextTick();
    await vi.runAllTimersAsync();
    await clearPromise;
    displayedRows = sortTestState.loadData.mock.calls.at(-1)?.[0] ?? [];
    expect(displayedRows.map((row: any) => row.id)).toEqual([1, 2, 3]);
    expect(displayedRows).toHaveLength(3);
  });

  it('renders read-only detail rows without waiting for editable-field lookups', async () => {
    const container = document.createElement('div');
    const detailRows = [
      {
        count: 2,
        id: 11,
        productId: 101,
        productName: '详情产品一',
        warehouseId: 201,
        warehouseName: '成品仓库',
      },
      {
        count: 1,
        id: 12,
        productId: 102,
        productName: '详情产品二',
        warehouseId: 202,
        warehouseName: '配件仓库',
      },
    ];
    const app = createApp(ItemForm, {
      compact: true,
      disabled: true,
      items: detailRows,
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => {
      expect(sortTestState.loadData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 11, productName: '详情产品一' }),
          expect.objectContaining({ id: 12, productName: '详情产品二' }),
        ]),
      );
    });

    expect(container.querySelector('[data-testid="item-grid"]')).not.toBeNull();
    const displayedRows = sortTestState.loadData.mock.calls.at(-1)?.[0];
    expect(displayedRows).toHaveLength(2);
    expect(sortTestState.getStockCount).not.toHaveBeenCalled();
    expect(sortTestState.getAvailableBatchNoList).not.toHaveBeenCalled();
  });

  it('shows batch numbers when opening the sale cart stock selector', () => {
    expect(itemFormSource).toContain('show-batch-no');
    expect(itemFormSource).toContain('mergeCurrentBatchNoOption');
    expect(itemFormSource).toContain('availableCount: row.stockCount');
    expect(itemFormSource).toContain(
      'const batchNo = normalizeBatchNoValue(p.batchNo) || undefined',
    );
    expect(itemFormSource).toContain(
      'const batchNoEnabled = isBatchNoEnabled(p.batchNoEnabled) || !!batchNo',
    );
    expect(itemFormSource).toContain(
      'normalizeBatchNoValue(item.value) === currentBatchNo',
    );
  });

  it('hydrates readonly warehouse labels even outside the first department page', () => {
    expect(itemFormSource).toContain('function findWarehouseOption');
    expect(itemFormSource).toContain('getReadonlyWarehouseName(row)');
    expect(itemFormSource).not.toContain('v-model:value="row.warehouseId"');
    expect(itemFormSource).not.toContain('v-model:value="row.deptId"');
    expect(itemFormSource).toContain(
      'await hydrateMissingCurrentSelectLabels(tableData.value);',
    );
  });

  it('restores detail rows after the grid merges its initial options', async () => {
    sortTestState.simulateInitialDataMerge = true;
    const detailRows = [
      {
        count: 1,
        id: 21,
        productId: 201,
        productName: '挂载时序产品',
      },
    ];
    const container = document.createElement('div');
    const app = createApp(ItemForm, {
      compact: true,
      disabled: true,
      items: detailRows,
    });
    app.mount(container);
    document.body.append(container);
    unmount = () => {
      app.unmount();
      container.remove();
    };

    await vi.waitFor(() => {
      expect(sortTestState.renderedRows).toEqual([
        expect.objectContaining({ id: 21, productName: '挂载时序产品' }),
      ]);
    });
    expect(sortTestState.gridOptions.gridOptions.data).toEqual([
      expect.objectContaining({ id: 21, productName: '挂载时序产品' }),
    ]);
  });
});
