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

import ErpInlineStockSelect from './ErpInlineStockSelect.vue';

const api = vi.hoisted(() => ({
  identity: { userId: 'sale-column-test', tenantId: 1 },
  page: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));
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
vi.mock('@vben/stores', async () => {
  const { reactive } = await import('vue');
  api.identity = reactive(api.identity);
  return {
    useUserStore: () => ({
      get userInfo() {
        return { id: api.identity.userId };
      },
    }),
    useAccessStore: () => ({
      get tenantId() {
        return api.identity.tenantId;
      },
    }),
  };
});
vi.mock('ant-design-vue', () => ({
  Select: defineComponent({
    props: ['value', 'options', 'popupClassName'],
    emits: ['change', 'dropdownVisibleChange'],
    setup:
      (props, { emit }) =>
      () =>
        h(
          'select',
          {
            'data-test-candidate-page-size': props.popupClassName,
            value: props.value,
            onFocus: () => emit('dropdownVisibleChange', true),
            onBlur: () => emit('dropdownVisibleChange', false),
            onChange: (event: Event) =>
              emit('change', Number((event.target as HTMLSelectElement).value)),
          },
          props.options?.map((option: { value: number; label: string }) =>
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
  const app = createApp(ErpInlineStockSelect, {
    settingsScope: 'sale-order',
    stockPageApi: api.page,
    deptId: 1,
    row: { id: 100 },
    onSelect: selected,
    ...props,
  });
  const vm = app.mount(host) as InstanceType<typeof ErpInlineStockSelect>;
  let mounted = true;
  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    app.unmount();
    host.remove();
  };
  cleanups.push(unmount);
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
    host.querySelector('.sale-inline-stock-select-row--active');
  return { active, host, input, key, selected, unmount, vm };
}

const inventoryScopes = [
  'stock-in',
  'stock-out',
  'stock-check',
  'stock-move',
  'stock-transfer-out',
  'stock-warehouse-move',
] as const;

function clickButton(host: HTMLElement, label: string) {
  [...host.querySelectorAll('button')]
    .find((button) => button.textContent?.trim() === label)!
    .click();
}

describe('inventory inline stock picker', () => {
  beforeEach(() => {
    api.identity.userId = 'inventory-column-test';
    api.identity.tenantId = 1;
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
    const picker = mount({
      settingsScope: 'stock-out',
      requireDept: false,
      deptId: undefined,
    });
    picker.vm.open();
    await flush();
    const text = (field: string) =>
      picker.host
        .querySelector(`tbody [data-field="${field}"]`)
        ?.textContent?.trim();

    expect(text('count')).toBe('3');
    expect(text('availableCount')).toBe('0');
    expect(text('occupiedCount')).toBe('0.5');
    expect(text('pendingInCount')).toBe('1.25');
    expect(text('inTransitCount')).toBe('-2.5');
    expect(text('productPurchasePrice')).toBe('20.00');
    expect(text('salePrice')).toBe('20.50');
  });

  it.each(inventoryScopes)(
    '%s uses ten-row requests, focus and selection shortcuts',
    async (settingsScope) => {
      const picker = mount({
        settingsScope,
        deptId: undefined,
        requireDept: false,
        stockPageParams: { bizType: 'stock', warehouseId: 17 },
      });
      picker.vm.open();
      await flush();
      expect(api.page).toHaveBeenLastCalledWith({
        bizType: 'stock',
        warehouseId: 17,
        deptId: undefined,
        productCodeNameKeyword: undefined,
        orderDirection: 'desc',
        orderField: 'count',
        pageNo: 1,
        pageSize: 10,
        showBatchNo: true,
      });
      expect(
        picker.host.querySelector<HTMLElement>('[data-overflow]')?.dataset
          .overflow,
      ).toBe('{"adjustX":1,"adjustY":0}');
      expect(picker.active()?.textContent).toContain('配件1');
      await picker.key('ArrowUp');
      expect(picker.active()?.textContent).toContain('配件5');
      await picker.key('Insert');
      await picker.key('ArrowRight');
      expect(picker.active()?.textContent).toContain('配件1');
      expect(picker.host.querySelectorAll('tbody input:checked')).toHaveLength(
        0,
      );
      expect(api.page).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageNo: 2, pageSize: 10 }),
      );
      picker.input.value = '库存搜索';
      picker.input.dispatchEvent(new Event('input'));
      await flush();
      expect(api.page).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pageNo: 1,
          pageSize: 10,
          productCodeNameKeyword: '库存搜索',
        }),
      );
      await picker.key('Enter');
      expect(picker.selected).toHaveBeenCalledWith([rows[0]], { id: 100 });
      picker.vm.open();
      await flush();
      expect(api.page).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageNo: 1, pageSize: 10 }),
      );
    },
  );

  it('shares applied columns within an entry, persists each of six scopes and leaves sales/purchase isolated', async () => {
    api.identity.userId = 'inventory-isolation';
    const { columnStorageKey } =
      await import('../composables/useInlineColumnSettings');
    for (const [index, settingsScope] of inventoryScopes.entries()) {
      const picker = mount({ settingsScope });
      const peer = mount({ settingsScope });
      picker.vm.open();
      peer.vm.open();
      await flush();
      expect(
        picker.host.querySelector('th[data-field="batchNo"]'),
      ).not.toBeNull();
      clickButton(picker.host, '列设置');
      await flush();
      const dialog = picker.host.querySelector<HTMLElement>('[role="dialog"]')!;
      dialog
        .querySelector<HTMLInputElement>('[data-field="batchNo"] input')!
        .click();
      const width = dialog.querySelector<HTMLInputElement>(
        '[data-field="productName"] input[type="number"]',
      )!;
      width.value = String(300 + index);
      width.dispatchEvent(new Event('input'));
      clickButton(dialog, '确定');
      await flush();
      expect(peer.host.querySelector('th[data-field="batchNo"]')).toBeNull();
      const saved = JSON.parse(
        localStorage.getItem(
          columnStorageKey(1, 'inventory-isolation', settingsScope),
        )!,
      );
      expect(
        saved.find(
          (column: { field: string }) => column.field === 'productName',
        ).width,
      ).toBe(300 + index);
      picker.vm.close();
      picker.vm.open();
      await flush();
      expect(picker.host.querySelector('th[data-field="batchNo"]')).toBeNull();
    }
    for (const scope of [
      'sale-cart',
      'sale-order',
      'sale-quote',
      'sale-return',
      'purchase-order',
      'purchase-in',
      'purchase-return',
    ]) {
      expect(
        localStorage.getItem(columnStorageKey(1, 'inventory-isolation', scope)),
      ).toBeNull();
    }
    const sale = mount({ settingsScope: 'sale-order' });
    sale.vm.open();
    await flush();
    expect(sale.host.querySelector('th[data-field="batchNo"]')).not.toBeNull();
  });

  it('applies masked display preferences even when persistence fails and closes on identity changes', async () => {
    api.identity.userId = 'inventory-storage-failure';
    const picker = mount({
      settingsScope: 'stock-out',
      hiddenFields: ['item_productPurchasePrice'],
    });
    picker.vm.open();
    await flush();
    clickButton(picker.host, '列设置');
    await flush();
    const dialog = picker.host.querySelector<HTMLElement>('[role="dialog"]')!;
    dialog
      .querySelector<HTMLInputElement>('[data-field="batchNo"] input')!
      .click();
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      clickButton(dialog, '确定');
      await flush();
      expect(api.warning).toHaveBeenCalledWith(
        '列设置已应用，但未能保存到当前浏览器',
      );
      expect(picker.host.querySelector('th[data-field="batchNo"]')).toBeNull();
      expect(
        picker.host
          .querySelector('tbody [data-field="productPurchasePrice"]')
          ?.getAttribute('title'),
      ).toBe('****');
    } finally {
      setItem.mockRestore();
    }
    for (const changeIdentity of [
      () => {
        api.identity.tenantId = 2;
      },
      () => {
        api.identity.userId = 'another-inventory-user';
      },
    ]) {
      clickButton(picker.host, '列设置');
      await flush();
      changeIdentity();
      await flush();
      expect(picker.vm.isOpen()).toBe(false);
      expect(picker.host.querySelector('[role="dialog"]')).toBeNull();
      picker.vm.open();
      await flush();
      expect(
        picker.host.querySelector('th[data-field="batchNo"]'),
      ).not.toBeNull();
    }
  });

  it('remounts for either warehouse change, releases the parent guard and discards draft, selection and stale requests', async () => {
    api.identity.userId = 'warehouse-remount';
    const from = ref(10);
    const to = ref(20);
    const opened = ref(false);
    const picker = ref<InstanceType<typeof ErpInlineStockSelect>>();
    const selected = vi.fn();
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({
      setup: () => () =>
        h(ErpInlineStockSelect, {
          key: `${from.value}:${to.value}`,
          ref: picker,
          settingsScope: 'stock-warehouse-move',
          row: { id: 100 },
          requireDept: false,
          stockPageApi: api.page,
          stockPageParams: { bizType: 'stock', warehouseId: from.value },
          'onOpen-change': (value: boolean) => {
            opened.value = value;
          },
          onSelect: selected,
        }),
    });
    app.mount(host);
    cleanups.push(() => {
      app.unmount();
      host.remove();
    });
    picker.value!.open();
    await flush();
    clickButton(host, '列设置');
    await flush();
    host
      .querySelector<HTMLInputElement>(
        '[role="dialog"] [data-field="batchNo"] input',
      )!
      .click();
    clickButton(host.querySelector<HTMLElement>('[role="dialog"]')!, '确定');
    await flush();
    host.querySelector<HTMLInputElement>('tbody input')!.click();
    clickButton(host, '列设置');
    await flush();
    host
      .querySelector<HTMLInputElement>(
        '[role="dialog"] [data-field="productCode"] input',
      )!
      .click();
    to.value = 21;
    await flush();
    expect(opened.value).toBe(false);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    picker.value!.open();
    await flush();
    expect(host.querySelector('th[data-field="batchNo"]')).toBeNull();
    expect(host.querySelector('th[data-field="productCode"]')).not.toBeNull();
    expect(
      host.querySelector('.sale-inline-stock-select-footer')?.textContent,
    ).toContain('已选 0 条');
    let resolveOld!: (value: unknown) => void;
    api.page.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    host.querySelector<HTMLButtonElement>('[data-page-size]')!.click();
    await flush();
    from.value = 11;
    await flush();
    expect(opened.value).toBe(false);
    picker.value!.open();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ warehouseId: 11, pageNo: 1, pageSize: 10 }),
    );
    resolveOld({ list: [{ ...rows[0], productName: '旧仓库库存' }], total: 1 });
    await flush();
    expect(host.textContent).not.toContain('旧仓库库存');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(selected).not.toHaveBeenCalled();
  });
});

