import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(
  join(currentDir, 'modules/import-form.vue'),
  'utf8',
);
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/product/product/index.ts'),
  'utf8',
);

describe('product import progress pilot', () => {
  it('uses async task endpoints while retaining the legacy import endpoint', () => {
    expect(apiSource).toContain("'/erp/product/import'");
    expect(apiSource).toContain("'/erp/product/import-task/start'");
    expect(apiSource).toContain("'/erp/product/import-task/active'");
    expect(apiSource).toContain("'/erp/product/import-task/get'");
  });

  it('polls faster in the open modal and keeps polling after close', () => {
    expect(formSource).toContain('modalOpen.value ? 1000 : 5000');
    expect(formSource).toContain('schedulePoll(5000)');
    expect(formSource).toContain('onBeforeUnmount');
    expect(indexSource).toContain('destroyOnClose: false');
  });

  it('restores task ids per tenant and user and reports completion once', () => {
    expect(formSource).toContain(
      'accessStore.visitTenantId ?? accessStore.tenantId',
    );
    expect(formSource).toContain('sessionStorage.setItem');
    expect(formSource).toContain('notifiedTaskId.value === task.taskId');
    expect(formSource).toContain("emit('success')");
  });
});
