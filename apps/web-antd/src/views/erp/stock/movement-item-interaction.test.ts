import { createApp, h, nextTick, reactive, ref } from 'vue';

import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TransferItems from './transfer-out/modules/item-form.vue';
import WarehouseItems from './warehouse-move/modules/item-form.vue';
async function flushPromises() {
  for (let index = 0; index < 8; index++) {
    await Promise.resolve();
    await nextTick();
  }
}
function mount(component: any, options: any) {
  const props = reactive({ ...options.props });
  const instance = ref<any>();
  const updates: any[][] = [];
  const element = document.createElement('div');
  document.body.append(element);
  const app = createApp({
    setup: () => () =>
      h(component, {
        ...props,
        ref: instance,
        'onUpdate:items': (items: any[]) => updates.push([items]),
      }),
  });
  app.use(createPinia());
  app.mount(element);
  let mounted = true;
  function input(node: Element | null) {
    return {
      element: node!,
      exists: () => Boolean(node),
      async setValue(value: string) {
        (node as HTMLInputElement).value = value;
        node!.dispatchEvent(new Event('input', { bubbles: true }));
        await flushPromises();
      },
    };
  }
  return {
    get vm() {
      return instance.value;
    },
    find: (selector: string) => input(element.querySelector(selector)),
    findAll: (selector: string) =>
      [...element.querySelectorAll(selector)].map(input),
    emitted: (_event: string) => updates,
    async setProps(values: any) {
      Object.assign(props, values);
      await flushPromises();
    },
    unmount() {
      if (mounted) {
        app.unmount();
        element.remove();
        mounted = false;
      }
    },
  };
}

const state = vi.hoisted(() => ({
  events: {} as Record<string, any>,
  reload: vi.fn(async () => {}),
  history: vi.fn(),
  productEdit: vi.fn(),
  productDept: undefined as number | undefined,
  blocked: false,
  allowed: true,
  overlayRows: [] as number[],
  productUpdated: undefined as ((row: any) => void) | undefined,
  priceBlocked: undefined as (() => boolean) | undefined,
  priceOpen: undefined as any,
}));

