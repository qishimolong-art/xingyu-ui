import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import ErpLazyPageSelect from './ErpLazyPageSelect.vue';

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

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function mountLazyPageSelect(props: Record<string, any>) {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(ErpLazyPageSelect, props);
  const vm = app.mount(container) as InstanceType<typeof ErpLazyPageSelect>;
  return {
    unmount: () => {
      app.unmount();
      container.remove();
    },
    vm,
  };
}

describe('ErpLazyPageSelect', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    selectState.latestOptions = [];
  });

  it('normalizes injected current options with custom label and value fields', async () => {
    const mounted = mountLazyPageSelect({
      api: vi.fn(async () => ({ list: [], total: 0 })),
      labelField: 'name',
      options: [{ id: 3, name: '三号仓库' }],
      value: 3,
      valueField: 'id',
    });
    cleanups.push(mounted.unmount);
    await nextTick();

    expect(mounted.vm.getOptions()).toEqual([
      expect.objectContaining({
        id: 3,
        label: '三号仓库',
        value: 3,
      }),
    ]);
    expect(selectState.latestOptions[0]).toEqual(
      expect.objectContaining({
        label: '三号仓库',
        value: 3,
      }),
    );
  });

  it('deduplicates injected current options after lazy loading the same value', async () => {
    const mounted = mountLazyPageSelect({
      api: vi.fn(async () => ({
        list: [
          { id: 3, name: '接口仓库' },
          { id: 4, name: '四号仓库' },
        ],
        total: 2,
      })),
      labelField: 'name',
      options: [{ id: 3, name: '三号仓库' }],
      value: 3,
      valueField: 'id',
    });
    cleanups.push(mounted.unmount);

    await mounted.vm.reloadOptions();
    await flushPromises();
    await nextTick();

    expect(mounted.vm.getOptions()).toHaveLength(2);
    expect(mounted.vm.getOptions()).toEqual([
      expect.objectContaining({ label: '接口仓库', value: 3 }),
      expect.objectContaining({ label: '四号仓库', value: 4 }),
    ]);
  });

  it('does not re-emit optionsChange when equivalent current options are injected again', async () => {
    const onOptionsChange = vi.fn();
    const Wrapper = defineComponent({
      setup(_, { expose }) {
        const currentOptions = ref([{ id: 3, name: '三号仓库' }]);
        expose({
          resetEquivalentOptions: () => {
            currentOptions.value = [{ id: 3, name: '三号仓库' }];
          },
        });
        return () =>
          h(ErpLazyPageSelect, {
            api: vi.fn(async () => ({ list: [], total: 0 })),
            labelField: 'name',
            onOptionsChange,
            options: currentOptions.value,
            value: 3,
            valueField: 'id',
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
});
