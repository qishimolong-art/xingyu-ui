import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(
  join(
    currentDir,
    '../../../../../api/erp/finance/receivable/other-receivable/index.ts',
  ),
  'utf8',
);
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');

function getTemplateSlot(source: string, name: string) {
  const start = source.indexOf(`<template #${name}>`);
  if (start === -1) return '';
  const end = source.indexOf('</template>', start);
  return source.slice(start, end);
}

const prependFooterSource = getTemplateSlot(formSource, 'prepend-footer');

describe('other receivable draft lifecycle contract', () => {
  it('uses dedicated draft persistence and submission endpoints', () => {
    expect(apiSource).toContain('/erp/receivable-other/create-draft');
    expect(apiSource).toContain('/erp/receivable-other/create-and-submit');
    expect(apiSource).toContain('/erp/receivable-other/update-draft');
    expect(apiSource).toContain('/erp/receivable-other/update-and-submit');
    expect(apiSource).toContain('/erp/receivable-other/submit');
    expect(apiSource).toContain(
      '/erp/receivable-other/customer-dept-simple-list',
    );
    expect(apiSource).toContain(
      '/erp/receivable-other/customer-dept-simple-page',
    );
  });

  it('skips draft saving on cancel and submits an edited draft formally', () => {
    expect(formSource).toContain('async onBeforeClose()');
    expect(formSource).toContain('return saveCurrentDraft();');
    expect(formSource).toContain('async onCancel()');
    expect(formSource).toContain('skipDraftOnClose = true');
    expect(formSource).toContain("message.warning('请选择客户后再保存草稿')");
    expect(formSource).toContain('createOtherReceivableDraft(payload)');
    expect(formSource).toContain('updateOtherReceivableDraft(payload)');
    expect(formSource).toContain('updateAndSubmitOtherReceivable(values)');
    expect(formSource).toContain("? '确认提交'");
  });

  it('requires a customer before persisting a draft from button or escape close', () => {
    const draftHandler = formSource.slice(
      formSource.indexOf('async function saveCurrentDraft'),
      formSource.indexOf('async function handleGenerateDraft'),
    );
    const customerGuardIndex = draftHandler.indexOf('if (!payload.customerId)');
    const createDraftIndex = draftHandler.indexOf(
      'createOtherReceivableDraft(payload)',
    );
    expect(customerGuardIndex).toBeGreaterThan(-1);
    expect(createDraftIndex).toBeGreaterThan(customerGuardIndex);
    expect(draftHandler).toContain("message.warning('请选择客户后再保存草稿')");
    expect(draftHandler).toContain('return false;');
    expect(formSource).toContain('async function handleEscapeClose()');
    expect(formSource).toContain(
      '@keydown.esc.stop.prevent="handleEscapeClose"',
    );
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
    expect(formSource).toContain('<Button v-if="canGenerateDraft"');
    expect(formSource).toContain('@click="handleGenerateDraft"');
    expect(formSource).toContain('{{ generateDraftButtonText }}');
    expect(prependFooterSource).not.toContain('handleGenerateDraft');
    expect(prependFooterSource).not.toContain('canGenerateDraft');
    expect(formSource).toContain('skipDraftOnClose = true');
  });

  it('offers direct submission only in hydrated permitted draft detail mode', () => {
    expect(formSource).toContain('const canSubmitDraftFromDetail = computed');
    expect(formSource).toContain('formData.value?.status === 0');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:receivable-other:update-status'])",
    );
    expect(formSource).toContain('await submitOtherReceivable(id)');
    expect(formSource).toContain('v-if="canSubmitDraftFromDetail"');
    expect(formSource).toContain('提交后将进入待审核状态');
  });

  it('requires non-zero receivable amount for formal submission while allowing negative adjustments', () => {
    expect(dataSource).toContain("fieldName: 'receivableAmount'");
    expect(dataSource).toContain('nonZero: true');
    expect(dataSource).toContain('required: true');
  });

  it('loads department options from selected customer and clears invalid departments', () => {
    expect(dataSource).toContain('getOtherReceivableCustomerDeptTree');
    expect(dataSource).toContain("component: 'ApiTreeSelect'");
    expect(dataSource).toContain('shouldFetch');
    expect(dataSource).toContain('Boolean(params?.customerId)');
    expect(formSource).toContain('refreshCustomerDeptOptions');
    expect(formSource).toContain(
      "getFieldComponentRef<OtherReceivableDeptFieldRef>('deptId')",
    );
    expect(formSource).toContain(
      'updateParam?.(customerId ? { customerId } : {})',
    );
    expect(formSource).toContain('当前部门不在该客户可用部门范围内，已清空');
  });

  it('offers detail edit only for draft or pending rows with update permission', () => {
    expect(formSource).toContain('const canEditFromDetail = computed');
    expect(formSource).toContain(
      '[0, 10].includes(Number(formData.value?.status))',
    );
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:receivable-other:update'])",
    );
    expect(formSource).toContain('async function handleEditFromDetail()');
    expect(formSource).toContain('const detail = await getOtherReceivable(id)');
    expect(formSource).toContain("await applyFormMode('edit', nextFormData)");
    expect(formSource).toContain('v-if="canEditFromDetail"');
  });

  it('locks before detail hydration and ignores stale responses', () => {
    const openChangeIndex = formSource.indexOf(
      'async onOpenChange(isOpen: boolean)',
    );
    const lockIndex = formSource.indexOf(
      'if (data?.id) modalApi.lock()',
      openChangeIndex,
    );
    const detailRequestIndex = formSource.indexOf(
      'const detail = await getOtherReceivable(data.id)',
      openChangeIndex,
    );
    expect(lockIndex).toBeGreaterThan(-1);
    expect(detailRequestIndex).toBeGreaterThan(lockIndex);
    expect(formSource).toContain('requestId !== openRequestId');
  });

  it('shows draft filter, text hint, legend and theme-compatible row colors', () => {
    expect(dataSource).toContain(
      String.raw`{ label: '\u8349\u7A3F', value: 0 }`,
    );
    expect(dataSource).toContain("slots: { default: 'status' }");
    expect(listSource).toContain('return Number(row.status) === 0;');
    expect(listSource).toContain("'other-receivable-draft-row'");
    expect(listSource).toContain('},\n    rowClassName: ({');
    expect(listSource).toContain('草稿：页面关闭时自动保存，尚未正式提交');
    expect(listSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(listSource).toContain(
      '.other-receivable-grid .other-receivable-draft-row.row--hover',
    );
    expect(listSource).toContain(
      '.other-receivable-grid .other-receivable-draft-row .vxe-body--column',
    );
    expect(listSource).toContain(
      'background-color: hsl(var(--primary) / 7%) !important',
    );
  });
});
