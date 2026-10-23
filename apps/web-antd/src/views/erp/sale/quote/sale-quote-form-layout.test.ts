import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);

describe('sale quote form layout contract', () => {
  it('uses the sales-cart fullscreen four-column section layout in every mode', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      "wrapperClass: 'sale-quote-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain(
      'class="sale-quote-detail-section__title">基本信息',
    );
    expect(formSource).toContain(
      'class="sale-quote-detail-section__title">报价产品清单',
    );
    expect(formSource).toContain(
      'class="sale-quote-detail-section__title">审计信息',
    );
    expect(formSource).toContain(
      'grid-template-columns: repeat(4, minmax(0, 1fr))',
    );
  });

  it('keeps customer summary and item rows outside the basic form schema', () => {
    expect(formSource).toContain(
      "const EMBEDDED_SECTION_FIELDS = new Set(['customerReceivableInfo', 'items'])",
    );
    expect(formSource).toContain('sale-quote-edit-form--editable');
    expect(formSource).toContain('<CustomerReceivableSummary');
    expect(formSource).toContain('<ItemForm');
    expect(formSource).toMatch(/<ItemForm[\s\S]*?compact/);
  });

  it('provides explicit detail loading, failure, and successful content exits', () => {
    expect(formSource).toContain('detailLoading.value = true');
    expect(formSource).toContain(
      "? '单据已删除、不可用或无权访问，请关闭后重试'",
    );
    expect(formSource).toContain(": '详情加载失败，请关闭后重试'");
    expect(formSource).toContain('detailLoading.value = false');
    expect(formSource).toContain("formType !== 'detail' || formData");
  });

  it('renders returned detail items before optional stock lookups complete', () => {
    const displayIndex = itemFormSource.indexOf('tableData.value = nextItems');
    const lookupIndex = itemFormSource.indexOf('await Promise.allSettled([');
    expect(displayIndex).toBeGreaterThan(-1);
    expect(lookupIndex).toBeGreaterThan(displayIndex);
    expect(itemFormSource).toContain(
      'if (props.disabled || syncRunId !== itemSyncRunId)',
    );
  });
});
