import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');
const indexSource = readFileSync(join(currentDir, '../index.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../../../api/erp/finance/payment/index.ts'),
  'utf8',
);

function getTemplateSlot(source: string, name: string) {
  const marker = `#${name}`;
  const markerIndex = source.indexOf(marker);
  const start = source.lastIndexOf('<template', markerIndex);
  if (start === -1) return '';
  const end = source.indexOf('</template>', start);
  return source.slice(start, end);
}

const centerFooterSource = getTemplateSlot(formSource, 'center-footer');
const prependFooterSource = getTemplateSlot(formSource, 'prepend-footer');
const closeHandler = formSource.slice(
  formSource.indexOf('async onBeforeClose() {'),
  formSource.indexOf(
    'async onConfirm() {',
    formSource.indexOf('async onBeforeClose() {'),
  ),
);
const draftHandler = formSource.slice(
  formSource.indexOf('async function saveCurrentDraft'),
  formSource.indexOf(
    'function handleSubmitDraftFromDetail',
    formSource.indexOf('async function saveCurrentDraft'),
  ),
);
const confirmHandler = formSource.slice(
  formSource.indexOf('async onConfirm() {'),
  formSource.indexOf(
    'async onOpenChange(',
    formSource.indexOf('async onConfirm() {'),
  ),
);

describe('finance payment draft lifecycle', () => {
  it('explicit cancel skips automatic draft persistence', () => {
    expect(closeHandler).toContain('async onCancel() {');
    expect(closeHandler).toContain('skipDraftOnClose = true;');
    expect(closeHandler).toContain('await modalApi.close();');
  });

  it('other closes create or update one draft and retain the form on failure', () => {
    const detailGuardIndex = draftHandler.indexOf(
      'hasValidFinancePaymentDraftItems(payload.items ?? [])',
    );
    const createDraftIndex = draftHandler.indexOf(
      'await createFinancePaymentDraft(payload);',
    );
    expect(detailGuardIndex).toBeGreaterThan(-1);
    expect(createDraftIndex).toBeGreaterThan(detailGuardIndex);
    expect(closeHandler).toContain('return saveCurrentDraft();');
    expect(draftHandler).toContain("message.warning('未选择明细，不生成草稿')");
    expect(draftHandler).toContain('await createFinancePaymentDraft(payload);');
    expect(draftHandler).toContain('await updateFinancePaymentDraft(payload);');
    expect(draftHandler).toContain('if (draftSaving) return false;');
    expect(draftHandler).toContain('draftSaved = true;');
    expect(draftHandler).toContain('return false;');
  });

  it('offers explicit draft creation and stays open when no valid detail exists', () => {
    expect(formSource).toContain('const canGenerateDraft = computed');
    expect(formSource).toContain(
      "(formType.value === 'create' || isEditingDraft.value)",
    );
    expect(formSource).toContain(
      "isEditingDraft.value ? '保存草稿' : '生成草稿'",
    );
    expect(formSource).toContain('async function handleGenerateDraft()');
    expect(formSource).toContain('saveCurrentDraft({ explicit: true })');
    expect(draftHandler).toContain('return !options.explicit;');
    expect(formSource).toContain('草稿生成成功');
    expect(formSource).toContain('草稿保存成功');
    expect(centerFooterSource).toContain('v-if="canGenerateDraft"');
    expect(centerFooterSource).toContain('handleGenerateDraft');
    expect(centerFooterSource).toContain('generateDraftButtonText');
    expect(prependFooterSource).not.toContain('handleGenerateDraft');
    expect(prependFooterSource).not.toContain('canGenerateDraft');
    expect(formSource).toContain('skipDraftOnClose = true;');
  });

  it('confirm uses transactional create/update-and-submit routes', () => {
    const createIndex = confirmHandler.indexOf(
      'await createAndSubmitFinancePayment(payload);',
    );
    const updateIndex = confirmHandler.indexOf(
      'await updateAndSubmitFinancePayment(payload);',
    );
    const closeIndex = confirmHandler.indexOf('await modalApi.close();');
    expect(createIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(Math.max(createIndex, updateIndex));
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:finance-payment:update-status'])",
    );
    expect(formSource).toContain("'确认提交' : '确定'");
  });

  it('detail mode submits persisted drafts directly', () => {
    expect(formSource).toContain('canSubmitDraftFromDetail');
    expect(formSource).toContain('handleSubmitDraftFromDetail');
    expect(formSource).toContain('await submitFinancePayment(id);');
    expect(formSource).toContain('提交后将进入待审核状态');
  });

  it('detail mode exposes edit and reloads detail header plus full items before switching schema', () => {
    expect(formSource).toContain('const canEditFromDetail = computed');
    expect(formSource).toContain('formData.value.status !== 20');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:finance-payment:update'])",
    );
    expect(formSource).toContain('async function handleEditFromDetail()');
    expect(formSource).toContain(
      'const detail = await getFinancePayment(id, { includeItems: false });',
    );
    expect(formSource).toContain('await fetchAllFinancePaymentItems(id)');
    expect(formSource).toContain("await applyFormMode('edit');");
    expect(formSource).toContain('isPopulatingForm.value = true;');
    expect(formSource).toContain('v-if="canEditFromDetail"');
  });

  it('draft rows expose text, tooltip, highlight and legend', () => {
    expect(indexSource).toContain("'finance-payment-draft-row'");
    expect(indexSource).toContain('草稿：关闭新增或草稿编辑页面时自动保存');
    expect(indexSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(indexSource).toContain("row.status === 0 ? '编辑草稿'");
  });

  it('uses separate draft and transactional formal-submit endpoints', () => {
    expect(apiSource).toContain('/erp/finance-payment/create-draft');
    expect(apiSource).toContain('/erp/finance-payment/update-draft');
    expect(apiSource).toContain('/erp/finance-payment/create-and-submit');
    expect(apiSource).toContain('/erp/finance-payment/update-and-submit');
    expect(apiSource).toContain('/erp/finance-payment/submit');
    expect(apiSource).toContain('/erp/finance-payment/item-page');
  });
});
