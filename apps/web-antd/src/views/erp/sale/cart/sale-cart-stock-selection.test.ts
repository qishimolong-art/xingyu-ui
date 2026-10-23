import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const cartIndexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const cartFormSource = readFileSync(
  join(currentDir, 'modules/form.vue'),
  'utf8',
);
const cartItemSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);

describe('sale cart stock selection contract', () => {
  it('uses the shared Insert create shortcut again', () => {
    expect(cartIndexSource).not.toContain('createShortcutMatcher:');
    expect(cartIndexSource).toContain("tooltip: 'Insert 新增'");
    expect(cartIndexSource).not.toContain("tooltip: '0 新增'");
    expect(cartItemSource).toContain('isCreateShortcutKey(event)');
    const createShortcutStart = cartItemSource.indexOf(
      'if (!props.disabled && !event.shiftKey && isCreateShortcutKey(event))',
    );
    const createShortcutEnd = cartItemSource.indexOf(
      'void handleAddBlankItemRow();',
      createShortcutStart,
    );
    expect(createShortcutStart).toBeGreaterThan(-1);
    expect(createShortcutEnd).toBeGreaterThan(createShortcutStart);
    expect(
      cartItemSource.slice(createShortcutStart, createShortcutEnd),
    ).not.toContain('isEditableEnterTarget(event.target)');
    expect(cartItemSource).toContain('<kbd>Insert</kbd><b>新增行</b>');
  });

  it('adds selected stock directly without the review modal', () => {
    expect(cartItemSource).not.toContain('StockSelectionReviewModal');
    expect(cartItemSource).not.toContain(':before-confirm=');
    expect(cartItemSource).toContain('const selectedRows = products.map(');
    expect(cartItemSource).toContain('count: 1,');
    expect(cartItemSource).toContain('productPrice: salePrice');
  });

  it('clears stale customer and department values before initializing create mode', () => {
    const createBranch = cartFormSource.slice(
      cartFormSource.indexOf('if (!data.id) {'),
    );
    const resetIndex = createBranch.indexOf('await formApi.resetForm();');
    const createValuesIndex = createBranch.indexOf('const createValues = {');
    const formDataIndex = createBranch.indexOf('formData.value = {');
    const setValuesIndex = createBranch.indexOf('await formApi.setValues({');

    expect(resetIndex).toBeGreaterThanOrEqual(0);
    expect(resetIndex).toBeLessThan(createValuesIndex);
    expect(createValuesIndex).toBeLessThan(formDataIndex);
    expect(formDataIndex).toBeLessThan(setValuesIndex);
  });

  it('waits for the customer department and preserves it when copying', () => {
    expect(cartFormSource).toContain('deptId: undefined,');
    expect(cartFormSource).not.toContain(
      'copyData.deptId = userStore.userInfo?.deptId',
    );
    expect(cartFormSource).toContain(
      'await loadSaleDeptOptions(copyData.customerId, copyData.deptId);',
    );
  });

  it('updates only the department field after the first customer selection', () => {
    const loadDeptBranch = cartFormSource.slice(
      cartFormSource.indexOf('async function loadSaleDeptOptions('),
      cartFormSource.indexOf('const getTitle = computed'),
    );

    expect(loadDeptBranch).toContain(
      'const preservedValues =\n      (await formApi.getValues())',
    );
    expect(loadDeptBranch).toContain('formApi.updateSchema([');
    expect(loadDeptBranch).not.toContain('await refreshFormSchema();');
    expect(loadDeptBranch).toContain('...preservedValues,');
    expect(loadDeptBranch).toContain('customerId,');
    expect(cartFormSource).toContain(
      "!saleDeptSyncing &&\n      changedFields.includes('customerId')",
    );
  });

  it('passes the explicitly synchronized sale department to product items', () => {
    expect(cartFormSource).toContain('currentSaleDeptId.value = deptId;');
    expect(cartFormSource).toContain(
      "changedFields.includes('deptId') && !saleDeptSyncing",
    );
    expect(cartFormSource).toContain(
      'currentSaleDeptId.value = values.deptId;',
    );
    expect(cartFormSource).toContain(':dept-id="currentSaleDeptId"');
  });

  it('syncs the loaded sale department before rendering detail item rows', () => {
    const detailBranch = cartFormSource.slice(
      cartFormSource.indexOf('async function loadDetailData('),
      cartFormSource.indexOf('function buildSaleCartCopyData('),
    );
    const hydrateIndex = detailBranch.indexOf(
      'formData.value = normalizeLoadedSaleCart(sourceData);',
    );
    const syncDeptIndex = detailBranch.indexOf(
      'currentSaleDeptId.value = formData.value?.deptId;',
    );

    expect(hydrateIndex).toBeGreaterThanOrEqual(0);
    expect(syncDeptIndex).toBeGreaterThan(hydrateIndex);
  });

  it('loads customer price level before refreshing detail field permissions', () => {
    const detailBranch = cartFormSource.slice(
      cartFormSource.indexOf('async function loadDetailData('),
      cartFormSource.indexOf('function buildSaleCartCopyData('),
    );
    const hydrateIndex = detailBranch.indexOf(
      'formData.value = normalizeLoadedSaleCart(sourceData);',
    );
    const priceLevelIndex = detailBranch.indexOf(
      'await loadCustomerPriceLevel(formData.value?.customerId);',
    );
    const permissionReloadIndex = detailBranch.indexOf(
      'await loadHiddenFields(undefined, true, currentCustomerPriceLevel.value);',
    );

    expect(hydrateIndex).toBeGreaterThanOrEqual(0);
    expect(priceLevelIndex).toBeGreaterThan(hydrateIndex);
    expect(permissionReloadIndex).toBeGreaterThan(priceLevelIndex);
  });
});
