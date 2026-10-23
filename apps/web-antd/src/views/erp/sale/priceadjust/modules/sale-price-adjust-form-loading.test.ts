import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');
const selectModalSource = readFileSync(
  join(currentDir, 'sale-out-item-select-modal.vue'),
  'utf8',
);
const detailEditSource = formSource.slice(
  formSource.indexOf('async function switchDetailToEdit('),
  formSource.indexOf('async function handleEditFromDetail()'),
);

describe('sale price adjust detail loading lifecycle', () => {
  it('reveals the loaded detail and waits for the item grid to mount', () => {
    const loadedDataIndex = formSource.indexOf(
      'formData.value = normalizeLoadedPriceAdjust(sourceData);',
    );
    const revealDetailIndex = formSource.indexOf(
      'detailLoading.value = false;',
      loadedDataIndex,
    );
    const waitForMountIndex = formSource.indexOf(
      'await nextTick();',
      revealDetailIndex,
    );

    expect(loadedDataIndex).toBeGreaterThan(-1);
    expect(revealDetailIndex).toBeGreaterThan(loadedDataIndex);
    expect(waitForMountIndex).toBeGreaterThan(revealDetailIndex);
  });

  it('resynchronizes item data after the VXE grid is mounted', () => {
    expect(itemFormSource).toContain('onMounted(async () => {');
    expect(itemFormSource).toContain('await nextTick();');
    expect(itemFormSource).toContain('if (!gridApi.grid) return;');
    expect(itemFormSource).toContain('tableData.value = [...props.items];');
    expect(itemFormSource).toContain('await refreshItemGrid();');
  });

  it('guards watcher refreshes until the grid instance is ready', () => {
    const itemsWatcherIndex = itemFormSource.indexOf('() => props.items,');
    const mountFallbackIndex = itemFormSource.indexOf(
      'onMounted(async () => {',
    );
    const watcherSource = itemFormSource.slice(
      itemsWatcherIndex,
      mountFallbackIndex,
    );

    expect(watcherSource).toContain('if (gridApi.grid) {');
    expect(formSource).toContain('v-if="detailLoading"');
    expect(formSource).toContain('v-else-if="detailLoadError"');
  });

  it('keeps detail content visible until edit data is ready', () => {
    expect(detailEditSource).toContain(
      'if (!initialData?.id || detailEditLoading.value) return;',
    );
    expect(detailEditSource).toContain('detailEditLoading.value = true;');
    expect(detailEditSource).not.toContain('detailLoading.value = true;');
    expect(detailEditSource).toContain('getSalePriceAdjustEditItemPage({');
    expect(detailEditSource).toContain('deferTypeCommit: true');
    expect(detailEditSource).toContain(
      'shouldCommit: () => sequence === formLoadSequence',
    );
    expect(detailEditSource).toContain(
      "message.error('销售调价单编辑数据加载失败，请重试');",
    );
    expect(detailEditSource).toContain('detailEditLoading.value = false;');
    expect(formSource).toContain(':loading="detailEditLoading"');
  });

  it('refreshes selector columns through the guarded lifecycle helper', () => {
    expect(selectModalSource).toContain('refreshSalePriceAdjustGridColumns({');
    expect(selectModalSource).toContain('isOpen: props.open');
    expect(selectModalSource).toContain(
      "typeof gridApi.grid?.reloadColumn === 'function'",
    );
    expect(selectModalSource).not.toContain(
      'gridApi.grid.reloadColumn(permissionColumns)',
    );
  });
});
