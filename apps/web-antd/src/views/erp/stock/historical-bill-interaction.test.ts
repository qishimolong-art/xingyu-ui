import { createApp, defineComponent, h, nextTick, reactive, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Items from './components/HistoricalStockBillItems.vue';
import InDetail from './inbill/modules/detail-modal.vue';
import OutDetail from './outbill/modules/detail-modal.vue';

const state = vi.hoisted(() => ({
  options: undefined as any,
  data: { id: 1 },
  allowed: true,
  blocked: false,
  get: vi.fn(),
  page: vi.fn(),
  hidden: [] as string[],
  gridOptions: undefined as any,
  events: undefined as any,
  actionProps: undefined as any,
  overlayProps: undefined as any,
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => state.allowed }),
}));
vi.mock('#/composables/useFieldPermission', () => ({
  useFieldPermission: () => ({
    hiddenFields: ref(state.hidden),
    loadHiddenFields: vi.fn(async () => {}),
  }),
  isFieldHidden: (fields: string[], key: string) => fields.includes(key),
}));
vi.mock('#/api/erp/stock/inbill', () => ({
  getStockInBill: state.get,
  getStockInBillItemPage: state.page,
}));
vi.mock('#/api/erp/stock/outbill', () => ({
  getStockOutBill: state.get,
  getStockOutBillItemPage: state.page,
  STOCK_OUT_BILL_HISTORY_NOTICE: '历史单据仅供核对',
}));
vi.mock('@vben/common-ui', () => ({
  useVbenModal: (options: any) => {
    state.options = options;
    return [
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('section', slots.default?.()),
      }),
      {
        getData: () => state.data,
        setState: vi.fn(),
        lock: vi.fn(),
        unlock: vi.fn(),
        close: vi.fn(),
      },
    ];
  },
}));
vi.mock('#/views/erp/stock/components/StockDocumentFormLayout.vue', () => ({
  default: defineComponent({
    props: ['error'],
    setup:
      (p, { slots }) =>
      () =>
        h('div', [p.error, slots.basic?.(), slots.items?.(), slots.audit?.()]),
  }),
}));
vi.mock('#/views/erp/components/ErpAuditInfo.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}));
vi.mock('#/views/erp/stock/utils/source-document-modal.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}));
vi.mock('#/views/erp/stock/components/StockItemDetailActions.vue', () => ({
  default: defineComponent({
    props: ['activeRow', 'enabled', 'hiddenFields'],
    setup: (p, { expose }) => {
      state.actionProps = p;
      expose({ isBlockedForPrice: () => state.blocked, pointer: vi.fn() });
      return () => h('span', p.activeRow?.productName);
    },
  }),
}));
vi.mock('#/views/erp/components/ItemPriceReferenceOverlay.vue', () => ({
  default: defineComponent({
    props: ['open', 'rows'],
    setup: (p) => {
      state.overlayProps = p;
      return () => h('div', { 'data-overlay': p.open }, '价格');
    },
  }),
}));
vi.mock('#/views/erp/stock/utils/document-columns', () => ({
  useStockDocumentColumns: (options: any) => ({
    reload: async () => {
      state.gridOptions.columns = options.columns();
    },
    queue: vi.fn(),
    custom: vi.fn(),
    restoreStore: vi.fn(),
  }),
}));
vi.mock('#/adapter/vxe-table', () => ({
  useVbenVxeGrid: (options: any) => {
    state.gridOptions = options.gridOptions;
    state.events = options.gridEvents;
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
                  'button',
                  { onClick: () => options.gridEvents.cellClick({ row }) },
                  row.productName,
                ),
              ),
              h(
                'button',
                {
                  onClick: () =>
                    options.gridOptions.toolbarConfig.refresh.queryMethod(),
                },
                '刷新明细',
              ),
            ]),
      }),
      {
        setLoading: vi.fn(),
        grid: {
          loadData: async (data: any[]) => {
            rows.value = data;
          },
        },
      },
    ];
  },
}));
vi.mock('ant-design-vue', () => {
  const box = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Alert: box,
    Tag: box,
    Progress: box,
    Pagination: defineComponent({
      props: ['current', 'pageSize'],
      emits: ['change'],
      setup:
        (p, { emit }) =>
        () =>
          h(
            'button',
            { onClick: () => emit('change', 2, p.pageSize) },
            '下一页',
          ),
    }),
  };
});
const cleanup: Array<() => void> = [];
async function flush() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function mount(component: any, props: any = {}) {
  const live = reactive(props);
  const element = document.createElement('div');
  document.body.append(element);
  const app = createApp({ setup: () => () => h(component, live) });
  app.mount(element);
  const unmount = () => {
    app.unmount();
    element.remove();
  };
  cleanup.push(unmount);
  return { element, props: live, unmount };
}
function click(el: HTMLElement, label: string) {
  const button = [...el.querySelectorAll('button')].find(
    (b) => b.textContent === label,
  );
  expect(button).toBeTruthy();
  button!.click();
}
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.allowed = true;
  state.blocked = false;
  state.hidden = [];
  state.data = { id: 1 };
  state.get.mockResolvedValue({
    id: 1,
    no: 'B1',
    status: 10,
    totalCount: 12,
    pickedCount: 3,
  });
  state.page.mockResolvedValue({
    list: [
      {
        id: 1,
        productId: 11,
        productName: '第一行',
        count: 1.123_456,
        productPrice: 2.5,
      },
    ],
    total: 21,
  });
});
afterEach(() => cleanup.splice(0).forEach((fn) => fn()));

