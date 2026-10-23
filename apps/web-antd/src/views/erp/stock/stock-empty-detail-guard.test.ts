import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

describe('stock document empty detail guard', () => {
  it.each([
    ['其它入库', 'in/modules/item-form.vue', '入库明细不能为空'],
    ['其它出库', 'out/modules/item-form.vue', '出库明细不能为空'],
    ['库存调拨', 'move/modules/item-form.vue', '调拨出库单明细不能为空'],
    ['库存盘点', 'check/modules/item-form.vue', '盘点明细不能为空'],
  ])('%s validates empty detail rows before submit', (_name, file, message) => {
    const source = readFileSync(join(currentDir, file), 'utf8');

    expect(source).toContain(`throw new Error('${message}')`);
  });
});
