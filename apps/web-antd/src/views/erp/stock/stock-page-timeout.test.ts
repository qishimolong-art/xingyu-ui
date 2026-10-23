import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readStockApiSource() {
  return readFileSync(
    join(currentDir, '../../../api/erp/stock/stock/index.ts'),
    'utf8',
  );
}

describe('stock list request timeouts', () => {
  it('extends the stock page timeout for realtime stock calculations', () => {
    const source = readStockApiSource();
    const stockPageApi = source.slice(
      source.indexOf('export function getStockPage'),
      source.indexOf('export interface PurchaseStockPageReqVO'),
    );

    expect(source).toContain('const STOCK_PAGE_REQUEST_TIMEOUT = 60 * 1000;');
    expect(stockPageApi).toContain('timeout: STOCK_PAGE_REQUEST_TIMEOUT,');
  });

  it('extends and silences the independently handled stock summary request', () => {
    const source = readStockApiSource();
    const stockSummaryApi = source.slice(
      source.indexOf('export function getStockSummary'),
      source.indexOf('export function getMallStockSummary'),
    );

    expect(source).toContain(
      'const STOCK_SUMMARY_REQUEST_TIMEOUT = 60 * 1000;',
    );
    expect(stockSummaryApi).toContain('signal?: AbortSignal');
    expect(stockSummaryApi).toContain(
      "headers: { 'X-Silent-Error-Message': 'true' },",
    );
    expect(stockSummaryApi).toContain('signal,');
    expect(stockSummaryApi).toContain(
      'timeout: STOCK_SUMMARY_REQUEST_TIMEOUT,',
    );
  });
});
