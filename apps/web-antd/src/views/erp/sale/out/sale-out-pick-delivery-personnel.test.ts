import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/out/index.ts'),
  'utf8',
);

describe('销售单按批次展示拣货送货人员数量', () => {
  it('keeps the cumulative table and adds separate pick and delivery tables', () => {
    const cumulativeIndex = formSource.search(/>配件累计履约明细<\/span\s*>/);
    const pickIndex = formSource.search(/>拣货人员明细<\/span\s*>/);
    const deliveryIndex = formSource.search(/>送货人员明细<\/span\s*>/);
    const submitIndex = formSource.search(/>提交记录<\/span\s*>/);

    expect(cumulativeIndex).toBeGreaterThan(-1);
    expect(pickIndex).toBeGreaterThan(cumulativeIndex);
    expect(deliveryIndex).toBeGreaterThan(pickIndex);
    expect(submitIndex).toBeGreaterThan(deliveryIndex);
    expect(formSource).toContain('本次拣货数量');
    expect(formSource).toContain('本次送货数量');
    expect(formSource).toContain('row.submitUserName');
    expect(formSource).toContain('row.submitTime');
    expect(formSource).toContain('formatDetailCount(row.quantity)');
  });

  it('loads type-isolated paged rows and keeps repeated submit rows', () => {
    expect(apiSource).toContain(
      "'/erp/sale-out/pick-delivery-operation-item-page'",
    );
    expect(formSource).toContain('type: 10');
    expect(formSource).toContain('type: 20');
    expect(formSource).toContain('fulfillmentPickOperationItems');
    expect(formSource).toContain('fulfillmentDeliveryOperationItems');
    expect(formSource).toContain(
      "const FULFILLMENT_OPERATION_PAGE_SIZE_OPTIONS = ['20', '50'];",
    );
    expect(formSource).not.toContain('groupBySubmitUser');
  });

  it('marks legacy batches instead of inventing per-person quantities', () => {
    expect(formSource).toContain('submit.quantityDetails !== true');
    expect(formSource).toContain(
      '历史拣货提交未记录逐配件数量，无法按人员准确拆分',
    );
    expect(formSource).toContain(
      '历史送货提交未记录逐配件数量，无法按人员准确拆分',
    );
    expect(formSource).toContain('暂无可准确拆分的拣货人员明细');
    expect(formSource).toContain('暂无可准确拆分的送货人员明细');
  });
});
