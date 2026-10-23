import type { App, Component } from 'vue';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createApp, defineComponent, h, nextTick, reactive } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Purchase from '#/views/erp/purchase/report/index.vue';
import Overview from '#/views/erp/report/overview/index.vue';
import Sale from '#/views/erp/sale/report/index.vue';
import Stock from '#/views/erp/stock/report/index.vue';

import Shell from './business-report-shell.vue';

const state = vi.hoisted(() => ({ permissions: new Set<string>() }));
const routeState = vi.hoisted(() => ({
  route: { matched: [] as unknown[], path: '' },
}));
const statusApi = vi.hoisted(() => ({
  status: vi.fn(async () => ({
    globalNotes: ['统一经营报表公共基础状态已接入。'],
    modules: [],
    reportName: '统一经营报表计划00-12状态',
    version: '计划00公共基础',
  })),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => state.permissions.has(code)),
  }),
}));
vi.mock('vue-router', () => ({
  useRoute: () => routeState.route,
}));
vi.mock('#/api/erp/report/business-status', () => ({
  getBusinessReportStatus: statusApi.status,
}));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('main', slots.default?.()),
  }),
  useVbenForm: () => [
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('form', slots.default?.()),
    }),
    {
      getValues: vi.fn(() => ({})),
      setValues: vi.fn(),
      submitForm: vi.fn(),
    },
  ],
}));
vi.mock('ant-design-vue', () => ({
  Alert: defineComponent({
    props: ['message'],
    setup: (p) => () => h('aside', p.message),
  }),
  Tabs: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('section', slots.default?.()),
  }),
  TabPane: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('article', slots.default?.()),
  }),
  Button: defineComponent({
    setup:
      (_, { slots, attrs }) =>
      () =>
        h('button', attrs, slots.default?.()),
  }),
}));
vi.mock('#/views/erp/report/trade-v2/index.vue', () => ({
  default: defineComponent({
    props: ['kind'],
    setup: (p) => () => h('div', { 'data-report': p.kind }, 'new report'),
  }),
}));
vi.mock('#/views/erp/sale/report/legacy.vue', () => ({
  default: defineComponent({
    setup: () => () => h('div', { 'data-report': 'old-sale' }),
  }),
}));
vi.mock(
  '#/views/erp/sale/report/modules/sale-business-report-table.vue',
  () => ({
    default: defineComponent({
      setup: () => () => h('div', { 'data-report': 'sale-business' }),
    }),
  }),
);
vi.mock('#/views/erp/purchase/report/legacy.vue', () => ({
  default: defineComponent({
    setup: () => () => h('div', { 'data-report': 'old-purchase' }),
  }),
}));
vi.mock(
  '#/views/erp/purchase/report/modules/purchase-business-report-table.vue',
  () => ({
    default: defineComponent({
      setup: () => () => h('div', { 'data-report': 'purchase-business' }),
    }),
  }),
);
vi.mock('#/views/erp/stock/report/modules/stock-v2-table.vue', () => ({
  default: defineComponent({
    setup: () => () => h('div', { 'data-report': 'stock' }),
  }),
}));
vi.mock('#/views/erp/stock/record/modules/stock-record-tab.vue', () => ({
  default: defineComponent({
    setup: () => () => h('div', { 'data-report': 'old-stock' }),
  }),
}));
vi.mock('#/views/erp/stock/report/modules/opening-form.vue', () => ({
  default: defineComponent({
    emits: ['close'],
    setup:
      (_, { emit }) =>
      () =>
        h(
          'button',
          { 'data-opening': '', onClick: () => emit('close') },
          'close opening',
        ),
  }),
}));

const shellSource = readFileSync(
  join(
    process.cwd(),
    'apps/web-antd/src/views/erp/report/components/business-report-shell.vue',
  ),
  'utf8',
);
const stockTableSource = readFileSync(
  join(
    process.cwd(),
    'apps/web-antd/src/views/erp/stock/report/modules/stock-v2-table.vue',
  ),
  'utf8',
);

const tradeReportSource = readFileSync(
  join(process.cwd(), 'apps/web-antd/src/views/erp/report/trade-v2/index.vue'),
  'utf8',
);
const saleBusinessReportSource = readFileSync(
  join(
    process.cwd(),
    'apps/web-antd/src/views/erp/sale/report/modules/sale-business-report-table.vue',
  ),
  'utf8',
);
const salePickDeliverySource = readFileSync(
  join(
    process.cwd(),
    'apps/web-antd/src/views/erp/sale/report/modules/pick-delivery-readonly-table.vue',
  ),
  'utf8',
);

