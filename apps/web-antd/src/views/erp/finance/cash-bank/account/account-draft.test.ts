import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/finance/account/index.ts'),
  'utf8',
);

function getTemplateSlot(source: string, name: string) {
  const start = source.indexOf(`<template #${name}>`);
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

describe('account draft lifecycle', () => {
  it('uses a separate submission state instead of overloading enable status', () => {
    expect(apiSource).toContain('ACCOUNT_DOCUMENT_STATUS');
    expect(apiSource).toContain('documentStatus?: number');
    expect(dataSource).toContain("field: 'documentStatus'");
    expect(dataSource).toContain("field: 'status'");
  });

  it('explicit cancel skips automatic draft persistence', () => {
    expect(closeHandler).toContain('async onCancel() {');
    expect(closeHandler).toContain('skipDraftOnClose = true;');
    expect(closeHandler).toContain('await modalApi.close();');
  });

  it('other closes create or update one draft and retain the form on failure', () => {
    expect(closeHandler).toContain('return saveCurrentDraft();');
    expect(draftHandler).toContain('createAccountDraft(data)');
    expect(draftHandler).toContain('updateAccountDraft(data)');
    expect(draftHandler).toContain('if (draftSaving)');
    expect(draftHandler).toContain('draftSaved = true;');
    expect(draftHandler).toContain('return false;');
  });

  it('offers explicit draft creation and avoids duplicate close persistence', () => {
    expect(formSource).toContain('const canGenerateDraft = computed');
    expect(formSource).toContain(
      "(formType.value === 'create' || isEditingDraft.value)",
    );
    expect(formSource).toContain(
      "isEditingDraft.value ? '保存草稿' : '生成草稿'",
    );
    expect(formSource).toContain('async function handleGenerateDraft()');
    expect(formSource).toContain('saveCurrentDraft({ explicit: true })');
    expect(formSource).toContain('options.explicit');
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
      'await createAndSubmitAccount(data);',
    );
    const updateIndex = confirmHandler.indexOf(
      'await updateAndSubmitAccount(data);',
    );
    const closeIndex = confirmHandler.indexOf('await modalApi.close();');
    expect(createIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(Math.max(createIndex, updateIndex));
    expect(formSource).toContain(':confirm-text="confirmText"');
  });

  it('detail mode submits persisted drafts with update permission', () => {
    expect(formSource).toContain('canSubmitDraftFromDetail');
    expect(formSource).toContain("hasAccessByCodes(['erp:account:update'])");
    expect(formSource).toContain('await submitAccountDraft(id);');
    expect(formSource).toContain('提交后将成为正式账户');
  });

  it('detail mode exposes edit using the existing account update permission', () => {
    expect(formSource).toContain('const canEditFromDetail = computed');
    expect(formSource).toContain('async function handleEditFromDetail()');
    expect(formSource).toContain("hasAccessByCodes(['erp:account:update'])");
    expect(formSource).toContain('const account = await getAccount(id);');
    expect(formSource).toContain("formType.value = 'edit';");
    expect(formSource).toContain('v-if="canEditFromDetail"');
  });

  it('draft rows expose text, tooltip, highlight and legend', () => {
    expect(indexSource).toContain("'account-management-draft-row'");
    expect(indexSource).toContain('草稿：关闭新增或草稿编辑页面时自动保存');
    expect(indexSource).toContain('浅蓝色行表示未正式提交的账户草稿');
    expect(indexSource).toContain("'编辑草稿'");
  });

  it('guards draft-only inappropriate list actions', () => {
    expect(indexSource).toContain('草稿不能批量修改');
    expect(indexSource).toContain('草稿尚未正式提交，不能设置为默认账户');
    expect(indexSource).toContain('ifShow: () => !isAccountDraft(row)');
  });

  it('uses separate draft and formal-submit endpoints', () => {
    expect(apiSource).toContain('/erp/account/create-draft');
    expect(apiSource).toContain('/erp/account/update-draft');
    expect(apiSource).toContain('/erp/account/create-and-submit');
    expect(apiSource).toContain('/erp/account/update-and-submit');
    expect(apiSource).toContain('/erp/account/submit');
  });
});
