import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const saleDir = join(currentDir, '..');

const documents = [
  {
    directory: 'cart',
    endpoint: '/erp/sale-cart/update-remark',
    permission: 'erp:sale-cart:update',
  },
  {
    directory: 'quote',
    endpoint: '/erp/sale-quote/update-remark',
    permission: 'erp:sale-quote:update',
  },
  {
    directory: 'order',
    endpoint: '/erp/sale-order/update-remark',
    permission: 'erp:sale-order:update',
  },
  {
    directory: 'out',
    endpoint: '/erp/sale-out/update-remark',
    permission: 'erp:sale-out:update',
  },
  {
    directory: 'return',
    endpoint: '/erp/sale-return/update-remark',
    permission: 'erp:sale-return:update',
  },
  {
    directory: 'priceadjust',
    endpoint: '/erp/sale-price-adjust/update-remark',
    permission: 'erp:sale-price-adjust:update',
  },
] as const;

describe('sale document remark edit contract', () => {
  it.each(documents)(
    'keeps the $directory entry detail-only and status-independent',
    ({ directory, endpoint, permission }) => {
      const formSource = readFileSync(
        join(saleDir, directory, 'modules', 'form.vue'),
        'utf8',
      );
      const indexSource = readFileSync(
        join(saleDir, directory, 'index.vue'),
        'utf8',
      );
      const apiSource = readFileSync(
        join(
          saleDir,
          '..',
          '..',
          '..',
          'api',
          'erp',
          'sale',
          directory,
          'index.ts',
        ),
        'utf8',
      );
      const conditionStart = formSource.indexOf(
        'const canEditRemark = computed(',
      );
      const conditionEnd = formSource.indexOf(');', conditionStart);
      const condition = formSource.slice(conditionStart, conditionEnd);

      expect(conditionStart).toBeGreaterThan(-1);
      if (directory !== 'out') {
        expect(condition).toContain("formType.value === 'detail'");
      }
      expect(condition).toContain(permission);
      expect(condition).not.toContain('status');
      expect(formSource).toContain('修改备注');
      expect(formSource).toContain(
        '<RemarkModal @success="handleRemarkSuccess" />',
      );
      expect(indexSource).not.toContain('修改备注');
      expect(apiSource).toContain(endpoint);
    },
  );

  it('uses a reusable, counted and resettable remark-only modal', () => {
    const modalSource = readFileSync(
      join(currentDir, 'SaleDocumentRemarkForm.vue'),
      'utf8',
    );

    expect(modalSource).toContain(':maxlength="500"');
    expect(modalSource).toContain('show-count');
    expect(modalSource).toContain(
      "remark.value = document.value?.remark ?? ''",
    );
    expect(modalSource).toContain("remark.value = ''");
    expect(modalSource).toContain("emit('success', savedRemark)");
    expect(modalSource).toContain('finally');
    expect(modalSource).toContain('modalApi.unlock()');
  });
});
