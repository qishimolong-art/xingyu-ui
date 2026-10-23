import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSource(...paths: string[]) {
  return readFileSync(join(currentDir, ...paths), 'utf8');
}

const listPages = [
  ['order', readSource('order', 'index.vue')],
  ['after-sale', readSource('afterSale', 'index.vue')],
  ['express', readSource('delivery', 'express', 'index.vue')],
  ['pick-up-store', readSource('delivery', 'pickUpStore', 'index.vue')],
  ['pick-up-order', readSource('delivery', 'pickUpOrder', 'index.vue')],
  ['express-template', readSource('delivery', 'expressTemplate', 'index.vue')],
  ['brokerage-user', readSource('brokerage', 'user', 'index.vue')],
  ['brokerage-record', readSource('brokerage', 'record', 'index.vue')],
  ['brokerage-withdraw', readSource('brokerage', 'withdraw', 'index.vue')],
] as const;

const rowDetailPages = [
  ['order', readSource('order', 'index.vue')],
  ['after-sale', readSource('afterSale', 'index.vue')],
  ['pick-up-order', readSource('delivery', 'pickUpOrder', 'index.vue')],
] as const;

const orderDetailSource = readSource('order', 'detail', 'index.vue');
const afterSaleDetailSource = readSource('afterSale', 'detail', 'index.vue');
const compactGridSource = readSource('styles', 'compact-grid.css');
const gridSearchSource = readSource('utils', 'grid-search.ts');
const configSource = readSource('config', 'index.vue');

describe('mall trade center ERP style contract', () => {
  it('uses compact collapsed search on every trade-center list grid', () => {
    for (const [name, source] of listPages) {
      expect(source, name).toContain('collapsed: true');
      expect(source, name).toContain('collapsedRows: 1');
      expect(source, name).toContain('commonConfig: { labelWidth: 68 }');
      expect(source, name).toContain(
        '@keydown.enter.capture="handleSearchEnter"',
      );
      expect(source, name).toContain("showHeaderOverflow: 'tooltip'");
      expect(source, name).toContain("showOverflow: 'tooltip'");
      expect(source, name).toContain('scrollX:');
      expect(source, name).toContain('mall-trade-compact-grid');
    }
  });

  it('keeps row-click detail limited to existing detail workflows', () => {
    for (const [name, source] of rowDetailPages) {
      expect(source, name).toContain('shouldIgnoreMallTradeRowDetailClick');
      expect(source, name).toContain('function handleCellClick');
      expect(source, name).toContain('cellClick: handleCellClick');
      expect(source, name).toContain('mall-trade-row-detail-grid');
    }
    expect(gridSearchSource).toContain("column?.type === 'expand'");
    expect(gridSearchSource).toContain("column?.field === 'actions'");
    expect(gridSearchSource).toContain('interactiveCellSelector');
    expect(gridSearchSource).toContain('.ant-image');
    expect(gridSearchSource).toContain('.ant-switch');
  });

  it('opens order and after-sale details through fullscreen modal components', () => {
    expect(readSource('order', 'index.vue')).toContain(
      'connectedComponent: OrderDetail',
    );
    expect(readSource('afterSale', 'index.vue')).toContain(
      'connectedComponent: AfterSaleDetail',
    );
    expect(readSource('delivery', 'pickUpOrder', 'index.vue')).toContain(
      'connectedComponent: OrderDetail',
    );
    expect(orderDetailSource).toContain(
      "defineOptions({ name: 'TradeOrderDetail' })",
    );
    expect(orderDetailSource).toContain(
      'modalApi.setState({ fullscreen: true })',
    );
    expect(orderDetailSource).toContain(
      "await router.replace({ name: 'TradeOrder' })",
    );
    expect(afterSaleDetailSource).toContain(
      "defineOptions({ name: 'TradeAfterSaleDetail' })",
    );
    expect(afterSaleDetailSource).toContain(
      'modalApi.setState({ fullscreen: true })',
    );
    expect(afterSaleDetailSource).toContain(
      "await router.replace({ name: 'TradeAfterSale' })",
    );
  });

  it('keeps trade operation forms and config page on compact ERP styling', () => {
    expect(compactGridSource).toContain('.mall-trade-form-card');
    expect(compactGridSource).toContain('.mall-trade-edit-form');
    expect(compactGridSource).toContain('.mall-trade-detail-modal');
    expect(compactGridSource).toContain('.vxe-grid--pager-wrapper');
    expect(compactGridSource).toContain('position: sticky');
    expect(configSource).toContain('mall-trade-form-card');
    expect(configSource).toContain('mall-trade-edit-form');
  });
});
