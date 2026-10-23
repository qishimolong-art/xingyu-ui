import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, 'index.vue'), 'utf8');

describe('business report M6 other settlement report pages', () => {
  it('renders six independent other receivable and payable report pages', () => {
    for (const title of [
      '其他应收报表',
      '其他应付报表',
      '其他往来余额汇总',
      '其他往来账龄分析',
      '其他往来核销明细',
      '历史其他往来口径',
    ]) {
      expect(source).toContain(title);
    }
    expect(source).toContain("| 'other-receivable'");
    expect(source).toContain("| 'other-payable'");
    expect(source).toContain("| 'balance-summary'");
    expect(source).toContain("| 'aging-analysis'");
    expect(source).toContain("| 'writeoff-detail'");
  });

  it('keeps customer-facing report interactions visible and defaults lists to ten rows', () => {
    expect(source).toContain('const DEFAULT_PAGE_SIZE = 10');
    expect(source).toContain(":page-size-options=\"['10', '20', '50']\"");
    expect(source).toContain('业务时间');
    expect(source).toContain('往来对象');
    expect(source).toContain('状态');
    expect(source).toContain('关键词');
    expect(source).toContain('查询');
    expect(source).toContain('重置');
    expect(source).toContain('导出');
    expect(source).toContain(':scroll="{ x: tableScrollX, y: 420 }"');
  });

  it('does not expose internal implementation notes on the customer page', () => {
    for (const phrase of [
      '第一阶段',
      '只读复用',
      '依赖 SQL',
      '未完成原因',
      '后续接入',
      '待客户确认',
      '双成本开关',
      '库存游标',
      '不提供新增',
      '待数据接入',
    ]) {
      expect(source).not.toContain(phrase);
    }
    expect(source).toContain('待规则确认');
  });

  it('uses business report menu access with old other settlement permissions as fallback', () => {
    expect(source).toContain('/erp/business-report/other-settlement');
    expect(source).toContain('canCurrentMenu.value ||');
    expect(source).toContain('erp:receivable-misc:query');
    expect(source).toContain('erp:receivable-other:query');
    expect(source).toContain('erp:payable-misc:query');
    expect(source).toContain('erp:payable-other:query');
  });

  it('wraps existing other receivable and payable APIs without changing old pages', () => {
    expect(source).toContain('getReceivableMiscPage');
    expect(source).toContain('getPayableMiscPage');
    expect(source).toContain('exportReceivableMisc');
    expect(source).toContain('exportPayableMisc');
    expect(source).toContain('toReceivableRow');
    expect(source).toContain('toPayableRow');
    expect(source).toContain('其他应收');
    expect(source).toContain('其他应付');
  });
});
