import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const cartListSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const cartDataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const cartFormSource = readFileSync(
  join(currentDir, 'modules/form.vue'),
  'utf8',
);
const cartApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/cart/index.ts'),
  'utf8',
);

describe('sale cart express removal contract', () => {
  it('removes the missing-express row background and explanation', () => {
    expect(cartListSource).not.toContain('highlight-no-express');
    expect(cartListSource).not.toContain('琥珀色行表示未上传快递单');
    expect(cartListSource).not.toContain('sale-cart-express-swatch');
  });

  it('removes express upload from cart forms and APIs', () => {
    expect(cartDataSource).not.toContain("fieldName: 'fileUrl'");
    expect(cartFormSource).not.toContain('上传快递单');
    expect(cartFormSource).not.toContain('查看快递单');
    expect(cartFormSource).not.toContain('ExpressUploadModal');
    expect(cartApiSource).not.toContain('updateSaleCartFile');
    expect(cartApiSource).not.toContain('/erp/sale-cart/update-file');
  });
});
