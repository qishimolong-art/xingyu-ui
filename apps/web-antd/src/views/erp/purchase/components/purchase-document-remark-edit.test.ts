import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const purchaseDir = join(currentDir, '..');

const documents = [
  {
    api: join(
      purchaseDir,
      '..',
      '..',
      '..',
      'api',
      'erp',
      'purchase',
      'in',
      'index.ts',
    ),
    directory: 'in',
    endpoint: '/erp/purchase-in/update-remark',
    permission: 'erp:purchase-in:update',
  },
  {
    api: join(
      purchaseDir,
      '..',
      '..',
      '..',
      'api',
      'erp',
      'purchase',
      'return',
      'index.ts',
    ),
    directory: 'return',
    endpoint: '/erp/purchase-return/update-remark',
    permission: 'erp:purchase-return:update',
  },
  {
    api: join(
      purchaseDir,
      '..',
      '..',
      '..',
      'api',
      'erp',
      'purchase',
      'invoice',
      'index.ts',
    ),
    directory: 'invoice',
    endpoint: '/erp/purchase-invoice/update-remark',
    permission: 'erp:purchase-invoice:update',
  },
  {
    api: join(
      purchaseDir,
      '..',
      '..',
      '..',
      'api',
      'erp',
      'purchase',
      'priceadjust',
      'index.ts',
    ),
    directory: 'priceadjust',
    endpoint: '/erp/purchase-price-adjust/update-remark',
    permission: 'erp:purchase-price-adjust:update',
  },
] as const;

describe('purchase document remark edit contract', () => {
  it.each(documents)(
    'keeps the $directory entry detail-only and status-independent',
    ({ api, directory, endpoint, permission }) => {
      const formSource = readFileSync(
        join(purchaseDir, directory, 'modules', 'form.vue'),
        'utf8',
      );
      const indexSource = readFileSync(
        join(purchaseDir, directory, 'index.vue'),
        'utf8',
      );
      const apiSource = readFileSync(api, 'utf8');
      const conditionStart = formSource.indexOf(
        'const canEditRemark = computed(',
      );
      const conditionEnd = formSource.indexOf(');', conditionStart);
      const condition = formSource.slice(conditionStart, conditionEnd);

      expect(conditionStart).toBeGreaterThan(-1);
      expect(condition).toContain("formType.value === 'detail'");
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
      join(currentDir, 'PurchaseDocumentRemarkForm.vue'),
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
