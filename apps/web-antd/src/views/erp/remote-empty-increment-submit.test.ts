import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

const modules = [
  [
    '销售订单',
    'sale/order/modules/form.vue',
    'sale/order/modules/item-form.vue',
    '请先添加销售产品',
  ],
  [
    '销售报价',
    'sale/quote/modules/form.vue',
    'sale/quote/modules/item-form.vue',
    '请先添加报价产品',
  ],
  [
    '销售退货',
    'sale/return/modules/form.vue',
    'sale/return/modules/item-form.vue',
    '请至少添加一条退货明细',
  ],
  [
    '销售调价',
    'sale/priceadjust/modules/form.vue',
    'sale/priceadjust/modules/item-form.vue',
    '调价明细不能为空，请先选择客户并新增明细',
  ],
  [
    '其它入库',
    'stock/in/modules/form.vue',
    'stock/in/modules/item-form.vue',
    '入库明细不能为空',
  ],
  [
    '其它出库',
    'stock/out/modules/form.vue',
    'stock/out/modules/item-form.vue',
    '出库明细不能为空',
  ],
  [
    '库存调拨',
    'stock/move/modules/form.vue',
    'stock/move/modules/item-form.vue',
    '调拨出库单明细不能为空',
  ],
  [
    '库存盘点',
    'stock/check/modules/form.vue',
    'stock/check/modules/item-form.vue',
    '盘点明细不能为空',
  ],
  [
    '库存移货',
    'stock/warehouse-move/modules/form.vue',
    'stock/warehouse-move/modules/item-form.vue',
    '请至少选择一条库存明细',
  ],
  [
    '调拨出库',
    'stock/transfer-out/modules/form.vue',
    'stock/transfer-out/modules/item-form.vue',
    '产品清单不能为空',
  ],
];

describe('remote paged ERP item forms', () => {
  it.each(modules)(
    '%s does not treat an empty remote change set as empty details',
    (_name, formPath, itemFormPath, emptyMessage) => {
      const formSource = readFileSync(join(currentDir, formPath), 'utf8');
      const itemFormSource = readFileSync(
        join(currentDir, itemFormPath),
        'utf8',
      );

      expect(formSource).toContain('itemPageState.value.total <= 0');
      expect(formSource).toContain(`throw new Error('${emptyMessage}')`);
      expect(formSource).toContain(
        '{ requireItems: !isRemoteItemPaging.value }',
      );
      expect(itemFormSource).toContain(
        'options: { requireItems?: boolean } = {}',
      );
      expect(itemFormSource).toContain(
        'if ((options.requireItems ?? true) && items.length === 0)',
      );
    },
  );
});
