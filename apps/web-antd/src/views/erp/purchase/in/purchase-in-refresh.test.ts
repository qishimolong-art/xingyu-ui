import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');

describe('purchase in list refresh lifecycle', () => {
  it('queries explicitly after draft save when the list is already on page one', () => {
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

    const createDraftIndex = formSource.indexOf('createPurchaseInDraft(data)');
    const draftSavedIndex = formSource.indexOf(
      'draftSaved = true;',
      createDraftIndex,
    );
    const successIndex = formSource.indexOf(
      "emit('success');",
      draftSavedIndex,
    );

    expect(createDraftIndex).toBeGreaterThan(-1);
    expect(draftSavedIndex).toBeGreaterThan(createDraftIndex);
    expect(successIndex).toBeGreaterThan(draftSavedIndex);
  });

  it('keeps querying the current page for ordinary refreshes', () => {
    const refreshStart = indexSource.indexOf(
      'async function handleRefresh(resetToFirstPage = false)',
    );
    const nextFunction = indexSource.indexOf(
      'function normalizeSearchParams',
      refreshStart,
    );
    const refreshSource = indexSource.slice(refreshStart, nextFunction);

    expect(refreshStart).toBeGreaterThan(-1);
    expect(refreshSource).toContain('await gridApi.query();');
  });
});
