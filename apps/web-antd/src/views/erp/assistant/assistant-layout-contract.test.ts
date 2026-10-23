import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(
  resolve(process.cwd(), 'apps/web-antd/src/layouts/basic.vue'),
  'utf8',
);

describe('ERP assistant layout integration', () => {
  it('mounts the floating assistant once in the authenticated basic layout', () => {
    expect(layoutSource).toContain(
      "import FloatingAssistant from '#/views/erp/assistant/FloatingAssistant.vue';",
    );
    expect(layoutSource.match(/<FloatingAssistant\s*\/>/g)).toHaveLength(1);
  });
});
