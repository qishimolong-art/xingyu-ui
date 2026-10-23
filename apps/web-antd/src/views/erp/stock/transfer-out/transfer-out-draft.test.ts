import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/stock/transfer-out/index.ts'),
  'utf8',
);
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');

function getTemplateSlot(source: string, name: string) {
  const match = source.match(new RegExp(`<template[^>]*#${name}[^>]*>`, 'm'));
  const start = match?.index ?? -1;
  if (start < 0) return '';
  const end = source.indexOf('</template>', start);
  return source.slice(start, end);
}

const centerFooterSource = getTemplateSlot(formSource, 'center-footer');
const prependFooterSource = getTemplateSlot(formSource, 'prepend-footer');

describe('stock transfer-out draft lifecycle contract', () => {
  it('uses separate relaxed draft and formal submission endpoints', () => {
    expect(apiSource).toContain('/erp/stock-transfer-out/create-draft');
    expect(apiSource).toContain('/erp/stock-transfer-out/create-and-submit');
    expect(apiSource).toContain('/erp/stock-transfer-out/update-draft');
    expect(apiSource).toContain('/erp/stock-transfer-out/update-and-submit');
    expect(apiSource).toContain('/erp/stock-transfer-out/submit');
  });

  it('auto-saves allowed closes but skips persistence on explicit cancel', () => {
    expect(formSource).toContain('async onBeforeClose()');
    expect(formSource).toContain('return saveStockTransferOutDraft()');
    expect(formSource).toContain('async onCancel()');
    expect(formSource).toContain('skipDraftOnClose = true');
    expect(formSource).toContain('createStockTransferOutDraft(');
    expect(formSource).toContain('updateStockTransferOutDraft(');
    expect(formSource).toContain('hasValidStockTransferDraftItems');
    expect(formSource).toContain('未选择明细，不生成草稿');
    expect(formSource).toContain('async function handleGenerateDraft()');
    expect(formSource).toContain(
      "!reportViewOnly && (formType.value === 'create' || isEditingDraft.value)",
    );
    expect(formSource).toContain(
      "isEditingDraft.value ? '保存草稿' : '生成草稿'",
    );
    expect(formSource).toContain('草稿生成成功');
    expect(formSource).toContain('草稿保存成功');
    expect(formSource).toContain('生成草稿');
    expect(formSource).toContain('保存草稿');
    expect(centerFooterSource).toContain('v-if="canGenerateDraft"');
    expect(centerFooterSource).toContain('handleGenerateDraft');
    expect(centerFooterSource).toContain('generateDraftButtonText');
    expect(prependFooterSource).not.toContain('handleGenerateDraft');
    expect(prependFooterSource).not.toContain('canGenerateDraft');
    expect(formSource).toContain('if (draftSaving)');
    expect(formSource).toContain('draftSaved = true');
    const closeIndex = formSource.indexOf(
      'async function saveStockTransferOutDraft',
    );
    expect(
      formSource.indexOf('hasValidStockTransferDraftItems', closeIndex),
    ).toBeLessThan(
      formSource.indexOf('createStockTransferOutDraft(', closeIndex),
    );
  });

  it('formally submits create and draft-edit payloads before closing', () => {
    const createIndex = formSource.indexOf(
      'await createAndSubmitStockTransferOut(',
    );
    const updateIndex = formSource.indexOf(
      'await updateAndSubmitStockTransferOutDraft(',
    );
    const closeIndex = formSource.indexOf(
      'await modalApi.close()',
      Math.max(createIndex, updateIndex),
    );

    expect(createIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(createIndex);
    expect(closeIndex).toBeGreaterThan(updateIndex);
    expect(formSource).toContain("? '确认提交'");
  });

  it('keeps remote item insert/delete changes in a single submit payload', () => {
    expect(itemFormSource).toContain('const emit = defineEmits([');
    expect(itemFormSource).toContain("'append-items'");
    expect(itemFormSource).toContain("'page-change'");
    expect(itemFormSource).toContain("'request-submit'");
    expect(itemFormSource).toContain("'update:items'");
    expect(itemFormSource).toContain("emit('update:items', getItems())");
    expect(formSource).toContain('@update:items="queueUpdateItems"');
    expect(formSource).toContain('async function handleUpdateItems(');
    expect(formSource).toContain(
      'items: ErpStockTransferOutApi.StockTransferOutItem[]',
    );
    expect(formSource).toContain('recordRemoteItemChanges(items);');
    expect(formSource).toContain(
      'await buildCurrentTransferOutPayloadWithItems(submitItems)',
    );
    expect(formSource).not.toContain(
      'items: await buildMergedRemoteItemsForSubmit()',
    );
  });

  it('offers strict direct submission only for a hydrated draft detail', () => {
    expect(formSource).toContain('const canSubmitDraft = computed');
    expect(formSource).toContain("formType.value === 'detail'");
    expect(formSource).toContain(
      'formData.value?.status === STOCK_TRANSFER_OUT_STATUS.DRAFT',
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:stock-transfer-out:update'])",
    );
    expect(formSource).toContain('await submitStockTransferOutDraft(id)');
    expect(formSource).toContain('<Button v-if="canSubmitDraft"');
    expect(formSource).toContain(
      '提交后将进入待审批状态，不能再按草稿方式修改。',
    );
  });

  it('locks before hydration and ignores stale detail responses', () => {
    const lockIndex = formSource.indexOf('modalApi.lock()');
    const detailRequestIndex = formSource.indexOf(
      'await getStockTransferOutWithOptions(data.id',
    );
    expect(lockIndex).toBeGreaterThan(-1);
    expect(detailRequestIndex).toBeGreaterThan(lockIndex);
    expect(formSource).toContain(
      "includeItems: !['detail', 'edit'].includes(data.type)",
    );
    expect(formSource).toContain(
      'await loadStockTransferOutItemPage({ pageNo: 1 })',
    );
    expect(formSource).toContain('sequence !== detailLoadSequence');
  });

  it('seeds create forms with the current order time', () => {
    expect(formSource).toContain('moveTime: Date.now()');
    expect(dataSource).toContain("fieldName: 'moveTime'");
    expect(dataSource).toContain("valueFormat: 'x'");
  });

  it('shows an accessible draft status, row highlight, filter and legend', () => {
    expect(dataSource).toContain("{ label: '草稿', value: 0 }");
    expect(dataSource).toContain("slots: { default: 'status' }");
    expect(listSource).toContain("'transfer-out-draft-row'");
    expect(listSource).toContain('草稿：页面关闭时自动保存，尚未正式提交');
    expect(listSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(listSource).toContain(
      '.transfer-out-draft-row.row--hover .vxe-body--column',
    );
  });

  it('shows an edit action for drafts in the fixed operation column', () => {
    expect(listSource).toContain(
      'function isDraftTransferOut(row: ErpStockTransferOutApi.StockTransferOut)',
    );
    expect(listSource).toContain(
      'row.status === STOCK_TRANSFER_OUT_STATUS.DRAFT && row.sourceType !== 30',
    );
    expect(listSource).toContain("label: '编辑'");
    expect(listSource).toMatch(/auth:\s*\['erp:stock-transfer-out:update'\]/);
    expect(listSource).toContain('ifShow: () => isDraftTransferOut(row)');
    expect(listSource).toContain('onClick: handleEdit.bind(null, row)');
    expect(listSource).toContain('row.sourceType !== 30');
    expect(listSource).toContain('销售手推车来源调拨出库单不允许编辑');
    expect(formSource).toContain('formData.value?.sourceType !== 30');
  });
});
