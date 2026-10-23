/* eslint-disable vue/one-component-per-file -- Isolated behavior fixtures. */
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import SupplierItemGrid from './modules/supplier-item-grid.vue';
import { normalizeSupplierEditor } from './utils/editor-numbers';
import { useSupplierFormKeyboard } from './utils/form-keyboard';

const state = vi.hoisted(() => ({
  options: {} as any,
  grid: {} as any,
  rows: [] as any[],
  error: undefined as any,
}));
vi.mock('#/adapter/vxe-table', async () => {
  const { defineComponent, h, onMounted } = await import('vue');
  return {
    useVbenVxeGrid: (options: any) => {
      state.options = options;
      const pager = { currentPage: 1, pageSize: 20, total: 0 };
      let mounted = false;
      let columns = options.gridOptions.columns;
      const api = {
        grid: {
          getFullColumns: () => columns,
          getProxyInfo: () => ({ pager }),
          reloadColumn: async (value: any) => {
            columns = value;
          },
          recalculate: vi.fn(),
          showColumn: vi.fn(),
          hideColumn: vi.fn(),
          setColumnFixed: vi.fn(),
        },
        setGridOptions: (value: any) => {
          if (value.pagerConfig) Object.assign(pager, value.pagerConfig);
        },
        query: async () => {
          try {
            if (!mounted) throw new Error('Grid not mounted');
            const result = await options.gridOptions.proxyConfig.ajax.query({
              page: pager,
            });
            state.rows = result.list;
            pager.total = result.total;
          } catch (error) {
            state.error = error;
          }
        },
      };
      state.grid = api;
      return [
        defineComponent({
          setup() {
            onMounted(() => {
              mounted = true;
            });
            return () => h('div');
          },
        }),
        api,
      ];
    },
  };
});
const cleanup: Array<() => void> = [];
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn());
  vi.useRealTimers();
  state.rows = [];
  state.error = undefined;
});
function mount(component: any, props: any = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp(component, props);
  const instance = app.mount(root);
  cleanup.push(() => {
    app.unmount();
    root.remove();
  });
  return { root, instance };
}
async function settle() {
  for (let i = 0; i < 8; i += 1) await nextTick();
}
function enter(input: Element, extra: KeyboardEventInit = {}) {
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      ...extra,
    }),
  );
}

describe('supplier form keyboard ownership', () => {
  async function keyboardFixture(editable = true, hideFirst = false) {
    vi.useFakeTimers();
    let keyboard: ReturnType<typeof useSupplierFormKeyboard> | undefined;
    const flags = reactive({ ready: false, editable });
    const fixture = defineComponent({
      setup() {
        const instanceKeyboard = useSupplierFormKeyboard(
          () => flags.editable,
          () => flags.ready,
        );
        keyboard = instanceKeyboard;
        return () =>
          h('div', { role: 'dialog' }, [
            h(
              'div',
              {
                ref: instanceKeyboard.formScope,
                onKeydownCapture: instanceKeyboard.handleFormEnter,
              },
              [
                h('section', [
                  h('input', { 'data-field': 'name', disabled: hideFirst }),
                  h('input', { readonly: true }),
                  h('input', { 'data-field': 'basic' }),
                ]),
                h('section', [h('input', { 'data-field': 'invoice' })]),
                h('section', [h('input', { 'data-field': 'finance' })]),
              ],
            ),
          ]);
      },
    });
    const { root } = mount(fixture);
    if (!keyboard) throw new Error('Keyboard fixture not mounted');
    const mountedKeyboard = keyboard;
    mountedKeyboard.beginOpen();
    mountedKeyboard.onOpened();
    await vi.advanceTimersByTimeAsync(80);
    expect(root.contains(document.activeElement)).toBe(false);
    flags.ready = true;
    mountedKeyboard.queueFocus();
    await vi.advanceTimersByTimeAsync(80);
    return { root, keyboard: mountedKeyboard, flags };
  }

  it('waits for hydration, focuses once, crosses three sections and never submits at the end', async () => {
    const { root, keyboard } = await keyboardFixture();
    expect((document.activeElement as HTMLElement).dataset.field).toBe('name');
    const basic = root.querySelector('[data-field="basic"]') as HTMLElement;
    enter(document.activeElement as HTMLElement);
    expect(document.activeElement).toBe(basic);
    enter(basic);
    expect((document.activeElement as HTMLElement).dataset.field).toBe(
      'invoice',
    );
    keyboard.queueFocus();
    keyboard.onOpened();
    await vi.advanceTimersByTimeAsync(80);
    expect((document.activeElement as HTMLElement).dataset.field).toBe(
      'invoice',
    );
    enter(document.activeElement as HTMLElement);
    expect((document.activeElement as HTMLElement).dataset.field).toBe(
      'finance',
    );
    const last = document.activeElement;
    enter(last as HTMLElement);
    expect(document.activeElement).toBe(last);
  });

  it('skips a hidden/disabled first field and leaves readonly mode alone', async () => {
    const fixture = await keyboardFixture(true, true);
    expect((document.activeElement as HTMLElement).dataset.field).toBe('basic');
    fixture.keyboard.endOpen();
    fixture.flags.editable = false;
    (document.activeElement as HTMLElement).blur();
    fixture.keyboard.beginOpen();
    fixture.keyboard.onOpened();
    await vi.advanceTimersByTimeAsync(80);
    expect(fixture.root.contains(document.activeElement)).toBe(false);
  });

  it('preserves IME and dropdown confirmation, stops duplicate Enter and focuses again only on reopen', async () => {
    const { root, keyboard } = await keyboardFixture();
    const input = document.activeElement as HTMLElement;
    enter(input, { isComposing: true });
    expect(document.activeElement).toBe(input);
    const dropdown = document.createElement('div');
    dropdown.className = 'ant-select-dropdown';
    document.body.append(dropdown);
    enter(input);
    expect(document.activeElement).toBe(input);
    dropdown.remove();
    const handler = vi.fn();
    input.addEventListener('keydown', handler);
    enter(input);
    expect(handler).not.toHaveBeenCalled();
    keyboard.endOpen();
    keyboard.beginOpen();
    keyboard.onOpened();
    await vi.advanceTimersByTimeAsync(80);
    expect(document.activeElement).toBe(
      root.querySelector('[data-field="name"]'),
    );
  });
});

