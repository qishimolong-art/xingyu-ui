/* eslint-disable @typescript-eslint/no-non-null-assertion -- Test fixtures guarantee these rows and elements. */
/* Lightweight UI doubles intentionally share this test module. */
/* eslint-disable vue/one-component-per-file, vue/require-prop-types */
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PurchaseInlineStockSelect from './PurchaseInlineStockSelect.vue';

const api = vi.hoisted(() => ({
  page: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));
vi.mock('#/api/erp/stock/stock', () => ({ getPurchaseStockPage: api.page }));
vi.mock('#/composables/useFieldPermission', () => ({
  isFieldHidden: (fields: string[], field: string) => fields.includes(field),
}));
vi.mock('@vben/utils', () => ({
  erpCountInputFormatter: (value: unknown) => {
    if (value === null || value === undefined || value === '') return '';
    const numberValue = Number(value);
    return Number.isFinite(numberValue)
      ? numberValue.toFixed(3).replace(/\.?0+$/, '')
      : '';
  },
  erpPriceInputFormatter: (value: unknown) => {
    if (value === null || value === undefined || value === '') return '';
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue.toFixed(2) : '';
  },
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { id: 'column-test' } }),
  useAccessStore: () => ({ tenantId: 1 }),
}));
vi.mock('ant-design-vue', () => ({
  Select: defineComponent({
    props: ['value', 'options'],
    emits: ['change', 'dropdownVisibleChange'],
    setup:
      (props, { emit }) =>
      () =>
        h(
          'select',
          {
            value: props.value,
            onFocus: () => emit('dropdownVisibleChange', true),
            onBlur: () => emit('dropdownVisibleChange', false),
            onChange: (event: Event) =>
              emit('change', Number((event.target as HTMLSelectElement).value)),
          },
          props.options.map((option: { value: number; label: string }) =>
            h('option', { value: option.value }, option.label),
          ),
        ),
  }),
  Modal: defineComponent({
    props: ['open', 'afterClose'],
    emits: ['cancel'],
    setup: (props, { slots }) => {
      watch(
        () => props.open,
        (open) => {
          if (!open) void nextTick(() => props.afterClose?.());
        },
      );
      return () => {
        if (!props.open) return null;
        const originVNode = h('section', { role: 'dialog' }, [
          slots.default?.(),
          slots.footer?.(),
        ]);
        return slots.modalRender?.({ originVNode }) ?? originVNode;
      };
    },
  }),
  Checkbox: defineComponent({
    props: ['checked', 'indeterminate'],
    emits: ['update:checked', 'change'],
    setup:
      (props, { emit, slots }) =>
      () =>
        h('label', [
          h('input', {
            type: 'checkbox',
            checked: props.checked,
            onChange: (event: Event) => {
              emit(
                'update:checked',
                (event.target as HTMLInputElement).checked,
              );
              emit('change', event);
            },
          }),
          slots.default?.(),
        ]),
  }),
  InputNumber: defineComponent({
    props: ['value'],
    emits: ['update:value'],
    setup:
      (props, { emit }) =>
      () =>
        h('input', {
          type: 'number',
          value: props.value,
          onInput: (event: Event) =>
            emit(
              'update:value',
              Number((event.target as HTMLInputElement).value),
            ),
        }),
  }),
  RadioGroup: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  }),
  RadioButton: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('span', slots.default?.()),
  }),
  message: { warning: api.warning, error: api.error },
  Button: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('button', slots.default?.()),
  }),
  Spin: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  }),
  Input: defineComponent({
    props: ['value'],
    emits: ['update:value'],
    setup:
      (props, { emit }) =>
      () =>
        h('input', {
          value: props.value,
          onInput: (event: Event) =>
            emit('update:value', (event.target as HTMLInputElement).value),
        }),
  }),
  Popover: defineComponent({
    props: ['open', 'placement', 'autoAdjustOverflow', 'overlayClassName'],
    emits: ['openChange'],
    setup(props, { emit, slots }) {
      const root = ref<HTMLElement>();
      const handleDocumentMouseDown = (event: MouseEvent) => {
        const target = event.target;
        if (
          props.open &&
          root.value &&
          target instanceof HTMLElement &&
          target.closest('[data-test-teleported-popover-content]') &&
          !root.value.contains(target)
        ) {
          emit('openChange', false);
        }
      };
      onMounted(() => {
        document.addEventListener('mousedown', handleDocumentMouseDown, true);
      });
      onBeforeUnmount(() => {
        document.removeEventListener(
          'mousedown',
          handleDocumentMouseDown,
          true,
        );
      });
      return () =>
        h(
          'div',
          {
            ref: root,
            'data-placement': props.placement,
            'data-overflow': JSON.stringify(props.autoAdjustOverflow),
          },
          [
            slots.default?.(),
            props.open ||
            props.overlayClassName === 'inline-stock-header-filter-popover'
              ? slots.content?.()
              : undefined,
          ],
        );
    },
  }),
  Pagination: defineComponent({
    props: ['current', 'pageSize', 'total'],
    emits: ['change'],
    setup:
      (props, { emit }) =>
      () =>
        h(
          'button',
          {
            'data-page-size': props.pageSize,
            onClick: () => emit('change', props.current + 1, 10),
          },
          '下一页',
        ),
  }),
}));

