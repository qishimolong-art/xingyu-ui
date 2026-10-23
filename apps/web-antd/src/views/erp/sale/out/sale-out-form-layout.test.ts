import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useDetailItemColumns, useStockOutDetailItemColumns } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const detailFieldsSource = formSource.slice(
  formSource.indexOf('const detailFields'),
  formSource.indexOf('const detailItemCount'),
);
const suppressedFieldsSource = formSource.slice(
  formSource.indexOf('const DETAIL_SUPPRESSED_FIELD_KEYS'),
  formSource.indexOf('const FIELD_PERMISSION_MODULE'),
);
const prependFooterStart = formSource.indexOf('#prepend-footer');
const prependFooterTemplate = formSource.slice(
  prependFooterStart,
  formSource.indexOf('<RemarkModal', prependFooterStart),
);

describe('sale out detail layout contract', () => {
  it('uses the sales-cart fullscreen four-column section layout', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      'class="sale-out-detail-section__title">基本信息',
    );
    expect(formSource).toContain(
      'class="sale-out-detail-section__title">销售产品清单',
    );
    expect(formSource).toContain(
      'class="sale-out-detail-section__title">审计信息',
    );
    expect(formSource).toContain(
      'grid-template-columns: repeat(4, minmax(0, 1fr))',
    );
  });

  it('keeps detail field labels and values on the compact 12px typography scale', () => {
    expect(formSource).toMatch(
      /\.sale-out-detail-field__label\s*\{[^}]*font-size:\s*12px;/s,
    );
    expect(formSource).toMatch(
      /\.sale-out-detail-field__value\s*\{[^}]*font-size:\s*12px;/s,
    );
  });

  it('matches the sales-cart sortable header style', () => {
    expect(formSource).toMatch(
      /\.sale-out-detail-items\s*:deep\(\.vxe-header--column\.is--sortable \.vxe-cell--title\)\s*\{[^}]*color:\s*#1677ff;/s,
    );
    expect(formSource).toMatch(
      /\.sale-out-detail-items\s*:deep\(\.vxe-header--column \.vxe-cell--sort\)\s*\{[^}]*display:\s*none;/s,
    );
  });

  it('keeps related navigation, receipt writeoff tab, and sales item rows', () => {
    expect(formSource).toContain('@click="handleOpenCustomerDetail"');
    expect(formSource).toContain('@click="handleOpenSourceOrderDetail"');
    expect(formSource).toContain('<ReceiptWriteOffTab');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:finance-receipt:query'])",
    );
    expect(formSource).toContain('<ItemGrid>');
    expect(formSource).toContain('class="sale-out-document-summary"');
  });

  it('provides explicit detail loading, failure, and success exits', () => {
    expect(formSource).toContain('detailLoading.value = true');
    expect(formSource).toContain('getErpDetailLoadError(');
    expect(formSource).toContain('详情加载失败，请关闭后重试');
    expect(formSource).toContain('detailLoading.value = false');
    expect(formSource).toContain('const items = sourceData.items ?? []');
    expect(formSource).toContain('data: items');
    expect(formSource).not.toContain('itemGridApi.grid.reloadData');
    expect(formSource).toContain('v-else-if="formData.id"');
  });

  it('defers direct grid calls until the detail item grid is mounted', () => {
    const itemPageLoaderSource = formSource.slice(
      formSource.indexOf('async function loadSaleOutItemPage('),
      formSource.indexOf('async function handleItemSortChange('),
    );
    const detailLoaderSource = formSource.slice(
      formSource.indexOf('async function loadSaleOutDetail('),
      formSource.indexOf('async function handleSourceActionSuccess('),
    );

    expect(itemPageLoaderSource).toContain('syncMountedGrid = true');
    expect(itemPageLoaderSource).toContain('syncMountedGrid &&');
    expect(itemPageLoaderSource).toContain(
      "typeof mountedItemGrid.loadData === 'function'",
    );
    expect(itemPageLoaderSource).toContain(
      "typeof mountedItemGrid.reloadColumn === 'function'",
    );
    expect(itemPageLoaderSource).toContain(
      "typeof mountedItemGrid.setSort === 'function'",
    );
    expect(detailLoaderSource).toContain(
      'loadSaleOutItemPage({ pageNo: 1 }, false)',
    );
    expect(detailLoaderSource).toContain(
      'loadExpressFilePage({ pageNo: 1 }, activeSequence)',
    );
  });

  it('preserves sales actions and supplementary tabs', () => {
    expect(formSource).toContain('@click="handlePriceAdjust"');
    expect(formSource).toContain('@click="handleReturn"');
    expect(formSource).toContain('fillReturnableItems: true');
    expect(formSource).toContain('@click="handleOpenPartialReturn"');
    expect(prependFooterTemplate).toContain('整单退货');
    expect(prependFooterTemplate).toContain('部分退货');
    expect(prependFooterTemplate).not.toMatch(/>\s*退货\s*<\/Button>/);
    expect(formSource).toContain('tab="拣货送货"');
    expect(formSource).toContain('fulfillmentSummaryItems');
    expect(formSource).toContain('tab="收款核销"');
    expect(formSource).toContain('key="finance" tab="财务进度"');
    expect(formSource).toContain('key="stockOut" tab="出仓信息"');
    expect(formSource).toContain('key="log" tab="操作日志"');
    expect(formSource).not.toContain('key="gift" tab="赠品"');
    expect(formSource).not.toContain('key="feeAmount" tab="费用"');
  });

  it('opens partial sale return by selecting returnable sale-out rows first', () => {
    expect(formSource).toContain('SaleReturnableItemSelectModal');
    expect(formSource).toContain('type SelectedReturnableRows = Array<{');
    expect(formSource).toContain('const returnableItemSelectRef');
    expect(formSource).toContain('function handleOpenPartialReturn()');
    expect(formSource).toContain(
      'returnableItemSelectRef.value?.open(formData.value);',
    );
    expect(formSource).toContain(
      'async function handleSelectPartialReturnableItems(',
    );
    expect(formSource).toContain('selectedReturnableRows: rows');
    expect(formSource).toContain('ref="returnableItemSelectRef"');
    expect(formSource).toContain(
      '@select="handleSelectPartialReturnableItems"',
    );
  });

  it('shows and refreshes the dedicated permission-controlled express upload', () => {
    expect(formSource).toContain("fieldKey: 'expressFileUrl'");
    expect(formSource).toContain("kind: 'images'");
    expect(formSource).toContain("label: '快递单'");
    expect(formSource).toContain('getSaleOutExpressFilePage');
    expect(formSource).toContain('expressFilePageState.value.total');
    expect(formSource).toContain('resolveFulfillmentFileUrl(file.fileUrl)');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:sale-out:upload-express'])",
    );
    expect(formSource).toContain('!hasEffectiveExpressFile.value');
    expect(formSource).toContain(
      'formData.value.hasExpressFile ?? Boolean(formData.value.expressFileUrl)',
    );
    expect(formSource).toContain("!isHidden('expressFileUrl')");
    expect(formSource).toContain('@click="handleUploadExpress"');
    expect(formSource).toContain('补传快递单');
    expect(formSource).toContain(
      '<ExpressUploadModalRef @success="handleExpressUploadSuccess" />',
    );
    expect(formSource).toContain('await handleSourceActionSuccess()');
    expect(formSource).toContain("emit('success')");
  });

  it('removes the requested basic fields and keeps express last on its own row', () => {
    expect(detailFieldsSource).toContain("fieldKey: 'deliveryMethod'");
    expect(detailFieldsSource).toContain("fieldKey: 'vin'");
    expect(detailFieldsSource).toContain("fieldKey: 'freightType'");
    expect(suppressedFieldsSource).not.toContain("'freightType'");

    for (const fieldKey of [
      'shipper',
      'senderName',
      'billType',
      'billNo',
      'totalProductPrice',
      'reductionAmount',
      'afterReductionAmount',
      'billAmount',
      'totalCount',
      'printCount',
      'sourceNo',
      'sourceCreateTime',
      'sourceCreatorName',
    ]) {
      expect(suppressedFieldsSource).toContain(`'${fieldKey}'`);
    }
    expect(formSource).toContain('DETAIL_SUPPRESSED_FIELD_KEYS.has(fieldKey)');
    for (const fieldKey of [
      'totalCount',
      'totalProductPrice',
      'reductionAmount',
      'afterReductionAmount',
    ]) {
      expect(formSource).toContain(`!isHidden('${fieldKey}')`);
    }

    for (const fieldKey of [
      'shipmentStatus',
      'orderType',
      'priority',
      'customerPickup',
      'logisticsNo',
      'deliveryNo',
      'thirdPartyNo',
      'thirdPartyUpstreamNo',
      'insuranceCompany',
      'creatorName',
      'auditorName',
      'saleUserName',
      'deptName',
      'approveTime',
      'printTime',
      'confirmTime',
      'signStatus',
      'signImageUrl',
      'internalNote',
    ]) {
      expect(detailFieldsSource).not.toContain(`fieldKey: '${fieldKey}'`);
    }

    expect(detailFieldsSource.lastIndexOf("fieldKey: 'expressFileUrl'")).toBe(
      detailFieldsSource.lastIndexOf('fieldKey:'),
    );
    expect(formSource).toContain(
      "'sale-out-detail-field--full-row':\n                      field.fieldKey === 'expressFileUrl'",
    );
    expect(formSource).toMatch(
      /\.sale-out-detail-field--full-row\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s,
    );
  });

  it('leaves enough room for warehouse and remark values', () => {
    const columns =
      useDetailItemColumns([], {
        rows: [
          {
            remark: '销售出库详情中的长备注需要完整展示',
            warehouseName: '兴宁路通仓',
          },
        ],
      }) || [];
    const columnMap = new Map(columns.map((column) => [column.field, column]));

    expect(columnMap.get('warehouseName')?.width).toBeGreaterThanOrEqual(96);
    expect(columnMap.get('warehouseName')?.minWidth).toBeUndefined();
    expect(columnMap.get('remark')?.width).toBeGreaterThanOrEqual(220);
    expect(columnMap.get('remark')?.minWidth).toBeUndefined();
    expect(columnMap.get('remark')?.showOverflow).toBe('tooltip');
  });

  it('keeps remark last and makes both detail grids fill their remaining width', () => {
    const detailColumns =
      useDetailItemColumns([], {
        rows: [
          {
            originalProductPrice: 12,
            remark: '销售单详情中的长备注需要保留内容计算宽度',
          },
        ],
        trailingFlexibleColumnMinWidth: 150,
      }) || [];
    const detailBusinessColumns = detailColumns.filter(
      (column) => column.field && column.visible !== false,
    );
    const remarkColumn = detailBusinessColumns.at(-1);
    const originalPriceIndex = detailBusinessColumns.findIndex(
      (column) => column.field === 'originalProductPrice',
    );
    const remarkIndex = detailBusinessColumns.findIndex(
      (column) => column.field === 'remark',
    );

    expect(remarkColumn?.field).toBe('remark');
    expect(remarkIndex).toBe(originalPriceIndex + 1);
    expect(remarkColumn?.width).toBeUndefined();
    expect(remarkColumn?.minWidth).toBeGreaterThanOrEqual(220);

    const hiddenRemarkColumns =
      useDetailItemColumns(['item_remark'], {
        rows: [{ originalProductPrice: 12 }],
        trailingFlexibleColumnMinWidth: 150,
      }) || [];
    const hiddenRemarkTrailingColumn = hiddenRemarkColumns
      .toReversed()
      .find((column) => column.field && column.visible !== false);
    expect(hiddenRemarkTrailingColumn?.field).toBe('originalProductPrice');
    expect(hiddenRemarkTrailingColumn?.width).toBeUndefined();
    expect(hiddenRemarkTrailingColumn?.minWidth).toBeGreaterThanOrEqual(150);

    const stockOutColumns =
      useStockOutDetailItemColumns([], {
        rows: [{ stockOutBillRemainCount: 1 }],
        trailingFlexibleColumnMinWidth: 150,
      }) || [];
    const stockOutTrailingColumn = stockOutColumns
      .toReversed()
      .find((column) => column.field && column.visible !== false);
    expect(stockOutTrailingColumn?.field).toBe('stockOutBillRemainCount');
    expect(stockOutTrailingColumn?.width).toBeUndefined();
    expect(stockOutTrailingColumn?.minWidth).toBeGreaterThanOrEqual(150);
  });

  it('enables adaptive layout and complete tools for both detail grids', () => {
    expect(
      formSource.match(/restoreStore: restoreSaleOutItemColumnLayout/g),
    ).toHaveLength(2);
    expect(formSource.match(/autoResize: true/g)).toHaveLength(2);
    expect(formSource).toMatch(
      /resizableChange:\s*\(\) =>\s*handleDetailItemColumnCustom\(\{ type: 'confirm' \}\)/,
    );
    expect(formSource).toMatch(
      /resizableChange:\s*\(\) =>\s*handleStockOutItemColumnCustom\(\{ type: 'confirm' \}\)/,
    );
    expect(formSource.match(/fit: true/g)).toHaveLength(2);
    expect(formSource).not.toContain('fit: false');
    expect(formSource).toContain(
      'const TRAILING_FLEXIBLE_COLUMN_MIN_WIDTH = 150;',
    );
    expect(formSource).toContain('applySaleDocumentItemColumnCustomization(');
    expect(formSource.match(/refresh: true/g)).toHaveLength(2);
    expect(formSource.match(/refreshOptions: \{/g)).toHaveLength(2);
    expect(
      formSource.match(/queryMethod: \(\) => refreshSaleOutItemGrids\(\)/g),
    ).toHaveLength(2);
    expect(formSource.match(/zoom: true/g)).toHaveLength(2);
    expect(formSource.match(/<template #toolbar-tools>/g)).toHaveLength(2);
    expect(formSource.match(/<span aria-hidden="true"><\/span>/g)).toHaveLength(
      2,
    );
    expect(formSource).toContain('custom: handleDetailItemColumnCustom');
    expect(formSource).toContain('custom: handleStockOutItemColumnCustom');
    expect(formSource).toContain('pageNo: itemPageState.value.pageNo');
    expect(formSource).toContain('pageSize: itemPageState.value.pageSize');
    expect(formSource).toContain('getCellContentExtraWidth: (field, row)');
    expect(formSource).toContain("field === 'sourceWarehouseName'");
    expect(formSource).toContain("field === 'count'");
    expect(formSource).toContain("field === 'productPrice'");
    expect(formSource).toContain("field === 'stockOutBillStatusName'");
    expect(formSource.match(/settleVxeColumnCustomization/g)).toHaveLength(3);
    expect(formSource).toContain("type === 'reset'");
    expect(formSource).toContain('refreshColumn?.()');
    expect(formSource).toContain('recalculate?.(true)');
  });

  it('formats normal and adjusted sale-out item prices to two decimals', () => {
    expect(formSource).toContain('function formatItemPrice(value: unknown)');
    expect(formSource).toContain(
      "return formatSaleAmount(value, '-');",
    );
    expect(formSource).toContain(
      "formatItemPrice(getRowValue(row, 'productPrice'))",
    );
    expect(formSource).toContain("getRowValue(row, 'originalProductPrice')");
  });

  it('formats sale-out quantities without meaningless trailing zeros', () => {
    expect(formSource).toContain(
      "formatDetailCount(getRowValue(row, 'count'))",
    );
    expect(formSource).toContain(
      "formatDetailCount(getRowValue(row, 'returnedCount'))",
    );
    expect(formSource).toContain('return formatDetailCount(value);');
    expect(formSource).not.toContain('value.toFixed(digits)');
  });

  it('shows source and outbound warehouses in both detail grids', () => {
    for (const columns of [
      useDetailItemColumns() || [],
      useStockOutDetailItemColumns() || [],
    ]) {
      const sourceIndex = columns.findIndex(
        (column) => column.field === 'sourceWarehouseName',
      );
      const outboundIndex = columns.findIndex(
        (column) => column.field === 'warehouseName',
      );
      expect(sourceIndex).toBeGreaterThanOrEqual(0);
      expect(outboundIndex).toBe(sourceIndex + 1);
      expect(columns[sourceIndex]?.title).toBe('来源仓库');
      expect(columns[outboundIndex]?.title).toBe('出库仓库');
    }
    expect(formSource).toContain('return row.crossDept === true');
    expect(formSource).toContain(
      '<Tag color="orange" class="m-0">跨部门</Tag>',
    );
  });

  it('hides source warehouse and its cross-department marker with field permission', () => {
    for (const columns of [
      useDetailItemColumns(['item_sourceWarehouseName']) || [],
      useStockOutDetailItemColumns(['item_sourceWarehouseName']) || [],
    ]) {
      expect(
        columns.some((column) => column.field === 'sourceWarehouseName'),
      ).toBe(false);
    }
  });
});
