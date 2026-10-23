import { createApp, h, nextTick, reactive, ref } from 'vue';

import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ItemForm from './item-form.vue';
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
  blocked: false,
  allowed: true,
  overlayRows: [] as number[],
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
vi.mock('#/views/erp/stock/check/stock-check-columns', () => ({
  useStockCheckColumns: () => ({
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
      (props, { attrs }) =>
      () =>
        h('input', { ...attrs, value: props.value }),
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
  getStockCount: vi.fn(async () => 10),
  getStockPage: vi.fn(),
}));
vi.mock('#/api/erp/stock/warehouse', () => ({
  getWarehouse: vi.fn(async (id: number) => ({ id, name: '仓库' })),
  getWarehouseSimplePage: vi.fn(),
}));
vi.mock('#/api/erp/product/product', () => ({
  getProduct: vi.fn(async () => ({})),
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
  '#/views/erp/stock/components/stock-batch-update-items-form.vue',
  () => ({ default: { render: () => null } }),
);
vi.mock('#/views/erp/purchase/utils/shortcut-scope', () => ({
  isPurchaseShortcutOwnerActive: () => !state.blocked,
  focusPurchaseShortcutOwner: vi.fn(),
}));
vi.mock('#/views/erp/utils/price-reference', async () => {
  const { ref } = await import('vue');
  return {
    copyPriceReferenceFields: vi.fn(),
    useItemPriceReferenceShortcut: () => ({
      itemTableWrapRef: ref(null),
      priceReferenceOpen: ref(false),
    }),
  };
});
vi.mock(
  '#/views/erp/purchase/components/PurchaseItemDetailShortcuts.vue',
  async () => {
    const { defineComponent } = await import('vue');
    return {
      default: defineComponent({
        setup: (_, { expose }) => {
          expose({
            handleShortcut: state.history,
            handleShortcutKeyup: vi.fn(),
            isShortcutDialogOpen: () => false,
            resetPendingShortcutState: vi.fn(),
          });
          return () => null;
        },
      }),
    };
  },
);

describe('stock check actual component editing', () => {
  let wrapper: ReturnType<typeof mount>;
  beforeEach(() => {
    vi.clearAllMocks();
    state.blocked = false;
    state.allowed = true;
  });
  afterEach(() => wrapper?.unmount());
  async function open(extra = {}) {
    wrapper = mount(ItemForm, {
      attachTo: document.body,
      props: {
        items: [1, 2].map((id) => ({
          id,
          productId: id,
          warehouseId: 1,
          warehouseName: '仓库',
          stockCount: 10,
          actualCount: 10,
          count: 0,
          productPrice: 4.3,
          totalPrice: 0,
        })),
        ...extra,
      },
    });
    await flushPromises();
    return wrapper;
  }
  it('keeps the same second-row price input when editing under active sorting', async () => {
    await open();
    await state.events.sortChange({ field: 'actualCount', order: 'asc' });
    await flushPromises();
    const input = wrapper.find(
      '[data-row="2"] input[data-stock-check-productprice-input]',
    );
    const node = input.element;
    const reloads = state.reload.mock.calls.length;
    await input.setValue('12.50');
    const updated = wrapper.emitted('update:items').at(-1)![0] as any[];
    await wrapper.setProps({ items: updated });
    await flushPromises();
    expect(
      wrapper.find('[data-row="2"] input[data-stock-check-productprice-input]')
        .element,
    ).toBe(node);
    expect(state.reload.mock.calls.length).toBe(reloads);
    expect(updated.find((row) => row.id === 2).productPrice).toBe('12.5');
  });
  it('preserves signed loss adjustment and rejects incomplete input on save', async () => {
    await open();
    const input = wrapper.find(
      '[data-row="2"] input[data-stock-check-count-input]',
    );
    // The adjustment field has its own explicit data attribute, distinct from actualCount.
    const adjustment = wrapper.find(
      '[data-row="2"] input[data-stock-check-count-input]',
    ).element;
    expect(input.exists()).toBe(true);
    const inputs = wrapper.findAll('[data-row="2"] input');
    await inputs[1]!.setValue('-1.250');
    const rows = (wrapper.vm as any).getItems();
    expect(rows[1].count).toBe('-1.25');
    expect(rows[1].actualCount).toBe('8.75');
    await inputs[1]!.setValue('-');
    expect(() => (wrapper.vm as any).getItems()).toThrow('调整数');
    expect(adjustment).toBeTruthy();
  });
  it('keeps price overlay row order aligned while editing a sorted value', async () => {
    await open();
    await state.events.sortChange({ field: 'count', order: 'asc' });
    await flushPromises();
    await wrapper.findAll('[data-row="2"] input')[1]!.setValue('-1');
    expect(state.overlayRows).toEqual([1, 2]);
  });
  it('keeps cost mode quantities fixed while editing amount', async () => {
    await open({ checkType: 2 });
    await wrapper
      .find('[data-row="2"] input[data-stock-check-total-price-input]')
      .setValue('12.50');
    const rows = (wrapper.vm as any).getItems();
    expect(rows[1]).toMatchObject({
      count: 0,
      actualCount: 10,
      stockCount: 10,
      totalPrice: '12.5',
    });
  });
  it('suspends history keys under upper layers and removes listeners on unmount', async () => {
    await open();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(state.history).toHaveBeenCalledTimes(1);
    state.blocked = true;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(state.history).toHaveBeenCalledTimes(1);
    state.blocked = false;
    state.allowed = false;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    expect(state.history).toHaveBeenCalledTimes(1);
    state.allowed = true;
    wrapper.unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(state.history).toHaveBeenCalledTimes(1);
  });
});