vi.mock('#/adapter/vxe-table', async () => {
  const { defineComponent, h, shallowRef } = await import('vue');
  return {
    ACTION_ICON: { DELETE: 'delete' },
    TableAction: defineComponent({ setup: () => () => null }),
    useVbenVxeGrid: (options: any) => {
      state.events = options.gridEvents;
      const rows = shallowRef<any[]>([]);
      const Grid = defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('div', [
              slots['toolbar-buttons']?.(),
              ...rows.value.map((row) =>
                h(
                  'div',
                  { 'data-row': row.id, key: row.clientRowKey },
                  [
                    'actualCount',
                    'count',
                    'productPrice',
                    'totalPrice',
                    'remark',
                  ].map((field) => slots[field]?.({ row })),
                ),
              ),
            ]),
      });
      const grid = {
        reloadColumn: state.reload,
        loadData: vi.fn(async (data: any[]) => {
          rows.value = data;
        }),
        clearCheckboxRow: vi.fn(),
        clearCheckboxReserve: vi.fn(),
        setSort: vi.fn(),
        clearSort: vi.fn(),
        getFullColumns: () => [],
      };
      return [
        Grid,
        {
          grid,
          setGridOptions: (config: any) => {
            if (config.data) rows.value = config.data;
          },
          setLoading: vi.fn(),
        },
      ];
    },
  };
});
vi.mock('#/views/erp/stock/utils/document-columns', () => ({
  useStockDocumentColumns: () => ({
    reload: state.reload,
    queue: vi.fn(),
    custom: vi.fn(),
    restoreStore: ({ storeData }: any) => storeData,
  }),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => state.allowed }),
}));
vi.mock('@vben/common-ui', async () => {
  const { defineComponent } = await import('vue');
  return {
    useVbenModal: () => [
      defineComponent({ setup: () => () => null }),
      {
        setData() {
          return this;
        },
        open: vi.fn(),
      },
    ],
  };
});
vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const Input = defineComponent({
    inheritAttrs: false,
    props: ['value'],
    setup:
      (props, { attrs, emit }) =>
      () =>
        h('input', {
          ...attrs,
          value: props.value,
          onInput: (event: Event) =>
            emit('update:value', (event.target as HTMLInputElement).value),
        }),
  });
  const Empty = defineComponent({ setup: () => () => null });
  return {
    Input,
    Button: Empty,
    Pagination: Empty,
    Select: Empty,
    Modal: { confirm: vi.fn() },
    message: { warning: vi.fn(), success: vi.fn() },
  };
});
vi.mock('#/composables/useFieldPermission', () => ({
  isFieldHidden: () => false,
}));
vi.mock('#/api/erp/stock/stock', () => ({
  getAvailableBatchNoList: vi.fn(async () => []),
  getStockCount: vi.fn(async () => 100),
  getWarehouseStockCount: vi.fn(async () => 100),
  getStockPage: vi.fn(),
}));
vi.mock('#/api/erp/stock/warehouse', () => ({
  getWarehouse: vi.fn(async (id: number) => ({ id, name: '仓库' })),
  getWarehouseSimplePage: vi.fn(async () => ({ list: [], total: 0 })),
  getStockMoveFromWarehouseSimplePage: vi.fn(async () => ({
    list: [],
    total: 0,
  })),
}));
vi.mock('#/api/erp/product/product', () => ({
  getProduct: vi.fn(async () => ({
    purchasePrice: 5,
    deptId: state.productDept,
  })),
}));
vi.mock('#/views/erp/components/ErpLazyPageSelect.vue', () => ({
  default: { render: () => null },
}));
vi.mock('#/views/erp/components/ErpInlineStockSelect.vue', () => ({
  default: { render: () => null },
}));
vi.mock('#/views/erp/components/ItemPriceReferenceOverlay.vue', async () => {
  const { defineComponent } = await import('vue');
  return {
    default: defineComponent({
      props: ['rows'],
      setup: (props) => () => {
        state.overlayRows = (props.rows ?? []).map((row: any) => row.id);
        return null;
      },
    }),
  };
});
vi.mock(
  '#/views/erp/stock/transfer-out/modules/batch-update-items-form.vue',
  () => ({ default: { render: () => null } }),
);
vi.mock('#/views/erp/purchase/utils/shortcut-scope', () => ({
  isPurchaseShortcutOwnerActive: () => !state.blocked,
  focusPurchaseShortcutOwner: vi.fn(),
}));
vi.mock('#/views/erp/utils/price-reference', async () => {
  const { ref } = await import('vue');
  return {
    copyPriceReferenceFields: vi.fn((row, product) => {
      row.productPurchasePrice = product.purchasePrice;
    }),
    useItemPriceReferenceShortcut: (options: any) => {
      state.priceBlocked = options.isBlocked;
      state.priceOpen = ref(false);
      return {
        itemTableWrapRef: ref(null),
        priceReferenceOpen: state.priceOpen,
      };
    },
  };
});
vi.mock(
  '#/views/erp/purchase/components/PurchaseItemDetailShortcuts.vue',
  async () => {
    const { defineComponent } = await import('vue');
    return {
      default: defineComponent({
        props: ['isStockSelectorOpen'],
        setup: (props, { expose, emit }) => {
          state.productUpdated = (row) => emit('productUpdated', row);
          expose({
            handleShortcut: state.history,
            openProductEdit: state.productEdit,
            handleShortcutKeyup: vi.fn(),
            isShortcutDialogOpen: () => props.isStockSelectorOpen?.() === true,
            resetPendingShortcutState: vi.fn(),
          });
          return () => null;
        },
      }),
    };
  },
);

