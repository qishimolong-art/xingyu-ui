// Independent behavioral cases; shared component stubs copied from the author harness.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, onMounted } from 'vue';

import Report from './index.vue';
const api = vi.hoisted(() => ({
  permissions: new Set<string>(),
  status: vi.fn(),
  page: vi.fn(),
  export: vi.fn(),
  download: vi.fn(),
  source: vi.fn(),
  legacySale: vi.fn(),
  legacyPurchase: vi.fn(),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => api.permissions.has(code)),
  }),
}));
vi.mock('@vben/utils', () => ({ downloadFileFromBlobPart: api.download }));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  }),
}));
vi.mock('#/api/erp/report/trade-v2', () => ({
  getTradeStatus: api.status,
  getTradePage: api.page,
  exportTradeReport: api.export,
}));
vi.mock('./filter-choice.vue', () => ({
  default: defineComponent({ setup: () => () => h('div') }),
}));
vi.mock('#/views/erp/stock/report/modules/source-detail.vue', () => ({
  default: defineComponent({
    setup: (_, { expose }) => {
      expose({ open: api.source });
      return () => h('div');
    },
  }),
}));
vi.mock('#/views/erp/sale/report/legacy.vue', () => ({
  default: defineComponent({
    setup: () => {
      onMounted(api.legacySale);
      return () => h('div', '旧销售已挂载');
    },
  }),
}));
vi.mock('#/views/erp/purchase/report/legacy.vue', () => ({
  default: defineComponent({
    setup: () => {
      onMounted(api.legacyPurchase);
      return () => h('div', '旧采购已挂载');
    },
  }),
}));
vi.mock('ant-design-vue', () => {
  const box = defineComponent({
    props: ['message', 'description'],
    setup:
      (p, { slots }) =>
      () =>
        h('div', [p.message, p.description, slots.default?.()]),
  });
  const button = defineComponent({
    props: ['loading', 'disabled'],
    setup:
      (p, { slots, attrs }) =>
      () =>
        h(
          'button',
          { ...attrs, disabled: p.loading || p.disabled },
          slots.default?.(),
        ),
  });
  const input = defineComponent({
    props: ['value'],
    emits: ['update:value'],
    setup:
      (p, { emit, attrs }) =>
      () =>
        h('input', {
          ...attrs,
          value: p.value,
          onInput: (e: Event) =>
            emit('update:value', (e.target as HTMLInputElement).value),
        }),
  });
  const range = defineComponent({
    props: ['value'],
    emits: ['update:value'],
    setup:
      (p, { emit }) =>
      () =>
        h('input', {
          'data-testid': 'dates',
          value: p.value?.join(','),
          onInput: (e: Event) =>
            emit(
              'update:value',
              (e.target as HTMLInputElement).value.split(','),
            ),
        }),
  });
  const select = defineComponent({
    props: ['value', 'options', 'mode'],
    emits: ['update:value', 'change'],
    setup:
      (p, { emit, attrs }) =>
      () =>
        h(
          'select',
          {
            ...attrs,
            value: p.value,
            onChange: (e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              emit('update:value', v);
              emit('change', v);
            },
          },
          p.options?.map((o: { value: string; label: string }) =>
            h('option', { value: o.value }, o.label),
          ),
        ),
  });
  const table = defineComponent({
    props: ['columns', 'dataSource', 'pagination'],
    emits: ['change'],
    setup:
      (p, { emit, slots }) =>
      () =>
        h('section', [
          ...p.dataSource.map((record: Record<string, unknown>) =>
            h(
              'div',
              p.columns.map((column: { dataIndex: string }) =>
                h(
                  'span',
                  { 'data-field': column.dataIndex },
                  slots.bodyCell?.({ record, column }) ||
                    String(record[column.dataIndex] ?? ''),
                ),
              ),
            ),
          ),
          h(
            'button',
            {
              'data-testid': 'next-page',
              onClick: () =>
                emit('change', { current: 2, pageSize: 20 }, {}, {}),
            },
            '下一页',
          ),
        ]),
  });
  return {
    Alert: box,
    Button: button,
    Input: input,
    Select: select,
    DatePicker: { RangePicker: range },
    Table: table,
    Tabs: box,
    TabPane: box,
  };
});
const apps: Array<ReturnType<typeof createApp>> = [];
function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp(Report, { kind: 'purchase' });
  app.mount(host);
  apps.push(app);
  return host;
}
async function flush() {
  for (let n = 0; n < 8; n++) {
    await Promise.resolve();
    await nextTick();
  }
}
function totalCell(host: HTMLElement, title: string, rowIndex: number) {
  const table = host.querySelector('table');
  if (!table) throw new Error('Missing actual summary table');
  const headings = [...table.querySelectorAll('thead th')].map((cell) =>
    cell.textContent?.trim(),
  );
  return table
    .querySelectorAll('tbody tr')
    [rowIndex]?.querySelectorAll('td')
    [headings.indexOf(title)]?.textContent?.trim();
}
beforeEach(() => {
  vi.clearAllMocks();
  api.permissions.clear();
  api.permissions.add('erp:purchase-report-v2:query');
  api.status.mockResolvedValue({
    status: 'READY',
    reason: '可查询',
    cutoverAt: '2000-01-01T00:00:00',
    coverageWarnings: [],
    availableBusinessTypes: ['PURCHASE_IN', 'PURCHASE_RETURN'],
  });
});
afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount());
  document.body.innerHTML = '';
});
describe('00F独立：采购退货退款、当前成本与未知损益', () => {
  it('退款100和成本80分别展示且本页/全部损益都不可用，不产生20', async () => {
    const purchase = {
      postingId: 1,
      businessType: 'PURCHASE_IN',
      bizId: 401,
      bizNo: 'IN401',
      returnDifferenceProfit: null,
      metricStates: { returnDifferenceProfit: 'NOT_APPLICABLE' },
    };
    const returned = {
      postingId: 2,
      businessType: 'PURCHASE_RETURN',
      bizId: 701,
      bizNo: 'RET701',
      returnMode: 10,
      sourceRole: 'SOURCE_PURCHASE_IN',
      sourcePurchaseInId: 401,
      sourcePurchaseInNo: 'IN401',
      costBasis: 'CURRENT_AVERAGE',
      returnGrossAmount: '100',
      returnFinancialCost: '80',
      returnDifferenceProfit: null,
      metricStates: { returnDifferenceProfit: 'TAX_BASIS_UNCONFIRMED' },
    };
    api.page.mockResolvedValue({
      page: { list: [purchase, returned], total: 2 },
      summary: {
        returnGrossAmount: '100',
        returnFinancialCost: '80',
        returnDifferenceProfit: null,
        metricStates: { returnDifferenceProfit: 'TAX_BASIS_UNCONFIRMED' },
      },
      queryContext: {},
    });
    const host = mount();
    await flush();
    expect(
      host.querySelectorAll('[data-field="returnGrossAmount"]')[1]?.textContent,
    ).toBe('100');
    expect(
      host.querySelectorAll('[data-field="returnFinancialCost"]')[1]
        ?.textContent,
    ).toBe('80');
    expect(host.textContent).toContain('退货时两套当前均价');
    expect(totalCell(host, '退货差额损益', 0)).toBe('不可用');
    expect(totalCell(host, '退货差额损益', 1)).toBe('不可用');
    expect(api.source).not.toHaveBeenCalled();
  });
  it('无采购退货期间差额不适用；成本屏蔽不转换成零', async () => {
    api.page.mockResolvedValue({
      page: {
        list: [
          {
            postingId: 1,
            businessType: 'PURCHASE_IN',
            bizId: 401,
            bizNo: 'IN401',
            returnDifferenceProfit: null,
            financialCost: null,
            metricStates: {
              returnDifferenceProfit: 'NOT_APPLICABLE',
              financialCost: 'MASKED',
            },
          },
        ],
        total: 1,
      },
      summary: {
        returnDifferenceProfit: null,
        financialCost: null,
        metricStates: {
          returnDifferenceProfit: 'NOT_APPLICABLE',
          financialCost: 'MASKED',
        },
      },
      queryContext: {},
    });
    const host = mount();
    await flush();
    expect(totalCell(host, '退货差额损益', 0)).toBe('不适用');
    expect(totalCell(host, '退货差额损益', 1)).toBe('不适用');
    expect(totalCell(host, '财务净成本', 0)).toBe('****');
    expect(totalCell(host, '财务净成本', 1)).toBe('****');
  });
});