const rows = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  productId: index + 1,
  productName: `配件${index + 1}`,
  productPurchasePrice: 99,
}));
const cleanups: Array<() => void> = [];
beforeEach(() => {
  vi.useFakeTimers();
  api.page.mockResolvedValue({ list: rows, total: 12 });
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.clearAllMocks();
  vi.useRealTimers();
});
async function flush() {
  await nextTick();
  await vi.advanceTimersByTimeAsync(350);
  await nextTick();
}
function mount(props = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const selected = vi.fn();
  const app = createApp(PurchaseInlineStockSelect, {
    settingsScope: 'purchase-order',
    deptId: 1,
    row: { id: 100 },
    onSelect: selected,
    ...props,
  });
  const vm = app.mount(host) as InstanceType<typeof PurchaseInlineStockSelect>;
  cleanups.push(() => {
    app.unmount();
    host.remove();
  });
  const input = host.querySelector('input');
  if (!input) throw new Error('Missing stock input');
  const key = async (value: string) => {
    const target =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : document.body;
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: value, bubbles: true }),
    );
    await flush();
  };
  const active = () =>
    host.querySelector('.purchase-inline-stock-select-row--active');
  return { active, host, input, key, selected, vm };
}

function clickButton(host: HTMLElement, label: string) {
  [...host.querySelectorAll('button')]
    .find((button) => button.textContent?.trim() === label)!
    .click();
}

