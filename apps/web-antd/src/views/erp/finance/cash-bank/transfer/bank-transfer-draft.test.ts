import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { transpileModule } from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/finance/transfer/index.ts'),
  'utf8',
);

function getTemplateSlot(source: string, name: string) {
  const start = source.indexOf(`<template`);
  const namedStart = source.indexOf(`#${name}`, start);
  if (namedStart === -1) return '';
  const tagStart = source.lastIndexOf('<template', namedStart);
  const end = source.indexOf('</template>', namedStart);
  return source.slice(tagStart, end);
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

// Execute the actual save handlers with API/form boundaries stubbed.
function createDraftHarness(editing = false) {
  const bindings = {
    formType: { value: editing ? 'edit' : 'create' },
    isEditingDraft: { value: editing },
    formData: { value: editing ? { id: 10 } : {} },
    detailLoadError: { value: '' },
    canGenerateDraft: { value: true },
    hasOpenFormControlPopup: vi.fn().mockReturnValue(false),
    formApi: { validate: vi.fn().mockResolvedValue({ valid: true }) },
    modalApi: { lock: vi.fn(), unlock: vi.fn(), close: vi.fn() },
    buildCurrentPayload: vi.fn().mockResolvedValue({
      outAccountId: 1,
      inAccountId: 2,
      transferPrice: 100,
    }),
    createFinanceTransferDraft: vi.fn().mockResolvedValue(1),
    updateFinanceTransferDraft: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn(),
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  };
  const handlers = formSource.slice(
    formSource.indexOf('async function saveCurrentDraft'),
    formSource.indexOf('async function handleEditFromDetail'),
  );
  const escapeHandler = formSource.slice(
    formSource.indexOf('function handleBasicFormEscape'),
    formSource.indexOf('function handleBasicFormEnter'),
  );
  const js = transpileModule(
    `
    let skipDraftOnClose = false;
    let draftSaved = false;
    let draftSaving = false;
    ${escapeHandler}
    ${handlers}
    return { saveCurrentDraft, handleGenerateDraft, handleBasicFormEscape };
  `,
    {},
  ).outputText;
  // eslint-disable-next-line no-new-func -- Execute repository handlers with mocked boundaries.
  const run = new Function(...Object.keys(bindings), js)(
    ...Object.values(bindings),
  ) as {
    handleGenerateDraft: () => Promise<void>;
    handleBasicFormEscape: (event: KeyboardEvent) => void;
    saveCurrentDraft: (options?: { explicit?: boolean }) => Promise<boolean>;
  };
  return { ...bindings, ...run };
}

describe('bank transfer draft required validation', () => {
  it('reserves Escape for an open control popup before the modal can close', () => {
    const h = createDraftHarness();
    h.hasOpenFormControlPopup.mockReturnValue(true);
    const popupEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    });
    h.handleBasicFormEscape(popupEscape);
    expect(popupEscape.defaultPrevented).toBe(true);
    h.hasOpenFormControlPopup.mockReturnValue(false);
    const formEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    });
    h.handleBasicFormEscape(formEscape);
    expect(formEscape.defaultPrevented).toBe(false);
    expect(formSource).toContain(
      '@keydown.esc.capture="handleBasicFormEscape"',
    );
  });

  it('does not close or save while an IME composition is active', () => {
    const h = createDraftHarness();
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
      isComposing: true,
    });
    h.handleBasicFormEscape(event);
    expect(event.defaultPrevented).toBe(true);
    expect(h.createFinanceTransferDraft).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'rejects invalid form without persistence or success events (editing=%s)',
    async (editing) => {
      const h = createDraftHarness(editing);
      h.formApi.validate.mockResolvedValue({ valid: false });
      expect(await h.saveCurrentDraft()).toBe(false);
      expect(h.createFinanceTransferDraft).not.toHaveBeenCalled();
      expect(h.updateFinanceTransferDraft).not.toHaveBeenCalled();
      expect(h.buildCurrentPayload).not.toHaveBeenCalled();
      expect(h.emit).not.toHaveBeenCalled();
      expect(h.message.warning).toHaveBeenCalled();
      expect(h.modalApi.unlock).toHaveBeenCalledOnce();

      h.formApi.validate.mockResolvedValue({ valid: true });
      expect(await h.saveCurrentDraft()).toBe(true);
      expect(
        editing ? h.updateFinanceTransferDraft : h.createFinanceTransferDraft,
      ).toHaveBeenCalledOnce();
      expect(await h.saveCurrentDraft()).toBe(true);
      expect(h.formApi.validate).toHaveBeenCalledTimes(2);
    },
  );

  it('explicit draft button keeps invalid form open and closes after correction', async () => {
    const h = createDraftHarness();
    h.formApi.validate.mockResolvedValue({ valid: false });
    await h.handleGenerateDraft();
    expect(h.modalApi.close).not.toHaveBeenCalled();
    h.formApi.validate.mockResolvedValue({ valid: true });
    await h.handleGenerateDraft();
    expect(h.modalApi.close).toHaveBeenCalledOnce();
    await h.saveCurrentDraft();
    expect(h.createFinanceTransferDraft).toHaveBeenCalledOnce();
  });

  it('rejects equal accounts after field validation', async () => {
    const h = createDraftHarness();
    h.buildCurrentPayload.mockResolvedValue({
      outAccountId: 1,
      inAccountId: 1,
      transferPrice: 100,
    });
    expect(await h.saveCurrentDraft()).toBe(false);
    expect(h.createFinanceTransferDraft).not.toHaveBeenCalled();
    expect(h.message.error).toHaveBeenCalledWith('转出账户和转入账户不能相同');
    expect(h.modalApi.unlock).toHaveBeenCalledOnce();
  });

  it('prevents repeated close events from starting concurrent saves', async () => {
    const h = createDraftHarness();
    let finishValidation!: (value: { valid: boolean }) => void;
    h.formApi.validate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishValidation = resolve;
        }),
    );
    const pending = h.saveCurrentDraft();
    expect(await h.saveCurrentDraft()).toBe(false);
    finishValidation({ valid: true });
    expect(await pending).toBe(true);
    expect(h.formApi.validate).toHaveBeenCalledOnce();
    expect(h.createFinanceTransferDraft).toHaveBeenCalledOnce();
  });

  it('retains form on API failure and permits a later retry', async () => {
    const h = createDraftHarness();
    h.createFinanceTransferDraft.mockRejectedValueOnce(new Error('offline'));
    expect(await h.saveCurrentDraft()).toBe(false);
    expect(h.emit).not.toHaveBeenCalled();
    expect(h.message.success).not.toHaveBeenCalled();
    expect(h.modalApi.unlock).toHaveBeenCalledOnce();
    expect(await h.saveCurrentDraft()).toBe(true);
    expect(h.emit).toHaveBeenCalledOnce();
  });
});

