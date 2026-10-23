import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const customerLazySelectSource = readFileSync(
  join(currentDir, 'CustomerLazySelect.vue'),
  'utf8',
);
const saleCustomerLazySelectSource = readFileSync(
  join(currentDir, 'SaleCustomerLazySelect.vue'),
  'utf8',
);

describe('sale customer lazy select option echo', () => {
  it.each([
    ['CustomerLazySelect', customerLazySelectSource],
    ['SaleCustomerLazySelect', saleCustomerLazySelectSource],
  ])(
    '%s normalizes current options and de-duplicates optionsChange',
    (_, source) => {
      expect(source).toContain('function formatOption(');
      expect(source).toContain('const currentOptions = computed(');
      expect(source).toContain('let lastEmittedOptionsSignature =');
      expect(source).toContain('signature === lastEmittedOptionsSignature');
      expect(source).toContain("emit('optionsChange', options)");
      expect(source).toContain('if (loading.value || props.disabled)');
    },
  );
});