describe.each([
  ['warehouse', WarehouseItems, 'data-warehouse-move-count-input'],
  ['transfer', TransferItems, 'data-stock-transfer-out-count-input'],
])('%s actual inputs', (_name, Component, attribute) => {
  let wrapper: ReturnType<typeof mount>;
  beforeEach(() => {
    vi.clearAllMocks();
    state.blocked = false;
    state.allowed = true;
    state.productDept = undefined;
  });
  afterEach(() => wrapper?.unmount());
  async function open(extra = {}) {
    wrapper = mount(Component, {
      props: {
        fromWarehouseId: 1,
        toWarehouseId: 2,
        items: [1, 2].map((id) => ({
          id,
          productId: id,
          fromWarehouseId: 1,
          toWarehouseId: 2,
          fromWarehouseName: 'A',
          toWarehouseName: 'B',
          fromStockCount: 100,
          stockCount: 100,
          count: 1,
          productPrice: 2,
          costPrice: 2,
        })),
        ...extra,
      },
    });
    await flushPromises();
    return wrapper;
  }
  it('keeps second-row input and overlay order while typing and committing multiple decimal digits under sorting', async () => {
    await open();
    await state.events.sortChange({ field: 'count', order: 'asc' });
    await flushPromises();
    const selector = `[data-row="2"] input[${attribute}]`;
    const input = wrapper.find(selector);
    const node = input.element;
    const reloads = state.reload.mock.calls.length;
    await input.setValue('12.1234567');
    expect(wrapper.find(selector).element).toBe(node);
    const rows = wrapper.vm.getItems();
    input.element.dispatchEvent(new Event('blur'));
    await flushPromises();
    const updated = wrapper.emitted('update:items').at(-1)?.[0];
    if (updated) await wrapper.setProps({ items: updated });
    expect(wrapper.find(selector).element).toBe(node);
    expect(rows[1].count).toBe('12.1234567');
    expect(state.reload.mock.calls.length).toBe(reloads);
    expect(state.overlayRows).toEqual([1, 2]);
  });
  it('rejects unfinished and scientific notation values instead of saving old numbers', async () => {
    await open();
    const input = wrapper.find(`[data-row="2"] input[${attribute}]`);
    await input.setValue('');
    expect(() => wrapper.vm.getItems()).toThrow();
    await input.setValue('1e2');
    expect(() => wrapper.vm.getItems()).toThrow();
    await input.setValue('1.2500');
    expect(wrapper.vm.getItems()[1].count).toBe('1.25');
  });
  it('checks actual product department instead of treating the source warehouse department as product ownership', async () => {
    state.productDept = 2;
    await open({ deptId: 2 });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    await flushPromises();
    expect(state.productEdit).toHaveBeenCalledTimes(1);
    state.productDept = 3;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    await flushPromises();
    expect(state.productEdit).toHaveBeenCalledTimes(1);
  });
  it('product edits preserve quantity, business price, cost, warehouse, batch and package values', async () => {
    await open();
    const row = wrapper.vm.getItems()[0];
    state.productUpdated?.({
      ...row,
      productName: '新名称',
      count: 999,
      productPrice: 999,
      costPrice: 999,
      packageQty: 999,
      batchNo: 'CHANGED',
    });
    await flushPromises();
    const after = wrapper.vm.getItems()[0];
    expect(after.productName).toBe('新名称');
    expect(String(after.count)).toBe('1');
    expect(after.productPrice).toBe(2);
    expect(after.costPrice).toBe(2);
    expect(after.batchNo).not.toBe('CHANGED');
    expect(after.packageQty).not.toBe(999);
    expect(after.fromWarehouseId).toBe(1);
    expect(after.toWarehouseId).toBe(2);
    expect(after.productPurchasePrice).toBe(5);
  });
  it('keeps W close available while suppressing other history keys under the price overlay', async () => {
    await open();
    state.priceOpen.value = true;
    await flushPromises();
    expect(state.priceBlocked?.()).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(state.history).not.toHaveBeenCalled();
    state.priceOpen.value = false;
    await flushPromises();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(state.history).toHaveBeenCalledTimes(1);
  });
  it('blocks history under upper layers or permissions and removes handlers after unmount', async () => {
    await open();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(state.history).toHaveBeenCalledTimes(1);
    state.blocked = true;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    expect(state.history).toHaveBeenCalledTimes(1);
    state.blocked = false;
    state.allowed = false;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    expect(state.history).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    state.allowed = true;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(state.history).toHaveBeenCalledTimes(1);
  });
});
