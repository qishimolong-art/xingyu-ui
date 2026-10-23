import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const componentPath = join(
  process.cwd(),
  'apps/web-antd/src/views/erp/report/components/business-report-preview-template.vue',
);
const overviewPath = join(
  process.cwd(),
  'apps/web-antd/src/views/erp/report/components/business-report-status-board.vue',
);

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('business report shared preview template', () => {
  it('provides the common report page structure for customer preview pages', () => {
    const source = read(componentPath);

    expect(source).toContain('统一报表页面模板');
    expect(source).toContain('统一筛选区');
    expect(source).toContain('销售净额');
    expect(source).toContain('经营趋势');
    expect(source).toContain('结构排行');
    expect(source).toContain('待确认公式与规则');
    expect(source).toContain('本页合计：按当前分页展示');
    expect(source).toContain('全部合计：接入聚合接口后展示');
    expect(source).toContain('下钻：保留业务类型、单据 ID、明细 ID 和来源关系');
    expect(source).toContain('导出');
    expect(source).toContain('BusinessReportEmptyState');
    expect(source).toContain('暂无报表明细');
  });

  it('keeps uncertain formulas marked as pending instead of official values', () => {
    const source = read(componentPath);

    expect(source).toContain('毛利率');
    expect(source).toContain('公式确认后启用');
    expect(source).toContain('待确认');
    expect(source).toContain('评分规则需配置版本确认后启用');
    expect(source).toContain('销售价暂按含税');
    expect(source).not.toContain('毛利率 =');
    expect(source).not.toContain('评分 =');
  });

  it('is rendered by the business report overview so the first module has a visible page sample', () => {
    const source = read(overviewPath);

    expect(source).toContain('BusinessReportPreviewTemplate');
    expect(source).toContain('<BusinessReportPreviewTemplate />');
  });
});
