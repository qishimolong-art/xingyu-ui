import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const baseInfoSource = readFileSync(
  join(currentDir, 'modules/tabs/base-info.vue'),
  'utf8',
);
const extendInfoSource = readFileSync(
  join(currentDir, 'modules/tabs/extend-info.vue'),
  'utf8',
);
const priceInfoSource = readFileSync(
  join(currentDir, 'modules/tabs/price-info.vue'),
  'utf8',
);
const stockInfoSource = readFileSync(
  join(currentDir, 'modules/tabs/stock-info.vue'),
  'utf8',
);
const stockDistributionSource = readFileSync(
  join(currentDir, 'modules/tabs/stock-distribution.vue'),
  'utf8',
);
const productSelectModalSource = readFileSync(
  join(currentDir, 'modules/product-select-modal.vue'),
  'utf8',
);

describe('product page design contract', () => {
  it('keeps the category sidebar collapsed by default', () => {
    expect(indexSource).toContain('const categorySidebarCollapsed = ref(true)');
  });

  it('matches the sales-cart list search, toolbar, sorting, actions, batch legend, and sticky pager', () => {
    expect(indexSource).toContain('commonConfig: { labelWidth: 68 }');
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain(
      '.vxe-grid--form-wrapper .ant-input-affix-wrapper',
    );
    expect(indexSource).toContain('.vxe-toolbar .table-actions .ant-btn');
    expect(indexSource).toContain('height: 28px');
    expect(dataSource).toContain(
      "popupClassName: 'product-search-select-dropdown'",
    );
    expect(indexSource).toContain(
      '.vxe-header--column.is--sortable .vxe-cell--title',
    );
    expect(indexSource).toContain('color: #1677ff');
    expect(indexSource).toContain('.vxe-header--column .vxe-cell--sort');
    expect(indexSource).toContain('display: none');
    expect(indexSource).toContain("'product-batch-row-highlight'");
    expect(indexSource).toContain('黄色列表表示该配件已开启批次号管理');
    expect(indexSource).toContain('.vxe-grid--pager-wrapper');
    expect(indexSource).toContain('position: sticky');
    expect(dataSource).toMatch(/title: '操作',[\s\S]*?width: 130/);

    const productNameSlotStart = indexSource.indexOf(
      '<template #productName="{ row }">',
    );
    const currentStockSlotStart = indexSource.indexOf(
      '<template #currentStock="{ row }">',
      productNameSlotStart,
    );
    const productNameSlotSource = indexSource.slice(
      productNameSlotStart,
      currentStockSlotStart,
    );
    expect(productNameSlotSource).not.toContain('row.batchNoEnabled');
    expect(productNameSlotSource).not.toContain('批次');
    expect(productNameSlotSource).toContain(
      'class="product-warehouse-distribution-dot"',
    );
    expect(productNameSlotSource).not.toContain('销售仓只读');
    expect(indexSource).toContain('橙色圆点表示该配件来自销售仓库分发');
  });

  it('uses a standalone two-tab create layout', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      'class="product-form-view product-form-view--editable product-create-layout"',
    );
    expect(formSource).toContain(
      'class="product-create-card__title">新增配件资料',
    );

    const createStart = formSource.indexOf('v-if="formType === \'create\'"');
    const detailStart = formSource.indexOf('v-else', createStart);
    const createLayoutSource = formSource.slice(createStart, detailStart);

    expect(createLayoutSource).toContain('<Tabs');
    expect(createLayoutSource).toContain('key="base" tab="配件信息"');
    expect(createLayoutSource).toContain('<BaseInfo');
    expect(createLayoutSource).toContain('key="extend" tab="拓展信息"');
    expect(createLayoutSource).toContain('<ExtendInfo');
    expect(createLayoutSource).not.toContain('<PriceInfo');
    expect(createLayoutSource).not.toContain('<ImageInfo');
    expect(createLayoutSource).not.toContain('<StockInfo');
    expect(createLayoutSource).not.toContain('<UniversalInfo');
  });

  it('keeps edit and detail on the same compact tabs with audit fixed last', () => {
    [
      '配件信息',
      '价格信息',
      '拓展信息',
      '配件图片',
      '配件详情',
      '库存分发',
      '库存信息',
      '通用件',
    ].forEach((title) => {
      expect(formSource).toContain(`tab="${title}"`);
    });
    expect(formSource).not.toContain('key="audit"');
    expect(formSource).not.toContain('tab="审计信息"');
    expect(formSource).toContain(
      'class="product-detail-card product-detail-audit"',
    );
    expect(formSource).toContain(
      '<span class="product-detail-audit__title">审计信息</span>',
    );
    expect(formSource).toContain(
      ":department-keys=\"['createDeptName', 'createDeptId']\"",
    );
    expect(formSource).toContain('department-label="创建部门"');
    expect(formSource.indexOf('product-detail-audit__title')).toBeGreaterThan(
      formSource.lastIndexOf('</Tabs>'),
    );
    expect(formSource).toContain(
      'class="product-form-tabs product-detail-tabs"',
    );
    expect(formSource).toContain('force-render');
    expect(formSource).toContain('.product-form-tabs :deep(.ant-tabs-tab-btn)');
    expect(formSource).toContain('font-size: 12px');
    expect(formSource).toContain(
      'grid-template-columns: repeat(4, minmax(0, 1fr))',
    );
    expect(baseInfoSource).toContain(
      "wrapperClass: 'product-form-grid grid-cols-4'",
    );
    expect(extendInfoSource).toContain(
      "wrapperClass: 'product-form-grid grid-cols-4'",
    );
  });

  it('uses the concise batch-number field label', () => {
    expect(dataSource).toContain("label: '开启批次号'");
    expect(dataSource).not.toContain("label: '是否开启批次号管理'");
    expect(dataSource).toContain('normalizeProductBaseFieldLabels(schema)');
    expect(dataSource).toContain("item.fieldName === 'batchNoEnabled'");
  });

  it('adds product brand as a controlled base field, list column, and selector filter', () => {
    expect(dataSource).toContain('getProductBrandSimpleList');
    expect(dataSource).toContain("fieldName: 'brand'");
    expect(dataSource).toContain("label: '品牌'");
    expect(dataSource).toContain("component: 'QuickCreateApiSelect'");
    expect(dataSource).toContain("valueField: 'name'");
    expect(dataSource).toContain("target: 'brand'");
    expect(dataSource).toContain("{ field: 'brand', title: '品牌'");
    expect(indexSource).toContain("brand: 'brand'");
    expect(baseInfoSource).toContain(
      "canCreateBrand: hasAccessByCodes(['erp:product-brand:create'])",
    );
    expect(formSource).toContain("context.target === 'brand'");
    expect(formSource).toContain(
      'await baseRef.value?.setFieldValue(context.fieldName, record.name)',
    );
    expect(productSelectModalSource).toContain('getProductBrandSimpleList');
    expect(productSelectModalSource).toContain("component: 'ApiSelect'");
    expect(productSelectModalSource).toContain("valueField: 'name'");
    expect(productSelectModalSource).toContain(
      "{ field: 'brand', title: '品牌'",
    );
  });

  it('keeps the default warehouse name visible after detail load and quick creation', () => {
    expect(dataSource).toContain(
      'api: options.getWarehouseOptions ?? getWarehouseSimpleList',
    );
    expect(baseInfoSource).toContain('getStockWarehouseSimpleList');
    expect(baseInfoSource).toContain('shouldUseStockVisibleWarehouseOptions');
    expect(baseInfoSource).toContain('readonly: props.readonly');
    expect(baseInfoSource).toContain('props.value?.readonlyBySaleDistribution');
    expect(baseInfoSource).toContain('includeSelectedWarehouseOption');
    expect(baseInfoSource).toContain('props.value?.defaultWarehouseName');
    expect(baseInfoSource).toContain(
      'getWarehouseOptions: getDefaultWarehouseOptions',
    );
    expect(
      formSource.match(/<BaseInfo[\s\S]*?:value="formData"[\s\S]*?\/>/g),
    ).toHaveLength(2);
    expect(formSource).toContain(
      'baseRef.value?.refreshDefaultWarehouseOptions()',
    );
    expect(formSource).toContain(':readonly="isReadonly"');
    expect(formSource).toContain("context.target === 'warehouse'");
    expect(formSource).toContain('defaultWarehouseName: warehouse.name');
  });

  it('validates price fields only outside create and handles detail load exits', () => {
    expect(formSource).toContain("if (formType.value !== 'create')");
    expect(formSource).toContain("activeTabKey.value = 'price'");
    expect(formSource).toContain("activeTabKey.value = 'extend'");
    expect(formSource).toContain('detailLoading.value = true');
    expect(formSource).toContain(
      "detailLoadError.value = '配件信息加载失败，请关闭后重试'",
    );
    expect(formSource).toContain('detailLoading.value = false');
    expect(formSource).toContain('v-show="!detailLoading && !detailLoadError"');
    expect(stockInfoSource).toContain('sequence !== stockLoadSequence');
    expect(stockDistributionSource).toContain(
      'sequence !== distributionLoadSequence',
    );
  });

  it('loads detail price fields with product price view permissions', () => {
    expect(formSource).not.toContain(
      '<PriceInfo\n                ref="priceRef"\n                class="product-edit-form"\n                :value="formData"',
    );
    expect(priceInfoSource).not.toContain('defineProps');
    expect(priceInfoSource).not.toContain('props.value?.deptId');
    expect(priceInfoSource).not.toContain('props.value?.createDeptId');
    expect(priceInfoSource).toContain("useFieldPermission('erp_product')");
    expect(priceInfoSource).not.toContain(
      'includeProductPricePermission: false',
    );
  });

  it('refreshes custom field columns when returning to the cached product page', () => {
    expect(indexSource).toContain(
      "import { computed, onActivated, onMounted, ref, watch } from 'vue'",
    );
    expect(indexSource).toContain('let activatedOnce = false');
    expect(indexSource).toContain('onActivated(() => {');
    expect(indexSource).toContain('void refreshCustomFieldColumns()');
  });
});
