import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/finance/payable/other/index.ts'),
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

describe('other payable draft lifecycle contract', () => {
  it('uses dedicated draft persistence and submission endpoints', () => {
    expect(apiSource).toContain('/erp/payable-other/create-draft');
    expect(apiSource).toContain('/erp/payable-other/create-and-submit');
    expect(apiSource).toContain('/erp/payable-other/update-draft');
    expect(apiSource).toContain('/erp/payable-other/update-and-submit');
    expect(apiSource).toContain('/erp/payable-other/submit');
    expect(apiSource).toContain('/erp/payable-other/supplier-dept-simple-list');
    expect(apiSource).toContain('/erp/payable-other/supplier-dept-simple-page');
  });

  it('skips draft saving on cancel and submits an edited draft formally', () => {
    expect(formSource).toContain('async onBeforeClose()');
    expect(formSource).toContain('return saveCurrentDraft();');
    expect(formSource).toContain('async onCancel()');
    expect(formSource).toContain('skipDraftOnClose = true');
    expect(formSource).toContain('createPayableOtherDraft(payload)');
    expect(formSource).toContain('updatePayableOtherDraft(payload)');
    expect(formSource).toContain('updateAndSubmitPayableOther(values)');
    expect(formSource).toContain("? '确认提交'");
  });

  it('requires supplier before creating or updating a draft', () => {
    const draftHandler = formSource.slice(
      formSource.indexOf('async function saveCurrentDraft'),
      formSource.indexOf(
        'async function handleGenerateDraft',
        formSource.indexOf('async function saveCurrentDraft'),
      ),
    );
    const supplierGuardIndex = draftHandler.indexOf('!payload.supplierId');
    const createDraftIndex = draftHandler.indexOf(
      'createPayableOtherDraft(payload)',
    );
    const updateDraftIndex = draftHandler.indexOf(
      'updatePayableOtherDraft(payload)',
    );
    expect(supplierGuardIndex).toBeGreaterThan(-1);
    expect(createDraftIndex).toBeGreaterThan(supplierGuardIndex);
    expect(updateDraftIndex).toBeGreaterThan(supplierGuardIndex);
    expect(draftHandler).toContain(
      "message.warning('请选择供应商后再保存草稿')",
    );
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
    expect(formSource).toContain('skipDraftOnClose = true');
  });

  it('routes Esc through the same draft-save close path', () => {
    expect(formSource).toContain('async function handleEscapeClose()');
    expect(formSource).toContain('await modalApi.close();');
    expect(formSource).toContain(
      '@keydown.esc.stop.prevent="handleEscapeClose"',
    );
  });

  it('matches create and draft-edit confirm visibility to backend permissions', () => {
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:payable-other:create']) &&",
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:payable-other:update']) &&",
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:payable-other:update-status'])",
    );
  });

  it('offers direct submission only in hydrated permitted draft detail mode', () => {
    expect(formSource).toContain('const canSubmitDraftFromDetail = computed');
    expect(formSource).toContain('formData.value?.status === 0');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:payable-other:update-status'])",
    );
    expect(formSource).toContain('await submitPayableOther(id)');
    expect(formSource).toContain('v-if="canSubmitDraftFromDetail"');
    expect(formSource).toContain('提交后将进入待审核状态');
  });

  it('offers detail edit only for draft or pending rows with update permission', () => {
    expect(formSource).toContain('const canEditFromDetail = computed');
    expect(formSource).toContain(
      '[0, 10].includes(Number(formData.value?.status))',
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:payable-other:update'])",
    );
    expect(formSource).toContain('async function handleEditFromDetail()');
    expect(formSource).toContain('const detail = await getPayableOther(id)');
    expect(formSource).toContain("await applyFormMode('edit', nextFormData)");
    expect(formSource).toContain('v-if="canEditFromDetail"');
  });

  it('locks source type and loads department options from selected supplier', () => {
    expect(dataSource).toContain("fieldName: 'sourceType'");
    expect(dataSource).toContain('disabled: true');
    expect(dataSource).toContain('getPayableOtherSupplierDeptTree');
    expect(dataSource).toContain("component: 'ApiTreeSelect'");
    expect(dataSource).toContain('shouldFetch');
    expect(dataSource).toContain('Boolean(params?.supplierId)');
    expect(formSource).toContain('refreshSupplierDeptOptions');
    expect(formSource).toContain(
      "getFieldComponentRef<OtherPayableDeptFieldRef>('deptId')",
    );
    expect(formSource).toContain(
      'updateParam?.(supplierId ? { supplierId } : {})',
    );
    expect(formSource).toContain('当前部门不在该供应商可用部门范围内，已清空');
  });

  it('locks before asynchronous initialization and ignores stale responses', () => {
    const openChangeIndex = formSource.indexOf(
      'async onOpenChange(isOpen: boolean)',
    );
    const lockIndex = formSource.indexOf('modalApi.lock()', openChangeIndex);
    const hiddenFieldsIndex = formSource.indexOf(
      'await loadHiddenFields()',
      openChangeIndex,
    );
    const detailRequestIndex = formSource.indexOf(
      'const detail = await getPayableOther(data.id)',
      openChangeIndex,
    );
    expect(lockIndex).toBeGreaterThan(-1);
    expect(hiddenFieldsIndex).toBeGreaterThan(lockIndex);
    expect(detailRequestIndex).toBeGreaterThan(hiddenFieldsIndex);
    expect(formSource).toContain('requestId !== openRequestId');
  });

  it('shows draft filtering, text hints, legend and accessible row colors', () => {
    expect(dataSource).toContain(
      String.raw`{ label: '\u8349\u7A3F', value: 0 }`,
    );
    expect(dataSource).toContain("slots: { default: 'status' }");
    expect(listSource).toContain('return Number(row.status) === 0;');
    expect(listSource).toContain("'other-payable-draft-row'");
    expect(listSource.replaceAll('\r\n', '\n')).toContain(
      '},\n    rowClassName: ({',
    );
    expect(listSource).toContain('草稿：页面关闭时自动保存，尚未正式提交');
    expect(listSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(listSource).toContain(
      '.other-payable-grid .other-payable-draft-row.row--hover',
    );
    expect(listSource).toContain(
      '.other-payable-grid .other-payable-draft-row .vxe-body--column',
    );
    expect(listSource).toContain(
      'background-color: hsl(var(--primary) / 7%) !important',
    );
  });

  it('keeps batch edit formal-only while allowing draft edit and deletion', () => {
    expect(listSource).toContain('.filter((item) => isPendingRow(item))');
    expect(listSource).toContain(
      'ifShow: () => isDraftRow(row) || isPendingRow(row)',
    );
    expect(listSource).toContain("label: isDraftRow(row) ? '编辑草稿'");
  });
});
