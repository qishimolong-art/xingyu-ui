import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/cart/index.ts'),
  'utf8',
);

describe('sale cart fulfillment action guards', () => {
  it('declares fulfillment summary fields returned by the backend', () => {
    expect(apiSource).toContain('pickDeliveryOrderId?: number;');
    expect(apiSource).toContain('pickStatus?: number;');
    expect(apiSource).toContain('deliveryStatus?: number;');
  });

  it('hides manual final approval and cancel-first-approval in the list', () => {
    expect(listSource).toContain('!row.pickDeliveryOrderId &&');
    expect(listSource).toContain(
      'ifShow: () => row.status === 30 && !row.pickDeliveryOrderId',
    );
  });

  it('hides guarded detail actions and explains automatic final approval', () => {
    expect(formSource).toContain('!formData.value?.pickDeliveryOrderId &&');
    expect(formSource).toContain(
      "formType === 'detail' && formData?.pickDeliveryOrderId",
    );
    expect(formSource).toContain('正在拣货，全部送货完成后将自动终审');
    expect(formSource).toContain('正在送货，全部送货完成后将自动终审');
    expect(listSource).toContain('getFulfillmentStatusText(row)');
    expect(listSource).toContain("return '拣货中';");
    expect(listSource).toContain("return '送货中';");
    expect(listSource).toContain("return '自动终审中';");
    expect(listSource).toContain(
      ':title="getFulfillmentStatusDescription(row)"',
    );
    expect(listSource).toContain('拣货中，全部送货完成后系统将自动终审');
    expect(listSource).toContain('送货中，全部送货完成后系统将自动终审');
  });
});
