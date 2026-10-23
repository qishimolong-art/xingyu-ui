/* eslint-disable vue/one-component-per-file -- Components below are isolated test fixtures. */
import { createApp, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import WarehouseForm from './modules/form.vue';
import {
  formatWarehouseCoordinate,
  parseWarehouseNumber,
} from './warehouse-input';

const state = vi.hoisted(() => ({
  hooks: {} as any,
  payload: undefined as any,
  hidden: [] as string[],
  getWarehouse: vi.fn(),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('@vben/stores', () => ({ useUserStore: () => ({ userInfo: {} }) }));
vi.mock('#/locales', () => ({ $t: (value: string) => value }));
vi.mock('#/composables/useFieldPermission', async () => {
  const { ref } = await import('vue');
  return {
    useFieldPermission: () => ({
      hiddenFields: ref(state.hidden),
      loadHiddenFields: async () => {},
    }),
  };
});
vi.mock('#/api/erp/stock/warehouse', () => ({
  getWarehouse: (...args: any[]) => state.getWarehouse(...args),
  createWarehouse: vi.fn(),
  updateWarehouse: vi.fn(),
  getWarehouseFormDeptSimplePage: vi.fn(),
}));
vi.mock('./data', () => ({
  getCloudPrintDeviceOptions: async () => [],
  hasVisibleWarehouseLocationFields: () => true,
  shouldShowWarehousePermissionTab: () => false,
  useFormSchema: () =>
    ['name', 'warehouseCode'].filter((name) => !state.hidden.includes(name)),
  useLocationFormSchema: () => ['address', 'longitude', 'latitude'],
}));
vi.mock('#/views/erp/utils/candidate-focus', () => ({
  withCandidateFocus: (schema: any) => schema,
}));
vi.mock('#/views/erp/components/ErpAuditInfo.vue', () => ({
  default: { render: () => null },
}));
vi.mock('./modules/sale-dept-permission.vue', () => ({
  default: { render: () => null },
}));
vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const Slot = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    message: { success: vi.fn() },
    Button: Slot,
    Tabs: Object.assign(Slot, { TabPane: Slot }),
  };
});
vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    useVbenModal: (hooks: any) => {
      state.hooks = hooks;
      return [
        defineComponent({
          setup:
            (_, { slots }) =>
            () =>
              h('div', { role: 'dialog' }, slots.default?.()),
        }),
        {
          getData: () => state.payload,
          setState: vi.fn(),
          lock: vi.fn(),
          unlock: vi.fn(),
          close: async () => hooks.onOpenChange(false),
        },
      ];
    },
  };
});
vi.mock('#/adapter/form', async () => {
  const { defineComponent, h, ref } = await import('vue');
  return {
    useVbenForm: (options: any) => {
      const disabled = ref(false);
      const schema = ref(options.schema);
      return [
        defineComponent({
          setup: () => () =>
            h(
              'form',
              schema.value.map((field: string) =>
                h('input', { 'data-field': field, disabled: disabled.value }),
              ),
            ),
        }),
        {
          setDisabled: (value: boolean) => {
            disabled.value = value;
          },
          setState: (value: any) => {
            if (value.schema) schema.value = value.schema;
          },
          resetForm: async () => {},
          setValues: async () => {},
          validate: async () => ({ valid: true }),
        },
      ];
    },
  };
});

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  state.hidden = [];
  state.payload = undefined;
  state.getWarehouse.mockReset();
  vi.useRealTimers();
});

async function mountForm(payload?: any) {
  vi.useFakeTimers();
  state.payload = payload;
  state.getWarehouse.mockResolvedValue(payload);
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp(WarehouseForm);
  app.mount(root);
  cleanups.push(() => {
    app.unmount();
    root.remove();
  });
  await state.hooks.onOpenChange(true);
  state.hooks.onOpened();
  await nextTick();
  await vi.advanceTimersByTimeAsync(80);
  return root;
}
function enter(input: Element, options: KeyboardEventInit = {}) {
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      ...options,
    }),
  );
}

describe('warehouse create/edit focus and cross-section Enter', () => {
  it.each([undefined, { id: 1, name: '编辑仓库' }])(
    'focuses once after hydration, then crosses sections: %s',
    async (payload) => {
      const root = await mountForm(payload);
      const inputs = [...root.querySelectorAll<HTMLInputElement>('input')];
      expect(document.activeElement).toBe(inputs[0]);
      enter(inputs[0] as HTMLInputElement);
      expect(document.activeElement).toBe(inputs[1]);
      enter(inputs[1] as HTMLInputElement);
      expect(document.activeElement).toBe(inputs[2]);
      // onOpened/readiness callbacks must not steal focus after the user has moved.
      state.hooks.onOpened();
      await vi.advanceTimersByTimeAsync(80);
      expect(document.activeElement).toBe(inputs[2]);
      (inputs.at(-1) as HTMLInputElement).focus();
      enter(inputs.at(-1) as HTMLInputElement);
      expect(document.activeElement).toBe(inputs.at(-1));
    },
  );
  it('skips a permission-hidden first field and leaves detail mode unfocused', async () => {
    state.hidden = ['name'];
    const root = await mountForm();
    expect((document.activeElement as HTMLElement).dataset.field).toBe(
      'warehouseCode',
    );
    await state.hooks.onOpenChange(false);
    state.payload = { id: 1, type: 'detail' };
    await state.hooks.onOpenChange(true);
    state.hooks.onOpened();
    await vi.advanceTimersByTimeAsync(80);
    expect(root.querySelectorAll('input:not(:disabled)')).toHaveLength(0);
  });
  it('preserves IME input, dropdown ownership and mouse-selected focus', async () => {
    const root = await mountForm();
    const address = root.querySelector<HTMLInputElement>(
      '[data-field="address"]',
    ) as HTMLInputElement;
    const originalKeyHandler = vi.fn();
    address.addEventListener('keydown', originalKeyHandler);
    address.focus();
    enter(address, { isComposing: true });
    expect(document.activeElement).toBe(address);
    const popup = document.createElement('div');
    popup.className = 'ant-select-dropdown';
    document.body.append(popup);
    enter(address);
    expect(document.activeElement).toBe(address);
    popup.remove();
    originalKeyHandler.mockClear();
    enter(address);
    expect(originalKeyHandler).not.toHaveBeenCalled();
    expect((document.activeElement as HTMLElement).dataset.field).toBe(
      'longitude',
    );
    await state.hooks.onOpenChange(false);
    await state.hooks.onOpenChange(true);
    state.hooks.onOpened();
    await vi.advanceTimersByTimeAsync(80);
    expect((document.activeElement as HTMLElement).dataset.field).toBe('name');
  });
});

describe('warehouse numeric input boundaries', () => {
  it('allows clearing coordinates, bounds and six decimals while rejecting intermediate states on save', () => {
    expect(parseWarehouseNumber('', 180)).toBeUndefined();
    expect(parseWarehouseNumber('-180.000000', 180)).toBe(-180);
    expect(parseWarehouseNumber('90.000001', 90)).toBeNaN();
    for (const value of ['-', '.', '-.', '1.1234567', '1e2', '12x'])
      expect(parseWarehouseNumber(value, 180)).toBeNaN();
    expect(parseWarehouseNumber('-12')).toBe(-12);
    expect(parseWarehouseNumber('12.5')).toBeNaN();
    expect(formatWarehouseCoordinate('104.066800')).toBe('104.0668');
    expect(formatWarehouseCoordinate(180)).toBe('180');
  });
});
