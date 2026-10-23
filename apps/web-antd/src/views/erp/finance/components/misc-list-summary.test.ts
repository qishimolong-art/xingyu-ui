/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- lightweight UI test stubs */
import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PayablePage from '../payable/misc/index.vue';
import ReceivablePage from '../receivable/misc/index.vue';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  refresh: vi.fn(),
  updateFooter: vi.fn(),
  clearSelection: vi.fn(),
  grid: undefined as any,
  activation: undefined as any,
  modalEmit: undefined as any,
  actions: [] as any[],
  remove: vi.fn(),
  audit: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('main', slots.default?.()),
  }),
  useVbenModal: () => [
    defineComponent({
      emits: ['success', 'audit'],
      setup: (_, { emit }) => {
        state.modalEmit ??= emit;
        return () => null;
      },
    }),
    { setData: () => ({ open: vi.fn() }) },
  ],
}));
vi.mock('@vben/utils', () => ({ downloadFileFromBlobPart: vi.fn() }));
vi.mock('ant-design-vue', () => ({
  Modal: { confirm: state.confirm },
  message: { loading: () => vi.fn(), success: vi.fn(), warning: vi.fn() },
  Tag: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('span', slots.default?.()),
  }),
}));
vi.mock('#/adapter/vxe-table', () => ({
  ACTION_ICON: {},
  TableAction: defineComponent({
    props: ['actions'],
    setup: (props) => () => {
      state.actions = props.actions as any[];
      return null;
    },
  }),
  useVbenVxeGrid: (options: any) => {
    state.grid = options;
    return [
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('section', [slots['toolbar-tools']?.(), slots.bottom?.()]),
      }),
      {
        query: state.refresh,
        formApi: { getValues: async () => ({}) },
        grid: {
          updateFooter: state.updateFooter,
          clearCheckboxRow: state.clearSelection,
          clearCheckboxReserve: vi.fn(),
        },
      },
    ];
  },
}));
vi.mock('#/api/erp/finance/receivable/misc', () => ({
  getReceivableMiscPage: state.query,
  deleteReceivableMisc: state.remove,
  updateReceivableMiscStatus: state.audit,
  exportReceivableMisc: vi.fn(),
  getReceivableMiscImportTemplate: vi.fn(),
  importReceivableMisc: vi.fn(),
}));
vi.mock('#/api/erp/finance/payable/misc', () => ({
  getPayableMiscPage: state.query,
  deletePayableMisc: state.remove,
  updatePayableMiscStatus: state.audit,
  exportPayableMisc: vi.fn(),
  getPayableMiscImportTemplate: vi.fn(),
  importPayableMisc: vi.fn(),
}));
vi.mock('../receivable/misc/data', () => ({
  RECEIVABLE_MISC_SORT_FIELD_MAP: {},
  useGridColumns: () => [],
  useGridFormSchema: () => [],
}));
vi.mock('../payable/misc/data', () => ({
  PAYABLE_MISC_SORT_FIELD_MAP: {},
  useGridColumns: () => [],
  useGridFormSchema: () => [],
}));
vi.mock('../receivable/misc/modules/form.vue', () => ({ default: {} }));
vi.mock('../payable/misc/modules/form.vue', () => ({ default: {} }));
vi.mock('./import-modal.vue', () => ({ default: {} }));
vi.mock('#/views/erp/components/ErpActivationRefreshMask.vue', () => ({
  default: { render: () => null },
}));
vi.mock('#/views/erp/components/PrintTemplateModal.vue', () => ({
  default: {},
}));
vi.mock('#/views/erp/components/PrintTemplateSelector.vue', () => ({
  default: { render: () => null },
}));
vi.mock('#/views/erp/composables/useFinanceShortcut', () => ({
  useFinanceShortcut: vi.fn(),
}));
vi.mock('../utils/keyword-search-focus', () => ({
  queueFocusFinanceKeywordSearchInput: vi.fn(),
}));
vi.mock('#/views/erp/utils/form-defaults', () => ({
  withErpKeywordSearchSchema: (schema: any) => schema,
}));
vi.mock('#/views/erp/utils/print-template', () => ({
  useErpPrintTemplate: () => ({}),
}));
vi.mock('#/views/erp/utils/vxe-header-sort', () => ({
  createVxeHeaderSort: () => ({
    buildSortParams: () => ({ sortField: 'amount', sortOrder: 'desc' }),
    handleSortChange: vi.fn(),
    restoreSortState: vi.fn(),
  }),
}));
vi.mock('#/views/erp/utils/activation-refresh', () => ({
  useVxeActivationRefresh: (options: any) => {
    state.activation = options;
    return { activationRefreshMaskVisible: ref(false) };
  },
}));

