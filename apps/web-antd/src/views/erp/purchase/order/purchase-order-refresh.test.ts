import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');

describe('purchase order page refresh lifecycle', () => {
  it('silently refreshes the cached list when the page is activated again', () => {
    expect(indexSource).toContain('onActivated');
    expect(indexSource).toContain('let activatedOnce = false;');
    expect(indexSource).toContain('activatedOnce = true;');
    expect(indexSource).toContain('function waitForFrame()');
    expect(indexSource).toContain(
      'async function refreshActivatedPurchaseOrderPage()',
    );
    expect(indexSource).toContain('let activationRefreshVersion = 0;');
    expect(indexSource).toContain(
      'const activationRefreshMaskVisible = ref(false);',
    );

    const activatedStart = indexSource.indexOf('onActivated(() =>');
    const activatedSource = indexSource.slice(
      activatedStart,
      indexSource.indexOf('</script>', activatedStart),
    );

    expect(activatedSource).toContain(
      'void refreshActivatedPurchaseOrderPage();',
    );
    expect(activatedSource).not.toContain('handleRefresh();');
  });

  it('keeps explicit refresh routed through the grid query', () => {
    const refreshStart = indexSource.indexOf('function handleRefresh()');
    const nextFunction = indexSource.indexOf(
      'function waitForFrame',
      refreshStart,
    );
    const refreshSource = indexSource.slice(refreshStart, nextFunction);

    expect(refreshSource).toContain('gridApi.query();');
  });

  it('keeps page data visible during activation refresh', () => {
    const refreshStart = indexSource.indexOf(
      'async function refreshActivatedPurchaseOrderPage()',
    );
    const refreshSource = indexSource.slice(
      refreshStart,
      indexSource.indexOf('onActivated(() =>', refreshStart),
    );

    expect(refreshSource).toContain('await nextTick();');
    expect(refreshSource.match(/await waitForFrame\(\);/g)).toHaveLength(2);
    expect(refreshSource).toContain(
      'activationRefreshMaskVisible.value = true;',
    );
    expect(refreshSource).toContain('} finally {');
    expect(refreshSource).toContain(
      'activationRefreshMaskVisible.value = false;',
    );
    expect(refreshSource).toContain('await getPurchaseOrderPage({');
    expect(refreshSource).toContain('await gridApi.grid?.loadData?.(rows);');
    expect(refreshSource).toContain('checkedRows.value = [];');
    expect(refreshSource).toContain('await restoreSortState(gridApi);');
    expect(refreshSource).not.toContain('queueFocusPurchaseKeywordSearchInput');
    expect(refreshSource).not.toContain('gridApi.query();');
  });

  it('does not focus the keyword search input when entering the page', () => {
    expect(indexSource).not.toContain('queueFocusPurchaseKeywordSearchInput');
    expect(indexSource).not.toContain('purchaseOrderGridShellRef');
    expect(indexSource).toContain('<div class="purchase-order-grid-shell">');

    expect(indexSource).not.toContain('onMounted(() =>');
  });

  it('keeps activation refresh without restoring keyword focus', () => {
    const activatedStart = indexSource.indexOf('onActivated(() =>');
    const activatedSource = indexSource.slice(
      activatedStart,
      indexSource.indexOf('</script>', activatedStart),
    );

    expect(activatedSource).toContain('activatedOnce = true;');
    expect(activatedSource).not.toContain(
      'queueFocusPurchaseKeywordSearchInput',
    );
    expect(activatedSource).toContain(
      'void refreshActivatedPurchaseOrderPage();',
    );

    const refreshStart = indexSource.indexOf(
      'async function refreshActivatedPurchaseOrderPage()',
    );
    const refreshSource = indexSource.slice(
      refreshStart,
      indexSource.indexOf('onActivated(() =>', refreshStart),
    );

    expect(refreshSource).toContain(
      'activationRefreshMaskVisible.value = false;',
    );
    expect(refreshSource).not.toContain('queueFocusPurchaseKeywordSearchInput');
  });

  it('renders a lightweight activation refresh mask over the existing grid', () => {
    expect(indexSource).toContain('import { message, Spin, Tag }');
    expect(indexSource).toContain('class="purchase-order-grid-shell"');
    expect(indexSource).toContain('v-if="activationRefreshMaskVisible"');
    expect(indexSource).toContain('class="purchase-order-activation-mask"');
    expect(indexSource).toContain('<Spin size="small" />');
    expect(indexSource).toContain('同步最新数据中...');
  });
});
