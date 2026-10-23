import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const stockDir = join(currentDir, '..');

const documents = [
  {
    directory: 'check',
    endpoint: '/erp/stock-check/update-remark',
    permission: 'erp:stock-check:update',
  },
  {
    directory: 'in',
    endpoint: '/erp/stock-in/update-remark',
    permission: 'erp:stock-in:update',
  },
  {
    directory: 'out',
    endpoint: '/erp/stock-out/update-remark',
    permission: 'erp:stock-out:update',
  },
  {
    directory: 'move',
    endpoint: '/erp/stock-move/update-remark',
    permission: 'erp:stock-move:update',
  },
  {
    directory: 'warehouse-move',
    endpoint: '/erp/warehouse-move/update-remark',
    permission: 'erp:warehouse-move:update',
  },
  {
    directory: 'transfer-out',
    endpoint: '/erp/stock-transfer-out/update-remark',
    permission: 'erp:stock-transfer-out:update',
  },
] as const;

describe('stock document remark edit contract', () => {
  it.each(documents)(
    'keeps the $directory entry detail-only and status-independent',
    ({ directory, endpoint, permission }) => {
      const formSource = readFileSync(
        join(stockDir, directory, 'modules', 'form.vue'),
        'utf8',
      );
      const indexSource = readFileSync(
        join(stockDir, directory, 'index.vue'),
        'utf8',
      );
      const apiSource = readFileSync(
        join(
          stockDir,
          '..',
          '..',
          '..',
          'api',
          'erp',
          'stock',
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
      join(currentDir, 'StockDocumentRemarkForm.vue'),
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
