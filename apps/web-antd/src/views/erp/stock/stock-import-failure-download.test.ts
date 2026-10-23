import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readStockFile(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

function readStockApiFile(path: string) {
  return readFileSync(join(currentDir, '../../../api/erp/stock', path), 'utf8');
}

const importFormCases = [
  {
    source: readStockFile('in/modules/import-form.vue'),
    functionName: 'downloadStockInImportFailureDetails',
    fileName: '其它入库错误数据.xls',
  },
  {
    source: readStockFile('out/modules/import-form.vue'),
    functionName: 'downloadStockOutImportFailureDetails',
    fileName: '其它出库错误数据.xls',
  },
  {
    source: readStockFile('check/modules/import-form.vue'),
    functionName: 'downloadStockCheckImportFailureDetails',
    fileName: '库存盘点错误数据.xls',
  },
  {
    source: readStockFile('transfer-out/modules/import-form.vue'),
    functionName: 'downloadStockTransferOutImportFailureDetails',
    fileName: '调拨出库错误数据.xls',
  },
  {
    source: readStockFile('warehouse-move/modules/import-form.vue'),
    functionName: 'downloadWarehouseMoveImportFailureDetails',
    fileName: '仓库移货错误数据.xls',
  },
  {
    source: readStockFile('warehouse/modules/import-form.vue'),
    functionName: 'downloadWarehouseImportFailureDetails',
    fileName: '仓库错误数据.xls',
  },
];

describe('stock import failure download contract', () => {
  it('exposes scoped failure download APIs for visible stock imports', () => {
    const cases = [
      {
        source: readStockApiFile('in/index.ts'),
        typeName: 'StockImportResult',
        functionName: 'downloadStockInImportFailureDetails',
        endpoint: '/erp/stock-in/import-failure-details/download',
      },
      {
        source: readStockApiFile('out/index.ts'),
        typeName: 'StockImportResult',
        functionName: 'downloadStockOutImportFailureDetails',
        endpoint: '/erp/stock-out/import-failure-details/download',
      },
      {
        source: readStockApiFile('check/index.ts'),
        typeName: 'StockImportResult',
        functionName: 'downloadStockCheckImportFailureDetails',
        endpoint: '/erp/stock-check/import-failure-details/download',
      },
      {
        source: readStockApiFile('transfer-out/index.ts'),
        typeSnippet:
          'export type StockImportResult = ErpStockMoveApi.StockImportResult',
        functionName: 'downloadStockTransferOutImportFailureDetails',
        endpoint: '/erp/stock-transfer-out/import-failure-details/download',
      },
      {
        source: readStockApiFile('warehouse-move/index.ts'),
        typeName: 'StockImportResult',
        functionName: 'downloadWarehouseMoveImportFailureDetails',
        endpoint: '/erp/warehouse-move/import-failure-details/download',
      },
      {
        source: readStockApiFile('warehouse/index.ts'),
        typeName: 'WarehouseImportResult',
        functionName: 'downloadWarehouseImportFailureDetails',
        endpoint: '/erp/warehouse/import-failure-details/download',
      },
    ];

    cases.forEach(
      ({ endpoint, functionName, source, typeName, typeSnippet }) => {
        if (typeSnippet) {
          expect(source).toContain(typeSnippet);
        } else {
          expect(source).toContain(`interface ${typeName}`);
          expect(source).toContain('recordId?: number');
        }
        expect(source).toContain(functionName);
        expect(source).toContain(endpoint);
        expect(source).toContain('params: { recordId }');
      },
    );

    expect(readStockApiFile('move/index.ts')).toContain('recordId?: number');
  });

  it('keeps failure results actionable inside stock import modals', () => {
    importFormCases.forEach(({ fileName, functionName, source }) => {
      expect(source).toContain(functionName);
      expect(source).toContain('canDownloadFailureDetails');
      expect(source).toContain('recordId');
      expect(source).toContain('handleDownloadFailureDetails');
      expect(source).toContain(`fileName: '${fileName}'`);
      expect(source).toContain('StockImportResultPanel');
      expect(source).toContain("{{ importResult ? '关闭' : '开始导入' }}");
      expect(source).toContain('max-h-[calc(100vh-48px)]');
      expect(source).toContain('content-class="!min-h-0"');
      expect(source).toContain('footer-class="flex-wrap gap-2');
      expect(source).toContain('flex-auto flex-wrap');
      expect(source).not.toContain('content-class="!flex-none"');
      if (source.includes('result?.successCount ?? result?.createCount')) {
        expect(source).toMatch(
          /if \(\(result\?\.successCount \?\? result\?\.createCount \?\? 0\) > 0\)[\s\S]*?emit\('success'\)/,
        );
      } else
        expect(source).not.toContain(
          "emit('success');\n      if ((result?.failureCount ?? 0) > 0)",
        );
    });
  });

  it('centralizes the stock failure result panel behavior', () => {
    const source = readStockFile('components/StockImportResultPanel.vue');

    expect(source).toContain('下载错误数据');
    expect(source).toContain('canDownloadFailureDetails');
    expect(source).toContain('failureDetails');
    expect(source).toContain('max-h-40 overflow-auto');
    expect(source).toContain("emit('downloadFailureDetails')");
  });

  it('does not add a stock move list import entry', () => {
    const stockMoveList = readStockFile('move/index.vue');
    const stockMoveApi = readStockApiFile('move/index.ts');

    expect(stockMoveList).not.toContain('ImportModal');
    expect(stockMoveList).not.toContain('handleImport');
    expect(stockMoveApi).not.toContain('downloadStockMoveImportFailureDetails');
  });
});
