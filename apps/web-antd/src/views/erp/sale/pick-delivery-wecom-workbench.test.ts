import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pickSource = readFileSync(join(currentDir, 'pick/index.vue'), 'utf8');
const deliverySource = readFileSync(
  join(currentDir, 'delivery/index.vue'),
  'utf8',
);
const apiSource = readFileSync(
  resolve(currentDir, '../../../api/erp/sale/pick-delivery/index.ts'),
  'utf8',
);
const wecomWorkbenchRouteSource = readFileSync(
  resolve(currentDir, '../../../router/routes/modules/erp-wecom-workbench.ts'),
  'utf8',
);

function getSourceSection(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('sale pick and delivery mobile list contract', () => {
  it('uses hidden no-layout routes for WeCom workbench entries', () => {
    expect(wecomWorkbenchRouteSource).toContain("path: '/wecom/sale-pick'");
    expect(wecomWorkbenchRouteSource).toContain("path: '/wecom/sale-delivery'");
    expect(wecomWorkbenchRouteSource).toContain('ErpSalePickWeComWorkbench');
    expect(wecomWorkbenchRouteSource).toContain(
      'ErpSaleDeliveryWeComWorkbench',
    );
    expect(wecomWorkbenchRouteSource).toContain('noBasicLayout: true');
    expect(wecomWorkbenchRouteSource).toContain('hideInTab: true');
    expect(wecomWorkbenchRouteSource).toContain(
      "import('#/views/erp/sale/pick/index.vue')",
    );
    expect(wecomWorkbenchRouteSource).toContain(
      "import('#/views/erp/sale/delivery/index.vue')",
    );
  });

  it('uses PC read APIs for pick mobile list and detail', () => {
    expect(apiSource).toContain("'/erp/sale-pick/page'");
    expect(apiSource).toContain("'/erp/sale-pick/get'");
    expect(apiSource).toContain("'/erp/sale-pick/item-page'");
    expect(apiSource).toContain("'/erp/sale-pick/submit-page'");
    expect(pickSource).toContain('const isNarrowScreen = ref(');
    expect(pickSource).toContain('const isMobileListMode = computed');
    expect(pickSource).toContain(
      '() => isWeComWorkbench.value || isNarrowScreen.value',
    );
    expect(pickSource).toContain(
      'await getSalePickPage(buildParams(nextPage, pageSize.value))',
    );
    expect(pickSource).toContain('await getSalePick(row.id, false)');
    expect(pickSource).toContain('await getSalePickItemPage({');
    expect(pickSource).toContain('await getSalePickSubmitPage({');
    expect(pickSource).not.toContain('getMobileSalePickPage(');
    expect(pickSource).not.toContain('getMobileSalePick(row.id, false)');
    expect(pickSource).not.toContain('getMobileSalePickItemPage(');
    expect(pickSource).not.toContain('getMobileSalePickSubmitPage(');
  });

  it('uses drawer and infinite cards for pick narrow screens and workbench', () => {
    expect(pickSource).toContain('mobileFilterOpen');
    expect(pickSource).toContain('mobilePageNo');
    expect(pickSource).toContain('mobileHasMore');
    expect(pickSource).toContain('mobileLoadingMore');
    expect(pickSource).toContain('handleMobileListScroll');
    expect(pickSource).toContain(
      '!mobileHasMore.value || mobileLoadingMore.value || loading.value',
    );
    expect(pickSource).toContain('<Drawer');
    expect(pickSource).toContain('class="sale-pick-mobile-filter-drawer"');
    expect(pickSource).toContain('v-if="isMobileListMode"');
    expect(pickSource).toContain('v-if="!isMobileListMode"');
    expect(pickSource).toContain("id: 'erp-sale-pick-list-v2'");
    expect(pickSource).toContain("{ type: 'checkbox', width: 44 }");
    expect(pickSource).toContain('pagerConfig: {');
    expect(pickSource).toContain(
      "'sale-pick-page--workbench': isWeComWorkbench",
    );
    expect(pickSource).toContain('业务单号');
    expect(pickSource).toContain('请选择仓库');
    expect(pickSource).toContain('请选择状态');
    expect(pickSource).toContain('加载更多...');
    expect(pickSource).toContain('已全部加载');
  });

  it('uses the standard business-document list presentation on pick desktop', () => {
    expect(pickSource).toContain('销售拣货单列表');
    expect(pickSource).toContain('useVbenVxeGrid');
    expect(pickSource).toContain("id: 'erp-sale-pick-list-v2'");
    expect(pickSource).toContain('fit: false');
    expect(pickSource).toContain(
      'toolbarConfig: { refresh: true, search: true }',
    );
    expect(pickSource).toContain('class="sale-pick-number-link"');
    expect(pickSource).toContain('class="sale-pick-progress-cell"');
    expect(pickSource).toContain('icon: ACTION_ICON.DOWNLOAD');
    expect(pickSource).toContain("auth: ['erp:sale-pick:export']");
  });

  it('distinguishes pick tasks by structured business source', () => {
    const sourceTypeOptions = getSourceSection(
      pickSource,
      'const pickSourceTypeOptions = [',
      '];',
    );
    expect(sourceTypeOptions.match(/value:/g)).toHaveLength(5);
    expect(pickSource).not.toContain("{ label: '销售单', value: 0 }");
    expect(pickSource).toContain("{ label: '销售手推车', value: 30 }");
    expect(pickSource).toContain("{ label: '销售退货', value: 70 }");
    expect(pickSource).toContain("{ label: '仓库移货', value: 80 }");
    expect(pickSource).toContain("{ label: '其它入库', value: 90 }");
    expect(pickSource).toContain("{ label: '其它出库', value: 100 }");
    expect(pickSource).toContain("fieldName: 'sourceTypeName'");
    expect(pickSource).toContain("title: '拣货来源'");
    expect(pickSource).toContain('sourceType: query.sourceType');
    expect(pickSource).not.toContain('sourceType: formValues.sourceType');
    expect(pickSource).toContain('disabled: true');
    expect(pickSource).toContain("0: '销售单'");
    expect(pickSource).toContain(
      'return pickSourceTypeNameMap[normalizedSourceType]',
    );
    expect(pickSource).toContain('{{ getSourceTypeName(row) }}');
    expect(pickSource).toContain('{{ getSourceTypeName(detail) }}');
    expect(apiSource).toContain('sourceTypeName?: string;');
    expect(apiSource).toContain('sourceType?: number;');
  });

  it('requires a source choice before loading pick lists on PC and WeCom', () => {
    expect(pickSource).toContain('const sourceTypeChooserOpen = ref(false)');
    expect(pickSource).toContain(
      'const sourceTypeSelectionRequired = ref(true)',
    );
    expect(pickSource).toContain('title="选择拣货类型"');
    expect(pickSource).toContain('v-for="option in pickSourceTypeOptions"');
    expect(pickSource).toContain(':closable="!sourceTypeSelectionRequired"');
    expect(pickSource).toContain(':keyboard="!sourceTypeSelectionRequired"');
    expect(pickSource).toContain(
      ':mask-closable="!sourceTypeSelectionRequired"',
    );
    expect(pickSource).toContain('async function activateSourceType(');
    expect(pickSource).toContain('query.sourceType = sourceType');
    expect(pickSource).toContain(
      'async function syncDesktopSourceTypeForm(sourceType?: number)',
    );
    expect(pickSource).toContain('isMobileListMode.value ||');
    expect(pickSource).toContain(
      "typeof gridApi.formApi?.setValues !== 'function'",
    );
    expect(pickSource).toContain('await syncDesktopSourceTypeForm(sourceType)');
    expect(pickSource).toContain('await resetListForSourceChange()');
    expect(pickSource).toContain('await loadData();');
    expect(pickSource).toContain('function showSourceTypeSwitcher()');
    expect(pickSource).toContain('切换拣货类型');
    expect(pickSource).toContain('切换类型');
    expect(pickSource).toContain(':value="currentSourceTypeName"');
    expect(pickSource).not.toContain(
      'query.sourceType = undefined;\n  query.warehouseId',
    );
  });

  it('opens a valid notification task directly and falls back to the source chooser', () => {
    expect(pickSource).toContain('function getRouteTaskId()');
    expect(pickSource).toContain('!/^\\d+$/.test(routeValue)');
    expect(pickSource).toContain('async function initializePickPage()');
    expect(pickSource).toContain(
      'directTask = await getSalePick(taskId, false)',
    );
    expect(pickSource).toContain(
      'const sourceType = normalizePickSourceType(directTask.sourceType)',
    );
    expect(pickSource).toContain('await activateSourceType(sourceType)');
    expect(pickSource).toContain('await openDetail(directTask, directTask)');
    expect(pickSource).toContain('showInitialSourceTypeChooser();');
    expect(pickSource).toContain(
      'await Promise.all([loadWarehouseOptions(), initializePickPage()]);',
    );
    expect(pickSource).not.toContain(
      'await loadWarehouseOptions();\n  await loadData();',
    );
  });

  it('auto refreshes pick lists every 10 seconds and only prompts on new orders', () => {
    expect(pickSource).toContain('const LIST_AUTO_REFRESH_INTERVAL = 10_000');
    expect(pickSource).toContain('let listAutoRefreshTimer');
    expect(pickSource).toContain('let listAutoRefreshing = false');
    expect(pickSource).toContain('function shouldSkipListAutoRefresh()');
    expect(pickSource).toContain('document.hidden');
    expect(pickSource).toContain('mobileFilterOpen.value');
    expect(pickSource).toContain('detailOpen.value');
    expect(pickSource).toContain('submitLoading.value');
    expect(pickSource).toContain('mobileLoadingMore.value');
    expect(pickSource).toContain('loading.value');
    expect(pickSource).toContain('listAutoRefreshing');
    expect(pickSource).toContain('function startListAutoRefresh()');
    expect(pickSource).toContain('window.setInterval(() => {');
    expect(pickSource).toContain('loadData(true)');
    expect(pickSource).toContain('LIST_AUTO_REFRESH_INTERVAL');
    expect(pickSource).toContain('function stopListAutoRefresh()');
    expect(pickSource).toContain('window.clearInterval(listAutoRefreshTimer)');
    expect(pickSource).toContain('startListAutoRefresh();');
    expect(pickSource).toContain('stopListAutoRefresh();');
    expect(pickSource).toContain(
      'async function loadData(silentRefresh = false)',
    );
    expect(pickSource).toContain('await loadMobileData(false, silentRefresh)');
    expect(pickSource).toContain('countNewRows(rows.value, nextRows)');
    expect(pickSource).toContain(
      'mergeMobileAutoRefreshRows(rows.value, nextRows, nextTotal)',
    );
    expect(pickSource).toContain(
      `message.success(\`发现 \${newRowCount} 个新拣货单\`)`,
    );
    expect(pickSource).toContain('onBeforeUnmount(() => {');
    expect(pickSource).toContain('stopListAutoRefresh();');
  });

  it('uses PC read APIs for delivery mobile list and detail', () => {
    expect(apiSource).toContain("'/erp/sale-delivery/page'");
    expect(apiSource).toContain("'/erp/sale-delivery/get'");
    expect(apiSource).toContain("'/erp/sale-delivery/item-page'");
    expect(apiSource).toContain("'/erp/sale-delivery/submit-page'");
    expect(deliverySource).toContain('const isNarrowScreen = ref(');
    expect(deliverySource).toContain('const isMobileListMode = computed');
    expect(deliverySource).toContain(
      '() => isWeComWorkbench.value || isNarrowScreen.value',
    );
    expect(deliverySource).toContain('await getSaleDeliveryPage(');
    expect(deliverySource).toContain('await getSaleDelivery(row.id, false)');
    expect(deliverySource).toContain('await getSaleDeliveryItemPage({');
    expect(deliverySource).toContain('await getSaleDeliverySubmitPage({');
    expect(deliverySource).not.toContain('getMobileSaleDeliveryPage(');
    expect(deliverySource).not.toContain(
      'getMobileSaleDelivery(row.id, false)',
    );
    expect(deliverySource).not.toContain('getMobileSaleDeliveryItemPage(');
    expect(deliverySource).not.toContain('getMobileSaleDeliverySubmitPage(');
  });

  it('uses drawer and infinite cards for delivery narrow screens and workbench', () => {
    expect(deliverySource).toContain('mobileFilterOpen');
    expect(deliverySource).toContain('mobilePageNo');
    expect(deliverySource).toContain('mobileHasMore');
    expect(deliverySource).toContain('mobileLoadingMore');
    expect(deliverySource).toContain('handleMobileListScroll');
    expect(deliverySource).toContain(
      '!mobileHasMore.value || mobileLoadingMore.value || loading.value',
    );
    expect(deliverySource).toContain('<Drawer');
    expect(deliverySource).toContain(
      'class="sale-delivery-mobile-filter-drawer"',
    );
    expect(deliverySource).toContain('v-if="isMobileListMode"');
    expect(deliverySource).toContain('v-if="!isMobileListMode"');
    expect(deliverySource).toContain("id: 'erp-sale-delivery-list-v2'");
    expect(deliverySource).toContain("{ type: 'checkbox', width: 44 }");
    expect(deliverySource).toContain('pagerConfig: {');
    expect(deliverySource).toContain(
      "'sale-delivery-page--workbench': isWeComWorkbench",
    );
    expect(deliverySource).toContain('销售单号');
    expect(deliverySource).toContain('请选择拣货状态');
    expect(deliverySource).toContain('请选择送货状态');
    expect(deliverySource).toContain('加载更多...');
    expect(deliverySource).toContain('已全部加载');
  });

  it('auto refreshes delivery lists every 10 seconds and only prompts on new orders', () => {
    expect(deliverySource).toContain(
      'const LIST_AUTO_REFRESH_INTERVAL = 10_000',
    );
    expect(deliverySource).toContain('let listAutoRefreshTimer');
    expect(deliverySource).toContain('let listAutoRefreshing = false');
    expect(deliverySource).toContain('function shouldSkipListAutoRefresh()');
    expect(deliverySource).toContain('document.hidden');
    expect(deliverySource).toContain('mobileFilterOpen.value');
    expect(deliverySource).toContain('detailOpen.value');
    expect(deliverySource).toContain('submitLoading.value');
    expect(deliverySource).toContain('mobileLoadingMore.value');
    expect(deliverySource).toContain('loading.value');
    expect(deliverySource).toContain('listAutoRefreshing');
    expect(deliverySource).toContain('function startListAutoRefresh()');
    expect(deliverySource).toContain('window.setInterval(() => {');
    expect(deliverySource).toContain('loadData(true)');
    expect(deliverySource).toContain('LIST_AUTO_REFRESH_INTERVAL');
    expect(deliverySource).toContain('function stopListAutoRefresh()');
    expect(deliverySource).toContain(
      'window.clearInterval(listAutoRefreshTimer)',
    );
    expect(deliverySource).toContain('startListAutoRefresh();');
    expect(deliverySource).toContain('stopListAutoRefresh();');
    expect(deliverySource).toContain(
      'async function loadData(silentRefresh = false)',
    );
    expect(deliverySource).toContain(
      'await loadMobileData(false, silentRefresh)',
    );
    expect(deliverySource).toContain('countNewRows(rows.value, nextRows)');
    expect(deliverySource).toContain(
      'mergeMobileAutoRefreshRows(rows.value, nextRows, nextTotal)',
    );
    expect(deliverySource).toContain(
      `message.success(\`发现 \${newRowCount} 个新送货单\`)`,
    );
    expect(deliverySource).toContain('onBeforeUnmount(() => {');
    expect(deliverySource).toContain('stopListAutoRefresh();');
  });

  it('keeps mobile operation APIs for submit and voucher upload', () => {
    expect(apiSource).toContain("'/erp/sale-pick/mobile/submit'");
    expect(apiSource).toContain("'/erp/sale-pick/mobile/upload-voucher'");
    expect(apiSource).toContain("'/erp/sale-delivery/mobile/submit'");
    expect(apiSource).toContain("'/erp/sale-delivery/mobile/upload-voucher'");
    expect(pickSource).toContain('submitSalePick({');
    expect(pickSource).toContain('uploadSalePickVoucher(rawFile)');
    expect(deliverySource).toContain('submitSaleDelivery({');
    expect(deliverySource).toContain('uploadSaleDeliveryVoucher(rawFile)');
  });

  it('allows delivery from cumulative picked-undelivered quantity on PC, mobile and WeCom', () => {
    expect(apiSource).toContain('availableDeliveryCount?: string');
    expect(apiSource).toContain('deliverableItemCount?: number');
    expect(deliverySource).toContain("dataIndex: 'pickedCount'");
    expect(deliverySource).toContain("dataIndex: 'availableDeliveryCount'");
    expect(deliverySource).toContain('当前可送');
    expect(deliverySource).toContain('剩余未送');
    expect(deliverySource).toContain('已拣数量可立即分批送货');
    expect(deliverySource).not.toContain('detail.value?.pickStatus === 30');
    expect(deliverySource).not.toContain('detail.value.pickStatus === 30');
    expect(deliverySource).not.toContain('拣货全部完成后才能提交送货');
  });

  it('shows warehouse position, package quantity and piece count on pick and delivery details', () => {
    expect(apiSource).toContain('warehousePosition?: string');
    expect(apiSource).toContain('packageQty?: number');
    expect(apiSource).toContain('pieceCount?: number | string');
    expect(apiSource).toContain('totalPieceCount?: number | string');

    expect(pickSource).toContain("dataIndex: 'warehousePosition'");
    expect(pickSource).toContain("dataIndex: 'packageQty'");
    expect(pickSource).toContain("dataIndex: 'pieceCount'");
    expect(pickSource).toContain('formatSaleItemPieceCount');
    expect(pickSource).toContain('件数合计');
    expect(pickSource).toContain(
      'formatTotalPieceCount(detail.totalPieceCount)',
    );
    expect(pickSource).toContain('formatPieceCount(item)');
    expect(pickSource).toContain('sale-pick-submit-panel__primary');
    expect(pickSource).toContain('上传凭证（{{ voucherFileList.length }}/9）');
    expect(pickSource).toContain('提交拣货（');
    expect(pickSource).toContain('selectedItemIds.length');

    expect(deliverySource).toContain("dataIndex: 'warehousePosition'");
    expect(deliverySource).toContain("dataIndex: 'packageQty'");
    expect(deliverySource).toContain("dataIndex: 'pieceCount'");
    expect(deliverySource).toContain('formatSaleItemPieceCount');
    expect(deliverySource).toContain('件数合计');
    expect(deliverySource).toContain(
      'formatTotalPieceCount(detail.totalPieceCount)',
    );
    expect(deliverySource).toContain('formatPieceCount(item)');
    expect(deliverySource).toContain('sale-delivery-submit-panel__primary');
    expect(deliverySource).toContain(
      '上传快递单（{{ voucherFileList.length }}/9）',
    );
    expect(deliverySource).toContain('提交送货（');
    expect(deliverySource).toContain('selectedItemIds.length');
  });

  it('keeps mobile submit buttons visible above the bottom safe area', () => {
    expect(pickSource).toContain(
      'padding: 10px 12px calc(56px + env(safe-area-inset-bottom));',
    );
    expect(pickSource).toContain(
      'grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);',
    );
    expect(pickSource).toContain('min-height: 44px;');
    expect(pickSource).toContain('white-space: nowrap;');

    expect(deliverySource).toContain(
      'padding: 10px 12px calc(56px + env(safe-area-inset-bottom));',
    );
    expect(deliverySource).toContain(
      'grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);',
    );
    expect(deliverySource).toContain('min-height: 44px;');
    expect(deliverySource).toContain('white-space: nowrap;');
  });

  it('closes pick and delivery details after successful submit', () => {
    const cases = [
      {
        handler: 'handleSubmitPick',
        source: pickSource,
        submitCall: 'await submitSalePick({',
        successMessage: "message.success('拣货提交成功');",
      },
      {
        handler: 'handleSubmitDelivery',
        source: deliverySource,
        submitCall: 'await submitSaleDelivery({',
        successMessage: "message.success('送货提交成功');",
      },
    ];

    for (const item of cases) {
      const submitSection = getSourceSection(
        item.source,
        `async function ${item.handler}() {`,
        'function closeDetail() {',
      );
      expect(submitSection).toContain(
        'const submittedTaskId = detail.value.id;',
      );
      expect(submitSection).toContain('taskId: submittedTaskId,');
      expect(submitSection).toContain(item.submitCall);
      expect(submitSection).toContain(item.successMessage);
      expect(submitSection).toContain(
        'if (detail.value?.id === submittedTaskId) {',
      );
      expect(submitSection).toContain('closeDetail();');
      expect(submitSection).toContain('await loadData();');
      expect(submitSection.indexOf('closeDetail();')).toBeLessThan(
        submitSection.indexOf('await loadData();'),
      );
      expect(submitSection).not.toContain('detail.value = await getSale');
      expect(submitSection).not.toContain('await loadDetailItems(');
      expect(submitSection).not.toContain('await loadDetailSubmits(');
    }
  });

  it('uses one explicit close path for escape, mask and close button', () => {
    for (const source of [pickSource, deliverySource]) {
      const closeSection = getSourceSection(
        source,
        'function closeDetail() {',
        'async function loadWarehouseOptions() {',
      );
      expect(closeSection).toContain('detailOpen.value = false;');
      expect(closeSection).toContain('function handleDetailAfterClose() {');
      expect(closeSection).toContain('detail.value = undefined;');
      expect(closeSection).toContain("detailActiveTab.value = 'items';");
      expect(closeSection).toContain('resetSubmitForm();');
      expect(closeSection).toContain('resetDetailPagination();');
      expect(source).toContain(':keyboard="true"');
      expect(source).toContain(':mask-closable="true"');
      expect(source).toContain('@after-close="handleDetailAfterClose"');
      expect(source).toContain('@cancel="closeDetail"');
    }
  });
});
