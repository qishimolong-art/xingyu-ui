import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSupplierSelectPage } from '#/views/erp/purchase/utils/supplier-select';

import SupplierLazySelect from './SupplierLazySelect.vue';

const selectState = vi.hoisted(() => ({
  latestOptions: [] as any[],
}));

vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    message: {
      warning: vi.fn(),
    },
    Select: defineComponent({
      inheritAttrs: false,
      props: {
        options: {
          default: () => [],
          type: Array,
        },
      },
      setup(props) {
        return () => {
          selectState.latestOptions = props.options as any[];
          return h('div');
        };
      },
    }),
  };
});

vi.mock('#/views/erp/purchase/utils/supplier-select', () => ({
  getSupplierSelectPage: vi.fn(),
  SUPPLIER_SELECT_PAGE_SIZE: 10,
}));

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function mountSupplierLazySelect(props: Record<string, any>) {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(SupplierLazySelect, props);
  const vm = app.mount(container) as InstanceType<typeof SupplierLazySelect>;
  return {
    unmount: () => {
      app.unmount();
      container.remove();
    },
    vm,
  };
}

describe('SupplierLazySelect', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    selectState.latestOptions = [];
    vi.mocked(getSupplierSelectPage).mockReset();
  });

  it('normalizes injected current supplier options', async () => {
    const mounted = mountSupplierLazySelect({
      options: [{ id: 12, name: '供应商A' }],
      value: 12,
    });
    cleanups.push(mounted.unmount);
    await nextTick();

    expect(mounted.vm.getOptions()).toEqual([
      expect.objectContaining({
        id: 12,
        label: '供应商A',
        value: 12,
      }),
    ]);
    expect(selectState.latestOptions[0]).toEqual(
      expect.objectContaining({
        label: '供应商A',
        value: 12,
      }),
    );
  });

  it('deduplicates injected supplier options after lazy loading the same value', async () => {
    vi.mocked(getSupplierSelectPage).mockResolvedValue({
      list: [
        { id: 12, label: '接口供应商A', name: '接口供应商A', value: 12 },
        { id: 13, label: '供应商B', name: '供应商B', value: 13 },
      ],
      total: 2,
    } as any);
    const mounted = mountSupplierLazySelect({
      options: [{ id: 12, name: '供应商A' }],
      value: 12,
    });
    cleanups.push(mounted.unmount);

    await mounted.vm.reloadOptions();
    await flushPromises();
    await nextTick();

    expect(mounted.vm.getOptions()).toHaveLength(2);
    expect(mounted.vm.getOptions()).toEqual([
      expect.objectContaining({ label: '接口供应商A', value: 12 }),
      expect.objectContaining({ label: '供应商B', value: 13 }),
    ]);
  });

  it('does not re-emit optionsChange when equivalent current options are injected again', async () => {
    const onOptionsChange = vi.fn();
    const Wrapper = defineComponent({
      setup(_, { expose }) {
        const currentOptions = ref([{ id: 12, name: '供应商A' }]);
        expose({
          resetEquivalentOptions: () => {
            currentOptions.value = [{ id: 12, name: '供应商A' }];
          },
        });
        return () =>
          h(SupplierLazySelect, {
            onOptionsChange,
            options: currentOptions.value as any,
            value: 12,
          });
      },
    });

    const container = document.createElement('div');
    document.body.append(container);
    const app = createApp(Wrapper);
    const vm = app.mount(container) as any;
    cleanups.push(() => {
      app.unmount();
      container.remove();
    });

    await nextTick();
    expect(onOptionsChange).toHaveBeenCalledTimes(1);

    vm.resetEquivalentOptions();
    await nextTick();
    expect(onOptionsChange).toHaveBeenCalledTimes(1);
  });

  it('does not fetch while disabled', async () => {
    const mounted = mountSupplierLazySelect({
      disabled: true,
      value: 12,
    });
    cleanups.push(mounted.unmount);

    await mounted.vm.reloadOptions();
    await flushPromises();

    expect(getSupplierSelectPage).not.toHaveBeenCalled();
  });
});
