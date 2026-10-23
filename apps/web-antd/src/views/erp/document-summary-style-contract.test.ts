import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSource(relativePath: string) {
  return readFileSync(join(currentDir, relativePath), 'utf8');
}

describe('ERP document summary style contract', () => {
  it('defines the shared compact horizontal summary bar', () => {
    const source = readSource('components/ErpDocumentSummaryBar.vue');

    expect(source).toContain("title: '单据汇总'");
    expect(source).toContain('min-height: 44px;');
    expect(source).toContain('gap: 8px 20px;');
    expect(source).toContain('padding: 8px 12px;');
    expect(source).toContain('background: hsl(var(--muted) / 20%);');
    expect(source).toContain('border-top: 1px solid hsl(var(--border));');
    expect(source).toContain('@media (max-width: 768px)');
  });

  it.each([
    'purchase/order/modules/form.vue',
    'purchase/in/modules/form.vue',
    'purchase/return/modules/form.vue',
    'purchase/invoice/modules/form.vue',
    'purchase/priceadjust/modules/form.vue',
  ])('%s keeps the summary inside the item section', (relativePath) => {
    const source = readSource(relativePath);
    const itemIndex = source.indexOf('class="purchase-document-items"');
    const summaryIndex = source.indexOf('<PurchaseDocumentSummary');

    expect(itemIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeGreaterThan(itemIndex);
    expect(source.slice(itemIndex, summaryIndex)).not.toContain('</section>');
    expect(source).not.toContain('>单据汇总</span>');
  });

  it.each([
    [
      'finance/payable/expense/modules/form.vue',
      'payable-expense-document-section__body',
      'payable-expense-document-summary',
    ],
    [
      'finance/receivable/other-income/modules/form.vue',
      'other-income-document-section__body',
      'other-income-document-summary',
    ],
  ])(
    '%s uses the shared summary directly below its item body',
    (relativePath, itemMarker, removedClass) => {
      const source = readSource(relativePath);
      const itemIndex = source.indexOf(itemMarker);
      const summaryIndex = source.indexOf('<ErpDocumentSummaryBar');

      expect(itemIndex).toBeGreaterThan(-1);
      expect(summaryIndex).toBeGreaterThan(itemIndex);
      expect(source.slice(itemIndex, summaryIndex)).not.toContain('</section>');
      expect(source).not.toContain(removedClass);
      expect(source).toContain("label: '明细项数'");
      expect(source).toContain("label: '总金额'");
      expect(source).toContain('emphasized: true');
    },
  );
});
