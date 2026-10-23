import { createApp, defineComponent, h, nextTick, onMounted } from 'vue';

// Independent behavioral cases; shared component stubs copied from the author harness.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
          p.options?.map((o: { label: string; value: string }) =>
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
function mount(component = Report, props?: Record<string, unknown>) {
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp(component, props ?? { kind: 'sale' });
  app.mount(host);
  apps.push(app);
  return host;
}
async function flush() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function button(host: HTMLElement, text: string) {
  const found = [...host.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  );
  if (!found) throw new Error(`missing ${text}`);
  return found;
}
function bundle(amount = '13') {
  return {
    page: {
      list: [
        {
          postingId: 1,
          businessType: 'SALE_OUT',
          bizId: 7,
          bizNo: 'XS7',
          grossAmount: amount,
          positiveQuantity: '1',
          returnQuantity: '0',
          netQuantity: '1',
          financialCost: null,
          settlementCost: '5',
          metricStates: { financialCost: 'MASKED' },
        },
      ],
      total: 22,
    },
    summary: {
      grossAmount: amount,
      missingSnapshotCount: 0,
      missingGrossCount: 0,
    },
    queryContext: {
      postedFrom: '2026-01-01T00:00',
      postedTo: '2026-01-02T00:00',
      consistency: '同次事务',
    },
  };
}
function firstRow(result: ReturnType<typeof bundle>) {
  const row = result.page.list[0];
  if (!row) throw new Error('Independent fixture must contain its source row');
  return row;
}
beforeEach(() => {
  vi.clearAllMocks();
  api.permissions.clear();
  api.permissions.add('erp:sale-report-v2:query');
  api.status.mockResolvedValue({
    status: 'READY',
    reason: '可查询',
    cutoverAt: '2000-01-01T00:00:00',
    coverageWarnings: [],
    availableBusinessTypes: ['SALE_OUT', 'SALE_RETURN'],
  });
  api.page.mockResolvedValue(bundle());
  api.export.mockResolvedValue(new Blob(['independent Excel stub']));
});
afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount());
  document.body.innerHTML = '';
});
describe('独立验收：真实挂载的精度、归属与分组追查', () => {
  it('大额净值与负退货的本页合计保留六位精度，全部合计独立', async () => {
    const result = bundle('123456789012345.123456');
    result.page.list.push({
      ...firstRow(result),
      postingId: 2,
      businessType: 'SALE_RETURN',
      bizId: 8,
      bizNo: 'RETURN8',
      grossAmount: '-0.000001',
    });
    result.summary.grossAmount = '999999999999999.999999';
    api.page.mockResolvedValueOnce(result);
    const host = mount();
    await flush();
    expect(host.querySelector('[data-field="grossAmount"]')?.textContent).toBe(
      '123,456,789,012,345.123456',
    );
    expect(host.textContent).toContain('123,456,789,012,345.123455');
    expect(host.textContent).toContain('999,999,999,999,999.999999');
    expect(host.querySelector('[data-field="netAmount"]')?.textContent).toBe(
      '不可用',
    );
  });
  it('名称快照与当前业务身份分别展示，未知来源字段明确缺失', async () => {
    const result = bundle();
    Object.assign(firstRow(result), {
      accountingDeptName: '原销售部门',
      stockDeptName: '真实库存部门',
      warehouseName: '原发货仓',
      saleUserName: '原销售员',
      dataStatus: 'SOURCE_SNAPSHOT_MISSING',
      productName: null,
    });
    api.page.mockResolvedValueOnce(result);
    const host = mount();
    await flush();
    expect(host.textContent).toContain('原销售部门');
    expect(host.textContent).toContain('真实库存部门');
    expect(host.textContent).toContain('原发货仓');
    expect(host.textContent).toContain('原销售员');
    expect(host.querySelector('[data-field="productName"]')?.textContent).toBe(
      '未记录',
    );
    expect(
      host.querySelector('[data-field="dataStatus"]')?.textContent,
    ).toContain('缺当时交易快照');
  });
  it('真实分组点击使用实体键追查，返回保留原分组过滤', async () => {
    const host = mount();
    await flush();
    const selector = [...host.querySelectorAll('select')].find((select) =>
      [...select.options].some((option) => option.value === 'GROUP'),
    );
    if (!selector) throw new Error('missing group view selector');
    const grouped = {
      page: {
        list: [
          { groupKey: 101, groupLabel: '历史配件名称', grossAmount: '400' },
        ],
        total: 1,
      },
      summary: { grossAmount: '400' },
      queryContext: {
        postedFrom: '2026-01-01T00:00:00',
        postedTo: '2026-01-02T00:00:00',
        consistency: '同次事务',
      },
    };
    api.page.mockResolvedValueOnce(grouped);
    selector.value = 'GROUP';
    selector.dispatchEvent(new Event('change'));
    await flush();
    expect(host.textContent).toContain('历史配件名称');
    const groupButton = [...host.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '101',
    );
    if (!groupButton) throw new Error('missing group drill button');
    groupButton.click();
    await flush();
    expect(api.page.mock.calls.at(-1)?.[1]).toMatchObject({
      pageNo: 1,
      productId: 101,
    });
    expect(api.page.mock.calls.at(-1)?.[2]).toBe(false);
    button(host, '返回原分组').click();
    await flush();
    expect(api.page.mock.calls.at(-1)?.[1].productId).toBeUndefined();
    expect(api.page.mock.calls.at(-1)?.[2]).toBe(true);
  });
  it('接口不能查询状态时不生成空报表和导出', async () => {
    api.permissions.add('erp:sale-report-v2:export');
    api.status.mockResolvedValueOnce({
      status: 'SCHEMA_MISSING',
      reason: '来源快照未迁移',
      coverageWarnings: [],
      availableBusinessTypes: [],
    });
    const host = mount();
    await flush();
    expect(api.page).not.toHaveBeenCalled();
    expect(api.export).not.toHaveBeenCalled();
    expect(host.textContent).toContain('来源快照未迁移');
    expect(host.textContent).not.toContain('全部合计');
  });
  it('空页本页合计继承全部合计的未知与遮罩，真实零数量仍为零', async () => {
    const empty = {
      page: { list: [], total: 0 },
      summary: {
        netQuantity: '0',
        grossAmount: '0',
        netAmount: null,
        financialCost: null,
        receivedAmount: null,
        metricStates: {
          netAmount: 'TAX_BASIS_UNCONFIRMED',
          financialCost: 'MASKED',
          receivedAmount: 'SETTLEMENT_ALLOCATION_PENDING',
        },
      },
      queryContext: {
        postedFrom: '2026-01-01T00:00:00',
        postedTo: '2026-01-02T00:00:00',
        consistency: '同次事务',
      },
    };
    api.page.mockResolvedValueOnce(empty);
    const host = mount();
    await flush();
    const totals = host.querySelector('table');
    if (!totals) throw new Error('missing totals table');
    const headings = [...totals.querySelectorAll('thead th')].map((cell) =>
      cell.textContent?.trim(),
    );
    const firstTotalRow = totals.querySelector('tbody tr');
    if (!firstTotalRow) throw new Error('missing first total row');
    const page = [...firstTotalRow.querySelectorAll('td')];
    expect(page[headings.indexOf('净数量')]?.textContent?.trim()).toBe('0');
    expect(page[headings.indexOf('未税净交易额')]?.textContent?.trim()).toBe(
      '不可用',
    );
    expect(page[headings.indexOf('财务净成本')]?.textContent?.trim()).toBe(
      '****',
    );
    expect(page[headings.indexOf('已收金额')]?.textContent?.trim()).toBe(
      '不可用',
    );
  });
});