describe('bank transfer draft lifecycle', () => {
  it('explicit cancel skips automatic draft persistence', () => {
    expect(closeHandler).toContain('async onCancel() {');
    expect(closeHandler).toContain('skipDraftOnClose = true;');
    expect(closeHandler).toContain('await modalApi.close();');
  });

  it('other closes create or update one draft and retain the form on failure', () => {
    expect(closeHandler).toContain('return saveCurrentDraft();');
    expect(draftHandler).toContain(
      'await createFinanceTransferDraft(payload);',
    );
    expect(draftHandler).toContain(
      'await updateFinanceTransferDraft(payload);',
    );
    expect(draftHandler).toContain('if (draftSaving) return false;');
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
      'await createAndSubmitFinanceTransfer(data);',
    );
    const updateIndex = confirmHandler.indexOf(
      'await updateAndSubmitFinanceTransfer(data);',
    );
    const closeIndex = confirmHandler.indexOf('await modalApi.close();');
    expect(createIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(Math.max(createIndex, updateIndex));
    expect(formSource).toContain("'erp:finance-transfer:update-status'");
    expect(formSource).toContain("? '确认提交' : '确定'");
  });

  it('detail mode submits persisted drafts directly', () => {
    expect(formSource).toContain('canSubmitDraftFromDetail');
    expect(formSource).toContain('handleSubmitDraftFromDetail');
    expect(formSource).toContain('await submitFinanceTransfer(id);');
    expect(formSource).toContain(
      '提交后将进入待审核状态，不能再按草稿方式修改。',
    );
  });

  it('detail mode exposes edit using the existing list status and permission rule', () => {
    expect(formSource).toContain('const canEditFromDetail = computed');
    expect(formSource).toContain('formData.value.status !== 20');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:finance-transfer:update'])",
    );
    expect(formSource).toContain('async function handleEditFromDetail()');
    expect(formSource).toContain(
      'const detail = await getFinanceTransfer(id);',
    );
    expect(formSource).toContain("await applyFormMode('edit');");
    expect(formSource).toContain('v-if="canEditFromDetail"');
  });

  it('locks before hydration and ignores stale requests', () => {
    const openIndex = formSource.indexOf('async onOpenChange(');
    const lockIndex = formSource.indexOf('modalApi.lock();', openIndex);
    const loadIndex = formSource.indexOf(
      'await loadHiddenFields();',
      openIndex,
    );
    expect(lockIndex).toBeGreaterThan(openIndex);
    expect(lockIndex).toBeLessThan(loadIndex);
    expect(formSource).toContain('requestId !== openRequestId');
  });

  it('draft rows expose text, tooltip, highlight and legend', () => {
    expect(indexSource).toContain("'bank-transfer-draft-row'");
    expect(indexSource).toContain(
      '草稿：关闭新增或草稿编辑页面时自动保存，尚未正式提交',
    );
    expect(indexSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(indexSource).toContain(
      "row.status === 0 ? '编辑草稿' : $t('common.edit')",
    );
  });

  it('uses separate draft and transactional formal-submit endpoints', () => {
    expect(apiSource).toContain('/erp/finance-transfer/create-draft');
    expect(apiSource).toContain('/erp/finance-transfer/update-draft');
    expect(apiSource).toContain('/erp/finance-transfer/create-and-submit');
    expect(apiSource).toContain('/erp/finance-transfer/update-and-submit');
    expect(apiSource).toContain('/erp/finance-transfer/submit');
  });

  it('keeps batch edits of drafts in draft status', () => {
    expect(apiSource).toContain('detail.status === 0');
    expect(apiSource).toContain('updateFinanceTransferDraft(detail)');
  });
});
