import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(
  join(currentDir, '../../../..', 'api/erp/stock/warehouse-move/index.ts'),
  'utf8',
);
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');

function getTemplateSlot(source: string, name: string) {
  const start = source.indexOf(`<template #${name}>`);
  if (start < 0) return '';
  const end = source.indexOf('</template>', start);
  return source.slice(start, end);
}

const centerFooterSource = getTemplateSlot(formSource, 'center-footer');
const prependFooterSource = getTemplateSlot(formSource, 'prepend-footer');

describe('warehouse move draft lifecycle contract', () => {
  it('uses dedicated draft persistence and submission endpoints', () => {
    expect(apiSource).toContain('/erp/warehouse-move/create-draft');
    expect(apiSource).toContain('/erp/warehouse-move/update-draft');
    expect(apiSource).toContain('/erp/warehouse-move/update-and-submit');
    expect(apiSource).toContain('/erp/warehouse-move/submit');
  });

  it('skips draft saving on cancel and submits an edited draft formally', () => {
    expect(formSource).toContain('async onBeforeClose()');
    expect(formSource).toContain('return saveWarehouseMoveDraft()');
    expect(formSource).toContain('async onCancel()');
    expect(formSource).toContain('skipDraftOnClose = true');
    expect(formSource).toContain('createWarehouseMoveDraft(');
    expect(formSource).toContain('updateWarehouseMoveDraft(');
    expect(formSource).toContain('hasValidWarehouseMoveDraftItems');
    expect(formSource).toContain('data.fromWarehouseId');
    expect(formSource).toContain('data.toWarehouseId');
    expect(formSource).toContain('未选择明细，不生成草稿');
    expect(formSource).toContain('async function handleGenerateDraft()');
    expect(formSource).toContain(
      "() => formType.value === 'create' || isEditingDraft.value",
    );
    expect(formSource).toContain(
      "isEditingDraft.value ? '保存草稿' : '生成草稿'",
    );
    expect(formSource).toContain('草稿生成成功');
    expect(formSource).toContain('草稿保存成功');
    expect(formSource).toContain('生成草稿');
    expect(formSource).toContain('保存草稿');
    expect(formSource).toContain(
      'updateAndSubmitWarehouseMoveDraft(',
    );
    expect(formSource).toContain("isEditingDraft.value ? '确认提交'");
    expect(centerFooterSource).toContain('v-if="canGenerateDraft"');
    expect(centerFooterSource).toContain('handleGenerateDraft');
    expect(centerFooterSource).toContain('generateDraftButtonText');
    expect(prependFooterSource).not.toContain('handleGenerateDraft');
    expect(prependFooterSource).not.toContain('canGenerateDraft');
    const closeIndex = formSource.indexOf(
      'async function saveWarehouseMoveDraft',
    );
    expect(
      formSource.indexOf('hasValidWarehouseMoveDraftItems', closeIndex),
    ).toBeLessThan(
      formSource.indexOf('createWarehouseMoveDraft(', closeIndex),
    );
  });

  it('offers direct submission in hydrated draft detail mode', () => {
    expect(formSource).toContain('const canSubmitDraft = computed');
    expect(formSource).toContain("formType.value === 'detail'");
    expect(formSource).toContain('await submitWarehouseMove(id)');
    expect(formSource).toContain('<Button v-if="canSubmitDraft"');
    expect(formSource).toContain('提交后将进入待下单确认状态');
  });

  it('locks before hydration and suppresses stale detail responses', () => {
    const lockIndex = formSource.indexOf('modalApi.lock()');
    const detailRequestIndex = formSource.indexOf(
      'await getWarehouseMove(data.id,',
    );
    expect(lockIndex).toBeGreaterThan(-1);
    expect(detailRequestIndex).toBeGreaterThan(lockIndex);
    expect(formSource).toContain(
      "includeItems: !['detail', 'edit'].includes(data.type)",
    );
    expect(formSource).toContain(
      'await loadWarehouseMoveItemPage({ pageNo: 1 })',
    );
    expect(formSource).toContain('sequence !== detailLoadSequence');
  });

  it('shows draft text, legend, filter option and theme-compatible row color', () => {
    expect(dataSource).toContain("{ label: '草稿', value: 0 }");
    expect(dataSource).toContain("slots: { default: 'status' }");
    expect(listSource).toContain("'warehouse-move-draft-row'");
    expect(listSource).toContain('草稿：页面关闭时自动保存，尚未正式提交');
    expect(listSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(listSource).toContain(
      '.warehouse-move-draft-row.row--hover .vxe-body--column',
    );
  });
});
