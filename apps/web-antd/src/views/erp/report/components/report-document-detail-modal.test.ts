import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import ReportDocumentDetailModal from './report-document-detail-modal.vue';
import {
  getReportDocumentPermission,
  REPORT_DOCUMENT_TYPES,
} from './report-document-detail';

const currentDir = dirname(fileURLToPath(import.meta.url));
const modalSource = readFileSync(
  join(currentDir, 'report-document-detail-modal.vue'),
  'utf8',
);

vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));

describe('报表单据详情弹窗', () => {
  let unmount: undefined | (() => void);

  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it('点击单号前不挂载任何原单表单', async () => {
    const container = document.createElement('div');
    const app = createApp(ReportDocumentDetailModal);
    app.mount(container);
    unmount = () => app.unmount();

    await nextTick();

    expect(container.childElementCount).toBe(0);
  });

  it('采购订单使用懒加载详情弹窗并进入报表只读模式', () => {
    expect(modalSource).toContain('loadPurchaseOrderForm');
    expect(modalSource).toContain('[REPORT_DOCUMENT_TYPES.PURCHASE_ORDER]');
    expect(modalSource).toContain(
      '<PurchaseOrderModal v-if="shouldRenderPurchaseOrder" />',
    );
    expect(modalSource).toContain('reportViewOnly: true');
  });

  it('应收调账沿用原单查询权限', () => {
    expect(
      getReportDocumentPermission(REPORT_DOCUMENT_TYPES.RECEIVABLE_OTHER),
    ).toBe('erp:receivable-other:query');
  });

  it.each([
    ['ReceivableOther', 'RECEIVABLE_OTHER'],
    ['SaleCart', 'SALE_CART'],
    ['SaleOrder', 'SALE_ORDER'],
    ['SaleQuote', 'SALE_QUOTE'],
    ['StockTransferIn', 'STOCK_TRANSFER_IN'],
    ['StockTransferOut', 'STOCK_TRANSFER_OUT'],
  ])('%s 使用懒加载详情弹窗', (componentName, type) => {
    expect(modalSource).toContain(`load${componentName}Form`);
    expect(modalSource).toContain(`[REPORT_DOCUMENT_TYPES.${type}]`);
    expect(modalSource).toContain(
      `<${componentName}Modal v-if="shouldRender${componentName}" />`,
    );
  });

  it('缺少可靠 ID 时优先提示来源关联缺失，未知但有 ID 的类型提示暂不支持', () => {
    const missingIdCheck = modalSource.indexOf(
      "message.warning('缺少来源关联，无法打开详情')",
    );
    const unsupportedTypeCheck = modalSource.indexOf(
      "message.warning('当前单据类型暂不支持查看详情')",
    );

    expect(missingIdCheck).toBeGreaterThan(-1);
    expect(unsupportedTypeCheck).toBeGreaterThan(missingIdCheck);
  });
});
