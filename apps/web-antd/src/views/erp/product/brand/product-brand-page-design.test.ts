import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/product/brand/index.ts'),
  'utf8',
);
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const importFormSource = readFileSync(
  join(currentDir, 'modules/import-form.vue'),
  'utf8',
);

describe('product brand page design contract', () => {
  it('uses the dedicated product brand backend API and permissions', () => {
    expect(apiSource).toContain('/erp/product-brand/page');
    expect(apiSource).toContain('/erp/product-brand/list-all-simple');
    expect(apiSource).toContain('/erp/product-brand/create');
    expect(indexSource).toContain("useFieldPermission('erp_product_brand')");
    expect(indexSource).toContain("auth: ['erp:product-brand:create']");
    expect(indexSource).toContain("auth: ['erp:product-brand:import']");
    expect(indexSource).toContain("auth: ['erp:product-brand:export']");
    expect(indexSource).toContain("auth: ['erp:product-brand:delete']");
    expect(formSource).toContain("useFieldPermission('erp_product_brand')");
  });

  it('keeps the brand archive compact and status-aware', () => {
    expect(dataSource).toContain("fieldName: 'name'");
    expect(dataSource).toContain("label: '品牌名称'");
    expect(dataSource).toContain('maxlength: 64');
    expect(dataSource).toContain("fieldName: 'status'");
    expect(dataSource).toContain("fieldName: 'sort'");
    expect(indexSource).toContain("'erp-disabled-row-highlight'");
    expect(indexSource).toContain('配件品牌列表');
  });

  it('wires product brand import with template download and compact result details', () => {
    expect(apiSource).toContain('/erp/product-brand/get-import-template');
    expect(apiSource).toContain('/erp/product-brand/import');
    expect(indexSource).toContain('connectedComponent: ImportForm');
    expect(indexSource).toContain("auth: ['erp:product-brand:import']");
    expect(indexSource).toContain("tooltip: 'I 导入'");
    expect(importFormSource).toContain('title="导入配件品牌"');
    expect(importFormSource).toContain('配件品牌导入用于批量维护品牌档案');
    expect(importFormSource).toContain('配件品牌导入模板.xls');
    expect(importFormSource).toContain('failureDetails');
    expect(importFormSource).toContain('height: 28px');
  });
});
