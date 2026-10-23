import type { Component } from 'vue';

import { createApp, defineComponent, h, nextTick, onMounted } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PurchaseEntry from '#/views/erp/purchase/report/index.vue';
import SaleEntry from '#/views/erp/sale/report/index.vue';

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
vi.mock('@vben/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vben/utils')>();
  return {
    ...actual,
    downloadFileFromBlobPart: api.download,
    mergeRouteModules: () => [],
    traverseTreeValues: () => [],
  };
});
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
vi.mock(
  '#/views/erp/sale/report/modules/customer-receivable-overview-table.vue',
  () => ({
    default: defineComponent({ setup: () => () => h('div', '只读子表') }),
  }),
);
vi.mock(
  '#/views/erp/sale/report/modules/pick-delivery-readonly-table.vue',
  () => ({
    default: defineComponent({ setup: () => () => h('div', '只读子表') }),
  }),
);
vi.mock(
  '#/views/erp/sale/report/modules/sale-order-fulfillment-readonly-table.vue',
  () => ({
    default: defineComponent({ setup: () => () => h('div', '只读子表') }),
  }),
);
vi.mock(
  '#/views/erp/sale/report/modules/sale-return-adjust-readonly-table.vue',
  () => ({
    default: defineComponent({ setup: () => () => h('div', '只读子表') }),
  }),
);
vi.mock(
  '#/views/erp/purchase/report/modules/purchase-fulfillment-readonly-table.vue',
  () => ({
    default: defineComponent({ setup: () => () => h('div', '只读子表') }),
  }),
);
vi.mock(
  '#/views/erp/purchase/report/modules/purchase-return-adjust-readonly-table.vue',
  () => ({
    default: defineComponent({ setup: () => () => h('div', '只读子表') }),
  }),
);
vi.mock(
  '#/views/erp/purchase/report/modules/supplier-payable-overview-table.vue',
  () => ({
    default: defineComponent({ setup: () => () => h('div', '只读子表') }),
  }),
);
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
function mount(component: Component = Report, props?: Record<string, unknown>) {
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
beforeEach(() => {
  vi.clearAllMocks();
  api.permissions.clear();
  api.permissions.add('erp:sale-report-v2:query');
  api.status.mockResolvedValue({
    status: 'READY',
    reason: '数据可查询',
    cutoverAt: '2000-01-01T00:00:00',
    coverageWarnings: [],
    availableBusinessTypes: ['SALE_OUT'],
  });
  api.page.mockResolvedValue(bundle());
  api.export.mockResolvedValue(new Blob(['excel']));
});
afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount());
  document.body.innerHTML = '';
});
describe('新版商品报表实际页面行为', () => {
  it('采购退货展示独立来源和当前均价，退款100成本80不显示差额20', async () => {
    api.permissions.clear();
    api.permissions.add('erp:purchase-report-v2:query');
    const data = bundle();
    api.page.mockResolvedValue({
      ...data,
      page: {
        total: 1,
        list: [
          {
            postingId: 80,
            businessType: 'PURCHASE_RETURN',
            bizId: 81,
            bizNo: 'CGTH81',
            returnMode: 10,
            sourceRole: 'SOURCE_PURCHASE_IN',
            sourcePurchaseInId: 71,
            sourcePurchaseInNo: 'CGRK71',
            sourceOrderNo: 'CGDD31',
            returnDocumentOrderNo: 'CGDD88',
            traceSaleReturnId: 61,
            traceSaleReturnNo: 'XSTH61',
            costBasis: 'CURRENT_AVERAGE',
            returnGrossAmount: '100',
            returnFinancialCost: '80',
            netQuantity: '-1',
            returnDifferenceProfit: null,
            returnDifferenceStatus: 'TAX_BASIS_UNCONFIRMED',
            metricStates: { returnDifferenceProfit: 'TAX_BASIS_UNCONFIRMED' },
          },
        ],
      },
    });
    const host = mount(Report, { kind: 'purchase' });
    await flush();
    expect(
      host.querySelector('[data-field="returnFinancialCost"]')?.textContent,
    ).toBe('80');
    expect(
      host.querySelector('[data-field="returnDifferenceProfit"]')?.textContent,
    ).toBe('不可用');
    expect(
      host.querySelector('[data-field="costBasis"]')?.textContent,
    ).toContain('两套当前均价');
    expect(
      host.querySelector('[data-field="sourcePurchaseInNo"] button'),
    ).toBeNull();
    expect(
      host.querySelector('[data-field="traceSaleReturnNo"] button'),
    ).toBeNull();
    expect(
      host.querySelector('[data-field="sourceOrderNo"]')?.textContent,
    ).toBe('CGDD31');
    expect(
      host.querySelector('[data-field="returnDocumentOrderNo"]')?.textContent,
    ).toBe('CGDD88');
    expect(api.source).not.toHaveBeenCalled();
  });
  it('采购退货两个追溯入口分别检验来源权限与真实类型，不借报表权限打开', async () => {
    api.permissions.clear();
    api.permissions.add('erp:purchase-report-v2:query');
    api.permissions.add('erp:purchase-in:query');
    api.permissions.add('erp:sale-return:query');
    api.page.mockResolvedValue({
      ...bundle(),
      page: {
        total: 1,
        list: [
          {
            postingId: 80,
            businessType: 'PURCHASE_RETURN',
            bizId: 81,
            sourceRole: 'SOURCE_PURCHASE_IN',
            sourcePurchaseInId: 71,
            sourcePurchaseInNo: 'CGRK71',
            traceSaleReturnId: 61,
            traceSaleReturnNo: 'XSTH61',
          },
        ],
      },
    });
    const host = mount(Report, { kind: 'purchase' });
    await flush();
    button(host, 'CGRK71').click();
    await flush();
    expect(api.source).toHaveBeenLastCalledWith(70, 71);
    button(host, 'XSTH61').click();
    await flush();
    expect(api.source).toHaveBeenLastCalledWith(60, 61);
    api.permissions.delete('erp:sale-return:query');
    button(host, 'XSTH61').click();
    await flush();
    expect(api.source).toHaveBeenCalledTimes(2);
  });
  it('无query权限不读API', async () => {
    api.permissions.clear();
    const host = mount();
    await flush();
    expect(api.status).not.toHaveBeenCalled();
    expect(api.page).not.toHaveBeenCalled();
    expect(host.textContent).toContain('没有新版');
  });
  it('本页合计与全部合计和缺失状态独立，金额遮罩不显示0', async () => {
    const host = mount();
    await flush();
    expect(host.textContent).toContain('本页合计');
    expect(host.textContent).toContain('全部合计');
    expect(
      host.querySelector('[data-field="financialCost"]')?.textContent,
    ).toBe('****');
    expect(host.querySelector('[data-field="netAmount"]')?.textContent).toBe(
      '不可用',
    );
  });
  it('分页与导出沿用已查询过滤而不是未提交编辑', async () => {
    api.permissions.add('erp:sale-report-v2:export');
    const host = mount();
    await flush();
    const input = host.querySelector(
      'input[placeholder="单据编号"]',
    ) as HTMLInputElement;
    input.value = '尚未查询';
    input.dispatchEvent(new Event('input'));
    await flush();
    (
      host.querySelector('[data-testid="next-page"]') as HTMLButtonElement
    ).click();
    await flush();
    expect(api.page.mock.calls.at(-1)?.[1]).toMatchObject({
      pageNo: 2,
      bizNo: undefined,
    });
    button(host, '导出全部').click();
    await flush();
    expect(api.export.mock.calls[0]?.[1]).toMatchObject({
      pageNo: 2,
      bizNo: undefined,
    });
    expect(api.download).toHaveBeenCalledTimes(1);
  });
  it('慢响应不会覆盖新查询及其全部合计', async () => {
    const host = mount();
    await flush();
    let resolve!: (v: ReturnType<typeof bundle>) => void;
    api.page
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      )
      .mockResolvedValueOnce(bundle('999'));
    button(host, '查询').click();
    await flush();
    button(host, '重置').click();
    await flush();
    resolve(bundle('111'));
    await flush();
    expect(host.querySelector('[data-field="grossAmount"]')?.textContent).toBe(
      '999',
    );
    expect(host.textContent).not.toContain('111');
  });
  it('查询失败清空金额合计与导出状态', async () => {
    api.permissions.add('erp:sale-report-v2:export');
    const host = mount();
    await flush();
    api.page.mockRejectedValueOnce(new Error('源数据错误'));
    button(host, '查询').click();
    await flush();
    expect(host.textContent).toContain('源数据错误');
    expect(host.textContent).not.toContain('全部合计');
    expect(button(host, '导出全部').disabled).toBe(true);
  });
  it('下钻需要对应业务权限，不能仅凭报表权限', async () => {
    const host = mount();
    await flush();
    expect(
      [...host.querySelectorAll('button')].some((b) => b.textContent === 'XS7'),
    ).toBe(false);
    expect(api.source).not.toHaveBeenCalled();
  });
  it('有来源权限才打开真实源类型和主单', async () => {
    api.permissions.add('erp:sale-out:query');
    const host = mount();
    await flush();
    button(host, 'XS7').click();
    await flush();
    expect(api.source).toHaveBeenCalledWith(50, 7);
  });
  it('早于切换不静默裁剪，显式按钮采用切换日', async () => {
    api.status.mockResolvedValueOnce({
      status: 'READY',
      reason: '可查询',
      cutoverAt: '2026-09-09T13:25:30',
      coverageWarnings: [],
      availableBusinessTypes: [],
    });
    const host = mount();
    await flush();
    expect(api.page).not.toHaveBeenCalled();
    button(host, '从切换时间开始').click();
    await flush();
    expect(api.page.mock.calls[0]?.[1].postedFrom).toBe('2026-09-09 13:25:30');
  });
  it.each([
    ['sale', SaleEntry],
    ['purchase', PurchaseEntry],
  ] as const)('仅%s新版角色不初始化旧组件', async (kind, entry) => {
    api.permissions.clear();
    api.permissions.add(`erp:${kind}-report-v2:query`);
    mount(entry, {});
    await flush();
    expect(api.legacySale).not.toHaveBeenCalled();
    expect(api.legacyPurchase).not.toHaveBeenCalled();
    expect(api.status).toHaveBeenCalledWith(kind);
  });
  it.each([
    ['sale', SaleEntry],
    ['purchase', PurchaseEntry],
  ] as const)('仅%s旧角色不请求新API', async (kind, entry) => {
    api.permissions.clear();
    api.permissions.add(`erp:${kind}-report:query`);
    mount(entry, {});
    await flush();
    expect(api.status).not.toHaveBeenCalled();
    expect(
      kind === 'sale' ? api.legacySale : api.legacyPurchase,
    ).toHaveBeenCalledTimes(1);
  });
});
