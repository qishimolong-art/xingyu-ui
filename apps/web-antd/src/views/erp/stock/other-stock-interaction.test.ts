import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp, defineComponent, h, nextTick, reactive, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InItems from './in/modules/item-form.vue';
import OutItems from './out/modules/item-form.vue';
import { useOtherStockDecimalInputs } from './utils/other-stock-input';
import {
  cleanOtherStockItem,
  formatOtherStockListQuantity,
} from './utils/other-stock-item';

const state = vi.hoisted(() => ({
  grid: undefined as any,
  events: undefined as any,
  reload: vi.fn(),
  load: vi.fn(),
  actions: undefined as any,
  overlay: undefined as any,
  blocked: false,
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('@vben/common-ui', () => ({
  useVbenModal: () => [defineComponent({ setup: () => () => null }), {}],
}));
vi.mock('#/api/erp/stock/stock', () => ({
  getStockCount: vi.fn(async () => 100),
  getStockPage: vi.fn(),
}));
vi.mock('#/api/erp/stock/warehouse', () => ({
  getWarehouse: vi.fn(async () => undefined),
  getWarehouseSimplePage: vi.fn(),
}));
vi.mock('#/composables/useFieldPermission', () => ({
  isFieldHidden: (fields: string[], key: string) => fields.includes(key),
}));
const fields = [
  'productId',
  'warehouseId',
  'count',
  'productPrice',
  'totalPrice',
  'remark',
  'actions',
];
vi.mock('./in/data', () => ({
  useFormItemColumns: (disabled: boolean) =>
    fields
      .filter((f) => !disabled || f !== 'actions')
      .map((field) => ({
        field,
        title: field,
        width: 120,
        slots: { default: field },
      })),
}));
vi.mock('./out/data', () => ({
  useFormItemColumns: (disabled: boolean) =>
    fields
      .filter((f) => !disabled || f !== 'actions')
      .map((field) => ({
        field,
        title: field,
        width: 120,
        slots: { default: field },
      })),
}));
vi.mock('#/views/erp/components/ErpInlineStockSelect.vue', () => ({
  default: defineComponent({
    emits: ['select'],
    setup:
      (_, { emit }) =>
      () =>
        h(
          'button',
          {
            onClick: () =>
              emit('select', [
                {
                  productId: 22,
                  productName: '替换商品',
                  warehouseId: 1,
                  warehouseName: '仓库',
                  count: 10,
                  lastPurchasePrice: 4,
                },
              ]),
          },
          '替换商品',
        ),
  }),
}));
vi.mock('#/views/erp/components/ErpLazyPageSelect.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}));
vi.mock(
  '#/views/erp/stock/components/stock-batch-update-items-form.vue',
  () => ({ default: defineComponent({ setup: () => () => null }) }),
);
vi.mock('#/views/erp/stock/components/StockItemDetailActions.vue', () => ({
  default: defineComponent({
    props: ['activeRow', 'blocked', 'enabled', 'deptId'],
    setup: (p, { expose }) => {
      state.actions = p;
      expose({
        isBlocked: () => state.blocked,
        isBlockedForPrice: () => state.blocked,
        pointer: vi.fn(),
      });
      return () => null;
    },
  }),
}));
vi.mock('#/views/erp/components/ItemPriceReferenceOverlay.vue', () => ({
  default: defineComponent({
    props: ['rows', 'open'],
    setup: (p) => {
      state.overlay = p;
      return () => null;
    },
  }),
}));
vi.mock('#/views/erp/stock/utils/document-columns', () => ({
  useStockDocumentColumns: (o: any) => ({
    reload: async () => {
      state.reload();
      state.grid.columns = o.columns();
    },
    queue: vi.fn(),
    custom: vi.fn(),
    restoreStore: vi.fn(),
  }),
}));
vi.mock('#/adapter/vxe-table', () => ({
  ACTION_ICON: { DELETE: 'delete' },
  TableAction: defineComponent({ setup: () => () => null }),
  useVbenVxeGrid: (o: any) => {
    state.grid = o.gridOptions;
    state.events = o.gridEvents;
    const rows = ref<any[]>([]);
    return [
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('div', [
              slots['toolbar-buttons']?.(),
              ...rows.value.map((row) =>
                h(
                  'div',
                  {
                    key: row.clientRowKey,
                    'data-row': row.id,
                    onClick: () => o.gridEvents.cellClick({ row }),
                  },
                  [
                    slots.productId?.({ row }),
                    slots.count?.({ row }),
                    slots.productPrice?.({ row }),
                    slots.remark?.({ row }),
                  ],
                ),
              ),
            ]),
      }),
      {
        setGridOptions: vi.fn(),
        setLoading: vi.fn(),
        grid: {
          loadData: async (data: any[]) => {
            state.load();
            rows.value = data;
          },
          setCurrentRow: vi.fn(),
          clearCheckboxRow: vi.fn(),
          clearCheckboxReserve: vi.fn(),
          setSort: vi.fn(),
          clearSort: vi.fn(),
        },
      },
    ];
  },
}));
vi.mock('ant-design-vue', () => ({
  Input: defineComponent({
    inheritAttrs: false,
    props: ['value', 'status'],
    emits: ['update:value', 'blur', 'pressEnter'],
    setup:
      (p, { attrs, emit }) =>
      () =>
        h('input', {
          ...attrs,
          value: p.value,
          'data-error': p.status,
          onInput: (e: any) => emit('update:value', e.target.value),
          onBlur: () => emit('blur'),
          onKeydown: (e: KeyboardEvent) => {
            if (e.key === 'Enter') emit('pressEnter', e);
          },
        }),
  }),
  Button: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('button', slots.default?.()),
  }),
  Pagination: defineComponent({ setup: () => () => null }),
  message: { warning: vi.fn(), success: vi.fn() },
  Modal: { confirm: vi.fn() },
}));
const cleanup: Array<() => void> = [];
async function flush() {
  for (let i = 0; i < 15; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function mount(component: any, initial: any = {}) {
  const props = reactive({
    items: [
      {
        id: 1,
        productId: 11,
        warehouseId: 1,
        warehouseName: '仓库',
        count: 1,
        productPrice: 2,
      },
      {
        id: 2,
        productId: 12,
        warehouseId: 1,
        warehouseName: '仓库',
        count: 2,
        productPrice: 3,
      },
    ],
    ...initial,
  });
  const element = document.createElement('div');
  document.body.append(element);
  let instance: any;
  const app = createApp({
    setup: () => () =>
      h(component, {
        ...props,
        ref: (v: any) => {
          instance = v;
        },
        'onUpdate:items': (rows: any[]) => {
          props.items = rows.map((row) => ({ ...row }));
        },
      }),
  });
  app.mount(element);
  cleanup.push(() => {
    app.unmount();
    element.remove();
  });
  return {
    element,
    props,
    get instance() {
      return instance;
    },
  };
}
function input(element: HTMLInputElement, value: string) {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
beforeEach(() => {
  vi.clearAllMocks();
  state.blocked = false;
});
afterEach(() => cleanup.splice(0).forEach((fn) => fn()));

describe.each([
  ['入库', InItems],
  ['出库', OutItems],
])('%s实际明细编辑', (_label, component) => {
  it('keeps the second input node, text and row order while sorting and updating linked amounts', async () => {
    const view = mount(component);
    await flush();
    await state.events.sortChange({ field: 'count', order: 'asc' });
    await flush();
    const node = view.element.querySelector(
      '[data-row="2"] input',
    ) as HTMLInputElement;
    node.focus();
    state.reload.mockClear();
    state.load.mockClear();
    input(node, '2.12345678900');
    await flush();
    expect(view.element.querySelector('[data-row="2"] input')).toBe(node);
    expect(document.activeElement).toBe(node);
    expect(node.value).toBe('2.12345678900');
    expect(state.reload).not.toHaveBeenCalled();
    expect(state.load).not.toHaveBeenCalled();
    node.dispatchEvent(new Event('blur'));
    await flush();
    expect(node.value).toBe('2.12345678900');
    expect(view.instance.getItems()[1].count).toBe('2.123456789');
    expect(Number(view.instance.getItems()[1].totalPrice)).toBeGreaterThan(6);
    const current = view.instance.getItems()[1];
    const amountColumn = state.grid.columns.find(
      (column: any) => column.field === 'totalPrice',
    );
    expect(amountColumn.formatter({ row: current })).toBe(
      String(current.totalPrice),
    );
  });
  it('blocks paging and refresh for invalid intermediate text, then restores text across remote pages', async () => {
    const view = mount(component, {
      remotePaging: true,
      itemPagination: { pageNo: 1, pageSize: 10, total: 20 },
    });
    await flush();
    const node = view.element.querySelector('input') as HTMLInputElement;
    input(node, '');
    await flush();
    expect(() => view.instance.getItems()).toThrow();
    await state.grid.toolbarConfig.refresh.queryMethod();
    expect(node.value).toBe('');
    input(node, '1.25000');
    node.dispatchEvent(new Event('blur'));
    await flush();
    const page1 = view.props.items;
    view.props.items = [
      {
        id: 9,
        productId: 9,
        warehouseId: 1,
        warehouseName: '仓库',
        count: 9,
        productPrice: 2,
      },
    ];
    await flush();
    view.props.items = page1;
    await flush();
    expect(
      (view.element.querySelector('input') as HTMLInputElement).value,
    ).toBe('1.25000');
  });
  it('explicit stock product replacement resets old quantity text to selection defaults', async () => {
    const view = mount(component);
    await flush();
    const inputNode = view.element.querySelector('input') as HTMLInputElement;
    input(inputNode, '7.25000');
    await flush();
    (
      view.element.querySelector('[data-row="1"] button') as HTMLElement
    ).click();
    await flush();
    const rows = view.instance.getItems();
    expect(rows[0].productId).toBe(22);
    expect(rows[0].count).toBe(1);
    expect(
      (view.element.querySelector('[data-row="1"] input') as HTMLInputElement)
        .value,
    ).toBe('1');
  });
  it('detail removes operations and clicking a row aligns history and W rows', async () => {
    const view = mount(component, { disabled: true, deptId: 22 });
    await flush();
    expect(
      state.grid.columns.some((column: any) => column.field === 'actions'),
    ).toBe(false);
    (view.element.querySelector('[data-row="2"]') as HTMLElement).click();
    await flush();
    expect(state.actions.activeRow.id).toBe(2);
    expect(state.actions.deptId).toBe(22);
    expect(state.overlay.rows.map((row: any) => row.id)).toEqual([1, 2]);
  });
});
it('quantity and price validation reject scientific notation, negative and overprecision without truncating quantity', () => {
  const row = { id: 1, count: 1, productPrice: 2 };
  const changed = vi.fn();
  const inputs = useOtherStockDecimalInputs((r) => String(r.id), changed);
  inputs.decimalInput(row, 'count', '1.123456789');
  inputs.commitDecimal(row, 'count');
  expect(row.count).toBe('1.123456789');
  for (const bad of ['-1', '1e3', 'abc']) {
    inputs.decimalInput(row, 'count', bad);
    expect(inputs.decimalValue(row, 'count')).toBe('1.123456789');
  }
  inputs.decimalInput(row, 'count', '0');
  expect(() => inputs.commitDecimal(row, 'count')).toThrow();
  inputs.decimalInput(row, 'productPrice', '2.999');
  expect(row.productPrice).toBe('2.999');
});
it('product reference refresh never becomes a business increment and preserves saved values', () => {
  const row = {
    id: 1,
    count: 2,
    productPrice: 3,
    totalPrice: 6,
    weight: 4,
    packageQty: 5,
    batchNo: 'B',
    salePrice: 100,
    productPurchasePrice: 99,
    priceVisible: true,
  };
  expect(cleanOtherStockItem(row)).toEqual({
    id: 1,
    count: 2,
    productPrice: 3,
    totalPrice: 6,
    weight: 4,
    packageQty: 5,
    batchNo: 'B',
  });
  expect(row.salePrice).toBe(100);
});

it('list quantities use two decimals without changing source precision, zero or masks', () => {
  const value = 1.123_456_789;
  expect(formatOtherStockListQuantity(value)).toBe('1.12');
  expect(value).toBe(1.123_456_789);
  expect(formatOtherStockListQuantity(0)).toBe('0.00');
  expect(formatOtherStockListQuantity('****')).toBe('****');
  expect(formatOtherStockListQuantity(null)).toBe('-');
});

it.each(['in', 'out'])(
  '%s query revocation clears cached summary and selection as well as rows',
  (direction) => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), direction, 'index.vue'),
      'utf8',
    );
    const revoke = source.slice(source.indexOf('watch(canQueryDocument'));
    expect(revoke).toContain('querySummaryState.cancelPending()');
    expect(revoke).toContain('querySummaryState.summary.value = undefined');
    expect(revoke).toContain('checkedRows.value = []');
    expect(revoke).toContain('clearCurrentRow?.()');
    expect(source).toContain('if (!canQueryDocument.value) return []');
  },
);
