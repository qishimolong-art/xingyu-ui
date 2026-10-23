import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const modules = [
  { api: 'order', view: 'order' },
  { api: 'in', view: 'in' },
  { api: 'return', view: 'return' },
  { api: 'invoice', view: 'invoice' },
  { api: 'priceadjust', view: 'priceadjust' },
];

function read(relativePath: string) {
  return readFileSync(join(currentDir, relativePath), 'utf8');
}

describe('purchase item client row identity', () => {
  it.each(modules)(
    'uses clientRowKey instead of seq in $view item tables and remote caches',
    ({ api, view }) => {
      const itemFormSource = read(`${view}/modules/item-form.vue`);
      const formSource = read(`${view}/modules/form.vue`);
      const apiSource = read(`../../../api/erp/purchase/${api}/index.ts`);

      expect(itemFormSource).toContain("keyField: 'clientRowKey'");
      expect(itemFormSource).not.toContain("keyField: 'seq'");
      expect(itemFormSource).not.toContain('item.seq === row.seq');
      expect(formSource).toContain('createPurchaseItemClientRowKeyManager');
      expect(formSource).toContain('stripPurchaseItemClientFields');
      expect(formSource).not.toContain(
        ['return `seq_', '$', '{item.seq}', '`'].join(''),
      );
      expect(apiSource).toContain('clientRowKey?: string');
    },
  );

  it('preserves the target identity for inline stock replacement', () => {
    for (const view of ['order', 'in', 'return']) {
      expect(read(`${view}/modules/item-form.vue`)).toContain(
        'row.clientRowKey = targetRow.clientRowKey ?? row.clientRowKey',
      );
    }
  });

  it('does not generate random numeric seq values for price adjustment rows', () => {
    const formSource = read('priceadjust/modules/form.vue');
    const itemFormSource = read('priceadjust/modules/item-form.vue');

    expect(formSource).not.toContain('function genSeq');
    expect(itemFormSource).not.toContain('Math.floor(Math.random()');
  });
});
