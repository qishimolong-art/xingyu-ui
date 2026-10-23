import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, '../data.ts'), 'utf8');

describe('sale cart edit loading lifecycle', () => {
  it('uses lazy customer options instead of issuing an eager full-list request', () => {
    expect(formSource).toContain('customerList.value,');
    expect(dataSource).toContain('customerOptions: any[] = []');
    expect(dataSource).toContain("component: 'SaleCustomerLazySelect'");
    expect(dataSource).toContain('options: customerOptions');
    expect(dataSource).toContain('onOptionsChange: onCustomerOptionsChange');
    expect(formSource).toContain('withCurrentSaleFormSelectOptions(');
    expect(formSource).not.toContain('getSaleCustomerSelectOptions');
  });

  it('updates only the department field after customer selection', () => {
    const loadDeptStart = formSource.indexOf(
      'async function loadSaleDeptOptions(',
    );
    const loadDeptEnd = formSource.indexOf(
      'const getTitle = computed',
      loadDeptStart,
    );
    const loadDeptHandler = formSource.slice(loadDeptStart, loadDeptEnd);

    expect(loadDeptHandler).toContain('formApi.updateSchema([');
    expect(loadDeptHandler).toContain("fieldName: 'deptId'");
    expect(loadDeptHandler).not.toContain('await refreshFormSchema();');
    expect(loadDeptHandler).toContain('customerId,');
    expect(loadDeptHandler).toContain('deptId,');
  });

  it('locks a new-record modal before asynchronous initialization can reset user input', () => {
    const newRecordBranch = formSource.lastIndexOf('if (!data.id) {');
    const lockIndex = formSource.indexOf('modalApi.lock();', newRecordBranch);
    const firstAwaitIndex = formSource.indexOf('await ', newRecordBranch);
    const resetFormIndex = formSource.indexOf(
      'await formApi.resetForm();',
      newRecordBranch,
    );
    const unlockIndex = formSource.indexOf(
      'modalApi.unlock();',
      resetFormIndex,
    );

    expect(newRecordBranch).toBeGreaterThan(-1);
    expect(lockIndex).toBeGreaterThan(newRecordBranch);
    expect(firstAwaitIndex).toBeGreaterThan(lockIndex);
    expect(resetFormIndex).toBeGreaterThan(firstAwaitIndex);
    expect(unlockIndex).toBeGreaterThan(resetFormIndex);
  });

  it('locks an existing-record modal before the first asynchronous request', () => {
    const existingRecordBranch = formSource.indexOf('if (data.id) {');
    const lockIndex = formSource.indexOf(
      'modalApi.lock();',
      existingRecordBranch,
    );
    const hydrationGuardIndex = formSource.indexOf(
      'isHydratingFormValues.value = true;',
      lockIndex,
    );
    const firstAwaitIndex = formSource.indexOf('await ', existingRecordBranch);

    expect(existingRecordBranch).toBeGreaterThan(-1);
    expect(lockIndex).toBeGreaterThan(existingRecordBranch);
    expect(hydrationGuardIndex).toBeGreaterThan(lockIndex);
    expect(firstAwaitIndex).toBeGreaterThan(lockIndex);
  });

  it('clears stale data and hydrates the form and item rows before unlocking', () => {
    const existingRecordBranch = formSource.indexOf('if (data.id) {');
    const clearDataIndex = formSource.indexOf(
      'formData.value = undefined;',
      existingRecordBranch,
    );
    const resetFormIndex = formSource.indexOf(
      'await formApi.resetForm();',
      clearDataIndex,
    );
    const fallbackIndex = formSource.indexOf(
      'hydrateSaleCustomerFromFallback(',
      clearDataIndex,
    );
    const applyDataIndex = formSource.indexOf(
      'formData.value = isCopy',
      resetFormIndex,
    );
    const hydrateFormIndex = formSource.indexOf(
      'buildSaleDocumentDetailFormValues(formData.value, formType.value)',
      applyDataIndex,
    );
    const waitForItemsIndex = formSource.indexOf(
      'await getItemFormInstance()?.waitForItemsReady?.();',
      hydrateFormIndex,
    );
    const unlockIndex = formSource.indexOf(
      'modalApi.unlock();',
      waitForItemsIndex,
    );

    expect(clearDataIndex).toBeGreaterThan(existingRecordBranch);
    expect(resetFormIndex).toBeGreaterThan(clearDataIndex);
    expect(fallbackIndex).toBeGreaterThan(clearDataIndex);
    expect(applyDataIndex).toBeGreaterThan(resetFormIndex);
    expect(hydrateFormIndex).toBeGreaterThan(applyDataIndex);
    expect(waitForItemsIndex).toBeGreaterThan(hydrateFormIndex);
    expect(unlockIndex).toBeGreaterThan(waitForItemsIndex);
  });

  it('keeps stale-request and explicit failure exits for edit loading', () => {
    expect(formSource).toContain('sequence !== formLoadSequence');
    expect(formSource).toContain('sequence === formLoadSequence');
    expect(formSource).toContain('editLoadError.value =');
    expect(formSource).toContain(`:show-confirm-button="canConfirmForm"`);
    expect(formSource).toContain(
      `v-else-if="formType !== 'detail' && editLoadError"`,
    );
  });

  it('waits only for the first item-grid hydration, not auxiliary lookups', () => {
    const rowsReadyIndex = itemFormSource.indexOf(
      'itemRowsReadyPromise = (async () => {',
    );
    const firstGridHydrationIndex = itemFormSource.indexOf(
      'await refreshItemGrid();',
      rowsReadyIndex,
    );
    const auxiliaryLookupIndex = itemFormSource.indexOf(
      'await Promise.allSettled([',
      firstGridHydrationIndex,
    );
    const exposeIndex = itemFormSource.indexOf('defineExpose({');

    expect(rowsReadyIndex).toBeGreaterThan(-1);
    expect(firstGridHydrationIndex).toBeGreaterThan(rowsReadyIndex);
    expect(auxiliaryLookupIndex).toBeGreaterThan(firstGridHydrationIndex);
    expect(exposeIndex).toBeGreaterThan(auxiliaryLookupIndex);
    expect(itemFormSource).toContain('reloadItemsFromProps');
    expect(itemFormSource).toContain(
      'await syncItemsFromProps(props.items, { force: true });',
    );
    expect(formSource).toContain(
      'await getItemFormInstance()?.reloadItemsFromProps?.();',
    );
  });

  it('keeps local price recalculation and server detail reload without location writes', () => {
    const successHandler = itemFormSource.slice(
      itemFormSource.indexOf('async function handleBatchAdjustPriceSuccess'),
      itemFormSource.indexOf(
        'function buildCartItemDuplicateKey',
        itemFormSource.indexOf('async function handleBatchAdjustPriceSuccess'),
      ),
    );
    const applyHandler = itemFormSource.slice(
      itemFormSource.indexOf('async function applyLocalBatchUpdateItems'),
      itemFormSource.indexOf(
        'function setCountText',
        itemFormSource.indexOf('async function applyLocalBatchUpdateItems'),
      ),
    );

    expect(successHandler).toContain(
      'await applyLocalBatchUpdateItems(payload)',
    );
    expect(successHandler).toContain("emit('batch-update-success');");
    expect(itemFormSource).not.toContain('payload.warehouseId');
    expect(itemFormSource).not.toContain('payload.deptId');
    expect(applyHandler).toContain(
      'const { showMessage = true, validateDuplicate = true } = options;',
    );
    expect(applyHandler).toContain(
      'if (validateDuplicate && hasDuplicateBatchUpdatedItems(nextItems))',
    );
    expect(applyHandler).toContain('if (showMessage) {');
  });

  it('keeps batch price and delete actions without warehouse/dept editing', () => {
    const toolbar = itemFormSource.slice(
      itemFormSource.indexOf('<template #toolbar-tools>'),
      itemFormSource.indexOf(
        '<template #productId=',
        itemFormSource.indexOf('<template #toolbar-tools>'),
      ),
    );

    expect(itemFormSource).toContain('SaleBatchAdjustPriceForm');
    expect(itemFormSource).toContain(
      'const canShowBatchAdjustPrice = computed(',
    );
    expect(toolbar).not.toContain('handleOpenBatchUpdateItems');
    expect(toolbar).not.toContain('批量修改仓库/部门');
    expect(toolbar).toContain('handleOpenBatchAdjustPrice');
    expect(toolbar).toContain('批量调整价格');
    expect(toolbar.indexOf('批量删除')).toBeLessThan(
      toolbar.indexOf('批量调整价格'),
    );
  });

  it('uses price-level batch payload for cart server updates and local recalculation', () => {
    const serverHandler = itemFormSource.slice(
      itemFormSource.indexOf('async function handleBatchAdjustPriceSuccess'),
      itemFormSource.indexOf(
        'function buildCartItemDuplicateKey',
        itemFormSource.indexOf('async function handleBatchAdjustPriceSuccess'),
      ),
    );
    const localBuilder = itemFormSource.slice(
      itemFormSource.indexOf('function buildBatchUpdatedItems'),
      itemFormSource.indexOf(
        'function hasDuplicateBatchUpdatedItems',
        itemFormSource.indexOf('function buildBatchUpdatedItems'),
      ),
    );

    expect(serverHandler).toContain('batchUpdateSaleCartItems({');
    expect(serverHandler).toContain('priceLevel: payload.priceLevel');
    expect(itemFormSource).not.toContain('getPriceSystemProductPriceMap');
    expect(localBuilder).not.toContain('priceSystemPriceMap');
    expect(localBuilder).not.toContain('payload.priceSystemId');
    expect(localBuilder).toContain('payload.priceLevel');
    expect(localBuilder).toContain(
      'row.productPrice = row.giftFlag ? 0 : salePrice;',
    );
  });

  it('keeps persisted page rows one-to-one and only merges unsaved inserts', () => {
    const cacheHandler = formSource.slice(
      formSource.indexOf('function applyRemoteItemCache'),
      formSource.indexOf('function recordRemoteItemChanges'),
    );
    const fullLoader = formSource.slice(
      formSource.indexOf('async function loadAllSaleCartItems'),
      formSource.indexOf('async function buildMergedRemoteItemsForSubmit'),
    );
    const submitBuilder = formSource.slice(
      formSource.indexOf('async function buildMergedRemoteItemsForSubmit'),
      formSource.indexOf('async function handleFirstApprove'),
    );

    expect(cacheHandler).toContain('composeRemoteItemPage({');
    expect(cacheHandler).toContain('itemRowKeyManager.ensureRowKeys(');
    expect(cacheHandler).not.toContain('mergeSaleCartItems(');
    expect(fullLoader).toContain('return rows;');
    expect(fullLoader).not.toContain('mergeSaleCartItems(rows)');
    expect(submitBuilder).toContain('consolidateRemoteCreatesWithMatches');
    expect(submitBuilder).toContain("operation: 'update' as const");
    expect(submitBuilder).toContain("operation: 'delete' as const");
  });

  it('queries whole-cart stock matches before consolidation and jumps to the survivor page', () => {
    expect(formSource).toContain('matchSaleCartItems({');
    expect(formSource).toContain('async function loadRemoteStockMatches');
    expect(formSource).not.toContain(
      'async function resolveRemoteExistingStockCounts',
    );
    expect(formSource).toContain('async function applyRemoteStockSelection');
    expect(formSource).toContain('getRemoteCreatedItemsNavigationPlan({');
    expect(itemFormSource).not.toContain('resolveExistingStockCounts?:');
    expect(itemFormSource).toContain("emit('remoteStockSelectionRequested'");
  });

  it('deduplicates and batches whole-cart match requests for large imports', () => {
    const matchLoader = formSource.slice(
      formSource.indexOf('async function loadRemoteStockMatches'),
      formSource.indexOf('function getEffectiveMatchedItems'),
    );

    expect(formSource).toContain('const REMOTE_STOCK_MATCH_BATCH_SIZE = 200;');
    expect(matchLoader).toContain('const keyMap = new Map(');
    expect(matchLoader).toContain('offset += REMOTE_STOCK_MATCH_BATCH_SIZE');
    expect(matchLoader).toContain('missingItems.slice(');
    expect(matchLoader).toContain('remoteStockNoMatchKeys.add(key)');
  });
});
