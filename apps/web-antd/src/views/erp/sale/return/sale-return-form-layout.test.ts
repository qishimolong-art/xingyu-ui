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

describe('sale return form layout contract', () => {
  it('keeps the detail form mounted while showing loading or error feedback', () => {
    expect(formSource).toContain('sale-return-detail-load-state');
    expect(formSource).toContain('sale-return-detail-content');
    expect(formSource).toContain('v-show=');
    expect(formSource).toContain('getDetailLoadErrorMessage(error)');
  });

  it('uses compact option popup typography in the document and item forms', () => {
    expect(formSource).toContain('sale-return-form-select-dropdown');
    expect(itemFormSource).toContain('sale-return-item-select-dropdown');
  });

  it('renders customer receivables after the four-column basic form', () => {
    expect(formSource).toContain(
      "const EMBEDDED_SECTION_FIELDS = new Set(['customerReceivableInfo', 'items'])",
    );
    expect(formSource).toContain('schema: buildBasicFormSchema(');
    expect(formSource).not.toContain('<template #customerReceivableInfo>');

    const formIndex = formSource.indexOf('<Form');
    const receivableIndex = formSource.indexOf(
      'class="sale-return-detail-receivable"',
    );
    const itemSectionIndex = formSource.indexOf('退货产品清单');
    expect(formIndex).toBeGreaterThan(-1);
    expect(receivableIndex).toBeGreaterThan(formIndex);
    expect(itemSectionIndex).toBeGreaterThan(receivableIndex);
  });
});
