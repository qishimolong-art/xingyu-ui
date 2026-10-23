import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');

describe('purchase in form loading lifecycle', () => {
  it('mounts the loaded form before hydrating its values', () => {
    const loadedDataIndex = formSource.indexOf(
      'formData.value = {\n        ...loaded,',
    );
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

  it('uses the guarded loading path for detail, edit, and copy modes', () => {
    expect(formSource).toContain('detailLoading.value = Boolean(data?.id)');
    expect(formSource).toContain(
      'await applyFormMode(data.type, data.initialData)',
    );
    expect(formSource).toContain("if (data.type === 'copy')");
  });

  it('loads persisted item rows through the paged detail API', () => {
    expect(formSource).toContain(
      "includeItems: !['detail', 'edit', 'copy'].includes(type)",
    );
    expect(formSource).toContain('getPurchaseInItemPage');
    expect(formSource).toContain('async function loadPurchaseInItemPage');
    expect(formSource).toContain(
      'await loadPurchaseInItemPage({ pageNo: 1 });',
    );
    expect(formSource).toContain(':remote-paging="isRemoteItemPaging"');
    expect(formSource).toContain('@page-change="handleItemPageChange"');
  });

  it('refreshes supplier-scoped department options before hydrating values', () => {
    const refreshDeptIndex = formSource.indexOf(
      'await refreshSupplierDeptOptions(formData.value.supplierId,',
    );
    const hydrateFormIndex = formSource.indexOf(
      'buildPurchaseDocumentDetailFormValues(formData.value, formType.value)',
      refreshDeptIndex,
    );

    expect(formSource).toContain('async function refreshSupplierDeptOptions');
    expect(formSource).toContain('async function handleSupplierChange');
    expect(formSource).toContain(
      'await handleSupplierChange(values.supplierId)',
    );
    expect(formSource).toContain(
      "getFieldComponentRef<PurchaseInDeptFieldRef>('deptId')",
    );
    expect(refreshDeptIndex).toBeGreaterThan(-1);
    expect(hydrateFormIndex).toBeGreaterThan(refreshDeptIndex);
  });

  it('surfaces backend action errors on save, draft save, submit, and approve', () => {
    expect(formSource).toContain('showPurchaseFormActionError');
    expect(formSource.match(/showPurchaseFormActionError/g)?.length).toBe(5);
  });
});
