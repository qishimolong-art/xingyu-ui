import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildSaleCartOrderSourceParams,
  canCreateSaleCart,
  SALE_CART_ORDER_TAB,
} from './sale-cart-order-tabs';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/cart/index.ts'),
  'utf8',
);
const requestSource = readFileSync(
  join(currentDir, '../../../../api/request.ts'),
  'utf8',
);

describe('销售手推车来源 Tab', () => {
  it('默认销售手推车与网上订单生成互斥的来源条件', () => {
    expect(
      buildSaleCartOrderSourceParams(SALE_CART_ORDER_TAB.SALE_CART),
    ).toEqual({ onlineOrder: false });
    expect(
      buildSaleCartOrderSourceParams(SALE_CART_ORDER_TAB.ONLINE_ORDER),
    ).toEqual({ onlineOrder: true });
  });

  it('只有销售手推车 Tab 允许新增或导入', () => {
    expect(canCreateSaleCart(SALE_CART_ORDER_TAB.SALE_CART)).toBe(true);
    expect(canCreateSaleCart(SALE_CART_ORDER_TAB.ONLINE_ORDER)).toBe(false);
    expect(indexSource).toContain('ifShow: () => canCreateInCurrentTab');
    expect(indexSource).not.toContain(
      'ifShow: () => canCreateInCurrentTab.value',
    );
    expect(indexSource).toMatch(
      /function handle(?:Create|Import)\(\) \{[\s\S]*?!canCreateInCurrentTab\.value/,
    );
  });

  it('列表、汇总、激活刷新和导出共用当前 Tab 来源条件', () => {
    expect(indexSource).toContain('buildCurrentOrderSourceParams()');
    expect(indexSource).toContain('...buildCurrentOrderSourceParams(),');
    expect(indexSource).toContain(':table-title="currentTableTitle"');
    expect(apiSource).toContain('onlineOrder?: boolean;');
  });

  it('渲染两个卡片式 Tab，且网上订单保留原列表操作区', () => {
    expect(indexSource).toContain('type="card"');
    expect(indexSource).toContain('tab="销售手推车"');
    expect(indexSource).toContain('tab="网上订单"');
    expect(indexSource).toContain('<template #continueBuyAction="{ row }">');
    expect(indexSource).toContain("auth: ['erp:sale-cart:first-approve']");
    expect(indexSource).toContain("auth: ['erp:sale-cart:final-approve']");
  });

  it('仅在页面活动时轮询最新网上订单，并支持提醒后查看', () => {
    expect(apiSource).toContain("'/erp/sale-cart/latest-online-order'");
    expect(apiSource).toContain("'X-Silent-Error-Message': 'true'");
    expect(requestSource).toContain("'X-Silent-Error-Message'");
    expect(indexSource).toContain('createOnlineOrderPolling({');
    expect(indexSource).toContain('syncOnlineOrderPolling()');
    expect(indexSource).toContain(
      "document.addEventListener('visibilitychange'",
    );
    expect(indexSource).toContain('onDeactivated(() => {');
    expect(indexSource).toContain("message: '收到新的网上订单'");
    expect(indexSource).toContain("() => '查看网上订单'");
    expect(indexSource).toContain('await refreshActivatedSaleCartPage();');
  });
});