describe('supplier collection paging', () => {
  it('loads an initially active tab once after its grid mounts', async () => {
    const api = vi.fn().mockResolvedValue({ list: [{ id: 31 }], total: 1 });
    mount(SupplierItemGrid, {
      active: true,
      supplierId: 3,
      api,
      canMaintain: true,
      gridKey: 'contacts',
      columns: [{ dataIndex: 'name', title: 'Name' }],
    });
    await settle();
    expect(api).toHaveBeenCalledExactlyOnceWith({
      supplierId: 3,
      pageNo: 1,
      pageSize: 20,
    });
    expect(state.error).toBeUndefined();
    expect(state.rows).toEqual([{ id: 31 }]);
    expect(state.options.tableTitle).toBeTruthy();
  });
  it('loads only the active tab, keeps database pagination and backs off an emptied last page', async () => {
    const api = vi.fn().mockResolvedValue({ list: [{ id: 1 }], total: 21 });
    const props = reactive({
      active: false,
      supplierId: 7,
      api,
      canMaintain: true,
      gridKey: 'contacts',
      columns: [
        { dataIndex: 'name', title: 'Name' },
        { dataIndex: 'actions', title: 'Actions' },
      ],
    });
    let grid: any;
    mount(
      defineComponent({
        setup: () => () =>
          h(SupplierItemGrid, {
            ...props,
            ref: (value) => {
              grid = value;
            },
          }),
      }),
    );
    await settle();
    expect(api).not.toHaveBeenCalled();
    props.active = true;
    await settle();
    expect(api).toHaveBeenLastCalledWith({
      supplierId: 7,
      pageNo: 1,
      pageSize: 20,
    });
    state.grid.setGridOptions({ pagerConfig: { currentPage: 2 } });
    await state.grid.query();
    await grid.refreshCurrent(true);
    expect(api).toHaveBeenLastCalledWith({
      supplierId: 7,
      pageNo: 1,
      pageSize: 20,
    });
  });

  it('does not let a previous supplier response overwrite the new supplier and hides actions for query-only users', async () => {
    let finish: (value: any) => void = () => {};
    const api = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue({ list: [{ id: 22 }], total: 1 });
    const props = reactive({
      active: true,
      supplierId: 1,
      api,
      canMaintain: false,
      gridKey: 'accounts',
      columns: [
        { dataIndex: 'name', title: 'Name' },
        { dataIndex: 'actions', title: 'Actions' },
      ],
    });
    mount(defineComponent({ setup: () => () => h(SupplierItemGrid, props) }));
    await settle();
    props.supplierId = 2;
    await settle();
    finish({ list: [{ id: 11 }], total: 1 });
    await settle();
    expect(state.rows).toEqual([{ id: 22 }]);
    expect(
      state.grid.grid
        .getFullColumns()
        .find((column: any) => column.field === 'actions')?.visible,
    ).toBe(false);
  });
});

describe('supplier editor numeric contracts', () => {
  it('preserves text identifiers, zero, allowed signs and original two-decimal quantity precision', () => {
    const result = normalizeSupplierEditor('contract', {
      contractNo: '00001',
      contractDate: '2026-10-23',
      baseAmount: '-1.20',
      taskAmount: '1.23',
      cardNo: '000000123',
      sort: '0',
    });
    expect(result).toMatchObject({
      contractNo: '00001',
      cardNo: '000000123',
      baseAmount: -1.2,
      taskAmount: 1.23,
      sort: 0,
    });
  });
  it('rejects unfinished input, fractional integers, invalid months and excessive money decimals', () => {
    for (const amount of ['-', '.', '1e2', '1.234'])
      expect(() =>
        normalizeSupplierEditor('bill', { billNo: '1', amount }),
      ).toThrow();
    expect(() =>
      normalizeSupplierEditor('task', {
        year: '2026',
        month: '13',
        taskAmount: 1,
      }),
    ).toThrow();
    expect(() =>
      normalizeSupplierEditor('extend', { extendKey: 'key', sort: '1.5' }),
    ).toThrow();
  });
});