describe('purchase inline stock picker', () => {
  it('moves the active candidate on pointer movement without selecting or stealing focus', async () => {
    const { host, input, active, key, vm, selected } = mount();
    input.focus();
    await flush();
    const rows = host.querySelectorAll('tbody tr');
    rows[1]!.dispatchEvent(new Event('pointermove', { bubbles: true }));
    await flush();
    expect(active()).toBe(rows[1]);
    expect(document.activeElement).toBe(input);
    expect(host.querySelectorAll('tbody input:checked')).toHaveLength(0);
    expect(selected).not.toHaveBeenCalled();
    await key('ArrowDown');
    expect(active()).toBe(rows[2]);
    await key('Insert');
    expect(rows[2]!.querySelector('input')!.checked).toBe(true);
    vm.close();
  });
  it('keeps the row key on the focusable input and opens when focused', async () => {
    const { active, input } = mount({ rowKey: 'purchase-in-row-2' });

    expect(input.getAttribute('data-purchase-inline-stock-row-key')).toBe(
      'purchase-in-row-2',
    );
    input.focus();
    await flush();

    expect(document.activeElement).toBe(input);
    expect(api.page).toHaveBeenCalledTimes(1);
    expect(active()?.textContent).toContain('配件1');
  });

  it('removes quantity trailing zeros while keeping prices at two decimals', async () => {
    api.page.mockResolvedValueOnce({
      list: [
        {
          ...rows[0],
          count: '3.000',
          availableCount: '0.000',
          occupiedCount: '0.500',
          pendingInCount: '1.250',
          inTransitCount: '-2.500',
          productPurchasePrice: 20,
          salePrice: 20.5,
        },
      ],
      total: 1,
    });
    const { host, vm } = mount();
    vm.open();
    await flush();
    const text = (field: string) =>
      host.querySelector(`tbody [data-field="${field}"]`)?.textContent?.trim();

    expect(text('count')).toBe('3');
    expect(text('availableCount')).toBe('0');
    expect(text('occupiedCount')).toBe('0.5');
    expect(text('pendingInCount')).toBe('1.25');
    expect(text('inTransitCount')).toBe('-2.5');
    expect(text('productPurchasePrice')).toBe('20.00');
    expect(text('salePrice')).toBe('20.50');
  });

  it('uses ten rows for open, paging, search and reopen, and cannot flip upwards', async () => {
    const { host, input, vm } = mount();
    vm.open();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderDirection: 'desc',
        orderField: 'count',
        pageNo: 1,
        pageSize: 10,
        deptId: 1,
      }),
    );
    expect(
      host.querySelector<HTMLElement>('[data-placement="bottomLeft"]')?.dataset
        .overflow,
    ).toBe('{"adjustX":1,"adjustY":0}');
    host.querySelector<HTMLButtonElement>('[data-page-size]')?.click();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 2, pageSize: 10 }),
    );
    input.value = '配件';
    input.dispatchEvent(new Event('input'));
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageNo: 1,
        pageSize: 10,
        productCodeNameKeyword: '配件',
      }),
    );
    vm.close();
    vm.open();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 1, pageSize: 10 }),
    );
  });

  it('changes and remembers page size, resets selection, and keeps selector keys isolated', async () => {
    const { active, host, key, vm } = mount();
    vm.open();
    await flush();
    host.querySelector<HTMLInputElement>('tbody input')!.click();
    const selector = host.querySelector<HTMLSelectElement>(
      '[data-inline-stock-page-size]',
    )!;
    expect([...selector.options].map((option) => Number(option.value))).toEqual(
      [5, 10, 20, 50],
    );
    selector.focus();
    const activeText = active()?.textContent;
    await key('ArrowDown');
    expect(active()?.textContent).toBe(activeText);
    const nativeOptionSurface = document.createElement('div');
    nativeOptionSurface.dataset.testTeleportedPopoverContent = 'true';
    document.body.append(nativeOptionSurface);
    nativeOptionSurface.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true }),
    );
    nativeOptionSurface.remove();
    expect(vm.isOpen()).toBe(true);
    selector.value = '50';
    selector.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 1, pageSize: 50 }),
    );
    expect(host.querySelectorAll('tbody input:checked')).toHaveLength(0);
    expect(active()?.textContent).toContain('配件1');
    expect(
      localStorage.getItem(
        'xingyu-erp:inline-stock-page-size:v1:1:column-test',
      ),
    ).toBe('50');
    vm.close();
    vm.open();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 1, pageSize: 50 }),
    );
    const reopenedSelector = host.querySelector<HTMLSelectElement>(
      '[data-inline-stock-page-size]',
    )!;
    reopenedSelector.value = '10';
    reopenedSelector.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
  });

  it('sends the inline input as a product-code-or-name keyword', async () => {
    const { input, vm } = mount();
    vm.open();
    await flush();
    input.value = '经典表现 530';
    input.dispatchEvent(new Event('input'));
    await flush();
    expect(input.placeholder).toBe('配件编码/名称（支持空格组合搜索）');
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        deptId: 1,
        productCodeNameKeyword: '经典表现 530',
        pageNo: 1,
      }),
    );
    const lastRequest = api.page.mock.calls.at(-1)?.[0];
    expect(lastRequest).not.toHaveProperty('keyword');
    expect(lastRequest).not.toHaveProperty('productKeyword');
    expect(lastRequest).not.toHaveProperty('productNameKeyword');
    expect(lastRequest).not.toHaveProperty('crossDimensionKeyword');
  });

  it('filters multiple columns and uses server sorting with count descending by default', async () => {
    const { active, host, key, vm } = mount();
    vm.open();
    await flush();
    const applyFilter = async (field: string, value: string) => {
      const panel = host.querySelector<HTMLElement>(
        `[data-inline-stock-filter-field="${field}"]`,
      )!;
      const input = panel.querySelector<HTMLInputElement>('input')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.focus();
      const activeText = active()?.textContent;
      await key('ArrowDown');
      expect(active()?.textContent).toBe(activeText);
      clickButton(panel, '筛选');
      await flush();
      expect(document.activeElement).toBe(
        host.querySelector('.purchase-inline-stock-select-table-wrap'),
      );
    };
    await applyFilter('warehouseName', '甘孜');
    await applyFilter('deptName', '兴宇路通');
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        warehouseName: '甘孜',
        deptName: '兴宇路通',
        orderDirection: 'desc',
        orderField: 'count',
        pageNo: 1,
      }),
    );
    host
      .querySelector<HTMLElement>(
        '[data-inline-stock-header-field="warehouseName"]',
      )!
      .click();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderDirection: 'asc',
        orderField: 'warehouseName',
        pageNo: 1,
      }),
    );
  });

  it('keeps one active row across keyboard, checkbox and page changes; Insert/Enter still select', async () => {
    const { active, host, key, selected, vm } = mount();
    vm.open();
    await flush();
    expect(active()?.textContent).toContain('配件1');
    await key('ArrowUp');
    expect(active()?.textContent).toContain('配件5');
    await key('ArrowDown');
    expect(active()?.textContent).toContain('配件1');
    const checks = host.querySelectorAll<HTMLInputElement>('tbody input');
    checks[2]?.click();
    await flush();
    expect(document.activeElement).toBe(
      host.querySelector('.purchase-inline-stock-select-table-wrap'),
    );
    expect(active()?.textContent).toContain('配件3');
    expect(
      host.querySelectorAll('.purchase-inline-stock-select-row--active'),
    ).toHaveLength(1);
    await key('ArrowRight');
    expect(active()?.textContent).toContain('配件1');
    await key('Insert');
    await key('Enter');
    expect(selected).toHaveBeenCalledWith([rows[0]], { id: 100 });
    expect(vm.isOpen()).toBe(false);
  });

  it('handles short pages, empty results, query errors and hidden prices', async () => {
    api.page.mockResolvedValueOnce({ list: rows.slice(0, 2), total: 2 });
    const { host, vm, key, selected } = mount({
      hiddenFields: ['item_productPurchasePrice'],
    });
    vm.open();
    await flush();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(host.querySelector('tbody')?.textContent).toContain('****');
    await key('ArrowRight');
    expect(api.page).toHaveBeenCalledTimes(1);
    vm.close();
    api.page.mockResolvedValueOnce({ list: [], total: 0 });
    vm.open();
    await flush();
    expect(host.textContent).toContain('暂无库存数据');
    await key('Enter');
    expect(selected).not.toHaveBeenCalled();
    vm.close();
    api.page.mockRejectedValueOnce(new Error('offline'));
    vm.open();
    await flush();
    expect(api.error).toHaveBeenCalledWith('库存查询失败，请稍后重试');
    expect(host.textContent).toContain('暂无库存数据');
  });

  it('ignores an old response after closing and reopening', async () => {
    let resolveOld!: (value: unknown) => void;
    api.page.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const { host, vm } = mount();
    vm.open();
    await flush();
    vm.close();
    vm.open();
    await flush();
    resolveOld({ list: [], total: 0 });
    await flush();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(5);
  });
  it('edits a draft, cancels without changes, applies across rows and retains selection and masked titles', async () => {
    const first = mount({
      settingsScope: 'settings-interaction',
      hiddenFields: ['item_productPurchasePrice'],
    });
    const second = mount({ settingsScope: 'settings-interaction' });
    first.vm.open();
    second.vm.open();
    await flush();
    const button = (host: HTMLElement, label: string) =>
      [...host.querySelectorAll('button')].find(
        (element) => element.textContent?.trim() === label,
      )!;
    first.host.querySelector<HTMLInputElement>('tbody input')!.click();
    const beforeCalls = api.page.mock.calls.length;
    button(first.host, '列设置').click();
    await flush();
    const dialog = () =>
      first.host.querySelector<HTMLElement>('[role="dialog"]')!;
    dialog()
      .querySelector<HTMLInputElement>('[data-field="batchNo"] input')!
      .click();
    button(dialog(), '取消').click();
    await flush();
    expect(first.host.querySelector('th[data-field="batchNo"]')).not.toBeNull();
    button(first.host, '列设置').click();
    await flush();
    dialog()
      .querySelector<HTMLInputElement>('[data-field="batchNo"] input')!
      .click();
    const width = dialog().querySelector<HTMLInputElement>(
      '[data-field="productName"] input[type="number"]',
    )!;
    width.value = '320';
    width.dispatchEvent(new Event('input'));
    await flush();
    const bubbled = vi.fn();
    window.addEventListener('keydown', bubbled);
    width.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(bubbled).not.toHaveBeenCalled();
    window.removeEventListener('keydown', bubbled);
    // Ant Popover schedules outside-close on document mousedown. Modal events
    // must never schedule that delayed close after confirm/cancel.
    document.addEventListener('mousedown', bubbled);
    width.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(bubbled).not.toHaveBeenCalled();
    document.removeEventListener('mousedown', bubbled);
    expect(first.selected).not.toHaveBeenCalled();
    button(dialog(), '确定').click();
    await flush();
    expect(first.host.querySelector('th[data-field="batchNo"]')).toBeNull();
    expect(second.host.querySelector('th[data-field="batchNo"]')).toBeNull();
    expect(
      first.host
        .querySelector('tbody [data-field="productPurchasePrice"]')
        ?.getAttribute('title'),
    ).toBe('****');
    expect(
      first.host.querySelector<HTMLInputElement>('tbody input')?.checked,
    ).toBe(true);
    expect(first.active()?.textContent).toContain('配件1');
    expect(api.page).toHaveBeenCalledTimes(beforeCalls);
    button(first.host, '列设置').click();
    await flush();
    button(dialog(), '恢复默认').click();
    await flush();
    expect(first.host.querySelector('th[data-field="batchNo"]')).toBeNull();
    button(dialog(), '确定').click();
    await flush();
    expect(
      second.host.querySelector('th[data-field="batchNo"]'),
    ).not.toBeNull();
    await first.key('Enter');
    expect(first.selected).toHaveBeenCalledWith([rows[0]], { id: 100 });
  });
});
