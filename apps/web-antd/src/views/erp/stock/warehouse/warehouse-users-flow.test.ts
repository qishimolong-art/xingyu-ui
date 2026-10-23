/* eslint-disable vue/one-component-per-file -- Components below are isolated test fixtures. */
import { createApp, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import PickerUserModal from './modules/picker-user-modal.vue';
import UserPermissionModal from './modules/user-permission-modal.vue';

const state = vi.hoisted(() => ({
  hooks: {} as any,
  select: {} as any,
  emit: undefined as any,
  row: { id: 1, name: '仓库' },
  load: vi.fn(),
  save: vi.fn(),
  page: vi.fn(),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('#/api/erp/stock/warehouse', () => ({
  getWarehouseUserPermissions: (...args: any[]) => state.load(...args),
  getWarehousePickerUsers: (...args: any[]) => state.load(...args),
  saveWarehouseUserPermissions: (...args: any[]) => state.save(...args),
  saveWarehousePickerUsers: (...args: any[]) => state.save(...args),
  getWarehouseAssignableUsersPage: (...args: any[]) => state.page(...args),
}));
vi.mock('ant-design-vue', async () => {
  const { h, defineComponent } = await import('vue');
  return {
    Alert: { render: () => h('div') },
    Button: defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('button', slots.default?.()),
    }),
    message: { success: vi.fn(), warning: vi.fn() },
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
              h('div', slots.default?.()),
        }),
        {
          getData: () => state.row,
          lock: vi.fn(),
          unlock: vi.fn(),
          close: async () => hooks.onOpenChange(false),
        },
      ];
    },
  };
});
vi.mock('#/views/erp/components/ErpLazyPageSelect.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      props: {
        api: { type: Function, required: true },
        options: { type: Array, required: true },
        value: { type: Array, required: true },
        disabled: Boolean,
      },
      emits: ['update:value', 'optionsChange'],
      setup(props, { emit }) {
        state.emit = emit;
        return () => {
          state.select = props;
          return h('div');
        };
      },
    }),
  };
});
const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
  state.load.mockReset();
  state.save.mockReset();
  state.page.mockReset();
});
function mount(component: any) {
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp(component);
  app.mount(root);
  cleanups.push(() => {
    app.unmount();
    root.remove();
  });
}
describe.each([
  ['warehouse permissions', UserPermissionModal],
  ['pickers', PickerUserModal],
])('%s pagination safety', (_, component) => {
  it('keeps the complete selected set across candidate searches/pages', async () => {
    state.load.mockResolvedValue({
      userIds: [1, 2],
      selectedUsers: [
        { id: 1, nickname: '一', status: 0 },
        { id: 2, nickname: '二', status: 0 },
      ],
    });
    mount(component);
    await state.hooks.onOpenChange(true);
    await nextTick();
    state.emit('optionsChange', [{ value: 3, label: '第三页用户' }]);
    state.emit('update:value', [1, 2, 3]);
    await nextTick();
    state.emit('optionsChange', [{ value: 4, label: '搜索另一用户' }]);
    await nextTick();
    expect(state.select.value).toEqual([1, 2, 3]);
    expect(state.select.options.map((option: any) => option.value)).toEqual([
      1, 2, 3,
    ]);
    await state.hooks.onConfirm();
    expect(state.save).toHaveBeenCalledWith({
      warehouseId: 1,
      userIds: [1, 2, 3],
    });
  });
  it('blocks saves after failed load, and ignores responses arriving after close', async () => {
    state.load.mockRejectedValueOnce(new Error('offline'));
    mount(component);
    await state.hooks.onOpenChange(true);
    await state.hooks.onConfirm();
    expect(state.save).not.toHaveBeenCalled();
    let resolve: (value: any) => void = () => {};
    state.load.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = state.hooks.onOpenChange(true);
    await state.hooks.onOpenChange(false);
    resolve({ userIds: [5], selectedUsers: [{ id: 5, status: 0 }] });
    await pending;
    await nextTick();
    expect(state.select.value).toEqual([]);
    expect(state.select.disabled).toBe(true);
  });
  it('requires an explicit removal of a disabled historical account', async () => {
    state.load.mockResolvedValue({
      userIds: [1, 2],
      selectedUsers: [
        { id: 1, status: 0 },
        { id: 2, status: 1 },
      ],
    });
    mount(component);
    await state.hooks.onOpenChange(true);
    await nextTick();
    expect(state.select.options[1].disabled).toBe(true);
    await state.hooks.onConfirm();
    expect(state.save).not.toHaveBeenCalled();
    state.emit('update:value', [1]);
    await nextTick();
    await state.hooks.onConfirm();
    expect(state.save).toHaveBeenCalledWith({ warehouseId: 1, userIds: [1] });
  });
});
