import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSaleFile(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

function readSaleApiFile(path: string) {
  return readFileSync(join(currentDir, '../../../api/erp/sale', path), 'utf8');
}

const saleDetailImportModalSource = readSaleFile(
  'components/sale-detail-import-modal.vue',
);
const saleOrderImportModalSource = readSaleFile(
  'components/sale-order-import-modal.vue',
);
const saleOrderOwnImportFormSource = readSaleFile(
  'order/modules/import-form.vue',
);

describe('sale import failure download contract', () => {
  it('exposes scoped failure download APIs for every sale list import', () => {
    const cases = [
      {
        source: readSaleApiFile('order/index.ts'),
        typeName: 'SaleOrderImportResp',
        functionName: 'downloadSaleOrderImportFailureDetails',
        endpoint: '/erp/sale-order/import-failure-details/download',
      },
      {
        source: readSaleApiFile('quote/index.ts'),
        typeName: 'SaleOrderImportResp',
        functionName: 'downloadSaleQuoteImportFailureDetails',
        endpoint: '/erp/sale-quote/import-failure-details/download',
      },
      {
        source: readSaleApiFile('cart/index.ts'),
        typeName: 'SaleCartImportResp',
        functionName: 'downloadSaleCartImportFailureDetails',
        endpoint: '/erp/sale-cart/import-failure-details/download',
      },
      {
        source: readSaleApiFile('return/index.ts'),
        typeName: 'SaleReturnImportResp',
        functionName: 'downloadSaleReturnImportFailureDetails',
        endpoint: '/erp/sale-return/import-failure-details/download',
      },
      {
        source: readSaleApiFile('priceadjust/index.ts'),
        typeName: 'PriceAdjustImportResp',
        functionName: 'downloadSalePriceAdjustImportFailureDetails',
        endpoint: '/erp/sale-price-adjust/import-failure-details/download',
      },
    ];

    cases.forEach(({ endpoint, functionName, source, typeName }) => {
      expect(source).toContain(`interface ${typeName}`);
      expect(source).toContain('recordId?: number');
      expect(source).toContain(functionName);
      expect(source).toContain(endpoint);
      expect(source).toContain('params: { recordId }');
    });
  });

  it('passes failure download config only from sale list import entries', () => {
    const cases = [
      {
        source: readSaleFile('order/index.vue'),
        functionName: 'downloadSaleOrderImportFailureDetails',
        fileName: '销售订单错误数据.xls',
      },
      {
        source: readSaleFile('quote/index.vue'),
        functionName: 'downloadSaleQuoteImportFailureDetails',
        fileName: '销售报价错误数据.xls',
      },
      {
        source: readSaleFile('cart/index.vue'),
        functionName: 'downloadSaleCartImportFailureDetails',
        fileName: '销售手推车错误数据.xls',
      },
      {
        source: readSaleFile('return/index.vue'),
        functionName: 'downloadSaleReturnImportFailureDetails',
        fileName: '销售退货错误数据.xls',
      },
      {
        source: readSaleFile('priceadjust/index.vue'),
        functionName: 'downloadSalePriceAdjustImportFailureDetails',
        fileName: '销售调价错误数据.xls',
      },
    ];

    cases.forEach(({ fileName, functionName, source }) => {
      expect(source).toContain(functionName);
      expect(source).toContain('failureDownload: {');
      expect(source).toContain(`request: ${functionName}`);
      expect(source).toContain(`fileName: '${fileName}'`);
    });

    [
      readSaleFile('order/modules/form.vue'),
      readSaleFile('quote/modules/form.vue'),
      readSaleFile('cart/modules/form.vue'),
      readSaleFile('return/modules/form.vue'),
      readSaleFile('priceadjust/modules/form.vue'),
    ].forEach((source) => {
      expect(source).not.toContain('failureDownload: {');
    });
  });

  it('keeps failure results actionable inside the sale import modals', () => {
    [
      saleDetailImportModalSource,
      saleOrderImportModalSource,
      saleOrderOwnImportFormSource,
    ].forEach((source) => {
      expect(source).toContain('const uploadFile = ref<File | null>(null)');
      expect(source).toContain('const importResult');
      expect(source).toContain('importResult.value = data;');
      expect(source).toContain('importResult.value = null;');
      expect(source).toContain('canDownloadFailureDetails');
      expect(source).toContain('recordId');
      expect(source).toContain('handleDownloadFailureDetails');
      expect(source).toContain('下载错误数据');
      expect(source).toContain("{{ importResult ? '关闭' : '开始导入' }}");
      expect(source).toContain('max-h-[calc(100vh-48px)]');
      expect(source).toContain('content-class="!min-h-0"');
      expect(source).toContain('footer-class="flex-wrap gap-2');
      expect(source).toContain('flex-auto flex-wrap');
      expect(source).not.toContain('content-class="!flex-none"');
    });
  });

  it('does not emit success on list import failures that have failure downloads', () => {
    expect(saleDetailImportModalSource).toContain(
      'if (!modalData.value.failureDownload) {',
    );
    expect(saleOrderImportModalSource).not.toContain(
      "emit('success', data);\n      if ((data.failureCount ?? 0) > 0)",
    );
    expect(saleOrderOwnImportFormSource).toContain(
      'if (!modalData.value?.failureDownload) {',
    );
  });
});
