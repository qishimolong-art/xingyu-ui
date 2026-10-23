import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');

describe('fixed asset business report page shell', () => {
  it('renders independent fixed asset pages with clean customer-facing labels', () => {
    expect(indexSource).toContain("'asset-card'");
    expect(indexSource).toContain("'depreciation-detail'");
    expect(indexSource).toContain("'department-summary'");
    expect(indexSource).toContain("'transfer-record'");
    expect(indexSource).toContain("'disposal-record'");
    expect(indexSource).toContain('历史固定资产口径');
    expect(indexSource).toContain('经营报表 · 固定资产及折旧');
    expect(indexSource).toContain('固定资产卡片台账');
    expect(indexSource).toContain('固定资产折旧明细');
    expect(indexSource).toContain('部门资产汇总');
    expect(indexSource).toContain('资产变更记录');
    expect(indexSource).toContain('资产处置记录');
  });

  it('keeps the customer page free of development notes', () => {
    for (const forbidden of [
      '第一阶段',
      '只读复用',
      '依赖 SQL',
      '未完成原因',
      '后续接入',
      '待客户确认',
      '双成本开关',
      '库存游标',
      '实施准备看板',
      '当前系统尚未提供',
    ]) {
      expect(indexSource).not.toContain(forbidden);
    }
  });

  it('shows query, export position, table scroll, empty state, and ten-row pagination', () => {
    expect(indexSource).toContain('RangePicker');
    expect(indexSource).toContain('查询');
    expect(indexSource).toContain('重置');
    expect(indexSource).toContain('导出');
    expect(indexSource).toContain('BusinessReportEmptyState');
    expect(indexSource).toContain('downloadFileFromBlobPart');
    expect(indexSource).toContain('handleExport');
    expect(indexSource).toContain('buildEmptyCsvBlob');
    expect(indexSource).not.toContain('<Button disabled>导出</Button>');
    expect(indexSource).toContain('const DEFAULT_PAGE_SIZE = 10');
    expect(indexSource).toContain(':scroll="{ x: tableScrollX, y: 360 }"');
    expect(indexSource).toContain(":page-size-options=\"['10', '20', '50']\"");
  });

  it('does not output hardcoded depreciation formulas as formal results', () => {
    expect(indexSource).toContain('待规则确认');
    expect(indexSource).toContain('折旧规则确认后显示');
    expect(indexSource).not.toContain('按0成本');
    expect(indexSource).not.toContain('0成本');
  });
});
