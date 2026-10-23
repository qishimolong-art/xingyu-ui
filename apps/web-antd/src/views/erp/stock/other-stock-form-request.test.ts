import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import InForm from './in/modules/form.vue';
import OutForm from './out/modules/form.vue';
const state = vi.hoisted(() => ({
  modal: undefined as any,
  data: { id: 1, type: 'detail' },
  allowed: undefined as any,
  get: vi.fn(),
  page: vi.fn(),
  values: vi.fn(),
  closed: vi.fn(),
  formRows: [] as any[],
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => state.allowed.value }),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { deptId: 1 } }),
}));
vi.mock('#/composables/useFieldPermission', () => ({
  useFieldPermission: () => ({
    hiddenFields: ref([]),
    loadHiddenFields: vi.fn(async () => {}),
  }),
  isFieldHidden: () => false,
}));
vi.mock('#/api/erp/stock/in', () => ({
  createStockIn: vi.fn(),
  updateStockIn: vi.fn(),
  getStockIn: state.get,
  getStockInItemPage: state.page,
  getStockInEditItemPage: state.page,
  matchStockInItems: vi.fn(),
}));
vi.mock('#/api/erp/stock/out', () => ({
  createStockOut: vi.fn(),
  updateStockOut: vi.fn(),
  getStockOut: state.get,
  getStockOutItemPage: state.page,
  getStockOutEditItemPage: state.page,
  matchStockOutItems: vi.fn(),
}));
vi.mock('@vben/common-ui', () => ({
  useVbenModal: (options: any) => {
    if (options.onConfirm) state.modal = options;
    return [
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('div', [slots.default?.(), slots['prepend-footer']?.()]),
      }),
      {
        getData: () => state.data,
        setState: vi.fn(),
        lock: vi.fn(),
        unlock: vi.fn(),
        close: state.closed,
        setData: vi.fn(),
      },
    ];
  },
}));
vi.mock('#/adapter/form', () => ({
  useVbenForm: () => [
    defineComponent({ setup: () => () => null }),
    {
      getValues: vi.fn(async () => ({})),
      validate: vi.fn(async () => ({ valid: true })),
      setValues: state.values,
      setState: vi.fn(),
      setDisabled: vi.fn(),
      resetForm: vi.fn(async () => {}),
    },
  ],
}));
vi.mock('./in/data', () => ({ useFormSchema: () => [] }));
vi.mock('./out/data', () => ({ useFormSchema: () => [] }));
vi.mock('#/views/erp/stock/utils/document-form-ui', () => ({
  buildStockDocumentFormSchema: () => [],
  buildStockDocumentDetailFormValues: (v: any) => v,
  hydrateStockDocumentFormSelectLabels: async (v: any) => v,
}));
vi.mock('#/views/erp/stock/components/StockDocumentFormLayout.vue', () => ({
  default: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', [slots.basic?.(), slots.items?.(), slots.audit?.()]),
  }),
}));
vi.mock('#/views/erp/stock/components/StockDocumentSummary.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}));
vi.mock('#/views/erp/components/ErpAuditInfo.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}));
vi.mock('#/views/erp/components/DetailLinkInput.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}));
vi.mock('#/views/erp/stock/components/StockDocumentRemarkForm.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}));
vi.mock('./in/modules/item-form.vue', () => ({
  default: defineComponent({
    props: ['items'],
    setup: (p, { expose, emit }) => {
      expose({ getItems: () => p.items, validate: vi.fn() });
      return () =>
        h('div', [
          h('span', p.items?.map((row: any) => row.productName).join(',')),
          h(
            'button',
            { onClick: () => emit('page-change', { pageNo: 2 }) },
            '下一页',
          ),
          h(
            'button',
            { onClick: () => emit('refresh-items', { pageNo: 2 }) },
            '刷新',
          ),
        ]);
    },
  }),
}));
vi.mock('./out/modules/item-form.vue', () => ({
  default: defineComponent({
    props: ['items'],
    setup: (p, { expose, emit }) => {
      expose({ getItems: () => p.items, validate: vi.fn() });
      return () =>
        h('div', [
          h('span', p.items?.map((row: any) => row.productName).join(',')),
          h(
            'button',
            { onClick: () => emit('page-change', { pageNo: 2 }) },
            '下一页',
          ),
          h(
            'button',
            { onClick: () => emit('refresh-items', { pageNo: 2 }) },
            '刷新',
          ),
        ]);
    },
  }),
}));
vi.mock('ant-design-vue', () => ({
  Button: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('button', slots.default?.()),
  }),
  message: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
const cleanups: Array<() => void> = [];
async function flush() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function mount(component: any) {
  const el = document.createElement('div');
  document.body.append(el);
  const app = createApp(component);
  app.mount(el);
  cleanups.push(() => {
    app.unmount();
    el.remove();
  });
  return el;
}
function deferred() {
  let resolve!: (value: any) => void;
  return {
    promise: new Promise((done) => (resolve = done)),
    resolve: (v: any) => resolve(v),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.allowed = ref(true);
  state.data = { id: 1, type: 'detail' };
  state.get.mockResolvedValue({ id: 1, status: 10, no: 'N1' });
  state.page.mockResolvedValue({
    list: [
      {
        id: 1,
        productName: '当前',
        productId: 1,
        warehouseId: 1,
        count: 1,
        productPrice: 2,
      },
    ],
    total: 21,
  });
});
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));
describe.each([
  ['入库', InForm],
  ['出库', OutForm],
])('%s实际表单请求保护', (_label, component) => {
  it('loads header only, refreshes the current item page, and drops older page responses', async () => {
    const el = mount(component);
    await state.modal.onOpenChange(true);
    await flush();
    expect(state.get).toHaveBeenCalledWith(1, { includeItems: false });
    const old = deferred();
    state.page.mockReturnValueOnce(old.promise);
    (el.querySelector('button') as HTMLElement).click();
    await flush();
    (el.querySelectorAll('button')[1] as HTMLElement).click();
    await flush();
    old.resolve({ list: [{ id: 99, productName: '过期' }], total: 21 });
    await flush();
    expect(el.textContent).toContain('当前');
    expect(el.textContent).not.toContain('过期');
    expect(state.get).toHaveBeenCalledTimes(1);
    expect(state.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 2, pageSize: 10 }),
    );
  });
  it('closing during header loading cannot restore old document state', async () => {
    const el = mount(component);
    const old = deferred();
    state.get.mockReturnValueOnce(old.promise);
    const opening = state.modal.onOpenChange(true);
    await flush();
    await state.modal.onOpenChange(false);
    old.resolve({ id: 1, no: 'OLD', items: [] });
    await opening;
    await flush();
    expect(state.values).not.toHaveBeenCalledWith(
      expect.objectContaining({ no: 'OLD' }),
    );
    expect(el.textContent).not.toContain('OLD');
    expect(state.page).not.toHaveBeenCalled();
  });
  it('permission revocation closes and clears data, including late page results', async () => {
    const el = mount(component);
    await state.modal.onOpenChange(true);
    await flush();
    const old = deferred();
    state.page.mockReturnValueOnce(old.promise);
    (el.querySelector('button') as HTMLElement).click();
    await flush();
    state.allowed.value = false;
    await flush();
    old.resolve({ list: [{ id: 99, productName: '越权晚响应' }], total: 21 });
    await flush();
    expect(state.closed).toHaveBeenCalled();
    expect(el.textContent).not.toContain('越权晚响应');
    expect(el.textContent).not.toContain('当前');
  });
});
