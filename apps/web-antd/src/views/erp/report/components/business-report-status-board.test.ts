import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import BusinessReportStatusBoard from './business-report-status-board.vue';

const api = vi.hoisted(() => ({
  status: vi.fn(),
}));

vi.mock('#/api/erp/report/business-status', () => ({
  getBusinessReportStatus: api.status,
}));

const mounted: Array<{ app: App; host: HTMLElement }> = [];

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp(BusinessReportStatusBoard);
  app.mount(host);
  mounted.push({ app, host });
  return host;
}

async function flushMountedRequest() {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

beforeEach(() => {
  api.status.mockReset();
});

afterEach(() => {
  mounted.splice(0).forEach(({ app, host }) => {
    app.unmount();
    host.remove();
  });
});

describe('business report overview board', () => {
  it('renders a customer-facing business report overview when the status API is unavailable', async () => {
    api.status.mockRejectedValue(new Error('forbidden'));

    const host = mount();
    await flushMountedRequest();

    expect(api.status).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('经营报表总览');
    expect(host.textContent).toContain('汽配 ERP 经营分析报表');
    expect(host.textContent).toContain('覆盖报表');
    expect(host.textContent).toContain('47 项');
    expect(host.textContent).toContain('销售及客户经营');
    expect(host.textContent).toContain('采购及供应商经营');
    expect(host.textContent).toContain('库存及商品追溯');
    expect(host.textContent).toContain('异常、审计、追踪及绩效');
  });

  it('keeps implementation details out of the customer-facing overview', async () => {
    api.status.mockResolvedValue({
      globalNotes: ['内部说明不应出现在客户总览。'],
      modules: [
        {
          code: '03',
          dependencyPermissions: ['erp:stock-record:query'],
          dependencySql: ['erp_stock_record_cursor_20260909.sql'],
          dependencySwitches: ['erp.reporting.dual-cost-enabled=false'],
          displayCapabilities: ['内部可展示内容'],
          name: '库存、双成本及商品追溯',
          pendingItems: ['缺失成本表'],
          riskNotes: ['缺失成本不能作为 0 成本'],
          status: 'READONLY_AVAILABLE_WITH_SWITCH_OFF',
        },
      ],
      reportName: '统一经营报表计划00-12状态',
      version: 'plan-00',
    });

    const host = mount();
    await flushMountedRequest();

    expect(host.textContent).toContain('库存及商品追溯');
    expect(host.textContent).toContain('已可预览');
    expect(host.textContent).not.toContain('依赖 SQL');
    expect(host.textContent).not.toContain('依赖开关');
    expect(host.textContent).not.toContain('未完成原因');
    expect(host.textContent).not.toContain(
      'erp_stock_record_cursor_20260909.sql',
    );
    expect(host.textContent).not.toContain('erp.reporting.dual-cost-enabled');
    expect(host.textContent).not.toContain('erp:stock-record:query');
    expect(host.textContent).not.toContain('缺失成本表');
    expect(host.textContent).not.toContain('缺失成本不能作为 0 成本');
    expect(host.textContent).not.toContain('内部说明不应出现在客户总览');
  });

  it('shows the public foundation capabilities of the first module', async () => {
    api.status.mockResolvedValue({
      modules: [],
      reportName: '统一经营报表计划00-12状态',
      version: 'plan-00',
    });

    const host = mount();
    await flushMountedRequest();

    expect(host.textContent).toContain('公共报表能力');
    expect(host.textContent).toContain(
      '统一查询区、统计卡片、明细表、合计栏和导出入口',
    );
    expect(host.textContent).toContain('所有报表统一放在“经营报表”模块');
    expect(host.textContent).toContain('毛利率、评分、分摊、折旧和财务公式');
  });
});
