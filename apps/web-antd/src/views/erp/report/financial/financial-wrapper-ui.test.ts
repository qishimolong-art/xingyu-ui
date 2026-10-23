import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const readinessSource = readFileSync(
  join(currentDir, 'modules', 'financial-statement-readiness.vue'),
  'utf8',
);

function readWrapper(path: string) {
  return readFileSync(join(currentDir, path, 'index.vue'), 'utf8');
}

const wrappers = [
  {
    path: 'report-template',
    title: '经营报表 · 财务报表模板',
    component: '<ReportTemplate />',
    boundary: '公式版本、会计期间、凭证取数和现金流项目未完成确认前',
  },
  {
    path: 'balance-sheet',
    title: '经营报表 · 资产负债表',
    component: '<BalanceSheet />',
    boundary: '公式、凭证取数、科目余额、会计期间和结账流程未确认前',
  },
  {
    path: 'income-statement',
    title: '经营报表 · 利润表',
    component: '<IncomeStatement />',
    boundary: '收入、成本、费用、内部抵销和凭证取数公式未确认前',
  },
  {
    path: 'cash-flow',
    title: '经营报表 · 现金流量表',
    component: '<CashFlow />',
    boundary: '现金流项目、凭证取数、会计期间和公式未确认前',
  },
];

describe('financial business report wrappers', () => {
  it('wraps every accounting page with the shared business report shell', () => {
    for (const item of wrappers) {
      const source = readWrapper(item.path);
      expect(source).toContain('BusinessReportShell');
      expect(source).toContain('FinancialStatementReadiness');
      expect(source).toContain(`title="${item.title}"`);
      expect(source).toContain(':notices="notices"');
      expect(source).toContain(item.component);
      expect(source).not.toContain('<Page auto-content-height>');
    }
  });

  it('states formula, voucher, period, and cash-flow boundaries before official output', () => {
    for (const item of wrappers) {
      const source = readWrapper(item.path);
      expect(source).toContain(item.boundary);
      expect(source).toMatch(/不能作为正式|不能等同于正式/);
    }
    expect(readWrapper('balance-sheet')).toContain('金额列保持不可用');
    expect(readWrapper('income-statement')).toContain('金额列保持不可用');
    expect(readWrapper('cash-flow')).toContain('金额列保持不可用');
  });

  it('shows readiness conditions for official financial statement output', () => {
    expect(readinessSource).toContain('正式输出前置条件');
    expect(readinessSource).toContain('待规则确认');
    expect(readinessSource).toContain('financial-statement-readiness__grid');

    const balanceSource = readWrapper('balance-sheet');
    expect(balanceSource).toContain('科目余额');
    expect(balanceSource).toContain('试算平衡');
    expect(balanceSource).toContain('公式未确认时禁止作为正式报表输出');

    const incomeSource = readWrapper('income-statement');
    expect(incomeSource).toContain('收入、成本和退货红冲需与凭证');
    expect(incomeSource).toContain(
      '内部收入成本抵销、未实现利润抵销和已实现利润调整',
    );
    expect(incomeSource).toContain('会计期间、结账和反结账规则确认后');

    const cashFlowSource = readWrapper('cash-flow');
    expect(cashFlowSource).toContain('现金流项目');
    expect(cashFlowSource).toContain('转账本金不能计入经营收支');
    expect(cashFlowSource).toContain(
      '现金类科目、实际账户科目和自动凭证来源需核对一致',
    );
  });

  it('keeps a full-height wrapper around the nested accounting Page', () => {
    for (const item of wrappers) {
      const source = readWrapper(item.path);
      expect(source).toContain('class="financial-wrapper-page"');
      expect(source).toMatch(
        /\.financial-wrapper-page\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
      );
      expect(source).toContain(':deep(.page)');
      expect(source).toContain(':deep(.vben-page)');
    }
  });
});
