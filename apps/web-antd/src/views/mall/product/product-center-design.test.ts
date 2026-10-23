import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSource(...paths: string[]) {
  return readFileSync(join(currentDir, ...paths), 'utf8');
}

const listPages = [
  ['spu', readSource('spu', 'index.vue')],
  ['category', readSource('category', 'index.vue')],
  ['brand', readSource('brand', 'index.vue')],
  ['comment', readSource('comment', 'index.vue')],
  ['property', readSource('property', 'modules', 'property-grid.vue')],
  ['property-value', readSource('property', 'modules', 'value-grid.vue')],
] as const;

const spuListSource = readSource('spu', 'index.vue');
const spuDataSource = readSource('spu', 'data.ts');
const spuFormSource = readSource('spu', 'form', 'index.vue');
const compactGridSource = readSource('styles', 'compact-grid.css');
const propertyIndexSource = readSource('property', 'index.vue');

describe('mall product center ERP style contract', () => {
  it('uses the compact collapsed search contract on every product-center grid', () => {
    for (const [name, source] of listPages) {
      expect(source, name).toContain('collapsed: true');
      expect(source, name).toContain('collapsedRows: 1');
      expect(source, name).toContain('commonConfig: { labelWidth: 68 }');
      expect(source, name).toContain(
        '@keydown.enter.capture="handleSearchEnter"',
      );
      expect(source, name).toContain("showHeaderOverflow: 'tooltip'");
      expect(source, name).toContain("showOverflow: 'tooltip'");
      expect(source, name).toContain('scrollX:');
      expect(source, name).toContain('mall-product-compact-grid');
    }
  });

  it('keeps the shared compact grid style aligned with ERP density', () => {
    expect(compactGridSource).toContain('.vxe-grid--form-wrapper');
    expect(compactGridSource).toContain('.vxe-toolbar .table-actions .ant-btn');
    expect(compactGridSource).toContain('height: 28px');
    expect(compactGridSource).toContain('.vxe-grid--pager-wrapper');
    expect(compactGridSource).toContain('position: sticky');
    expect(compactGridSource).toContain('font-size: 12px');
  });

  it('opens SPU create edit and detail through the fullscreen modal from the list', () => {
    expect(spuListSource).toContain('connectedComponent: SpuForm');
    expect(spuListSource).toContain(
      "spuFormModalApi.setData({ type: 'create' }).open()",
    );
    expect(spuListSource).toContain(
      "spuFormModalApi.setData({ id: row.id, type: 'edit' }).open()",
    );
    expect(spuListSource).toContain(
      "spuFormModalApi.setData({ id: row.id, type: 'detail' }).open()",
    );
    expect(spuListSource).toContain('function handleCellClick');
    expect(spuListSource).toContain("column?.field === 'actions'");
    expect(spuListSource).toContain("column?.field === 'status'");
    expect(spuListSource).toContain("column?.field === 'price'");
    expect(spuListSource).toContain('cellClick: handleCellClick');
    expect(spuListSource).toContain('mall-product-row-detail-grid');
    expect(spuListSource).toContain(
      '<SpuFormModal @success="handleRefresh" />',
    );
    expect(spuDataSource).toMatch(/title: '操作',[\s\S]*?width: 220/);
  });

  it('keeps SPU retail price editing as a lightweight list action', () => {
    expect(spuDataSource).toContain("title: '小程序价格'");
    expect(spuListSource).toContain('updateRetailPrice');
    expect(spuListSource).toContain('function handleUpdateRetailPrice');
    expect(spuListSource).toContain('title="修改小程序价格"');
    expect(spuListSource).toContain('handleRetailPriceSubmit');
    expect(spuListSource).toContain("label: '改价'");
    expect(spuListSource).toContain("auth: ['product:spu:update']");
    expect(spuListSource).toContain('yuanToFen(retailPriceYuan.value ?? 0)');
  });

  it('keeps the SPU form retail price field lightweight and ERP-backed', () => {
    expect(spuFormSource).toContain('updateRetailPrice');
    expect(spuFormSource).toContain('const canSyncRetailPrice = computed');
    expect(spuFormSource).toContain(
      'mallStockSummary.value?.mappingCount === 1',
    );
    expect(spuFormSource).toContain(
      'useInfoFormSchema({ retailPriceDisabled: retailPriceDisabled.value })',
    );
    expect(spuFormSource).toContain('submitValues.price ?? sku.price ?? 0');
    expect(spuFormSource).toContain(
      'await updateRetailPrice({ id: spuId.value, price: retailPrice })',
    );
  });

  it('adds mini-app retail price to basic settings without restoring old sku controls', () => {
    const spuFormDataSource = readSource('spu', 'form', 'data.ts');

    expect(spuFormDataSource).toContain("fieldName: 'price'");
    expect(spuFormDataSource).toContain("label: '小程序价格'");
    expect(spuFormDataSource).toContain("addonAfter: '元'");
    expect(spuFormDataSource).toContain('options.retailPriceDisabled');
    expect(spuFormDataSource).toContain('价格体系中的零售价');
    expect(spuFormSource).not.toContain('<SkuForm');
    expect(spuFormSource).not.toContain('<SkuList');
    expect(spuFormSource).not.toContain('<ProductAttributes');
  });

  it('keeps legacy SPU routes compatible while using the modal form', () => {
    expect(spuFormSource).toContain(
      "const legacyRouteNames = ['ProductSpuAdd', 'ProductSpuEdit', 'ProductSpuDetail']",
    );
    expect(spuFormSource).toContain("ProductSpuAdd: 'create'");
    expect(spuFormSource).toContain("ProductSpuDetail: 'detail'");
    expect(spuFormSource).toContain("ProductSpuEdit: 'edit'");
    expect(spuFormSource).toContain(
      "await router.replace('/mall/product/spu')",
    );
  });

  it('uses an ERP-style fullscreen modal with detail edit permission', () => {
    expect(spuFormSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(spuFormSource).toContain(':show-confirm-button="canSubmit"');
    expect(spuFormSource).toContain("hasAccessByCodes(['product:spu:update'])");
    expect(spuFormSource).toContain('v-if="canEditFromDetail"');
    expect(spuFormSource).toContain('@click="handleEditFromDetail"');
    expect(spuFormSource).toContain('class="mall-spu-form-tabs"');
    expect(spuFormSource).toContain('class="mall-spu-form-section"');
    expect(spuFormSource).toContain('getMallStockSummary(spuId.value)');
    expect(spuFormSource).toContain('未绑定 ERP 产品，暂无仓库库存来源');
    expect(spuFormSource).toContain('ERP 库存读取失败，不影响商品编辑');
    expect(spuFormSource).toContain('mall-spu-erp-stock-summary');
    expect(spuFormSource).toContain('tab="ERP库存"');
    expect(spuFormSource).toContain('const mallStockColumns');
    expect(spuFormSource).toContain('const mallStockPagination');
    expect(spuFormSource).toContain(':pagination="mallStockPagination"');
    expect(spuFormSource).toContain('mall-spu-erp-stock-section');
    expect(spuFormSource).toContain('submitValues.specType = false');
    expect(spuFormSource).toContain('submitValues.subCommissionType = false');
    expect(spuFormSource).toContain('font-size: 12px');
  });

  it('keeps the property page as a responsive two-pane grid', () => {
    expect(propertyIndexSource).toContain('mall-product-property-layout');
    expect(propertyIndexSource).toContain('mall-product-property-layout__pane');
    expect(propertyIndexSource).toContain('@select="handlePropertyIdSelect"');
    expect(propertyIndexSource).toContain(':property-id="searchPropertyId"');
  });
});
