import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import Detail from './modules/detail-modal.vue';
vi.mock('#/composables/useFieldPermission', () => ({
  isFieldHidden: () => false,
  useFieldPermission: () => ({
    hiddenFields: [],
    loadHiddenFields: vi.fn(async () => {}),
  }),
}));
vi.mock('#/views/erp/stock/components/HistoricalStockBillItems.vue', () => ({
  default: defineComponent({
    props: ['items'],
    emits: ['sort', 'refresh'],
    setup:
      (p, { emit }) =>
      () =>
        h('div', [
          ...(p.items || []).map((row: any) => h('span', row.productName)),
          h(
            'button',
            {
              onClick: () =>
                emit('sort', { field: 'productPrice', order: 'asc' }),
            },
            '按配件排序',
          ),
          h('button', { onClick: () => emit('refresh') }, '刷新明细'),
        ]),
  }),
}));

type ModalOptions = {
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => Promise<void>;
};
const context = vi.hoisted(() => ({
  options: undefined as ModalOptions | undefined,
  data: { id: 1, mode: 'pick' },
  permissions: new Set<string>(),
  get: vi.fn(),
  items: vi.fn(),
  pick: vi.fn(),
  source: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => context.permissions.has(code)),
  }),
}));
vi.mock('@vben/common-ui', () => ({
  useVbenModal: (options: ModalOptions) => {
    context.options = options;
    const modal = defineComponent({
      props: ['title', 'showConfirmButton'],
      setup:
        (p, { slots }) =>
        () =>
          h('section', [
            h('h1', p.title),
            slots.default?.(),
            ...(p.showConfirmButton
              ? [h('button', { onClick: options.onConfirm }, '提交')]
              : []),
          ]),
    });
    return [
      modal,
      {
        getData: <T>() => context.data as T,
        setState: vi.fn(),
        lock: context.lock,
        unlock: context.unlock,
        close: () => options.onOpenChange(false),
      },
    ];
  },
}));
vi.mock('#/api/erp/stock/outbill', () => ({
  getStockOutBill: context.get,
  getStockOutBillItemPage: context.items,
  pickStockOutBill: context.pick,
  STOCK_OUT_BILL_HISTORY_NOTICE:
    '销售审核直接扣库存；历史待领请核对，不会自动补扣。',
}));
vi.mock('#/views/erp/stock/components/StockDocumentFormLayout.vue', () => ({
  default: defineComponent({
    props: ['error'],
    setup:
      (p, { slots }) =>
      () =>
        h('div', [
          p.error,
          slots.basic?.(),
          slots.items?.(),
          slots.summary?.(),
          slots.audit?.(),
        ]),
  }),
}));
vi.mock('#/views/erp/components/ErpAuditInfo.vue', () => ({
  default: defineComponent({ setup: () => () => h('div', '原审核信息') }),
}));
vi.mock('#/views/erp/stock/utils/source-document-modal.vue', () => ({
  default: defineComponent({
    setup: (_, { expose }) => {
      expose({ open: context.source });
      return () => null;
    },
  }),
}));
vi.mock('ant-design-vue', () => {
  const box = defineComponent({
    props: ['message'],
    setup:
      (p, { slots }) =>
      () =>
        h('div', [p.message, slots.default?.()]),
  });
  const table = defineComponent({
    props: ['columns', 'dataSource'],
    emits: ['change'],
    setup:
      (p, { emit }) =>
      () =>
        h('div', [
          ...((p.columns || []) as Array<{ title: string }>).map((c) =>
            h('b', c.title),
          ),
          ...((p.dataSource || []) as Array<{ productName: string }>).map((r) =>
            h('span', r.productName),
          ),
          h(
            'button',
            {
              onClick: () =>
                emit(
                  'change',
                  {},
                  {},
                  { columnKey: 'productName', order: 'ascend' },
                ),
            },
            '按配件排序',
          ),
        ]),
  });
  const pager = defineComponent({
    props: ['current', 'pageSize', 'total'],
    emits: ['change'],
    setup:
      (p, { emit }) =>
      () =>
        h('div', [
          `${p.current}/${p.total}`,
          h(
            'button',
            { onClick: () => emit('change', 2, p.pageSize) },
            '下一页',
          ),
        ]),
  });
  return { Alert: box, Tag: box, Table: table, Pagination: pager };
});

