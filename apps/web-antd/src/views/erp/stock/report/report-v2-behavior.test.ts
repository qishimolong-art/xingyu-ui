import { createApp, defineComponent, h, nextTick } from 'vue';

/* oxlint-disable import/first -- Vitest mocks must be registered before importing Vue components under test. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  permissions: new Set<string>(),
  status: vi.fn(),
  page: vi.fn(),
  summary: vi.fn(),
  export: vi.fn(),
  products: vi.fn(),
  confirm: vi.fn(),
  download: vi.fn(),
  sourceOpen: vi.fn(),
  options: vi.fn(),
  routePath: '/erp/business-report/inventory/realtime',
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({
    matched: [{ path: api.routePath }],
    path: api.routePath,
  }),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => api.permissions.has(code)),
  }),
}));
vi.mock('@vben/utils', () => ({
  bindMethods: () => {},
  createApiEncrypt: () => ({}),
  downloadFileFromBlobPart: api.download,
  isString: (value: unknown) => typeof value === 'string',
  merge: (...objects: Array<Record<string, unknown>>) =>
    Object.assign({}, ...objects),
  mergeRouteModules: () => [],
  traverseTreeValues: () => [],
}));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  }),
}));
vi.mock('#/api/erp/report/stock-v2', () => ({
  getStockReportStatus: api.status,
  getStockReportPage: api.page,
  getStockReportSummary: api.summary,
  getStockReportOptions: api.options,
  exportStockReportV2: api.export,
  getReportProductOptions: api.products,
  confirmStockReportOpening: api.confirm,
}));
vi.mock('#/api/erp/stock/warehouse', () => ({
  getStockWarehouseFilterOptions: async () => [
    { id: 3, displayName: '一号仓', status: 0 },
  ],
  getStockWarehouseOwnerDeptSimpleList: async () => [
    { id: 5, name: '一部', status: 0 },
    { id: 6, name: '停用部', status: 1 },
  ],
}));
vi.mock('./modules/source-detail.vue', () => ({
  default: defineComponent({
    setup: (_, { expose }) => {
      expose({ open: api.sourceOpen });
      return () => h('div');
    },
  }),
}));
vi.mock('../record/modules/stock-record-tab.vue', () => ({
  default: defineComponent({
    props: ['tableTitle'],
    setup: (props) => () => h('div', props.tableTitle || '库存流水明细账'),
  }),
}));
vi.mock('./modules/stock-realtime-table.vue', () => ({
  default: defineComponent({ setup: () => () => h('div', '实时库存') }),
}));
vi.mock('./modules/stock-check-readonly-table.vue', () => ({
  default: defineComponent({ setup: () => () => h('div', '配件盈亏明细表') }),
}));
vi.mock('./modules/stock-transfer-out-detail-report-table.vue', () => ({
  default: defineComponent({
    setup: () => () => h('div', '调拨出库查询报表'),
  }),
}));
vi.mock('./modules/stock-transfer-in-detail-report-table.vue', () => ({
  default: defineComponent({
    setup: () => () => h('div', '调拨入库查询报表'),
  }),
}));
vi.mock('./modules/stock-age-table.vue', () => ({ default: defineComponent({ setup: () => () => h('div', '库龄分析') }) }));
vi.mock('./modules/stock-out-detail-report-table.vue', () => ({ default: defineComponent({ setup: () => () => h('div', '其他出库明细报表') }) }));
vi.mock('./modules/stock-in-detail-report-table.vue', () => ({
  default: defineComponent({
    setup: () => () => h('div', '其他入库明细报表'),
  }),
}));
vi.mock('./modules/warehouse-move-readonly-table.vue', () => ({
  default: defineComponent({ setup: () => () => h('div', '仓库移货参考') }),
}));
vi.mock('ant-design-vue', () => {
  const box = defineComponent({
    props: ['message'],
    setup:
      (props, { slots }) =>
      () =>
        h('div', [props.message, slots.default?.(), slots.action?.()]),
  });
  const input = defineComponent({
    inheritAttrs: false,
    props: ['value'],
    emits: ['update:value'],
    setup:
      (props, { emit, attrs }) =>
      () =>
        h('input', {
          ...attrs,
          value: props.value,
          onInput: (event: Event) =>
            emit('update:value', (event.target as HTMLInputElement).value),
        }),
  });
  const select = defineComponent({
    inheritAttrs: false,
    props: ['value', 'options'],
    emits: ['update:value'],
    setup:
      (props, { emit, attrs }) =>
      () =>
        h(
          'select',
          {
            ...attrs,
            value: props.value ?? '',
            onChange: (event: Event) =>
              emit(
                'update:value',
                Number((event.target as HTMLSelectElement).value) || undefined,
              ),
          },
          [
            h('option', { value: '' }, '请选择'),
            ...(props.options || []).map(
              (option: { disabled?: boolean; label: string; value: number }) =>
                h(
                  'option',
                  { value: option.value, disabled: option.disabled },
                  option.label,
                ),
            ),
          ],
        ),
  });
  const button = defineComponent({
    props: ['disabled', 'loading'],
    setup:
      (props, { slots, attrs }) =>
      () =>
        h(
          'button',
          { ...attrs, disabled: props.disabled || props.loading },
          slots.default?.(),
        ),
  });
  const range = defineComponent({
    inheritAttrs: false,
    props: ['value'],
    emits: ['update:value'],
    setup:
      (props, { emit, attrs }) =>
      () =>
        h('input', {
          ...attrs,
          value: props.value?.join(','),
          onInput: (event: Event) =>
            emit(
              'update:value',
              (event.target as HTMLInputElement).value.split(','),
            ),
        }),
  });
  const table = defineComponent({
    props: ['dataSource', 'columns', 'pagination'],
    emits: ['change'],
    setup:
      (props, { emit, slots }) =>
      () =>
        h('div', [
          ...(props.dataSource || []).map((record: unknown) =>
            h(
              'div',
              (props.columns || []).map((column: unknown) =>
                slots.bodyCell?.({ record, column }),
              ),
            ),
          ),
          h(
            'button',
            {
              onClick: () =>
                emit('change', { current: 2, pageSize: 20 }, {}, {}),
            },
            '下一页',
          ),
        ]),
  });
  const modal = defineComponent({
    props: ['confirmLoading'],
    emits: ['ok', 'cancel'],
    setup:
      (props, { emit, slots }) =>
      () =>
        h('div', [
          slots.default?.(),
          h(
            'button',
            { disabled: props.confirmLoading, onClick: () => emit('ok') },
            '确认核对结果',
          ),
          h('button', { onClick: () => emit('cancel') }, '关闭'),
        ]),
  });
  const tabs = defineComponent({
    emits: ['update:activeKey'],
    setup:
      (_, { emit, slots }) =>
      () =>
        h('div', [
          h(
            'button',
            { onClick: () => emit('update:activeKey', 'movement') },
            '切换新版流水',
          ),
          h(
            'button',
            { onClick: () => emit('update:activeKey', 'legacy') },
            '切换历史',
          ),
          slots.default?.(),
        ]),
  });
  return {
    Alert: box,
    Button: button,
    Select: select,
    Table: table,
    Modal: modal,
    Popover: box,
    Tag: box,
    Tabs: tabs,
    TabPane: box,
    Checkbox: Object.assign(box, { Group: box }),
    Input: Object.assign(input, { TextArea: input }),
    InputNumber: input,
    DatePicker: Object.assign(input, { RangePicker: range }),
  };
});

import ReportIndex from './index.vue';
import OpeningForm from './modules/opening-form.vue';
import StockTable from './modules/stock-v2-table.vue';

const mounted: Array<() => void> = [];
async function flush() {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}
function mount(component: Parameters<typeof createApp>[0], props = {}) {
  const element = document.createElement('div');
  document.body.append(element);
  const app = createApp(component, props);
  app.mount(element);
  mounted.push(() => {
    app.unmount();
    element.remove();
  });
  return element;
}
function click(element: HTMLElement, label: string) {
  const button = [...element.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!button) throw new Error(`button missing: ${label}`);
  button.click();
}
async function input(element: HTMLElement, label: string, value: string) {
  const field = element.querySelector(
    `[aria-label="${label}"]`,
  ) as HTMLInputElement;
  field.value = value;
  field.dispatchEvent(
    new Event(field.tagName === 'SELECT' ? 'change' : 'input', {
      bubbles: true,
    }),
  );
  await nextTick();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const amountRow = {
  stockId: 1,
  postingId: 9,
  productId: 2,
  warehouseId: 3,
  productName: '配件A',
  quantity: '2',
  financialMovement: '10',
  settlementMovement: '12',
  financialMasked: false,
  settlementMasked: false,
  dataStatus: 'READY',
};
beforeEach(() => {
  vi.clearAllMocks();
  api.permissions.clear();
  api.routePath = '/erp/business-report/inventory/realtime';
  api.status.mockResolvedValue({
    status: 'READY',
    cutoverAt: '2026-09-01 00:00:00',
  });
  api.page.mockResolvedValue({ list: [amountRow], total: 40 });
  api.summary.mockResolvedValue({
    rowCount: 40,
    dataStatus: 'COMPLETE',
    inQuantity: '80',
    outQuantity: '0',
    financialInAmount: '400',
    financialOutAmount: '0',
    settlementInAmount: '480',
    settlementOutAmount: '0',
  });
  api.products.mockResolvedValue({
    list: [{ id: 2, code: 'A', name: '配件A' }],
    total: 1,
  });
  api.options.mockResolvedValue({
    warehouses: [{ id: 3, name: '一号仓', status: 0 }],
    stockDepartments: [
      { id: 5, name: '一部', status: 0 },
      { id: 6, name: '停用部', status: 1 },
    ],
  });
  api.confirm.mockResolvedValue(true);
  api.export.mockResolvedValue(new Blob(['x']));
});
afterEach(() => {
  mounted.splice(0).forEach((unmount) => unmount());
});

describe('库存v2 Vue实际挂载交互', () => {
  it('收发存区分人工与新库存起点，缺失来源及金额不自动推定', async () => {
    api.permissions.add('erp:stock-record:query');
    api.page.mockResolvedValue({
      list: [
        {
          ...amountRow,
          stockId: 1,
          originKind: 'MANUAL_OPENING',
          availableFrom: '2026-09-01T00:00:00',
          cutoverAt: '2026-09-01T00:00:00',
          openingQuantity: '10',
        },
        {
          ...amountRow,
          stockId: 2,
          productName: '新库存配件',
          originKind: 'NEW_DIMENSION',
          availableFrom: '2026-09-09T10:30:00.123456',
          cutoverAt: '2026-09-01T00:00:00',
          openingQuantity: '0',
        },
        {
          ...amountRow,
          stockId: 3,
          originKind: null,
          availableFrom: null,
          dataStatus: 'MISSING_OPENING',
          openingQuantity: null,
        },
      ],
      total: 3,
    });
    api.summary.mockResolvedValue({
      dataStatus: 'INCOMPLETE',
      missingOpeningCount: 1,
      openingQuantity: null,
    });
    const element = mount(StockTable, { reportType: 'BALANCE' });
    await flush();
    expect(element.textContent).toContain('人工核对期初');
    expect(element.textContent).toContain('新库存受控起点');
    expect(element.textContent).toContain('未记录起点来源');
    expect(element.textContent).toContain('未记录起点时间');
    expect(element.textContent).toContain('2026-09-09T10:30:00.123456');
    expect(element.textContent).toContain('数据可计算');
    expect(element.textContent).toContain('不可用');
    expect(element.textContent).not.toContain('已核对');
    expect(api.page.mock.calls[0]?.[1]).not.toHaveProperty('availableFrom');
    expect(api.confirm).not.toHaveBeenCalled();
  });
  it('流水展示实际起点且保留金额遮罩，导出仍使用原查询区间', async () => {
    api.permissions.add('erp:stock-record:query');
    api.permissions.add('erp:stock-record:export');
    api.page.mockResolvedValue({
      list: [
        {
          ...amountRow,
          originKind: 'NEW_DIMENSION',
          availableFrom: '2026-09-09T11:00:00',
          financialMasked: true,
          financialMovement: '999999888',
        },
      ],
      total: 1,
    });
    const element = mount(StockTable, { reportType: 'MOVEMENT' });
    await flush();
    expect(element.textContent).toContain('新库存受控起点');
    expect(element.textContent).toContain('2026-09-09T11:00:00');
    expect(element.textContent).not.toContain('999999888');
    click(element, '导出全部');
    await flush();
    expect(api.export.mock.calls[0]?.[1].postedFrom).toBe(
      api.page.mock.calls[0]?.[1].postedFrom,
    );
    expect(api.export.mock.calls[0]?.[1]).not.toHaveProperty('originKind');
  });
  it('显式从日内切换时间开始，不静默按午夜截断', async () => {
    api.permissions.add('erp:stock-record:query');
    api.status.mockResolvedValue({
      status: 'READY',
      cutoverAt: '2026-09-09T10:30:00',
    });
    const element = mount(StockTable, { reportType: 'BALANCE' });
    await flush();
    click(element, '从切换时间开始');
    await flush();
    expect(api.page.mock.calls.at(-1)?.[1].postedFrom).toBe(
      '2026-09-09 10:30:00',
    );
    expect(element.textContent).toContain('开始时间包含，截止时间不包含');
  });
  it('安全历史选项的停用/归档对象仍可查询且保留状态说明', async () => {
    api.permissions.add('erp:stock-record:query');
    api.options.mockResolvedValue({
      warehouses: [{ id: 8, name: '历史仓', status: 1, archived: true }],
      stockDepartments: [{ id: 9, name: '历史部', status: 1 }],
    });
    const element = mount(StockTable, { reportType: 'BALANCE' });
    await flush();
    const option = element.querySelector(
      '[aria-label="查询仓库"] option[value="8"]',
    ) as HTMLOptionElement;
    expect(option.disabled).toBe(false);
    expect(option.textContent).toContain('已归档，历史可查');
    await input(element, '查询仓库', '8');
    click(element, '查询');
    await flush();
    expect(api.page.mock.calls.at(-1)?.[1].warehouseId).toBe(8);
  });
  it('收发存按业务类型展示净负数及零数量调价，不泄漏屏蔽成本', async () => {
    api.permissions.add('erp:stock-record:query');
    const byBizType = [
      {
        bizType: 50,
        quantity: '-4',
        financialMovement: '-440',
        settlementMovement: '-520',
      },
      {
        bizType: 90,
        quantity: '0',
        financialMovement: '0.000001',
        settlementMovement: '0.000002',
      },
    ];
    api.page.mockResolvedValue({
      list: [{ ...amountRow, byBizType }],
      total: 1,
    });
    api.summary.mockResolvedValue({
      rowCount: 1,
      dataStatus: 'COMPLETE',
      byBizType,
      financialMasked: true,
    });
    const element = mount(StockTable, { reportType: 'BALANCE' });
    await flush();
    expect(element.textContent).toContain('全部业务分类合计');
    expect(element.textContent).toContain('销售出库');
    expect(element.textContent).toContain('-520');
    expect(element.textContent).toContain('采购调价');
    const tables = [...element.querySelectorAll('.business-type-table')];
    expect(tables.at(-1)?.textContent).not.toContain('-440');
    expect(tables.at(-1)?.textContent).toContain('****');
  });
  it('经营报表库存入口按独立路由挂载真实复用页面', async () => {
    api.permissions.add('erp:stock:query');
    api.permissions.add('erp:stock-record:query');
    api.routePath = '/erp/business-report/inventory/realtime';
    const realtime = mount(ReportIndex);
    await flush();
    expect(realtime.textContent).toContain('实时库存');

    api.routePath = '/erp/business-report/inventory/balance';
    const balance = mount(ReportIndex);
    await flush();
    expect(balance.textContent).toContain('收发存汇总');

    api.routePath = '/erp/business-report/inventory/trace';
    const trace = mount(ReportIndex);
    await flush();
    expect(trace.textContent).toContain('商品追溯');

    api.routePath = '/erp/business-report/inventory/legacy';
    const legacy = mount(ReportIndex);
    await flush();
    expect(legacy.textContent).toContain('历史库存流水');

    api.permissions.add('erp:stock-in-detail-report:query');
    api.permissions.add('erp:stock-in:query');
    api.routePath = '/erp/business-report/inventory/other-in-detail';
    const stockInDetail = mount(ReportIndex);
    await flush();
    expect(stockInDetail.textContent).toContain('其他入库明细报表');
    expect(api.page).not.toHaveBeenCalled();
  });
  it('具备来源单查询权限才传实际业务类型及ID打开详情', async () => {
    api.permissions.add('erp:stock-record:query');
    api.permissions.add('erp:purchase-in:query');
    api.page.mockResolvedValue({
      list: [{ ...amountRow, bizType: 70, bizId: 123, bizNo: '采购来源' }],
      total: 1,
    });
    const element = mount(StockTable, { reportType: 'MOVEMENT' });
    await flush();
    click(element, '采购来源');
    await flush();
    expect(api.sourceOpen).toHaveBeenCalledWith(70, 123);
  });
  it('换仓重置旧配件并按新仓库重载安全选项', async () => {
    api.permissions.add('erp:report-stock-opening:confirm');
    const element = mount(OpeningForm);
    await flush();
    await input(element, '期初配件', '2');
    await input(element, '期初仓库', '3');
    await flush();
    expect(
      (element.querySelector('[aria-label="期初配件"]') as HTMLSelectElement)
        .value,
    ).toBe('');
    expect(api.products).toHaveBeenLastCalledWith('', 3);
  });
  it('没有查询权限不调用状态或页面接口，客户库存页不暴露期初核对入口', async () => {
    api.permissions.add('erp:report-stock-opening:confirm');
    api.routePath = '/erp/business-report/inventory/balance';
    const element = mount(ReportIndex);
    await flush();
    expect(api.status).not.toHaveBeenCalled();
    expect(api.page).not.toHaveBeenCalled();
    expect(api.products).not.toHaveBeenCalled();
    expect(element.textContent).not.toContain('库存期初核对');
  });
  it('禁用新口径显示原因，不请求页面或展示零金额合计', async () => {
    api.permissions.add('erp:stock-record:query');
    api.status.mockResolvedValue({
      status: 'DISABLED',
      reason: '请先确认切换配置',
    });
    const element = mount(StockTable, { reportType: 'MOVEMENT' });
    await flush();
    expect(element.textContent).toContain('请先确认切换配置');
    expect(api.page).not.toHaveBeenCalled();
    expect(element.querySelector('[data-testid="totals"]')).toBeNull();
  });
  it('分页保留已查询条件，导出只带全部过滤且需独立导出权限', async () => {
    api.permissions.add('erp:stock-record:query');
    api.permissions.add('erp:stock-record:export');
    const element = mount(StockTable, { reportType: 'MOVEMENT' });
    await flush();
    await input(element, '查询仓库', '3');
    click(element, '查询');
    await flush();
    click(element, '下一页');
    await flush();
    expect(api.page.mock.calls.at(-1)?.[1]).toMatchObject({
      warehouseId: 3,
      pageNo: 2,
      pageSize: 20,
    });
    click(element, '导出全部');
    await flush();
    expect(api.export.mock.calls[0]?.[1]).toMatchObject({ warehouseId: 3 });
    expect(api.export.mock.calls[0]?.[1]).not.toHaveProperty('pageNo');
    expect(api.download).toHaveBeenCalled();
    expect(element.textContent).toContain('本页合计');
    expect(element.textContent).toContain('全部合计');
  });
  it('重置与异步查询切换后，旧页面/汇总晚返回不能覆盖新结果', async () => {
    api.permissions.add('erp:stock-record:query');
    const oldPage = deferred<unknown>();
    const oldSummary = deferred<unknown>();
    api.page.mockReturnValueOnce(oldPage.promise);
    api.summary.mockReturnValueOnce(oldSummary.promise);
    const element = mount(StockTable, { reportType: 'MOVEMENT' });
    await flush();
    click(element, '重置');
    await flush();
    expect(api.page.mock.calls.at(-1)?.[1]).toMatchObject({
      pageNo: 1,
      pageSize: 20,
    });
    oldPage.resolve({
      list: [{ ...amountRow, productName: '旧响应商品' }],
      total: 1,
    });
    oldSummary.resolve({ rowCount: 1, inQuantity: '999999' });
    await flush();
    expect(element.textContent).toContain('配件A');
    expect(element.textContent).not.toContain('旧响应商品');
    expect(element.textContent).not.toContain('999,999');
  });
  it('隐藏金额不显示原值；缺失状态与无来源权限不能生成可点击单据', async () => {
    api.permissions.add('erp:stock-record:query');
    api.page.mockResolvedValue({
      list: [
        {
          ...amountRow,
          financialMasked: true,
          financialMovement: '987654321',
          dataStatus: 'SELF_MOVEMENT_ONLY',
          balanceMasked: true,
          balanceQuantity: '777777',
          bizType: 70,
          bizId: 123,
          bizNo: '采购来源',
        },
      ],
      total: 1,
    });
    api.summary.mockResolvedValue({
      financialMasked: true,
      financialInAmount: '987654321',
      dataStatus: 'INCOMPLETE',
      missingOpeningCount: 1,
    });
    const element = mount(StockTable, { reportType: 'MOVEMENT' });
    await flush();
    expect(element.textContent).toContain('****');
    expect(element.textContent).toContain('未核对期初 1 项');
    expect(element.textContent).not.toContain('987654321');
    expect(element.textContent).not.toContain('777,777');
    expect(
      [...element.querySelectorAll('button')].some(
        (button) => button.textContent === '采购来源',
      ),
    ).toBe(false);
    expect(
      [...element.querySelectorAll('button')].some(
        (button) => button.textContent === '导出全部',
      ),
    ).toBe(false);
  });
  it('期初不自动补零；校验、失败保留输入、防连击、成功关闭刷新', async () => {
    api.permissions.add('erp:report-stock-opening:confirm');
    const success = vi.fn();
    const close = vi.fn();
    const element = mount(OpeningForm, { onSuccess: success, onClose: close });
    await flush();
    expect(
      (element.querySelector('[aria-label="财务成本金额"]') as HTMLInputElement)
        .value,
    ).toBe('');
    click(element, '确认核对结果');
    await flush();
    expect(api.confirm).not.toHaveBeenCalled();
    const openingInputs: Array<[string, string]> = [
      ['期初仓库', '3'],
      ['期初配件', '2'],
      ['核对数量', '10'],
      ['财务成本金额', '999999999999999999.123456'],
      ['部门结算成本金额', '1200'],
      ['切换时间', '2026-09-01 00:00:00'],
      ['核对依据', '盘点核对A'],
    ];
    for (const [label, value] of openingInputs) {
      await input(element, label, value);
    }
    const request = deferred<boolean>();
    api.confirm.mockReturnValueOnce(request.promise);
    click(element, '确认核对结果');
    click(element, '确认核对结果');
    await flush();
    expect(api.confirm).toHaveBeenCalledTimes(1);
    expect(api.confirm.mock.calls[0]?.[0].financialAmount).toBe(
      '999999999999999999.123456',
    );
    request.reject(new Error('期初数量不一致'));
    await flush();
    expect(element.textContent).toContain('期初数量不一致');
    expect(close).not.toHaveBeenCalled();
    expect(
      (element.querySelector('[aria-label="财务成本金额"]') as HTMLInputElement)
        .value,
    ).toBe('999999999999999999.123456');
    click(element, '确认核对结果');
    await flush();
    expect(success).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
