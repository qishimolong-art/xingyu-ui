import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');

describe('purchase order form loading lifecycle', () => {
  it('mounts the loaded form before hydrating its values', () => {
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

  it('uses the guarded loading path for every existing order mode', () => {
    expect(formSource).toContain('detailLoading.value = Boolean(data?.id)');
    expect(formSource).toContain('formType.value = data.type');
    expect(formSource).toContain("if (data.type === 'copy')");
  });

  it('loads supplier dept options before hydrating existing order values', () => {
    const supplierDeptLoadIndex = formSource.indexOf(
      'await refreshSupplierDeptOptions(formData.value.supplierId,',
    );
    const hydrateFormIndex = formSource.indexOf(
      'buildPurchaseDocumentDetailFormValues(formData.value, formType.value)',
      supplierDeptLoadIndex,
    );

    expect(supplierDeptLoadIndex).toBeGreaterThan(-1);
    expect(hydrateFormIndex).toBeGreaterThan(supplierDeptLoadIndex);
  });

  it('refreshes and validates dept options when supplier changes', () => {
    expect(formSource).toContain('async function handleSupplierChange');
    expect(formSource).toContain(
      'await handleSupplierChange(values.supplierId)',
    );
    expect(formSource).toContain('const supplierChanged =');
    expect(formSource).toContain('clearInvalidDept: supplierChanged');
    expect(formSource).toMatch(
      /warnOnClear:\s*supplierChanged && Boolean\(normalizedSupplierId && values\.deptId\)/,
    );
    expect(formSource).toContain(
      "getFieldComponentRef<PurchaseOrderDeptFieldRef>('deptId')",
    );
    expect(formSource).toContain('当前部门不在该供应商可用部门范围内，已清空');
  });
  it('surfaces backend action errors for supplier-dept permission validation', () => {
    expect(formSource).toContain('showPurchaseFormActionError');
    expect(formSource).toContain(
      'await submitPurchaseOrder(formData.value!.id!)',
    );
    expect(formSource).toContain('await createPurchaseOrderDraft(data)');
    expect(formSource).toContain('await updatePurchaseOrderDraft(data)');
    expect(formSource).toContain('await createAndSubmitPurchaseOrder(data)');
    expect(formSource).toContain('await updateAndSubmitPurchaseOrder(data)');
    expect(formSource).toContain('await updatePurchaseOrder(data)');
    expect(formSource.match(/showPurchaseFormActionError/g)?.length).toBe(4);
  });
});
