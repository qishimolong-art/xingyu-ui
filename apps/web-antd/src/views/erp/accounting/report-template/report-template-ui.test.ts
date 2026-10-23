import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const accountingDir = dirname(currentDir);
const balanceSheetSource = readFileSync(
  join(accountingDir, 'balance-sheet', 'index.vue'),
  'utf8',
);
const incomeStatementSource = readFileSync(
  join(accountingDir, 'income-statement', 'index.vue'),
  'utf8',
);
const cashFlowSource = readFileSync(
  join(accountingDir, 'cash-flow', 'index.vue'),
  'utf8',
);

describe('accounting report template UI contract', () => {
  it('states that templates are not formal financial reports before formulas are confirmed', () => {
    expect(indexSource).toContain('报表项目模板只维护三大报表结构和取数公式');
    expect(indexSource).toContain('公式版本、会计期间、结账及受控反结账');
    expect(indexSource).toContain('科目余额、试算平衡、明细账及逐级下钻');
    expect(indexSource).toContain('不能作为正式财务报表输出');
  });

  it('keeps the three financial statement skeleton pages from being treated as formal reports', () => {
    expect(balanceSheetSource).toContain('从凭证和科目余额取数');
    expect(balanceSheetSource).toContain(
      '试算平衡、明细账和部门科目明细账一致',
    );
    expect(balanceSheetSource).toContain("customRender: () => '不可用'");
    expect(balanceSheetSource).not.toContain('金额列默认为 0.00');
    expect(incomeStatementSource).toContain(
      '退货红冲、总部代付、内部抵销和期间锁定',
    );
    expect(incomeStatementSource).toContain("customRender: () => '不可用'");
    expect(incomeStatementSource).not.toContain('金额列默认为 0.00');
    expect(cashFlowSource).toContain('现金流项目归集、凭证取数和逐级下钻');
    expect(cashFlowSource).toContain(
      '未确认公式和现金流项目时禁止作为正式报表',
    );
    expect(cashFlowSource).toContain("customRender: () => '不可用'");
    expect(cashFlowSource).not.toContain('金额列默认为 0.00');
  });
});
