import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/finance/payable/expense/index.ts'),
  'utf8',
);
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');

function getTemplateSlot(source: string, name: string) {
  const match = source.match(new RegExp(`<template[^>]*#${name}[^>]*>`));
  const start = match?.index ?? -1;
  if (start === -1) return '';
  const end = source.indexOf('</template>', start);
  return source.slice(start, end);
}

const centerFooterSource = getTemplateSlot(formSource, 'center-footer');
const prependFooterSource = getTemplateSlot(formSource, 'prepend-footer');

describe('payable expense draft lifecycle contract', () => {
  it('uses dedicated draft persistence and formal submission endpoints', () => {
    expect(apiSource).toContain('/erp/payable-expense/create-draft');
    expect(apiSource).toContain('/erp/payable-expense/create-and-submit');
    expect(apiSource).toContain('/erp/payable-expense/update-draft');
    expect(apiSource).toContain('/erp/payable-expense/update-and-submit');
    expect(apiSource).toContain('/erp/payable-expense/submit');
  });

  it('skips draft saving on cancel and saves on other closes', () => {
    const detailGuardIndex = formSource.indexOf(
      'hasValidFinanceNamedAmountDraftItems(payload.items ?? [])',
    );
    const createDraftIndex = formSource.indexOf(
      'createPayableExpenseDraft(payload)',
    );
    expect(detailGuardIndex).toBeGreaterThan(-1);
    expect(createDraftIndex).toBeGreaterThan(detailGuardIndex);
    expect(formSource).toContain("message.warning('未选择明细，不生成草稿')");
    expect(formSource).toContain('async onBeforeClose()');
    expect(formSource).toContain('return saveCurrentDraft();');
    expect(formSource).toContain('async onCancel()');
    expect(formSource).toContain('skipDraftOnClose = true');
    expect(formSource).toContain('createPayableExpenseDraft(payload)');
    expect(formSource).toContain('updatePayableExpenseDraft(payload)');
    expect(formSource).toContain('draftSaved = true');
  });

  it('lets the close animation finish before destroying complex form state', () => {
    const openChangeIndex = formSource.indexOf(
      'async onOpenChange(isOpen: boolean)',
    );
    const closedBranchEnd = formSource.indexOf(
      'const requestId = ++openRequestId;',
      openChangeIndex,
    );
    const closedBranch = formSource.slice(openChangeIndex, closedBranchEnd);

    expect(openChangeIndex).toBeGreaterThan(-1);
    expect(closedBranchEnd).toBeGreaterThan(openChangeIndex);
    expect(closedBranch).toContain('if (!isOpen)');
    expect(closedBranch).toContain('++openRequestId;');
    expect(closedBranch).not.toContain('modalApi.unlock()');
    expect(closedBranch).not.toContain(
      'formData.value = createDefaultFormData()',
    );
    expect(closedBranch).not.toContain('tableData.value = []');
    expect(closedBranch).not.toContain('resetRemoteItemState()');
    expect(listSource).toContain('destroyOnClose: true');
    expect(formSource).not.toContain('data-[state=closed]:hidden');

    const openBranch = formSource.slice(closedBranchEnd);
    expect(openBranch).toContain('await formApi.resetForm()');
    expect(openBranch).toContain('formData.value = baseDefaultValues');
    expect(openBranch).toContain('tableData.value = []');
    expect(openBranch).toContain('resetRemoteItemState()');
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
    expect(formSource).toContain('return !options.explicit;');
    expect(formSource).toContain('草稿生成成功');
    expect(formSource).toContain('草稿保存成功');
    expect(centerFooterSource).toContain('v-if="canGenerateDraft"');
    expect(centerFooterSource).toContain('handleGenerateDraft');
    expect(centerFooterSource).toContain('generateDraftButtonText');
    expect(prependFooterSource).not.toContain('handleGenerateDraft');
    expect(prependFooterSource).not.toContain('canGenerateDraft');
    expect(formSource).toContain('skipDraftOnClose = true');
  });

  it('strictly submits create and draft edit with matching permissions', () => {
    expect(formSource).toContain('createAndSubmitPayableExpense(data)');
    expect(formSource).toContain('updateAndSubmitPayableExpense(data)');
    expect(formSource).toContain("? '确认提交'");
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:payable-expense:create']) &&",
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:payable-expense:update']) &&",
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:payable-expense:update-status'])",
    );
  });

  it('offers direct submission only in hydrated permitted draft detail', () => {
    expect(formSource).toContain('const canSubmitDraftFromDetail = computed');
    expect(formSource).toContain('formData.value.status === 0');
    expect(formSource).toContain('await submitPayableExpense(id)');
    expect(formSource).toContain('v-if="canSubmitDraftFromDetail"');
    expect(formSource).toContain('提交后将进入待审核状态');
  });

  it('offers detail edit only for draft or pending rows and hydrates paged items', () => {
    expect(formSource).toContain('const canEditFromDetail = computed');
    expect(formSource).toContain(
      '[0, 10].includes(Number(formData.value.status))',
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:payable-expense:update'])",
    );
    expect(formSource).toContain('async function handleEditFromDetail()');
    expect(formSource).toContain(
      'const detail = await getPayableExpense(id, { includeItems: false })',
    );
    expect(formSource).toContain("await applyFormMode('edit')");
    expect(formSource).toContain('await loadPayableExpenseItemsPage({');
    expect(formSource).toContain('cacheCurrent: false');
    expect(formSource).toContain('pageNo: 1');
    expect(formSource).toContain('pageSize: 10');
    expect(formSource).toContain('v-if="canEditFromDetail"');
  });

  it('locks before initialization and rejects stale responses', () => {
    const openChangeIndex = formSource.indexOf(
      'async onOpenChange(isOpen: boolean)',
    );
    const openIndex = formSource.indexOf(
      'const requestId = ++openRequestId;',
      openChangeIndex,
    );
    const lockIndex = formSource.indexOf('modalApi.lock();', openIndex);
    const hiddenFieldsIndex = formSource.indexOf(
      'await loadHiddenFields();',
      openIndex,
    );
    const detailIndex = formSource.indexOf(
      'const detail = await getPayableExpense(',
      openIndex,
    );
    expect(openIndex).toBeGreaterThan(-1);
    expect(lockIndex).toBeGreaterThan(openIndex);
    expect(hiddenFieldsIndex).toBeGreaterThan(lockIndex);
    expect(detailIndex).toBeGreaterThan(hiddenFieldsIndex);
    expect(formSource).toContain('requestId !== openRequestId');
    expect(apiSource).toContain('/erp/payable-expense/item-page');
  });

  it('shows draft search, text hint, legend and row colors', () => {
    expect(dataSource).toContain("{ label: '草稿', value: 0 }");
    expect(dataSource).toContain("slots: { default: 'status' }");
    expect(listSource).toContain('return Number(row.status) === 0;');
    expect(listSource).toContain("'payable-expense-draft-row'");
    expect(listSource).toContain(
      'rowClassName: ({ row }: { row: ErpPayableExpenseApi.PayableExpense }) =>',
    );
    expect(listSource).toContain('草稿：页面关闭时自动保存，尚未正式提交');
    expect(listSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(listSource).toContain(
      '.payable-expense-grid .payable-expense-draft-row.row--hover',
    );
    expect(listSource).toContain(
      '.payable-expense-grid .payable-expense-draft-row .vxe-body--column',
    );
    expect(listSource).toContain(
      'background-color: hsl(var(--primary) / 7%) !important',
    );
  });

  it('keeps batch edit formal-only while allowing draft edit and deletion', () => {
    expect(listSource).toContain('.filter((row) => isPendingRow(row))');
    expect(listSource).toContain(
      'ifShow: () => checkedRows.some(isPendingRow)',
    );
    expect(listSource).toContain(
      'ifShow: () => isDraftRow(row) || isPendingRow(row)',
    );
    expect(listSource).toContain("label: isDraftRow(row) ? '编辑草稿'");
  });
});
