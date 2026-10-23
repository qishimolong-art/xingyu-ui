import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readStockFile(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

describe('stock detail form footer actions', () => {
  const editableDocumentCases = [
    {
      formPath: 'in/modules/form.vue',
      indexPath: 'in/index.vue',
      permission: "hasAccessByCodes(['erp:stock-in:update'])",
      statusGuard: 'formData.value?.status === 10',
    },
    {
      formPath: 'out/modules/form.vue',
      indexPath: 'out/index.vue',
      permission: "hasAccessByCodes(['erp:stock-out:update'])",
      statusGuard: 'formData.value?.status === 10',
    },
    {
      formPath: 'check/modules/form.vue',
      indexPath: 'check/index.vue',
      permission: "hasAccessByCodes(['erp:stock-check:update'])",
      statusGuard: 'formData.value?.status !== ErpStockCheckApi.STATUS_APPROVE',
    },
    {
      formPath: 'warehouse-move/modules/form.vue',
      indexPath: 'warehouse-move/index.vue',
      permission: "hasAccessByCodes(['erp:warehouse-move:update'])",
      statusGuard:
        '[WAREHOUSE_MOVE_STATUS.DRAFT, WAREHOUSE_MOVE_STATUS.PROCESS].includes(',
    },
    {
      formPath: 'transfer-out/modules/form.vue',
      indexPath: 'transfer-out/index.vue',
      permission: "hasAccessByCodes(['erp:stock-transfer-out:update'])",
      statusGuard:
        'formData.value?.status !== STOCK_TRANSFER_OUT_STATUS.APPROVE',
    },
  ];

  it.each(editableDocumentCases)(
    'wires detail edit footer action for $formPath',
    ({ formPath, indexPath, permission, statusGuard }) => {
      const formSource = readStockFile(formPath);
      const indexSource = readStockFile(indexPath);

      expect(formSource).toMatch(/defineEmits\(\[[^\]]*'edit'[^\]]*'success'/);
      expect(formSource).toContain('const canEditFromDetail = computed(');
      expect(formSource).toContain("formType.value === 'detail'");
      expect(formSource).toContain('!!formData.value?.id');
      expect(formSource).toContain(statusGuard);
      expect(formSource).toContain('!detailLoading.value');
      expect(formSource).toContain('!detailLoadError.value');
      expect(formSource).toContain(permission);
      expect(formSource).toContain('async function handleEditFromDetail()');
      expect(formSource).toContain('await modalApi.close()');
      expect(formSource).toContain("emit('edit', row)");
      expect(formSource).toContain('v-if="canEditFromDetail"');
      expect(formSource).toContain('@click="handleEditFromDetail"');
      expect(indexSource).toContain('@edit="handleEdit"');
    },
  );

  it('wires warehouse detail edit without bypassing sale-distribution readonly rows', () => {
    const formSource = readStockFile('warehouse/modules/form.vue');
    const indexSource = readStockFile('warehouse/index.vue');

    expect(formSource).toContain(
      "(e: 'edit', warehouse: ErpWarehouseApi.Warehouse): void;",
    );
    expect(formSource).toContain('const canEditFromDetail = computed(');
    expect(formSource).toContain('isDetail.value');
    expect(formSource).toContain('!!formData.value?.id');
    expect(formSource).toContain('!isReadonlyBySaleDistribution.value');
    expect(formSource).toContain('!dataLoading.value');
    expect(formSource).toContain('!dataLoadError.value');
    expect(formSource).toContain("hasAccessByCodes(['erp:warehouse:update'])");
    expect(formSource).toContain('async function handleEditFromDetail()');
    expect(formSource).toContain('await modalApi.close()');
    expect(formSource).toContain("emit('edit', warehouse)");
    expect(formSource).toContain('v-if="canEditFromDetail"');
    expect(indexSource).toContain('@edit="handleEdit"');
  });

  it('keeps generated and historical stock detail forms read-only', () => {
    expect(readStockFile('transfer-in/modules/form.vue')).not.toContain(
      'canEditFromDetail',
    );
    expect(readStockFile('move/index.vue')).not.toContain('@edit="handleEdit"');
    expect(readStockFile('inbill/modules/detail-modal.vue')).not.toContain(
      'canEditFromDetail',
    );
    expect(readStockFile('outbill/modules/detail-modal.vue')).not.toContain(
      'canEditFromDetail',
    );
  });
});
