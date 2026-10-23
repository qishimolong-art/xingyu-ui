import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, reactive, ref } from 'vue';

import History from './index.vue';

type Params = Record<string, unknown>;
type Query = (
  page: { page: { currentPage: number; pageSize: number } },
  values: Params,
) => Promise<{ list: Params[]; total: number }>;
type GridOptions = {
  gridOptions: { proxyConfig: { ajax: { query: Query } } };
  gridEvents: Record<string, unknown>;
};
type Activation = {
  queryPage: (value: Params) => Promise<unknown>;
  onSuccess: (rows: Params[]) => Promise<void>;
};
const state = vi.hoisted(() => ({
  permissions: new Set<string>(),
  page: vi.fn(),
  exportData: vi.fn(),
  fields: vi.fn(),
  download: vi.fn(),
  summary: vi.fn(async () => ({ totalCount: 123, pickedCount: 4 })),
  grid: undefined as GridOptions | undefined,
  activation: undefined as Activation | undefined,
  selection: [] as Params[],
  values: {} as Params,
  modalData: [] as Params[],
  modalOpen: vi.fn(),
}));
vi.mock('#/composables/useFieldPermission', () => ({
  isFieldHidden: () => false,
  useFieldPermission: () => ({
    hiddenFields: ref([]),
    loadHiddenFields: vi.fn(async () => {}),
  }),
}));
vi.mock('#/views/erp/stock/utils/document-columns', () => ({
  useStockDocumentColumns: () => ({
    reload: vi.fn(async () => {}),
    queue: vi.fn(),
    custom: vi.fn(),
    restoreStore: vi.fn(),
  }),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => state.permissions.has(code)),
  }),
}));
vi.mock('@vben/utils', () => ({ downloadFileFromBlobPart: state.download }));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/api/erp/stock/outbill', () => ({
  getStockOutBillPage: state.page,
  getStockOutBillSummary: state.summary,
  exportStockOutBill: state.exportData,
  getStockOutBillExportFields: state.fields,
  STOCK_OUT_BILL_HISTORY_NOTICE: '历史待领需核对；销售审核直接扣库存。',
}));
vi.mock('./data', () => ({
  useGridColumns: () => [],
  useGridFormSchema: () => [],
}));
vi.mock('./modules/detail-modal.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}));
vi.mock('#/views/erp/components/export-field-modal.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}));
vi.mock('#/views/erp/components/ErpActivationRefreshMask.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}));
vi.mock('#/views/erp/utils/activation-refresh', () => ({
  useVxeActivationRefresh: (options: Activation) => {
    state.activation = options;
    return { activationRefreshMaskVisible: ref(false) };
  },
}));
vi.mock('@vben/common-ui', () => {
  const box = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Page: box,
    DocAlert: box,
    useVbenModal: () => {
      const index = state.modalData.length;
      state.modalData.push({});
      const api = {
        setData: (value: Params) => {
          state.modalData[index] = value;
          return api;
        },
        open: () => state.modalOpen(index),
      };
      return [
        defineComponent({
          emits: ['confirm'],
          setup:
            (_, { emit }) =>
            () =>
              index === 1
                ? h(
                    'button',
                    { onClick: () => emit('confirm', ['no', 'totalCount']) },
                    '确认导出字段',
                  )
                : null,
        }),
        api,
      ];
    },
  };
});
vi.mock('ant-design-vue', () => ({
  Alert: defineComponent({
    props: ['message'],
    setup: (p) => () => h('div', p.message),
  }),
  Tag: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  }),
}));
vi.mock('#/adapter/vxe-table', () => ({
  ACTION_ICON: {},
  TableAction: defineComponent({
    props: ['actions'],
    setup: (p) => () =>
      h(
        'div',
        (
          (p.actions || []) as Array<{
            label: string;
            auth: string[];
            onClick: () => void;
          }>
        )
          .filter((a) => a.auth.every((code) => state.permissions.has(code)))
          .map((a) => h('button', { onClick: a.onClick }, a.label)),
      ),
  }),
  useVbenVxeGrid: (options: GridOptions) => {
    state.grid = options;
    const api = {
      query: vi.fn(),
      grid: { getCheckboxRecords: () => state.selection },
      formApi: { getValues: async () => state.values, submitForm: vi.fn() },
    };
    return [
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('section', [slots['toolbar-tools']?.(), slots.bottom?.()]),
      }),
      api,
    ];
  },
}));
const cleanups: Array<() => void> = [];
function mount() {
  const el = document.createElement('div');
  document.body.append(el);
  const app = createApp(History);
  app.mount(el);
  cleanups.push(() => {
    app.unmount();
    el.remove();
  });
  return el;
}
async function flush() {
  for (let n = 0; n < 8; n++) {
    await Promise.resolve();
    await nextTick();
  }
}
function click(el: HTMLElement, label: string) {
  const button = [...el.querySelectorAll('button')].find(
    (b) => b.textContent === label,
  );
  expect(button).toBeTruthy();
  button!.click();
}
beforeEach(() => {
  vi.clearAllMocks();
  state.permissions = reactive(
    new Set(['erp:stock-out-bill:query', 'erp:stock-out-bill:export']),
  );
  state.modalData = [];
  state.values = {};
  state.selection = [];
  state.page.mockResolvedValue({
    list: [{ id: 9, no: 'OLD9', totalCount: 2 }],
    total: 1,
  });
  state.exportData.mockResolvedValue(new Blob(['historical export']));
});
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));

