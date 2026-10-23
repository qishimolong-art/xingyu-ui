import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const modalSource = readFileSync(
  join(currentDir, 'sale-batch-update-items-form.vue'),
  'utf8',
);

describe('sale batch update items modal', () => {
  it('uses a submit snapshot so modal close reset cannot change success payload', () => {
    const confirmHandler = modalSource.slice(
      modalSource.indexOf('async onConfirm() {'),
      modalSource.indexOf(
        'async onOpenChange(',
        modalSource.indexOf('async onConfirm() {'),
      ),
    );

    expect(confirmHandler).toContain('const currentMode = mode.value;');
    expect(confirmHandler).toContain(
      'const currentDocumentId = documentId.value;',
    );
    expect(confirmHandler).toContain(
      'const currentDocumentType = documentType.value;',
    );
    expect(confirmHandler).toContain(
      'const currentItemIds = [...itemIds.value];',
    );
    expect(confirmHandler).toContain('itemIds: currentItemIds,');
    expect(confirmHandler).toMatch(
      /await\s+submitBatchUpdate\(\s*payload,\s*currentDocumentType,\s*currentDocumentId,?\s*\);/,
    );
    expect(confirmHandler).toContain('mode: currentMode,');
    expect(confirmHandler).toContain(
      // eslint-disable-next-line no-template-curly-in-string -- Assert source without evaluating its template.
      'message.success(`已批量更新 ${currentSelectedCount} 条销售明细`);',
    );
    expect(confirmHandler).not.toContain(
      // eslint-disable-next-line no-template-curly-in-string -- Assert source without evaluating its template.
      'message.success(`已批量更新 ${itemIds.value.length} 条销售明细`);',
    );
  });

  it('allows department-only batch editing without warehouse department column permission', () => {
    const deptPermissionBlock = modalSource.slice(
      modalSource.indexOf('const canEditDept = computed('),
      modalSource.indexOf(
        'const deptTreeData = computed(',
        modalSource.indexOf('const canEditDept = computed('),
      ),
    );

    expect(deptPermissionBlock).toContain(
      "!isFieldHidden(hiddenFields.value, 'item_deptId')",
    );
    expect(deptPermissionBlock).not.toContain('item_warehouseDeptName');
  });
});
