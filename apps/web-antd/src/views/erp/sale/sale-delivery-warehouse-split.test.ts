import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const deliverySource = readFileSync(
  join(currentDir, 'delivery/index.vue'),
  'utf8',
);
const reportSource = readFileSync(
  join(currentDir, 'report/modules/pick-delivery-readonly-table.vue'),
  'utf8',
);
const apiSource = readFileSync(
  resolve(currentDir, '../../../api/erp/sale/pick-delivery/index.ts'),
  'utf8',
);

describe('sale delivery warehouse task contract', () => {
  it('uses warehouse task ids for detail, history and submission', () => {
    expect(apiSource).toContain('orderId?: number');
    expect(apiSource).toContain('warehouseId?: number');
    expect(apiSource).toContain('warehouseName?: string');
    expect(apiSource).toContain('legacyHistoryWarning?: boolean');
    expect(apiSource).toContain('taskId: number;');
    expect(apiSource).not.toContain(
      'interface DeliverySubmitReq {\n    orderId: number;',
    );
    expect(deliverySource).toContain('taskId: detail.value.id');
    expect(deliverySource).not.toContain('orderId: detail.value.id');
  });

  it('shows and filters warehouse on operation, mobile and report views', () => {
    expect(deliverySource).toContain("field: 'warehouseName'");
    expect(deliverySource).toContain('v-model:value="query.warehouseId"');
    expect(deliverySource).toContain('warehouseId: query.warehouseId');
    expect(deliverySource).toContain('仓库：{{ row.warehouseName');
    expect(deliverySource).toMatch(
      /<DescriptionsItem\s+label="仓库">\s*\{\{\s*detail\.warehouseName/,
    );
    expect(reportSource).toContain("field: 'warehouseName'");
  });

  it('keeps partial delivery wording and warns only for unassignable legacy history', () => {
    expect(deliverySource).toContain('已拣数量可立即分批送货');
    expect(deliverySource).toContain('detail.legacyHistoryWarning');
    expect(deliverySource).toContain('历史提交未记录逐配件数量');
  });

  it('uses the standard business-document list presentation on desktop', () => {
    expect(deliverySource).toContain('销售送货单列表');
    expect(deliverySource).toContain('useVbenVxeGrid');
    expect(deliverySource).toContain("id: 'erp-sale-delivery-list-v2'");
    expect(deliverySource).toContain('fit: false');
    expect(deliverySource).toContain(
      'toolbarConfig: { refresh: true, search: true }',
    );
    expect(deliverySource).toContain('class="sale-delivery-number-link"');
    expect(deliverySource).toContain('class="sale-delivery-progress-cell"');
    expect(deliverySource).toContain('icon: ACTION_ICON.DOWNLOAD');
    expect(deliverySource).toContain("auth: ['erp:sale-delivery:export']");
  });
});
