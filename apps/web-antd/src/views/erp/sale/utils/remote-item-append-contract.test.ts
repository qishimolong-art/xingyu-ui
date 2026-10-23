import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const modules = ['quote', 'order', 'return'] as const;

describe('sale remote item append contract', () => {
  for (const moduleName of modules) {
    it(`${moduleName} delegates remote appends to the parent without leaving overflow rows`, () => {
      const itemFormSource = readFileSync(
        resolve(
          process.cwd(),
          `apps/web-antd/src/views/erp/sale/${moduleName}/modules/item-form.vue`,
        ),
        'utf8',
      );
      const formSource = readFileSync(
        resolve(
          process.cwd(),
          `apps/web-antd/src/views/erp/sale/${moduleName}/modules/form.vue`,
        ),
        'utf8',
      );

      expect(itemFormSource).toContain('props.remotePaging &&');
      expect(itemFormSource).toContain('targetIndex < 0 ||');
      expect(itemFormSource).toContain('tableData.value = previousRows;');
      expect(itemFormSource).toContain('focusItemByRowKey');
      expect(formSource).toContain('firstRemainingAddedKey');
      expect(formSource).toContain('await focusRemoteItemByKey(');
    });
  }
});
