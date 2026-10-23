import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const recipeIndex = readFileSync(join(currentDir, 'recipe/index.vue'), 'utf8');
const recipeForm = readFileSync(
  join(currentDir, 'recipe/modules/form.vue'),
  'utf8',
);
const orderIndex = readFileSync(join(currentDir, 'order/index.vue'), 'utf8');
const orderForm = readFileSync(
  join(currentDir, 'order/modules/form.vue'),
  'utf8',
);
const orderData = readFileSync(join(currentDir, 'order/data.ts'), 'utf8');
const recipeData = readFileSync(join(currentDir, 'recipe/data.ts'), 'utf8');
const recipeApi = readFileSync(
  join(currentDir, '../../../api/erp/assembly/recipe/index.ts'),
  'utf8',
);
const orderApi = readFileSync(
  join(currentDir, '../../../api/erp/assembly/order/index.ts'),
  'utf8',
);
const stockReportUi = readFileSync(
  join(currentDir, '../stock/report/report-v2-ui.ts'),
  'utf8',
);
const stockRecordTab = readFileSync(
  join(currentDir, '../stock/record/modules/stock-record-tab.vue'),
  'utf8',
);

describe('assembly workflow contract', () => {
  it('keeps list and item queries paginated', () => {
    expect(recipeApi).toContain('/erp/assembly-recipe/page');
    expect(recipeApi).toContain('/erp/assembly-recipe/item-page');
    expect(orderApi).toContain('/erp/assembly-order/page');
    expect(orderApi).toContain('/erp/assembly-order/item-page');
    expect(recipeForm).toContain('<Pagination');
    expect(orderForm).toContain('<Pagination');
    expect(recipeForm).toContain('fetchAllItems');
    expect(orderForm).toContain('fetchAllItems');
  });

  it('supports component batch allocation and finished-product batch input', () => {
    expect(orderForm).toContain('getAssemblyComponentBatchNoList');
    expect(orderForm).toContain('splitBatch(record)');
    expect(orderForm).toContain('finishedBatchNo');
    expect(orderForm).toContain('batchNoEnabled');
    expect(orderForm).toContain('批次消耗合计应为');
  });

  it('keeps assembly header controls full width inside the responsive grid', () => {
    expect(orderForm).toContain('.field {\n  min-width: 0;');
    expect(orderForm).toContain('.assembly-fields :deep(.ant-select)');
    expect(orderForm).toContain('.assembly-fields :deep(.ant-input-number)');
    expect(orderForm).toContain('width: 100%;\n  min-width: 0;');
  });

  it('preserves cross-page edits and clears stale asynchronous selections', () => {
    expect(orderForm).toContain('normalizeRequiredQuantities');
    expect(orderForm).toContain('itemLoadVersion');
    expect(orderForm).toContain('recipeLoadVersion');
    expect(orderForm).toContain('formData.value.finishedBatchNo = undefined');
    expect(recipeForm).toContain('editedById');
    expect(recipeForm).toContain('deletedIds.has(item.id)');
  });

  it('keeps lifecycle audit data in the API and confirmed order-list fields', () => {
    expect(orderApi).toContain('confirmUserName');
    expect(orderApi).toContain('reverseConfirmUserName');
    expect(orderApi).toContain('startUserName');
    expect(orderApi).toContain('cancelStartUserName');
    expect(orderApi).toContain('completeUserName');
    expect(orderApi).toContain('reverseAssemblyUserName');
    expect(orderApi).toContain('voidUserName');
    expect(orderData).not.toContain("field: 'recipeVersion'");
    expect(orderData).toContain("field: 'customerName'");
    expect(orderData).toContain("field: 'totalCost'");
    expect(orderData).toContain("field: 'unitCost'");
    expect(orderData).toContain("field: 'productRetailPrice'");
    expect(orderData).toContain("field: 'creatorName'");
    expect(orderData).toContain("field: 'updaterName'");
    expect(orderData).toContain("field: 'printCount'");
    expect(orderData).toContain("field: 'printTime'");
  });

  it('keeps permission-controlled create, workflow and delete actions', () => {
    expect(recipeIndex).toContain('erp:assembly-recipe:create');
    expect(recipeIndex).toContain('erp:assembly-recipe:delete');
    expect(recipeIndex).not.toContain('openAssemblyOrder(row)');
    expect(recipeIndex).not.toContain("label: '套件组装'");
    expect(orderIndex).toContain('erp:assembly-order:create');
    expect(orderIndex).toContain(
      "hasAccessByCodes(['erp:assembly-order:update'])",
    );
    [
      'erp:assembly-order:confirm',
      'erp:assembly-order:reverse-confirm',
      'erp:assembly-order:start',
      'erp:assembly-order:cancel-start',
      'erp:assembly-order:complete',
      'erp:assembly-order:reverse-assembly',
    ].forEach((permission) => expect(orderForm).toContain(permission));
    expect(orderForm).not.toContain('erp:assembly-order:void');
    expect(orderIndex).toContain('erp:assembly-order:delete');
    expect(orderForm).toContain('canSaveDraft');
    expect(orderForm).toContain('canConfirm');
    expect(orderForm).toContain('canReverseAssembly');
  });

  it('shows the exact assembly-order list columns without fixed columns', () => {
    const titles = [
      '删除',
      '打印',
      '导出',
      '单号',
      '单据日期',
      '单据状态',
      '对象',
      '图号',
      '产品编码',
      '产品名称',
      '产地',
      '规格',
      '特征码',
      '品牌',
      '车型',
      '仓库',
      '仓位',
      '数量',
      '组装成本金额',
      '成本价',
      '零售价',
      '创建人',
      '编辑人',
      '打印次数',
      '打印时间',
    ];
    expect(orderData).toContain("type: 'checkbox'");
    titles.forEach((title) => expect(orderData).toContain(`title: '${title}'`));
    expect(orderData.match(/autoFixed: false/g)).toHaveLength(4);
    expect(orderData).not.toContain("fixed: 'left'");
    expect(orderData).not.toContain("fixed: 'right'");
    expect(orderIndex).toContain('<template #no="{ row }">');
    expect(orderIndex).toContain('<template #deleteAction="{ row }">');
    expect(orderIndex).toContain('<template #printAction="{ row }">');
    expect(orderIndex).toContain('<template #exportAction="{ row }">');
    expect(orderIndex).toContain('recordAssemblyOrderPrint');
    expect(orderApi).toContain('/erp/assembly-order/export-excel');
    expect(orderApi).toContain('/erp/assembly-order/record-print');
  });

  it('keeps module management limited to recipe master data', () => {
    expect(recipeForm).toContain('formData.value.moduleCode = product.code');
    expect(recipeForm).toContain('formData.value.moduleName = product.name');
    expect(recipeForm).toContain('人工费用（每套） <b>*</b>');
    expect(recipeForm).toContain(':disabled="readonly"');
    expect(recipeForm).toContain('厂家编码');
    expect(recipeForm).toContain('规格型号');
    expect(recipeForm).toContain('每套用量');
    expect(recipeForm).not.toContain('title="批次管理"');
    expect(recipeApi).toContain('laborCostPerSet: number');
    expect(recipeApi).toContain('PURPOSE_ASSEMBLY = 1');
  });

  it('keeps the module form aligned with the sale-cart form density', () => {
    expect(recipeForm).toContain('class="assembly-recipe-modal !w-full"');
    expect(recipeForm).toContain('content-class="p-0"');
    expect(recipeForm).toContain('fullscreen');
    expect(recipeForm).toContain(':fullscreen-button="false"');
    expect(recipeForm).toContain(
      'grid-template-columns: repeat(4, minmax(0, 1fr));',
    );
    expect(recipeForm).toContain('grid-template-columns: 84px minmax(0, 1fr);');
    expect(recipeForm).toContain('min-height: 32px;');
    expect(recipeForm).toContain('font-size: 12px;');
    expect(recipeForm).not.toContain('field col-span-2');
  });

  it('shows audit information for created modules', () => {
    expect(recipeForm).toContain(
      "import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';",
    );
    expect(recipeForm).toContain(
      '<section v-if="formData.id" class="assembly-section assembly-audit">',
    );
    expect(recipeForm).toContain(
      '<ErpAuditInfo title="" :record="formData" />',
    );
    expect(recipeApi).toContain('creatorName?: string');
    expect(recipeApi).toContain('updaterName?: string');
  });

  it('opens module details from the module code instead of an action button', () => {
    expect(recipeIndex).toContain('<template #moduleCode="{ row }">');
    expect(recipeIndex).toContain('class="assembly-module-code-link"');
    expect(recipeIndex).toContain('@click.stop="openView(row)"');
    expect(recipeIndex).not.toContain("label: '查看'");
    expect(recipeIndex).not.toContain('icon: ACTION_ICON.VIEW');
  });

  it('shows the confirmed module list fields and only delete in actions', () => {
    expect(recipeData).toContain("type: 'checkbox'");
    expect(recipeData).toContain("title: '操作'");
    expect(recipeData.match(/autoFixed: false/g)).toHaveLength(2);
    expect(recipeData).toContain("field: 'moduleCode'");
    expect(recipeData).toContain("field: 'moduleName'");
    expect(recipeData).toContain("field: 'productName'");
    expect(recipeData).toContain("field: 'productDrawingNo'");
    expect(recipeData).toContain("field: 'productStandard'");
    expect(recipeData).toContain("field: 'productCode'");
    expect(recipeData).toContain("field: 'productFeatureCode'");
    expect(recipeData).toContain("field: 'productOriginPlace'");
    expect(recipeData).toContain("field: 'productVehicleModel'");
    expect(recipeData).toContain("field: 'productReferencePrice'");
    expect(recipeData).toContain("title: '类型'");
    expect(recipeData).toContain("title: '创建日期'");
    expect(recipeData).toContain("field: 'status'");
    expect(recipeData).not.toContain("fixed: 'left'");
    expect(recipeData).not.toContain("fixed: 'right'");
    expect(recipeIndex).toContain("label: '删除'");
    expect(recipeIndex).not.toContain("label: '编辑'");
    expect(recipeIndex).not.toContain(
      "label: row.status === 1 ? '停用' : '启用'",
    );
    expect(recipeForm).toContain(
      "hasAccessByCodes(['erp:assembly-recipe:update'])",
    );
    expect(recipeForm).toContain('v-if="canEdit"');
    expect(recipeForm).toContain('@click="readonly = false"');
  });

  it('keeps module list controls and table content at 12px', () => {
    expect(recipeIndex).toContain('class="assembly-recipe-grid"');
    expect(recipeIndex).toContain(
      ':deep(.assembly-recipe-grid .vxe-table--render-default)',
    );
    expect(recipeIndex).toContain(
      ':deep(.assembly-recipe-grid .vxe-grid--form-wrapper label)',
    );
    expect(recipeIndex).toContain('font-size: 12px;');
  });

  it('shows locked labor and completed cost breakdown on assembly orders', () => {
    expect(orderForm).toContain('const laborCostPerSet = computed');
    expect(orderForm).toContain('人工费用（每套）');
    expect(orderForm).toContain('人工费合计：');
    expect(orderForm).toContain('材料成本：');
    expect(orderForm).toContain('成本价：');
    expect(orderApi).toContain('recipeModuleCode?: string');
    expect(orderApi).toContain('materialCost?: number');
    expect(orderApi).toContain('laborCost?: number');
    expect(orderApi).toContain('otherCost?: number');
  });

  it('uses text inputs for assembly decimals and keeps list display rules explicit', () => {
    expect(recipeForm).toContain(':value="laborCostPerSetText"');
    expect(recipeForm).toContain(':value="record.quantityPerSetText"');
    expect(recipeForm).toContain('inputmode="decimal"');
    expect(recipeForm).toContain('laborCostPerSetTextVersion.value += 1');
    expect(recipeForm).toContain('quantityPerSetTextVersion');
    expect(recipeForm).not.toContain('<InputNumber');
    expect(orderForm).toContain(':value="otherCostText"');
    expect(orderForm).toContain(':value="setCountText"');
    expect(orderForm).toContain(':value="record.consumeQuantityText"');
    expect(orderForm).toContain('inputmode="numeric"');
    expect(orderForm).toContain('formatAssemblyNaturalDecimal');
    expect(orderForm).toContain('formatAssemblyAmountList');
    expect(orderForm).toContain('otherCostTextVersion.value += 1');
    expect(orderForm).toContain('setCountTextVersion.value += 1');
    expect(orderForm).toContain('consumeQuantityTextVersion');
    expect(orderForm).not.toContain('<InputNumber');
    expect(orderData).toContain("formatter: 'formatAmount2'");
    expect(recipeData).toContain("formatter: 'formatAmount2'");
  });

  it('uses customer, assembly recipe, split warehouses and live availability in the order form', () => {
    expect(orderForm).toContain('对象（客户）');
    expect(orderForm).toContain('配件（组装件）');
    expect(orderForm).toContain('允许最大组装数：');
    expect(orderForm).toContain('入货仓');
    expect(orderForm).toContain('出货仓');
    expect(orderForm).toContain('经办人');
    expect(orderForm).toContain('其他成本');
    expect(orderForm).toContain('getAssemblyAvailability');
    expect(orderForm).toContain('modalApi.setState({ fullscreen: true })');
    expect(orderApi).toContain('/erp/assembly-order/availability');
    expect(orderApi).toContain('/erp/assembly-order/user-simple-page');
  });

  it('uses the outbound warehouse as stock source and falls back to the required inbound warehouse', () => {
    expect(orderForm).toContain(
      'formData.value.outWarehouseId || formData.value.warehouseId || 0',
    );
    expect(orderForm).toContain('warehouseId: sourceWarehouseId.value');
    expect(orderForm).toContain('<label>入货仓 <b>*</b></label>');
    expect(orderForm).toContain('<label>出货仓</label>');
    expect(orderForm).toContain('placeholder="选填；不填则从入货仓取配件"');
    expect(orderForm).toContain("message.warning('请选择组装件和入货仓')");
    expect(orderApi).toContain('outWarehouseId?: number');
  });

  it('shows the immediately posted linked warehouse move in assembly details', () => {
    expect(orderForm).toContain('关联移货单：');
    expect(orderForm).toContain('warehouseMoveStatusName');
    expect(orderApi).toContain('warehouseMoveId?: number');
    expect(orderApi).toContain('warehouseMoveNo?: string');
    expect(orderApi).toContain('warehouseMoveStatus?: number');
  });

  it('shows the confirmed assembly detail and audit fields', () => {
    const detailTitles = [
      '序号',
      '配件编码',
      '零件名称',
      '车型',
      '图号',
      '仓库',
      '产地',
      '品牌',
      '供应商',
      '规格',
      '特征码',
      '每套用量',
      '组装用量',
      '单位',
      '零售价',
      '成本价',
      '成本金额',
      '库存',
      '本单占用',
      '缺少数量',
    ];
    detailTitles.forEach((title) =>
      expect(orderForm).toContain(`title="${title}"`),
    );
    expect(orderForm).toContain('审计信息');
    expect(orderForm).toContain('创建人：');
    expect(orderForm).toContain('编辑人：');
    expect(orderForm).toContain('#prepend-footer');
    expect(orderForm).not.toContain('#footer-before');
    expect(orderForm).not.toContain('确认人：');
    expect(orderForm).not.toContain('开始装配人：');
    expect(orderForm).not.toContain('执行轮次：');
  });

  it('exposes draft and ordered workflow endpoints', () => {
    expect(orderApi).toContain('/erp/assembly-order/create-draft');
    expect(orderApi).toContain('/erp/assembly-order/update-draft');
    [
      '/erp/assembly-order/confirm',
      '/erp/assembly-order/reverse-confirm',
      '/erp/assembly-order/start',
      '/erp/assembly-order/cancel-start',
      '/erp/assembly-order/complete',
      '/erp/assembly-order/reverse-assembly',
    ].forEach((endpoint) => expect(orderApi).toContain(endpoint));
    expect(orderApi).not.toContain('/erp/assembly-order/update-and-complete');
    expect(orderApi).not.toContain('/erp/assembly-order/void');
  });

  it('persists a draft before confirming and does not jump directly to completion', () => {
    expect(orderForm).toContain(
      'const id = await createAssemblyOrderDraft(payload)',
    );
    expect(orderForm).toContain('await confirmAssemblyOrder(id)');
    expect(orderForm).not.toContain('saveAndComplete');
  });

  it('keeps assembly stock records drillable to their source order', () => {
    expect(stockReportUi).toContain("[[100, 101, 102, 103], 'assemblyOrder'");
    expect(stockRecordTab).toContain('[100, 101, 102, 103].includes(bizType)');
    expect(stockRecordTab).toContain('AssemblyOrderModal');
  });
});
