import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');

describe('purchase return form loading lifecycle', () => {
  it('mounts the loaded form and item grid before hydrating their values', () => {
    const loadedDataIndex = formSource.indexOf('formData.value = loaded;');
    const revealFormIndex = formSource.indexOf(
      'detailLoading.value = false;',
      loadedDataIndex,
    );
    const waitForMountIndex = formSource.indexOf(
      'await nextTick();',
      revealFormIndex,
    );
    const staleRequestGuardIndex = formSource.indexOf(
      'if (sequence !== detailLoadSequence) return;',
      waitForMountIndex,
    );
    const hydrateFormIndex = formSource.indexOf(
      'buildPurchaseDocumentDetailFormValues(formData.value, formType.value)',
      staleRequestGuardIndex,
    );

    expect(loadedDataIndex).toBeGreaterThan(-1);
    expect(revealFormIndex).toBeGreaterThan(loadedDataIndex);
    expect(waitForMountIndex).toBeGreaterThan(revealFormIndex);
    expect(staleRequestGuardIndex).toBeGreaterThan(waitForMountIndex);
    expect(hydrateFormIndex).toBeGreaterThan(staleRequestGuardIndex);
  });

  it('resets the mounted form before applying create defaults', () => {
    const createBranchIndex = formSource.indexOf('if (!data?.id) {');
    const waitForMountIndex = formSource.indexOf(
      'await nextTick();',
      createBranchIndex,
    );
    const staleRequestGuardIndex = formSource.indexOf(
      'if (sequence !== detailLoadSequence) return;',
      waitForMountIndex,
    );
    const resetFormIndex = formSource.indexOf(
      'await formApi.resetForm();',
      staleRequestGuardIndex,
    );
    const applyDefaultsIndex = formSource.indexOf(
      'await formApi.setValues(defaults);',
      resetFormIndex,
    );

    expect(createBranchIndex).toBeGreaterThan(-1);
    expect(waitForMountIndex).toBeGreaterThan(createBranchIndex);
    expect(staleRequestGuardIndex).toBeGreaterThan(waitForMountIndex);
    expect(resetFormIndex).toBeGreaterThan(staleRequestGuardIndex);
    expect(applyDefaultsIndex).toBeGreaterThan(resetFormIndex);
  });

  it('keeps explicit loading, failure, and stale-request exits', () => {
    expect(formSource).toContain('detailLoading.value = Boolean(data?.id)');
    expect(formSource).toContain('getErpDetailLoadError(');
    expect(formSource).toContain('采购退货详情加载失败，请关闭后重试');
    expect(formSource).toContain('sequence !== detailLoadSequence');
    expect(formSource).toContain('v-if="detailLoading"');
    expect(formSource).toContain('v-else-if="detailLoadError"');
  });
});
