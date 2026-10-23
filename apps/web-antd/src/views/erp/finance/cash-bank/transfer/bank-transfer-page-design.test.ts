import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormSchema, useGridColumns } from './data';
import { formatBankTransferAmount, getBankTransferPageSummary } from './ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);

describe('bank transfer page design contract', () => {
  it('summarizes the current page with stable financial formatting', () => {
    expect(
      getBankTransferPageSummary([
        { status: 0, transferPrice: undefined } as any,
        { status: 10, transferPrice: 1250 } as any,
        { status: 20, transferPrice: 750.5 } as any,
        { status: 20, transferPrice: Number.NaN } as any,
      ]),
    ).toEqual({
      approvedCount: 2,
      documentCount: 4,
      draftCount: 1,
      pendingCount: 1,
      transferAmount: 2000.5,
    });
    expect(formatBankTransferAmount(1_234_567.8)).toBe('1,234,567.80');
  });

  it('keeps the requested field order while refining scan density', () => {
    const columns = useGridColumns() || [];
    expect(columns.map((column) => column.field || column.type)).toEqual([
      'checkbox',
      'printAction',
      'deleteAction',
      'no',
      'transferTime',
      'transferPrice',
      'outAccountName',
      'inAccountName',
      'status',
      'financeUserName',
      'auditorName',
      'auditTime',
      'voucherNo',
      'remark',
      undefined,
    ]);
    expect(columns.slice(1, -1).map((column) => column.title)).toEqual([
      '打印',
      '删除',
      '单号',
      '日期',
      '金额',
      '转出账户',
      '转入账户',
      '状态',
      '经手人',
      '审核人',
      '审核日期',
      '凭证号',
      '备注',
    ]);
    expect(columns[0]?.fixed).toBeUndefined();
    expect(columns[1]?.fixed).toBeUndefined();
    expect(columns.at(-1)?.fixed).toBe('right');
    expect(
      columns.find((column) => column.field === 'printAction')?.slots,
    ).toEqual({ default: 'printAction' });
    expect(
      columns.find((column) => column.field === 'deleteAction')?.slots,
    ).toEqual({ default: 'deleteAction' });
    expect(columns.find((column) => column.field === 'no')?.slots).toEqual({
      default: 'bankTransferNo',
    });
  });

  it('right-aligns and emphasizes transfer amounts', () => {
    const amountColumn = useGridColumns()?.find(
      (column) => column.field === 'transferPrice',
    );
    expect(amountColumn?.align).toBe('right');
    expect(amountColumn?.headerAlign).toBe('right');
    expect(amountColumn?.className).toContain(
      'bank-transfer-amount-cell--primary',
    );
  });

  it('uses a compact sortable list with subtotal and sticky page summary', () => {
    expect(indexSource).toContain('font-size: 12px');
    expect(indexSource).toContain('<FinanceListQuerySummary');
    expect(indexSource).toContain(':items="querySummaryItems"');
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
    expect(indexSource).toContain('handleSearchEnter');
    expect(indexSource).toContain('bank-transfer-grid__document-link');
    expect(indexSource).toContain('class="bank-transfer-summary"');
    expect(indexSource).toContain('转账金额');
    expect(indexSource).toContain('.vxe-grid--bottom-wrapper');
    expect(indexSource).toContain('.vxe-grid--pager-wrapper');
    expect(indexSource).toContain("outAccountName: 'outAccountId'");
    expect(indexSource).toContain("inAccountName: 'inAccountId'");
    expect(indexSource).toContain("auditorName: 'updater'");
    expect(indexSource).toContain("auditTime: 'updateTime'");
    expect(indexSource).toContain('银行转账本金只作为账户间资金流转展示');
    expect(indexSource).toContain('转账在途资金属于后续账户资金正式改造');
    expect(indexSource).toContain('手续费需要独立记录并归实际承担部门');
  });

  it('keeps batch and row actions permission- and status-aware', () => {
    expect(indexSource).toContain('ifShow: () => checkedRows.length > 0');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toContain('message.success(`已删除 ');
    expect(indexSource).toContain('条，已跳过 ');
    expect(indexSource).toContain('skippedCount} 条`');
    for (const permission of [
      'erp:finance-transfer:create',
      'erp:finance-transfer:delete',
      'erp:finance-transfer:export',
      'erp:finance-transfer:import',
      'erp:finance-transfer:print',
      'erp:finance-transfer:print-template',
      'erp:finance-transfer:update',
      'erp:finance-transfer:update-status',
    ]) {
      expect(indexSource).toContain(permission);
    }
    expect(indexSource).toContain(
      "const PRINT_TEMPLATE_MODULE = 'finance_transfer'",
    );
    expect(indexSource).toContain('useErpPrintTemplate');
    expect(indexSource).toContain('PrintTemplateSelector');
    expect(indexSource).toContain('ifShow: () => row.status === 10');
    expect(indexSource).not.toContain('const rowActionColumnFields');
    expect(indexSource).not.toMatch(/cellClick:\s*\(/);
    expect(indexSource).toContain('@click.stop="handleDetail(row)"');
    expect(indexSource).toContain('onClick: handlePrint.bind(null, row)');
    expect(indexSource).toContain(
      'confirm: handleDelete.bind(null, [row.id!])',
    );
    expect(formSource).toContain('hasAccessByCodes');
  });

  it('uses the same fullscreen four-column structure in every form mode', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      "wrapperClass: 'bank-transfer-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain('基本信息');
    expect(formSource).toContain('审计信息');
    expect(formSource).toContain(
      "'bank-transfer-form__base-form--editable': !isDetail",
    );
    expect(formSource).toContain('bank-transfer-form-select-dropdown');
  });

  it('provides loading, failure, stale-request, and mounted-form exits', () => {
    expect(formSource).toContain('detailLoading');
    expect(formSource).toContain('detailLoadError');
    expect(formSource).toContain('银行转账详情加载中...');
    expect(formSource).toContain('银行转账详情加载失败，请关闭后重试');
    expect(formSource).toContain('requestId !== openRequestId');
    expect(formSource).toContain('detailLoading.value = false');
    expect(formSource).toContain('modalApi.unlock()');
    expect(formSource).toContain('v-show="!detailLoading && !detailLoadError"');
  });

  it('lets long fields span the complete four-column form width', () => {
    const schema = useFormSchema('create');
    for (const field of ['fileUrl', 'remark']) {
      expect(
        schema.find((item) => item.fieldName === field)?.formItemClass,
      ).toBe('col-span-4');
    }
  });
});
