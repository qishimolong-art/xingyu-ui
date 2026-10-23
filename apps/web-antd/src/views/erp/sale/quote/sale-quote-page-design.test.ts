import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/quote/index.ts'),
  'utf8',
);

describe('sale quote unified page behavior', () => {
  it('does not focus the keyword field and guards list shortcuts', () => {
    expect(indexSource).not.toContain('queueFocusSaleKeywordSearchInput');
    expect(indexSource).toContain(
      "hasAccessByCodes(['erp:sale-quote:create'])",
    );
    expect(indexSource).toContain('activationRefreshMaskVisible.value');
  });

  it('keeps adaptive list tools and settles reset before rebuilding columns', () => {
    expect(indexSource).toContain('applySaleDocumentListColumnCustomization');
    expect(indexSource).toContain('settleVxeColumnCustomization');
    expect(indexSource).toContain("type !== 'reset'");
    expect(indexSource).toContain('custom: true');
    expect(indexSource).toContain('zoom: true');
    expect(indexSource).toContain('fit: true');
  });

  it('keeps right-side operations visually distinct and pointer-event safe', () => {
    expect(indexSource).toContain('icon: ACTION_ICON.EDIT');
    expect(indexSource).toContain('icon: ACTION_ICON.ORDER');
    expect(indexSource).toContain('icon: ACTION_ICON.REVERSE');
    expect(indexSource).toContain('confirm: () => handleDelete([row.id!])');
    expect(indexSource).toContain('删除失败，请稍后重试');
  });

  it('keeps full-order and detail import templates separate', () => {
    expect(indexSource).toContain(
      "templateFileName: '报价订单整单导入模板.xls'",
    );
    expect(formSource).toContain(
      "templateFileName: '报价订单明细导入模板.xls'",
    );
    expect(indexSource).toContain('importRequest: importSaleQuoteOrder');
    expect(indexSource).toContain(
      'exportTemplateRequest: exportSaleQuoteOrderImportTemplate',
    );
    expect(formSource).toContain('importRequest: importSaleQuote');
    expect(formSource).toContain(
      'exportTemplateRequest: exportSaleQuoteImportTemplate',
    );
    expect(formSource).toContain('产品、仓库、数量、价格、赠品及备注');
    expect(apiSource).toContain("'/erp/sale-quote/import'");
    expect(apiSource).toContain("'/erp/sale-quote/export-import-template'");
    expect(apiSource).toContain("'/erp/sale-quote/import-order'");
    expect(apiSource).toContain("'/erp/sale-quote/get-order-import-template'");
  });
});
