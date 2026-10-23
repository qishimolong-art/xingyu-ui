import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const choiceTip =
  '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件。';

const importForms = [
  'in/modules/import-form.vue',
  'out/modules/import-form.vue',
  'move/modules/import-form.vue',
  'transfer-out/modules/import-form.vue',
  'check/modules/import-form.vue',
  'warehouse-move/modules/import-form.vue',
];

describe('stock import product identity choice tips', () => {
  it('shows the one-of-two product identity tip on stock document imports', () => {
    for (const formPath of importForms) {
      const source = readFileSync(join(currentDir, formPath), 'utf-8');

      expect(source).toContain(choiceTip);
      expect(source).not.toContain(
        '产品、仓库、数量等字段请填写系统中已存在且启用的数据。',
      );
      expect(source).not.toContain(
        '产品、移出仓库、移入仓库、数量等字段请填写系统中已存在且启用的数据。',
      );
    }
  });

  it('does not add product identity tips to warehouse master-data import', () => {
    const source = readFileSync(
      join(currentDir, 'warehouse/modules/import-form.vue'),
      'utf-8',
    );

    expect(source).not.toContain(choiceTip);
  });
});