describe('独立：历史出仓实际列表与权限', () => {
  it('query, reset and detail keep historical read behavior without pick actions', async () => {
    const el = mount();
    const query = state.grid!.gridOptions.proxyConfig.ajax.query;
    await query(
      { page: { currentPage: 2, pageSize: 20 } },
      { no: ' OLD9 ', status: 10, empty: '' },
    );
    await flush();
    expect(state.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        no: 'OLD9',
        status: 10,
        pageNo: 2,
        pageSize: 20,
      }),
    );
    expect(el.textContent).toContain('查询汇总');
    expect(state.summary).toHaveBeenCalled();
    expect(el.textContent).toContain('123');
    await query({ page: { currentPage: 1, pageSize: 20 } }, {});
    expect(state.page).toHaveBeenLastCalledWith(
      expect.not.objectContaining({
        no: expect.anything(),
        status: expect.anything(),
      }),
    );
    expect(state.grid!.gridEvents).not.toHaveProperty('cellClick');
    expect(el.textContent).not.toContain('拣货');
  });
  it('export uses chosen ids or normalized filters and rechecks permission before download', async () => {
    const el = mount();
    state.selection = [{ id: 9 }, { id: 10 }];
    click(el, '导出');
    await flush();
    click(el, '确认导出字段');
    await flush();
    expect(state.exportData).toHaveBeenLastCalledWith(
      expect.objectContaining({ ids: '9,10', fields: 'no,totalCount' }),
    );
    expect(state.download).toHaveBeenCalledOnce();
    state.selection = [];
    state.values = { no: ' OLD ', status: 10, blank: '' };
    click(el, '导出');
    await flush();
    state.permissions.delete('erp:stock-out-bill:export');
    click(el, '确认导出字段');
    await flush();
    expect(state.exportData).toHaveBeenCalledOnce();
  });
  it('pick-only cannot query either grid refresh or activation refresh', async () => {
    state.permissions = reactive(new Set(['erp:stock-out-bill:pick']));
    const el = mount();
    expect(
      await state.grid!.gridOptions.proxyConfig.ajax.query(
        { page: { currentPage: 1, pageSize: 20 } },
        {},
      ),
    ).toEqual({ list: [], total: 0 });
    await state.activation!.queryPage({ pageNo: 1, pageSize: 20 });
    await flush();
    expect(state.page).not.toHaveBeenCalled();
    expect(el.textContent).toContain('没有历史出仓单查询权限');
  });
  it('activation result arriving after query permission revocation cannot restore page totals', async () => {
    const el = mount();
    let resolve!: (value: { list: Params[]; total: number }) => void;
    state.page.mockReturnValueOnce(
      new Promise<{ list: Params[]; total: number }>((done) => {
        resolve = done;
      }),
    );
    const request = state.activation!.queryPage({ pageNo: 1, pageSize: 20 });
    await flush();
    state.permissions.delete('erp:stock-out-bill:query');
    resolve({ list: [{ id: 77, totalCount: 888 }], total: 1 });
    const result = await request;
    expect(result).toEqual({ list: [], total: 0 });
    await state.activation!.onSuccess([{ id: 77, totalCount: 888 }]);
    await flush();
    expect(el.textContent).toContain('查询汇总');
    expect(el.textContent).not.toContain('888');
  });
});
