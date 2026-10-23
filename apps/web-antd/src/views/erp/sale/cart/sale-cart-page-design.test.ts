import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/cart/index.ts'),
  'utf8',
);

describe('销售手推车统一页面设计', () => {
  it('列表不自动聚焦关键词，且新增受权限、活动页签和加载状态保护', () => {
    expect(indexSource).not.toContain('focusSearchKeywordInput');
    expect(indexSource).not.toContain('focusKeywordInput');
    expect(indexSource).toContain("hasAccessByCodes(['erp:sale-cart:create'])");
    expect(indexSource).toContain('activationRefreshMaskVisible.value');
    expect(indexSource).toContain('useSaleShortcut({');
  });

  it('列表操作保留图标并固定，列设置恢复默认后立即重建列', () => {
    expect(indexSource).toContain('icon: ACTION_ICON.REVERSE');
    expect(indexSource).toContain('syncSaleDocumentOperationColumn');
    expect(indexSource).toContain('settleVxeColumnCustomization');
    expect(indexSource).toContain("type !== 'reset'");
    expect(indexSource).toContain('custom: true');
    expect(indexSource).toContain('zoom: true');
  });

  it('列表整单导入与表单明细导入使用独立接口和模板', () => {
    expect(indexSource).toContain("title: '导入销售手推车整单'");
    expect(indexSource).toContain(
      "templateFileName: '销售手推车整单导入模板.xls'",
    );
    expect(indexSource).toContain('importRequest: importSaleCartOrder');
    expect(indexSource).toContain(
      'exportTemplateRequest: exportSaleCartOrderImportTemplate',
    );
    expect(formSource).toContain(
      "templateFileName: '销售手推车明细导入模板.xls'",
    );
    expect(formSource).toContain('importRequest: importSaleCart');
    expect(formSource).toContain(
      'exportTemplateRequest: exportSaleCartImportTemplate',
    );
    expect(formSource).toContain('产品、仓库、数量、价格');
    expect(apiSource).toContain("'/erp/sale-cart/import'");
    expect(apiSource).toContain("'/erp/sale-cart/export-import-template'");
    expect(apiSource).toContain("'/erp/sale-cart/import-order'");
    expect(apiSource).toContain("'/erp/sale-cart/get-order-import-template'");
  });

  it('明细数字输入、操作列和表格工具符合统一规则', () => {
    expect(itemFormSource).toContain('inputmode="decimal"');
    expect(itemFormSource).toContain('autocomplete="off"');
    expect(itemFormSource).toContain('icon: ACTION_ICON.DELETE');
    expect(itemFormSource).toContain('custom: true');
    expect(itemFormSource).toContain('refresh: true');
    expect(itemFormSource).toContain('zoom: true');
  });

  it('删除回调不会透传 PointerEvent，并提供可读失败兜底', () => {
    expect(indexSource).toContain('() => handleDelete([row.id!])');
    expect(indexSource).toContain('删除失败，请稍后重试');
    expect(indexSource).toContain('refreshActivatedSaleCartPage');
  });
});