describe.each([
  ['入仓', InDetail],
  ['出仓', OutDetail],
])('%s历史仓单实际详情', (_name, component) => {
  it('loads header separately and refreshes only the current detail page', async () => {
    const { element } = mount(component);
    await state.options.onOpenChange(true);
    await flush();
    click(element, '下一页');
    await flush();
    expect(state.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        billId: 1,
        pageNo: 2,
        pageSize: 10,
        mask: true,
      }),
    );
    click(element, '刷新明细');
    await flush();
    expect(state.get).toHaveBeenCalledTimes(1);
    expect(state.page).toHaveBeenCalledTimes(3);
    expect(state.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 2 }),
    );
    expect(element.querySelector('input')).toBeNull();
  });
  it('keeps remote sorting during refresh and ignores older page responses', async () => {
    const { element } = mount(component);
    await state.options.onOpenChange(true);
    await flush();
    state.events.sortChange({ field: 'productPrice', order: 'desc' });
    await flush();
    const old = deferred();
    state.page.mockReturnValueOnce(old.promise);
    click(element, '下一页');
    await flush();
    click(element, '刷新明细');
    await flush();
    old.resolve({ list: [{ id: 99, productName: '旧响应' }], total: 99 });
    await flush();
    expect(element.textContent).not.toContain('旧响应');
    expect(state.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderField: 'productPrice',
        orderDirection: 'desc',
      }),
    );
  });
  it('distinguishes permission-cleared totals from missing historical values', async () => {
    state.hidden = ['item_count'];
    state.get.mockResolvedValue({
      id: 1,
      no: 'MASKED',
      totalCount: null,
      pickedCount: 3,
    });
    const { element } = mount(component);
    await state.options.onOpenChange(true);
    await flush();
    expect(element.textContent).toContain('****');
  });
  it('close/reopen prevents late requests from restoring another document', async () => {
    const { element } = mount(component);
    await state.options.onOpenChange(true);
    await flush();
    const old = deferred();
    state.page.mockReturnValueOnce(old.promise);
    click(element, '下一页');
    await flush();
    await state.options.onOpenChange(false);
    state.data = { id: 2 };
    state.get.mockResolvedValue({ id: 2, no: 'B2' });
    state.page.mockResolvedValue({
      list: [{ id: 2, productName: '新单据' }],
      total: 1,
    });
    await state.options.onOpenChange(true);
    await flush();
    old.resolve({ list: [{ id: 88, productName: '已关闭旧单' }], total: 99 });
    await flush();
    expect(element.textContent).toContain('新单据');
    expect(element.textContent).not.toContain('已关闭旧单');
  });
});
describe('历史明细列、价格和活动行', () => {
  it('formats price, zero, missing and masked values without truncating quantity', async () => {
    mount(Items, {
      direction: 'in',
      items: [{ id: 1, productName: '商品', count: 123_456_789.123_456 }],
      hiddenFields: [],
      enabled: true,
      loading: false,
    });
    await flush();
    const columns = state.gridOptions.columns;
    expect(columns.some((column: any) => column.field === 'actions')).toBe(
      false,
    );
    expect(columns.at(-1).field).toBe('remark');
    expect(
      columns.find((column: any) => column.field === 'count').width,
    ).toBeGreaterThanOrEqual(String(123_456_789.123_456).length * 8 + 24);
    const qty = columns.find(
      (column: any) => column.field === 'count',
    ).formatter;
    expect(qty({ cellValue: 1.123_456 })).toBe('1.123456');
    expect(qty({ cellValue: 0 })).toBe('0');
    expect(qty({ cellValue: null })).toBe('-');
    expect(qty({ cellValue: '****' })).toBe('****');
    const price = columns.find(
      (column: any) => column.field === 'productPrice',
    ).formatter;
    expect(price({ cellValue: 2.5, row: {} })).toBe('2.5');
    expect(price({ cellValue: 9, row: { priceVisible: false } })).toBe('****');
  });
  it('retains current-row identity on replacement and keeps price overlay rows aligned', async () => {
    const view = mount(Items, {
      direction: 'out',
      items: [
        { id: 1, productName: '一' },
        { id: 2, productName: '二' },
      ],
      hiddenFields: [],
      enabled: true,
      loading: false,
    });
    await flush();
    click(view.element, '二');
    await flush();
    expect(state.actionProps.activeRow.id).toBe(2);
    view.props.items = [
      { id: 2, productName: '二更新' },
      { id: 1, productName: '一' },
    ];
    await flush();
    expect(state.actionProps.activeRow.productName).toBe('二更新');
    expect(state.overlayProps.rows.map((row: any) => row.id)).toEqual([2, 1]);
  });
  it('W works without an active row, upper layers block it, and disabling closes it', async () => {
    const view = mount(Items, {
      direction: 'in',
      items: [],
      hiddenFields: [],
      enabled: true,
      loading: false,
    });
    await flush();
    const key = () =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'w', bubbles: true }),
      );
    key();
    await flush();
    expect(state.overlayProps.open).toBe(true);
    key();
    await flush();
    expect(state.overlayProps.open).toBe(false);
    state.blocked = true;
    key();
    await flush();
    expect(state.overlayProps.open).toBe(false);
    state.blocked = false;
    key();
    await flush();
    expect(state.overlayProps.open).toBe(true);
    view.props.enabled = false;
    await flush();
    expect(state.overlayProps.open).toBe(false);
  });
});
