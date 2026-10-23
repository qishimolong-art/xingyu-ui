import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');

describe('purchase price adjust form loading lifecycle', () => {
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

  it('keeps create mode immediately mountable and guards loaded modes', () => {
    expect(formSource).toContain('detailLoading.value = Boolean(data?.id)');
    expect(formSource).toContain('if (!data || !data.id) {');
    expect(formSource).toContain("if (data.type === 'copy')");
  });

  it('keeps explicit failure and stale-request exits', () => {
    expect(formSource).toContain('getErpDetailLoadError(');
    expect(formSource).toContain('采购调价单详情加载失败，请关闭后重试');
    expect(formSource).toContain('sequence !== detailLoadSequence');
    expect(formSource).toContain('v-if="detailLoading"');
    expect(formSource).toContain('v-else-if="detailLoadError"');
  });

  it('refreshes supplier departments before keeping or clearing loaded values', () => {
    expect(formSource).toContain(
      'getPurchasePriceAdjustSupplierDeptSimpleList',
    );
    expect(formSource).toContain('async function refreshSupplierDeptOptions(');
    expect(formSource).toContain("clearInvalidDept: data.type !== 'detail'");
    expect(formSource).toContain('clearInvalidDept: true');
    expect(formSource).toContain(
      'updateDeptFieldSupplierParam(normalizedSupplierId)',
    );
    expect(formSource).toContain('当前部门不在该供应商可用部门范围内，已清空');
    expect(formSource).toContain(
      "showPurchaseFormActionError('采购调价单', error)",
    );
  });
});