let app: ReturnType<typeof createApp>;
let host: HTMLDivElement;
const data = (amount = 1000) => ({
  id: 1,
  amount,
  settledAmount: 300,
  balanceAmount: 700,
  pendingTransferAmount: 200,
  transferAvailableAmount: 500,
});
async function load(rows = [data()], pageNo = 1, filters = {}) {
  state.query.mockResolvedValueOnce({ list: rows, total: 100 });
  const ajax = state.grid.gridOptions.proxyConfig.ajax;
  const response = await ajax.query(
    { page: { currentPage: pageNo, pageSize: 20 } },
    filters,
  );
  ajax.querySuccess({ response });
  await nextTick();
}

beforeEach(() => {
  vi.clearAllMocks();
  state.query.mockReset();
  state.modalEmit = undefined;
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => {
  app?.unmount();
  host.remove();
});

describe.each([
  ['其他应收', ReceivablePage, '已收金额'],
  ['其他应付', PayablePage, '已付金额'],
] as const)('%s列表合计接线', (_title, component, settledLabel) => {
  beforeEach(() => {
    app = createApp(component);
    app.mount(host);
  });

  it('renders five totals and aligns the existing three amount columns', async () => {
    expect(host.textContent).toContain('原金额：—');
    await load();
    expect(host.textContent).toContain('本页合计');
    expect(host.textContent).toContain('原金额：1,000.00');
    expect(host.textContent).toContain(`${settledLabel}：300.00`);
    expect(host.textContent).toContain('剩余金额：700.00');
    expect(host.textContent).toContain('待审批占用：200.00');
    expect(host.textContent).toContain('剩余可转金额：500.00');
    expect(state.grid.gridOptions.showFooter).toBe(true);
    expect(
      state.grid.gridOptions.footerMethod({
        columns: [
          { field: 'no' },
          { field: 'amount' },
          { field: 'settledAmount' },
          { field: 'balanceAmount' },
        ],
      }),
    ).toEqual([['小计', '1,000.00', '300.00', '700.00']]);
    expect(state.updateFooter).toHaveBeenCalled();
  });

  it('updates with pagination/filtering/reset and ignores selection changes', async () => {
    await load([data(), data(500)]);
    state.grid.gridEvents.checkboxChange({ records: [data()] });
    await nextTick();
    expect(host.textContent).toContain('原金额：1,500.00');
    state.grid.gridEvents.checkboxAll({ records: [] });
    await load([data(2000)], 2, { status: 20 });
    expect(state.query).toHaveBeenLastCalledWith({
      pageNo: 2,
      pageSize: 20,
      status: 20,
      sortField: 'amount',
      sortOrder: 'desc',
    });
    expect(host.textContent).toContain('原金额：2,000.00');
    await load([], 1);
    expect(host.textContent).toContain('原金额：0.00');
  });

  it('updates through activation refresh and clears selections', async () => {
    await load();
    state.query.mockResolvedValueOnce({ list: [data(3000)], total: 1 });
    const result = await state.activation.queryPage({
      pageNo: 1,
      pageSize: 20,
    });
    state.activation.onSuccess(result.list, result);
    await nextTick();
    expect(host.textContent).toContain('原金额：3,000.00');
    expect(state.clearSelection).toHaveBeenCalled();
  });

  it('keeps form success, approval and batch deletion wired to list refresh', async () => {
    await load();
    state.modalEmit('success');
    expect(state.refresh).toHaveBeenCalledTimes(1);
    state.modalEmit('audit', { id: 1, no: 'TEST' });
    const confirmation = state.confirm.mock.calls[0]?.[0];
    if (!confirmation) throw new Error('Approval confirmation was not opened');
    await confirmation.onOk();
    expect(state.audit).toHaveBeenCalledWith(1, 20);
    state.grid.gridEvents.checkboxChange({
      records: [{ ...data(), status: 10 }],
    });
    await nextTick();
    await state.actions
      .find((action) => action.label === '批量删除')
      .popConfirm.confirm();
    expect(state.remove).toHaveBeenCalledWith(1);
    expect(state.refresh).toHaveBeenCalledTimes(3);
    await load([data(600)]);
    expect(host.textContent).toContain('原金额：600.00');
  });
});
