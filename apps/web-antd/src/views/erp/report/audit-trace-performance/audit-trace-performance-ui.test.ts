import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const operateLogSource = readFileSync(
  join(currentDir, 'modules', 'operate-log-readonly-table.vue'),
  'utf8',
);
const importExportSource = readFileSync(
  join(currentDir, 'modules', 'import-export-audit-readonly-table.vue'),
  'utf8',
);
const ocrSource = readFileSync(
  join(currentDir, 'modules', 'purchase-invoice-ocr-readonly-table.vue'),
  'utf8',
);

const pageNames = [
  '原单与反向业务追踪',
  '业务链路追踪',
  '未闭环业务清单',
  '异常规则与待办',
  '操作日志审计',
  '岗位绩效评分',
  '历史异常审计口径',
];

const pageKeys = [
  'reverse-trace',
  'business-chain',
  'open-loop',
  'exception-todo',
  'operation-audit',
  'performance-score',
  'history',
];

describe('audit trace performance business report pages', () => {
  it('renders M12 as independent customer-facing report pages', () => {
    expect(indexSource).toContain(
      "defineOptions({ name: 'ErpBusinessReportAuditTracePerformance' })",
    );
    expect(indexSource).toContain('normalizePageKey(route.path)');
    expect(indexSource).toContain('经营报表 · 异常审计及绩效');
    expect(indexSource).toContain('BusinessReportShell');
    expect(indexSource).toContain('BusinessReportEmptyState');
    expect(indexSource).toContain('body-scrollable');
    for (const name of pageNames) expect(indexSource).toContain(name);
    for (const key of pageKeys) expect(indexSource).toContain(key);
  });

  it('keeps filters, metrics, table, pagination, and export visible for every page shell', () => {
    expect(indexSource).toContain('DEFAULT_PAGE_SIZE = 10');
    expect(indexSource).toContain('RangePicker');
    expect(indexSource).toContain('业务对象');
    expect(indexSource).toContain('关键词');
    expect(indexSource).toContain('查询');
    expect(indexSource).toContain('重置');
    expect(indexSource).toContain('导出');
    expect(indexSource).toContain('downloadFileFromBlobPart');
    expect(indexSource).toContain('buildEmptyCsvBlob');
    expect(indexSource).toContain(':scroll="{ x: tableScrollX, y: 360 }"');
    expect(indexSource).toContain(":page-size-options=\"['10', '20', '50']\"");
  });

  it('connects stage2 pages to reusable real data sources', () => {
    expect(indexSource).toContain('StockRecordTab');
    expect(indexSource).toContain('PurchaseInvoiceOcrAuditTable');
    expect(indexSource).toContain('OperateLogAuditTable');
    expect(indexSource).toContain('ImportExportAuditTable');
    expect(indexSource).toContain('connectedPageKeys');
    expect(indexSource).toContain('业务链路库存节点明细');
    expect(indexSource).toContain('异常来源批次');
    expect(indexSource).toContain('系统操作日志审计');
    expect(operateLogSource).toContain('getOperateLogPage');
    expect(operateLogSource).toContain('exportOperateLog');
    expect(importExportSource).toContain('getImportExportRecordPage');
    expect(importExportSource).toContain('handleExport');
    expect(ocrSource).toContain('getPurchaseInvoiceOcrBatchPage');
    expect(ocrSource).toContain('handleExport');
  });

  it('does not expose implementation notes on the customer page', () => {
    const forbidden = [
      '第一阶段',
      '只读复用',
      '依赖 SQL',
      '未完成原因',
      '后续接入',
      '待客户确认',
      '双成本开关',
      '库存游标',
      '不提供新增',
    ];
    const customerSources = [
      indexSource,
      operateLogSource,
      importExportSource,
      ocrSource,
    ];
    for (const source of customerSources) {
      for (const text of forbidden) expect(source).not.toContain(text);
      expect(source).not.toContain('<TabPane');
      expect(source).not.toContain('<Tabs');
    }
  });
});
