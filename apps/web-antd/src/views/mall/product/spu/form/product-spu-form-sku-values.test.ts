import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const currentDir = __dirname;
const formSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');

describe('mall product spu form sku values', () => {
  it('removes the visible sku specification and commission form from the SPU modal', () => {
    expect(formSource).not.toContain('const [SkuForm, skuFormApi]');
    expect(formSource).not.toContain('<SkuForm');
    expect(formSource).not.toContain('<SkuList');
    expect(formSource).not.toContain('<ProductAttributes');
    expect(formSource).not.toContain('添加属性');
    expect(formSource).toContain('tab="ERP库存"');
  });

  it('submits a hidden single-spec sku for backend compatibility', () => {
    const submitHandler = formSource.slice(
      formSource.indexOf('async function handleSubmit()'),
      formSource.indexOf('/** 获得详情 */'),
    );

    expect(submitHandler).toContain('submitValues.specType = false');
    expect(submitHandler).toContain('submitValues.subCommissionType = false');
    expect(submitHandler).toContain(
      'submitValues.skus = buildHiddenSkuList(submitValues, formData.value.skus)',
    );
    expect(formSource).toContain('function buildHiddenSkuList(');
    expect(formSource).toContain(
      'picUrl: sku.picUrl || submitValues.picUrl ||',
    );
    expect(formSource).toContain('price: submitValues.price ?? sku.price ?? 0');
    expect(formSource).toContain('firstBrokeragePrice: 0');
    expect(formSource).toContain('secondBrokeragePrice: 0');
  });

  it('shows a single mini-app retail price field and syncs ERP only for unique mappings', () => {
    const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');

    expect(dataSource).toContain("fieldName: 'price'");
    expect(dataSource).toContain("label: '小程序价格'");
    expect(dataSource).toContain("addonAfter: '元'");
    expect(dataSource).toContain('options.retailPriceDisabled');
    expect(dataSource).toContain('价格体系中的零售价');
    expect(formSource).toContain('const canSyncRetailPrice = computed');
    expect(formSource).toContain('mallStockSummary.value?.mapped === true');
    expect(formSource).toContain('mallStockSummary.value?.mappingCount === 1');
    expect(formSource).toContain('updateRetailPrice');
    expect(formSource).toContain('retailPrice = Number(convertToInteger');
  });

  it('shows ERP warehouse inventory instead of mall price stock fields', () => {
    expect(formSource).toContain('const mallStockColumns');
    expect(formSource).toContain("title: '仓库名称'");
    expect(formSource).toContain("title: '可用库存'");
    expect(formSource).toContain('mallStockCards');
    expect(formSource).toContain('const mallStockPagination');
    expect(formSource).toContain(':pagination="mallStockPagination"');
    expect(formSource).toContain('class="mall-spu-stock-table"');
    expect(formSource).toContain('暂无 ERP 仓库库存');
  });
});
