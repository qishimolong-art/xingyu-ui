import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');

describe('purchase return list refresh lifecycle', () => {
  it('queries explicitly when a first-page reset would not trigger a page change', () => {
    expect(indexSource).toContain(
      'const proxyInfo = gridApi.grid?.getProxyInfo?.();',
    );
    expect(indexSource).toContain('proxyInfo.pager.currentPage !== 1');
    expect(indexSource).toContain(
      "await gridApi.grid.commitProxy('page', { currentPage: 1 });",
    );
    expect(indexSource).toContain('await gridApi.query();');
    expect(indexSource).toContain('<FormModal');
    expect(indexSource).toContain('@edit="handleEdit"');
    expect(indexSource).toContain('@print="handlePrint"');
    expect(indexSource).toContain('@success="handleRefresh(true)"');
  });

  it('waits for the list query after row approval', () => {
    const updateStatusIndex = indexSource.indexOf(
      'await updatePurchaseReturnStatus(row.id!, status);',
    );
    const refreshIndex = indexSource.indexOf(
      'await handleRefresh();',
      updateStatusIndex,
    );

    expect(updateStatusIndex).toBeGreaterThan(-1);
    expect(refreshIndex).toBeGreaterThan(updateStatusIndex);
  });

  it('emits success before close or detail reload can destroy or interrupt the form', () => {
    const approveIndex = formSource.indexOf(
      'await updatePurchaseReturnStatus(formData.value.id, 20);',
    );
    const approveSuccessIndex = formSource.indexOf(
      "emit('success');",
      approveIndex,
    );
    const approveReloadMatch = formSource
      .slice(approveSuccessIndex)
      .match(
        /await getPurchaseReturn\(\s*formData\.value\.id,\s*getPurchaseReturnLoadOptions\(\),?\s*\)/,
      );
    const approveReloadIndex = approveReloadMatch
      ? approveSuccessIndex + (approveReloadMatch.index ?? 0)
      : -1;
    const saveIndex = formSource.indexOf(
      "formType.value === 'create'",
      formSource.indexOf('async onConfirm()'),
    );
    const saveSuccessIndex = formSource.indexOf("emit('success');", saveIndex);
    const closeIndex = formSource.indexOf(
      'await modalApi.close();',
      saveSuccessIndex,
    );

    expect(approveIndex).toBeGreaterThan(-1);
    expect(approveSuccessIndex).toBeGreaterThan(approveIndex);
    expect(approveReloadIndex).toBeGreaterThan(approveSuccessIndex);
    expect(saveIndex).toBeGreaterThan(-1);
    expect(saveSuccessIndex).toBeGreaterThan(saveIndex);
    expect(closeIndex).toBeGreaterThan(saveSuccessIndex);
  });
});
