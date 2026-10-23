import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const itemSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/order/index.ts'),
  'utf8',
);

describe('sale order unified page behavior', () => {
  it('keeps list focus manual and guards Insert create by permission and layer state', () => {
    expect(pageSource).not.toContain('queueFocusSaleKeywordSearchInput');
    expect(pageSource).not.toContain('onMounted(');
    expect(pageSource).toContain('useSaleShortcut({');
    expect(pageSource).toContain("hasAccessByCodes(['erp:sale-order:create'])");
    expect(pageSource).toContain('activationRefreshMaskVisible.value');
    expect(pageSource).toContain('onCreate: () => {');
    expect(pageSource).toContain('handleCreate();');
  });

  it('uses a full-order import contract distinct from detail import', () => {
    expect(pageSource).toContain("title: '导入销售订单整单'");
    expect(pageSource).toContain('importSaleOrderOrder');
    expect(pageSource).toContain('exportSaleOrderOrderImportTemplate');
    expect(apiSource).toContain("'/erp/sale-order/import-order'");
    expect(apiSource).toContain("'/erp/sale-order/get-order-import-template'");
  });

  it('applies column reset immediately and keeps readable icon actions', () => {
    expect(pageSource).toContain('settleVxeColumnCustomization');
    expect(pageSource).toContain("type !== 'reset'");
    expect(pageSource).toContain('icon: ACTION_ICON.EDIT');
    expect(pageSource).toContain('icon: ACTION_ICON.DELETE');
    expect(pageSource).toContain('confirm: () => handleDelete([row.id!])');
    expect(pageSource).toContain('PointerEvent');
  });

  it('uses text decimal inputs and preserves the fixed icon delete action', () => {
    expect(itemSource).not.toContain('InputNumber');
    expect(itemSource.match(/inputmode="decimal"/g)).toHaveLength(3);
    expect(itemSource).toContain('normalizeNumericFields(item, index)');
    expect(itemSource).toContain('icon: ACTION_ICON.DELETE');
    expect(itemSource).toContain('confirm: () => handleDelete(row)');
    expect(itemSource).toContain('settleVxeColumnCustomization');
  });
});