describe('sale inline stock picker', () => {
  it.each(['sale-cart', ...inventoryScopes])(
    'moves opted-in %s activity on pointer movement without selecting or stealing input focus',
    async (settingsScope) => {
      const { host, input, vm, key, active, selected } = mount({
        candidateFocusHighlight: true,
        settingsScope,
      });
      vm.open();
      await flush();
      input.focus();
      const candidates = host.querySelectorAll('tbody tr');
      candidates[1]!.dispatchEvent(new Event('pointermove', { bubbles: true }));
      await nextTick();
      expect(active()).toBe(candidates[1]);
      expect(document.activeElement).toBe(input);
      expect(host.querySelectorAll('tbody input:checked')).toHaveLength(0);
      expect(selected).not.toHaveBeenCalled();
      expect(host.querySelector('.erp-candidate-focus-inline')).not.toBeNull();
      await key('ArrowDown');
      expect(active()).toBe(candidates[2]);
      await key('Insert');
      expect(candidates[2]!.querySelector('input:checked')).not.toBeNull();
      expect(selected).not.toHaveBeenCalled();
      const pageSize = host.querySelector<HTMLSelectElement>(
        '[data-test-candidate-page-size]',
      )!;
      expect(pageSize.dataset.testCandidatePageSize).toBe(
        'erp-candidate-focus-popup',
      );
      pageSize.focus();
      await key('ArrowDown');
      expect(active()).toBe(candidates[2]);
      pageSize.value = '20';
      pageSize.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(api.page).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageNo: 1, pageSize: 20 }),
      );
      expect(host.querySelectorAll('tbody input:checked')).toHaveLength(0);
      pageSize.value = '10';
      pageSize.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
    },
  );

  it('leaves pointer activity and page-size controls unchanged without opt-in', async () => {
    const { host, vm, active } = mount();
    vm.open();
    await flush();
    const first = active();
    host
      .querySelectorAll('tbody tr')[1]!
      .dispatchEvent(new Event('pointermove', { bubbles: true }));
    await nextTick();
    expect(active()).toBe(first);
    expect(host.querySelector('.erp-candidate-focus-inline')).toBeNull();
    expect(host.querySelector('[data-inline-stock-page-size]')).not.toBeNull();
  });
  beforeEach(() => {
    api.identity.userId = 'sale-column-test';
    api.identity.tenantId = 1;
  });
  it('uses ten rows for open, paging, search and reopen, and cannot flip upwards', async () => {
    const { host, input, vm } = mount();
    vm.open();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 1, pageSize: 10, deptId: 1 }),
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
    api.page.mockResolvedValueOnce({
      list: [{ ...rows[0], count: '3.123456' }],
      total: 1,
    });
    const precise = mount({
      settingsScope: undefined,
      requireDept: false,
      deptId: undefined,
      preserveQuantityPrecision: true,
    });
    precise.vm.open();
    await flush();
    expect(
      precise.host
        .querySelectorAll('tbody tr:first-child td')[7]
        ?.textContent?.trim(),
    ).toBe('3.123456');
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

  it('changes and remembers the shared page size without letting the selector trigger stock shortcuts', async () => {
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
    selector.value = '20';
    selector.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 1, pageSize: 20 }),
    );
    expect(host.querySelectorAll('tbody input:checked')).toHaveLength(0);
    expect(active()?.textContent).toContain('配件1');
    expect(
      localStorage.getItem(
        'xingyu-erp:inline-stock-page-size:v1:1:sale-column-test',
      ),
    ).toBe('20');
    vm.close();
    vm.open();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 1, pageSize: 20 }),
    );
    const reopenedSelector = host.querySelector<HTMLSelectElement>(
      '[data-inline-stock-page-size]',
    )!;
    reopenedSelector.value = '10';
    reopenedSelector.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
  });

  it('scrolls a keyboard-highlighted row vertically while preserving horizontal position', async () => {
    const manyRows = Array.from({ length: 10 }, (_, index) => ({
      ...rows[0],
      id: index + 1,
      productId: index + 1,
      productName: `滚动配件${index + 1}`,
    }));
    api.page.mockResolvedValue({ list: manyRows, total: 10 });
    const { host, key, vm } = mount();
    vm.open();
    await flush();
    const table = host.querySelector<HTMLElement>(
      '.sale-inline-stock-select-table-wrap',
    )!;
    Object.defineProperty(table, 'clientHeight', {
      configurable: true,
      value: 224,
    });
    table.getBoundingClientRect = () =>
      ({ bottom: 224, height: 224, top: 0 }) as DOMRect;
    const header = table.querySelector<HTMLElement>('thead')!;
    header.getBoundingClientRect = () =>
      ({ bottom: 32, height: 32, top: 0 }) as DOMRect;
    [...table.querySelectorAll<HTMLElement>('tbody tr')].forEach(
      (row, index) => {
        row.getBoundingClientRect = () => {
          const top = 32 + index * 32 - table.scrollTop;
          return { bottom: top + 32, height: 32, top } as DOMRect;
        };
      },
    );
    table.scrollLeft = 123;
    for (let index = 0; index < 7; index++) await key('ArrowDown');
    expect(table.scrollTop).toBeGreaterThan(0);
    expect(table.scrollLeft).toBe(123);
  });

  it('filters multiple columns and cycles server sorting without mixing header events', async () => {
    const { active, host, key, vm } = mount();
    vm.open();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderDirection: 'desc',
        orderField: 'count',
        pageNo: 1,
      }),
    );
    host.querySelector<HTMLInputElement>('tbody input')?.click();
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
        host.querySelector('.sale-inline-stock-select-table-wrap'),
      );
    };
    await applyFilter('warehouseName', '甘孜');
    await applyFilter('productName', '美孚');
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        warehouseName: '甘孜',
        productName: '美孚',
        orderDirection: 'desc',
        orderField: 'count',
        pageNo: 1,
      }),
    );
    expect(
      host.querySelector('.sale-inline-stock-select-footer')?.textContent,
    ).toContain('已选 0 条');
    const productNameHeader = host.querySelector<HTMLElement>(
      '[data-inline-stock-header-field="productName"]',
    )!;
    productNameHeader.click();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderDirection: 'asc',
        orderField: 'productName',
      }),
    );
    productNameHeader.click();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderDirection: 'desc',
        orderField: 'productName',
      }),
    );
    productNameHeader.click();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderDirection: 'desc',
        orderField: 'count',
      }),
    );
    const productPanel = host.querySelector<HTMLElement>(
      '[data-inline-stock-filter-field="productName"]',
    )!;
    clickButton(productPanel, '清空全部');
    await flush();
    const lastRequest = api.page.mock.calls.at(-1)?.[0];
    expect(lastRequest).not.toHaveProperty('warehouseName');
    expect(lastRequest).not.toHaveProperty('productName');
    expect(lastRequest).toMatchObject({
      orderDirection: 'desc',
      orderField: 'count',
      pageNo: 1,
    });
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
      host.querySelector('.sale-inline-stock-select-table-wrap'),
    );
    expect(active()?.textContent).toContain('配件3');
    expect(
      host.querySelectorAll('.sale-inline-stock-select-row--active'),
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
      settingsScope: 'sale-cart',
      hiddenFields: ['item_productPurchasePrice'],
    });
    const second = mount({ settingsScope: 'sale-cart' });
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
  it('keeps legacy inventory at ten rows without settings or forced alignment', async () => {
    api.page.mockResolvedValueOnce({
      list: [
        {
          ...rows[0],
          count: '3.000',
          occupiedCount: '0.500',
          pendingInCount: '1.250',
          availableCount: '0.000',
          inTransitCount: '-2.500',
        },
      ],
      total: 1,
    });
    const legacy = mount({
      settingsScope: undefined,
      requireDept: false,
      deptId: undefined,
    });
    legacy.vm.open();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageSize: 10 }),
    );
    expect(legacy.host.textContent).not.toContain('列设置');
    expect(legacy.host.querySelector('[data-overflow]')).toBeNull();
    expect(
      legacy.host.querySelector('.erp-inline-stock-select-table'),
    ).not.toBeNull();
    expect(
      [...legacy.host.querySelectorAll('tbody tr:first-child td')]
        .slice(7, 12)
        .map((cell) => cell.textContent?.trim()),
    ).toEqual(['3', '0.5', '1.25', '0', '-2.5']);
    legacy.host.querySelector<HTMLButtonElement>('[data-page-size]')?.click();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNo: 2, pageSize: 10 }),
    );
  });
  it('preserves sale scope parameters and opening guards', async () => {
    mount({ deptId: undefined }).vm.open();
    await flush();
    expect(api.page).not.toHaveBeenCalled();
    const beforeOpen = vi.fn(() => false);
    mount({ beforeOpen }).vm.open();
    expect(beforeOpen).toHaveBeenCalled();
    expect(api.page).not.toHaveBeenCalled();
    mount({
      filterByDept: false,
      stockPageParams: {
        saleDeptId: 7,
        allSaleProduct: true,
        allSaleProductPermission: 'erp:sale-order:all-product',
      },
    }).vm.open();
    await flush();
    expect(api.page).toHaveBeenLastCalledWith({
      saleDeptId: 7,
      allSaleProduct: true,
      allSaleProductPermission: 'erp:sale-order:all-product',
      productCodeNameKeyword: undefined,
      orderDirection: 'desc',
      orderField: 'count',
      pageNo: 1,
      pageSize: 10,
      showBatchNo: true,
    });
  });
  it('sends the inline input as a product-code-or-name keyword', async () => {
    const picker = mount({
      filterByDept: false,
      stockPageParams: { saleDeptId: 10 },
    });
    picker.vm.open();
    await flush();
    picker.input.value = '经典表现 530';
    picker.input.dispatchEvent(new Event('input'));
    await flush();
    expect(picker.input.placeholder).toBe('配件编码/名称（支持空格组合搜索）');
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
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
  it('ignores stale responses during search debounce and cannot add stale rows', async () => {
    let resolveOld!: (value: unknown) => void;
    api.page.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const picker = mount();
    picker.vm.open();
    await nextTick();
    picker.input.value = '新的关键词';
    picker.input.dispatchEvent(new Event('input'));
    resolveOld({ list: rows, total: 5 });
    await nextTick();
    picker.input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(picker.selected).not.toHaveBeenCalled();
    expect(picker.host.querySelector('tbody')?.textContent).not.toContain(
      '配件1',
    );
    await flush();
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageSize: 10,
        productCodeNameKeyword: '新的关键词',
      }),
    );
  });
  it('isolates all four sales scopes from each other and purchase', async () => {
    const { columnStorageKey, defaultColumns } =
      await import('../composables/useInlineColumnSettings');
    const { inlineStockColumns } = await import('./inline-stock-columns');
    const saved = defaultColumns(inlineStockColumns);
    saved[0]!.visible = false;
    for (const scope of ['sale-return', 'purchase-order']) {
      localStorage.setItem(
        columnStorageKey(1, 'sale-column-test', scope),
        JSON.stringify(saved),
      );
    }
    const returned = mount({ settingsScope: 'sale-return' });
    returned.vm.open();
    await flush();
    expect(returned.host.querySelector('th[data-field="batchNo"]')).toBeNull();
    for (const scope of ['sale-cart', 'sale-order', 'sale-quote']) {
      const picker = mount({ settingsScope: scope });
      picker.vm.open();
      await flush();
      expect(
        picker.host.querySelector('th[data-field="batchNo"]'),
      ).not.toBeNull();
    }
  });
  it('closes settings on account or tenant change and reloads isolated preferences', async () => {
    const { columnStorageKey, defaultColumns } =
      await import('../composables/useInlineColumnSettings');
    const { inlineStockColumns } = await import('./inline-stock-columns');
    const saved = defaultColumns(inlineStockColumns);
    saved[0]!.visible = false;
    localStorage.setItem(
      columnStorageKey(1, 'another-sale-user', 'sale-order'),
      JSON.stringify(saved),
    );
    const picker = mount();
    picker.vm.open();
    await flush();
    [...picker.host.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === '列设置')!
      .click();
    await flush();
    expect(picker.host.querySelector('[role="dialog"]')).not.toBeNull();
    api.identity.userId = 'another-sale-user';
    await flush();
    expect(picker.vm.isOpen()).toBe(false);
    expect(picker.host.querySelector('[role="dialog"]')).toBeNull();
    picker.vm.open();
    await flush();
    expect(picker.host.querySelector('th[data-field="batchNo"]')).toBeNull();
    api.identity.tenantId = 2;
    await flush();
    expect(picker.vm.isOpen()).toBe(false);
    picker.vm.open();
    await flush();
    expect(
      picker.host.querySelector('th[data-field="batchNo"]'),
    ).not.toBeNull();
  });
});
