import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';

import Choice from './filter-choice.vue';
const api = vi.hoisted(() => ({ options: vi.fn() }));
vi.mock('#/api/erp/report/trade-v2', () => ({ getTradeOptions: api.options }));
vi.mock('ant-design-vue', () => {
  const button = defineComponent({
    setup:
      (_, { attrs, slots }) =>
      () =>
        h('button', attrs, slots.default?.()),
  });
  const checkbox = defineComponent({
    props: ['checked'],
    emits: ['change'],
    setup:
      (p, { emit, slots }) =>
      () =>
        h('label', [
          h('input', {
            type: 'checkbox',
            checked: p.checked,
            onChange: (e: Event) =>
              emit('change', {
                target: { checked: (e.target as HTMLInputElement).checked },
              }),
          }),
          slots.default?.(),
        ]),
  });
  const popover = defineComponent({
    emits: ['openChange'],
    setup:
      (_, { emit, slots }) =>
      () =>
        h('div', [
          h('button', { onClick: () => emit('openChange', true) }, '打开选项'),
          slots.content?.(),
        ]),
  });
  return {
    Button: button,
    Checkbox: checkbox,
    Popover: popover,
    Input: defineComponent({ setup: () => () => h('input') }),
    Select: defineComponent({ setup: () => () => h('select') }),
  };
});
const apps: Array<ReturnType<typeof createApp>> = [];
async function flush() {
  for (let i = 0; i < 7; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount());
  document.body.innerHTML = '';
  api.options.mockReset();
});
describe('部门分组选项实际加载', () => {
  it('候选保留其他过滤，清除当前部门维度已选值，并复选全选当前可见项', async () => {
    api.options.mockResolvedValue({
      list: [
        { value: 3, label: '一部 [3]' },
        { value: 5, label: '停用部门历史 [5]' },
      ],
      total: 2,
    });
    const changed = vi.fn();
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(Choice, {
      kind: 'sale',
      dimension: 'ACCOUNTING_DEPT',
      label: '核算部门',
      multiple: true,
      value: [3],
      query: {
        postedFrom: '2026-01-01 00:00:00',
        postedTo: '2026-02-01 00:00:00',
        pageNo: 1,
        pageSize: 20,
        groupBy: 'PRODUCT',
        orderField: 'postedAt',
        orderDirection: 'desc',
        accountingDeptIds: [3],
        stockDeptIds: [9],
      },
      onChange: changed,
    });
    apps.push(app);
    app.mount(host);
    (host.querySelector('button') as HTMLButtonElement).click();
    await flush();
    expect(api.options.mock.calls[0]?.[1]).toMatchObject({
      stockDeptIds: [9],
      pageSize: 50,
    });
    expect(api.options.mock.calls[0]?.[1].accountingDeptIds).toBeUndefined();
    const all = host.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    all.checked = true;
    all.dispatchEvent(new Event('change'));
    await flush();
    expect(changed).toHaveBeenLastCalledWith([3, 5]);
    expect(host.textContent).toContain('停用部门历史');
  });
});