const disposers: Array<() => void> = [];
function mount() {
  const el = document.createElement('div');
  document.body.append(el);
  const app = createApp(Detail);
  app.mount(el);
  disposers.push(() => {
    app.unmount();
    el.remove();
  });
  return el;
}
async function flush() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function click(el: HTMLElement, text: string) {
  const b = [...el.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  );
  expect(b).toBeTruthy();
  b!.click();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  context.permissions = reactive(new Set(['erp:stock-out-bill:query']));
  context.data = { id: 1, mode: 'pick' };
  context.get.mockResolvedValue({
    id: 1,
    no: 'OB1',
    status: 10,
    sourceNo: 'SO1',
    sourceId: 11,
  });
  context.items.mockResolvedValue({
    list: [
      {
        id: 1,
        productName: '历史配件',
        count: 10,
        pickedCount: 0,
        remainCount: 10,
      },
    ],
    total: 12,
  });
});
afterEach(() => disposers.splice(0).forEach((fn) => fn()));
describe('历史出仓只读实际组件', () => {
  it('direct old pick mode is read-only and cannot submit even through old modal callback', async () => {
    const el = mount();
    await context.options!.onOpenChange(true);
    await flush();
    expect(el.textContent).toContain('历史出仓单详情');
    expect(el.textContent).toContain('历史待领（待核对）');
    expect(el.textContent).not.toContain('本次拣货');
    expect(el.querySelector('input')).toBeNull();
    expect(
      [...el.querySelectorAll('button')].some((b) => b.textContent === '提交'),
    ).toBe(false);
    expect(context.items).toHaveBeenCalledWith(
      expect.objectContaining({
        billId: 1,
        mask: true,
        pageNo: 1,
        pageSize: 10,
      }),
    );
    await context.options!.onConfirm();
    expect(context.pick).not.toHaveBeenCalled();
  });
  it('history pagination and remote sort remain available', async () => {
    const el = mount();
    await context.options!.onOpenChange(true);
    click(el, '下一页');
    await flush();
    expect(context.items).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 2, pageSize: 10, mask: true }),
    );
    click(el, '按配件排序');
    await flush();
    expect(context.items).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageNo: 1,
        orderField: 'productPrice',
        orderDirection: 'asc',
      }),
    );
    click(el, 'SO1');
    expect(context.source).toHaveBeenCalledWith(expect.anything(), 11);
  });
  it('pick-only role cannot load historical queries', async () => {
    context.permissions = reactive(new Set(['erp:stock-out-bill:pick']));
    const el = mount();
    await context.options!.onOpenChange(true);
    await flush();
    expect(el.textContent).toContain('没有历史出仓单查询权限');
    expect(context.get).not.toHaveBeenCalled();
    expect(context.items).not.toHaveBeenCalled();
    expect(context.pick).not.toHaveBeenCalled();
  });
  it('close/switch discards late old page; reopen resets page and sort', async () => {
    const el = mount();
    await context.options!.onOpenChange(true);
    const pending = deferred<{
      list: Array<{ productName: string }>;
      total: number;
    }>();
    context.items.mockReturnValueOnce(pending.promise);
    click(el, '下一页');
    await flush();
    await context.options!.onOpenChange(false);
    context.data = { id: 2, mode: 'detail' };
    context.get.mockResolvedValue({ id: 2, no: 'OB2', status: 30 });
    context.items.mockResolvedValue({
      list: [{ productName: '新打开历史行' }],
      total: 1,
    });
    await context.options!.onOpenChange(true);
    pending.resolve({ list: [{ productName: '不应复活旧行' }], total: 12 });
    await flush();
    expect(el.textContent).toContain('新打开历史行');
    expect(el.textContent).not.toContain('不应复活旧行');
    expect(context.items).toHaveBeenLastCalledWith(
      expect.objectContaining({ billId: 2, pageNo: 1, orderField: undefined }),
    );
  });
  it('query failure leaves read-only error and revoked permission clears data', async () => {
    const el = mount();
    context.get.mockRejectedValueOnce(new Error('failed'));
    await context.options!.onOpenChange(true);
    await flush();
    expect(el.textContent).toContain('出仓单加载失败');
    expect(context.pick).not.toHaveBeenCalled();
    await context.options!.onOpenChange(true);
    context.permissions.clear();
    await flush();
    expect(el.textContent).not.toContain('历史配件');
    expect(el.textContent).toContain('没有历史出仓单查询权限');
  });
});
