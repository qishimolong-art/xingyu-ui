import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const cartListSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const cartApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/cart/index.ts'),
  'utf8',
);

describe('sale cart completed switch removal contract', () => {
  it('removes the completed-cart switch and its query behavior', () => {
    expect(cartListSource).not.toContain('查看已完成');
    expect(cartListSource).not.toContain('showCompleted');
    expect(cartListSource).not.toContain('handleToggleCompleted');
    expect(cartListSource).not.toContain('includeCompleted');
    expect(cartListSource).not.toContain('Switch');
    expect(cartApiSource).not.toContain('includeCompleted');
  });
});