const mounted: Array<{ app: App; host: HTMLElement }> = [];
const warnings: string[] = [];
function mount(component: Component) {
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp(component);
  app.config.warnHandler = (warning) => warnings.push(warning);
  app.mount(host);
  mounted.push({ app, host });
  return host;
}
beforeEach(() => {
  state.permissions = reactive(new Set<string>());
  routeState.route.path = '';
  routeState.route.matched = [];
  warnings.length = 0;
});
afterEach(() => {
  mounted.splice(0).forEach(({ app, host }) => {
    app.unmount();
    host.remove();
  });
});

describe('public shell and actual entry permission boundaries', () => {
  it('denied shell never mounts data slot; independent actions remain usable', async () => {
    const props = reactive({ denied: true });
    const dataMounted = vi.fn();
    const Child = defineComponent({
      setup() {
        dataMounted();
        return () => h('span', 'sensitive');
      },
    });
    const host = mount(
      defineComponent({
        setup: () => () =>
          h(
            Shell,
            {
              ...props,
              notices: [
                {
                  title: '毛利率与评分',
                  status: '待配置确认',
                  description: '只展示口径状态，不挂载敏感数据表。',
                },
              ],
              title: '经营报表',
            },
            {
              default: () => h(Child),
              actions: () => h('button', 'independent action'),
            },
          ),
      }),
    );
    expect(dataMounted).not.toHaveBeenCalled();
    expect(host.textContent).toContain('没有该经营报表查询权限');
    expect(host.textContent).toContain('毛利率与评分');
    expect(host.textContent).toContain('待配置确认');
    expect(host.querySelector('button')).not.toBeNull();
    props.denied = false;
    await nextTick();
    expect(dataMounted).toHaveBeenCalledTimes(1);
    props.denied = true;
    await nextTick();
    expect(host.textContent).not.toContain('sensitive');
  });
  it('sale: renders report content without internal stage notes', () => {
    state.permissions.add('erp:sale-report:query');
    const host = mount(Sale);
    expect(host.textContent).not.toContain('第一阶段');
    expect(host.textContent).not.toContain('待配置确认');
    expect(host.textContent).not.toContain('销售价暂按含税金额展示');
    expect(host.querySelector('[data-report="sale-business"]')).not.toBeNull();
  });

  const reportEntries = [
    {
      component: Sale,
      kind: 'sale',
    },
    {
      component: Purchase,
      kind: 'purchase',
    },
  ] as const;

  it.each(reportEntries)(
    '$kind: no permissions mounts neither report',
    ({ component }) => {
      const host = mount(component);
      expect(host.querySelector('[data-report]')).toBeNull();
      expect(host.textContent).toContain('没有该经营报表查询权限');
    },
  );

  it('sale: old report permission mounts business report tables', () => {
    state.permissions.add('erp:sale-report:query');
    const host = mount(Sale);
    expect(host.querySelector('[data-report="sale-business"]')).not.toBeNull();
    expect(host.querySelector('[data-report="old-sale"]')).toBeNull();
    expect(
      warnings.filter((x) => x.includes('Failed to resolve component')),
    ).toEqual([]);
  });

  it('sale: authorized business report menu route mounts page without legacy button code', () => {
    routeState.route.path = '/erp/business-report/sale/detail';
    routeState.route.matched = [{ path: '/erp/business-report/sale/detail' }];
    const host = mount(Sale);
    expect(host.querySelector('[data-report="sale-business"]')).not.toBeNull();
    expect(host.textContent).not.toContain('没有该经营报表查询权限');
  });

  it('purchase: old report permission mounts independent business report table', () => {
    state.permissions.add('erp:purchase-report:query');
    const host = mount(Purchase);
    expect(
      host.querySelector('[data-report="purchase-business"]'),
    ).not.toBeNull();
    expect(host.querySelector('[data-report="old-purchase"]')).toBeNull();
    expect(host.textContent).not.toContain('第一阶段');
    expect(host.textContent).not.toContain('只读复用');
    expect(
      warnings.filter((x) => x.includes('Failed to resolve component')),
    ).toEqual([]);
  });

  it('purchase: authorized business report menu route mounts page without old button permission', () => {
    routeState.route.path = '/erp/business-report/purchase/detail';
    routeState.route.matched = [
      { path: '/erp/business-report/purchase/detail' },
    ];
    const host = mount(Purchase);
    expect(
      host.querySelector('[data-report="purchase-business"]'),
    ).not.toBeNull();
    expect(host.textContent).not.toContain('没有该经营报表查询权限');
  });

  it('purchase: legacy route mounts history page when selected', () => {
    state.permissions.add('erp:purchase-report:query');
    routeState.route.path = '/erp/business-report/purchase/legacy';
    routeState.route.matched = [
      { path: '/erp/business-report/purchase/legacy' },
    ];
    const host = mount(Purchase);
    expect(host.querySelector('[data-report="old-purchase"]')).not.toBeNull();
    expect(host.querySelector('[data-report="purchase-business"]')).toBeNull();
  });

  it('经营报表公共壳保留剩余高度，库存和销售采购表格少量数据也不压缩到表头下方', () => {
    expect(shellSource).toContain('class="erp-business-report-shell-layout"');
    expect(shellSource).toContain(
      'content-class="erp-business-report-shell-page"',
    );
    expect(shellSource).not.toContain('BusinessReportStatusBoard');
    expect(shellSource).toContain(':global(.erp-business-report-shell-layout)');
    expect(shellSource).toContain(':global(.erp-business-report-shell-page)');
    expect(shellSource).toContain(
      'min-height: min(640px, max(360px, calc(100vh - 188px)))',
    );
    expect(shellSource).toMatch(
      /\.erp-business-report-shell__body\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow:\s*hidden;[\s\S]*?\}/,
    );
    expect(shellSource).toMatch(
      /\.erp-business-report-shell__body--scrollable\s*\{[\s\S]*?overflow-x:\s*hidden;[\s\S]*?overflow-y:\s*auto;[\s\S]*?\}/,
    );
    expect(shellSource).toMatch(
      /\.erp-business-report-shell__body :deep\(\.erp-business-report-tabs \.ant-tabs-tabpane-active\)\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?height:\s*100%;[\s\S]*?\}/,
    );
    expect(stockTableSource).toContain(
      'min-height: min(520px, max(260px, calc(100vh - 445px)))',
    );
    expect(stockTableSource).toContain('ant-table-body');
    expect(tradeReportSource).toContain('class="trade-report__table-area"');
    expect(tradeReportSource).toContain(
      ":scroll=\"{ x: 'max-content', y: '100%' }\"",
    );
    expect(tradeReportSource).toMatch(
      /\.trade-report__table-area\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 320px;[\s\S]*?min-height:\s*260px;[\s\S]*?\}/,
    );
    expect(tradeReportSource).toContain('ant-table-body');
    expect(tradeReportSource).not.toContain('calc(100vh - 410px)');
  });

  it('经营报表总览和销售报表开启长内容滚动，分页跟随列表展示', async () => {
    const overviewHost = mount(Overview);
    await nextTick();

    expect(
      overviewHost.querySelector(
        '.erp-business-report-shell__body--scrollable',
      ),
    ).not.toBeNull();
    expect(overviewHost.textContent).toContain('经营报表总览');
    expect(overviewHost.textContent).toContain('统一报表页面模板');

    state.permissions.add('erp:sale-report:query');
    const saleHost = mount(Sale);
    expect(
      saleHost.querySelector('.erp-business-report-shell__body--scrollable'),
    ).not.toBeNull();
    expect(
      saleHost.querySelector('[data-report="sale-business"]'),
    ).not.toBeNull();
    expect(saleBusinessReportSource).toContain(
      ':scroll="{ x: \'max-content\' }"',
    );
    expect(saleBusinessReportSource).not.toContain('y: tableHeight');
    expect(salePickDeliverySource).toContain(
      'scrollX: { enabled: true, gt: 8 }',
    );
    expect(salePickDeliverySource).toContain('height: 100%');
  });

  it('stock confirm-only can open/close permitted opening form but never mounts report', async () => {
    state.permissions.add('erp:report-stock-opening:confirm');
    const host = mount(Stock);
    expect(host.querySelector('[data-report]')).toBeNull();
    host.querySelector('button')?.click();
    await nextTick();
    expect(host.querySelector('[data-opening]')).not.toBeNull();
    (host.querySelector('[data-opening]') as HTMLButtonElement).click();
    await nextTick();
    expect(host.querySelector('[data-opening]')).toBeNull();
    host.querySelector('button')?.click();
    await nextTick();
    state.permissions.clear();
    await nextTick();
    expect(host.querySelector('[data-opening]')).toBeNull();
    expect(host.querySelector('button')).toBeNull();
  });
});
