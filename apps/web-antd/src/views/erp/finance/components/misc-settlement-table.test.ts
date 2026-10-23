import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SettlementTable from './misc-settlement-table.vue';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  access: true,
  table: undefined as any,
}));
vi.mock('#/api/erp/finance/misc-settlement', () => ({
  getMiscSettlementPage: state.query,
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => state.access }),
}));
vi.mock('@vben/utils', () => ({
  erpPriceInputFormatter: String,
  formatDateTime: String,
}));
vi.mock('ant-design-vue', () => ({
  Alert: defineComponent({
    props: ['message'],
    setup: (p) => () => h('aside', String(p.message)),
  }),
  Button: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('button', slots.default?.()),
  }),
  Table: defineComponent({
    props: ['dataSource', 'columns', 'pagination', 'loading'],
    emits: ['change'],
    setup(props, { slots, emit }) {
      state.table = { props, emit };
      return () =>
        h(
          'div',
          (props.dataSource as any[]).flatMap((record) =>
            (props.columns as any[]).map((column) =>
              slots.bodyCell?.({
                column,
                record,
                text: record[column.dataIndex],
              }),
            ),
          ),
        );
    },
  }),
}));

let app: ReturnType<typeof createApp>;
let host: HTMLDivElement;
const flush = async () => {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
};

beforeEach(() => {
  state.query.mockReset();
  state.access = true;
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => {
  app?.unmount();
  host.remove();
});

describe('原单结算明细', () => {
  it('loads a bounded page and sends subsequent pagination to the server', async () => {
    state.query.mockResolvedValue({ list: [], total: 60 });
    app = createApp(SettlementTable, {
      id: 1,
      direction: 'receivable',
      revision: 0,
    });
    app.mount(host);
    await flush();
    expect(state.query).toHaveBeenCalledWith('receivable', {
      id: 1,
      pageNo: 1,
      pageSize: 20,
    });
    state.table.emit('change', { current: 2, pageSize: 20 });
    await flush();
    expect(state.query).toHaveBeenLastCalledWith('receivable', {
      id: 1,
      pageNo: 2,
      pageSize: 20,
    });
    expect(state.table.props.pagination.total).toBe(60);
  });

  it('does not render hidden amounts as zero or allow document links without permission', async () => {
    state.access = false;
    state.query.mockResolvedValue({
      list: [{ documentId: 2, no: 'SK001', amount: null, status: 20 }],
      total: 1,
    });
    app = createApp(SettlementTable, {
      id: 1,
      direction: 'payable',
      revision: 0,
    });
    app.mount(host);
    await flush();
    expect(host.querySelector('a')).toBeNull();
    expect(host.textContent).toContain('SK001');
    expect(host.textContent).toContain('—');
    expect(host.textContent).not.toContain('0.00');
  });

  it('ignores a stale first-page response after moving to the second page', async () => {
    let resolveOld!: (value: unknown) => void;
    state.query.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    state.query.mockResolvedValueOnce({
      list: [{ documentId: 3, no: 'NEW' }],
      total: 30,
    });
    app = createApp(SettlementTable, {
      id: 1,
      direction: 'receivable',
      revision: 0,
    });
    app.mount(host);
    state.table.emit('change', { current: 2, pageSize: 20 });
    await flush();
    resolveOld({ list: [{ documentId: 2, no: 'OLD' }], total: 30 });
    await flush();
    expect(host.textContent).toContain('NEW');
    expect(host.textContent).not.toContain('OLD');
  });

  it('clears stale records and shows an explicit error when loading fails', async () => {
    state.query.mockRejectedValue(new Error('network'));
    app = createApp(SettlementTable, {
      id: 1,
      direction: 'receivable',
      revision: 0,
    });
    app.mount(host);
    await flush();
    expect(host.textContent).toContain('明细加载失败');
    expect(state.table.props.dataSource).toEqual([]);
    expect(state.table.props.loading).toBe(false);
  });
});
