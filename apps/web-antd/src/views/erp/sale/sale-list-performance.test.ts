import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const saleRoot = dirname(fileURLToPath(import.meta.url));

const listFiles = [
  'quote/index.vue',
  'order/index.vue',
  'cart/index.vue',
  'out/index.vue',
  'return/index.vue',
  'priceadjust/index.vue',
];

describe('sale ordinary list performance requests', () => {
  it('passes includeItems=false for all ordinary list page refresh paths', () => {
    for (const file of listFiles) {
      const source = readFileSync(join(saleRoot, file), 'utf8');
      const pageCalls =
        source.match(
          /getSale(?:Order|Cart|Out|Return|Quote|PriceAdjust)Page\(\{/g,
        ) ?? [];
      const includeItemsFlags = source.match(/includeItems: false/g) ?? [];

      expect(pageCalls).toHaveLength(3);
      expect(includeItemsFlags).toHaveLength(3);
    }
  });

  it('configures product-aware keyword placeholder on ordinary sale lists', () => {
    for (const file of listFiles) {
      const source = readFileSync(join(saleRoot, file), 'utf8');

      expect(source).toContain(
        "keywordSearchPlaceholder: '请输入关键词，产品多个条件可用 / 或空格分隔'",
      );
    }
  });
});
